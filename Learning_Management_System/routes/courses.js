const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database/init');
const { isAuthenticated } = require('../middleware/auth');

// GET /courses - Course Catalog
router.get('/', (req, res) => {
  const { category, difficulty, q } = req.query;

  let query = `
    SELECT c.*, u.name as instructor_name, u.headline as instructor_headline,
      (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) as modules_count,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lessons_count,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrolled_count
    FROM courses c
    JOIN users u ON c.instructor_id = u.id
    WHERE c.status = 'published'
  `;
  const params = [];

  if (category) {
    query += ` AND c.category = ?`;
    params.push(category);
  }

  if (difficulty) {
    query += ` AND c.difficulty = ?`;
    params.push(difficulty);
  }

  if (q) {
    query += ` AND (c.title LIKE ? OR c.description LIKE ? OR c.code LIKE ?)`;
    const searchParam = `%${q.trim()}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  query += ` ORDER BY c.created_at DESC`;

  const courses = db.prepare(query).all(...params);

  // Available categories for filter pills
  const categories = db.prepare(`
    SELECT DISTINCT category FROM courses WHERE status = 'published' ORDER BY category ASC
  `).all().map(r => r.category);

  res.render('courses/index', {
    title: 'Curriculum & Engineering Course Directory',
    courses,
    categories,
    selectedCategory: category || '',
    selectedDifficulty: difficulty || '',
    searchQuery: q || ''
  });
});

// GET /courses/:slug - Course Overview & Syllabus
router.get('/:slug', (req, res) => {
  const course = db.prepare(`
    SELECT c.*, u.name as instructor_name, u.headline as instructor_headline, u.bio as instructor_bio
    FROM courses c
    JOIN users u ON c.instructor_id = u.id
    WHERE c.slug = ?
  `).get(req.params.slug);

  if (!course) {
    return res.status(404).render('pages/error', {
      title: 'Course Not Found',
      statusCode: 404,
      message: 'The requested course could not be located in the curriculum catalog.'
    });
  }

  // Fetch modules
  const modules = db.prepare(`
    SELECT * FROM course_modules WHERE course_id = ? ORDER BY order_index ASC
  `).all(course.id);

  // Fetch lessons for each module
  const lessonsStmt = db.prepare(`
    SELECT id, title, slug, content_type, duration_mins, order_index
    FROM lessons
    WHERE module_id = ?
    ORDER BY order_index ASC
  `);

  for (const m of modules) {
    m.lessons = lessonsStmt.all(m.id);
  }

  // Fetch quizzes and assignments
  const quizzes = db.prepare(`
    SELECT id, title, description, time_limit_mins, passing_score FROM quizzes WHERE course_id = ? AND status = 'published'
  `).all(course.id);

  const assignments = db.prepare(`
    SELECT id, title, description, max_points, due_date FROM assignments WHERE course_id = ? AND status = 'published'
  `).all(course.id);

  // Enrollment status for current user
  let enrollment = null;
  let completedLessonIds = [];
  let nextLesson = null;

  if (req.session && req.session.user) {
    enrollment = db.prepare(`
      SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?
    `).get(req.session.user.id, course.id);

    if (enrollment) {
      const completedRows = db.prepare(`
        SELECT lesson_id FROM lesson_completions WHERE user_id = ? AND course_id = ?
      `).all(req.session.user.id, course.id);
      completedLessonIds = completedRows.map(r => r.lesson_id);

      // Find first uncompleted lesson
      for (const m of modules) {
        for (const l of m.lessons) {
          if (!completedLessonIds.includes(l.id)) {
            nextLesson = l;
            break;
          }
        }
        if (nextLesson) break;
      }
    }
  }

  // Parse syllabus outline if present
  let syllabus = [];
  if (course.syllabus_json) {
    try {
      syllabus = JSON.parse(course.syllabus_json);
    } catch (e) {
      syllabus = [];
    }
  }

  res.render('courses/detail', {
    title: `${course.code}: ${course.title}`,
    course,
    modules,
    quizzes,
    assignments,
    syllabus,
    enrollment,
    completedLessonIds,
    nextLesson
  });
});

// POST /courses/:id/enroll - Student Enrollment
router.post('/:id/enroll', isAuthenticated, (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const userId = req.session.user.id;

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) {
    req.session.flash = { error: 'Course does not exist.' };
    return res.redirect('/courses');
  }

  const existing = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(userId, courseId);
  if (!existing) {
    db.prepare(`
      INSERT INTO enrollments (user_id, course_id, status, progress_percent)
      VALUES (?, ?, 'active', 0)
    `).run(userId, courseId);
  }

  // Find first lesson to redirect to player
  const firstLesson = db.prepare(`
    SELECT slug FROM lessons WHERE course_id = ? ORDER BY order_index ASC LIMIT 1
  `).get(courseId);

  if (firstLesson) {
    return res.redirect(`/courses/${course.slug}/learn/${firstLesson.slug}`);
  }

  res.redirect(`/courses/${course.slug}`);
});

// GET /courses/:slug/learn/:lessonSlug? - Course Player
router.get('/:slug/learn/:lessonSlug?', isAuthenticated, (req, res) => {
  const { slug, lessonSlug } = req.params;
  const userId = req.session.user.id;

  const course = db.prepare(`
    SELECT c.*, u.name as instructor_name FROM courses c
    JOIN users u ON c.instructor_id = u.id
    WHERE c.slug = ?
  `).get(slug);

  if (!course) {
    return res.status(404).render('pages/error', {
      title: 'Course Not Found',
      statusCode: 404,
      message: 'The requested course does not exist.'
    });
  }

  // Check enrollment
  let enrollment = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(userId, course.id);
  if (!enrollment && req.session.user.role === 'student') {
    // Auto-enroll if accessing player directly
    db.prepare("INSERT INTO enrollments (user_id, course_id, status, progress_percent) VALUES (?, ?, 'active', 0)").run(userId, course.id);
    enrollment = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(userId, course.id);
  }

  // Get modules and lessons
  const modules = db.prepare('SELECT * FROM course_modules WHERE course_id = ? ORDER BY order_index ASC').all(course.id);
  const lessonsStmt = db.prepare('SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index ASC');

  const allLessons = [];
  for (const m of modules) {
    m.lessons = lessonsStmt.all(m.id);
    allLessons.push(...m.lessons);
  }

  if (allLessons.length === 0) {
    req.session.flash = { error: 'This course has no published lessons yet.' };
    return res.redirect(`/courses/${course.slug}`);
  }

  // Identify active lesson
  let currentLesson = null;
  if (lessonSlug) {
    currentLesson = allLessons.find(l => l.slug === lessonSlug);
  }
  if (!currentLesson) {
    currentLesson = allLessons[0];
  }

  // Completed lessons
  const completedRows = db.prepare(`
    SELECT lesson_id FROM lesson_completions WHERE user_id = ? AND course_id = ?
  `).all(userId, course.id);
  const completedLessonIds = completedRows.map(r => r.lesson_id);
  const isLessonCompleted = completedLessonIds.includes(currentLesson.id);

  // Find previous and next lessons
  const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // Parse resources
  let resources = [];
  if (currentLesson.resources_json) {
    try {
      resources = JSON.parse(currentLesson.resources_json);
    } catch (e) {
      resources = [];
    }
  }

  // Get course quizzes & assignments for sidebar
  const courseQuizzes = db.prepare("SELECT id, title, time_limit_mins, module_id FROM quizzes WHERE course_id = ? AND status = 'published'").all(course.id);
  const courseAssignments = db.prepare("SELECT id, title, due_date, module_id FROM assignments WHERE course_id = ? AND status = 'published'").all(course.id);

  res.render('courses/player', {
    layout: 'layouts/player',
    title: `${currentLesson.title} | ${course.code}`,
    course,
    modules,
    allLessons,
    currentLesson,
    prevLesson,
    nextLesson,
    isLessonCompleted,
    completedLessonIds,
    enrollment,
    resources,
    courseQuizzes,
    courseAssignments
  });
});

// POST /courses/:slug/lessons/:lessonId/complete - Mark Lesson Complete
router.post('/:slug/lessons/:lessonId/complete', isAuthenticated, (req, res) => {
  const { slug, lessonId } = req.params;
  const userId = req.session.user.id;

  const course = db.prepare('SELECT id, code, title, slug FROM courses WHERE slug = ?').get(slug);
  const lesson = db.prepare('SELECT id, slug FROM lessons WHERE id = ? AND course_id = ?').get(lessonId, course.id);

  if (!course || !lesson) {
    return res.status(404).json({ error: 'Resource not found' });
  }

  // Check if already completed
  const existing = db.prepare('SELECT id FROM lesson_completions WHERE user_id = ? AND lesson_id = ?').get(userId, lesson.id);

  if (!existing) {
    db.prepare(`
      INSERT INTO lesson_completions (user_id, course_id, lesson_id)
      VALUES (?, ?, ?)
    `).run(userId, course.id, lesson.id);
  }

  // Calculate new progress percent
  const totalLessons = db.prepare('SELECT COUNT(*) as count FROM lessons WHERE course_id = ?').get(course.id).count;
  const completedCount = db.prepare('SELECT COUNT(*) as count FROM lesson_completions WHERE user_id = ? AND course_id = ?').get(userId, course.id).count;

  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 100;
  let certCode = null;

  if (progressPercent >= 100) {
    // Generate certificate if not exists
    const existingCert = db.prepare('SELECT certificate_code FROM certificates WHERE user_id = ? AND course_id = ?').get(userId, course.id);
    if (!existingCert) {
      const hashInput = `${userId}-${course.id}-${Date.now()}-AUSPIFY-VERIFIED`;
      const verificationHash = 'sha256-' + crypto.createHash('sha256').update(hashInput).digest('hex');
      const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
      certCode = `AUSPIFY-LMS-2026-${randomHex}`;

      const student = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);

      db.prepare(`
        INSERT INTO certificates (certificate_code, user_id, course_id, student_name, course_title, course_code, verification_hash, grade_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        certCode,
        userId,
        course.id,
        student.name,
        course.title,
        course.code,
        verificationHash,
        `Course completed with 100% curriculum coverage across all ${totalLessons} technical modules.`
      );

      db.prepare(`
        UPDATE enrollments 
        SET progress_percent = 100, status = 'completed', completed_at = CURRENT_TIMESTAMP, certificate_code = ?
        WHERE user_id = ? AND course_id = ?
      `).run(certCode, userId, course.id);
    } else {
      certCode = existingCert.certificate_code;
    }
  } else {
    db.prepare(`
      UPDATE enrollments 
      SET progress_percent = ?, status = 'active'
      WHERE user_id = ? AND course_id = ?
    `).run(progressPercent, userId, course.id);
  }

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({
      success: true,
      progressPercent,
      completedCount,
      totalLessons,
      certCode
    });
  }

  // Redirect to next lesson if available, else stay on current
  const allCourseLessons = db.prepare('SELECT slug, id FROM lessons WHERE course_id = ? ORDER BY order_index ASC').all(course.id);
  const currentIdx = allCourseLessons.findIndex(l => l.id == lesson.id);
  const nextLesson = currentIdx < allCourseLessons.length - 1 ? allCourseLessons[currentIdx + 1] : null;

  if (nextLesson) {
    res.redirect(`/courses/${course.slug}/learn/${nextLesson.slug}`);
  } else {
    req.session.flash = { success: progressPercent >= 100 ? 'Course completed! Your official certificate is now ready.' : 'Lesson marked complete.' };
    res.redirect(`/courses/${course.slug}/learn/${lesson.slug}`);
  }
});

module.exports = router;
