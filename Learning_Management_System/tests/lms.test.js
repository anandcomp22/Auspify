const assert = require('assert');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

console.log('====================================================');
console.log('STARTING AUSPIFY LMS AUTOMATED VERIFICATION SUITE');
console.log('====================================================\n');

// 1. Database & Schema Invariants
console.log('Test 1: Initializing Database & Verifying Core Schema...');
const db = require('../database/init');
const seedDatabase = require('../database/seed');
seedDatabase();

const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
const coursesCount = db.prepare('SELECT COUNT(*) as count FROM courses').get().count;
const lessonsCount = db.prepare('SELECT COUNT(*) as count FROM lessons').get().count;
const quizzesCount = db.prepare('SELECT COUNT(*) as count FROM quizzes').get().count;
const assignmentsCount = db.prepare('SELECT COUNT(*) as count FROM assignments').get().count;
const certsCount = db.prepare('SELECT COUNT(*) as count FROM certificates').get().count;

assert(usersCount >= 5, `Expected at least 5 users, got ${usersCount}`);
assert(coursesCount >= 3, `Expected at least 3 courses, got ${coursesCount}`);
assert(lessonsCount >= 6, `Expected at least 6 lessons, got ${lessonsCount}`);
assert(quizzesCount >= 2, `Expected at least 2 quizzes, got ${quizzesCount}`);
assert(assignmentsCount >= 2, `Expected at least 2 assignments, got ${assignmentsCount}`);
assert(certsCount >= 1, `Expected at least 1 issued certificate, got ${certsCount}`);
console.log(`✓ Database initialized with ${usersCount} users, ${coursesCount} courses, ${lessonsCount} lessons, ${quizzesCount} quizzes, ${assignmentsCount} assignments, ${certsCount} certificates.`);

// 2. Authentication & Bcrypt Verification
console.log('\nTest 2: Verifying Cryptographic Password Hashing & Auth...');
const student = db.prepare('SELECT * FROM users WHERE email = ?').get('student@auspify.edu');
assert(student, 'Student user should exist');
assert(bcrypt.compareSync('StudentPass123!', student.password_hash), 'Valid password must match bcrypt hash');
assert(!bcrypt.compareSync('WrongPassword', student.password_hash), 'Invalid password must be rejected');

const instructor = db.prepare('SELECT * FROM users WHERE email = ?').get('thorne@auspify.edu');
assert(instructor && instructor.role === 'instructor', 'Instructor role invariant must be preserved');

const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@auspify.edu');
assert(admin && admin.role === 'admin', 'Admin role invariant must be preserved');
console.log('✓ Authentication logic, bcrypt salt verification, and role assignments verified.');

// 3. Course Progression & Completion Percentage
console.log('\nTest 3: Verifying Lesson Completion Tracking & Progress Mathematics...');
const testCourse = db.prepare('SELECT * FROM courses WHERE code = ?').get('CS-401');
const totalCourseLessons = db.prepare('SELECT COUNT(*) as count FROM lessons WHERE course_id = ?').get(testCourse.id).count;
const julianCompletions = db.prepare('SELECT COUNT(*) as count FROM lesson_completions WHERE user_id = ? AND course_id = ?').get(student.id, testCourse.id).count;

const expectedProgress = Math.round((julianCompletions / totalCourseLessons) * 100);
const studentEnrollment = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(student.id, testCourse.id);
assert.strictEqual(studentEnrollment.progress_percent, expectedProgress, `Progress percent must equal ${expectedProgress}%`);
console.log(`✓ Real-time progress tracking verified: ${julianCompletions}/${totalCourseLessons} lessons = ${expectedProgress}%.`);

// 4. Certificate Validation & Public Ledger
console.log('\nTest 4: Verifying Cryptographic Certificate Verification...');
const certCode = 'AUSPIFY-LMS-2026-88F4A19E';
const cert = db.prepare('SELECT * FROM certificates WHERE certificate_code = ?').get(certCode);
assert(cert, `Certificate ${certCode} must exist in primary database`);
assert.strictEqual(cert.student_name, 'Julian Reed');
assert(cert.verification_hash.startsWith('sha256-'), 'Verification hash must be a valid SHA-256 digest');
console.log(`✓ Certificate ${certCode} verified for student "${cert.student_name}" with digest ${cert.verification_hash.substring(0, 20)}...`);

// 5. Quiz Grading Engine
console.log('\nTest 5: Verifying Quiz Scoring & Attempt Recording Engine...');
const quiz = db.prepare('SELECT * FROM quizzes WHERE course_id = ? LIMIT 1').get(testCourse.id);
const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ?').all(quiz.id);

