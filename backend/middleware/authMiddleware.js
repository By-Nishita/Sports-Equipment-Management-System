// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

        // 1. Closed account: history stays in the database but the person cannot use the app
    if (user.isActive === false) {
      return res.status(401).json({ success: false, message: 'This account is deactivated' });
    }

    // 2. Password changed after this token was issued => this token is old, reject it.
    //    (jwt "iat" is in seconds, so we compare in seconds too)
    if (user.passwordChangedAt) {
      const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (changedAtSec > decoded.iat) {
        return res.status(401).json({ success: false, message: 'Password was changed. Please log in again.' });
      }
    }

    // 3. Must-change-password: until they change it, only these two routes work.
    //    This is the REAL lock. The frontend redirect is only for convenience.
    const ALLOWED_WHEN_LOCKED = ['/api/auth/me', '/api/auth/change-password'];
    if (user.mustChangePassword && !ALLOWED_WHEN_LOCKED.includes(req.baseUrl + req.path)) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your password before continuing'
      });
    }

    req.user = user;
    next();

  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// backend/middleware/authMiddleware.js mein hi add karo, protect ke neeche

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
    }
    next();
  };
};

module.exports = { protect, authorize };