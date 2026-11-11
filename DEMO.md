# Live School Demonstration Guide

This guide contains everything you need to run, demonstrate, and explain this Node.js application server during your presentation.

---

## A. Startup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
If `.env` does not exist yet, create it from the example:
```bash
cp .env.example .env
```
Generate a fresh 32-byte hexadecimal signing secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Open `.env` and replace `replace_with_a_random_secret` with the generated value.

### 3. Run Automated Tests
```bash
npm test
```
*Expected: 33 tests passing with 0 failures.*

### 4. Start the Application Server
```bash
npm start
```
*Expected output: `Server listening on http://localhost:3000`*

---

## B. Manual Demonstration Walkthrough

Open a second terminal window to run these curl commands in order:

### 1. Public Endpoint (No Token)
```bash
curl -i http://localhost:3000/api/public
```
- **Expected Status**: `HTTP/1.1 200 OK`
- **Output**:
  ```json
  {"message":"Public endpoint accessible without authentication."}
  ```

---

### 2. Protected Profile Without Token
```bash
curl -i http://localhost:3000/api/profile
```
- **Expected Status**: `HTTP/1.1 401 Unauthorized`
- **Header**: `WWW-Authenticate: Bearer`
- **Output**:
  ```json
  {"error":"Unauthorized","message":"A valid access token is required."}
  ```

---

### 3. Log In as the Regular User
```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"UserPassword123"}'
```
- **Expected Status**: `HTTP/1.1 200 OK`
- **Output**: Returns JSON containing `"accessToken": "eyJhbGci..."`.

---

### 4. Save the User Token into a Shell Variable
Copy the value between the quotes in `"accessToken": "..."` and run:
```bash
USER_TOKEN="<paste your user accessToken here>"
```

---

### 5. Call the Profile Endpoint with USER_TOKEN
```bash
curl -i http://localhost:3000/api/profile \
  -H "Authorization: Bearer $USER_TOKEN"
```
- **Expected Status**: `HTTP/1.1 200 OK`
- **Output**:
  ```json
  {"user":{"id":"1","username":"user","role":"user"}}
  ```

---

### 6. Call the Admin Endpoint with USER_TOKEN (403 Forbidden)
```bash
curl -i http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $USER_TOKEN"
```
- **Expected Status**: `HTTP/1.1 403 Forbidden`
- **Output**:
  ```json
  {"error":"Forbidden","message":"You do not have permission to access this resource."}
  ```

---

### 7. Log In as Administrator
```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"AdminPassword123"}'
```
- **Expected Status**: `HTTP/1.1 200 OK`

Copy the returned admin `"accessToken"` and save it:
```bash
ADMIN_TOKEN="<paste your admin accessToken here>"
```

---

### 8. Call the Admin Endpoint with ADMIN_TOKEN (200 OK)
```bash
curl -i http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
- **Expected Status**: `HTTP/1.1 200 OK`
- **Output**:
  ```json
  {"users":[{"id":"1","username":"user","role":"user"},{"id":"2","username":"admin","role":"admin"}]}
  ```

---

## C. Short Presentation Speech (60–90 Seconds)

> "Hello everyone. Today I am presenting our Node.js and Express application server.
>
> An **API endpoint** is a specific URL that clients call to exchange data with the server.
> Our server provides two types of endpoints:
> - **Public endpoints**, like `/api/public`, which anyone can visit without credentials.
> - **Protected endpoints**, which require identity verification before granting access.
>
> When a user logs in at `/api/auth/login`, our server verifies their password against a salted `bcrypt` hash. If valid, the server signs a **JSON Web Token (JWT)** using the `HS256` algorithm and returns it as a Bearer access token.
>
> In our architecture, we make a clear distinction between **Authentication** and **Authorization**:
> - **Authentication** answers *'Who are you?'* Our `authenticateToken` middleware verifies the cryptographic signature, expiration, issuer, and audience of the token. If anything is invalid or missing, it responds with **HTTP 401 Unauthorized**.
> - **Authorization** answers *'What are you allowed to do?'* Our `requireRole` middleware checks the caller's server-side role. When a regular user tries to access `/api/admin/users`, their identity is confirmed, but their role is `user`. Because they lack the `admin` role, the server responds with **HTTP 403 Forbidden**.
>
> Finally, security: passwords are never stored in plaintext—only as salted hashes—and passwords or hashes are never exposed in responses. The JWT signing secret is kept in an environment variable, not in the source code, preventing attackers from forging valid tokens.
>
> Thank you! I can now take any questions."

---

## D. Request Flow Diagrams

### 1. Public Endpoint Flow (`GET /api/public`)
```text
Client Request
      │
      ▼
[ express.json() ]
      │
      ▼
[ publicRouter: GET /api/public ] ──► HTTP 200 OK (Public Message)
```

### 2. Login Flow (`POST /api/auth/login`)
```text
Client Request with { username, password }
      │
      ▼
[ Input Validation ] ──(invalid / unexpected fields)──► HTTP 400 Bad Request
      │
      ▼
[ bcrypt.compare(password, user.passwordHash) ]
      ├── (User not found or password mismatch) ──► HTTP 401 Unauthorized
      └── (Valid match)
                │
                ▼
        [ jwt.sign({ sub, username, role }, secret) ]
                │
                ▼
          HTTP 200 OK { accessToken, tokenType: "Bearer", user }
```

### 3. Protected Profile Flow (`GET /api/profile`)
```text
Client Request with Authorization: Bearer <token>
      │
      ▼
[ authenticateToken ]
      ├── (Missing, malformed, expired, tampered, wrong secret) ──► HTTP 401 Unauthorized
      └── (Valid signature & user found in server store)
                │
                ▼
      [ profileRouter: GET /api/profile ] ──► HTTP 200 OK { user }
```

### 4. Admin Endpoint Flow (`GET /api/admin/users`)
```text
Client Request with Authorization: Bearer <token>
      │
      ▼
[ authenticateToken ] ──(invalid token)──► HTTP 401 Unauthorized
      │
      ▼ (Valid token; user record resolved)
[ requireRole("admin") ]
      ├── (User role is 'user')  ──► HTTP 403 Forbidden
      └── (User role is 'admin') ──► [ adminRouter: GET /api/admin/users ] ──► HTTP 200 OK { users }
```

---

## E. Scope and Limitations

This project is an educational demonstration designed specifically to fulfill classroom requirements:
- **In-Memory Storage**: Demo accounts exist in an in-memory JavaScript array; data resets when the server process stops.
- **Demo Credentials**: Pre-seeded usernames and passwords are intentionally public for testing purposes.
- **Stateless Tokens**: Issued access tokens remain valid for 1 hour; there is no token revocation, blacklist, or logout endpoint.
- **Local HTTP**: The demo runs on standard HTTP locally; production systems require HTTPS (TLS) to encrypt tokens over the network.
- **No Extra Layers**: No external database, Docker container, frontend UI, or registration endpoint is required by the assignment scope.
