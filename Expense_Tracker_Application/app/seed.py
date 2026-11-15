from datetime import datetime, timezone, timedelta
from app.database import SessionLocal, Base, engine
from app.models import User, Transaction, SessionToken
from app.auth import hash_password
import app.crud as crud

DEMO_USERNAME = "treasury_admin"
DEMO_EMAIL = "treasury@auspify-ledger.internal"
DEMO_PASSWORD = "Password123!"
DEMO_TOKEN = "auspify_demo_session_token_7a9c8b3d2e1f4"

SAMPLE_TRANSACTIONS = [
    {
        "type": "income",
        "category": "Contracting & Engineering",
        "amount": 8500.00,
        "description": "Enterprise Platform Retainer - Milestone Q3",
        "days_ago": 72,
        "payment_method": "Wire Transfer",
        "status": "Reconciled",
        "notes": "Verified against invoice INV-9042"
    },
    {
        "type": "expense",
        "category": "Cloud Infrastructure",
        "amount": 1420.50,
        "description": "AWS Compute & Database Cluster Reserves",
        "days_ago": 70,
        "payment_method": "Corporate Card",
        "status": "Completed",
        "notes": "us-east-1 production cluster"
    },
    {
        "type": "expense",
        "category": "Software Subscriptions",
        "amount": 280.00,
        "description": "Figma Enterprise & JetBrains Org Licenses",
        "days_ago": 68,
        "payment_method": "Corporate Card",
        "status": "Completed",
        "notes": "Annual seat allocation for team"
    },
    {
        "type": "expense",
        "category": "Workspace & Facilities",
        "amount": 2400.00,
        "description": "Commercial Office Suite Lease & Shared Facilities",
        "days_ago": 65,
        "payment_method": "Bank Transfer",
        "status": "Reconciled",
        "notes": "Building 4 Suite 300"
    },
    {
        "type": "income",
        "category": "Consulting & Advisory",
        "amount": 3200.00,
        "description": "Architecture Review & Security Audit Fee",
        "days_ago": 58,
        "payment_method": "Wire Transfer",
        "status": "Reconciled",
        "notes": "Client: Vantage FinTech"
    },
    {
        "type": "expense",
        "category": "AI & Compute APIs",
        "amount": 645.20,
        "description": "Model Inference API Usage - Inference Endpoints",
        "days_ago": 52,
        "payment_method": "Corporate Card",
        "status": "Completed",
        "notes": "Batch generation pipelines"
    },
    {
        "type": "expense",
        "category": "Hardware & Equipment",
        "amount": 3199.00,
        "description": "Apple MacBook Pro M3 Max Engineering Workstation",
        "days_ago": 46,
        "payment_method": "Corporate Card",
        "status": "Completed",
        "notes": "Hardware refresh asset ID HW-8820"
    },
    {
        "type": "income",
        "category": "Contracting & Engineering",
        "amount": 9200.00,
        "description": "Core Infrastructure Build - Phase 2 Delivery",
        "days_ago": 41,
        "payment_method": "Wire Transfer",
        "status": "Reconciled",
        "notes": "Automated ledger reconciliation"
    },
    {
        "type": "expense",
        "category": "Workspace & Facilities",
        "amount": 2400.00,
        "description": "Commercial Office Suite Lease & Utilities",
        "days_ago": 35,
        "payment_method": "Bank Transfer",
        "status": "Reconciled",
        "notes": "Recurring monthly facility fee"
    },
    {
        "type": "expense",
        "category": "Cloud Infrastructure",
        "amount": 1580.40,
        "description": "Kubernetes Cluster Ingress & S3 Cold Storage",
        "days_ago": 33,
        "payment_method": "Corporate Card",
        "status": "Completed",
        "notes": "Traffic surge allocation"
    },
    {
        "type": "income",
        "category": "Product Licensing",
        "amount": 4750.00,
        "description": "API Gateway Enterprise Tier License",
        "days_ago": 26,
        "payment_method": "Wire Transfer",
        "status": "Reconciled",
        "notes": "Quarterly subscription renewal"
    },
    {
        "type": "expense",
        "category": "Legal & Compliance",
        "amount": 1250.00,
        "description": "Corporate Governance & Financial Filing Audit",
        "days_ago": 22,
        "payment_method": "Bank Transfer",
        "status": "Completed",
        "notes": "Tax advisory and documentation"
    },
    {
        "type": "expense",
        "category": "Telecommunications",
        "amount": 340.00,
        "description": "Dedicated Symmetric Fiber Gigabit Connection",
        "days_ago": 18,
        "payment_method": "Corporate Card",
        "status": "Completed",
        "notes": "Primary link ISP-1"
    },
    {
        "type": "income",
        "category": "Contracting & Engineering",
        "amount": 10500.00,
        "description": "Full-Stack System Engineering Sprint 4 Delivery",
        "days_ago": 12,
        "payment_method": "Wire Transfer",
        "status": "Reconciled",
        "notes": "Accepted pull requests & verified release"
    },
    {
        "type": "expense",
        "category": "Software Subscriptions",
        "amount": 450.00,
        "description": "GitHub Enterprise & Datadog Monitoring Seats",
        "days_ago": 8,
        "payment_method": "Corporate Card",
        "status": "Completed",
        "notes": "APM monitoring renewal"
    },
    {
        "type": "expense",
        "category": "Cloud Infrastructure",
        "amount": 1640.80,
        "description": "PostgreSQL Multi-AZ Cluster & Managed Redis",
        "days_ago": 4,
        "payment_method": "Corporate Card",
        "status": "Completed",
        "notes": "Automated monthly backup snapshots"
    },
    {
        "type": "expense",
        "category": "Operational Logistics",
        "amount": 185.30,
        "description": "Secured Document Delivery & Notarization Services",
        "days_ago": 2,
        "payment_method": "Debit Card",
        "status": "Completed",
        "notes": "Physical share certificates dispatch"
    },
    {
        "type": "income",
        "category": "Dividends & Capital",
        "amount": 1820.00,
        "description": "Treasury Bond Yield & High-Yield Reserve Interest",
        "days_ago": 1,
        "payment_method": "Bank Transfer",
        "status": "Completed",
        "notes": "Cash reserve interest distribution"
    }
]

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.username == DEMO_USERNAME).first()
        if not existing_user:
            user = User(
                username=DEMO_USERNAME,
                email=DEMO_EMAIL,
                password_hash=hash_password(DEMO_PASSWORD),
                full_name="Alexander Vance",
                currency="USD",
                created_at=datetime.now(timezone.utc) - timedelta(days=90)
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user = existing_user

        session_record = db.query(SessionToken).filter(SessionToken.token == DEMO_TOKEN).first()
        if not session_record:
            demo_session = SessionToken(
                token=DEMO_TOKEN,
                user_id=user.id,
                created_at=datetime.now(timezone.utc),
                expires_at=datetime.now(timezone.utc) + timedelta(days=365)
            )
            db.add(demo_session)
            db.commit()

        txn_count = db.query(Transaction).filter(Transaction.user_id == user.id).count()
        if txn_count == 0:
            base_time = datetime.now(timezone.utc)
            for item in SAMPLE_TRANSACTIONS:
                txn_date = base_time - timedelta(days=item["days_ago"], hours=item.get("days_ago", 0) % 12)
                ref_id = crud.generate_reference_id(item["type"])
                txn = Transaction(
                    user_id=user.id,
                    type=item["type"],
                    category=item["category"],
                    amount=item["amount"],
                    description=item["description"],
                    date=txn_date.replace(tzinfo=None),
                    payment_method=item["payment_method"],
                    reference_id=ref_id,
                    status=item["status"],
                    notes=item["notes"],
                    created_at=txn_date.replace(tzinfo=None),
                    updated_at=txn_date.replace(tzinfo=None)
                )
                db.add(txn)
            db.commit()
    finally:
        db.close()
