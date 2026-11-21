const express = require('express');
const router = express.Router();
const db = require('../database/init');
const upload = require('../middleware/upload');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// ==========================================
// QUIZ ROUTES
// ==========================================

// GET /assessments/quiz/:id - Take Quiz
router.get('/quiz/:id', isAuthenticated, (req, res) => {
  const quizId = parseInt(req.params.id, 10);
  const userId = req.session.user.id;

  const quiz = db.prepare(`
    SELECT q.*, c.title as course_title, c.code as course_code, c.slug as course_slug
    FROM quizzes q
    JOIN courses c ON q.course_id = c.id
    WHERE q.id = ?
  `).get(quizId);

  if (!quiz) {
    return res.status(404).render('pages/error', {
      title: 'Quiz Not Found',
      statusCode: 404,
      message: 'The requested quiz assessment does not exist.'
    });
  }

  // Check past attempts count
  const attempts = db.prepare(`
    SELECT * FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? ORDER BY completed_at DESC
  `).all(quizId, userId);

  const attemptsCount = attempts.length;
  const canAttempt = attemptsCount < quiz.max_attempts;

  // Fetch questions (hide is_correct field for active test!)
  const rawQuestions = db.prepare(`
    SELECT id, question_text, code_snippet, points, order_index, options_json
    FROM quiz_questions
    WHERE quiz_id = ?
    ORDER BY order_index ASC
  `).all(quizId);

  const questions = rawQuestions.map(q => {
    let options = [];
    try {
      const parsed = JSON.parse(q.options_json);
      // Strip is_correct to prevent client-side inspection cheating
      options = parsed.map(opt => ({ id: opt.id, text: opt.text }));
    } catch (e) {
      options = [];
    }
    return {
      ...q,
      options
    };
  });

  res.render('assessments/quiz-view', {
    title: `${quiz.title} | Assessment`,
    quiz,
    questions,
    attempts,
    attemptsCount,
    canAttempt
  });
});

// POST /assessments/quiz/:id/submit - Submit & Grade Quiz
router.post('/quiz/:id/submit', isAuthenticated, (req, res) => {
  const quizId = parseInt(req.params.id, 10);
  const userId = req.session.user.id;
  const userAnswers = req.body.answers || {};
  const timeSpentSecs = parseInt(req.body.time_spent_secs, 10) || 0;

  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }

  // Check attempt limit
  const pastAttempts = db.prepare('SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = ? AND user_id = ?').get(quizId, userId).count;
  if (pastAttempts >= quiz.max_attempts) {
    req.session.flash = { error: 'Maximum attempts reached for this quiz.' };
    return res.redirect(`/assessments/quiz/${quizId}`);
  }

  // Grade questions
  const rawQuestions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ?').all(quizId);

  let earnedPoints = 0;
  let totalPoints = 0;
  const gradedBreakdown = {};

  for (const q of rawQuestions) {
    totalPoints += q.points;
    let options = [];
    try {
      options = JSON.parse(q.options_json);
    } catch (e) {
      options = [];
    }

    const correctOption = options.find(opt => opt.is_correct === true);
    const submittedOptionId = userAnswers[q.id] || null;

    const isCorrect = correctOption && submittedOptionId === correctOption.id;
    if (isCorrect) {
      earnedPoints += q.points;
    }

    gradedBreakdown[q.id] = {
      submittedOptionId,
      correctOptionId: correctOption ? correctOption.id : null,
      isCorrect,
      pointsEarned: isCorrect ? q.points : 0
    };
  }

  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = percentage >= quiz.passing_score ? 1 : 0;

  const insertStmt = db.prepare(`
    INSERT INTO quiz_attempts (quiz_id, user_id, score, total_points, percentage, passed, answers_json, time_spent_secs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const attemptResult = insertStmt.run(
    quizId,
    userId,
    earnedPoints,
    totalPoints,
    percentage,
    passed,
    JSON.stringify(gradedBreakdown),
    timeSpentSecs
  );

  res.redirect(`/assessments/quiz/${quizId}/result/${attemptResult.lastInsertRowid}`);
});

// GET /assessments/quiz/:id/result/:attemptId - View Detailed Results
router.get('/quiz/:id/result/:attemptId', isAuthenticated, (req, res) => {
  const quizId = parseInt(req.params.id, 10);
  const attemptId = parseInt(req.params.attemptId, 10);
  const userId = req.session.user.id;

  const quiz = db.prepare(`
    SELECT q.*, c.title as course_title, c.code as course_code, c.slug as course_slug
    FROM quizzes q
    JOIN courses c ON q.course_id = c.id
    WHERE q.id = ?
  `).get(quizId);

  const attempt = db.prepare(`
    SELECT * FROM quiz_attempts WHERE id = ? AND quiz_id = ?
  `).get(attemptId, quizId);

  if (!quiz || !attempt) {
    return res.status(404).render('pages/error', {
      title: 'Result Not Found',
      statusCode: 404,
      message: 'The requested assessment attempt could not be found.'
    });
  }

  // Authorization check: student can only view own attempt unless instructor/admin
  if (req.session.user.role === 'student' && attempt.user_id !== userId) {
    return res.status(403).render('pages/error', {
      title: 'Forbidden',
      statusCode: 403,
      message: 'You are not authorized to view this candidate result.'
    });
  }

  let breakdown = {};
  try {
    breakdown = JSON.parse(attempt.answers_json || '{}');
  } catch (e) {
    breakdown = {};
  }

  // Fetch full questions with explanations
  const questions = db.prepare(`
    SELECT id, question_text, code_snippet, explanation, points, order_index, options_json
    FROM quiz_questions
    WHERE quiz_id = ?
    ORDER BY order_index ASC
  `).all(quizId);

  for (const q of questions) {
    try {
      q.options = JSON.parse(q.options_json);
    } catch (e) {
      q.options = [];
    }
    q.userResult = breakdown[q.id] || { isCorrect: false, submittedOptionId: null };
  }

  res.render('assessments/quiz-result', {
    title: `Assessment Result: ${quiz.title}`,
    quiz,
    attempt,
    questions
  });
});

// ==========================================
// ASSIGNMENT ROUTES
// ==========================================

// GET /assessments/assignment/:id - Assignment Portal
router.get('/assignment/:id', isAuthenticated, (req, res) => {
  const assignmentId = parseInt(req.params.id, 10);
  const userId = req.session.user.id;

  const assignment = db.prepare(`
    SELECT a.*, c.title as course_title, c.code as course_code, c.slug as course_slug
    FROM assignments a
    JOIN courses c ON a.course_id = c.id
    WHERE a.id = ?
  `).get(assignmentId);

  if (!assignment) {
    return res.status(404).render('pages/error', {
      title: 'Assignment Not Found',
      statusCode: 404,
      message: 'The requested laboratory assignment could not be located.'
    });
  }

  // Check if current user has submitted
  const submission = db.prepare(`
    SELECT s.*, u.name as grader_name
    FROM assignment_submissions s
    LEFT JOIN users u ON s.graded_by = u.id
    WHERE s.assignment_id = ? AND s.user_id = ?
  `).get(assignmentId, userId);

  // If instructor or admin, get all student submissions for this assignment
  let allSubmissions = [];
  if (['instructor', 'admin'].includes(req.session.user.role)) {
    allSubmissions = db.prepare(`
      SELECT s.*, u.name as student_name, u.email as student_email
      FROM assignment_submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.assignment_id = ?
      ORDER BY s.submitted_at DESC
    `).all(assignmentId);
  }

  res.render('assessments/assignment-submit', {
    title: `${assignment.title} | Assignment`,
    assignment,
    submission,
    allSubmissions
  });
});

// POST /assessments/assignment/:id/submit - Submit Assignment
router.post('/assessments/assignment/:id/submit', isAuthenticated, upload.single('attachment'), (req, res) => {
  const assignmentId = parseInt(req.params.id, 10);
  const userId = req.session.user.id;
  const { submission_text } = req.body;

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
  if (!assignment) {
    req.session.flash = { error: 'Assignment not found.' };
    return res.redirect('/courses');
  }

  const existing = db.prepare('SELECT id, status FROM assignment_submissions WHERE assignment_id = ? AND user_id = ?').get(assignmentId, userId);

  let filePath = null;
  let fileName = null;

  if (req.file) {
    filePath = `/uploads/${req.file.filename}`;
    fileName = req.file.originalname;
  }

  if (existing) {
    db.prepare(`
      UPDATE assignment_submissions
      SET submission_text = ?, file_path = COALESCE(?, file_path), file_name = COALESCE(?, file_name),
          status = 'resubmitted', submitted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(submission_text || '', filePath, fileName, existing.id);
  } else {
    db.prepare(`
      INSERT INTO assignment_submissions (assignment_id, user_id, submission_text, file_path, file_name, status)
      VALUES (?, ?, ?, ?, ?, 'submitted')
    `).run(assignmentId, userId, submission_text || '', filePath, fileName);
  }

  req.session.flash = { success: 'Assignment submission successfully recorded and queued for grading.' };
  res.redirect(`/assessments/assignment/${assignmentId}`);
});

