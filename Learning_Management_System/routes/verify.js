const express = require('express');
const router = express.Router();
const db = require('../database/init');

// GET /verify/:certificateCode - Public Certificate Verification
router.get('/:certificateCode', (req, res) => {
  const { certificateCode } = req.params;

  const cert = db.prepare(`
    SELECT cert.*, c.title as course_title, c.code as course_code, c.category, c.difficulty, c.estimated_hours,
           u.name as instructor_name, u.headline as instructor_headline
    FROM certificates cert
    JOIN courses c ON cert.course_id = c.id
    JOIN users u ON c.instructor_id = u.id
    WHERE cert.certificate_code = ?
  `).get(certificateCode.toUpperCase());

  if (!cert) {
    return res.status(404).render('verify/certificate', {
      title: 'Credential Verification Failure',
      cert: null,
      searchedCode: certificateCode
    });
  }

  res.render('verify/certificate', {
    title: `Verified Credential: ${cert.certificate_code}`,
    cert,
    searchedCode: certificateCode
  });
});

module.exports = router;
