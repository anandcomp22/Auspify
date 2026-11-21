const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../database/init');
const { isAuthenticated, redirectIfAuthenticated } = require('../middleware/auth');

// GET /auth/login
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Sign In / Engineering Access',
    errors: [],
    email: ''
  });
});

// POST /auth/login
router.post(
  '/login',
  redirectIfAuthenticated,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid academic or institutional email required.'),
    body('password').notEmpty().withMessage('Password cannot be blank.')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('auth/login', {
        title: 'Sign In / Engineering Access',
        errors: errors.array().map(e => e.msg),
        email: req.body.email || ''
      });
    }

    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).render('auth/login', {
        title: 'Sign In / Engineering Access',
        errors: ['Invalid email or password combination. Verify your credentials.'],
        email
      });
    }

    // Set session user
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      headline: user.headline,
      bio: user.bio,
      avatar_url: user.avatar_url
    };

    const returnTo = req.session.returnTo || null;
    delete req.session.returnTo;

    if (returnTo) {
      return res.redirect(returnTo);
    }

    if (user.role === 'admin') {
      res.redirect('/dashboard/admin');
    } else if (user.role === 'instructor') {
      res.redirect('/dashboard/instructor');
    } else {
      res.redirect('/dashboard/student');
    }
  }
);

// GET /auth/register
router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Student & Faculty Enrollment',
    errors: [],
    formData: {}
  });
});

// POST /auth/register
router.post(
  '/register',
  redirectIfAuthenticated,
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Full legal or academic name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid institutional email address.'),
    body('role').isIn(['student', 'instructor']).withMessage('Role must be either Student or Instructor.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
    body('confirm_password').custom((val, { req }) => {
      if (val !== req.body.password) {
        throw new Error('Password confirmation does not match.');
      }
      return true;
    })
  ],
  (req, res) => {
    const errors = validationResult(req);
    const formData = req.body;

    if (!errors.isEmpty()) {
      return res.status(422).render('auth/register', {
        title: 'Student & Faculty Enrollment',
        errors: errors.array().map(e => e.msg),
        formData
      });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(formData.email);
    if (existing) {
      return res.status(409).render('auth/register', {
        title: 'Student & Faculty Enrollment',
        errors: ['An account with this email address already exists. Please sign in.'],
        formData
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(formData.password, salt);

    const headline = formData.role === 'instructor' 
      ? (formData.headline || 'Instructor / Course Author') 
      : (formData.headline || 'Student Researcher');

    const result = db.prepare(`
      INSERT INTO users (email, password_hash, name, role, headline, bio)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      formData.email,
      hash,
      formData.name,
      formData.role,
      headline,
      formData.bio || ''
    );

    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

    req.session.user = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      headline: newUser.headline,
      bio: newUser.bio,
      avatar_url: newUser.avatar_url
    };

    req.session.flash = { success: 'Account successfully registered and verified.' };

    if (newUser.role === 'instructor') {
      res.redirect('/dashboard/instructor');
    } else {
      res.redirect('/dashboard/student');
    }
  }
);

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// GET /auth/profile
router.get('/profile', isAuthenticated, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  res.render('auth/profile', {
    title: 'Account Settings & Credentials',
    user,
    errors: [],
    success: null
  });
});

// POST /auth/profile
router.post(
  '/profile',
  isAuthenticated,
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name cannot be blank.'),
    body('headline').trim(),
    body('bio').trim()
  ],
  (req, res) => {
    const errors = validationResult(req);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);

    if (!errors.isEmpty()) {
      return res.status(422).render('auth/profile', {
        title: 'Account Settings & Credentials',
        user,
        errors: errors.array().map(e => e.msg),
        success: null
      });
    }

    const { name, headline, bio, current_password, new_password } = req.body;

    let updatePassword = false;
    let newHash = user.password_hash;

    if (new_password) {
      if (!current_password || !bcrypt.compareSync(current_password, user.password_hash)) {
        return res.status(400).render('auth/profile', {
          title: 'Account Settings & Credentials',
          user,
          errors: ['Current password incorrect. Cannot update password.'],
          success: null
        });
      }
      if (new_password.length < 8) {
        return res.status(400).render('auth/profile', {
          title: 'Account Settings & Credentials',
          user,
          errors: ['New password must be at least 8 characters long.'],
          success: null
        });
      }
      const salt = bcrypt.genSaltSync(10);
      newHash = bcrypt.hashSync(new_password, salt);
      updatePassword = true;
    }

    db.prepare(`
      UPDATE users 
      SET name = ?, headline = ?, bio = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, headline, bio, newHash, user.id);

    // Refresh session
    req.session.user.name = name;
    req.session.user.headline = headline;
    req.session.user.bio = bio;

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);

    res.render('auth/profile', {
      title: 'Account Settings & Credentials',
      user: updatedUser,
      errors: [],
      success: 'Profile settings successfully updated.'
    });
  }
);

module.exports = router;
