const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.resolve(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite database using Node 22 built-in SQLite engine
const dbPath = path.join(dbDir, 'lms.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency, enable foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Define complete LMS schema
const schema = `
-- users table: Student, Instructor, Administrator
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student','instructor','admin')),
    headline TEXT,
    bio TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- courses table
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK(difficulty IN ('Introductory','Intermediate','Advanced')),
    estimated_hours INTEGER DEFAULT 20,
    instructor_id INTEGER NOT NULL,
    status TEXT DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
    syllabus_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instructor_id) REFERENCES users(id)
);

-- course modules / units
CREATE TABLE IF NOT EXISTS course_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- lessons table: modular lesson contents
CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    module_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content_type TEXT DEFAULT 'article' CHECK(content_type IN ('article','video','lab')),
    content TEXT NOT NULL,
    video_url TEXT,
    duration_mins INTEGER DEFAULT 15,
    order_index INTEGER NOT NULL DEFAULT 1,
    resources_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE CASCADE
);

-- student course enrollments
CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','dropped')),
    progress_percent INTEGER DEFAULT 0,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    certificate_code TEXT UNIQUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, course_id)
);

-- granular lesson completions
CREATE TABLE IF NOT EXISTS lesson_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    UNIQUE(user_id, lesson_id)
);

-- quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    module_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    time_limit_mins INTEGER DEFAULT 20,
    passing_score INTEGER DEFAULT 70,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'published' CHECK(status IN ('draft','published')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE SET NULL
);

-- quiz questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    code_snippet TEXT,
    explanation TEXT,
    points INTEGER DEFAULT 10,
    order_index INTEGER DEFAULT 1,
    options_json TEXT NOT NULL,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total_points INTEGER NOT NULL,
    percentage INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    answers_json TEXT,
    time_spent_secs INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- assignments table
CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    module_id INTEGER,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    max_points INTEGER DEFAULT 100,
    due_date DATETIME,
    status TEXT DEFAULT 'published' CHECK(status IN ('draft','published')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE SET NULL
);

-- assignment submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    submission_text TEXT,
    file_path TEXT,
    file_name TEXT,
    status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted','graded','resubmitted')),
    score INTEGER,
    feedback TEXT,
    graded_by INTEGER,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    graded_at DATETIME,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(assignment_id, user_id)
);

-- completion certificates
CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_code TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    student_name TEXT NOT NULL,
    course_title TEXT NOT NULL,
    course_code TEXT NOT NULL,
    issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    verification_hash TEXT NOT NULL,
    grade_summary TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, course_id)
);

-- system settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- sessions table for pure SQLite session store
CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expired_at INTEGER NOT NULL
);

-- high performance indexes
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_modules_course ON course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_completions_user_course ON lesson_completions(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_course ON quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON assignment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired_at);
`;

db.exec(schema);

// Initialize default system settings if not already set
const checkSetting = db.prepare('SELECT value FROM system_settings WHERE key = ?');
const insertSetting = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');

const defaultSettings = [
  ['custom_domain', process.env.CUSTOM_DOMAIN || 'lms.auspify.edu'],
  ['custom_domain_status', 'verified'],
  ['custom_domain_ssl', 'active'],
  ['system_name', 'Auspify Institute of Technology LMS'],
  ['institution_accreditation', 'ISO/IEC 24751 Verified Educational Platform'],
  ['canonical_url', 'https://lms.auspify.edu']
];

for (const [k, v] of defaultSettings) {
  if (!checkSetting.get(k)) {
    insertSetting.run(k, v);
  }
}

module.exports = db;
