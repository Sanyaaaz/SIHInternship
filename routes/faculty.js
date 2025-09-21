const express = require('express');
const { requireAuth, requireRoleAPI } = require('../middleware/auth');
const User = require('../models/User');
const Application = require('../models/Application');
const Feedback = require('../models/Feedback');
const Internship = require('../models/Internship');

const router = express.Router();

// Get all students for monitoring
router.get('/students', requireAuth, requireRoleAPI(['faculty']), async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('name email profile createdAt')
      .sort({ createdAt: -1 });

    // Get application counts for each student
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const applications = await Application.find({ student: student._id });
        return {
          ...student.toObject(),
          applicationStats: {
            total: applications.length,
            pending: applications.filter(app => app.status === 'pending').length,
            accepted: applications.filter(app => app.status === 'accepted').length,
            rejected: applications.filter(app => app.status === 'rejected').length
          }
        };
      })
    );

    res.json({
      success: true,
      students: studentsWithStats
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Error fetching students' });
  }
});

// Get student details with applications
router.get('/students/:id', requireAuth, requireRoleAPI(['faculty']), async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' })
      .select('-password');

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const applications = await Application.find({ student: req.params.id })
      .populate('internship', 'title company location type duration stipend')
      .sort({ createdAt: -1 });

    const feedback = await Feedback.find({ student: req.params.id })
      .populate('faculty', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      student,
      applications,
      feedback
    });

  } catch (error) {
    console.error('Get student details error:', error);
    res.status(500).json({ error: 'Error fetching student details' });
  }
});

// Get analytics data
router.get('/analytics', requireAuth, requireRoleAPI(['faculty']), async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalInternships = await Internship.countDocuments({ status: 'active' });
    const totalApplications = await Application.countDocuments();
    
    const applicationsByStatus = await Application.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const applicationsByMonth = await Application.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    const topCompanies = await Application.aggregate([
      {
        $lookup: {
          from: 'internships',
          localField: 'internship',
          foreignField: '_id',
          as: 'internshipData'
        }
      },
      {
        $unwind: '$internshipData'
      },
      {
        $group: {
          _id: '$internshipData.company',
          applications: { $sum: 1 }
        }
      },
      {
        $sort: { applications: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      analytics: {
        totalStudents,
        totalInternships,
        totalApplications,
        applicationsByStatus,
        applicationsByMonth,
        topCompanies
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Error fetching analytics' });
  }
});

// Submit feedback for a student
router.post('/feedback', requireAuth, requireRoleAPI(['faculty']), async (req, res) => {
  try {
    const { studentId, internshipId, type, subject, note, priority } = req.body;

    if (!studentId || !type || !subject || !note) {
      return res.status(400).json({ error: 'Student ID, type, subject, and note are required' });
    }

    // Verify student exists
    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Verify internship exists if provided
    if (internshipId) {
      const internship = await Internship.findById(internshipId);
      if (!internship) {
        return res.status(404).json({ error: 'Internship not found' });
      }
    }

    const feedback = new Feedback({
      faculty: req.user._id,
      student: studentId,
      internship: internshipId || undefined,
      type,
      subject: subject.trim(),
      note: note.trim(),
      priority: priority || 'medium'
    });

    await feedback.save();

    const populatedFeedback = await Feedback.findById(feedback._id)
      .populate('faculty', 'name')
      .populate('student', 'name')
      .populate('internship', 'title company');

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback: populatedFeedback
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Error submitting feedback' });
  }
});

// Get all feedback given by this faculty
router.get('/feedback', requireAuth, requireRoleAPI(['faculty']), async (req, res) => {
  try {
    const feedback = await Feedback.find({ faculty: req.user._id })
      .populate('student', 'name email')
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

// Update feedback
router.put('/feedback/:id', requireAuth, requireRoleAPI(['faculty']), async (req, res) => {
  try {
    const { type, subject, note, priority } = req.body;

    const feedback = await Feedback.findOne({
      _id: req.params.id,
      faculty: req.user._id
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    const updateData = {};
    if (type) updateData.type = type;
    if (subject) updateData.subject = subject.trim();
    if (note) updateData.note = note.trim();
    if (priority) updateData.priority = priority;

    const updatedFeedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('student', 'name email')
     .populate('internship', 'title company');

    res.json({
      success: true,
      message: 'Feedback updated successfully',
      feedback: updatedFeedback
    });

  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({ error: 'Error updating feedback' });
  }
});

// Delete feedback
router.delete('/feedback/:id', requireAuth, requireRoleAPI(['faculty']), async (req, res) => {
  try {
    const feedback = await Feedback.findOneAndDelete({
      _id: req.params.id,
      faculty: req.user._id
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({
      success: true,
      message: 'Feedback deleted successfully'
    });

  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ error: 'Error deleting feedback' });
  }
});

// Get all applications for monitoring
router.get('/applications', requireAuth, requireRoleAPI(['faculty']), async (req, res) => {
  try {
    const applications = await Application.find()
      .populate('student', 'name email profile')
      .populate('internship', 'title company location type duration stipend')
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

module.exports = router;