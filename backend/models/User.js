const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  srn: { type: String, unique: true, sparse: true },
  department: { type: String },
  program: { type: String },          // <-- naya field, mam ke requirement ke liye
  division: { type: String },
  year: { type: String },
  role: { type: String, enum: ['student', 'staff', 'admin'], default: 'student' },
  mustChangePassword: { type: Boolean, default: false },
  phone: { type: String },
  photoUrl: { type: String },
  isActive: { type: Boolean, default: true },   // false = account closed, login blocked, history kept
  passwordChangedAt: { type: Date }              // tokens issued before this moment stop working
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