// GET /assessments/assignment/:id/grading/:submissionId - Instructor Grading View
router.get('/assignment/:id/grading/:submissionId', requireRole('instructor', 'admin'), (req, res) => {
  const { id, submissionId } = req.params;

  const assignment = db.prepare(`
    SELECT a.*, c.title as course_title, c.code as course_code
    FROM assignments a
    JOIN courses c ON a.course_id = c.id
    WHERE a.id = ?
  `).get(id);

  const submission = db.prepare(`
    SELECT s.*, u.name as student_name, u.email as student_email
    FROM assignment_submissions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.assignment_id = ?
  `).get(submissionId, id);

  if (!assignment || !submission) {
    return res.status(404).render('pages/error', {
      title: 'Submission Not Found',
      statusCode: 404,
      message: 'The requested assignment submission could not be located.'
    });
  }

  res.render('assessments/grading', {
    title: `Grade Submission: ${submission.student_name} | ${assignment.title}`,
    assignment,
    submission
  });
});

// POST /assessments/assignment/:id/grading/:submissionId - Submit Grade & Feedback
router.post('/assignment/:id/grading/:submissionId', requireRole('instructor', 'admin'), (req, res) => {
  const { id, submissionId } = req.params;
  const { score, feedback } = req.body;
  const graderId = req.session.user.id;

  const numericScore = parseInt(score, 10);
  if (isNaN(numericScore) || numericScore < 0) {
    req.session.flash = { error: 'Please enter a valid non-negative numerical score.' };
    return res.redirect(`/assessments/assignment/${id}/grading/${submissionId}`);
  }

  db.prepare(`
    UPDATE assignment_submissions
    SET score = ?, feedback = ?, graded_by = ?, status = 'graded', graded_at = CURRENT_TIMESTAMP
    WHERE id = ? AND assignment_id = ?
  `).run(numericScore, feedback || '', graderId, submissionId, id);

  req.session.flash = { success: 'Grade and assessment feedback recorded successfully.' };
  res.redirect(`/assessments/assignment/${id}`);
});

module.exports = router;
