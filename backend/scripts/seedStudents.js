require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { User } = require('../models');

// students.json ko backend/scripts/ folder mein rakho
const students = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'students.json'), 'utf-8')
);

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for seeding...');

  let count = 0;
  for (const s of students) {
    const hashedPassword = await bcrypt.hash(String(s.srn), 10);

    await User.updateOne(
      { srn: s.srn },
      {
        $setOnInsert: {
          name: s.name,
          email: s.email,
          password: hashedPassword,
          srn: s.srn,
          department: s.department,
          program: s.program,
          division: s.division,
          year: s.year,
          role: 'student',
          mustChangePassword: true
        }
      },
      { upsert: true }
    );
    count++;
  }

  console.log(`${count} students seeded successfully`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
