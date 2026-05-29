"""Application configuration — loaded once at startup from environment / .env."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://litigator:litigator@localhost:5432/litigation"

    # OpenRouter
    openrouter_api_key: str = ""
    openrouter_model: str = "anthropic/claude-sonnet-4-6"

    # Anthropic direct (used by parser for Haiku label classification)
    # If not set, parser falls back to OpenRouter with the same model via openai SDK
    anthropic_api_key: str = ""

    # Voyage AI (kept for reference, now unused — embeddings via OpenRouter)
    voyage_api_key: str = ""

    # App
    environment: str = "development"
    log_level: str = "INFO"
    allowed_origins: str = ""  # comma-separated, e.g. "https://your-app.vercel.app"

    # Query defaults
    default_k: int = 10
    min_chunks_to_answer: int = 5  # below this → refuse

    # Confidence band thresholds
    similarity_threshold_drop: float = 0.65   # top-1 below this → drop a band
    citation_rate_threshold: float = 0.80      # < 80% verified → drop a band
    jurisdiction_match_threshold: float = 0.60 # < 60% chunks match jurisdiction → drop a band


settings = Settings()
