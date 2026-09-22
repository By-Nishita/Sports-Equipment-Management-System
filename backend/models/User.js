const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  srn: { type: String, unique: true, sparse: true },
  department: { type: String },
  role: { type: String, enum: ['student', 'staff', 'admin'], default: 'student' },
  mustChangePassword: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);