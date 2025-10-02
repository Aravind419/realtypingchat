const { MongoClient } = require('mongodb');
const User = require('../models/User');
const Message = require('../models/Message');

// Use environment variable with fallback to default
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db(process.env.MONGODB_DB_NAME || 'chatapp');
    console.log('Connected to MongoDB');
    
    // Create indexes for better performance
    await User.createIndexes(db);
    await Message.createIndexes(db);
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not connected!');
  }
  return db;
}

module.exports = { connectDB, getDB, client };