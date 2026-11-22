import express from 'express';
import crypto from 'node:crypto';
import { db, getISTTimestamp, createPasswordHash, generateSalt } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.AUTH_SECRET || 'waffelden_auth_secret_key_2026';

// Token generation helper (Node native HMAC token)
export function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

// Token verification helper
export function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
}

// Register new user account
router.post('/register', (req, res) => {
  try {
    const { username, password, name, email = '', shop_name = 'Waffel Den', role = 'owner' } = req.body;

    if (!username || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long' });
    }
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid display name' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email ? email.trim().toLowerCase() : null;

    // Check if user exists
    const existing = cleanEmail
      ? db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(cleanUsername, cleanEmail)
      : db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(400).json({ error: 'Username or email already in use. Please sign in or choose another.' });
    }

    const salt = generateSalt();
    const hash = createPasswordHash(password, salt);
    const { iso } = getISTTimestamp();

    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, salt, name, role, shop_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cleanUsername, cleanEmail, hash, salt, name.trim(), role, shop_name.trim() || 'Waffel Den', iso);

    const userId = result.lastInsertRowid;

    // Seed default settings for this user
    try {
      const setStmt = db.prepare('INSERT OR REPLACE INTO user_settings (user_id, key, value) VALUES (?, ?, ?)');
      setStmt.run(userId, 'shop_name', shop_name.trim() || 'Waffel Den');
      setStmt.run(userId, 'tax_enabled', '0');
      setStmt.run(userId, 'tax_rate', '5');
      setStmt.run(userId, 'currency_symbol', '₹');
    } catch (setErr) {
      console.warn('User settings init notice:', setErr.message);
    }

    const userObj = {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      name: name.trim(),
      role,
      shop_name: shop_name.trim() || 'Waffel Den'
    };

    const token = createToken({ userId, username: cleanUsername });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: userObj,
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(cleanUsername, cleanUsername);

    if (!user) {
      return res.status(401).json({ error: 'Account not found. Please register or verify username.' });
    }

    const computedHash = createPasswordHash(password, user.salt);
    if (computedHash !== user.password_hash) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const userObj = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      shop_name: user.shop_name
    };

    const token = createToken({ userId: user.id, username: user.username });

    res.json({
      success: true,
      message: 'Logged in successfully',
      user: userObj,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get current user profile
router.get('/me', (req, res) => {
  try {
    let userId = req.userId;
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const decoded = verifyToken(authHeader.slice(7));
        if (decoded) userId = decoded.userId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = db.prepare('SELECT id, username, email, name, role, shop_name, created_at FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List users for quick account switching
router.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, name, role, shop_name FROM users ORDER BY id ASC').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
