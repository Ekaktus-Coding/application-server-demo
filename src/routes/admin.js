const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { listSafeUsers } = require('../data/users');

const router = express.Router();

/**
 * GET /api/admin/users
 * Protected endpoint requiring authentication and 'admin' role.
 * Returns safe user list (no passwords or hashes).
 */
router.get('/users', authenticateToken, requireRole('admin'), (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    users: listSafeUsers()
  });
});

module.exports = router;
