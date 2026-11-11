const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config();

// 1. Validate PORT
const rawPort = process.env.PORT || '3000';
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

// 2. Validate JWT_SECRET
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.trim() === '') {
  throw new Error('JWT_SECRET must be set and nonempty.');
}
if (jwtSecret === 'replace_with_a_random_secret') {
  throw new Error('JWT_SECRET must not use the placeholder from .env.example.');
}
if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
  throw new Error('JWT_SECRET must be at least 32 bytes long.');
}

// 3. Validate JWT_ISSUER
const jwtIssuer = process.env.JWT_ISSUER;
if (!jwtIssuer || jwtIssuer.trim() === '') {
  throw new Error('JWT_ISSUER must be set and nonempty.');
}

// 4. Validate JWT_AUDIENCE
const jwtAudience = process.env.JWT_AUDIENCE;
if (!jwtAudience || jwtAudience.trim() === '') {
  throw new Error('JWT_AUDIENCE must be set and nonempty.');
}

module.exports = {
  PORT: port,
  JWT_SECRET: jwtSecret,
  JWT_ISSUER: jwtIssuer,
  JWT_AUDIENCE: jwtAudience,
};
