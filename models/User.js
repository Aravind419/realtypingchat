const bcrypt = require('bcryptjs');

class User {
  constructor(username, email, password, socketId, online = true) {
    this.username = username;
    this.email = email;
    this.password = password;
    this.socketId = socketId;
    this.online = online;
    this.lastSeen = new Date();
  }

  static collection(db) {
    return db.collection('users');
  }

  static async create(db, userData) {
    // Hash password before storing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
    
    const user = new User(
      userData.username, 
      userData.email,
      hashedPassword,
      userData.socketId
    );
    
    const result = await this.collection(db).insertOne({
      ...user,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { ...user, _id: result.insertedId };
  }

  static async findByUsername(db, username) {
    return await this.collection(db).findOne({ username });
  }

  static async findByEmail(db, email) {
    return await this.collection(db).findOne({ email });
  }

  static async updateSocketId(db, username, socketId) {
    return await this.collection(db).updateOne(
      { username },
      { 
        $set: { 
          socketId, 
          online: true, 
          lastSeen: new Date(),
          updatedAt: new Date()
        }
      }
    );
  }

  static async setOffline(db, username) {
    return await this.collection(db).updateOne(
      { username },
      { 
        $set: { 
          online: false, 
          lastSeen: new Date(),
          updatedAt: new Date()
        }
      }
    );
  }

  static async findAll(db) {
    return await this.collection(db).find({}).toArray();
  }

  static async authenticate(db, username, password) {
    const user = await this.findByUsername(db, username);
    if (user && await bcrypt.compare(password, user.password)) {
      return user;
    }
    return null;
  }
}

module.exports = User;