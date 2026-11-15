import os

class Settings:
    PROJECT_NAME: str = "Auspify Treasury - Financial & Expense Ledger"
    VERSION: str = "1.0.0"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./expenses.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "auspify-sec-ledger-98402840-ae71-42cb")
    CUSTOM_DOMAIN: str = os.getenv("CUSTOM_DOMAIN", "treasury.auspify.internal")
    TOKEN_EXPIRE_HOURS: int = 72

settings = Settings()
