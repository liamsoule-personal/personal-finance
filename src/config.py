from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PLAID_CLIENT_ID: str = ""
    PLAID_SECRET: str = ""
    PLAID_ENV: str = "development"
    DATABASE_URL: str = "sqlite:////app/data/ledger.db"
    HOST_SYNC_INTERVAL_SECONDS: int = 3600

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
