from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from plaid.model.transactions_sync_request import TransactionsSyncRequest
from sqlalchemy.orm import Session

from src.accounts.service import _get_plaid_client
from src.categorization.service import apply_rules_to
from src.storage.models import Account, PlaidItem, SyncLog, Transaction
from src.transactions.service import classify_auto_exclude, compute_spend_amount


# ---------------------------------------------------------------------------
# Sync a single Plaid item
# ---------------------------------------------------------------------------


def sync_item(db: Session, item_id: str) -> SyncLog:
    """
    Sync transactions for a single PlaidItem identified by its DB id.
    Returns the SyncLog entry created for this run.
    """
    db_item = db.query(PlaidItem).filter(PlaidItem.id == item_id).first()
    if db_item is None:
        raise ValueError(f"PlaidItem {item_id} not found")

    log = SyncLog(
        id=str(uuid4()),
        plaid_item_id=db_item.id,
        started_at=datetime.utcnow(),
        status="failed",
    )
    db.add(log)
    db.flush()

    try:
        _do_sync(db, db_item, log)
        log.status = "success"
    except Exception as exc:  # noqa: BLE001
        log.status = "failed"
        log.error_message = str(exc)
        db_item.status = "error"
    finally:
        log.finished_at = datetime.utcnow()
        db.commit()

    return log


def _do_sync(db: Session, db_item: PlaidItem, log: SyncLog) -> None:
    client = _get_plaid_client()

    cursor: str | None = db_item.cursor
    added_count = 0
    modified_count = 0
    removed_count = 0

    # Paginate through all pages
    has_more = True
    while has_more:
        request_kwargs: dict = {"access_token": db_item.access_token}
        if cursor:
            request_kwargs["cursor"] = cursor

        request = TransactionsSyncRequest(**request_kwargs)
        response = client.transactions_sync(request)

        # Build account lookup for this item (keyed by plaid_account_id)
        account_map: dict[str, Account] = {
            acct.plaid_account_id: acct for acct in db_item.accounts
        }

        # --- Added / Modified ---
        for raw in list(response["added"]) + list(response["modified"]):
            plaid_txn_id: str = raw["transaction_id"]
            plaid_account_id: str = raw["account_id"]

            account = account_map.get(plaid_account_id)
            if account is None:
                continue  # account not tracked (e.g. savings filtered out)

            amount = Decimal(str(raw["amount"]))
            spend_amount = compute_spend_amount(
                amount, account.type or "", account.subtype or ""
            )

            plaid_primary: str | None = None
            plaid_detailed: str | None = None
            if raw.get("personal_finance_category"):
                pfc = raw["personal_finance_category"]
                plaid_primary = pfc.get("primary")
                plaid_detailed = pfc.get("detailed")

            description: str = (
                raw.get("name") or raw.get("merchant_name") or ""
            )
            merchant_name: str | None = raw.get("merchant_name")

            txn_data = {
                "description": description,
                "plaid_primary_category": plaid_primary,
                "spend_amount": spend_amount,
            }
            auto_reason = classify_auto_exclude(txn_data, account)

            # Check for existing record
            existing = (
                db.query(Transaction)
                .filter(Transaction.plaid_transaction_id == plaid_txn_id)
                .first()
            )

            if existing is None:
                txn = Transaction(
                    id=str(uuid4()),
                    plaid_transaction_id=plaid_txn_id,
                    account_id=account.id,
                    date=raw["date"],
                    posted_date=raw.get("authorized_date"),
                    amount=amount,
                    spend_amount=spend_amount,
                    description=description,
                    merchant_name=merchant_name,
                    iso_currency_code=raw.get("iso_currency_code", "USD") or "USD",
                    pending=bool(raw.get("pending", False)),
                    plaid_primary_category=plaid_primary,
                    plaid_detailed_category=plaid_detailed,
                    auto_excluded_reason=auto_reason,
                )
                db.add(txn)
                added_count += 1
                # Apply categorization rules to new transaction
                db.flush()
                apply_rules_to(db, txn)
            else:
                # Update mutable fields; preserve user overrides
                existing.date = raw["date"]
                existing.posted_date = raw.get("authorized_date")
                existing.amount = amount
                existing.spend_amount = spend_amount
                existing.description = description
                existing.merchant_name = merchant_name
                existing.pending = bool(raw.get("pending", False))
                existing.plaid_primary_category = plaid_primary
                existing.plaid_detailed_category = plaid_detailed
                # Only update auto_excluded_reason if user hasn't overridden
                if not existing.user_excluded and not existing.user_included:
                    existing.auto_excluded_reason = auto_reason
                existing.updated_at = datetime.utcnow()
                modified_count += 1

        # --- Removed ---
        for removed in response["removed"]:
            plaid_txn_id = removed["transaction_id"]
            txn = (
                db.query(Transaction)
                .filter(Transaction.plaid_transaction_id == plaid_txn_id)
                .first()
            )
            if txn:
                db.delete(txn)
                removed_count += 1

        cursor = response["next_cursor"]
        has_more = bool(response["has_more"])

    # Persist cursor and sync timestamp
    db_item.cursor = cursor
    db_item.last_synced_at = datetime.utcnow()
    db_item.status = "active"
    db.flush()

    log.added_count = added_count
    log.modified_count = modified_count
    log.removed_count = removed_count


# ---------------------------------------------------------------------------
# Sync all active items
# ---------------------------------------------------------------------------


def sync_all_items(db: Session) -> list[SyncLog]:
    """Sync all active PlaidItems, then run CC payment pair detection."""
    from src.transactions.service import run_cc_payment_pair_detector

    items = db.query(PlaidItem).filter(PlaidItem.status == "active").all()
    logs: list[SyncLog] = []
    for item in items:
        log = sync_item(db, item.id)
        logs.append(log)

    run_cc_payment_pair_detector(db)
    return logs
