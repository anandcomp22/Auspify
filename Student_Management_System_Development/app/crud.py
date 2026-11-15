from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc
from typing import Optional, List, Tuple
from app.models import Student
from app.schemas import StudentCreate, StudentUpdate, AnalyticsSummary, DepartmentStat, StatusStat

def get_student_by_id(db: Session, id: int) -> Optional[Student]:
    return db.query(Student).filter(Student.id == id).first()

def get_student_by_student_id(db: Session, student_id: str) -> Optional[Student]:
    return db.query(Student).filter(Student.student_id == student_id.strip()).first()

def get_student_by_email(db: Session, email: str) -> Optional[Student]:
    return db.query(Student).filter(Student.email == email.strip().lower()).first()

def get_students(
    db: Session,
    search: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "id",
    order: str = "desc",
    page: int = 1,
    limit: int = 25
) -> Tuple[List[Student], int]:
    query = db.query(Student)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Student.first_name.ilike(search_term),
                Student.last_name.ilike(search_term),
                Student.student_id.ilike(search_term),
                Student.email.ilike(search_term),
                Student.department.ilike(search_term)
            )
        )

    if department and department.strip() and department != "All Departments":
        query = query.filter(Student.department == department.strip())

    if status and status.strip() and status != "All Statuses":
        query = query.filter(Student.enrollment_status == status.strip())

    total = query.count()

    sort_column = getattr(Student, sort_by, Student.id)
    if order.lower() == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))

    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()

    return items, total

def get_all_departments(db: Session) -> List[str]:
    results = db.query(Student.department).distinct().order_by(Student.department).all()
    return [r[0] for r in results if r[0]]

def create_student(db: Session, student: StudentCreate) -> Student:
    db_student = Student(
        student_id=student.student_id.strip(),
        first_name=student.first_name.strip(),
        last_name=student.last_name.strip(),
        email=student.email.strip().lower(),
        phone=student.phone.strip(),
        department=student.department.strip(),
        degree_program=student.degree_program.strip(),
        academic_year=student.academic_year.strip(),
        gpa=round(float(student.gpa), 2),
        credits_completed=int(student.credits_completed),
        enrollment_status=student.enrollment_status.strip(),
        enrollment_date=student.enrollment_date,
        advisor_name=student.advisor_name.strip() if student.advisor_name else None,
        address=student.address.strip() if student.address else None,
        emergency_contact_name=student.emergency_contact_name.strip() if student.emergency_contact_name else None,
        emergency_contact_phone=student.emergency_contact_phone.strip() if student.emergency_contact_phone else None,
        notes=student.notes.strip() if student.notes else None
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student

def update_student(db: Session, student_id: int, student_update: StudentUpdate) -> Optional[Student]:
    db_student = get_student_by_id(db, student_id)
    if not db_student:
        return None

    update_data = student_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            if isinstance(value, str):
                value = value.strip()
            if field == "email":
                value = value.lower()
            if field == "gpa":
                value = round(float(value), 2)
            setattr(db_student, field, value)

    db.commit()
    db.refresh(db_student)
    return db_student

def delete_student(db: Session, student_id: int) -> bool:
    db_student = get_student_by_id(db, student_id)
    if not db_student:
        return False
    db.delete(db_student)
    db.commit()
    return True

def get_analytics_summary(db: Session) -> AnalyticsSummary:
    total_students = db.query(Student).count()
    active_enrollments = db.query(Student).filter(Student.enrollment_status == "Enrolled").count()

    avg_gpa_query = db.query(func.avg(Student.gpa)).scalar()
    average_system_gpa = round(float(avg_gpa_query), 2) if avg_gpa_query is not None else 0.0

    dept_stats = (
        db.query(
            Student.department,
            func.count(Student.id),
            func.avg(Student.gpa)
        )
        .group_by(Student.department)
        .order_by(desc(func.count(Student.id)))
        .all()
    )
    department_distribution = [
        DepartmentStat(
            department=dept,
            count=count,
            average_gpa=round(float(avg_g), 2) if avg_g is not None else 0.0
        )
        for dept, count, avg_g in dept_stats
    ]

    status_stats = (
        db.query(Student.enrollment_status, func.count(Student.id))
        .group_by(Student.enrollment_status)
        .all()
    )
    status_distribution = [
        StatusStat(status=stat, count=cnt)
        for stat, cnt in status_stats
    ]

    honor_roll_count = db.query(Student).filter(Student.gpa >= 3.75).count()
    probation_count = db.query(Student).filter(
        or_(Student.gpa < 2.0, Student.enrollment_status == "Academic Probation")
    ).count()

    return AnalyticsSummary(
        total_students=total_students,
        active_enrollments=active_enrollments,
        average_system_gpa=average_system_gpa,
        total_departments=len(department_distribution),
        department_distribution=department_distribution,
        status_distribution=status_distribution,
        honor_roll_count=honor_roll_count,
        probation_count=probation_count
    )

def get_all_students_for_export(db: Session) -> List[Student]:
    return db.query(Student).order_by(Student.student_id).all()
