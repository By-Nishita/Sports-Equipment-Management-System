const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  equipmentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  brand: { type: String },
  purchaseDate: { type: Date },
  price: { type: Number },
  location: { type: String },
  status: {
    type: String,
    enum: ['AVAILABLE', 'IN_USE', 'DAMAGED', 'MAINTENANCE', 'LOST', 'RETIRED'],
    default: 'AVAILABLE'
  },
  condition: {
    type: String,
    enum: ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'],
    default: 'GOOD'
  },
  qrIdentifier: { type: String, unique: true }
}, { timestamps: true });

module.exports = mongoose.model('Equipment', equipmentSchema);