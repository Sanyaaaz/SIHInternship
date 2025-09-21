const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  internship: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Internship',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'accepted', 'rejected'],
    default: 'pending'
  },
  coverLetter: {
    type: String,
    maxlength: 1000
  },
  resume: {
    type: String // URL or file path
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  notes: String
}, {
  timestamps: true
});

// Compound index to prevent duplicate applications
applicationSchema.index({ student: 1, internship: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);