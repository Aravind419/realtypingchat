# Real-time Chat Application

A full-featured real-time chat application built with React, Node.js, Socket.IO, and MongoDB.

## Features

- Real-time messaging with Socket.IO
- Typing indicators showing what other users are typing
- Messages stored in MongoDB with usernames and timestamps
- Online user tracking
- PWA support for native app experience
- Auto-connect feature
- Offline message sending with automatic sync
- Service workers for caching
- Messages expire after 24 hours
- Web Push API for notifications

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or remote instance)
- npm or yarn

## Installation

1. Clone the repository
2. Install server dependencies:
   ```bash
   cd server
   npm install
   ```
3. Install client dependencies:
   ```bash
   cd client
   npm install
   ```

## Running the Application

### Development Mode

To run both server and client in development mode:
```bash
npm run dev
```

To run only the server:
```bash
npm run server
```

To run only the client:
```bash
npm run client
```

### Production Mode

1. Build the client:
   ```bash
   cd client
   npm run build
   ```

2. Start the server:
   ```bash
   cd server
   npm start
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
MONGODB_URI=mongodb://localhost:27017/chatapp
PORT=5000
```

## Technologies Used

- **Frontend**: React, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO
- **Database**: MongoDB
- **PWA**: Service Workers, Web App Manifest
- **Real-time Communication**: Socket.IO
- **Offline Support**: Service Workers, Local Storage

## Architecture

The application follows a client-server architecture:

1. **Client**: React application with PWA support
2. **Server**: Node.js server with Socket.IO for real-time communication
3. **Database**: MongoDB for persistent message storage

## Features Explained

### Real-time Messaging
Messages are sent and received instantly using Socket.IO websockets.

### Typing Indicators
Shows when other users are typing in real-time.

### Message Persistence
All messages are stored in MongoDB and retrieved when users join.

### Online User Tracking
Shows who is currently online in the chat.

### PWA Support
The application can be installed on mobile devices and works offline.

### Auto-connect
Automatically reconnects when network connectivity is restored.

### Offline Messaging
Messages sent while offline are stored and sent when connection is restored.

### Message Expiration
Messages older than 24 hours are automatically deleted.

### Push Notifications
Web Push API integration for notifications (when implemented).

## API Endpoints

The server provides the following Socket.IO events:

- `join`: User joins the chat
- `send message`: Send a message to all users
- `receive message`: Receive a message from another user
- `typing`: Indicate typing status
- `user typing`: Receive typing status from another user
- `users updated`: Receive updated list of online users

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

This project is licensed under the MIT License.