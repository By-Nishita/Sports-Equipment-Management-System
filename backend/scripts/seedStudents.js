require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('../models');

const students = [
  { name: 'Test Student One', srn: '31241190', department: 'CS' },
  { name: 'Test Student Two', srn: '31241191', department: 'CS' }
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for seeding...');

  for (const s of students) {
    const email = `${s.srn}@vupune.ac.in`;
    const hashedPassword = await bcrypt.hash(String(s.srn), 10);

    await User.updateOne(
      { srn: s.srn },
      { $setOnInsert: { name: s.name, email, password: hashedPassword, srn: s.srn, department: s.department, role: 'student' } },
      { upsert: true }
    );
  }

  console.log(`${students.length} students seeded successfully`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});