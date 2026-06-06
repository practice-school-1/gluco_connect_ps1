const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the URI from environment variables.
 * Called once at application startup before the server begins listening.
 */
async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = connectDB;
