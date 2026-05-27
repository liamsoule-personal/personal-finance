"""Initial schema

Revision ID: 001
Revises: None
Create Date: 2024-01-01 00:00:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # plaid_items
    # ------------------------------------------------------------------
    op.create_table(
        "plaid_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("plaid_item_id", sa.String(), nullable=False, unique=True),
        sa.Column("access_token", sa.String(), nullable=False),
        sa.Column("institution_id", sa.String(), nullable=True),
        sa.Column("institution_name", sa.String(), nullable=True),
        sa.Column("cursor", sa.String(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("consent_expires_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(), nullable=True, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # ------------------------------------------------------------------
    # accounts
    # ------------------------------------------------------------------
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "plaid_item_id",
            sa.String(36),
            sa.ForeignKey("plaid_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plaid_account_id", sa.String(), nullable=False, unique=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("official_name", sa.String(), nullable=True),
        sa.Column("type", sa.String(), nullable=True),
        sa.Column("subtype", sa.String(), nullable=True),
        sa.Column("mask", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # ------------------------------------------------------------------
    # transactions
    # ------------------------------------------------------------------
    op.create_table(
        "transactions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("plaid_transaction_id", sa.String(), nullable=False, unique=True),
        sa.Column(
            "account_id",
            sa.String(36),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("posted_date", sa.Date(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("spend_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("merchant_name", sa.String(), nullable=True),
        sa.Column("iso_currency_code", sa.String(), nullable=True, server_default="USD"),
        sa.Column("pending", sa.Boolean(), nullable=True, server_default="0"),
        sa.Column("plaid_primary_category", sa.String(), nullable=True),
        sa.Column("plaid_detailed_category", sa.String(), nullable=True),
        sa.Column("user_primary_category", sa.String(), nullable=True),
        sa.Column("user_detailed_category", sa.String(), nullable=True),
        sa.Column("user_excluded", sa.Boolean(), nullable=True, server_default="0"),
        sa.Column("user_included", sa.Boolean(), nullable=True, server_default="0"),
        sa.Column("auto_excluded_reason", sa.String(), nullable=True),
        sa.Column(
            "paired_txn_id",
            sa.String(36),
            sa.ForeignKey("transactions.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # ------------------------------------------------------------------
    # categorization_rules
    # ------------------------------------------------------------------
    op.create_table(
        "categorization_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pattern", sa.String(), nullable=False),
        sa.Column("pattern_type", sa.String(), nullable=False),
        sa.Column("target_detailed_category", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("last_applied_at", sa.DateTime(), nullable=True),
        sa.Column("match_count", sa.Integer(), nullable=True, server_default="0"),
    )

    # ------------------------------------------------------------------
    # sync_log
    # ------------------------------------------------------------------
    op.create_table(
        "sync_log",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "plaid_item_id",
            sa.String(36),
            sa.ForeignKey("plaid_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("added_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("modified_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("removed_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("error_message", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("sync_log")
    op.drop_table("categorization_rules")
    op.drop_table("transactions")
    op.drop_table("accounts")
    op.drop_table("plaid_items")
