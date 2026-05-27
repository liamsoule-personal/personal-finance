from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from src.storage.models import Account, Transaction

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TRANSFER_CATEGORIES = {"TRANSFER_IN", "TRANSFER_OUT", "TRANSFER"}


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def compute_spend_amount(
    amount: Decimal,
    account_type: str,
    account_subtype: str,
) -> Decimal:
    """
    Normalize Plaid amount to spend_amount where positive = real spending.

    Plaid convention:
      - Credit accounts: positive = charge (spending), negative = payment/refund
      - Depository/checking: positive = debit (money leaving = spending),
        negative = deposit
    Both cases: return amount as-is — the sign already represents spending
    direction correctly for our purposes.
    """
    return Decimal(str(amount))


def classify_auto_exclude(
    txn_data: dict,
    account: Account,
) -> str | None:
    """
    Return an auto-exclusion reason string or None if the transaction
    should be counted as real spending.
    """
    description: str = txn_data.get("description", "") or ""
    plaid_primary: str = txn_data.get("plaid_primary_category", "") or ""
    spend_amount: Decimal = Decimal(str(txn_data.get("spend_amount", 0)))
    subtype: str = (account.subtype or "").lower()

    if subtype == "credit card" and plaid_primary == "TRANSFER_IN":
        return "cc_payment"

    if subtype == "checking" and "CC PAYMENT" in description.upper():
        return "cc_payment"

    if "ZELLE" in description.upper():
        return "transfer_zelle"

    if plaid_primary in ("TRANSFER_OUT", "TRANSFER_IN", "TRANSFER"):
        return "transfer_internal"

    if plaid_primary == "INCOME":
        return "income"

    if spend_amount < 0 and plaid_primary not in TRANSFER_CATEGORIES:
        return "refund"

    return None


# ---------------------------------------------------------------------------
# DB-backed operations
# ---------------------------------------------------------------------------


def list_for_week(db: Session, week_start: date) -> list[Transaction]:
    """
    Return ALL transactions (included and excluded) for the 7-day window
    starting at week_start, joined with their account.
    """
    week_end = week_start + timedelta(days=6)
    return (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .filter(Transaction.date >= week_start, Transaction.date <= week_end)
        .order_by(Transaction.date.desc(), Transaction.id)
        .all()
    )


def update_transaction(db: Session, txn_id: str, **fields) -> Transaction | None:
    """
    Update user-editable fields on a transaction.
    Allowed: user_excluded, user_included, user_detailed_category,
             user_primary_category.
    """
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if txn is None:
        return None

    allowed = {
        "user_excluded",
        "user_included",
        "user_detailed_category",
        "user_primary_category",
    }
    for key, value in fields.items():
        if key in allowed:
            setattr(txn, key, value)

    txn.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(txn)
    return txn


# ---------------------------------------------------------------------------
# CC payment pair detector
# ---------------------------------------------------------------------------


def run_cc_payment_pair_detector(db: Session) -> None:
    """
    Scan the last 14 days for matching checking-account outflows and
    credit-card TRANSFER_IN credits with the same absolute amount within
    3 days of each other.  Set paired_txn_id on both and ensure
    auto_excluded_reason = 'cc_payment'.
    """
    cutoff = date.today() - timedelta(days=14)

    # Checking-account outflows that look like CC payments
    checking_outflows = (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .filter(
            Transaction.date >= cutoff,
            Account.subtype == "checking",
            Transaction.auto_excluded_reason == "cc_payment",
        )
        .all()
    )

    # Credit-card TRANSFER_IN entries (payments received by the card)
    cc_transfers = (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .filter(
            Transaction.date >= cutoff,
            Account.subtype == "credit card",
            Transaction.auto_excluded_reason == "cc_payment",
        )
        .all()
    )

    # Build lookup: abs(spend_amount) → list of cc_transfer transactions
    from collections import defaultdict

    cc_by_amount: dict[Decimal, list[Transaction]] = defaultdict(list)
    for cc_txn in cc_transfers:
        cc_by_amount[abs(Decimal(str(cc_txn.spend_amount)))].append(cc_txn)

    for out_txn in checking_outflows:
        key = abs(Decimal(str(out_txn.spend_amount)))
        candidates = cc_by_amount.get(key, [])
        for cc_txn in candidates:
            # Must be within 3 days
            if abs((out_txn.date - cc_txn.date).days) <= 3:
                # Pair them
                if out_txn.paired_txn_id is None and cc_txn.paired_txn_id is None:
                    out_txn.paired_txn_id = cc_txn.id
                    cc_txn.paired_txn_id = out_txn.id
                    out_txn.auto_excluded_reason = "cc_payment"
                    cc_txn.auto_excluded_reason = "cc_payment"
                    out_txn.updated_at = datetime.utcnow()
                    cc_txn.updated_at = datetime.utcnow()
                    # Only pair once
                    candidates.remove(cc_txn)
                    break

    db.commit()
