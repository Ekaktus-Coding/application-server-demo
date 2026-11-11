const bcrypt = require('bcryptjs');

// Private in-memory user storage
let users = [];

/**
 * Seed demo users with securely hashed passwords.
 * Cost factor is explicitly set to 12.
 * Idempotent: Calling seedUsers() multiple times will not duplicate users.
 */
async function seedUsers() {
  if (users.length > 0) {
    return;
  }

  const saltRounds = 12;

  const userPasswordHash = await bcrypt.hash('UserPassword123', saltRounds);
  const adminPasswordHash = await bcrypt.hash('AdminPassword123', saltRounds);

  users = [
    {
      id: '1',
      username: 'user',
      role: 'user',
      passwordHash: userPasswordHash
    },
    {
      id: '2',
      username: 'admin',
      role: 'admin',
      passwordHash: adminPasswordHash
    }
  ];
}

/**
 * Strips passwordHash and returns only safe public user fields: { id, username, role }.
 */
function toSafeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

/**
 * Find user by username.
 * Returns internal user record including passwordHash for authentication checks.
 */
function findUserByUsername(username) {
  if (typeof username !== 'string') return null;
  return users.find((u) => u.username === username) || null;
}

/**
 * Find user by ID.
 * Returns safe user object without sensitive fields.
 */
function findUserById(id) {
  if (typeof id !== 'string') return null;
  const user = users.find((u) => u.id === id);
  return user ? toSafeUser(user) : null;
}

/**
 * Returns an array of all users with safe fields only.
 */
function listSafeUsers() {
  return users.map(toSafeUser);
}

module.exports = {
  seedUsers,
  findUserByUsername,
  findUserById,
  listSafeUsers,
  toSafeUser
};
