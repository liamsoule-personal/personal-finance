from __future__ import annotations

import os
import threading
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

from fastapi import BackgroundTasks, Body, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from src import accounts as accounts_pkg
from src import analytics as analytics_pkg
from src import categorization as categorization_pkg
from src import ingestion as ingestion_pkg
from src import transactions as transactions_pkg
from src.accounts import service as accounts_svc
from src.analytics import service as analytics_svc
from src.api.schemas import (
    AccountOut,
    CreateRuleRequest,
    ExchangeTokenRequest,
    LinkTokenRequest,
    LinkTokenResponse,
    RuleOut,
    TransactionOut,
    TransactionUpdate,
)
from src.categorization import service as categorization_svc
from src.config import settings
from src.ingestion import service as ingestion_svc
from src.storage.database import get_db, SessionLocal
from src.storage.models import Account, PlaidItem, Transaction
from src.transactions import service as transactions_svc

# ---------------------------------------------------------------------------
# Plaid PFC v2 category reference (hardcoded)
# ---------------------------------------------------------------------------

PLAID_CATEGORIES: dict[str, list[str]] = {
    "INCOME": [
        "INCOME_DIVIDENDS",
        "INCOME_INTEREST_EARNED",
        "INCOME_RETIREMENT_PENSION",
        "INCOME_TAX_REFUND",
        "INCOME_UNEMPLOYMENT",
        "INCOME_WAGES",
        "INCOME_OTHER_INCOME",
    ],
    "TRANSFER_IN": [
        "TRANSFER_IN_CASH_ADVANCES_AND_OVERDRAFTS",
        "TRANSFER_IN_DEPOSIT",
        "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS",
        "TRANSFER_IN_SAVINGS",
        "TRANSFER_IN_ACCOUNT_TRANSFER",
        "TRANSFER_IN_OTHER_TRANSFER_IN",
    ],
    "TRANSFER_OUT": [
        "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS",
        "TRANSFER_OUT_SAVINGS",
        "TRANSFER_OUT_WITHDRAWAL",
        "TRANSFER_OUT_ACCOUNT_TRANSFER",
        "TRANSFER_OUT_OTHER_TRANSFER_OUT",
    ],
    "LOAN_PAYMENTS": [
        "LOAN_PAYMENTS_CAR_PAYMENT",
        "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
        "LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT",
        "LOAN_PAYMENTS_MORTGAGE_PAYMENT",
        "LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT",
        "LOAN_PAYMENTS_OTHER_PAYMENT",
    ],
    "BANK_FEES": [
        "BANK_FEES_ATM_FEES",
        "BANK_FEES_FOREIGN_TRANSACTION_FEES",
        "BANK_FEES_INSUFFICIENT_FUNDS",
        "BANK_FEES_INTEREST_CHARGE",
        "BANK_FEES_OVERDRAFT_FEES",
        "BANK_FEES_OTHER_BANK_FEES",
    ],
    "ENTERTAINMENT": [
        "ENTERTAINMENT_CASINOS_AND_GAMBLING",
        "ENTERTAINMENT_MUSIC_AND_AUDIO",
        "ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS",
        "ENTERTAINMENT_TV_AND_MOVIES",
        "ENTERTAINMENT_VIDEO_GAMES",
        "ENTERTAINMENT_OTHER_ENTERTAINMENT",
    ],
    "FOOD_AND_DRINK": [
        "FOOD_AND_DRINK_BEER_WINE_AND_SPIRITS",
        "FOOD_AND_DRINK_COFFEE",
        "FOOD_AND_DRINK_FAST_FOOD",
        "FOOD_AND_DRINK_GROCERIES",
        "FOOD_AND_DRINK_RESTAURANT",
        "FOOD_AND_DRINK_VENDING_MACHINES",
        "FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK",
    ],
    "GENERAL_MERCHANDISE": [
        "GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS",
        "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES",
        "GENERAL_MERCHANDISE_CONVENIENCE_STORES",
        "GENERAL_MERCHANDISE_DEPARTMENT_STORES",
        "GENERAL_MERCHANDISE_DISCOUNT_STORES",
        "GENERAL_MERCHANDISE_ELECTRONICS",
        "GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES",
        "GENERAL_MERCHANDISE_OFFICE_SUPPLIES",
        "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES",
        "GENERAL_MERCHANDISE_PET_SUPPLIES",
        "GENERAL_MERCHANDISE_SPORTING_GOODS",
        "GENERAL_MERCHANDISE_SUPERSTORES",
        "GENERAL_MERCHANDISE_TOBACCO_AND_VAPING",
        "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
    ],
    "HOME_IMPROVEMENT": [
        "HOME_IMPROVEMENT_FURNITURE",
        "HOME_IMPROVEMENT_HARDWARE",
        "HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE",
        "HOME_IMPROVEMENT_SECURITY",
        "HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT",
    ],
    "MEDICAL": [
        "MEDICAL_DENTAL_CARE",
        "MEDICAL_EYE_CARE",
        "MEDICAL_NURSING_CARE",
        "MEDICAL_PHARMACIES_AND_SUPPLEMENTS",
        "MEDICAL_PRIMARY_CARE",
        "MEDICAL_VETERINARY_SERVICES",
        "MEDICAL_OTHER_MEDICAL",
    ],
    "PERSONAL_CARE": [
        "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS",
        "PERSONAL_CARE_HAIR_AND_BEAUTY",
        "PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING",
        "PERSONAL_CARE_OTHER_PERSONAL_CARE",
    ],
    "GENERAL_SERVICES": [
        "GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING",
        "GENERAL_SERVICES_AUTOMOTIVE",
        "GENERAL_SERVICES_CHILDCARE",
        "GENERAL_SERVICES_CONSULTING_AND_LEGAL",
        "GENERAL_SERVICES_EDUCATION",
        "GENERAL_SERVICES_INSURANCE",
        "GENERAL_SERVICES_POSTAGE_AND_SHIPPING",
        "GENERAL_SERVICES_STORAGE",
        "GENERAL_SERVICES_OTHER_GENERAL_SERVICES",
    ],
    "GOVERNMENT_AND_NON_PROFIT": [
        "GOVERNMENT_AND_NON_PROFIT_DONATIONS",
        "GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_FEES",
        "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT",
        "GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT",
    ],
    "TRANSPORTATION": [
        "TRANSPORTATION_BIKES_AND_SCOOTERS",
        "TRANSPORTATION_GAS",
        "TRANSPORTATION_PARKING",
        "TRANSPORTATION_PUBLIC_TRANSIT",
        "TRANSPORTATION_TAXIS_AND_RIDE_SHARES",
        "TRANSPORTATION_TOLLS",
        "TRANSPORTATION_OTHER_TRANSPORTATION",
    ],
    "TRAVEL": [
        "TRAVEL_FLIGHTS",
        "TRAVEL_LODGING",
        "TRAVEL_RENTAL_CARS",
        "TRAVEL_OTHER_TRAVEL",
    ],
    "RENT_AND_UTILITIES": [
        "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY",
        "RENT_AND_UTILITIES_INTERNET_AND_CABLE",
        "RENT_AND_UTILITIES_RENT",
        "RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT",
        "RENT_AND_UTILITIES_TELEPHONE",
        "RENT_AND_UTILITIES_WATER",
        "RENT_AND_UTILITIES_OTHER_UTILITIES",
    ],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _txn_to_out(txn: Transaction) -> TransactionOut:
    account: Account = txn.account
    effective_category = (
        txn.user_detailed_category
        or txn.plaid_detailed_category
        or txn.user_primary_category
        or txn.plaid_primary_category
    )
    is_included = (not txn.user_excluded) and (
        txn.user_included or txn.auto_excluded_reason is None
    )
    return TransactionOut(
        id=txn.id,
        account_id=txn.account_id,
        account_name=account.name if account else "",
        date=txn.date.isoformat() if txn.date else "",
        posted_date=txn.posted_date.isoformat() if txn.posted_date else None,
        amount=float(txn.amount),
        spend_amount=float(txn.spend_amount),
        description=txn.description,
        merchant_name=txn.merchant_name,
        pending=txn.pending,
        plaid_primary_category=txn.plaid_primary_category,
        plaid_detailed_category=txn.plaid_detailed_category,
        user_primary_category=txn.user_primary_category,
        user_detailed_category=txn.user_detailed_category,
        effective_category=effective_category,
        user_excluded=txn.user_excluded,
        user_included=txn.user_included,
        auto_excluded_reason=txn.auto_excluded_reason,
        is_included=is_included,
        paired_txn_id=txn.paired_txn_id,
    )


def _parse_week_start(week_start: str | None) -> date:
    if not week_start:
        today = date.today()
        # Default to Monday of current week
        return today - timedelta(days=today.weekday())
    try:
        return date.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(
            status_code=422, detail="week_start must be in YYYY-MM-DD format"
        )


# ---------------------------------------------------------------------------
# Background sync on startup
# ---------------------------------------------------------------------------


def _background_startup_sync() -> None:
    """Trigger a sync if last sync was more than HOST_SYNC_INTERVAL_SECONDS ago."""
    db = SessionLocal()
    try:
        from sqlalchemy import func

        last_synced = db.query(func.max(PlaidItem.last_synced_at)).scalar()
        if last_synced is None or (
            datetime.utcnow() - last_synced
        ).total_seconds() > settings.HOST_SYNC_INTERVAL_SECONDS:
            ingestion_svc.sync_all_items(db)
    except Exception:  # noqa: BLE001
        pass
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    thread = threading.Thread(target=_background_startup_sync, daemon=True)
    thread.start()
    yield


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Weekly Ledger API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files if the directory exists
_static_dir = os.path.join(os.path.dirname(__file__), "..", "web", "static")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=_static_dir), name="static")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Plaid ---


