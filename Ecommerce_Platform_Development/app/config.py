import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings:
    PROJECT_NAME: str = "Auspify Atelier // Engineered Goods"
    VERSION: str = "2.4.0"
    CUSTOM_DOMAIN: str = os.getenv("CUSTOM_DOMAIN", "commerce.auspify.internal")
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'ecommerce.db'}")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "atelier-secure-entropy-key-9041-x89")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    TOKEN_EXPIRE_HOURS: int = 72
    
    # Currency and Shipping parameters
    DEFAULT_CURRENCY: str = "USD"
    CURRENCY_SYMBOL: str = "$"
    STANDARD_SHIPPING_FLAT: float = 15.00
    EXPRESS_SHIPPING_FLAT: float = 35.00
    FREE_SHIPPING_THRESHOLD: float = 250.00
    TAX_RATE: float = 0.0825  # 8.25% standard commercial rate

settings = Settings()
