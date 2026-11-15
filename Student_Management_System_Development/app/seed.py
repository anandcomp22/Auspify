from sqlalchemy.orm import Session
from app.models import Student
from app.database import SessionLocal, Base, engine

SAMPLE_STUDENTS = [
    {
        "student_id": "AUS-2022-0101",
        "first_name": "Marcus",
        "last_name": "Vance",
        "email": "m.vance@auspify.edu",
        "phone": "+1-617-555-0142",
        "department": "Computer Science",
        "degree_program": "B.S. in Computer Science",
        "academic_year": "Senior",
        "gpa": 3.88,
        "credits_completed": 112,
        "enrollment_status": "Enrolled",
        "enrollment_date": "2022-09-01",
        "advisor_name": "Dr. Sarah Chen",
        "address": "402 Beacon St, Cambridge, MA",
        "emergency_contact_name": "Eleanor Vance",
        "emergency_contact_phone": "+1-617-555-0149",
        "notes": "Dean's List 2023-2024. Capstone project in distributed systems."
    },
    {
        "student_id": "AUS-2022-0102",
        "first_name": "Sophia",
        "last_name": "Alvarez",
        "email": "s.alvarez@auspify.edu",
        "phone": "+1-617-555-0177",
        "department": "Architecture",
        "degree_program": "B.Arch",
        "academic_year": "Senior",
        "gpa": 3.92,
        "credits_completed": 128,
        "enrollment_status": "Enrolled",
        "enrollment_date": "2022-09-01",
        "advisor_name": "Prof. Arthur Pendelton",
        "address": "77 Massachusetts Ave, Cambridge, MA",
        "emergency_contact_name": "Carlos Alvarez",
        "emergency_contact_phone": "+1-617-555-0178",
        "notes": "Excellence in Structural Form & Materiality award recipient."
    },
    {
        "student_id": "AUS-2023-0205",
        "first_name": "Liam",
        "last_name": "O'Connor",
        "email": "l.oconnor@auspify.edu",
        "phone": "+1-617-555-0219",
        "department": "Mechanical Engineering",
        "degree_program": "B.S. in Mechanical Engineering",
        "academic_year": "Junior",
        "gpa": 3.45,
        "credits_completed": 76,
        "enrollment_status": "Enrolled",
        "enrollment_date": "2023-09-05",
        "advisor_name": "Dr. Kenji Sato",
        "address": "12 Kendall Square, Cambridge, MA",
        "emergency_contact_name": "Fiona O'Connor",
        "emergency_contact_phone": "+1-617-555-0220",
        "notes": "Lead chassis designer for Formula SAE Collegiate Racing."
    },
    {
        "student_id": "AUS-2023-0209",
        "first_name": "Amina",
        "last_name": "Diallo",
        "email": "a.diallo@auspify.edu",
        "phone": "+1-617-555-0284",
        "department": "Economics",
        "degree_program": "B.S. in Quantitative Economics",
        "academic_year": "Junior",
        "gpa": 3.79,
        "credits_completed": 82,
        "enrollment_status": "Enrolled",
        "enrollment_date": "2023-09-05",
        "advisor_name": "Dr. Robert Sterling",
        "address": "55 Broadway, Somerville, MA",
        "emergency_contact_name": "Ibrahima Diallo",
        "emergency_contact_phone": "+1-617-555-0285",
        "notes": "Undergraduate research fellow in econometrics and trade modeling."
    },
    {
        "student_id": "AUS-2024-0312",
        "first_name": "Julian",
        "last_name": "Kowalski",
        "email": "j.kowalski@auspify.edu",
        "phone": "+1-617-555-0341",
        "department": "Electrical Engineering",
        "degree_program": "B.S. in Electrical Engineering",
        "academic_year": "Sophomore",
        "gpa": 3.15,
        "credits_completed": 44,
        "enrollment_status": "Enrolled",
        "enrollment_date": "2024-09-03",
        "advisor_name": "Dr. Miriam Thorne",
        "address": "88 Elmwood Ave, Boston, MA",
        "emergency_contact_name": "Tadeusz Kowalski",
        "emergency_contact_phone": "+1-617-555-0342",
        "notes": "Specializing in embedded microcontrollers and signal processing."
    },
    {
        "student_id": "AUS-2024-0320",
        "first_name": "Chloe",
        "last_name": "Dupont",
        "email": "c.dupont@auspify.edu",
        "phone": "+1-617-555-0399",
        "department": "Biomedical Sciences",
        "degree_program": "B.S. in Bioengineering",
        "academic_year": "Sophomore",
        "gpa": 3.96,
        "credits_completed": 50,
        "enrollment_status": "Enrolled",
        "enrollment_date": "2024-09-03",
        "advisor_name": "Dr. Hannah Lowell",
        "address": "210 River St, Cambridge, MA",
        "emergency_contact_name": "Claire Dupont",
        "emergency_contact_phone": "+1-617-555-0400",
        "notes": "Research assistant in cellular biofabrication laboratory."
    },
    {
        "student_id": "AUS-2021-0088",
        "first_name": "Devon",
        "last_name": "Perez",
        "email": "d.perez@auspify.edu",
        "phone": "+1-617-555-0112",
        "department": "Computer Science",
        "degree_program": "B.S. in Computer Science",
        "academic_year": "Senior",
        "gpa": 2.18,
        "credits_completed": 98,
        "enrollment_status": "Academic Probation",
        "enrollment_date": "2021-09-02",
        "advisor_name": "Dr. Sarah Chen",
        "address": "15 Oxford St, Cambridge, MA",
        "emergency_contact_name": "Maria Perez",
        "emergency_contact_phone": "+1-617-555-0113",
        "notes": "Mandatory bi-weekly academic counseling with faculty advisor."
    },
    {
        "student_id": "AUS-2023-0240",
        "first_name": "Elena",
        "last_name": "Rostova",
        "email": "e.rostova@auspify.edu",
        "phone": "+1-617-555-0255",
        "department": "Architecture",
        "degree_program": "B.Arch",
        "academic_year": "Junior",
        "gpa": 3.62,
        "credits_completed": 70,
        "enrollment_status": "On Leave",
        "enrollment_date": "2023-09-05",
        "advisor_name": "Prof. Arthur Pendelton",
        "address": "334 Harvard St, Cambridge, MA",
        "emergency_contact_name": "Nikolai Rostov",
        "emergency_contact_phone": "+1-617-555-0256",
        "notes": "Approved industrial internship leave for Fall semester."
    },
    {
        "student_id": "AUS-2020-0044",
        "first_name": "Tariq",
        "last_name": "Mansoor",
        "email": "t.mansoor@auspify.edu",
        "phone": "+1-617-555-0044",
        "department": "Mechanical Engineering",
        "degree_program": "B.S. in Mechanical Engineering",
        "academic_year": "Graduate",
        "gpa": 3.84,
        "credits_completed": 134,
        "enrollment_status": "Graduated",
        "enrollment_date": "2020-09-01",
        "advisor_name": "Dr. Kenji Sato",
        "address": "90 Commonwealth Ave, Boston, MA",
        "emergency_contact_name": "Samira Mansoor",
        "emergency_contact_phone": "+1-617-555-0045",
        "notes": "Graduated Magna Cum Laude, Class of 2024. Continuing to M.S."
    },
    {
        "student_id": "AUS-2025-0401",
        "first_name": "Zoe",
        "last_name": "Lindqvist",
        "email": "z.lindqvist@auspify.edu",
        "phone": "+1-617-555-0450",
        "department": "Economics",
        "degree_program": "B.S. in Quantitative Economics",
        "academic_year": "Freshman",
        "gpa": 3.70,
        "credits_completed": 16,
        "enrollment_status": "Enrolled",
        "enrollment_date": "2025-09-02",
        "advisor_name": "Dr. Robert Sterling",
        "address": "45 Bay State Rd, Boston, MA",
        "emergency_contact_name": "Magnus Lindqvist",
        "emergency_contact_phone": "+1-617-555-0451",
        "notes": "First-year cohort representative."
    }
]

def seed_database(db: Session = None):
    close_after = False
    if db is None:
        db = SessionLocal()
        close_after = True

    try:
        Base.metadata.create_all(bind=engine)
        existing = db.query(Student).count()
        if existing == 0:
            for data in SAMPLE_STUDENTS:
                student = Student(**data)
                db.add(student)
            db.commit()
    finally:
        if close_after:
            db.close()

if __name__ == "__main__":
    seed_database()
