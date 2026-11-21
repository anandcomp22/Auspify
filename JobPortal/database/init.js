const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.resolve(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite database using Node 22 built-in SQLite engine
const dbPath = path.join(dbDir, 'portal.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency and enable foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize schema
const schema = `
-- users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('seeker','employer','admin')),
    company TEXT,
    title TEXT,
    bio TEXT,
    skills TEXT,
    location TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employer_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    work_type TEXT NOT NULL CHECK(work_type IN ('remote','onsite','hybrid')),
    job_type TEXT NOT NULL CHECK(job_type IN ('full-time','part-time','contract','internship')),
    salary_min INTEGER,
    salary_max INTEGER,
    currency TEXT DEFAULT 'USD',
    description TEXT NOT NULL,
    requirements TEXT,
    skills TEXT,
    experience_level TEXT CHECK(experience_level IN ('entry','mid','senior','lead','executive')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active','closed','draft')),
    applications_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employer_id) REFERENCES users(id)
);

-- applications table
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    seeker_id INTEGER NOT NULL,
    cover_letter TEXT,
    resume_filename TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','reviewing','shortlisted','interview','accepted','rejected')),
    employer_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    FOREIGN KEY (seeker_id) REFERENCES users(id),
    UNIQUE(job_id, seeker_id)
);

-- saved_jobs table
CREATE TABLE IF NOT EXISTS saved_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    job_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    UNIQUE(user_id, job_id)
);

-- sessions table for pure SQLite session store
CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expired_at INTEGER NOT NULL
);

-- indexes for rapid query performance
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_seeker_id ON applications(seeker_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired_at);
`;

db.exec(schema);

module.exports = db;
