from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime, timezone
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(32), unique=True, index=True, nullable=False)
    first_name = Column(String(64), nullable=False)
    last_name = Column(String(64), nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=False)
    phone = Column(String(32), nullable=False)
    department = Column(String(64), nullable=False, index=True)
    degree_program = Column(String(32), nullable=False)
    academic_year = Column(String(32), nullable=False)
    gpa = Column(Float, nullable=False, default=0.0)
    credits_completed = Column(Integer, nullable=False, default=0)
    enrollment_status = Column(String(32), nullable=False, default="Enrolled", index=True)
    enrollment_date = Column(String(10), nullable=False)
    advisor_name = Column(String(128), nullable=True)
    address = Column(String(256), nullable=True)
    emergency_contact_name = Column(String(128), nullable=True)
    emergency_contact_phone = Column(String(32), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
