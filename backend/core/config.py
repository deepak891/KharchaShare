"""
Centralised application settings.

All configuration is read here — nowhere else should call os.getenv directly.
Tests override settings via environment variables + get_settings.cache_clear().
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"

    # Database URL — driver prefix determines which DB is used:
    #   SQLite  (local dev):  sqlite+aiosqlite:///./kharchashare.db
    #   PostgreSQL (prod):    postgresql+asyncpg://user:pass@host/dbname
    database_url: str = "sqlite+aiosqlite:///./kharchashare.db"

    model_config = {"env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
