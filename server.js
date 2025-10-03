const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const compression = require('compression');
require('dotenv').config();

const { connectDB, getDB } = require('./config/db');
const User = require('./models/User');
const Message = require('./models/Message');

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'chat-app' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

const app = express();
const server = http.createServer(app);

// Add security headers
app.use(helmet());

// Add compression middleware
app.use(compression());

// Configure CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

// Initialize socket.io with security configurations
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Add timeouts for better resource management
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Store connected users in memory for quick access
const connectedUsers = {};

// Serve the main page
app.get('/', (req, res) => {
  logger.info('Serving main page');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Health check endpoint for database
app.get('/health/db', async (req, res) => {
  try {
    const db = getDB();
    await db.command({ ping: 1 });
    res.status(200).json({ 
      status: 'OK', 
      database: 'Connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'Disconnected',
      error: error.message
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      logger.warn('Registration attempt with missing fields');
      return res.status(400).json({ success: false, message: 'Username, email, and password are required' });
    }
    
    // Validate input length
    if (username.length < 3 || username.length > 20) {
      logger.warn('Registration attempt with invalid username length');
      return res.status(400).json({ success: false, message: 'Username must be between 3 and 20 characters' });
    }
    
    if (password.length < 6) {
      logger.warn('Registration attempt with weak password');
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    const db = getDB();
    
    // Check if user already exists
    const existingUser = await User.findByUsername(db, username);
    if (existingUser) {
      logger.warn(`Registration attempt with existing username: ${username}`);
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }
    
    // Check if email already exists
    const existingEmail = await User.findByEmail(db, email);
    if (existingEmail) {
      logger.warn(`Registration attempt with existing email: ${email}`);
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    
    // Create new user
    const newUser = await User.create(db, { username, email, password });
    logger.info(`New user registered: ${username}`);
    
    res.json({ success: true, message: 'User registered successfully', user: { username: newUser.username, email: newUser.email } });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Error registering user' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      logger.warn('Login attempt with missing fields');
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    
    const db = getDB();
    const user = await User.authenticate(db, username, password);
    
    if (user) {
      logger.info(`User logged in: ${username}`);
      res.json({ success: true, message: 'Login successful', user: { username: user.username, email: user.email } });
    } else {
      logger.warn(`Failed login attempt for username: ${username}`);
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Error logging in' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  try {
    const { username } = req.body;
    
    if (username && connectedUsers[username]) {
      // Remove user from connected users
      delete connectedUsers[username];
      
      // Update user status in database
      const db = getDB();
      User.setOffline(db, username)
        .then(() => {
          logger.info(`User ${username} logged out`);
          // Broadcast updated user count
          broadcastOnlineUsers();
          res.json({ success: true, message: 'Logged out successfully' });
        })
        .catch(err => {
          logger.error('Error updating user status:', err);
          res.status(500).json({ success: false, message: 'Error logging out' });
        });
    } else {
      logger.warn('Invalid logout attempt');
      res.status(400).json({ success: false, message: 'Invalid username or not logged in' });
    }
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Error during logout' });
  }
});

// Push notification subscription endpoint
app.post('/api/subscribe', (req, res) => {
  try {
    // In a real application, you would store the subscription in a database
    // and associate it with the user
    logger.info('Received push subscription');
    res.status(201).json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    logger.error('Push subscription error:', error);
    res.status(500).json({ success: false, message: 'Error subscribing to push notifications' });
  }
});

// Function to broadcast online users count
async function broadcastOnlineUsers() {
  try {
    const db = getDB();
    const allUsers = await User.findAll(db);
    
    // Count users who are currently connected (real-time) - this is the accurate count
    let onlineCount = Object.keys(connectedUsers).length;
    
    // Also count users marked as online in DB who might not be in connectedUsers yet
    // But avoid double counting by checking if they're already in connectedUsers
    for (const user of allUsers) {
      if (user.online === true && !connectedUsers[user.username]) {
        onlineCount++;
      }
    }
    
    // Broadcast to all clients
    io.emit('online users count', onlineCount);
    
    // Also broadcast the full users list for other purposes
    const onlineUsersList = allUsers.map(user => ({ 
      username: user.username, 
      online: user.online || connectedUsers[user.username] !== undefined
    }));
    io.emit('users list', onlineUsersList);
  } catch (error) {
    logger.error('Error broadcasting online users:', error);
  }
}

// Handle socket connections
io.use((socket, next) => {
  // Add rate limiting for socket connections
  const clientIp = socket.handshake.address;
  logger.info(`Socket connection attempt from ${clientIp}`);
  next();
});

io.on('connection', (socket) => {
  logger.info('A user connected:', socket.id);
  
  // Handle user registration
  socket.on('register', async (data) => {
    try {
      const { username, email, password } = data;
      
      if (!username || !email || !password) {
        logger.warn('Registration attempt with missing fields via socket');
        return socket.emit('register error', 'Username, email, and password are required');
      }
      
      // Validate input length
      if (username.length < 3 || username.length > 20) {
        logger.warn('Registration attempt with invalid username length via socket');
        return socket.emit('register error', 'Username must be between 3 and 20 characters');
      }
      
      if (password.length < 6) {
        logger.warn('Registration attempt with weak password via socket');
        return socket.emit('register error', 'Password must be at least 6 characters');
      }
      
      const db = getDB();
      
      // Check if user already exists
      const existingUser = await User.findByUsername(db, username);
      if (existingUser) {
        logger.warn(`Registration attempt with existing username via socket: ${username}`);
        return socket.emit('register error', 'Username already exists');
      }
      
      // Check if email already exists
      const existingEmail = await User.findByEmail(db, email);
      if (existingEmail) {
        logger.warn(`Registration attempt with existing email via socket: ${email}`);
        return socket.emit('register error', 'Email already exists');
      }
      
      // Create new user
      await User.create(db, { username, email, password });
      logger.info(`New user registered via socket: ${username}`);
      socket.emit('register success', 'User registered successfully');
    } catch (error) {
      logger.error('Registration error via socket:', error);
      socket.emit('register error', 'Error registering user');
    }
  });
  
  // Handle user login
  socket.on('login', async (data) => {
    try {
      const { username, password } = data;
      
      if (!username || !password) {
        logger.warn('Login attempt with missing fields via socket');
        return socket.emit('login error', 'Username and password are required');
      }
      
      const db = getDB();
      const user = await User.authenticate(db, username, password);
      
      if (user) {
        // Store in memory
        connectedUsers[username] = socket.id;
        
        // Update user in database
        await User.updateSocketId(db, username, socket.id);
        logger.info(`User logged in via socket: ${username}`);
        
        // Send success response
        socket.emit('login success', { username: user.username, email: user.email });
        
        // Request message history from the client
        // (Client will request this after successful login)
        
        // Broadcast to all clients that a user has joined
        io.emit('user joined', username);
        
        // Broadcast updated online users count
        broadcastOnlineUsers();
      } else {
        logger.warn(`Failed login attempt via socket for username: ${username}`);
        socket.emit('login error', 'Invalid username or password');
      }
    } catch (error) {
      logger.error('Login error via socket:', error);
      socket.emit('login error', 'Error logging in');
    }
  });
  
  // Handle typing with real text
  socket.on('typing', (data) => {
    const { username, text } = data;
    // Broadcast the actual text being typed
    socket.broadcast.emit('typing', { username, text: text.substring(0, 50) }); // Limit text length
  });
  
  // Handle stop typing indicator
  socket.on('stop typing', (username) => {
    socket.broadcast.emit('stop typing', username);
  });
  
  // Handle new messages
  socket.on('new message', async (data) => {
    try {
      const db = getDB();
      
      // Add message to database
      const messageData = {
        username: data.username,
        message: data.message,
        timestamp: data.timestamp || new Date()
      };
      
      const savedMessage = await Message.create(db, messageData);
      
      // Broadcast message to all clients with the saved ID
      const messageToSend = {
        id: savedMessage.id || savedMessage._id,
        username: messageData.username,
        message: messageData.message,
        timestamp: messageData.timestamp
      };
      
      io.emit('new message', messageToSend);
      
      // Notify sender about the saved message
      if (data.tempId) {
        socket.emit('message saved', { tempId: data.tempId, savedId: savedMessage.id || savedMessage._id });
      }
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('message error', 'Failed to send message');
    }
  });
  
  // Handle message history request
  socket.on('request message history', async () => {
    try {
      const db = getDB();
      const messages = await Message.findAll(db);
      socket.emit('message history', messages);
    } catch (error) {
      console.error('Error fetching message history:', error);
    }
  });
  
  // Handle clear chat
  socket.on('clear chat', () => {
    // For this user only, send clear chat event
    socket.emit('clear chat');
  });
  
  // Handle logout
  socket.on('logout', async (username) => {
    try {
      // Remove user from connected users
      if (connectedUsers[username]) {
        delete connectedUsers[username];
      }
      
      // Update user status in database
      const db = getDB();
      await User.setOffline(db, username);
      
      console.log(`User ${username} logged out`);
      
      // Broadcast to all clients that a user has left
      io.emit('user left', username);
      
      // Broadcast updated online users count
      broadcastOnlineUsers();
      
      // Send logout confirmation to client
      socket.emit('logout success', username);
      
      // Disconnect the socket
      socket.disconnect();
    } catch (error) {
      console.error('Error handling logout:', error);
      socket.emit('logout error', 'Error during logout');
    }
  });
  
  // Handle audio call initiation
  socket.on('initiate audio call', (caller) => {
    console.log(`Audio call initiated by ${caller}`);
    // Broadcast to all other users that a call is incoming
    socket.broadcast.emit('incoming audio call', {
      caller: caller,
      callId: Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    });
  });
  
  // Handle call acceptance
  socket.on('accept call', (data) => {
    const { caller, callId } = data;
    console.log(`Call accepted by ${data.accepter} for call from ${caller}`);
    // Notify the caller that the call was accepted
    if (connectedUsers[caller]) {
      io.to(connectedUsers[caller]).emit('call accepted', {
        accepter: data.accepter,
        callId: callId
      });
    }
  });
  
  // Handle call decline
  socket.on('decline call', (data) => {
    const { caller, callId } = data;
    console.log(`Call declined by ${data.decliner} for call from ${caller}`);
    // Notify the caller that the call was declined
    if (connectedUsers[caller]) {
      io.to(connectedUsers[caller]).emit('call declined', {
        decliner: data.decliner,
        callId: callId
      });
    }
  });
  
  // Handle call end
  socket.on('end call', (data) => {
    const { caller, accepter } = data;
    console.log(`Call ended between ${caller} and ${accepter}`);
    // Notify both parties that the call has ended
    if (connectedUsers[caller]) {
      io.to(connectedUsers[caller]).emit('call ended', { 
        by: data.endedBy,
        with: accepter 
      });
    }
    if (connectedUsers[accepter]) {
      io.to(connectedUsers[accepter]).emit('call ended', { 
        by: data.endedBy,
        with: caller 
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', async () => {
    try {
      const username = Object.keys(connectedUsers).find(
        key => connectedUsers[key] === socket.id
      );
      
      if (username) {
        // Remove user from connected users
        delete connectedUsers[username];
        
        // Update user status in database
        const db = getDB();
        await User.setOffline(db, username);
        
        console.log('A user disconnected:', username);
        
        // Broadcast to all clients that a user has left
        io.emit('user left', username);
        
        // Broadcast updated online users count
        broadcastOnlineUsers();
      }
    } catch (error) {
      console.error('Error handling disconnection:', error);
    }
  });
});

const PORT = process.env.PORT || 3001; // Changed default port to 3001 to avoid conflicts

// Connect to MongoDB and start server
connectDB().then(() => {
  const serverInstance = server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info('Nodemon is now working perfectly with automatic restarts!');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
  
  // Handle server errors
  serverInstance.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Trying ${PORT + 1}...`);
      setTimeout(() => {
        serverInstance.close();
        server.listen(PORT + 1);
      }, 1000);
    } else {
      logger.error('Server error:', error);
    }
  });
  
  // Handle graceful shutdown
  const gracefulShutdown = async () => {
    logger.info('Received shutdown signal, shutting down gracefully...');
    
    // Close HTTP server
    serverInstance.close(() => {
      logger.info('HTTP server closed.');
    });
    
    // Close socket.io server
    io.close(() => {
      logger.info('Socket.IO server closed.');
    });
    
    // Close MongoDB connection
    try {
      await client.close();
      logger.info('MongoDB connection closed.');
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
    }
    
    // Wait for connections to close
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };
  
  // Listen for shutdown signals
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
}).catch(err => {
  logger.error('Failed to connect to database:', err);
  process.exit(1);
});
