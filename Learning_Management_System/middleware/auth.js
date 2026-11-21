/**
 * Authentication and Role-Based Authorization Middleware
 */

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  req.session.flash = { error: 'Authentication required. Please sign in to access this resource.' };
  return res.redirect('/auth/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.session.returnTo = req.originalUrl;
      req.session.flash = { error: 'Sign in to access this workspace.' };
      return res.redirect('/auth/login');
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('pages/error', {
        title: '403 Forbidden - Access Denied',
        statusCode: 403,
        message: `Your account role (${req.session.user.role}) is not authorized to access this restricted endpoint. Required role(s): ${roles.join(', ')}.`
      });
    }

    next();
  };
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/dashboard/admin');
    } else if (req.session.user.role === 'instructor') {
      return res.redirect('/dashboard/instructor');
    } else {
      return res.redirect('/dashboard/student');
    }
  }
  next();
}

function attachUserToLocals(req, res, next) {
  res.locals.currentUser = req.session && req.session.user ? req.session.user : null;
  res.locals.flash = req.session && req.session.flash ? req.session.flash : {};
  if (req.session) {
    delete req.session.flash;
  }
  next();
}

module.exports = {
  isAuthenticated,
  requireRole,
  redirectIfAuthenticated,
  attachUserToLocals
};
