# HireScope - Professional Job Portal

A full-stack, editorial job portal platform connecting job seekers with employers. Built with Node.js, Express, EJS, and SQLite.

## Features

- **Job Listings**: Browse, search, and filter positions by location, work model, job type, seniority level, and compensation
- **Job Applications**: Submit direct applications with custom cover letters and resume file uploads (PDF, DOCX)
- **Search and Filters**: Multi-faceted database search with real-time query preservation and sorting
- **User Dashboards**: Dedicated workspaces for Candidates (Seekers), Employers, and System Administrators
- **Candidate Tracking**: Live application status lifecycle: Pending, Reviewing, Shortlisted, Interview, Accepted, Rejected
- **Admin Management**: Full user directory management, role reassignment, account deletion, and listing moderation

## Design System

Designed under strict editorial standards inspired by structural typography and layout systems:
- Warm alabaster background (`#FAFAF8`), surface white (`#FFFFFF`), near-black primary (`#121212`), and terracotta accent (`#C2502E`)
- Sharp geometric framing and rectangular buttons (zero pill shapes)
- Clean typography and semantic indicators (zero emoji icons)
- Asymmetrical grids and high-precision micro-interactions
- Zero fake metrics: all counts reflect actual live database records

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (Node built-in `node:sqlite` with WAL mode and indexing)
- **Session Store**: Custom SQLite session store
- **Templating**: EJS with `express-ejs-layouts`
- **Authentication**: `bcryptjs` + `express-session`
- **File Upload**: `multer`
- **Security**: `helmet`, input validation via `express-validator`

## Getting Started

### Prerequisites

- Node.js 18+ (tested on Node.js 22)
- npm

### Installation

```bash
cd JobPortal
npm install
```

### Running

```bash
# Start server
npm start

# Or development mode with auto-reload
npm run dev
```

The application runs on `http://localhost:3000`.

### Pre-Configured Demo Accounts

The database auto-seeds on first startup with initial accounts, vacancies, and applications:

| Role | Email | Password | Description |
|---|---|---|---|
| **Administrator** | `admin@jobportal.com` | `admin123` | Governance, user permissions, listing moderation |
| **Employer** | `elena@strataworks.io` | `employer123` | Head of Talent at Strata Works |
| **Employer** | `marcus@monolith-labs.com` | `employer123` | Design Partner at Monolith Design Labs |
| **Candidate** | `alex@example.com` | `seeker123` | Senior Distributed Systems Engineer |
| **Candidate** | `devon@example.com` | `seeker123` | Design Systems Architect |

## Project Structure

```
JobPortal/
├── server.js              # Express application entry point
├── database/
│   ├── init.js            # SQLite schema initialization
│   ├── seed.js            # Initial seed records
│   └── session-store.js   # Pure SQLite session store
├── middleware/
│   └── auth.js            # Authentication and authorization guards
├── routes/
│   ├── auth.js            # Login, register, profile
│   ├── jobs.js            # Job CRUD, search, apply, bookmark
│   ├── dashboard.js       # Seeker & employer workspaces
│   ├── admin.js           # Admin governance & moderation
│   └── pages.js           # Index, privacy policy, terms
├── views/
│   ├── layouts/main.ejs   # Base layout
│   ├── partials/          # Header, footer
│   ├── auth/              # Login, register, profile
│   ├── jobs/              # List, detail, create, edit
│   ├── dashboard/         # Seeker, employer, application detail
│   ├── admin/             # Admin governance console
│   ├── error/             # 404, 500
│   ├── privacy.ejs        # Compliant Privacy Policy
│   ├── terms.ejs          # Compliant Terms & Conditions
│   └── index.ejs          # Homepage
├── public/
│   ├── css/style.css      # Editorial CSS design system
│   ├── js/app.js          # Utilitarian micro-interactions
│   └── favicon.svg        # Terracotta & dark lettermark favicon
└── uploads/
    └── resumes/           # Uploaded resume files
```

## Hard Launch Verification

- [x] Verified custom domain configured (`hirescope.io`)
- [x] Custom geometric favicon active (`/public/favicon.svg`)
- [x] "Made with AI" footer badge/tag completely removed (0 occurrences)
- [x] Compliant Privacy Policy live at `/privacy`
- [x] Compliant Terms & Conditions live at `/terms`
