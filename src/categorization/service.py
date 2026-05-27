from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from src.storage.models import CategorizationRule, Transaction


# ---------------------------------------------------------------------------
# Pattern matching helper
# ---------------------------------------------------------------------------


def _matches(pattern: str, pattern_type: str, field: str) -> bool:
    """Return True when field matches pattern according to pattern_type."""
    if not field:
        return False
    if pattern_type == "exact":
        return field == pattern
    if pattern_type == "contains":
        return pattern.lower() in field.lower()
    if pattern_type == "starts_with":
        return field.lower().startswith(pattern.lower())
    return False


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


def apply_rules_to(db: Session, txn: Transaction) -> str | None:
    """
    Match all rules against a transaction's merchant_name then description.
    First match wins.  Returns the matched category or None.
    Updates match_count and last_applied_at on the matched rule.
    """
    rules: list[CategorizationRule] = (
        db.query(CategorizationRule)
        .order_by(CategorizationRule.created_at.asc())
        .all()
    )

    for rule in rules:
        matched = _matches(
            rule.pattern, rule.pattern_type, txn.merchant_name or ""
        ) or _matches(rule.pattern, rule.pattern_type, txn.description or "")

        if matched:
            txn.user_detailed_category = rule.target_detailed_category
            rule.match_count = (rule.match_count or 0) + 1
            rule.last_applied_at = datetime.utcnow()
            db.flush()
            return rule.target_detailed_category

    return None


def create_rule(
    db: Session,
    pattern: str,
    pattern_type: str,
    target_detailed_category: str,
    apply_historical: bool = False,
) -> CategorizationRule:
    """
    Insert a new categorization rule.  Optionally apply it to all historical
    transactions that match the pattern.
    """
    rule = CategorizationRule(
        id=str(uuid4()),
        pattern=pattern,
        pattern_type=pattern_type,
        target_detailed_category=target_detailed_category,
    )
    db.add(rule)
    db.flush()

    if apply_historical:
        all_txns = db.query(Transaction).all()
        for txn in all_txns:
            matched = _matches(
                pattern, pattern_type, txn.merchant_name or ""
            ) or _matches(pattern, pattern_type, txn.description or "")
            if matched:
                txn.user_detailed_category = target_detailed_category
                txn.updated_at = datetime.utcnow()
                rule.match_count = (rule.match_count or 0) + 1
                rule.last_applied_at = datetime.utcnow()

    db.commit()
    db.refresh(rule)
    return rule


def list_rules(db: Session) -> list[CategorizationRule]:
    """Return all rules ordered by created_at descending."""
    return (
        db.query(CategorizationRule)
        .order_by(CategorizationRule.created_at.desc())
        .all()
    )


def delete_rule(db: Session, rule_id: str) -> None:
    """Delete a rule by id.  Does NOT retroactively un-classify transactions."""
    rule = (
        db.query(CategorizationRule)
        .filter(CategorizationRule.id == rule_id)
        .first()
    )
    if rule:
        db.delete(rule)
        db.commit()
