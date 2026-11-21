const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { isAuthenticated, isSeeker, isEmployer, setFlash } = require('../middleware/auth');

// GET /dashboard - Role-based redirection
router.get('/', isAuthenticated, (req, res) => {
  const role = req.session.user.role;
  if (role === 'admin') {
    return res.redirect('/admin');
  } else if (role === 'employer') {
    return res.redirect('/dashboard/employer');
  } else {
    return res.redirect('/dashboard/seeker');
  }
});

// GET /dashboard/seeker - Candidate workspace
router.get('/seeker', isAuthenticated, isSeeker, (req, res) => {
  try {
    const userId = req.session.user.id;

    // Fetch user details for profile completion
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    const fieldsToCheck = ['name', 'email', 'phone', 'location', 'bio', 'skills', 'title'];
    const completedFields = fieldsToCheck.filter((f) => user[f] && user[f].trim().length > 0);
    const profileCompletion = Math.round((completedFields.length / fieldsToCheck.length) * 100);

    // Fetch submitted applications
    const applications = db
      .prepare(`
        SELECT 
          applications.id,
          applications.job_id,
          applications.status,
          applications.created_at,
          applications.resume_filename,
          jobs.title as job_title,
          jobs.company as job_company,
          jobs.location as job_location,
          jobs.work_type as job_work_type,
          jobs.job_type as job_job_type
        FROM applications
        JOIN jobs ON applications.job_id = jobs.id
        WHERE applications.seeker_id = ?
        ORDER BY applications.created_at DESC
      `)
      .all(userId);

    // Fetch saved positions
    const savedJobs = db
      .prepare(`
        SELECT 
          jobs.*,
          saved_jobs.created_at as saved_at
        FROM saved_jobs
        JOIN jobs ON saved_jobs.job_id = jobs.id
        WHERE saved_jobs.user_id = ?
        ORDER BY saved_jobs.created_at DESC
      `)
      .all(userId);

    // Calculate stats
    const stats = {
      totalApplications: applications.length,
      activeInterviews: applications.filter((a) => a.status === 'interview' || a.status === 'shortlisted').length,
      totalSaved: savedJobs.length,
    };

    res.render('dashboard/seeker', {
      title: 'Candidate Workspace - HireScope',
      user,
      profileCompletion,
      applications,
      savedJobs,
      stats,
    });
  } catch (err) {
    console.error('Seeker dashboard error:', err);
    setFlash(req, 'error', 'Error loading candidate workspace.');
    res.redirect('/');
  }
});

// GET /dashboard/employer - Employer workspace
router.get('/employer', isAuthenticated, isEmployer, (req, res) => {
  try {
    const employerId = req.session.user.id;

    // Fetch jobs posted by this employer
    const jobs = db
      .prepare(`
        SELECT 
          jobs.*,
          (SELECT COUNT(*) FROM applications WHERE applications.job_id = jobs.id) as app_count
        FROM jobs
        WHERE jobs.employer_id = ?
        ORDER BY jobs.created_at DESC
      `)
      .all(employerId);

    // Fetch recent applications for all this employer's jobs
    const recentApplications = db
      .prepare(`
        SELECT 
          applications.id,
          applications.status,
          applications.created_at,
          applications.resume_filename,
          jobs.id as job_id,
          jobs.title as job_title,
          users.id as candidate_id,
          users.name as candidate_name,
          users.email as candidate_email,
          users.location as candidate_location
        FROM applications
        JOIN jobs ON applications.job_id = jobs.id
        JOIN users ON applications.seeker_id = users.id
        WHERE jobs.employer_id = ?
        ORDER BY applications.created_at DESC
        LIMIT 10
      `)
      .all(employerId);

    // Employer statistics
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter((j) => j.status === 'active').length;
    const closedJobs = jobs.filter((j) => j.status === 'closed').length;
    const totalApplications = jobs.reduce((sum, j) => sum + (j.app_count || 0), 0);

    res.render('dashboard/employer', {
      title: 'Employer Workspace - HireScope',
      jobs,
      recentApplications,
      stats: {
        totalJobs,
        activeJobs,
        closedJobs,
        totalApplications,
      },
    });
  } catch (err) {
    console.error('Employer dashboard error:', err);
    setFlash(req, 'error', 'Error loading employer workspace.');
    res.redirect('/');
  }
});

// GET /dashboard/applications/:id - Detailed application view
router.get('/applications/:id', isAuthenticated, (req, res) => {
  try {
    const appId = req.params.id;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    const application = db
      .prepare(`
        SELECT 
          applications.*,
          jobs.id as job_id,
          jobs.title as job_title,
          jobs.company as job_company,
          jobs.employer_id as employer_id,
          jobs.location as job_location,
          jobs.work_type as job_work_type,
          jobs.job_type as job_job_type,
          users.id as candidate_id,
          users.name as candidate_name,
          users.email as candidate_email,
          users.phone as candidate_phone,
          users.location as candidate_location,
          users.bio as candidate_bio,
          users.skills as candidate_skills,
          users.title as candidate_title
        FROM applications
        JOIN jobs ON applications.job_id = jobs.id
        JOIN users ON applications.seeker_id = users.id
        WHERE applications.id = ?
      `)
      .get(appId);

    if (!application) {
      setFlash(req, 'error', 'Application record not found.');
      return res.redirect('/dashboard');
    }

    // Access authorization check:
    // Only candidate, employer of the job, or admin can view
    const isCandidate = application.seeker_id === userId;
    const isJobEmployer = application.employer_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isCandidate && !isJobEmployer && !isAdmin) {
      setFlash(req, 'error', 'Access restricted to authorized personnel.');
      return res.redirect('/dashboard');
    }

    res.render('dashboard/application-detail', {
      title: `Application Review: ${application.job_title} - HireScope`,
      application,
      isCandidate,
      isJobEmployer: isJobEmployer || isAdmin,
    });
  } catch (err) {
    console.error('Application detail view error:', err);
    setFlash(req, 'error', 'Failed to retrieve application details.');
    res.redirect('/dashboard');
  }
});

// POST /dashboard/applications/:id/status - Update candidate review status
router.post('/applications/:id/status', isAuthenticated, isEmployer, (req, res) => {
  try {
    const appId = req.params.id;
    const { status, employer_notes } = req.body;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    const application = db
      .prepare(`
        SELECT applications.*, jobs.employer_id 
        FROM applications 
        JOIN jobs ON applications.job_id = jobs.id 
        WHERE applications.id = ?
      `)
      .get(appId);

    if (!application) {
      setFlash(req, 'error', 'Application not found.');
      return res.redirect('/dashboard');
    }

    if (application.employer_id !== userId && userRole !== 'admin') {
      setFlash(req, 'error', 'Unauthorized to modify status.');
      return res.redirect('/dashboard');
    }

    const validStatuses = ['pending', 'reviewing', 'shortlisted', 'interview', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      setFlash(req, 'error', 'Invalid candidate status selected.');
      return res.redirect(`/dashboard/applications/${appId}`);
    }

    db.prepare(`
      UPDATE applications 
      SET status = ?, employer_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, employer_notes || null, appId);

    setFlash(req, 'success', `Application status updated to ${status}.`);
    return res.redirect(`/dashboard/applications/${appId}`);
  } catch (err) {
    console.error('Application status update error:', err);
    setFlash(req, 'error', 'Failed to update candidate status.');
    return res.redirect('/dashboard');
  }
});

module.exports = router;
