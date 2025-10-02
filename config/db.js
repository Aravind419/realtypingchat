const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://Aravind:Aravind%402041@cluster0.ykz5b.mongodb.net/chatapp';
const client = new MongoClient(uri);

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('chatapp');
    console.log('Connected to MongoDB');
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