const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { redirectIfAuth } = require('../middleware/auth');

const router = express.Router();

// Show login page
router.get('/login', redirectIfAuth, (req, res) => {
  res.render('auth/login', { title: 'Login' });
});

// Show signup page
router.get('/signup', redirectIfAuth, (req, res) => {
  res.render('auth/signup', { title: 'Sign Up' });
});

// Handle login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/auth/login');
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/auth/login');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/auth/login');
    }

    // Check if user is active
    if (!user.isActive) {
      req.flash('error_msg', 'Account is deactivated. Please contact support.');
      return res.redirect('/auth/login');
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store token in session
    req.session.token = token;
    req.session.userId = user._id;
    req.session.userRole = user.role;

    req.flash('success_msg', `Welcome back, ${user.name}!`);
    
    // Redirect based on role
    const redirectPath = `/dashboard/${user.role}`;
    res.redirect(redirectPath);

  } catch (error) {
    console.error('Login error:', error);
    req.flash('error_msg', 'An error occurred during login');
    res.redirect('/auth/login');
  }
});

// Handle signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword || !role) {
      req.flash('error_msg', 'Please fill in all fields');
      return res.redirect('/auth/signup');
    }

    if (password !== confirmPassword) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/signup');
    }

    if (password.length < 6) {
      req.flash('error_msg', 'Password must be at least 6 characters long');
      return res.redirect('/auth/signup');
    }

    if (!['student', 'industry', 'faculty'].includes(role)) {
      req.flash('error_msg', 'Invalid role selected');
      return res.redirect('/auth/signup');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      req.flash('error_msg', 'User with this email already exists');
      return res.redirect('/auth/signup');
    }

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store token in session
    req.session.token = token;
    req.session.userId = user._id;
    req.session.userRole = user.role;

    req.flash('success_msg', `Welcome to InternshipHub, ${user.name}!`);
    
    // Redirect based on role
    const redirectPath = `/dashboard/${user.role}`;
    res.redirect(redirectPath);

  } catch (error) {
    console.error('Signup error:', error);
    req.flash('error_msg', 'An error occurred during signup');
    res.redirect('/auth/signup');
  }
});

// Handle logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      req.flash('error_msg', 'Error logging out');
      return res.redirect('/dashboard');
    }
    
    res.clearCookie('connect.sid');
    req.flash('success_msg', 'You have been logged out successfully');
    res.redirect('/');
  });
});

// API endpoints for AJAX requests
router.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please fill in all fields' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    req.session.token = token;
    req.session.userId = user._id;
    req.session.userRole = user.role;

    res.json({
      success: true,
      user: user.toJSON(),
      redirectUrl: `/dashboard/${user.role}`
    });

  } catch (error) {
    console.error('API Login error:', error);
    res.status(500).json({ error: 'An error occurred during login' });
  }
});

router.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Please fill in all fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (!['student', 'industry', 'faculty'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role selected' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    req.session.token = token;
    req.session.userId = user._id;
    req.session.userRole = user.role;

    res.json({
      success: true,
      user: user.toJSON(),
      redirectUrl: `/dashboard/${user.role}`
    });

  } catch (error) {
    console.error('API Signup error:', error);
    res.status(500).json({ error: 'An error occurred during signup' });
  }
});

module.exports = router;