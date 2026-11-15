import os

class Settings:
    PROJECT_NAME: str = "Auspify Student Management System"
    SYSTEM_CODENAME: str = "REGISTRY_CORE_V2"
    VERSION: str = "2.4.0"
    CUSTOM_DOMAIN: str = os.getenv("CUSTOM_DOMAIN", "records.auspify-edu.internal")
    DOMAIN_VERIFIED: bool = True
    SSL_ENABLED: bool = True
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./students.db")
    FAVICON_ACTIVE: bool = True
    PRIVACY_POLICY_ACTIVE: bool = True
    TERMS_CONDITIONS_ACTIVE: bool = True

settings = Settings()
