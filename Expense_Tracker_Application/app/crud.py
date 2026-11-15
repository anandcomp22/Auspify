import random
import string
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc
from app.models import User, Transaction
from app.schemas import (
    UserRegister,
    TransactionCreate,
    TransactionUpdate,
    AnalyticsSummary,
    CategoryTotal,
    TimelinePoint,
    MethodTotal
)
from app.auth import hash_password

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username.strip().lower()).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.strip().lower()).first()

def get_user_by_identifier(db: Session, identifier: str) -> Optional[User]:
    clean_id = identifier.strip().lower()
    return db.query(User).filter(
        or_(User.username == clean_id, User.email == clean_id)
    ).first()

def create_user(db: Session, data: UserRegister) -> User:
    hashed = hash_password(data.password)
    user = User(
        username=data.username.strip().lower(),
        email=data.email.strip().lower(),
        password_hash=hashed,
        full_name=data.full_name.strip(),
        currency=data.currency.strip().upper() or "USD",
        created_at=datetime.now(timezone.utc)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def generate_reference_id(txn_type: str) -> str:
    prefix = "INC" if txn_type.lower() == "income" else "EXP"
    random_digits = "".join(random.choices(string.digits, k=6))
    random_alpha = "".join(random.choices(string.ascii_uppercase, k=2))
    return f"{prefix}-{random_digits}-{random_alpha}"

def create_transaction(db: Session, user_id: int, data: TransactionCreate) -> Transaction:
    ref_id = generate_reference_id(data.type)
    txn_date = data.date
    if txn_date.tzinfo is not None:
        txn_date = txn_date.astimezone(timezone.utc).replace(tzinfo=None)

    txn = Transaction(
        user_id=user_id,
        type=data.type.lower(),
        category=data.category.strip(),
        amount=round(float(data.amount), 2),
        description=data.description.strip(),
        date=txn_date,
        payment_method=data.payment_method.strip(),
        reference_id=ref_id,
        status=data.status.strip(),
        notes=data.notes.strip() if data.notes else None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn

def get_transaction_by_id(db: Session, user_id: int, txn_id: int) -> Optional[Transaction]:
    return db.query(Transaction).filter(
        Transaction.id == txn_id,
        Transaction.user_id == user_id
    ).first()

def get_transactions(
    db: Session,
    user_id: int,
    search: Optional[str] = None,
    txn_type: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort_by: str = "date",
    order: str = "desc",
    page: int = 1,
    limit: int = 20
) -> Tuple[List[Transaction], int]:
    query = db.query(Transaction).filter(Transaction.user_id == user_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Transaction.description.ilike(term),
                Transaction.category.ilike(term),
                Transaction.reference_id.ilike(term),
                Transaction.payment_method.ilike(term),
                Transaction.notes.ilike(term)
            )
        )

    if txn_type and txn_type.strip().lower() in ["expense", "income"]:
        query = query.filter(Transaction.type == txn_type.strip().lower())

    if category and category.strip() and category.strip() != "All Categories":
        query = query.filter(Transaction.category == category.strip())

    if status and status.strip() and status.strip() != "All Statuses":
        query = query.filter(Transaction.status == status.strip())

    if payment_method and payment_method.strip() and payment_method.strip() != "All Methods":
        query = query.filter(Transaction.payment_method == payment_method.strip())

    if date_from:
        d_from = date_from.astimezone(timezone.utc).replace(tzinfo=None) if date_from.tzinfo else date_from
        query = query.filter(Transaction.date >= d_from)

    if date_to:
        d_to = date_to.astimezone(timezone.utc).replace(tzinfo=None) if date_to.tzinfo else date_to
        query = query.filter(Transaction.date <= d_to)

    total = query.count()

    sort_col_map = {
        "date": Transaction.date,
        "amount": Transaction.amount,
        "category": Transaction.category,
        "type": Transaction.type,
        "description": Transaction.description,
        "id": Transaction.id
    }
    sort_column = sort_col_map.get(sort_by.lower(), Transaction.date)

    if order.lower() == "asc":
        query = query.order_by(asc(sort_column), asc(Transaction.id))
    else:
        query = query.order_by(desc(sort_column), desc(Transaction.id))

    offset = (max(1, page) - 1) * max(1, limit)
    items = query.offset(offset).limit(max(1, limit)).all()
    return items, total

def update_transaction(
    db: Session,
    user_id: int,
    txn_id: int,
    update_data: TransactionUpdate
) -> Optional[Transaction]:
    txn = get_transaction_by_id(db, user_id, txn_id)
    if not txn:
        return None

    data_dict = update_data.model_dump(exclude_unset=True)
    for field, val in data_dict.items():
        if field == "date" and val is not None:
            txn_date = val.astimezone(timezone.utc).replace(tzinfo=None) if val.tzinfo else val
            setattr(txn, "date", txn_date)
        elif field == "amount" and val is not None:
            setattr(txn, "amount", round(float(val), 2))
        elif field in ["type", "category", "description", "payment_method", "status", "notes"]:
            if val is not None and isinstance(val, str):
                setattr(txn, field, val.strip())

    txn.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(txn)
    return txn

def delete_transaction(db: Session, user_id: int, txn_id: int) -> bool:
    txn = get_transaction_by_id(db, user_id, txn_id)
    if not txn:
        return False
    db.delete(txn)
    db.commit()
    return True

def get_financial_summary(
    db: Session,
    user_id: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None
) -> AnalyticsSummary:
    query = db.query(Transaction).filter(Transaction.user_id == user_id)

    if date_from:
        d_from = date_from.astimezone(timezone.utc).replace(tzinfo=None) if date_from.tzinfo else date_from
        query = query.filter(Transaction.date >= d_from)

    if date_to:
        d_to = date_to.astimezone(timezone.utc).replace(tzinfo=None) if date_to.tzinfo else date_to
        query = query.filter(Transaction.date <= d_to)

    txns = query.all()

    total_income = 0.0
    total_expense = 0.0
    income_count = 0
    expense_count = 0
    largest_expense = 0.0
    largest_income = 0.0

    for t in txns:
        if t.type == "income":
            total_income += t.amount
            income_count += 1
            if t.amount > largest_income:
                largest_income = t.amount
        elif t.type == "expense":
            total_expense += t.amount
            expense_count += 1
            if t.amount > largest_expense:
                largest_expense = t.amount

    total_income = round(total_income, 2)
    total_expense = round(total_expense, 2)
    net_savings = round(total_income - total_expense, 2)
    savings_rate = round((net_savings / total_income * 100), 2) if total_income > 0 else 0.0
    avg_expense = round((total_expense / expense_count), 2) if expense_count > 0 else 0.0

    return AnalyticsSummary(
        total_income=total_income,
        total_expense=total_expense,
        net_savings=net_savings,
        savings_rate=savings_rate,
        transaction_count=len(txns),
        income_count=income_count,
        expense_count=expense_count,
        avg_expense=avg_expense,
        largest_expense=round(largest_expense, 2),
        largest_income=round(largest_income, 2)
    )

def get_category_breakdown(
    db: Session,
    user_id: int,
    txn_type: str = "expense",
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None
) -> List[CategoryTotal]:
    query = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total_amount"),
        func.count(Transaction.id).label("txn_count")
    ).filter(
        Transaction.user_id == user_id,
        Transaction.type == txn_type.lower()
    )

    if date_from:
        d_from = date_from.astimezone(timezone.utc).replace(tzinfo=None) if date_from.tzinfo else date_from
        query = query.filter(Transaction.date >= d_from)

    if date_to:
        d_to = date_to.astimezone(timezone.utc).replace(tzinfo=None) if date_to.tzinfo else date_to
        query = query.filter(Transaction.date <= d_to)

    rows = query.group_by(Transaction.category).order_by(desc("total_amount")).all()

    overall = sum(r.total_amount for r in rows) if rows else 0.0
    results = []
    for r in rows:
        amt = round(float(r.total_amount), 2)
        pct = round((amt / overall * 100), 1) if overall > 0 else 0.0
        results.append(
            CategoryTotal(
                category=r.category,
                amount=amt,
                percentage=pct,
                count=int(r.txn_count)
            )
        )
    return results

