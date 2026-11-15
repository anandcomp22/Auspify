from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

EMAIL_PATTERN = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"

class StudentBase(BaseModel):
    student_id: str = Field(..., min_length=3, max_length=32)
    first_name: str = Field(..., min_length=1, max_length=64)
    last_name: str = Field(..., min_length=1, max_length=64)
    email: str = Field(..., pattern=EMAIL_PATTERN)
    phone: str = Field(..., min_length=7, max_length=32)
    department: str = Field(..., min_length=2, max_length=64)
    degree_program: str = Field(..., min_length=2, max_length=32)
    academic_year: str = Field(..., min_length=2, max_length=32)
    gpa: float = Field(..., ge=0.0, le=4.0)
    credits_completed: int = Field(0, ge=0)
    enrollment_status: str = Field("Enrolled", min_length=2, max_length=32)
    enrollment_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    advisor_name: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    student_id: Optional[str] = Field(None, min_length=3, max_length=32)
    first_name: Optional[str] = Field(None, min_length=1, max_length=64)
    last_name: Optional[str] = Field(None, min_length=1, max_length=64)
    email: Optional[str] = Field(None, pattern=EMAIL_PATTERN)
    phone: Optional[str] = Field(None, min_length=7, max_length=32)
    department: Optional[str] = Field(None, min_length=2, max_length=64)
    degree_program: Optional[str] = Field(None, min_length=2, max_length=32)
    academic_year: Optional[str] = Field(None, min_length=2, max_length=32)
    gpa: Optional[float] = Field(None, ge=0.0, le=4.0)
    credits_completed: Optional[int] = Field(None, ge=0)
    enrollment_status: Optional[str] = Field(None, min_length=2, max_length=32)
    enrollment_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    advisor_name: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None

class StudentOut(StudentBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class StudentPagination(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    items: List[StudentOut]

class DepartmentStat(BaseModel):
    department: str
    count: int
    average_gpa: float

class StatusStat(BaseModel):
    status: str
    count: int

class AnalyticsSummary(BaseModel):
    total_students: int
    active_enrollments: int
    average_system_gpa: float
    total_departments: int
    department_distribution: List[DepartmentStat]
    status_distribution: List[StatusStat]
    honor_roll_count: int
    probation_count: int

class DomainVerification(BaseModel):
    domain: str
    is_verified: bool
    dns_target: str
    cname_record: str
    ssl_active: bool
    status_code: str
    last_checked: str
