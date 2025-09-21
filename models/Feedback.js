const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  internship: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Internship'
  },
  type: {
    type: String,
    enum: ['mentoring', 'evaluation', 'guidance', 'progress'],
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  note: {
    type: String,
    required: true,
    maxlength: 2000
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Feedback', feedbackSchema);