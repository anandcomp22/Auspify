/**
 * Authentication and Authorization Middleware
 * 
 * Provides middleware functions to protect routes based on authentication
 * status and user roles ('seeker', 'employer', 'admin').
 */

/**
 * Helper to set flash message in session and/or via req.flash
 * @param {Object} req - Express request object
 * @param {string} type - Message type ('error', 'success', 'info', 'warning')
 * @param {string} message - Message text
 */
function setFlash(req, type, message) {
  if (typeof req.flash === 'function') {
    try {
      req.flash(type, message);
    } catch (_) {
      // Ignore if req.flash is not configured
    }
  }

  if (req.session) {
    if (!req.session.flash || typeof req.session.flash !== 'object') {
      req.session.flash = {};
    }
    req.session.flash[type] = message;
    req.session.flash.type = type;
    req.session.flash.message = message;
  }
}

/**
 * Helper to get current authenticated user from request
 * @param {Object} req - Express request object
 * @returns {Object|null} User object if authenticated, null otherwise
 */
function getUser(req) {
  if (req.session && req.session.user) {
    return req.session.user;
  }
  if (req.user) {
    return req.user;
  }
  return null;
}

/**
 * isAuthenticated: checks if user is logged in via session, redirects to /auth/login if not.
 * Sets a flash error message before redirecting.
 */
function isAuthenticated(req, res, next) {
  const user = getUser(req);
  if (user) {
    return next();
  }

  setFlash(req, 'error', 'Please log in to access this page.');

  if (req.session && req.method === 'GET') {
    req.session.returnTo = req.originalUrl;
  }

  return res.redirect('/auth/login');
}

/**
 * isEmployer: checks role is 'employer' or 'admin'.
 * Sets a flash error message before redirecting.
 */
function isEmployer(req, res, next) {
  const user = getUser(req);
  if (!user) {
    setFlash(req, 'error', 'Please log in to access this page.');
    if (req.session && req.method === 'GET') {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect('/auth/login');
  }

  const role = user.role ? user.role.toLowerCase() : '';
  if (role === 'employer' || role === 'admin') {
    return next();
  }

  setFlash(req, 'error', 'Access denied. Employer or administrator privileges required.');
  const redirectUrl = req.originalUrl === '/dashboard' ? '/' : '/dashboard';
  return res.redirect(redirectUrl);
}

/**
 * isSeeker: checks role is 'seeker'.
 * Sets a flash error message before redirecting.
 */
function isSeeker(req, res, next) {
  const user = getUser(req);
  if (!user) {
    setFlash(req, 'error', 'Please log in to access this page.');
    if (req.session && req.method === 'GET') {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect('/auth/login');
  }

  const role = user.role ? user.role.toLowerCase() : '';
  if (role === 'seeker') {
    return next();
  }

  setFlash(req, 'error', 'Access denied. Job seeker account required.');
  const redirectUrl = req.originalUrl === '/dashboard' ? '/' : '/dashboard';
  return res.redirect(redirectUrl);
}

/**
 * isAdmin: checks role is 'admin'.
 * Sets a flash error message before redirecting.
 */
function isAdmin(req, res, next) {
  const user = getUser(req);
  if (!user) {
    setFlash(req, 'error', 'Please log in to access this page.');
    if (req.session && req.method === 'GET') {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect('/auth/login');
  }

  const role = user.role ? user.role.toLowerCase() : '';
  if (role === 'admin') {
    return next();
  }

  setFlash(req, 'error', 'Access denied. Administrator privileges required.');
  const redirectUrl = req.originalUrl === '/dashboard' ? '/' : '/dashboard';
  return res.redirect(redirectUrl);
}

/**
 * isGuest / redirectIfAuthenticated: redirects logged-in users away from auth pages (login, register).
 */
function isGuest(req, res, next) {
  const user = getUser(req);
  if (user) {
    return res.redirect('/dashboard');
  }
  return next();
}

module.exports = {
  setFlash,
  isAuthenticated,
  isEmployer,
  isSeeker,
  isAdmin,
  isGuest,
  redirectIfAuthenticated: isGuest,
};