@app.post("/api/plaid/link-token", response_model=LinkTokenResponse)
def create_link_token(
    body: LinkTokenRequest | None = Body(default=None),
    db: Session = Depends(get_db),
):
    access_token = None
    if body and body.account_id:
        acct = db.query(Account).filter(Account.id == body.account_id).first()
        if acct:
            item = db.query(PlaidItem).filter(PlaidItem.id == acct.plaid_item_id).first()
            if item:
                access_token = item.access_token
    return accounts_svc.create_link_token(db, access_token=access_token)


@app.post("/api/plaid/exchange-token")
def exchange_token(
    body: ExchangeTokenRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    item = accounts_svc.exchange_public_token(db, body.public_token)

    def _sync():
        sync_db = SessionLocal()
        try:
            ingestion_svc.sync_item(sync_db, item.id)
        finally:
            sync_db.close()

    background_tasks.add_task(_sync)
    return {"item_id": item.id, "status": item.status}


# --- Accounts ---


@app.get("/api/accounts", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return accounts_svc.list_accounts(db)


@app.patch("/api/accounts/{account_id}")
def toggle_account(account_id: str, db: Session = Depends(get_db)):
    acct = db.query(Account).filter(Account.id == account_id).first()
    if acct is None:
        raise HTTPException(status_code=404, detail="Account not found")
    acct.is_active = not acct.is_active
    db.commit()
    return {"id": acct.id, "is_active": acct.is_active}


@app.delete("/api/accounts/{account_id}", status_code=204)
def delete_account(account_id: str, db: Session = Depends(get_db)):
    acct = db.query(Account).filter(Account.id == account_id).first()
    if acct is None:
        raise HTTPException(status_code=404, detail="Account not found")
    accounts_svc.disconnect_item(db, acct.plaid_item_id)


# --- Sync ---


@app.post("/api/sync", status_code=202)
def trigger_sync(background_tasks: BackgroundTasks):
    def _run():
        sync_db = SessionLocal()
        try:
            ingestion_svc.sync_all_items(sync_db)
        finally:
            sync_db.close()

    background_tasks.add_task(_run)
    return {"status": "sync_started"}


# --- Transactions ---


@app.get("/api/transactions", response_model=list[TransactionOut])
def list_transactions(
    week_start: str | None = None, db: Session = Depends(get_db)
):
    ws = _parse_week_start(week_start)
    txns = transactions_svc.list_for_week(db, ws)
    return [_txn_to_out(t) for t in txns]


@app.patch("/api/transactions/{txn_id}", response_model=TransactionOut)
def update_transaction(
    txn_id: str, body: TransactionUpdate, db: Session = Depends(get_db)
):
    fields = body.model_dump(exclude_none=True)
    txn = transactions_svc.update_transaction(db, txn_id, **fields)
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _txn_to_out(txn)


# --- Categorization rules ---


@app.post("/api/categorization-rules", response_model=RuleOut, status_code=201)
def create_rule(body: CreateRuleRequest, db: Session = Depends(get_db)):
    rule = categorization_svc.create_rule(
        db,
        pattern=body.pattern,
        pattern_type=body.pattern_type,
        target_detailed_category=body.target_detailed_category,
        apply_historical=body.apply_historical,
    )
    return RuleOut(
        id=rule.id,
        pattern=rule.pattern,
        pattern_type=rule.pattern_type,
        target_detailed_category=rule.target_detailed_category,
        created_at=rule.created_at.isoformat() if rule.created_at else "",
        last_applied_at=(
            rule.last_applied_at.isoformat() if rule.last_applied_at else None
        ),
        match_count=rule.match_count or 0,
    )


@app.get("/api/categorization-rules", response_model=list[RuleOut])
def list_rules(db: Session = Depends(get_db)):
    rules = categorization_svc.list_rules(db)
    return [
        RuleOut(
            id=r.id,
            pattern=r.pattern,
            pattern_type=r.pattern_type,
            target_detailed_category=r.target_detailed_category,
            created_at=r.created_at.isoformat() if r.created_at else "",
            last_applied_at=(
                r.last_applied_at.isoformat() if r.last_applied_at else None
            ),
            match_count=r.match_count or 0,
        )
        for r in rules
    ]


@app.delete("/api/categorization-rules/{rule_id}", status_code=204)
def delete_rule(rule_id: str, db: Session = Depends(get_db)):
    categorization_svc.delete_rule(db, rule_id)


# --- Analytics ---


@app.get("/api/analytics/week")
def analytics_week(week_start: str | None = None, db: Session = Depends(get_db)):
    ws = _parse_week_start(week_start)
    return {
        "summary": analytics_svc.week_summary(db, ws),
        "category_breakdown": analytics_svc.category_breakdown(db, ws),
        "category_breakdown_detailed": analytics_svc.category_breakdown(
            db, ws, level="detailed"
        ),
        "daily_totals": analytics_svc.daily_totals(db, ws),
    }


# --- Categories reference ---


@app.get("/api/categories")
def get_categories():
    return PLAID_CATEGORIES


# ---------------------------------------------------------------------------
# SPA catch-all (must be last)
# ---------------------------------------------------------------------------

_index_html = os.path.join(os.path.dirname(__file__), "..", "web", "static", "index.html")


@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    if os.path.isfile(_index_html):
        return FileResponse(_index_html)
    raise HTTPException(status_code=404, detail="Not found")
