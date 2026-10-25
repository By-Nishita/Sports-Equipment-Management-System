const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { User } = require('../models');
const { protect, authorize} = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const passwordService = require('../services/passwordService');
const auditService = require('../services/auditService');

// Only FAILED logins count (skipSuccessfulRequests), so a real student is never blocked.
// 10 wrong tries in 15 minutes from one IP => wait.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many failed attempts. Please try again in 15 minutes.' }
});

// One place that creates the login token (used by login and change-password)
const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// The user info the frontend keeps in localStorage
const publicUser = (u) => ({
  id: u._id, name: u.name, email: u.email, srn: u.srn, role: u.role, mustChangePassword: u.mustChangePassword
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Must be plain text. Without this check someone could send {"$ne": null} as the email
    // and trick the database query (NoSQL injection).
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'This account is deactivated. Please contact the sports room.' });
    }

    res.json({ success: true, token: signToken(user), user: publicUser(user) });

  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    user: publicUser(req.user)
  });
});

router.post('/change-password', protect, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ success: false, message: 'Old and new password are required' });
    }

    // 1. Is the old password really theirs? (protects a phone someone left unlocked)
    const isMatch = await bcrypt.compare(oldPassword, req.user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect' });
    }

    // 2. Rules for the new password
    const problem = passwordService.checkNewPassword(newPassword, req.user);
    if (problem) {
      return res.status(400).json({ success: false, message: problem });
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password must be different from the old one' });
    }

    // 3. Save. passwordChangedAt kills every older token (e.g. a stolen one).
    req.user.password = await bcrypt.hash(newPassword, 10);
    req.user.mustChangePassword = false;
    req.user.passwordChangedAt = new Date();
    await req.user.save();

    await auditService.log({
      actor: req.user._id, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: req.user._id
    });

    // 4. Give a fresh token, because the one used for this request is now old
    res.json({
      success: true,
      message: 'Password updated successfully',
      token: signToken(req.user),
      user: publicUser(req.user)
    });

  } catch (err) {
    console.error('CHANGE PASSWORD ERROR:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
