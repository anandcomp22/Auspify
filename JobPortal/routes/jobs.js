const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const db = require('../database/init');
const { isAuthenticated, isEmployer, isSeeker, setFlash } = require('../middleware/auth');

// Multer storage for resume uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'resumes'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `resume-${req.session.user.id}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf, .doc, .docx, and .txt files are allowed.'));
    }
  },
});

// GET /jobs - Search and Filter listings
router.get('/', (req, res) => {
  try {
    const {
      q,
      location,
      work_type,
      job_type,
      experience_level,
      salary_min,
      sort,
      page = 1,
    } = req.query;

    const limit = 9;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * limit;

    let whereClauses = ["jobs.status = 'active'"];
    let params = [];

    // Keyword search
    if (q && q.trim()) {
      whereClauses.push(`(
        jobs.title LIKE ? OR 
        jobs.company LIKE ? OR 
        jobs.description LIKE ? OR 
        jobs.skills LIKE ? OR
        jobs.requirements LIKE ?
      )`);
      const searchWildcard = `%${q.trim()}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    // Location search
    if (location && location.trim()) {
      whereClauses.push('jobs.location LIKE ?');
      params.push(`%${location.trim()}%`);
    }

    // Work type
    if (work_type && ['remote', 'onsite', 'hybrid'].includes(work_type)) {
      whereClauses.push('jobs.work_type = ?');
      params.push(work_type);
    }

    // Job type
    if (job_type && ['full-time', 'part-time', 'contract', 'internship'].includes(job_type)) {
      whereClauses.push('jobs.job_type = ?');
      params.push(job_type);
    }

    // Experience level
    if (experience_level && ['entry', 'mid', 'senior', 'lead', 'executive'].includes(experience_level)) {
      whereClauses.push('jobs.experience_level = ?');
      params.push(experience_level);
    }

    // Minimum salary
    if (salary_min && !isNaN(salary_min)) {
      whereClauses.push('jobs.salary_max >= ?');
      params.push(parseInt(salary_min, 10));
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Sorting
    let orderSQL = 'ORDER BY jobs.created_at DESC';
    if (sort === 'salary_desc') {
      orderSQL = 'ORDER BY jobs.salary_max DESC NULLS LAST, jobs.created_at DESC';
    } else if (sort === 'salary_asc') {
      orderSQL = 'ORDER BY jobs.salary_min ASC NULLS LAST, jobs.created_at DESC';
    } else if (sort === 'oldest') {
      orderSQL = 'ORDER BY jobs.created_at ASC';
    }

    // Count total matching
    const countQuery = `SELECT COUNT(*) as count FROM jobs ${whereSQL}`;
    const totalCount = db.prepare(countQuery).get(...params).count;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    // Fetch jobs
    const dataQuery = `
      SELECT jobs.*, users.name as employer_name, users.avatar_url as employer_avatar
      FROM jobs
      JOIN users ON jobs.employer_id = users.id
      ${whereSQL}
      ${orderSQL}
      LIMIT ? OFFSET ?
    `;
    const jobs = db.prepare(dataQuery).all(...params, limit, offset);

    res.render('jobs/list', {
      title: 'Browse Engineering & Design Openings - HireScope',
      jobs,
      filters: {
        q: q || '',
        location: location || '',
        work_type: work_type || '',
        job_type: job_type || '',
        experience_level: experience_level || '',
        salary_min: salary_min || '',
        sort: sort || 'newest',
      },
      pagination: {
        currentPage: Math.max(1, parseInt(page, 10)),
        totalPages,
        totalCount,
        hasPrev: parseInt(page, 10) > 1,
        hasNext: parseInt(page, 10) < totalPages,
      },
    });
  } catch (err) {
    console.error('Job search error:', err);
    res.render('jobs/list', {
      title: 'Browse Openings - HireScope',
      jobs: [],
      filters: {},
      pagination: { currentPage: 1, totalPages: 1, totalCount: 0 },
    });
  }
});

// GET /jobs/create - Show creation form
router.get('/create', isAuthenticated, isEmployer, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  res.render('jobs/create', {
    title: 'Publish Position - HireScope',
    employer: user,
    errors: [],
    oldInput: {},
  });
});

// POST /jobs/create - Submit new job listing
router.post(
  '/create',
  isAuthenticated,
  isEmployer,
  [
    body('title').trim().notEmpty().withMessage('Position title is required'),
    body('company').trim().notEmpty().withMessage('Company name is required'),
    body('location').trim().notEmpty().withMessage('Location is required (e.g. Remote, San Francisco, CA)'),
    body('work_type').isIn(['remote', 'onsite', 'hybrid']).withMessage('Valid work type required'),
    body('job_type').isIn(['full-time', 'part-time', 'contract', 'internship']).withMessage('Valid job type required'),
    body('description').trim().isLength({ min: 30 }).withMessage('Description must be at least 30 characters'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);

    if (!errors.isEmpty()) {
      return res.render('jobs/create', {
        title: 'Publish Position - HireScope',
        employer: user,
        errors: errors.array(),
        oldInput: req.body,
      });
    }

    const {
      title,
      company,
      location,
      work_type,
      job_type,
      experience_level,
      salary_min,
      salary_max,
      currency = 'USD',
      description,
      requirements,
      skills,
      status = 'active',
    } = req.body;

    try {
      const stmt = db.prepare(`
        INSERT INTO jobs (
          employer_id, title, company, location, work_type, job_type,
          experience_level, salary_min, salary_max, currency,
          description, requirements, skills, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `);

      const result = stmt.run(
        req.session.user.id,
        title,
        company,
        location,
        work_type,
        job_type,
        experience_level || 'mid',
        salary_min ? parseInt(salary_min, 10) : null,
        salary_max ? parseInt(salary_max, 10) : null,
        currency,
        description,
        requirements || null,
        skills || null,
        status === 'draft' ? 'draft' : 'active'
      );

      setFlash(req, 'success', 'Position published successfully.');
      return res.redirect(`/jobs/${result.lastInsertRowid}`);
    } catch (err) {
      console.error('Job creation error:', err);
      return res.render('jobs/create', {
        title: 'Publish Position - HireScope',
        employer: user,
        errors: [{ msg: 'Database error creating position. Please check your inputs.' }],
        oldInput: req.body,
      });
    }
  }
);

// GET /jobs/:id - Single job view
router.get('/:id', (req, res) => {
  const jobId = req.params.id;
  try {
    const job = db
      .prepare(`
        SELECT jobs.*, users.name as employer_name, users.bio as employer_bio, users.email as employer_email
        FROM jobs
        JOIN users ON jobs.employer_id = users.id
        WHERE jobs.id = ?
      `)
      .get(jobId);

    if (!job) {
      setFlash(req, 'error', 'Job posting not found.');
      return res.redirect('/jobs');
    }

    // Check if current user has applied or saved this job
    let existingApplication = null;
    let isSaved = false;

    if (req.session.user) {
      if (req.session.user.role === 'seeker') {
        existingApplication = db
          .prepare('SELECT * FROM applications WHERE job_id = ? AND seeker_id = ?')
          .get(job.id, req.session.user.id);

        const savedCheck = db
          .prepare('SELECT id FROM saved_jobs WHERE job_id = ? AND user_id = ?')
          .get(job.id, req.session.user.id);
        isSaved = !!savedCheck;
      }
    }

    // Related jobs (same work type or company, excluding current)
    const relatedJobs = db
      .prepare(`
        SELECT * FROM jobs 
        WHERE id != ? AND status = 'active' AND (work_type = ? OR company = ?)
        LIMIT 3
      `)
      .all(job.id, job.work_type, job.company);

    const isOwner = req.session.user && (req.session.user.id === job.employer_id || req.session.user.role === 'admin');

    res.render('jobs/detail', {
      title: `${job.title} at ${job.company} - HireScope`,
      job,
      relatedJobs,
      existingApplication,
      isSaved,
      isOwner,
    });
  } catch (err) {
    console.error('Job detail error:', err);
    setFlash(req, 'error', 'Error loading job details.');
    return res.redirect('/jobs');
  }
});

// GET /jobs/:id/edit - Edit job
router.get('/:id/edit', isAuthenticated, isEmployer, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) {
    setFlash(req, 'error', 'Job not found.');
    return res.redirect('/dashboard');
  }

  // Must be owner or admin
  if (job.employer_id !== req.session.user.id && req.session.user.role !== 'admin') {
    setFlash(req, 'error', 'Unauthorized to modify this posting.');
    return res.redirect('/dashboard');
  }

  res.render('jobs/edit', {
    title: `Edit ${job.title} - HireScope`,
    job,
    errors: [],
  });
});

// POST /jobs/:id/edit - Update job
router.post(
  '/:id/edit',
  isAuthenticated,
  isEmployer,
  [
    body('title').trim().notEmpty().withMessage('Position title is required'),
    body('company').trim().notEmpty().withMessage('Company name is required'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('work_type').isIn(['remote', 'onsite', 'hybrid']).withMessage('Valid work type required'),
    body('job_type').isIn(['full-time', 'part-time', 'contract', 'internship']).withMessage('Valid job type required'),
    body('description').trim().isLength({ min: 30 }).withMessage('Description must be at least 30 characters'),
  ],
  (req, res) => {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) {
      setFlash(req, 'error', 'Job not found.');
      return res.redirect('/dashboard');
    }

    if (job.employer_id !== req.session.user.id && req.session.user.role !== 'admin') {
      setFlash(req, 'error', 'Unauthorized to modify this posting.');
      return res.redirect('/dashboard');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('jobs/edit', {
        title: `Edit ${job.title} - HireScope`,
        job: { ...job, ...req.body },
        errors: errors.array(),
      });
    }

    const {
      title,
      company,
      location,
      work_type,
      job_type,
      experience_level,
      salary_min,
      salary_max,
      currency,
      description,
      requirements,
      skills,
      status,
    } = req.body;

    try {
      db.prepare(`
        UPDATE jobs SET
          title = ?, company = ?, location = ?, work_type = ?, job_type = ?,
          experience_level = ?, salary_min = ?, salary_max = ?, currency = ?,
          description = ?, requirements = ?, skills = ?, status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        title,
        company,
        location,
        work_type,
        job_type,
        experience_level || 'mid',
        salary_min ? parseInt(salary_min, 10) : null,
        salary_max ? parseInt(salary_max, 10) : null,
        currency || 'USD',
        description,
        requirements || null,
        skills || null,
        status || 'active',
        job.id
      );

      setFlash(req, 'success', 'Job listing updated successfully.');
      return res.redirect(`/jobs/${job.id}`);
    } catch (err) {
      console.error('Job update error:', err);
      return res.render('jobs/edit', {
        title: `Edit ${job.title} - HireScope`,
        job: { ...job, ...req.body },
        errors: [{ msg: 'Database error updating listing.' }],
      });
    }
  }
);

// POST /jobs/:id/close - Toggle job status to closed
router.post('/:id/close', isAuthenticated, isEmployer, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) {
    setFlash(req, 'error', 'Job not found.');
    return res.redirect('/dashboard');
  }

  if (job.employer_id !== req.session.user.id && req.session.user.role !== 'admin') {
    setFlash(req, 'error', 'Unauthorized.');
    return res.redirect('/dashboard');
  }

  db.prepare("UPDATE jobs SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(job.id);
  setFlash(req, 'info', 'Position closed and removed from public discovery.');
  return res.redirect('/dashboard');
});