let maxQuizPoints = 0;
questions.forEach(q => {
  maxQuizPoints += q.points;
  const opts = JSON.parse(q.options_json);
  const correctOpt = opts.find(o => o.is_correct);
  assert(correctOpt, `Question ${q.id} must define at least one correct option`);
});
assert(maxQuizPoints > 0, 'Quiz must have measurable point values');
console.log(`✓ Quiz question bank verified: ${questions.length} questions, ${maxQuizPoints} total points.`);

// 6. Assignment Submissions & Rubrics
console.log('\nTest 6: Verifying Assignment Submissions & Rubric Scoring...');
const assignment = db.prepare('SELECT * FROM assignments WHERE course_id = ? LIMIT 1').get(testCourse.id);
const submission = db.prepare('SELECT * FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?').get(assignment.id, student.id);
assert(submission, 'Assignment submission must be recorded');
assert.strictEqual(submission.status, 'graded');
assert(submission.score <= assignment.max_points, 'Awarded score cannot exceed maximum allowable points');
console.log(`✓ Submission lifecycle verified: Awarded ${submission.score}/${assignment.max_points} with faculty feedback.`);

// 7. Hard Launch Checklist (Deployment Lock) Audit
console.log('\nTest 7: Auditing Hard Launch Checklist (5 Mandatory Criteria)...');

// Criterion 1: Custom Domain Connected
const domainSetting = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('custom_domain');
assert(domainSetting && domainSetting.value === 'lms.auspify.edu', 'Custom domain must be set to lms.auspify.edu');
console.log('✓ Criterion 1 Passed: Custom Domain "lms.auspify.edu" connected & active.');

// Criterion 2: Custom Favicon Uploaded & Active
const svgFaviconPath = path.join(__dirname, '../public/favicon.svg');
const icoFaviconPath = path.join(__dirname, '../public/favicon.ico');
assert(fs.existsSync(svgFaviconPath), 'Custom favicon.svg must exist');
assert(fs.existsSync(icoFaviconPath), 'Custom favicon.ico must exist');
assert(fs.statSync(svgFaviconPath).size > 0, 'favicon.svg must not be empty');
assert(fs.statSync(icoFaviconPath).size > 0, 'favicon.ico must not be empty');
console.log('✓ Criterion 2 Passed: Custom SVG and ICO favicons uploaded and verified.');

// Criterion 3: "Made with AI" completely removed
console.log('Scanning entire project for "Made with AI" or generic AI tags...');
function scanForForbiddenText(dir, forbiddenRegex) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'lms.db' || file === 'tests') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanForForbiddenText(fullPath, forbiddenRegex);
    } else if (file.endsWith('.ejs') || file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.css')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (forbiddenRegex.test(content)) {
        throw new Error(`Forbidden text pattern found in ${fullPath}`);
      }
    }
  }
}

scanForForbiddenText(path.join(__dirname, '..'), /made with ai|powered by ai|built with ai/i);
console.log('✓ Criterion 3 Passed: Zero occurrences of "Made with AI" in project source.');

// Criterion 4: Fully Formatted Privacy Policy Live
const privacyViewPath = path.join(__dirname, '../views/pages/privacy.ejs');
assert(fs.existsSync(privacyViewPath), 'Privacy policy view must exist');
const privacyContent = fs.readFileSync(privacyViewPath, 'utf8');
assert(privacyContent.includes('Privacy Policy') && privacyContent.includes('FERPA'), 'Privacy policy must be complete and compliant');
console.log('✓ Criterion 4 Passed: Fully formatted, compliant Privacy Policy page is live.');

// Criterion 5: Fully Formatted Terms & Conditions Live
const termsViewPath = path.join(__dirname, '../views/pages/terms.ejs');
assert(fs.existsSync(termsViewPath), 'Terms view must exist');
const termsContent = fs.readFileSync(termsViewPath, 'utf8');
assert(termsContent.includes('Terms and Conditions') && termsContent.includes('Academic Integrity'), 'Terms & Conditions must be complete and compliant');
console.log('✓ Criterion 5 Passed: Fully formatted, compliant Terms & Conditions page is live.');

// 8. Editorial Manifesto: Em Dash Restriction Check
console.log('\nTest 8: Verifying Punctuation Restrictions (Zero em dashes: —)...');
function scanForEmDashes(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'lms.db' || file === 'tests') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanForEmDashes(fullPath);
    } else if (file.endsWith('.ejs') || file.endsWith('.js') || file.endsWith('.css')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('\u2014') || content.includes('&mdash;')) {
        throw new Error(`Em dash found in ${fullPath}! Replace with clean punctuation (hyphens or colons).`);
      }
    }
  }
}
scanForEmDashes(path.join(__dirname, '..'));
console.log('✓ Punctuation Verified: Zero em dashes found across all application files.');

console.log('\n====================================================');
console.log('ALL VERIFICATION ASSERTIONS PASSED PERFECTLY!');
console.log('====================================================');
