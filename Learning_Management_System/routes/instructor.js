const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../database/init');
const { requireRole } = require('../middleware/auth');

// All instructor routes require instructor or admin role
router.use(requireRole('instructor', 'admin'));

// Helper to check course ownership
function checkCourseOwnership(courseId, userId, userRole) {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return null;
  if (userRole === 'admin' || course.instructor_id === userId) {
    return course;
  }
  return false;
}

// GET /instructor/courses/new - New Course Form
router.get('/courses/new', (req, res) => {
  res.render('instructor/course-form', {
    title: 'Create Engineering Course',
    course: null,
    errors: [],
    formData: {}
  });
});

// POST /instructor/courses/new - Create Course
router.post(
  '/courses/new',
  [
    body('code').trim().notEmpty().withMessage('Course code (e.g. CS-401) is required.'),
    body('title').trim().notEmpty().withMessage('Course title is required.'),
    body('category').trim().notEmpty().withMessage('Category is required.'),
    body('difficulty').isIn(['Introductory', 'Intermediate', 'Advanced']).withMessage('Valid difficulty required.'),
    body('description').trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters.')
  ],
  (req, res) => {
    const errors = validationResult(req);
    const formData = req.body;

    if (!errors.isEmpty()) {
      return res.status(422).render('instructor/course-form', {
        title: 'Create Engineering Course',
        course: null,
        errors: errors.array().map(e => e.msg),
        formData
      });
    }

    const slug = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const estimatedHours = parseInt(formData.estimated_hours, 10) || 20;

    try {
      const result = db.prepare(`
        INSERT INTO courses (code, slug, title, subtitle, description, category, difficulty, estimated_hours, instructor_id, status, syllabus_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        formData.code.toUpperCase(),
        slug,
        formData.title,
        formData.subtitle || '',
        formData.description,
        formData.category,
        formData.difficulty,
        estimatedHours,
        req.session.user.id,
        formData.status || 'published',
        JSON.stringify(formData.syllabus ? formData.syllabus.split('\n').filter(s => s.trim()) : [])
      );

      req.session.flash = { success: 'Course successfully created. You can now build its technical curriculum.' };
      res.redirect(`/instructor/courses/${result.lastInsertRowid}/curriculum`);
    } catch (err) {
      return res.status(400).render('instructor/course-form', {
        title: 'Create Engineering Course',
        course: null,
        errors: [`Course creation failed: ${err.message}`],
        formData
      });
    }
  }
);

// GET /instructor/courses/:id/edit - Edit Course Form
router.get('/courses/:id/edit', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);

  if (!course) {
    return res.status(404).render('pages/error', {
      title: 'Course Not Found',
      statusCode: 404,
      message: 'Course not found or you lack editorial permission.'
    });
  }

  res.render('instructor/course-form', {
    title: `Edit Course: ${course.code}`,
    course,
    errors: [],
    formData: course
  });
});

// POST /instructor/courses/:id/edit - Update Course
router.post('/courses/:id/edit', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);

  if (!course) {
    return res.status(403).send('Unauthorized');
  }

  const { code, title, subtitle, description, category, difficulty, estimated_hours, status, syllabus } = req.body;

  db.prepare(`
    UPDATE courses
    SET code = ?, title = ?, subtitle = ?, description = ?, category = ?, difficulty = ?,
        estimated_hours = ?, status = ?, syllabus_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    code.toUpperCase(),
    title,
    subtitle || '',
    description,
    category,
    difficulty,
    parseInt(estimated_hours, 10) || 20,
    status || 'published',
    JSON.stringify(syllabus ? syllabus.split('\n').filter(s => s.trim()) : []),
    courseId
  );

  req.session.flash = { success: 'Course details successfully updated.' };
  res.redirect(`/instructor/courses/${courseId}/curriculum`);
});

// GET /instructor/courses/:id/curriculum - Curriculum Builder
router.get('/courses/:id/curriculum', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);

  if (!course) {
    return res.status(404).render('pages/error', {
      title: 'Course Not Found',
      statusCode: 404,
      message: 'Course not found or access denied.'
    });
  }

  const modules = db.prepare('SELECT * FROM course_modules WHERE course_id = ? ORDER BY order_index ASC').all(courseId);
  const lessonsStmt = db.prepare('SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index ASC');

  for (const m of modules) {
    m.lessons = lessonsStmt.all(m.id);
  }

  const quizzes = db.prepare('SELECT * FROM quizzes WHERE course_id = ?').all(courseId);
  const assignments = db.prepare('SELECT * FROM assignments WHERE course_id = ?').all(courseId);

  res.render('instructor/curriculum', {
    title: `Curriculum Builder: ${course.code} - ${course.title}`,
    course,
    modules,
    quizzes,
    assignments
  });
});

// POST /instructor/courses/:id/modules/new - Add Module
router.post('/courses/:id/modules/new', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);
  if (!course) return res.status(403).send('Unauthorized');

  const { title, description } = req.body;
  const count = db.prepare('SELECT COUNT(*) as count FROM course_modules WHERE course_id = ?').get(courseId).count;

  db.prepare(`
    INSERT INTO course_modules (course_id, title, description, order_index)
    VALUES (?, ?, ?, ?)
  `).run(courseId, title, description || '', count + 1);

  req.session.flash = { success: 'Module created.' };
  res.redirect(`/instructor/courses/${courseId}/curriculum`);
});

// POST /instructor/courses/:id/modules/:moduleId/delete - Delete Module
router.post('/courses/:id/modules/:moduleId/delete', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);
  if (!course) return res.status(403).send('Unauthorized');

  db.prepare('DELETE FROM course_modules WHERE id = ? AND course_id = ?').run(req.params.moduleId, courseId);
  req.session.flash = { success: 'Module and associated lessons deleted.' };
  res.redirect(`/instructor/courses/${courseId}/curriculum`);
});

