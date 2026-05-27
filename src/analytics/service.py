from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.storage.models import Account, PlaidItem, Transaction

# ---------------------------------------------------------------------------
# Shared filter expression
# ---------------------------------------------------------------------------

# "Included" means: not user_excluded AND (user_included OR no auto_excluded_reason)


def _is_included_filter():
    return (
        ~Transaction.user_excluded
        & (
            Transaction.user_included
            | Transaction.auto_excluded_reason.is_(None)
        )
    )


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


def week_summary(db: Session, week_start: date) -> dict:
    """
    High-level spending summary for a given week (Mon–Sun).
    Only counts "included" transactions.
    """
    week_end = week_start + timedelta(days=6)

    included_txns: list[Transaction] = (
        db.query(Transaction)
        .filter(
            Transaction.date >= week_start,
            Transaction.date <= week_end,
            _is_included_filter(),
        )
        .all()
    )

    total_spend = sum(Decimal(str(t.spend_amount)) for t in included_txns)
    txn_count = len(included_txns)

    # Top category
    cat_totals: dict[str, Decimal] = {}
    for t in included_txns:
        cat = (
            t.user_primary_category
            or t.plaid_primary_category
            or "Uncategorized"
        )
        cat_totals[cat] = cat_totals.get(cat, Decimal("0")) + Decimal(
            str(t.spend_amount)
        )

    top_category: dict | None = None
    if cat_totals:
        top_cat_name = max(cat_totals, key=lambda k: cat_totals[k])
        top_cat_amount = float(cat_totals[top_cat_name])
        top_category = {
            "name": top_cat_name,
            "amount": top_cat_amount,
            "pct": (
                round(top_cat_amount / float(total_spend) * 100, 2)
                if total_spend
                else 0.0
            ),
        }

    # Largest transaction
    largest_txn: dict | None = None
    if included_txns:
        biggest = max(included_txns, key=lambda t: Decimal(str(t.spend_amount)))
        largest_txn = {
            "id": biggest.id,
            "description": biggest.description,
            "amount": float(biggest.spend_amount),
            "category": (
                biggest.user_detailed_category
                or biggest.plaid_detailed_category
                or biggest.user_primary_category
                or biggest.plaid_primary_category
                or "Uncategorized"
            ),
        }

    # Last synced across all items
    last_synced_row = db.query(func.max(PlaidItem.last_synced_at)).scalar()
    last_synced_at: str | None = (
        last_synced_row.isoformat() if last_synced_row else None
    )

    return {
        "week_start": week_start.isoformat(),
        "total_spend": float(total_spend),
        "transaction_count": txn_count,
        "top_category": top_category,
        "largest_transaction": largest_txn,
        "last_synced_at": last_synced_at,
    }


def category_breakdown(
    db: Session, week_start: date, level: str = "primary"
) -> list[dict]:
    """
    Spending by category for a week.
    level='primary' groups by primary category; level='detailed' by detailed.
    """
    week_end = week_start + timedelta(days=6)

    txns: list[Transaction] = (
        db.query(Transaction)
        .filter(
            Transaction.date >= week_start,
            Transaction.date <= week_end,
            _is_included_filter(),
        )
        .all()
    )

    totals: dict[str, dict] = {}
    grand_total = Decimal("0")

    for t in txns:
        if level == "detailed":
            cat = (
                t.user_detailed_category
                or t.plaid_detailed_category
                or "Uncategorized"
            )
        else:
            cat = (
                t.user_primary_category
                or t.plaid_primary_category
                or "Uncategorized"
            )

        spend = Decimal(str(t.spend_amount))
        if cat not in totals:
            totals[cat] = {"amount": Decimal("0"), "transaction_count": 0}
        totals[cat]["amount"] += spend
        totals[cat]["transaction_count"] += 1
        grand_total += spend

    result = []
    for cat, data in totals.items():
        amt = float(data["amount"])
        result.append(
            {
                "category": cat,
                "amount": amt,
                "pct": (
                    round(amt / float(grand_total) * 100, 2) if grand_total else 0.0
                ),
                "transaction_count": data["transaction_count"],
            }
        )

    result.sort(key=lambda x: x["amount"], reverse=True)
    return result


def daily_totals(db: Session, week_start: date) -> list[dict]:
    """
    Spending per day for the Mon–Sun week starting at week_start.
    Returns an entry for each of the 7 days even if there are no transactions.
    """
    week_end = week_start + timedelta(days=6)

    txns: list[Transaction] = (
        db.query(Transaction)
        .filter(
            Transaction.date >= week_start,
            Transaction.date <= week_end,
            _is_included_filter(),
        )
        .all()
    )

    day_map: dict[date, dict] = {}
    for t in txns:
        d = t.date
        if d not in day_map:
            day_map[d] = {"amount": Decimal("0"), "transaction_count": 0}
        day_map[d]["amount"] += Decimal(str(t.spend_amount))
        day_map[d]["transaction_count"] += 1

    result = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        data = day_map.get(day, {"amount": Decimal("0"), "transaction_count": 0})
        result.append(
            {
                "date": day.isoformat(),
                "amount": float(data["amount"]),
                "transaction_count": data["transaction_count"],
            }
        )

    return result
