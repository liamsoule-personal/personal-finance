from __future__ import annotations

from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy.orm import Session

from src.storage.models import Goal, Transaction

# Fraction of weekly consumer spending that typically falls on each day Mon–Sun.
# Weights sum to 1.0; used so a Monday-only reading isn't extrapolated as 7× the daily rate.
_DAY_WEIGHTS = [0.10, 0.12, 0.14, 0.14, 0.20, 0.18, 0.12]

# Mirror of the frontend PRIMARY_CATEGORIES list so category matching is consistent
_PRIMARY_CATEGORIES = [
    "FOOD_AND_DRINK", "TRANSPORTATION", "SHOPS", "ENTERTAINMENT",
    "PERSONAL_CARE", "HEALTH_WELLNESS", "HOME_IMPROVEMENT", "GENERAL_MERCHANDISE",
    "TRAVEL", "RENT_UTILITIES", "LOAN_PAYMENTS", "GENERAL_SERVICES",
    "GOVERNMENT_AND_NON_PROFIT", "BANK_FEES", "TRANSFER_IN", "TRANSFER_OUT",
]


def _primary_for(txn: Transaction) -> str | None:
    if txn.user_primary_category:
        return txn.user_primary_category
    detailed = txn.user_detailed_category or txn.plaid_detailed_category
    if detailed:
        for p in _PRIMARY_CATEGORIES:
            if detailed.startswith(p + "_") or detailed == p:
                return p
    return txn.plaid_primary_category


def _is_included(txn: Transaction) -> bool:
    return (not txn.user_excluded) and (txn.user_included or txn.auto_excluded_reason is None)


def _week_transactions(db: Session, week_start: date) -> list[Transaction]:
    week_end = week_start + timedelta(days=6)
    return (
        db.query(Transaction)
        .filter(Transaction.date >= week_start, Transaction.date <= week_end)
        .all()
    )


def compute_progress(goal: Goal, week_start: date, today: date, txns: list[Transaction]) -> dict:
    included = [t for t in txns if _is_included(t)]

    if goal.type == "category":
        relevant = [t for t in included if _primary_for(t) == goal.category]
    else:
        relevant = included

    actual = sum(float(t.spend_amount) for t in relevant if float(t.spend_amount) > 0)
    limit = float(goal.weekly_limit)

    days_elapsed = max(1, min(7, (today - week_start).days + 1))

    # Day-of-week weighted projection: sum the spend-mass fractions for elapsed
    # days, then scale actual up to a full-week estimate.  Friday/Saturday carry
    # higher weights (0.20/0.18) than Monday (0.10), so mid-week readings that
    # haven't yet hit the heavy spending days project higher than a naive
    # daily-rate × 7 would.
    mass_elapsed = sum(_DAY_WEIGHTS[:days_elapsed])
    projected = actual / mass_elapsed if mass_elapsed > 0 else actual

    return {
        "actual_spend": round(actual, 2),
        "projected_spend": round(projected, 2),
        "percent_used": round((actual / limit * 100) if limit > 0 else 0, 1),
        "days_elapsed": days_elapsed,
        "status": "on_track" if projected <= limit else "off_track",
    }


def list_goals(db: Session, week_start: date) -> list[dict]:
    goals = db.query(Goal).order_by(Goal.created_at).all()
    today = date.today()
    txns = _week_transactions(db, week_start)
    result = []
    for g in goals:
        progress = compute_progress(g, week_start, today, txns)
        result.append({
            "id": g.id,
            "name": g.name,
            "type": g.type,
            "category": g.category,
            "weekly_limit": float(g.weekly_limit),
            "created_at": g.created_at.isoformat() if g.created_at else "",
            **progress,
        })
    return result


def create_goal(db: Session, name: str, type: str, category: str | None, weekly_limit: float) -> Goal:
    goal = Goal(
        id=str(uuid4()),
        name=name,
        type=type,
        category=category,
        weekly_limit=weekly_limit,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def update_goal(db: Session, goal_id: str, **fields) -> Goal | None:
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if goal is None:
        return None
    for key, val in fields.items():
        if key in ("name", "weekly_limit"):
            setattr(goal, key, val)
    db.commit()
    db.refresh(goal)
    return goal


def delete_goal(db: Session, goal_id: str) -> None:
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if goal:
        db.delete(goal)
        db.commit()
