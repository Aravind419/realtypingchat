const { v4: uuidv4 } = require('uuid');

class Message {
  constructor(username, message) {
    this.id = uuidv4(); // Generate UUID for each message
    this.username = username;
    this.message = message;
    this.timestamp = new Date();
  }

  static collection(db) {
    return db.collection('messages');
  }

  // Create indexes for better query performance
  static async createIndexes(db) {
    try {
      await this.collection(db).createIndex({ username: 1 });
      await this.collection(db).createIndex({ timestamp: 1 });
      await this.collection(db).createIndex({ id: 1 });
      console.log('Message indexes created successfully');
    } catch (error) {
      console.error('Error creating message indexes:', error);
    }
  }

  static async create(db, messageData) {
    const message = new Message(messageData.username, messageData.message);
    const result = await this.collection(db).insertOne({
      ...message,
      createdAt: new Date()
    });
    return { ...message, _id: result.insertedId };
  }

  static async findAll(db) {
    return await this.collection(db).find({}).sort({ timestamp: 1 }).toArray();
  }

  static async findByUser(db, username) {
    return await this.collection(db).find({ username }).sort({ timestamp: 1 }).toArray();
  }

  static async findRecent(db, limit = 100) {
    return await this.collection(db)
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }
}

module.exports = Message;