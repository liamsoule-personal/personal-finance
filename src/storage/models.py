from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.orm import relationship

from src.storage.database import Base


class PlaidItem(Base):
    __tablename__ = "plaid_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    plaid_item_id = Column(String, unique=True, nullable=False)
    access_token = Column(String, nullable=False)
    institution_id = Column(String)
    institution_name = Column(String)
    cursor = Column(String, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    consent_expires_at = Column(DateTime, nullable=True)
    status = Column(String, default="active")  # active | requires_relink | error
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        DateTime,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=datetime.utcnow,
    )

    accounts = relationship(
        "Account",
        back_populates="plaid_item",
        cascade="all, delete-orphan",
    )
    sync_logs = relationship(
        "SyncLog",
        back_populates="plaid_item",
        cascade="all, delete-orphan",
    )


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    plaid_item_id = Column(String(36), ForeignKey("plaid_items.id"), nullable=False)
    plaid_account_id = Column(String, unique=True, nullable=False)
    name = Column(String)
    official_name = Column(String, nullable=True)
    type = Column(String)  # depository | credit
    subtype = Column(String)  # checking, credit card, etc.
    mask = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        DateTime,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=datetime.utcnow,
    )

    plaid_item = relationship("PlaidItem", back_populates="accounts")
    transactions = relationship(
        "Transaction",
        back_populates="account",
        cascade="all, delete-orphan",
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    plaid_transaction_id = Column(String, unique=True, nullable=False)
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    date = Column(Date, nullable=False)
    posted_date = Column(Date, nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    spend_amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String, nullable=False)
    merchant_name = Column(String, nullable=True)
    iso_currency_code = Column(String, default="USD")
    pending = Column(Boolean, default=False)
    plaid_primary_category = Column(String, nullable=True)
    plaid_detailed_category = Column(String, nullable=True)
    user_primary_category = Column(String, nullable=True)
    user_detailed_category = Column(String, nullable=True)
    user_excluded = Column(Boolean, default=False)
    user_included = Column(Boolean, default=False)
    auto_excluded_reason = Column(
        String, nullable=True
    )  # transfer_zelle|transfer_internal|cc_payment|income|refund
    paired_txn_id = Column(
        String(36), ForeignKey("transactions.id"), nullable=True
    )
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        DateTime,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=datetime.utcnow,
    )

    account = relationship("Account", back_populates="transactions")
    paired_transaction = relationship(
        "Transaction",
        remote_side="Transaction.id",
        foreign_keys=[paired_txn_id],
    )


class CategorizationRule(Base):
    __tablename__ = "categorization_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    pattern = Column(String, nullable=False)
    pattern_type = Column(String, nullable=False)  # exact | contains | starts_with
    target_detailed_category = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    last_applied_at = Column(DateTime, nullable=True)
    match_count = Column(Integer, default=0)


class Goal(Base):
    __tablename__ = "goals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # 'weekly' | 'category'
    category = Column(String, nullable=True)  # primary category key; NULL for weekly goals
    weekly_limit = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class SyncLog(Base):
    __tablename__ = "sync_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    plaid_item_id = Column(String(36), ForeignKey("plaid_items.id"), nullable=False)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    added_count = Column(Integer, default=0)
    modified_count = Column(Integer, default=0)
    removed_count = Column(Integer, default=0)
    status = Column(String)  # success | failed
    error_message = Column(String, nullable=True)

    plaid_item = relationship("PlaidItem", back_populates="sync_logs")
