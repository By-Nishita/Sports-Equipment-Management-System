const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const auditService = require('../services/auditService');

// Admin: list/search users (20 per page). The password hash is never sent.
const listUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 20;

    const filter = {};
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      // escape special characters so the search text is treated as plain text
      const text = req.query.search.trim().slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(text, 'i');
      filter.$or = [{ name: rx }, { srn: rx }, { email: rx }];
    }
    if (['student', 'staff', 'admin'].includes(req.query.role)) filter.role = req.query.role;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name srn email role department division year isActive mustChangePassword')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    res.json({ success: true, users, page, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Letters and digits that are easy to read aloud (no 0/O, 1/l/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const randomPassword = (length = 10) =>
  Array.from({ length }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

// Counter fallback: the email did not come, the admin checks the student's ID card
// and creates a temporary password. The student must change it at first login.
const issueTempPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Admin passwords are reset with the server script, not here' });
    }

    const tempPassword = randomPassword();
    user.password = await bcrypt.hash(tempPassword, 10);
    user.mustChangePassword = true;
    user.passwordChangedAt = new Date(); // logs the student out everywhere
    await user.save();

    // The audit row says WHO did it and for WHOM. The password itself is never logged.
    await auditService.log({
      actor: req.user._id,
      action: 'TEMP_PASSWORD_ISSUED',
      entityType: 'User',
      entityId: user._id,
      meta: { srn: user.srn, email: user.email }
    });

    // Shown once to the admin. It is not stored anywhere in readable form.
    res.json({ success: true, message: 'Temporary password created', tempPassword });
  } catch (err) {
    console.error('issueTempPassword error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listUsers, issueTempPassword };
