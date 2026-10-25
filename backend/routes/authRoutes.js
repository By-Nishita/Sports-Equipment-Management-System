const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { User } = require('../models');
const { protect, authorize} = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const passwordService = require('../services/passwordService');
const auditService = require('../services/auditService');
const passwordResetService = require('../services/passwordResetService');
const emailService = require('../services/emailService');

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

// "Forgot password": 5 requests per hour per IP. set-password: 10 tries per 15 minutes.
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in an hour.' }
});
const setPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' }
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

// ---------- Forgot password / first-time password (link by email) ----------

// ALWAYS the same answer, whether the account exists or not. Otherwise anyone could
// type emails one by one and find out which ones are registered.
const FORGOT_REPLY = 'If an account exists, we have emailed a link to set your password. It works for 15 minutes.';

router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const { identifier, firstTime } = req.body || {};

  // Reply FIRST, work afterwards. This way the reply takes the same time for everyone,
  // so nobody can guess if an account exists by how fast the answer came.
  res.json({ success: true, message: FORGOT_REPLY });

  try {
    if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 100) return;
    const id = identifier.trim();

    // identifier can be the college email or the SRN
    const user = await User.findOne({ $or: [{ email: id.toLowerCase() }, { srn: id }] });
    if (!user || user.isActive === false) return;

    const token = await passwordResetService.createToken(user._id);
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/set-password?token=${token}`;
    const minutes = passwordResetService.TOKEN_MINUTES;

    await emailService.sendMail({
      to: user.email,
      subject: firstTime ? 'Set your Sports Room password' : 'Reset your Sports Room password',
      text: `Hello ${user.name},\n\nOpen this link to set your password (valid for ${minutes} minutes, works once):\n${link}\n\nIf you did not ask for this, ignore this email.`,
      html: `<p>Hello ${user.name},</p><p><a href="${link}">Set your password</a> (valid for ${minutes} minutes, works once).</p><p>If you did not ask for this, ignore this email.</p>`
    });

    await auditService.log({ action: 'PASSWORD_LINK_SENT', entityType: 'User', entityId: user._id });
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err.message);
  }
});

router.post('/set-password', setPasswordLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    // 1. Is the link valid (exists, unused, not expired)? We do not use it up yet.
    const record = await passwordResetService.findValid(token);
    const user = record ? await User.findById(record.userId) : null;
    if (!user || user.isActive === false) {
      return res.status(400).json({ success: false, message: 'This link is invalid or has expired. Please request a new one.' });
    }

    // 2. Check the rules BEFORE using the link up, so a too-short password does not waste the link
    const problem = passwordService.checkNewPassword(newPassword, user);
    if (problem) {
      return res.status(400).json({ success: false, message: problem });
    }

    // 3. Use the link up. If somebody else used it a moment ago, we get nothing back.
    const used = await passwordResetService.markUsed(record);
    if (!used) {
      return res.status(400).json({ success: false, message: 'This link has already been used. Please request a new one.' });
    }

    // 4. Save the password. passwordChangedAt logs out every older session/token.
    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    await auditService.log({ actor: user._id, action: 'PASSWORD_SET_BY_LINK', entityType: 'User', entityId: user._id });

    res.json({ success: true, message: 'Password saved. You can now sign in.' });
  } catch (err) {
    console.error('SET PASSWORD ERROR:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
