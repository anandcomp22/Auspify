require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');

// Initialize database
const db = require('./database/init');
// Pure SQLite Session Store utilizing Node 22 built-in node:sqlite
const SqliteSessionStore = require('./database/session-store');

// Run database seeding if necessary
const seedDatabase = require('./database/seed');
seedDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers with relaxed CSP for inline assets and Google fonts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Ensure required directories exist
const uploadDir = path.join(__dirname, 'uploads', 'resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Body parsing middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
app.use(
  session({
    store: new SqliteSessionStore(db),
    secret: process.env.SESSION_SECRET || 'hirescope-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

// Templating engine
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Flash messages and global template variables middleware
app.use((req, res, next) => {
  // Pass current authenticated user to all views
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.siteDomain = process.env.SITE_DOMAIN || 'hirescope.io';

  // Handle flash messages
  if (req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
  } else {
    res.locals.flash = null;
  }

  next();
});

// Mount Routes
const pagesRoutes = require('./routes/pages');
const authRoutes = require('./routes/auth');
const jobsRoutes = require('./routes/jobs');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');

app.use('/', pagesRoutes);
app.use('/auth', authRoutes);
app.use('/jobs', jobsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error/404', {
    title: 'Page Not Found - HireScope',
  });
});

// 500 handler
app.use((err, req, res, next) => {
  console.error('Application Error:', err);
  res.status(500).render('error/500', {
    title: 'Server Error - HireScope',
    error: process.env.NODE_ENV === 'development' ? err : null,
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`HireScope running on http://localhost:${PORT}`);
  });
}

module.exports = app;
