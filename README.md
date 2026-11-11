# Application Server Demo

A small educational Node.js application server demonstrating public and protected API endpoints, JWT-based authentication, and role-based authorization using Express.

> **Project Notice**: This is a local school demonstration, not a production-ready authentication system. Demo user accounts and credentials are provided for demonstration purposes only.

---

## Architecture: Authentication vs. Authorization

This project cleanly separates **Authentication** from **Authorization** through modular Express middleware:

- **Authentication (AuthN)**: *Who are you?*  
  Identifies the caller and verifies their identity. Handled by [`authenticateToken`](file:///home/ecactus/Documents/ukol/aplikacni%20server/src/middleware/auth.js#L23-L80), which extracts and validates the cryptographic signature, expiration, issuer, audience, and algorithm (`HS256`) of the JWT Bearer token, resolving the caller to an account in the server's in-memory array.
- **Authorization (AuthZ)**: *What are you allowed to do?*  
  Determines whether an identified caller possesses the permissions required for a specific resource. Handled by [`requireRole(requiredRole)`](file:///home/ecactus/Documents/ukol/aplikacni%20server/src/middleware/auth.js#L86-L101), which evaluates `req.user.role`.

### Request Pipeline Flow

```text
Incoming HTTP Request
       │
       ▼
 [ express.json() ]  --> (Validates JSON syntax & body limit)
       │
       ▼
 [ authenticateToken ] (Protected routes only)
       ├── Missing, invalid, expired, or tampered token? ──► HTTP 401 Unauthorized (WWW-Authenticate: Bearer)
       └── Valid signature & server user found?
                 │
                 ▼
          [ requireRole("admin") ] (Admin routes only)
                 ├── User role is not 'admin'? ──► HTTP 403 Forbidden
                 └── User role is 'admin'?
                           │
                           ▼
                   [ Route Handler ] ──► HTTP 200 OK
```

### HTTP 401 vs. HTTP 403

- **HTTP 401 Unauthorized**: The request lacks valid authentication credentials. The client must authenticate (or refresh an expired token) to proceed. Accompanied by the header `WWW-Authenticate: Bearer`.
- **HTTP 403 Forbidden**: The client's identity is authenticated and verified, but they lack sufficient permissions (role mismatch) for the requested resource. Re-authenticating with the same credentials will not grant access.

### Server-Side Role Enforcement

Role decisions are **never** trusted from client input or blindly copied from incoming token claims:
- If a client edits the payload of an issued token without the server's secret, signature verification fails (`401 Unauthorized`).
- In our test suite, we create a synthetic test fixture: a correctly signed token whose subject is user `1` (`user`), but whose payload claims `role: "admin"`. Even in this scenario, `authenticateToken` resolves the subject ID against the server-side in-memory array (`req.user = findUserById(sub)`).
- When `requireRole("admin")` runs, it checks the server record's role (`user`), not the token payload claim, returning `403 Forbidden`.

---

## Endpoints Overview

| Method | Endpoint | Access Requirement | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/public` | Public (No token) | Open informational status endpoint. |
| `POST` | `/api/auth/login` | Public (Credentials) | Authenticates credentials and issues signed JWT access token. |
| `GET` | `/api/profile` | Authenticated (`user` or `admin`) | Returns current caller's safe profile. |
| `GET` | `/api/admin/users` | Admin Only (`admin` role) | Returns safe listing of all registered demo accounts. |

---

## Demo Accounts

The server seeds two demo accounts into memory at startup:

| Username | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `user` | `UserPassword123` | `user` | Standard regular user account. |
| `admin` | `AdminPassword123` | `admin` | Administrator user account. |

- **Safe Startup Seeding**: Passwords are intentionally defined in the seed function and documentation for demonstration. During startup, `seedUsers()` hashes them using `bcryptjs` (cost factor 12); user records in memory store only `passwordHash`.
- **Login Verification**: During `POST /api/auth/login`, `bcrypt.compare()` compares the incoming password with the stored hash. Passwords are not re-hashed or modified on login.
- **Data Protection**: Neither passwords nor password hashes are ever returned in API responses or included in JWT payloads.

---

## Prerequisites & Installation

- **Node.js**: v18+ (tested on Node.js v22)
- **npm**: v9+

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Generate a secure secret**:
   Generate a random 32-byte hex secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Paste the generated string into `.env` as `JWT_SECRET`.

> **Security Warning**: Never commit your `.env` file or hardcode secrets into source code. `.env` is ignored by `.gitignore`.

---

## Running the Application

- **Start server**:
  ```bash
  npm start
  ```

- **Development mode (with auto-reload)**:
  ```bash
  npm run dev
  ```

- **Run automated test suite**:
  ```bash
  npm test
  ```

---

## Manual Testing via cURL

### 1. Public Endpoint (No Token Required)
```bash
curl -i http://localhost:3000/api/public
```
**Response (200 OK)**:
```json
{
  "message": "Public endpoint accessible without authentication."
}
```

---

### 2. Login as Regular User
```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"UserPassword123"}'
```
**Response (200 OK, `Cache-Control: no-store`)**:
```json
{
  "accessToken": "<ACCESS_TOKEN>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "1",
    "username": "user",
    "role": "user"
  }
}
```

Copy the returned `accessToken` string into a shell variable:
```bash
USER_TOKEN="<paste accessToken here>"
```

---

### 3. Login as Administrator
```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"AdminPassword123"}'
```

Copy the admin `accessToken` string into a shell variable:
```bash
ADMIN_TOKEN="<paste admin accessToken here>"
```

---

### 4. Access Protected Profile
```bash
curl -i http://localhost:3000/api/profile \
  -H "Authorization: Bearer $USER_TOKEN"
```
**Response (200 OK, `Cache-Control: no-store`)**:
```json
{
  "user": {
    "id": "1",
    "username": "user",
    "role": "user"
  }
}
```

*Calling without a token or with an invalid token returns `HTTP 401 Unauthorized` and header `WWW-Authenticate: Bearer`.*

---

### 5. Access Admin Users List with Regular User Token (403 Forbidden)
```bash
curl -i http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $USER_TOKEN"
```
**Response (403 Forbidden)**:
```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access this resource."
}
```

---

### 6. Access Admin Users List with Admin Token (200 OK)
```bash
curl -i http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Response (200 OK, `Cache-Control: no-store`)**:
```json
{
  "users": [
    { "id": "1", "username": "user", "role": "user" },
    { "id": "2", "username": "admin", "role": "admin" }
  ]
}
```

---

## Demo Limitations & Educational Scope

This application is designed specifically for classroom presentation and architectural demonstration:

1. **In-Memory Storage**: Demo accounts exist in an in-memory array in RAM. Any changes reset upon server process restart.
2. **Public Demo Credentials**: User passwords are public and intended only for testing.
3. **Username Enumeration**: Matching login error messages (`Invalid username or password`) mitigate obvious username enumeration, but do not completely eliminate subtle execution timing differences between missing accounts and bcrypt comparisons.
4. **Memory Management**: JavaScript strings are managed by the V8 garbage collector; the runtime does not guarantee immediate zeroing of string buffers in RAM.
5. **No Token Revocation / Logout**: JWT access tokens are stateless and remain valid until their 1-hour expiration; there is no token blacklist or refresh-token rotation mechanism.
6. **No Rate Limiting**: The server does not throttle brute-force login attempts.
7. **Plain HTTP**: In production, traffic must be encrypted over HTTPS to protect Bearer tokens from interception on the wire.
