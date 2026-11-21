const express = require('express');
const router = express.Router();
const db = require('../database/init');

// Home Page
router.get('/', (req, res) => {
  try {
    // Fetch latest 6 active job openings
    const featuredJobs = db
      .prepare(`
        SELECT jobs.*, users.name as employer_name, users.avatar_url as employer_avatar
        FROM jobs
        JOIN users ON jobs.employer_id = users.id
        WHERE jobs.status = 'active'
        ORDER BY jobs.created_at DESC
        LIMIT 6
      `)
      .all();

    // Query real platform counts for integrity
    const jobStats = db.prepare(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(DISTINCT company) as total_companies
      FROM jobs 
      WHERE status = 'active'
    `).get();

    const applicationCount = db.prepare(`
      SELECT COUNT(*) as total_applications FROM applications
    `).get();

    res.render('index', {
      title: 'HireScope - Engineered Career Connections',
      featuredJobs,
      stats: {
        totalJobs: jobStats.total_jobs || 0,
        totalCompanies: jobStats.total_companies || 0,
        totalApplications: applicationCount.total_applications || 0,
      },
    });
  } catch (error) {
    console.error('Error loading homepage:', error);
    res.render('index', {
      title: 'HireScope - Engineered Career Connections',
      featuredJobs: [],
      stats: { totalJobs: 0, totalCompanies: 0, totalApplications: 0 },
    });
  }
});

// Privacy Policy
router.get('/privacy', (req, res) => {
  res.render('privacy', {
    title: 'Privacy Policy - HireScope',
  });
});

// Terms and Conditions
router.get('/terms', (req, res) => {
  res.render('terms', {
    title: 'Terms & Conditions - HireScope',
  });
});

module.exports = router;
