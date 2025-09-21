const express = require('express');
const { requireAuth, requireRoleAPI } = require('../middleware/auth');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const Feedback = require('../models/Feedback');

const router = express.Router();

// Apply for internship
router.post('/apply', requireAuth, requireRoleAPI(['student']), async (req, res) => {
  try {
    const { internshipId, coverLetter } = req.body;

    if (!internshipId) {
      return res.status(400).json({ error: 'Internship ID is required' });
    }

    // Check if internship exists and is active
    const internship = await Internship.findById(internshipId);
    if (!internship || internship.status !== 'active') {
      return res.status(404).json({ error: 'Internship not found or no longer active' });
    }

    // Check if application deadline has passed
    if (new Date() > internship.applicationDeadline) {
      return res.status(400).json({ error: 'Application deadline has passed' });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      student: req.user._id,
      internship: internshipId
    });

    if (existingApplication) {
      return res.status(400).json({ error: 'You have already applied for this internship' });
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

    res.json({
      success: true,
      message: 'Application submitted successfully',
      application: application
    });

  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ error: 'Error submitting application' });
  }
});

// Get student's applications
router.get('/applications', requireAuth, requireRoleAPI(['student']), async (req, res) => {
  try {
    const applications = await Application.find({ student: req.user._id })
      .populate('internship')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      applications
    });

  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Error fetching applications' });
  }
});

// Get application status
router.get('/application/:id/status', requireAuth, requireRoleAPI(['student']), async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      student: req.user._id
    }).populate('internship', 'title company');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({
      success: true,
      application
    });

  } catch (error) {
    console.error('Get application status error:', error);
    res.status(500).json({ error: 'Error fetching application status' });
  }
});

// Update profile
router.put('/profile', requireAuth, requireRoleAPI(['student']), async (req, res) => {
  try {
    const { phone, university, bio, skills, resume, linkedin, github } = req.body;
    
    const updateData = {
      'profile.phone': phone?.trim(),
      'profile.university': university?.trim(),
      'profile.bio': bio?.trim(),
      'profile.resume': resume?.trim(),
      'profile.linkedin': linkedin?.trim(),
      'profile.github': github?.trim()
    };

    // Handle skills array
    if (skills) {
      updateData['profile.skills'] = Array.isArray(skills) 
        ? skills.map(skill => skill.trim()).filter(skill => skill)
        : skills.split(',').map(skill => skill.trim()).filter(skill => skill);
    }

    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, updateData);
    
    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Get feedback from faculty
router.get('/feedback', requireAuth, requireRoleAPI(['student']), async (req, res) => {
  try {
    const feedback = await Feedback.find({ student: req.user._id })
      .populate('faculty', 'name profile.department')
      .populate('internship', 'title company')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      feedback
    });

  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Error fetching feedback' });
  }
});

// Mark feedback as read
router.put('/feedback/:id/read', requireAuth, requireRoleAPI(['student']), async (req, res) => {
  try {
    const feedback = await Feedback.findOneAndUpdate(
      { _id: req.params.id, student: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({
      success: true,
      message: 'Feedback marked as read'
    });

  } catch (error) {
    console.error('Mark feedback read error:', error);
    res.status(500).json({ error: 'Error updating feedback' });
  }
});

module.exports = router;