// POST /jobs/:id/apply - Candidate applies to job
router.post(
  '/:id/apply',
  isAuthenticated,
  isSeeker,
  upload.single('resume'),
  (req, res) => {
    const jobId = req.params.id;
    const seekerId = req.session.user.id;
    const { cover_letter } = req.body;

    try {
      const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
      if (!job || job.status !== 'active') {
        setFlash(req, 'error', 'This position is no longer accepting applications.');
        return res.redirect('/jobs');
      }

      // Check for duplicate application
      const existing = db
        .prepare('SELECT id FROM applications WHERE job_id = ? AND seeker_id = ?')
        .get(jobId, seekerId);

      if (existing) {
        setFlash(req, 'warning', 'You have already submitted an application for this position.');
        return res.redirect(`/jobs/${jobId}`);
      }

      const resumeFilename = req.file ? req.file.filename : null;

      // Insert application
      db.prepare(`
        INSERT INTO applications (job_id, seeker_id, cover_letter, resume_filename, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(jobId, seekerId, cover_letter || null, resumeFilename);

      // Increment count on job
      db.prepare('UPDATE jobs SET applications_count = applications_count + 1 WHERE id = ?').run(jobId);

      setFlash(req, 'success', 'Application submitted successfully. Track status from your dashboard.');
      return res.redirect('/dashboard/seeker');
    } catch (err) {
      console.error('Job application error:', err);
      setFlash(req, 'error', 'Failed to submit application. Please try again.');
      return res.redirect(`/jobs/${jobId}`);
    }
  }
);

// POST /jobs/:id/save - Toggle bookmark job
router.post('/:id/save', isAuthenticated, isSeeker, (req, res) => {
  const jobId = req.params.id;
  const userId = req.session.user.id;

  try {
    const existing = db
      .prepare('SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?')
      .get(userId, jobId);

    if (existing) {
      db.prepare('DELETE FROM saved_jobs WHERE id = ?').run(existing.id);
      setFlash(req, 'info', 'Position removed from saved bookmarks.');
    } else {
      db.prepare('INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)').run(userId, jobId);
      setFlash(req, 'success', 'Position saved to your bookmarks.');
    }

    const redirectUrl = req.header('Referer') || `/jobs/${jobId}`;
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Save job error:', err);
    return res.redirect(`/jobs/${jobId}`);
  }
});

// POST /jobs/:id/delete - Delete job
router.post('/:id/delete', isAuthenticated, isEmployer, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) {
    setFlash(req, 'error', 'Job not found.');
    return res.redirect('/dashboard');
  }

  if (job.employer_id !== req.session.user.id && req.session.user.role !== 'admin') {
    setFlash(req, 'error', 'Unauthorized.');
    return res.redirect('/dashboard');
  }

  try {
    // Delete applications and saved links
    db.prepare('DELETE FROM applications WHERE job_id = ?').run(job.id);
    db.prepare('DELETE FROM saved_jobs WHERE job_id = ?').run(job.id);
    db.prepare('DELETE FROM jobs WHERE id = ?').run(job.id);

    setFlash(req, 'success', 'Job listing and related application records deleted.');
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Delete job error:', err);
    setFlash(req, 'error', 'Failed to delete listing.');
    return res.redirect('/dashboard');
  }
});

module.exports = router;
