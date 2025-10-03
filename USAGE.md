# Chat Application Usage Guide

## Getting Started

### Prerequisites
1. Node.js (v14 or higher)
2. MongoDB (local or remote instance)
3. Modern web browser

### Installation
1. Clone or download the repository
2. Install dependencies:
   ```bash
   cd server
   npm install
   ```
3. Configure environment variables in `.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/chatapp
   PORT=5000
   ```

### Running the Application
1. Start MongoDB (if using local instance)
2. Start the server:
   ```bash
   cd server
   node server.js
   ```
3. Open your browser to `http://localhost:5000`

## Using the Chat Application

### Joining the Chat
1. Open the application in your browser
2. Enter your username in the login field
3. Click "Join Chat" or press Enter
4. You'll be redirected to the chat interface

### Sending Messages
1. Type your message in the input field at the bottom
2. Click "Send" or press Enter to send
3. Your message will appear in the chat history
4. All other connected users will see your message instantly

### Viewing Online Users
1. Click the "Online Users" button in the top right
2. A dropdown will show all currently connected users
3. The number next to the button indicates total online users

### Typing Indicators
1. When you type in the message field, other users will see "User is typing..."
2. The indicator automatically disappears when you stop typing or send the message
3. This helps provide real-time feedback during conversations

### Offline Support
1. If you lose internet connection, the app will show "You are offline"
2. Messages you send while offline are queued locally
3. When connection is restored, queued messages are automatically sent
4. The app automatically reconnects to the server

### Message Expiration
1. Messages are automatically deleted after 24 hours
2. This helps keep the database clean and respect user privacy
3. Old messages are removed through MongoDB's TTL index

## Features

### Real-time Messaging
- Instant message delivery to all connected users
- No page refresh required
- Smooth scrolling message history

### User Presence
- See who is currently online
- Real-time updates when users join or leave
- Last seen timestamps (stored in database)

### Typing Indicators
- See when other users are composing messages
- Real-time updates as users type
- Automatic timeout when typing stops

### Progressive Web App (PWA)
- Installable on mobile devices
- Works offline with cached assets
- Native app-like experience

### Auto-reconnect
- Automatic reconnection when network is restored
- Message queuing during offline periods
- Seamless user experience

## Technical Details

### Architecture
- Client-server model with WebSocket communication
- MongoDB for message persistence
- Socket.IO for real-time features

### Data Storage
- Messages stored with username and timestamp
- Online user tracking
- Automatic cleanup of old messages

### Security
- Input validation and sanitization
- CORS configuration for development
- No sensitive data stored in client

## Troubleshooting

### Common Issues

1. **Cannot connect to server**:
   - Ensure the server is running (`node server.js`)
   - Check that MongoDB is accessible
   - Verify the PORT in `.env` is available

2. **Messages not appearing**:
   - Check browser console for errors
   - Verify WebSocket connection status
   - Ensure MongoDB is properly configured

3. **Offline functionality not working**:
   - Check that service worker is registered
   - Verify browser supports service workers
   - Check browser developer tools for errors

4. **Users not showing as online**:
   - Refresh the page to resync user list
   - Check server logs for connection errors
   - Verify Socket.IO connection

### Browser Compatibility
- Modern browsers with WebSocket support
- Service workers required for offline functionality
- Tested on Chrome, Firefox, Safari, Edge

## Customization

### Styling
- Modify `client/public/style.css` for UI changes
- Adjust colors, fonts, and layout as needed
- Responsive design for mobile devices

### Functionality
- Extend `server/server.js` for additional features
- Modify client-side JavaScript for new UI elements
- Add new Socket.IO events for custom functionality

## Limitations

### Current Version
- Single chat room (no private messaging)
- No user authentication
- Basic message formatting
- No file sharing
- No message editing or deletion

### Planned Enhancements
- User authentication and registration
- Private messaging
- File and image sharing
- Message reactions
- Chat room management
- Push notifications
- Message search
- User profiles

## Support

For issues, questions, or contributions:
1. Check the README.md for documentation
2. Review server logs for error messages
3. Submit issues to the project repository
4. Contact the development team