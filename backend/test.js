require('dotenv').config();
const mongoose = require('mongoose');
const { User, Equipment } = require('./models');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const user = await User.create({ name: 'Test User', email: 'test@test.com', password: '123456' });
    const eq = await Equipment.create({ equipmentId: 'FB-001', name: 'Football', category: 'Football' });
    console.log('Saved:', user, eq);
    mongoose.disconnect();
  })
  .catch(err => console.error(err));