# Auspify Student Management System

A full-stack application for managing student records, built with FastAPI, SQLAlchemy, SQLite, and vanilla HTML/CSS/JavaScript.

## Setup & Running

### Requirements
- Python 3.10+
- Installed packages: `fastapi`, `uvicorn`, `sqlalchemy`

### Start the Application
Run the startup script:

```bash
python run.py
```

Or using Uvicorn directly:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open your browser to:
```
http://127.0.0.1:8000
```

## Features

- **Student Records (CRUD)**: Add, view, edit, and delete student records with form validation.
- **Search & Filters**: Search by name, ID, or email; filter by department or academic status; sort by multiple columns.
- **Student Dossier**: Side panel inspector for fast viewing of student contact details, advisor, GPA, and notes.
- **Analytics**: Aggregated department counts, standing distributions, and GPA averages computed directly from the database.
- **CSV Export**: One-click export of current student records to CSV.
- **Compliance Pages**: Formatted Privacy Policy (`/privacy`) and Terms & Conditions (`/terms`).

## Tests

Run the test suite:

```bash
python tests/test_api.py
```
