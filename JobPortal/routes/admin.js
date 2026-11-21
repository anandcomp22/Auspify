const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { isAuthenticated, isAdmin, setFlash } = require('../middleware/auth');

// All admin routes require admin role
router.use(isAuthenticated, isAdmin);

// GET /admin - Control Center
router.get('/', (req, res) => {
  try {
    const { user_search, user_role, job_status } = req.query;

    // Platform statistics
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalSeekers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'seeker'").get().count;
    const totalEmployers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'employer'").get().count;
    const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;
    const activeJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'active'").get().count;
    const totalApplications = db.prepare('SELECT COUNT(*) as count FROM applications').get().count;

    // Filter users
    let userWhere = [];
    let userParams = [];
    if (user_search && user_search.trim()) {
      userWhere.push('(name LIKE ? OR email LIKE ? OR company LIKE ?)');
      const wild = `%${user_search.trim()}%`;
      userParams.push(wild, wild, wild);
    }
    if (user_role && ['seeker', 'employer', 'admin'].includes(user_role)) {
      userWhere.push('role = ?');
      userParams.push(user_role);
    }
    const userWhereSQL = userWhere.length ? `WHERE ${userWhere.join(' AND ')}` : '';
    const users = db
      .prepare(`SELECT * FROM users ${userWhereSQL} ORDER BY created_at DESC LIMIT 50`)
      .all(...userParams);

    // Filter jobs
    let jobWhere = [];
    let jobParams = [];
    if (job_status && ['active', 'closed', 'draft'].includes(job_status)) {
      jobWhere.push('status = ?');
      jobParams.push(job_status);
    }
    const jobWhereSQL = jobWhere.length ? `WHERE ${jobWhere.join(' AND ')}` : '';
    const jobs = db
      .prepare(`
        SELECT jobs.*, users.name as employer_name, users.email as employer_email
        FROM jobs
        JOIN users ON jobs.employer_id = users.id
        ${jobWhereSQL}
        ORDER BY jobs.created_at DESC
        LIMIT 50
      `)
      .all(...jobParams);

    res.render('admin/dashboard', {
      title: 'Platform Administration - HireScope',
      stats: {
        totalUsers,
        totalSeekers,
        totalEmployers,
        totalJobs,
        activeJobs,
        totalApplications,
      },
      users,
      jobs,
      filters: {
        user_search: user_search || '',
        user_role: user_role || '',
        job_status: job_status || '',
      },
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    setFlash(req, 'error', 'Error loading administrative metrics.');
    res.redirect('/');
  }
});

// POST /admin/users/:id/role - Update user permissions
router.post('/users/:id/role', (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  const { role } = req.body;

  if (!['seeker', 'employer', 'admin'].includes(role)) {
    setFlash(req, 'error', 'Invalid role selection.');
    return res.redirect('/admin');
  }

  // Prevent admin from demoting themselves
  if (targetUserId === req.session.user.id && role !== 'admin') {
    setFlash(req, 'error', 'Cannot remove your own administrative credentials.');
    return res.redirect('/admin');
  }

  try {
    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, targetUserId);
    setFlash(req, 'success', `User permissions updated to ${role}.`);
    return res.redirect('/admin');
  } catch (err) {
    console.error('Admin update role error:', err);
    setFlash(req, 'error', 'Failed to update user role.');
    return res.redirect('/admin');
  }
});

// POST /admin/users/:id/delete - Delete user
router.post('/users/:id/delete', (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);

  if (targetUserId === req.session.user.id) {
    setFlash(req, 'error', 'Cannot delete active administrative account.');
    return res.redirect('/admin');
  }

  try {
    // Delete user's applications
    db.prepare('DELETE FROM applications WHERE seeker_id = ?').run(targetUserId);

    // Delete user's bookmarks
    db.prepare('DELETE FROM saved_jobs WHERE user_id = ?').run(targetUserId);

    // If employer, delete jobs and their applications
    const userJobs = db.prepare('SELECT id FROM jobs WHERE employer_id = ?').all(targetUserId);
    for (const job of userJobs) {
      db.prepare('DELETE FROM applications WHERE job_id = ?').run(job.id);
      db.prepare('DELETE FROM saved_jobs WHERE job_id = ?').run(job.id);
      db.prepare('DELETE FROM jobs WHERE id = ?').run(job.id);
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
    setFlash(req, 'success', 'User account and associated records permanently deleted.');
    return res.redirect('/admin');
  } catch (err) {
    console.error('Admin delete user error:', err);
    setFlash(req, 'error', 'Failed to delete user account.');
    return res.redirect('/admin');
  }
});

// POST /admin/jobs/:id/status - Moderate job listing status
router.post('/jobs/:id/status', (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (!['active', 'closed', 'draft'].includes(status)) {
    setFlash(req, 'error', 'Invalid status provided.');
    return res.redirect('/admin');
  }

  try {
    db.prepare('UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, jobId);
    setFlash(req, 'success', `Listing status updated to ${status}.`);
    return res.redirect('/admin');
  } catch (err) {
    console.error('Admin update job status error:', err);
    setFlash(req, 'error', 'Failed to update job status.');
    return res.redirect('/admin');
  }
});

// POST /admin/jobs/:id/delete - Delete job listing
router.post('/jobs/:id/delete', (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  try {
    db.prepare('DELETE FROM applications WHERE job_id = ?').run(jobId);
    db.prepare('DELETE FROM saved_jobs WHERE job_id = ?').run(jobId);
    db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);

    setFlash(req, 'success', 'Listing purged from database.');
    return res.redirect('/admin');
  } catch (err) {
    console.error('Admin delete job error:', err);
    setFlash(req, 'error', 'Failed to delete listing.');
    return res.redirect('/admin');
  }
});

module.exports = router;
