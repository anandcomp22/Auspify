from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(..., min_length=6, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=100)
    currency: str = Field(default="USD", max_length=10)

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    currency: str
    created_at: datetime

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    token: str
    expires_at: datetime
    user: UserOut

class TransactionCreate(BaseModel):
    type: str = Field(..., pattern="^(expense|income)$")
    category: str = Field(..., min_length=2, max_length=50)
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=2, max_length=255)
    date: datetime
    payment_method: str = Field(default="Bank Transfer", max_length=50)
    status: str = Field(default="Completed", max_length=30)
    notes: Optional[str] = None

class TransactionUpdate(BaseModel):
    type: Optional[str] = Field(None, pattern="^(expense|income)$")
    category: Optional[str] = Field(None, min_length=2, max_length=50)
    amount: Optional[float] = Field(None, gt=0)
    description: Optional[str] = Field(None, min_length=2, max_length=255)
    date: Optional[datetime] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, max_length=30)
    notes: Optional[str] = None

class TransactionOut(BaseModel):
    id: int
    user_id: int
    type: str
    category: str
    amount: float
    description: str
    date: datetime
    payment_method: str
    reference_id: str
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TransactionPagination(BaseModel):
    items: List[TransactionOut]
    total: int
    page: int
    limit: int
    total_pages: int

class CategoryTotal(BaseModel):
    category: str
    amount: float
    percentage: float
    count: int

class TimelinePoint(BaseModel):
    period: str
    income: float
    expense: float
    net: float

class MethodTotal(BaseModel):
    method: str
    amount: float
    count: int

class AnalyticsSummary(BaseModel):
    total_income: float
    total_expense: float
    net_savings: float
    savings_rate: float
    transaction_count: int
    income_count: int
    expense_count: int
    avg_expense: float
    largest_expense: float
    largest_income: float

class DomainStatus(BaseModel):
    domain: str
    status: str
    verified: bool
    ssl_active: bool
    dns_record: str
    ip: str
