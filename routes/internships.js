const express = require('express');
const Internship = require('../models/Internship');
const Application = require('../models/Application');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get all internships with search and filter
router.get('/', async (req, res) => {
  try {
    const { search, location, type, duration, page = 1, limit = 12 } = req.query;
    
    let query = { status: 'active' };
    
    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { skills: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Location filter
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }
    
    // Type filter
    if (type) {
      query.type = type;
    }
    
    // Duration filter
    if (duration) {
      query.duration = { $regex: duration, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const internships = await Internship.find(query)
      .populate('postedBy', 'name profile.company')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Internship.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));

    // If user is logged in, check which internships they've applied to
    let appliedInternships = [];
    if (req.session.token && req.session.userRole === 'student') {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(req.session.token, process.env.JWT_SECRET);
        const applications = await Application.find({ student: decoded.userId }).select('internship');
        appliedInternships = applications.map(app => app.internship.toString());
      } catch (error) {
        // Token invalid, continue without applied internships
      }
    }

    res.render('internships/list', {
      title: 'Find Internships',
      internships,
      appliedInternships,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      },
      filters: { search, location, type, duration },
      totalResults: total
    });

  } catch (error) {
    console.error('Get internships error:', error);
    req.flash('error_msg', 'Error loading internships');
    res.render('internships/list', {
      title: 'Find Internships',
      internships: [],
      appliedInternships: [],
      pagination: { current: 1, total: 0, hasNext: false, hasPrev: false },
      filters: {},
      totalResults: 0
    });
  }
});

// Get single internship details
router.get('/:id', async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.id)
      .populate('postedBy', 'name profile.company');

    if (!internship) {
      req.flash('error_msg', 'Internship not found');
      return res.redirect('/internships');
    }

    // Check if user has applied (if logged in as student)
    let hasApplied = false;
    let application = null;
    
    if (req.session.token && req.session.userRole === 'student') {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(req.session.token, process.env.JWT_SECRET);
        application = await Application.findOne({
          student: decoded.userId,
          internship: req.params.id
        });
        hasApplied = !!application;
      } catch (error) {
        // Token invalid, continue without application check
      }
    }

    res.render('internships/detail', {
      title: internship.title,
      internship,
      hasApplied,
      application
    });

  } catch (error) {
    console.error('Get internship details error:', error);
    req.flash('error_msg', 'Error loading internship details');
    res.redirect('/internships');
  }
});

// Apply for internship (POST route for form submission)
router.post('/:id/apply', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      req.flash('error_msg', 'Only students can apply for internships');
      return res.redirect(`/internships/${req.params.id}`);
    }

    const { coverLetter } = req.body;
    const internshipId = req.params.id;

    // Check if internship exists and is active
    const internship = await Internship.findById(internshipId);
    if (!internship || internship.status !== 'active') {
      req.flash('error_msg', 'Internship not found or no longer active');
      return res.redirect('/internships');
    }

    // Check if application deadline has passed
    if (new Date() > internship.applicationDeadline) {
      req.flash('error_msg', 'Application deadline has passed');
      return res.redirect(`/internships/${internshipId}`);
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      student: req.user._id,
      internship: internshipId
    });

    if (existingApplication) {
      req.flash('error_msg', 'You have already applied for this internship');
      return res.redirect(`/internships/${internshipId}`);
    }

    // Create application
    const application = new Application({
      student: req.user._id,
      internship: internshipId,
      coverLetter: coverLetter?.trim()
    });

    await application.save();

    // Update applications count
    await Internship.findByIdAndUpdate(internshipId, {
      $inc: { applicationsCount: 1 }
    });

    req.flash('success_msg', 'Application submitted successfully!');
    res.redirect(`/internships/${internshipId}`);

  } catch (error) {
    console.error('Apply for internship error:', error);
    req.flash('error_msg', 'Error submitting application');
    res.redirect(`/internships/${req.params.id}`);
  }
});

module.exports = router;