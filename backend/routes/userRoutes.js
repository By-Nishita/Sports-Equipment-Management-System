const express = require('express');
const { listUsers, issueTempPassword } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, authorize('admin'), listUsers);
router.post('/:id/temp-password', protect, authorize('admin'), issueTempPassword);

module.exports = router;
