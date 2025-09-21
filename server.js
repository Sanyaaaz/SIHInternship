const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Import routes
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const industryRoutes = require('./routes/industry');
const facultyRoutes = require('./routes/faculty');
const dashboardRoutes = require('./routes/dashboard');
const internshipRoutes = require('./routes/internships');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS
app.use(cors());

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Flash messages
app.use(flash());

// Global variables for templates
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  next();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', './views');

// Static files
app.use(express.static('public'));

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/industry', industryRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/internships', internshipRoutes);

// Home route
app.get('/', async (req, res) => {
  try {
    const Internship = require('./models/Internship');
    const featuredInternships = await Internship.find({ status: 'active' })
      .populate('postedBy', 'name')
      .limit(6)
      .sort({ createdAt: -1 });
    
    res.render('index', { 
      title: 'Find Your Perfect Internship',
      featuredInternships
    });
  } catch (error) {
    console.error('Error loading home page:', error);
    res.render('index', { 
      title: 'Find Your Perfect Internship',
      featuredInternships: []
    });
  }
});

// About route
app.get('/about', (req, res) => {
  res.render('about', { title: 'About Us' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});