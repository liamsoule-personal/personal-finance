from __future__ import annotations

from pydantic import BaseModel


class AccountOut(BaseModel):
    id: str
    plaid_account_id: str
    name: str
    official_name: str | None
    type: str
    subtype: str
    mask: str | None
    is_active: bool
    item_status: str  # from parent item
    institution_name: str | None = None


class LinkTokenRequest(BaseModel):
    account_id: str | None = None


class TransactionOut(BaseModel):
    id: str
    account_id: str
    account_name: str
    date: str
    posted_date: str | None
    amount: float
    spend_amount: float
    description: str
    merchant_name: str | None
    pending: bool
    plaid_primary_category: str | None
    plaid_detailed_category: str | None
    user_primary_category: str | None
    user_detailed_category: str | None
    effective_category: str | None  # user override or plaid
    user_excluded: bool
    user_included: bool
    auto_excluded_reason: str | None
    is_included: bool  # computed
    paired_txn_id: str | None


class TransactionUpdate(BaseModel):
    user_excluded: bool | None = None
    user_included: bool | None = None
    user_detailed_category: str | None = None


class LinkTokenResponse(BaseModel):
    link_token: str
    expiration: str


class ExchangeTokenRequest(BaseModel):
    public_token: str


class CreateRuleRequest(BaseModel):
    pattern: str
    pattern_type: str  # exact | contains | starts_with
    target_detailed_category: str
    apply_historical: bool = False


class RuleOut(BaseModel):
    id: str
    pattern: str
    pattern_type: str
    target_detailed_category: str
    created_at: str
    last_applied_at: str | None
    match_count: int


class CredentialsRequest(BaseModel):
    client_id: str
    secret: str
    plaid_env: str = "development"
