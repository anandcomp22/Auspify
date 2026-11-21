# Auspify LMS - Engineering Learning Management System

Task 06 (Advanced) - Full-Stack Learning Management System built for the Auspify Technologies Internship Program.

A full-stack, editorial educational platform engineered for computer science curriculum delivery, interactive assessments, laboratory rubric evaluation, and cryptographic credential verification.

---

## Architecture & Technology Stack

- **Runtime & Engine**: Node.js 22 (utilizing built-in `node:sqlite` with WAL mode and indexing)
- **Framework & Routing**: Express.js
- **Session Persistence**: Custom SQLite session store (zero C++ compilation dependencies)
- **View Templating**: EJS with `express-ejs-layouts`
- **Security & Headers**: `helmet` (configured Content Security Policy), `bcryptjs` salted password hashing, `express-validator` sanitization
- **File Uploads**: `multer` for laboratory archives and source code files
- **Design System**: Strict editorial layout system inspired by *Prashant on Behance* (structural typography, asymmetrical grids, sharp rectangular framing, zero pill buttons, zero emojis, zero em dashes)

---

## Key Features & Task Workflow

### Step 1: Course and Student Module Design
- Multi-tier curriculum architecture: Courses -> Modules -> Lessons -> Assessments.
- Relational schema enforcing foreign keys, cascade triggers, and indexed queries.
- Authentic engineering syllabi: Distributed Systems Architecture (CS-401), Compiler Construction & Code Generation (CS-302), and Cryptographic Protocols & Network Security (CS-205).

### Step 2: Authentication and Authorization (RBAC)
- Role-Based Access Control supporting three distinct tiers:
  - **Student Researcher**: Browse courses, self-enroll, track progress, take timed quizzes, submit laboratory deliverables, inspect earned certificates.
  - **Faculty Instructor**: Author courses, build modules and lessons, configure quiz question banks, grade laboratory submissions with rubric feedback.
  - **Platform Administrator**: Monitor live system telemetry, moderate all courses, inspect user rosters, manage custom domain routing.

### Step 3: Course Management & Distraction-Free Learning Player
- Modular curriculum builder with dynamic module and lesson ordering.
- Distraction-free course player layout featuring sidebar navigation, lesson completion indicators, video embed support, downloadable specifications, and instant next/previous lesson controls.

### Step 4: Quizzes, Assignments, and Progress Tracking
- **Interactive Quizzes**: Timed assessments with countdown timer, randomized option evaluation, immediate score calculation, and detailed technical rationale breakdowns.
- **Laboratory Assignments**: Project briefs with max points, submission file uploads (PDF, ZIP, code archives), and faculty rubric grading terminal.
- **Granular Progress Engine**: Real-time completion calculation: `(completed_lessons / total_lessons) * 100%`.
- **Cryptographic Credential Issuance**: Upon 100% curriculum completion, the platform generates an immutable certificate with an associated SHA-256 validation digest and public ledger verification page (`/verify/:certificateCode`).

### Step 5: Hard Launch Deployment Lock Compliance
1. **Verified Custom Domain**: Active routing configured for `lms.auspify.edu` with canonical headers and live DNS telemetry portal at `/settings/domain`.
2. **Custom Favicon**: Custom geometric SVG and ICO favicons active and served from `/favicon.svg` and `/favicon.ico`.
3. **Zero AI Badges**: Completely removed all "Made with AI" watermarks, tags, or promotional badges from source code and templates.
4. **Privacy Policy Page**: Fully formatted, compliant legal privacy document live at `/privacy` covering FERPA, GDPR, and academic data invariants.
5. **Terms & Conditions Page**: Fully formatted, compliant legal terms live at `/terms` establishing Academic Honor Code, plagiarism policies, and credential revocation authority.

---

## Demo Accounts & Test Credentials

The database comes pre-seeded with realistic records:

| Role | Name | Email | Password |
|------|------|-------|----------|
| **Student** | Julian Reed | `student@auspify.edu` | `StudentPass123!` |
| **Student** | Sarah Chen | `schen@auspify.edu` | `StudentPass123!` |
| **Instructor** | Prof. Marcus Thorne | `thorne@auspify.edu` | `InstructorPass123!` |
| **Instructor** | Dr. Elena Rostova | `rostova@auspify.edu` | `InstructorPass123!` |
| **Administrator**| Dr. Helen Vance | `admin@auspify.edu` | `AdminPassword123!` |

*(The Sign In page also includes one-click quick-fill buttons for immediate evaluation).*

---

## How to Run & Verify

### 1. Prerequisites
- Node.js 18+ (tested on Node.js 22.16.0)
- npm

### 2. Verify Every Project Aspect (Automated Test Suite)
Run the comprehensive verification suite covering database integrity, bcrypt authentication, lesson progress calculation, quiz scoring, certificate hashing, forbidden badge scanning, and in-process route testing:

```bash
cd Learning_Management_System
npm test
```

### 3. Start the Server
To launch the platform locally:

```bash
cd Learning_Management_System
npm start
```

Open your browser at:
- **Application**: [http://localhost:4000](http://localhost:4000)
- **Verified Sample Certificate**: [http://localhost:4000/verify/AUSPIFY-LMS-2026-88F4A19E](http://localhost:4000/verify/AUSPIFY-LMS-2026-88F4A19E)
- **Custom Domain Telemetry**: [http://localhost:4000/settings/domain](http://localhost:4000/settings/domain)
- **Privacy Policy**: [http://localhost:4000/privacy](http://localhost:4000/privacy)
- **Terms & Conditions**: [http://localhost:4000/terms](http://localhost:4000/terms)

---

## Primary Route Map

- `GET /` - Architectural landing page with live database statistics
- `GET /courses` - Course directory with search, category pills, and difficulty filters
- `GET /courses/:slug` - Course overview, syllabus, instructor details, and enrollment
- `GET /courses/:slug/learn/:lessonSlug` - Course learning player
- `POST /courses/:slug/lessons/:lessonId/complete` - Mark lesson complete and calculate progress
- `GET /assessments/quiz/:id` - Interactive timed quiz examination
- `POST /assessments/quiz/:id/submit` - Grade quiz attempt and record score
- `GET /assessments/quiz/:id/result/:attemptId` - Detailed question-by-question breakdown
- `GET /assessments/assignment/:id` - Laboratory assignment portal and file upload
- `GET /assessments/assignment/:id/grading/:submissionId` - Faculty rubric evaluation terminal
- `GET /verify/:certificateCode` - Public cryptographic certificate validation
- `GET /dashboard` - Role-aware dispatcher (Student, Instructor, Admin)
- `GET /settings/domain` - Custom domain status and authoritative DNS records
- `GET /privacy` - Formal Privacy Policy
- `GET /terms` - Formal Terms and Conditions
