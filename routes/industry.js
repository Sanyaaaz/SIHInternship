const express = require('express');
const { requireAuth, requireRoleAPI } = require('../middleware/auth');
const Internship = require('../models/Internship');
const Application = require('../models/Application');

const router = express.Router();

// Post new internship
router.post('/internships', requireAuth, requireRoleAPI(['industry']), async (req, res) => {
  try {
    const {
      title, company, description, requirements, skills, location,
      type, duration, stipend, applicationDeadline
    } = req.body;

    // Validation
    if (!title || !company || !description || !location || !type || !duration || !stipend || !applicationDeadline) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Parse requirements and skills
    const parsedRequirements = Array.isArray(requirements) 
      ? requirements 
      : requirements.split('\n').map(req => req.trim()).filter(req => req);

    const parsedSkills = Array.isArray(skills)
      ? skills
      : skills.split(',').map(skill => skill.trim()).filter(skill => skill);

    const internship = new Internship({
      title: title.trim(),
      company: company.trim(),
      description: description.trim(),
      requirements: parsedRequirements,
      skills: parsedSkills,
      location: location.trim(),
      type,
      duration: duration.trim(),
      stipend: stipend.trim(),
      applicationDeadline: new Date(applicationDeadline),
      postedBy: req.user._id
    });

    await internship.save();

    res.json({
      success: true,
      message: 'Internship posted successfully',
      internship
    });

  } catch (error) {
    console.error('Post internship error:', error);
    res.status(500).json({ error: 'Error posting internship' });
  }
});

// Get industry's internships
router.get('/internships', requireAuth, requireRoleAPI(['industry']), async (req, res) => {
  try {
    const internships = await Internship.find({ postedBy: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      internships
    });

  } catch (error) {
    console.error('Get internships error:', error);
    res.status(500).json({ error: 'Error fetching internships' });
  }
});

// Update internship
router.put('/internships/:id', requireAuth, requireRoleAPI(['industry']), async (req, res) => {
  try {
    const {
      title, company, description, requirements, skills, location,
      type, duration, stipend, applicationDeadline, status
    } = req.body;

    const internship = await Internship.findOne({
      _id: req.params.id,
      postedBy: req.user._id
    });

    if (!internship) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    // Parse requirements and skills if provided
    const updateData = {
      title: title?.trim(),
      company: company?.trim(),
      description: description?.trim(),
      location: location?.trim(),
      type,
      duration: duration?.trim(),
      stipend: stipend?.trim(),
      status
    };

    if (requirements) {
      updateData.requirements = Array.isArray(requirements) 
        ? requirements 
        : requirements.split('\n').map(req => req.trim()).filter(req => req);
    }

    if (skills) {
      updateData.skills = Array.isArray(skills)
        ? skills
        : skills.split(',').map(skill => skill.trim()).filter(skill => skill);
    }

    if (applicationDeadline) {
      updateData.applicationDeadline = new Date(applicationDeadline);
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updatedInternship = await Internship.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Internship updated successfully',
      internship: updatedInternship
    });

  } catch (error) {
    console.error('Update internship error:', error);
    res.status(500).json({ error: 'Error updating internship' });
  }
});

// Delete internship
router.delete('/internships/:id', requireAuth, requireRoleAPI(['industry']), async (req, res) => {
  try {
    const internship = await Internship.findOneAndDelete({
      _id: req.params.id,
      postedBy: req.user._id
    });

    if (!internship) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    // Also delete related applications
    await Application.deleteMany({ internship: req.params.id });

    res.json({
      success: true,
      message: 'Internship deleted successfully'
    });

  } catch (error) {
    console.error('Delete internship error:', error);
    res.status(500).json({ error: 'Error deleting internship' });
  }
});

// Get applications for industry's internships
router.get('/applications', requireAuth, requireRoleAPI(['industry']), async (req, res) => {
  try {
    // First get all internships posted by this industry
    const internships = await Internship.find({ postedBy: req.user._id }).select('_id');
    const internshipIds = internships.map(int => int._id);

    // Then get all applications for these internships
    const applications = await Application.find({ internship: { $in: internshipIds } })
      .populate('student', 'name email profile')
      .populate('internship', 'title company')
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

// Update application status (accept/reject)
router.put('/applications/:id/status', requireAuth, requireRoleAPI(['industry']), async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!['pending', 'reviewed', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Find the application and verify it belongs to this industry's internship
    const application = await Application.findById(req.params.id)
      .populate('internship');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.internship.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update application
    application.status = status;
    application.notes = notes?.trim();
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();

    await application.save();

    res.json({
      success: true,
      message: 'Application status updated successfully',
      application
    });

  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ error: 'Error updating application status' });
  }
});

// Get application details
router.get('/applications/:id', requireAuth, requireRoleAPI(['industry']), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('student', 'name email profile')
      .populate('internship')
      .populate('reviewedBy', 'name');

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify this application belongs to this industry's internship
    if (application.internship.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      application
    });

  } catch (error) {
    console.error('Get application details error:', error);
    res.status(500).json({ error: 'Error fetching application details' });
  }
});

module.exports = router;