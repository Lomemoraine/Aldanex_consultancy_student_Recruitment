require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
console.log('REDIS_URL:', process.env.REDIS_URL)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(helmet());

// CORS configuration - support multiple frontend URLs
const allowedOrigins = [
  'http://localhost:3000', // Local development
  process.env.FRONTEND_URL, // Primary production URL
  'https://student-recruitment.aldanexglobal.org', // Custom domain
  'https://aldanex-consultancy-student-recruit-one.vercel.app', // Vercel URL
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/setup', require('./routes/setup'));
app.use('/api/students', require('./routes/students'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/counseling', require('./routes/counseling'));
app.use('/api/universities', require('./routes/universities'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/visa', require('./routes/visa'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Aldanex API running on port ${PORT}`);
});
