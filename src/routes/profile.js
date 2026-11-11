const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/profile
 * Protected endpoint accessible with any valid access token.
 * Returns the current user's safe profile.
 */
router.get('/', authenticateToken, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    }
  });
});

module.exports = router;
