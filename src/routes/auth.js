const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { findUserByUsername, toSafeUser } = require('../data/users');

const router = express.Router();

/**
 * POST /api/auth/login
 * Validates credentials, checks password hash with bcrypt, and issues a JWT.
 */
router.post('/login', async (req, res, next) => {
  try {
    const body = req.body;

    // 1. Validate that body is a non-null object and not an array
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must be a JSON object.'
      });
    }

    // 2. Reject unexpected fields (including client-supplied role or id)
    const allowedFields = ['username', 'password'];
    const keys = Object.keys(body);
    const hasUnexpectedFields = keys.some((key) => !allowedFields.includes(key));
    if (hasUnexpectedFields) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request contains unexpected fields.'
      });
    }

    const { username, password } = body;

    // 3. Validate username and password presence and types
    if (
      typeof username !== 'string' ||
      username.trim() === '' ||
      typeof password !== 'string' ||
      password === ''
    ) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password must be nonempty strings.'
      });
    }

    // 4. Validate username length (maximum 100 characters)
    if (username.length > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username exceeds maximum length of 100 characters.'
      });
    }

    // 5. Validate password UTF-8 byte length (maximum 72 bytes for bcrypt)
    // Note: Do NOT trim or modify the password
    if (Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password exceeds maximum length of 72 bytes.'
      });
    }

    // 6. Look up user by username
    const user = findUserByUsername(username);

    // 7. Check password with bcrypt.
    // Unknown username and wrong password produce the exact same 401 response.
    const isPasswordValid = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !isPasswordValid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password.'
      });
    }

    // 8. Sign JWT with server-verified claims
    // Notice: sub is set via signing options, avoiding duplicate claim warnings/conflicts.
    const payload = {
      username: user.username,
      role: user.role
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      subject: user.id
    });

    // 9. Return success response with Cache-Control: no-store
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json({
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: toSafeUser(user)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
