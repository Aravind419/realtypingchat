const io = require('socket.io-client');

// Connect to the server
const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected to server');
  
  // Join chat as test user
  socket.emit('join', { username: 'TestUser' });
});

socket.on('load messages', (messages) => {
  console.log('Loaded messages:', messages);
});

socket.on('receive message', (message) => {
  console.log('Received message:', message);
});

socket.on('users updated', (users) => {
  console.log('Online users:', users);
});

socket.on('user typing', (data) => {
  console.log(`${data.username} is ${data.isTyping ? 'typing' : 'not typing'}`);
});

// Send a test message after 2 seconds
setTimeout(() => {
  socket.emit('send message', { username: 'TestUser', text: 'Hello, world!' });
}, 2000);

// Simulate typing after 3 seconds
setTimeout(() => {
  socket.emit('typing', { username: 'TestUser', isTyping: true });
}, 3000);

// Stop typing after 4 seconds
setTimeout(() => {
  socket.emit('typing', { username: 'TestUser', isTyping: false });
}, 4000);

// Disconnect after 5 seconds
setTimeout(() => {
  socket.disconnect();
  console.log('Disconnected from server');
}, 5000);