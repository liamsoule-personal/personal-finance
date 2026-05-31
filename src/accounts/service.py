from __future__ import annotations

from uuid import uuid4

from plaid.api import plaid_api
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import (
    ItemPublicTokenExchangeRequest,
)
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid import ApiClient, Configuration
from sqlalchemy.orm import Session

from src.config import settings
from src.storage.models import Account, PlaidItem

# ---------------------------------------------------------------------------
# Plaid client setup
# ---------------------------------------------------------------------------


def _get_plaid_client() -> plaid_api.PlaidApi:
    config = Configuration(
        host=f"https://{settings.PLAID_ENV}.plaid.com",
        api_key={
            "clientId": settings.PLAID_CLIENT_ID,
            "secret": settings.PLAID_SECRET,
        },
    )
    return plaid_api.PlaidApi(ApiClient(config))


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


def create_link_token(db: Session, access_token: str | None = None) -> dict:
    """Create a Plaid Link token. Pass access_token for update/re-link mode."""
    client = _get_plaid_client()

    request_kwargs: dict = {
        "user": LinkTokenCreateRequestUser(client_user_id="weekly-ledger-user"),
        "client_name": "Weekly Ledger",
        "products": [Products("transactions")],
        "country_codes": [CountryCode("US")],
        "language": "en",
    }

    if access_token:
        # Update mode — re-authenticate an existing item
        request_kwargs["access_token"] = access_token
        request_kwargs.pop("products", None)

    request = LinkTokenCreateRequest(**request_kwargs)
    response = client.link_token_create(request)
    return {
        "link_token": response["link_token"],
        "expiration": str(response["expiration"]),
    }


def exchange_public_token(db: Session, public_token: str) -> PlaidItem:
    """Exchange a public token, fetch accounts, and persist to DB."""
    client = _get_plaid_client()

    # Exchange public token for access token
    exchange_req = ItemPublicTokenExchangeRequest(public_token=public_token)
    exchange_resp = client.item_public_token_exchange(exchange_req)
    access_token: str = exchange_resp["access_token"]
    plaid_item_id: str = exchange_resp["item_id"]

    # Fetch institution info via accounts/get
    accounts_req = AccountsGetRequest(access_token=access_token)
    accounts_resp = client.accounts_get(accounts_req)

    item_data = accounts_resp["item"]
    institution_id: str | None = item_data.get("institution_id")
    institution_name: str | None = None

    # Try to resolve institution name
    if institution_id:
        try:
            from plaid.model.institutions_get_by_id_request import (
                InstitutionsGetByIdRequest,
            )

            inst_req = InstitutionsGetByIdRequest(
                institution_id=institution_id,
                country_codes=[CountryCode("US")],
            )
            inst_resp = client.institutions_get_by_id(inst_req)
            institution_name = inst_resp["institution"]["name"]
        except Exception:
            pass

    # Upsert PlaidItem
    db_item = (
        db.query(PlaidItem)
        .filter(PlaidItem.plaid_item_id == plaid_item_id)
        .first()
    )
    if db_item is None:
        db_item = PlaidItem(
            id=str(uuid4()),
            plaid_item_id=plaid_item_id,
            access_token=access_token,
            institution_id=institution_id,
            institution_name=institution_name,
            status="active",
        )
        db.add(db_item)
    else:
        db_item.access_token = access_token
        db_item.status = "active"

    db.flush()

    # Upsert accounts (exclude savings subtype)
    EXCLUDED_SUBTYPES = {"savings"}
    for acct in accounts_resp["accounts"]:
        subtype = str(acct["subtype"]) if acct.get("subtype") else ""
        if subtype.lower() in EXCLUDED_SUBTYPES:
            continue

        db_acct = (
            db.query(Account)
            .filter(Account.plaid_account_id == acct["account_id"])
            .first()
        )
        if db_acct is None:
            db_acct = Account(
                id=str(uuid4()),
                plaid_item_id=db_item.id,
                plaid_account_id=acct["account_id"],
                name=acct.get("name", ""),
                official_name=acct.get("official_name"),
                type=str(acct["type"]) if acct.get("type") else "",
                subtype=subtype,
                mask=acct.get("mask"),
                is_active=True,
            )
            db.add(db_acct)
        else:
            db_acct.name = acct.get("name", db_acct.name)
            db_acct.official_name = acct.get("official_name", db_acct.official_name)
            db_acct.mask = acct.get("mask", db_acct.mask)
            db_acct.is_active = True

    db.commit()
    db.refresh(db_item)
    return db_item


def list_accounts(db: Session) -> list[dict]:
    """Return all accounts joined with their parent item status."""
    accounts = (
        db.query(Account)
        .join(PlaidItem, Account.plaid_item_id == PlaidItem.id)
        .all()
    )
    result = []
    for acct in accounts:
        result.append(
            {
                "id": acct.id,
                "plaid_account_id": acct.plaid_account_id,
                "name": acct.name,
                "official_name": acct.official_name,
                "type": acct.type,
                "subtype": acct.subtype,
                "mask": acct.mask,
                "is_active": acct.is_active,
                "item_status": acct.plaid_item.status,
                "institution_name": acct.plaid_item.institution_name,
            }
        )
    return result


def disconnect_item(db: Session, item_id: str) -> None:
    """Delete an item and cascade-delete all its accounts and transactions."""
    db_item = db.query(PlaidItem).filter(PlaidItem.id == item_id).first()
    if db_item is None:
        return
    db.delete(db_item)
    db.commit()
