require('dotenv').config();
const mongoose = require('mongoose');
const Food = require('../models/Food');
const seedData = require('../data/indianFoodsSeed.json');

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // 1. Connect to MongoDB
    // Make sure MONGO_URI is set in your .env
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/glucoconnect';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // 2. Upsert each food item
    // Using updateOne with upsert: true ensures we don't create duplicates
    // if the script is run multiple times. It updates existing records or inserts new ones.
    let upsertedCount = 0;
    
    for (const food of seedData) {
      const result = await Food.updateOne(
        { name: food.name }, // filter
        { $set: food },      // update
        { upsert: true }     // options
      );

      if (result.upsertedCount > 0) {
        upsertedCount++;
      }
    }

    console.log(`✅ Seeding complete. ${upsertedCount} new foods added. (Total checked: ${seedData.length})`);

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  } finally {
    // 3. Close the connection
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

seedDatabase();
