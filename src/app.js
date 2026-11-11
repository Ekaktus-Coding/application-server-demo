const express = require('express');
const publicRouter = require('./routes/public');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const adminRouter = require('./routes/admin');

const app = express();

// Disable X-Powered-By header for security
app.disable('x-powered-by');

// Parse JSON bodies with a safe small limit (10kb)
app.use(express.json({ limit: '10kb' }));

// Mount routers
app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/admin', adminRouter);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Endpoint not found.'
  });
});

// Final centralized error handler
app.use((err, req, res, next) => {
  // Handle malformed JSON body
  if (err.status === 400 || err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Malformed JSON payload.'
    });
  }

  // Handle body size limit exceeded
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body exceeds allowed limit.'
    });
  }

  // Generic 500 for unexpected errors (stack traces omitted)
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred.'
  });
});

module.exports = app;
