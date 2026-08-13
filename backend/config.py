"""Application configuration using Pydantic Settings."""

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./money.db"
    UPLOAD_DIR: str = "./uploads"
    GOOGLE_CREDENTIALS_PATH: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # App settings
    APP_NAME: str = "ระบบจัดการรายรับ-รายจ่าย"
    APP_VERSION: str = "1.0.0"
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# Ensure upload directory exists
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
