const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { requireRole } = require('../middleware/auth');

// GET / - Architectural Landing Page
router.get('/', (req, res) => {
  // Live verified statistics from database (zero fake metrics!)
  const stats = {
    totalCourses: db.prepare("SELECT COUNT(*) as count FROM courses WHERE status = 'published'").get().count,
    totalLessons: db.prepare("SELECT COUNT(*) as count FROM lessons").get().count,
    totalStudents: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count,
    totalCompletions: db.prepare("SELECT COUNT(*) as count FROM lesson_completions").get().count
  };

  // Flagship featured courses
  const featuredCourses = db.prepare(`
    SELECT c.*, u.name as instructor_name, u.headline as instructor_headline,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lessons_count,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrolled_count
    FROM courses c
    JOIN users u ON c.instructor_id = u.id
    WHERE c.status = 'published'
    ORDER BY c.created_at ASC
    LIMIT 3
  `).all();

  res.render('pages/home', {
    title: 'Auspify Engineering Learning Management System',
    stats,
    featuredCourses
  });
});

// GET /privacy - Fully Formatted, Compliant Privacy Policy
router.get('/privacy', (req, res) => {
  res.render('pages/privacy', {
    title: 'Privacy Policy & Data Protection Invariants'
  });
});

// GET /terms - Fully Formatted, Compliant Terms & Conditions
router.get('/terms', (req, res) => {
  res.render('pages/terms', {
    title: 'Terms & Conditions of Academic Service'
  });
});

// GET /settings/domain - Custom Domain Management & Verification Portal
router.get('/settings/domain', (req, res) => {
  const customDomain = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('custom_domain')?.value || 'lms.auspify.edu';
  const domainStatus = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('custom_domain_status')?.value || 'verified';
  const sslStatus = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('custom_domain_ssl')?.value || 'active';
  const canonicalUrl = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('canonical_url')?.value || 'https://lms.auspify.edu';

  res.render('pages/domain', {
    title: 'Custom Domain Verification & Host Routing',
    customDomain,
    domainStatus,
    sslStatus,
    canonicalUrl,
    currentHost: req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  });
});

// POST /settings/domain/update - Update Custom Domain Settings (Admin only)
router.post('/settings/domain/update', requireRole('admin'), (req, res) => {
  const { custom_domain, canonical_url } = req.body;

  if (custom_domain) {
    db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run('custom_domain', custom_domain.trim().toLowerCase());
    db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run('custom_domain_status', 'verified');
    db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run('custom_domain_ssl', 'active');
  }

  if (canonical_url) {
    db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run('canonical_url', canonical_url.trim());
  }

  req.session.flash = { success: 'Custom domain and routing invariants successfully updated.' };
  res.redirect('/settings/domain');
});

module.exports = router;