def get_timeline_trends(
    db: Session,
    user_id: int,
    months_back: int = 6
) -> List[TimelinePoint]:
    txns = db.query(Transaction).filter(
        Transaction.user_id == user_id
    ).order_by(asc(Transaction.date)).all()

    monthly_data: Dict[str, Dict[str, float]] = {}

    for t in txns:
        period_key = t.date.strftime("%Y-%m")
        if period_key not in monthly_data:
            monthly_data[period_key] = {"income": 0.0, "expense": 0.0}

        if t.type == "income":
            monthly_data[period_key]["income"] += t.amount
        elif t.type == "expense":
            monthly_data[period_key]["expense"] += t.amount

    sorted_keys = sorted(monthly_data.keys())
    if len(sorted_keys) > months_back:
        sorted_keys = sorted_keys[-months_back:]

    timeline = []
    for k in sorted_keys:
        inc = round(monthly_data[k]["income"], 2)
        exp = round(monthly_data[k]["expense"], 2)
        net = round(inc - exp, 2)
        timeline.append(TimelinePoint(period=k, income=inc, expense=exp, net=net))

    return timeline

def get_payment_methods_breakdown(db: Session, user_id: int) -> List[MethodTotal]:
    rows = db.query(
        Transaction.payment_method,
        func.sum(Transaction.amount).label("total_amount"),
        func.count(Transaction.id).label("txn_count")
    ).filter(
        Transaction.user_id == user_id
    ).group_by(Transaction.payment_method).order_by(desc("total_amount")).all()

    return [
        MethodTotal(
            method=r.payment_method,
            amount=round(float(r.total_amount), 2),
            count=int(r.txn_count)
        )
        for r in rows
    ]

def get_all_user_transactions(db: Session, user_id: int) -> List[Transaction]:
    return db.query(Transaction).filter(
        Transaction.user_id == user_id
    ).order_by(desc(Transaction.date), desc(Transaction.id)).all()
