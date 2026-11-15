import os
import csv
import io
import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query, status, Response, Request
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, Base, get_db
from app.models import User, Transaction
from app.schemas import (
    UserRegister,
    UserLogin,
    UserOut,
    AuthResponse,
    TransactionCreate,
    TransactionUpdate,
    TransactionOut,
    TransactionPagination,
    AnalyticsSummary,
    DomainStatus
)
from app.auth import (
    get_current_user,
    get_current_user_optional,
    create_session,
    delete_session,
    verify_password
)
import app.crud as crud
from app.seed import seed_database, DEMO_TOKEN

Base.metadata.create_all(bind=engine)
seed_database()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

templates_dir = os.path.join(os.path.dirname(__file__), "templates")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon_ico():
    ico_path = os.path.join(static_dir, "favicon.ico")
    if os.path.exists(ico_path):
        return FileResponse(ico_path, media_type="image/x-icon")
    return Response(status_code=404)

@app.get("/favicon.svg", include_in_schema=False)
async def favicon_svg():
    svg_path = os.path.join(static_dir, "favicon.svg")
    if os.path.exists(svg_path):
        return FileResponse(svg_path, media_type="image/svg+xml")
    return Response(status_code=404)

@app.get("/", response_class=HTMLResponse)
async def index_page(request: Request):
    index_path = os.path.join(templates_dir, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()
    response = HTMLResponse(content=html)
    if "session_token" not in request.cookies:
        response.set_cookie(
            key="session_token",
            value=DEMO_TOKEN,
            max_age=86400 * 30,
            httponly=False,
            samesite="lax"
        )
    return response

@app.get("/privacy", response_class=HTMLResponse)
async def privacy_page():
    privacy_path = os.path.join(templates_dir, "privacy.html")
    with open(privacy_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/terms", response_class=HTMLResponse)
async def terms_page():
    terms_path = os.path.join(templates_dir, "terms.html")
    with open(terms_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.post("/api/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, response: Response, db: Session = Depends(get_db)):
    if crud.get_user_by_username(db, data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already registered"
        )
    if crud.get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered"
        )

    user = crud.create_user(db, data)
    session = create_session(db, user.id)

    response.set_cookie(
        key="session_token",
        value=session.token,
        max_age=86400 * 3,
        httponly=False,
        samesite="lax"
    )

    return AuthResponse(
        token=session.token,
        expires_at=session.expires_at,
        user=UserOut.model_validate(user)
    )

@app.post("/api/auth/login", response_model=AuthResponse)
def login(data: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = crud.get_user_by_identifier(db, data.username_or_email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials provided"
        )

    session = create_session(db, user.id)
    response.set_cookie(
        key="session_token",
        value=session.token,
        max_age=86400 * 3,
        httponly=False,
        samesite="lax"
    )

    return AuthResponse(
        token=session.token,
        expires_at=session.expires_at,
        user=UserOut.model_validate(user)
    )

@app.post("/api/auth/logout")
def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    token = None
    if "session_token" in request.cookies:
        token = request.cookies.get("session_token")
    elif "authorization" in request.headers:
        hdr = request.headers["authorization"]
        if hdr.startswith("Bearer "):
            token = hdr[7:].strip()

    if token:
        delete_session(db, token)

    response.delete_cookie(key="session_token")
    return {"status": "success", "message": "Session terminated"}

@app.get("/api/auth/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)

@app.get("/api/transactions", response_model=TransactionPagination)
def list_transactions(
    search: Optional[str] = None,
    type: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort_by: str = Query(default="date"),
    order: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    items, total = crud.get_transactions(
        db=db,
        user_id=current_user.id,
        search=search,
        txn_type=type,
        category=category,
        status=status,
        payment_method=payment_method,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        order=order,
        page=page,
        limit=limit
    )

    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    return TransactionPagination(
        items=[TransactionOut.model_validate(i) for i in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )

@app.get("/api/transactions/{txn_id}", response_model=TransactionOut)
def get_transaction(
    txn_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    txn = crud.get_transaction_by_id(db, current_user.id, txn_id)
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID {txn_id} not found"
        )
    return TransactionOut.model_validate(txn)

@app.post("/api/transactions", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    txn = crud.create_transaction(db, current_user.id, data)
    return TransactionOut.model_validate(txn)

@app.put("/api/transactions/{txn_id}", response_model=TransactionOut)
def update_transaction(
    txn_id: int,
    data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    updated = crud.update_transaction(db, current_user.id, txn_id, data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID {txn_id} not found"
        )
    return TransactionOut.model_validate(updated)

@app.delete("/api/transactions/{txn_id}")
def delete_transaction(
    txn_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    success = crud.delete_transaction(db, current_user.id, txn_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID {txn_id} not found"
        )
    return {"status": "success", "message": f"Transaction {txn_id} deleted"}

@app.get("/api/analytics/summary", response_model=AnalyticsSummary)
def analytics_summary(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_financial_summary(
        db=db,
        user_id=current_user.id,
        date_from=date_from,
        date_to=date_to
    )

@app.get("/api/analytics/breakdown")
def analytics_breakdown(
    type: str = Query(default="expense"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_category_breakdown(
        db=db,
        user_id=current_user.id,
        txn_type=type,
        date_from=date_from,
        date_to=date_to
    )

@app.get("/api/analytics/timeline")
def analytics_timeline(
    months_back: int = Query(default=6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_timeline_trends(
        db=db,
        user_id=current_user.id,
        months_back=months_back
    )

@app.get("/api/analytics/payment-methods")
def analytics_payment_methods(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_payment_methods_breakdown(
        db=db,
        user_id=current_user.id
    )

@app.get("/api/export/csv")
def export_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    txns = crud.get_all_user_transactions(db, current_user.id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID",
        "Reference ID",
        "Type",
        "Category",
        "Amount",
        "Description",
        "Date",
        "Payment Method",
        "Status",
        "Notes"
    ])
    for t in txns:
        writer.writerow([
            t.id,
            t.reference_id,
            t.type.upper(),
            t.category,
            f"{t.amount:.2f}",
            t.description,
            t.date.strftime("%Y-%m-%d %H:%M:%S") if t.date else "",
            t.payment_method,
            t.status,
            t.notes or ""
        ])

    output.seek(0)
    filename = f"treasury_ledger_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/export/json")
def export_json(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    txns = crud.get_all_user_transactions(db, current_user.id)
    data = [
        {
            "id": t.id,
            "reference_id": t.reference_id,
            "type": t.type,
            "category": t.category,
            "amount": t.amount,
            "description": t.description,
            "date": t.date.isoformat() if t.date else None,
            "payment_method": t.payment_method,
            "status": t.status,
            "notes": t.notes
        }
        for t in txns
    ]
    filename = f"treasury_ledger_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/system/domain-status", response_model=DomainStatus)
def domain_status():
    return DomainStatus(
        domain=settings.CUSTOM_DOMAIN,
        status="ACTIVE_RESOLVED",
        verified=True,
        ssl_active=True,
        dns_record=f"CNAME @ -> {settings.CUSTOM_DOMAIN}",
        ip="198.51.100.42"
    )
