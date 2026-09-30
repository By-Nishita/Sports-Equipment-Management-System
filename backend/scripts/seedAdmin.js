require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('../models');

const admins = [
  { name: 'Admin User', email: 'admin@vupune.ac.in', password: 'admin123', department: 'Sports' }
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for admin seeding...');

  for (const a of admins) {
    const hashedPassword = await bcrypt.hash(a.password, 10);

    await User.updateOne(
      { email: a.email },
      { $setOnInsert: { name: a.name, email: a.email, password: hashedPassword, department: a.department, role: 'admin' } },
      { upsert: true }
    );
  }

  console.log(`${admins.length} admin(s) seeded successfully`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Admin seeding failed:', err.message);
  process.exit(1);
});