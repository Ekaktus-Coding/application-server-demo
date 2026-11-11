const jwt = require('jsonwebtoken');
const config = require('../config');
const { findUserById, toSafeUser } = require('../data/users');

/**
 * Sends a generic 401 Unauthorized response with WWW-Authenticate header.
 * Keeps error responses identical for all token rejections.
 */
function sendUnauthorized(res) {
  res.setHeader('WWW-Authenticate', 'Bearer');
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'A valid access token is required.'
  });
}

/**
 * Middleware: authenticateToken
 * Reads Authorization: Bearer <token> (case-insensitive scheme).
 * Verifies the token using HS256, issuer, audience, exp, and nbf.
 * Validates payload structure and resolves the CURRENT server-side user record.
 */
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      return sendUnauthorized(res);
    }

    // Require exactly two parts: "Bearer" and the token
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return sendUnauthorized(res);
    }

    const token = parts[1];
    if (!token) {
      return sendUnauthorized(res);
    }

    let payload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE
      });
    } catch (err) {
      // Any verification failure (tampered, expired, wrong secret/issuer/audience/alg)
      return sendUnauthorized(res);
    }

    // Payload must be a non-null object, not an array
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return sendUnauthorized(res);
    }

    // sub must be a nonempty string
    if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
      return sendUnauthorized(res);
    }

    // exp and iat must be present valid integers
    if (!Number.isInteger(payload.exp) || !Number.isInteger(payload.iat)) {
      return sendUnauthorized(res);
    }

    // Resolve current user from server-side store
    const userRecord = findUserById(payload.sub);
    if (!userRecord) {
      return sendUnauthorized(res);
    }

    // Identity and role are derived strictly from current server-side record
    req.user = toSafeUser(userRecord);
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Middleware factory: requireRole(requiredRole)
 * Enforces role-based authorization using req.user.role.
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return sendUnauthorized(res);
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource.'
      });
    }

    return next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
