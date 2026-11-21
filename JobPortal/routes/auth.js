const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../database/init');
const { isAuthenticated, isGuest, setFlash } = require('../middleware/auth');

// GET /auth/login
router.get('/login', isGuest, (req, res) => {
  res.render('auth/login', {
    title: 'Sign In - HireScope',
    errors: [],
    oldInput: {},
  });
});

// POST /auth/login
router.post(
  '/login',
  isGuest,
  [
    body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Sign In - HireScope',
        errors: errors.array(),
        oldInput: { email: req.body.email },
      });
    }

    const { email, password } = req.body;
    try {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        return res.render('auth/login', {
          title: 'Sign In - HireScope',
          errors: [{ msg: 'Invalid email or password.' }],
          oldInput: { email },
        });
      }

      const isMatch = bcrypt.compareSync(password, user.password_hash);
      if (!isMatch) {
        return res.render('auth/login', {
          title: 'Sign In - HireScope',
          errors: [{ msg: 'Invalid email or password.' }],
          oldInput: { email },
        });
      }

      // Populate session
      req.session.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: user.company,
        title: user.title,
      };

      setFlash(req, 'success', `Welcome back, ${user.name}.`);

      const returnTo = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;
      return res.redirect(returnTo);
    } catch (err) {
      console.error('Login error:', err);
      return res.render('auth/login', {
        title: 'Sign In - HireScope',
        errors: [{ msg: 'An unexpected system error occurred. Please try again.' }],
        oldInput: { email },
      });
    }
  }
);

// GET /auth/register
router.get('/register', isGuest, (req, res) => {
  res.render('auth/register', {
    title: 'Create Account - HireScope',
    errors: [],
    oldInput: {},
  });
});

// POST /auth/register
router.post(
  '/register',
  isGuest,
  [
    body('name').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('role')
      .isIn(['seeker', 'employer'])
      .withMessage('Please select a valid role (Job Seeker or Employer)'),
    body('company')
      .if(body('role').equals('employer'))
      .trim()
      .notEmpty()
      .withMessage('Company name is required for employer accounts'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    const { name, email, password, role, company, title } = req.body;

    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        title: 'Create Account - HireScope',
        errors: errors.array(),
        oldInput: { name, email, role, company, title },
      });
    }

    try {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) {
        return res.render('auth/register', {
          title: 'Create Account - HireScope',
          errors: [{ msg: 'An account with this email address already exists.' }],
          oldInput: { name, email, role, company, title },
        });
      }

      const password_hash = bcrypt.hashSync(password, 10);
      const stmt = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, company, title)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        name,
        email,
        password_hash,
        role,
        role === 'employer' ? company : null,
        title || null
      );

      // Auto login
      req.session.user = {
        id: result.lastInsertRowid,
        email,
        name,
        role,
        company: role === 'employer' ? company : null,
        title: title || null,
      };

      setFlash(req, 'success', 'Account registered successfully. Welcome to HireScope.');
      return res.redirect('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      return res.render('auth/register', {
        title: 'Create Account - HireScope',
        errors: [{ msg: 'Failed to create account. Please try again.' }],
        oldInput: { name, email, role, company, title },
      });
    }
  }
);

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// GET /auth/profile
router.get('/profile', isAuthenticated, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  if (!user) {
    setFlash(req, 'error', 'User profile not found.');
    return res.redirect('/dashboard');
  }

  // Calculate profile completion percentage
  let fieldsToCheck = ['name', 'email', 'phone', 'location', 'bio'];
  if (user.role === 'seeker') {
    fieldsToCheck.push('skills', 'title');
  } else if (user.role === 'employer') {
    fieldsToCheck.push('company', 'title');
  }

  const completedFields = fieldsToCheck.filter((f) => user[f] && user[f].trim().length > 0);
  const profileCompletion = Math.round((completedFields.length / fieldsToCheck.length) * 100);

  res.render('auth/profile', {
    title: 'Edit Profile - HireScope',
    profileUser: user,
    profileCompletion,
    errors: [],
  });
});

// POST /auth/profile
router.post(
  '/profile',
  isAuthenticated,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').optional({ checkFalsy: true }).trim(),
    body('location').optional({ checkFalsy: true }).trim(),
    body('bio').optional({ checkFalsy: true }).trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);

    if (!errors.isEmpty()) {
      return res.render('auth/profile', {
        title: 'Edit Profile - HireScope',
        profileUser: { ...user, ...req.body },
        profileCompletion: 50,
        errors: errors.array(),
      });
    }

    const { name, phone, location, bio, skills, company, title } = req.body;

    try {
      db.prepare(`
        UPDATE users 
        SET name = ?, phone = ?, location = ?, bio = ?, skills = ?, company = ?, title = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name,
        phone || null,
        location || null,
        bio || null,
        skills || null,
        user.role === 'employer' ? company || user.company : null,
        title || null,
        user.id
      );

      // Update session
      req.session.user.name = name;
      if (user.role === 'employer' && company) {
        req.session.user.company = company;
      }
      req.session.user.title = title || null;

      setFlash(req, 'success', 'Profile details updated successfully.');
      return res.redirect('/auth/profile');
    } catch (err) {
      console.error('Profile update error:', err);
      setFlash(req, 'error', 'Failed to update profile.');
      return res.redirect('/auth/profile');
    }
  }
);

module.exports = router;