// POST /instructor/courses/:id/lessons/new - Add Lesson
router.post('/courses/:id/lessons/new', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);
  if (!course) return res.status(403).send('Unauthorized');

  const { module_id, title, content_type, duration_mins, video_url, content } = req.body;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const count = db.prepare('SELECT COUNT(*) as count FROM lessons WHERE module_id = ?').get(module_id).count;

  db.prepare(`
    INSERT INTO lessons (course_id, module_id, title, slug, content_type, content, video_url, duration_mins, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    courseId,
    module_id,
    title,
    slug,
    content_type || 'article',
    content || '# ' + title,
    video_url || null,
    parseInt(duration_mins, 10) || 15,
    count + 1
  );

  req.session.flash = { success: 'Lesson created.' };
  res.redirect(`/instructor/courses/${courseId}/curriculum`);
});

// GET /instructor/courses/:id/lessons/:lessonId/edit - Edit Lesson Content
router.get('/courses/:id/lessons/:lessonId/edit', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);
  if (!course) return res.status(403).send('Unauthorized');

  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ? AND course_id = ?').get(req.params.lessonId, courseId);
  if (!lesson) return res.status(404).send('Lesson not found');

  const modules = db.prepare('SELECT * FROM course_modules WHERE course_id = ? ORDER BY order_index ASC').all(courseId);

  res.render('instructor/lesson-form', {
    title: `Edit Lesson: ${lesson.title}`,
    course,
    lesson,
    modules
  });
});

// POST /instructor/courses/:id/lessons/:lessonId/edit - Update Lesson Content
router.post('/courses/:id/lessons/:lessonId/edit', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);
  if (!course) return res.status(403).send('Unauthorized');

  const { title, module_id, content_type, duration_mins, video_url, content } = req.body;

  db.prepare(`
    UPDATE lessons
    SET title = ?, module_id = ?, content_type = ?, duration_mins = ?, video_url = ?, content = ?
    WHERE id = ? AND course_id = ?
  `).run(
    title,
    module_id,
    content_type,
    parseInt(duration_mins, 10) || 15,
    video_url || null,
    content,
    req.params.lessonId,
    courseId
  );

  req.session.flash = { success: 'Lesson content saved.' };
  res.redirect(`/instructor/courses/${courseId}/curriculum`);
});

// GET /instructor/courses/:id/quizzes/new - New Quiz Form
router.get('/courses/:id/quizzes/new', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);
  if (!course) return res.status(403).send('Unauthorized');

  const modules = db.prepare('SELECT * FROM course_modules WHERE course_id = ? ORDER BY order_index ASC').all(courseId);

  res.render('instructor/quiz-form', {
    title: `Create Assessment Quiz | ${course.code}`,
    course,
    modules
  });
});

// POST /instructor/courses/:id/quizzes/new - Save Quiz
router.post('/courses/:id/quizzes/new', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);
  if (!course) return res.status(403).send('Unauthorized');

  const { title, module_id, description, time_limit_mins, passing_score, max_attempts } = req.body;

  const quizResult = db.prepare(`
    INSERT INTO quizzes (course_id, module_id, title, description, time_limit_mins, passing_score, max_attempts, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'published')
  `).run(
    courseId,
    module_id || null,
    title,
    description || '',
    parseInt(time_limit_mins, 10) || 20,
    parseInt(passing_score, 10) || 70,
    parseInt(max_attempts, 10) || 3
  );

  const quizId = quizResult.lastInsertRowid;

  // Process dynamic questions array from form
  const questionsData = req.body.questions;
  if (Array.isArray(questionsData)) {
    const insertQ = db.prepare(`
      INSERT INTO quiz_questions (quiz_id, question_text, explanation, points, order_index, options_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    questionsData.forEach((q, idx) => {
      if (q.text) {
        const options = [
          { id: 'a', text: q.option_a, is_correct: q.correct === 'a' },
          { id: 'b', text: q.option_b, is_correct: q.correct === 'b' },
          { id: 'c', text: q.option_c, is_correct: q.correct === 'c' },
          { id: 'd', text: q.option_d, is_correct: q.correct === 'd' }
        ];

        insertQ.run(
          quizId,
          q.text,
          q.explanation || '',
          parseInt(q.points, 10) || 10,
          idx + 1,
          JSON.stringify(options)
        );
      }
    });
  }

  req.session.flash = { success: 'Quiz and assessment questions successfully published.' };
  res.redirect(`/instructor/courses/${courseId}/curriculum`);
});

// GET /instructor/courses/:id/assignments/new - New Assignment Form
router.get('/courses/:id/assignments/new', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);
  if (!course) return res.status(403).send('Unauthorized');

  const modules = db.prepare('SELECT * FROM course_modules WHERE course_id = ? ORDER BY order_index ASC').all(courseId);

  res.render('instructor/assignment-form', {
    title: `Create Assignment | ${course.code}`,
    course,
    modules
  });
});

// POST /instructor/courses/:id/assignments/new - Save Assignment
router.post('/courses/:id/assignments/new', (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  const course = checkCourseOwnership(courseId, req.session.user.id, req.session.user.role);
  if (!course) return res.status(403).send('Unauthorized');

  const { title, module_id, description, instructions, max_points, due_date } = req.body;

  db.prepare(`
    INSERT INTO assignments (course_id, module_id, title, description, instructions, max_points, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'published')
  `).run(
    courseId,
    module_id || null,
    title,
    description,
    instructions,
    parseInt(max_points, 10) || 100,
    due_date || null
  );

  req.session.flash = { success: 'Laboratory assignment published.' };
  res.redirect(`/instructor/courses/${courseId}/curriculum`);
});

module.exports = router;
