const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '..', 'client', 'public')));

// MongoDB connection
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/chatapp";
const client = new MongoClient(uri);

let db;
let messagesCollection;
let usersCollection;

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    db = client.db("chatapp");
    messagesCollection = db.collection("messages");
    usersCollection = db.collection("users");
    
    // Create indexes
    try {
      await messagesCollection.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 86400 }); // 24 hours
      await messagesCollection.createIndex({ "conversationId": 1 });
      await usersCollection.createIndex({ "username": 1 }, { unique: true });
    } catch (err) {
      console.log("Index creation error (may already exist):", err.message);
    }
    
    // Clean up old messages (older than 24 hours)
    await cleanupOldMessages();
    
    // Schedule cleanup every hour
    setInterval(cleanupOldMessages, 60 * 60 * 1000);
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
  }
}

async function cleanupOldMessages() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await messagesCollection.deleteMany({
      timestamp: { $lt: oneDayAgo }
    });
    console.log(`Cleaned up ${result.deletedCount} old messages`);
  } catch (err) {
    console.error("Error cleaning up old messages:", err);
  }
}

// Store connected users
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Handle user joining
  socket.on('join', async (userData) => {
    try {
      // Store user in database
      await usersCollection.updateOne(
        { username: userData.username },
        { $set: { 
            username: userData.username, 
            lastSeen: new Date(),
            socketId: socket.id
          } 
        },
        { upsert: true }
      );
      
      // Add to connected users
      connectedUsers.set(socket.id, {
        username: userData.username,
        joinedAt: new Date()
      });
      
      // Broadcast updated user list
      io.emit('users updated', Array.from(connectedUsers.values()).map(user => user.username));
      
      // Send existing messages to user
      const recentMessages = await messagesCollection.find({})
        .sort({ timestamp: 1 })
        .limit(100)
        .toArray();
      
      socket.emit('load messages', recentMessages);
      
      // Notify others that user is typing with actual text
      socket.on('typing', (data) => {
        socket.broadcast.emit('user typing', {
          username: data.username,
          isTyping: data.isTyping,
          text: data.text || ''
        });
      });
      
      // Handle message sending
      socket.on('send message', async (messageData) => {
        const message = {
          username: messageData.username,
          text: messageData.text,
          timestamp: new Date()
        };
        
        try {
          // Save message to database
          await messagesCollection.insertOne(message);
          
          // Broadcast message to all users
          io.emit('receive message', message);
        } catch (err) {
          console.error("Error saving message:", err);
        }
      });
      
      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        const user = connectedUsers.get(socket.id);
        
        if (user) {
          // Update last seen in database
          await usersCollection.updateOne(
            { username: user.username },
            { $set: { lastSeen: new Date() } }
          );
          
          // Remove from connected users
          connectedUsers.delete(socket.id);
          
          // Broadcast updated user list
          io.emit('users updated', Array.from(connectedUsers.values()).map(user => user.username));
        }
      });
    } catch (err) {
      console.error("Error in join handler:", err);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectToDatabase();
});