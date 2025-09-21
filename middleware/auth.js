const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.session.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      req.flash('error_msg', 'Access denied. Please log in.');
      return res.redirect('/auth/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      req.flash('error_msg', 'User not found or inactive.');
      return res.redirect('/auth/login');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    req.flash('error_msg', 'Invalid token. Please log in again.');
    res.redirect('/auth/login');
  }
};

// Check if user is authenticated (for API routes)
const requireAuth = async (req, res, next) => {
  try {
    const token = req.session.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      req.flash('error_msg', 'Access denied. Please log in.');
      return res.redirect('/auth/login');
    }

    if (!roles.includes(req.user.role)) {
      req.flash('error_msg', 'Access denied. Insufficient permissions.');
      return res.redirect('/dashboard');
    }

    next();
  };
};

// Role-based access control for API routes
const requireRoleAPI = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access denied. Please log in.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

// Redirect if already authenticated
const redirectIfAuth = (req, res, next) => {
  if (req.session.token) {
    return res.redirect('/dashboard');
  }
  next();
};

module.exports = {
  verifyToken,
  requireAuth,
  requireRole,
  requireRoleAPI,
  redirectIfAuth
};