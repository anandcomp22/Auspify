const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// GET /dashboard - Role dispatcher
router.get('/', isAuthenticated, (req, res) => {
  const role = req.session.user.role;
  if (role === 'admin') {
    res.redirect('/dashboard/admin');
  } else if (role === 'instructor') {
    res.redirect('/dashboard/instructor');
  } else {
    res.redirect('/dashboard/student');
  }
});

// GET /dashboard/student - Student Workspace
router.get('/student', isAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  // Enrolled courses with instructor details
  const enrollments = db.prepare(`
    SELECT e.*, c.title as course_title, c.code as course_code, c.slug as course_slug,
           c.category, c.difficulty, c.estimated_hours, u.name as instructor_name,
           (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as total_lessons,
           (SELECT COUNT(*) FROM lesson_completions WHERE user_id = e.user_id AND course_id = c.id) as completed_lessons
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON c.instructor_id = u.id
    WHERE e.user_id = ?
    ORDER BY e.enrolled_at DESC
  `).all(userId);

  // For each enrolled course, find the next uncompleted lesson
  for (const en of enrollments) {
    const nextLesson = db.prepare(`
      SELECT l.slug, l.title FROM lessons l
      WHERE l.course_id = ? AND l.id NOT IN (
        SELECT lesson_id FROM lesson_completions WHERE user_id = ? AND course_id = ?
      )
      ORDER BY l.order_index ASC LIMIT 1
    `).get(en.course_id, userId, en.course_id);

    en.nextLesson = nextLesson || null;
  }

  // Pending and recent assignments
  const assignments = db.prepare(`
    SELECT a.*, c.code as course_code, c.title as course_title,
           s.status as submission_status, s.score as student_score, s.submitted_at
    FROM assignments a
    JOIN courses c ON a.course_id = c.id
    JOIN enrollments e ON e.course_id = c.id AND e.user_id = ?
    LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.user_id = ?
    WHERE a.status = 'published'
    ORDER BY a.due_date ASC
  `).all(userId, userId);

  // Quiz attempts history
  const quizAttempts = db.prepare(`
    SELECT qa.*, q.title as quiz_title, c.code as course_code, c.title as course_title
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    JOIN courses c ON q.course_id = c.id
    WHERE qa.user_id = ?
    ORDER BY qa.completed_at DESC
    LIMIT 10
  `).all(userId);

  // Issued certificates
  const certificates = db.prepare(`
    SELECT * FROM certificates WHERE user_id = ? ORDER BY issue_date DESC
  `).all(userId);

  res.render('dashboard/student', {
    title: 'Student Engineering Workspace',
    enrollments,
    assignments,
    quizAttempts,
    certificates
  });
});

// GET /dashboard/instructor - Instructor Management Center
router.get('/instructor', requireRole('instructor', 'admin'), (req, res) => {
  const instructorId = req.session.user.id;

  // Courses authored by this instructor
  const courses = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) as modules_count,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lessons_count,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrolled_students,
      (SELECT COUNT(*) FROM assignments WHERE course_id = c.id) as assignments_count,
      (SELECT COUNT(*) FROM quizzes WHERE course_id = c.id) as quizzes_count
    FROM courses c
    WHERE c.instructor_id = ?
    ORDER BY c.created_at DESC
  `).all(instructorId);

  // Submissions awaiting grading
  const pendingSubmissions = db.prepare(`
    SELECT s.*, a.title as assignment_title, a.max_points, c.code as course_code, u.name as student_name, u.email as student_email
    FROM assignment_submissions s
    JOIN assignments a ON s.assignment_id = a.id
    JOIN courses c ON a.course_id = c.id
    JOIN users u ON s.user_id = u.id
    WHERE c.instructor_id = ? AND s.status IN ('submitted', 'resubmitted')
    ORDER BY s.submitted_at ASC
  `).all(instructorId);

  // Recent student quiz attempts in instructor's courses
  const recentQuizAttempts = db.prepare(`
    SELECT qa.*, q.title as quiz_title, c.code as course_code, u.name as student_name
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    JOIN courses c ON q.course_id = c.id
    JOIN users u ON qa.user_id = u.id
    WHERE c.instructor_id = ?
    ORDER BY qa.completed_at DESC
    LIMIT 8
  `).all(instructorId);

  res.render('dashboard/instructor', {
    title: 'Faculty Curriculum Operations',
    courses,
    pendingSubmissions,
    recentQuizAttempts
  });
});

// GET /dashboard/admin - Administrative Operations Center
router.get('/admin', requireRole('admin'), (req, res) => {
  // System metrics from live DB
  const metrics = {
    totalStudents: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count,
    totalInstructors: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'instructor'").get().count,
    totalCourses: db.prepare("SELECT COUNT(*) as count FROM courses").get().count,
    totalEnrollments: db.prepare("SELECT COUNT(*) as count FROM enrollments").get().count,
    totalCompletions: db.prepare("SELECT COUNT(*) as count FROM lesson_completions").get().count,
    totalCertificates: db.prepare("SELECT COUNT(*) as count FROM certificates").get().count,
    totalSubmissions: db.prepare("SELECT COUNT(*) as count FROM assignment_submissions").get().count,
    totalQuizAttempts: db.prepare("SELECT COUNT(*) as count FROM quiz_attempts").get().count
  };

  // Recent users
  const users = db.prepare(`
    SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 15
  `).all();

  // All courses
  const courses = db.prepare(`
    SELECT c.*, u.name as instructor_name,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrolled_count
    FROM courses c
    JOIN users u ON c.instructor_id = u.id
    ORDER BY c.created_at DESC
  `).all();

  // System settings
  const settingsRows = db.prepare('SELECT * FROM system_settings').all();
  const settings = {};
  for (const s of settingsRows) {
    settings[s.key] = s.value;
  }

  res.render('dashboard/admin', {
    title: 'Platform Infrastructure Administration',
    metrics,
    users,
    courses,
    settings
  });
});

module.exports = router;
