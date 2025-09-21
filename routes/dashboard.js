const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Internship = require('../models/Internship');
const Application = require('../models/Application');
const Feedback = require('../models/Feedback');

const router = express.Router();

// Redirect /dashboard to role-specific dashboard
router.get('/', verifyToken, (req, res) => {
  res.redirect(`/dashboard/${req.user.role}`);
});

// Student Dashboard
router.get('/student', verifyToken, requireRole(['student']), async (req, res) => {
  try {
    const applications = await Application.find({ student: req.user._id })
      .populate('internship')
      .sort({ createdAt: -1 });

    const feedback = await Feedback.find({ student: req.user._id })
      .populate('faculty', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const stats = {
      totalApplications: applications.length,
      pendingApplications: applications.filter(app => app.status === 'pending').length,
      acceptedApplications: applications.filter(app => app.status === 'accepted').length,
      rejectedApplications: applications.filter(app => app.status === 'rejected').length
    };

    res.render('dashboard/student', {
      title: 'Student Dashboard',
      applications,
      feedback,
      stats
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
});

// Industry Dashboard
router.get('/industry', verifyToken, requireRole(['industry']), async (req, res) => {
  try {
    const internships = await Internship.find({ postedBy: req.user._id })
      .sort({ createdAt: -1 });

    const applications = await Application.find()
      .populate('internship')
      .populate('student', 'name email profile')
      .sort({ createdAt: -1 });

    // Filter applications for this industry's internships
    const industryApplications = applications.filter(app => 
      app.internship && app.internship.postedBy.toString() === req.user._id.toString()
    );

    const stats = {
      totalInternships: internships.length,
      activeInternships: internships.filter(int => int.status === 'active').length,
      totalApplications: industryApplications.length,
      pendingApplications: industryApplications.filter(app => app.status === 'pending').length
    };

    res.render('dashboard/industry', {
      title: 'Industry Dashboard',
      internships,
      applications: industryApplications,
      stats
    });
  } catch (error) {
    console.error('Industry dashboard error:', error);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
});

// Faculty Dashboard
router.get('/faculty', verifyToken, requireRole(['faculty']), async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('name email profile createdAt')
      .sort({ createdAt: -1 });

    const applications = await Application.find()
      .populate('student', 'name email')
      .populate('internship', 'title company')
      .sort({ createdAt: -1 });

    const feedback = await Feedback.find({ faculty: req.user._id })
      .populate('student', 'name')
      .sort({ createdAt: -1 });

    // Analytics data
    const analytics = {
      totalStudents: students.length,
      totalApplications: applications.length,
      acceptedApplications: applications.filter(app => app.status === 'accepted').length,
      pendingApplications: applications.filter(app => app.status === 'pending').length,
      feedbackGiven: feedback.length
    };

    res.render('dashboard/faculty', {
      title: 'Faculty Dashboard',
      students,
      applications,
      feedback,
      analytics
    });
  } catch (error) {
    console.error('Faculty dashboard error:', error);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
});

// Profile routes
router.get('/profile', verifyToken, async (req, res) => {
  res.render('dashboard/profile', {
    title: 'My Profile'
  });
});

router.post('/profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, university, company, department, bio, skills, linkedin, github } = req.body;
    
    const updateData = {
      name: name?.trim(),
      'profile.phone': phone?.trim(),
      'profile.university': university?.trim(),
      'profile.company': company?.trim(),
      'profile.department': department?.trim(),
      'profile.bio': bio?.trim(),
      'profile.linkedin': linkedin?.trim(),
      'profile.github': github?.trim()
    };

    // Handle skills array
    if (skills) {
      updateData['profile.skills'] = typeof skills === 'string' 
        ? skills.split(',').map(skill => skill.trim()).filter(skill => skill)
        : skills;
    }

    await User.findByIdAndUpdate(req.user._id, updateData);
    
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/dashboard/profile');
  } catch (error) {
    console.error('Profile update error:', error);
    req.flash('error_msg', 'Error updating profile');
    res.redirect('/dashboard/profile');
  }
});

module.exports = router;