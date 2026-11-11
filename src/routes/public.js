const express = require('express');
const router = express.Router();

// GET /api/public
router.get('/', (req, res) => {
  res.status(200).json({
    message: 'Public endpoint accessible without authentication.'
  });
});

module.exports = router;
