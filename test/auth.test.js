// Set dedicated test configuration environment variables BEFORE requiring application modules
process.env.PORT = '3000';
process.env.JWT_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_ISSUER = 'test-auth-issuer';
process.env.JWT_AUDIENCE = 'test-auth-audience';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const config = require('../src/config');
const { seedUsers, listSafeUsers } = require('../src/data/users');

describe('Application, Authentication, and Authorization Tests', () => {
  let server;
  let baseUrl;
  let userToken;
  let adminToken;

  before(async () => {
    // Seed in-memory demo users
    await seedUsers();

    // Start server on an automatically assigned random available port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    // Obtain a valid token for regular user via POST /api/auth/login
    const userLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'user',
        password: 'UserPassword123'
      })
    });
    const userData = await userLoginRes.json();
    userToken = userData.accessToken;

    // Obtain a valid token for admin user via POST /api/auth/login
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'AdminPassword123'
      })
    });
    const adminData = await adminLoginRes.json();
    adminToken = adminData.accessToken;
  });

  after((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  // --- Public Behavior ---

  test('GET /api/public returns 200 without token', async () => {
    const res = await fetch(`${baseUrl}/api/public`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data, {
      message: 'Public endpoint accessible without authentication.'
    });
  });

  // --- Authentication (Login) Tests ---

  test('Correct user credentials return 200 and expected safe user', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'user',
        password: 'UserPassword123'
      })
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');

    const data = await res.json();
    assert.equal(data.tokenType, 'Bearer');
    assert.equal(data.expiresIn, 3600);
    assert.ok(typeof data.accessToken === 'string');
    assert.deepEqual(data.user, {
      id: '1',
      username: 'user',
      role: 'user'
    });

    assert.equal('password' in data, false);
    assert.equal('passwordHash' in data, false);
    assert.equal('password' in data.user, false);
    assert.equal('passwordHash' in data.user, false);
  });

  test('Correct admin credentials return 200 and admin role', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'AdminPassword123'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.role, 'admin');
    assert.equal(data.user.username, 'admin');
  });

  test('Wrong password returns 401 with standard unauthorized error', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'user',
        password: 'WrongPassword123'
      })
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.deepEqual(data, {
      error: 'Unauthorized',
      message: 'Invalid username or password.'
    });
  });

  test('Unknown username returns identical 401 response', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nonexistent_user',
        password: 'UserPassword123'
      })
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.deepEqual(data, {
      error: 'Unauthorized',
      message: 'Invalid username or password.'
    });
  });

  test('Missing login fields return 400', async () => {
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user' })
    });
    assert.equal(res1.status, 400);

    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'UserPassword123' })
    });
    assert.equal(res2.status, 400);
  });

  test('Incorrect login field types and empty strings return 400', async () => {
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 12345, password: 'UserPassword123' })
    });
    assert.equal(res1.status, 400);

    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user', password: true })
    });
    assert.equal(res2.status, 400);

    const res3 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '   ', password: 'UserPassword123' })
    });
    assert.equal(res3.status, 400);

    const res4 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user', password: '' })
    });
    assert.equal(res4.status, 400);

    const res5 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'u'.repeat(101), password: 'UserPassword123' })
    });
    assert.equal(res5.status, 400);
  });

  test('Null, array, and missing login request bodies return 400', async () => {
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['user', 'UserPassword123'])
    });
    assert.equal(res1.status, 400);

    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    });
    assert.equal(res2.status, 400);

    const res3 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ''
    });
    assert.equal(res3.status, 400);
  });

  test('Password longer than 72 UTF-8 bytes returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'user',
        password: 'p'.repeat(73)
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.deepEqual(data, {
      error: 'Bad Request',
      message: 'Password exceeds maximum length of 72 bytes.'
    });
  });

  test('Supplying an extra role or unexpected field in login returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'user',
        password: 'UserPassword123',
        role: 'admin'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.deepEqual(data, {
      error: 'Bad Request',
      message: 'Request contains unexpected fields.'
    });
  });

  test('Returned JWT verifies with HS256, issuer, audience, and correct claims', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'user',
        password: 'UserPassword123'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();

    const decoded = jwt.verify(data.accessToken, config.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE
    });

    assert.equal(decoded.sub, '1');
    assert.equal(decoded.username, 'user');
    assert.equal(decoded.role, 'user');
    assert.equal(decoded.iss, config.JWT_ISSUER);
    assert.equal(decoded.aud, config.JWT_AUDIENCE);
    assert.ok(typeof decoded.iat === 'number');
    assert.ok(typeof decoded.exp === 'number');
    assert.equal(decoded.exp - decoded.iat, 3600);

    assert.equal('password' in decoded, false);
    assert.equal('passwordHash' in decoded, false);
  });

  test('Repeated seeding does not duplicate accounts', async () => {
    const initialUsers = listSafeUsers();
    assert.equal(initialUsers.length, 2);

    await seedUsers();
    await seedUsers();

    const usersAfter = listSafeUsers();
    assert.equal(usersAfter.length, 2);
  });

  // --- Protected Profile: Authentication Failure Edge Cases ---

  test('Missing Authorization header returns 401 with WWW-Authenticate: Bearer', async () => {
    const res = await fetch(`${baseUrl}/api/profile`);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
    const data = await res.json();
    assert.deepEqual(data, {
      error: 'Unauthorized',
      message: 'A valid access token is required.'
    });
  });

  test('Wrong authentication scheme returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: 'Basic dXNlcjpwYXNzd29yZA==' }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
    const data = await res.json();
    assert.deepEqual(data, {
      error: 'Unauthorized',
      message: 'A valid access token is required.'
    });
  });

  test('Empty Bearer credentials return 401', async () => {
    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: 'Bearer ' }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
    const data = await res.json();
    assert.deepEqual(data, {
      error: 'Unauthorized',
      message: 'A valid access token is required.'
    });
  });

  test('Malformed JWT returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: 'Bearer not.a.valid.jwt' }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  test('Tampered JWT signature returns 401', async () => {
    const tampered = userToken.slice(0, -6) + 'xxxxxx';
    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${tampered}` }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  test('Expired JWT returns 401', async () => {
    const expiredToken = jwt.sign(
      { username: 'user' },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '-1s',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
        subject: '1'
      }
    );

    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  test('JWT signed with the wrong secret returns 401', async () => {
    const wrongSecretToken = jwt.sign(
      { username: 'user' },
      'wrong_secret_key_at_least_32_bytes_long_1234567890',
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
        subject: '1'
      }
    );

    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${wrongSecretToken}` }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  test('Wrong issuer returns 401', async () => {
    const wrongIssuerToken = jwt.sign(
      { username: 'user' },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: 'wrong-issuer-name',
        audience: config.JWT_AUDIENCE,
        subject: '1'
      }
    );

    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${wrongIssuerToken}` }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  test('Wrong audience returns 401', async () => {
    const wrongAudienceToken = jwt.sign(
      { username: 'user' },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: config.JWT_ISSUER,
        audience: 'wrong-audience-client',
        subject: '1'
      }
    );

    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${wrongAudienceToken}` }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  test('Correctly signed token using HS384 instead of HS256 returns 401', async () => {
    const hs384Token = jwt.sign(
      { username: 'user' },
      config.JWT_SECRET,
      {
        algorithm: 'HS384',
        expiresIn: '1h',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
        subject: '1'
      }
    );

    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${hs384Token}` }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  test('Unsigned token using alg "none" returns 401', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      sub: '1',
      username: 'user',
      iss: config.JWT_ISSUER,
      aud: config.JWT_AUDIENCE,
      iat: now,
      exp: now + 3600
    })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${noneToken}` }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  test('Future nbf claim returns 401', async () => {
    const futureNbfToken = jwt.sign(
      { username: 'user' },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        notBefore: '1h',
        expiresIn: '2h',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
        subject: '1'
      }
    );

    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${futureNbfToken}` }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  test('Missing exp claim returns 401', async () => {
    const noExpToken = jwt.sign(
      { username: 'user' },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
        subject: '1'
      }
    );

    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${noExpToken}` }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  test('Missing or invalid sub claim returns 401', async () => {
    // Missing sub claim
    const noSubToken = jwt.sign(
      { username: 'user' },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE
      }
    );

    const res1 = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${noSubToken}` }
    });
    assert.equal(res1.status, 401);
    assert.equal(res1.headers.get('www-authenticate'), 'Bearer');

    // Blank string sub claim
    const blankSubToken = jwt.sign(
      { username: 'user', sub: '   ' },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE
      }
    );

    const res2 = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${blankSubToken}` }
    });
    assert.equal(res2.status, 401);
    assert.equal(res2.headers.get('www-authenticate'), 'Bearer');
  });

  test('Unknown user ID in sub returns 401', async () => {
    const unknownUserToken = jwt.sign(
      { username: 'nonexistent' },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
        subject: 'unknown-id-999'
      }
    );

    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${unknownUserToken}` }
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  // --- Protected Profile: Successful Access ---

  test('Valid user login token returns 200 with safe profile', async () => {
    // Case-insensitive scheme: 'bearer'
    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const data = await res.json();
    assert.deepEqual(data, {
      user: {
        id: '1',
        username: 'user',
        role: 'user'
      }
    });
    assert.equal('password' in data.user, false);
    assert.equal('passwordHash' in data.user, false);
  });

  test('Valid admin login token returns 200 with admin safe profile', async () => {
    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const data = await res.json();
    assert.deepEqual(data, {
      user: {
        id: '2',
        username: 'admin',
        role: 'admin'
      }
    });
    assert.equal('password' in data.user, false);
    assert.equal('passwordHash' in data.user, false);
  });

  // --- Role-Based Authorization: GET /api/admin/users ---

  test('Admin endpoint without token returns 401 with WWW-Authenticate: Bearer', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
    const data = await res.json();
    assert.deepEqual(data, {
      error: 'Unauthorized',
      message: 'A valid access token is required.'
    });
  });

  test('Admin endpoint with regular user token returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.deepEqual(data, {
      error: 'Forbidden',
      message: 'You do not have permission to access this resource.'
    });
  });

  test('Admin endpoint with admin token returns 200 and safe users list', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const data = await res.json();

    assert.ok(Array.isArray(data.users));
    assert.equal(data.users.length, 2);
    assert.deepEqual(data.users, [
      { id: '1', username: 'user', role: 'user' },
      { id: '2', username: 'admin', role: 'admin' }
    ]);

    for (const u of data.users) {
      assert.equal('password' in u, false);
      assert.equal('passwordHash' in u, false);
    }
  });

  test('Token claiming role "admin" but identifying user "1" in sub returns 403 (server-side role enforcement)', async () => {
    // Forge a token where payload claims role: 'admin', but sub is '1' (the regular user)
    const forgedToken = jwt.sign(
      { username: 'user', role: 'admin' },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
        subject: '1'
      }
    );

    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${forgedToken}` }
    });

    // Server must reject with 403 because user '1' has role 'user' on the server
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.deepEqual(data, {
      error: 'Forbidden',
      message: 'You do not have permission to access this resource.'
    });
  });
});
