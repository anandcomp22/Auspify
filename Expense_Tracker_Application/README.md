# Auspify Treasury - Financial & Expense Ledger

A full-stack web application designed for tracking corporate income, operational expenses, cash flow trajectories, and financial summary reporting. Built with FastAPI, SQLAlchemy, SQLite, and vanilla HTML5, CSS3, and modern JavaScript.

## Setup & Running

### Requirements
- Python 3.10+
- Installed packages: `fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `bcrypt`

Install dependencies:
```bash
pip install -r requirements.txt
```

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

### Pre-Seeded Evaluation Account
The application automatically seeds a functional demo ledger on first launch:
- **Username**: `treasury_admin`
- **Password**: `Password123!`
- **Role**: Treasury Lead / Lead Auditor

The interface automatically establishes an active authenticated session for rapid local evaluation. You can also sign out, register new accounts with dedicated user-isolated data, or switch credentials via the authentication modal.

## Core Features

- **Expense Tracking**: Add, edit, inspect, and delete expense entries with payment instrument tracking, status tagging (Completed, Pending, Reconciled), and auditor notes.
- **Income Management**: Record client retainers, product licensing fees, advisory contracts, and capital inflows with reference hashing (`INC-XXXXXX-XX`).
- **Financial Reports & Summaries**:
  - Net cash flow and retention rate (savings percentage) computed live from actual database records.
  - Six-month historical velocity timeline comparing monthly inflows against operational outflows.
  - Category disbursement breakdown with percentage distribution and count indicators.
  - Settlement breakdown across payment rails (Wire Transfer, Corporate Card, Bank Transfer, Debit Card, Cash, UPI).
- **User Authentication**:
  - Salted password hashing with the bcrypt standard.
  - High-entropy session token management with automatic expiration handling.
  - Strict tenant boundary isolation ensuring each authenticated user only accesses their own ledger.
- **Data Export**: One-click streaming export of user records in both CSV and JSON formats.
- **Hard Launch & Compliance**:
  - Verified Custom Domain routing (`treasury.auspify.internal`).
  - Active custom SVG and ICO favicons.
  - Zero "Made with AI" attribution tags or corporate placeholder copy.
  - Formatted, legally compliant Privacy Policy (`/privacy`) and Terms of Service (`/terms`).

## Automated Tests

Run the test suite:

```bash
python -m unittest tests/test_api.py
```
