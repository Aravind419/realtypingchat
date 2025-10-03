let socket;
let username = '';
let isConnected = false;
let typingTimeout;
let onlineUsers = [];
let isAtBottom = true;

// DOM Elements
const loginContainer = document.getElementById('login');
const chatContainer = document.getElementById('chat');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('join-btn');
const messagesContainer = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const onlineUsersBtn = document.getElementById('online-users-btn');
const onlineUsersList = document.getElementById('online-users-list');
const onlineCount = document.getElementById('online-count');
const typingIndicator = document.getElementById('typing-indicator');
const offlineBanner = document.getElementById('offline-banner');

// Initialize Socket.IO connection
function initSocket() {
    socket = io('http://localhost:5000');
    
    // Check if user is at bottom of messages when scrolling
    messagesContainer.addEventListener('scroll', () => {
        const threshold = 50; // pixels from bottom
        isAtBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - threshold;
    });
    
    socket.on('connect', () => {
        console.log('Connected to server');
        isConnected = true;
        offlineBanner.classList.add('hidden');
        
        // If we have a username, rejoin
        if (username) {
            socket.emit('join', { username });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnected = false;
        offlineBanner.classList.remove('hidden');
    });
    
    socket.on('load messages', (messages) => {
        messages.forEach(msg => displayMessage(msg));
        // Scroll to bottom after loading messages
        setTimeout(scrollToBottom, 100);
    });
    
    socket.on('receive message', (message) => {
        displayMessage(message);
        // Only scroll to bottom if user was already at bottom
        if (isAtBottom) {
            scrollToBottom();
        }
    });
    
    socket.on('users updated', (users) => {
        onlineUsers = users;
        onlineCount.textContent = users.length;
    });
    
    socket.on('user typing', (data) => {
        if (data.isTyping && data.username !== username) {
            // Show actual text being typed
            typingIndicator.textContent = `${data.username} is typing: ${data.text}`;
            typingIndicator.classList.remove('hidden');
        } else {
            typingIndicator.classList.add('hidden');
        }
    });
}

// Display a message in the chat
function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (message.username === username) {
        messageElement.classList.add('own');
    }
    
    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');
    
    const usernameElement = document.createElement('span');
    usernameElement.classList.add('username');
    usernameElement.textContent = message.username;
    
    const timestampElement = document.createElement('span');
    timestampElement.classList.add('timestamp');
    timestampElement.textContent = formatTime(message.timestamp);
    
    messageHeader.appendChild(usernameElement);
    messageHeader.appendChild(timestampElement);
    
    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    messageText.textContent = message.text;
    
    messageElement.appendChild(messageHeader);
    messageElement.appendChild(messageText);
    
    messagesContainer.appendChild(messageElement);
}

// Format timestamp
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Scroll to bottom of messages
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    isAtBottom = true;
}

// Handle user joining
function handleJoin() {
    const name = usernameInput.value.trim();
    if (name) {
        username = name;
        loginContainer.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        
        // Join the chat
        socket.emit('join', { username });
    }
}

// Handle sending message
function handleSendMessage(e) {
    e.preventDefault();
    const text = messageInput.value.trim();
    
    if (text && username) {
        // Send to server (don't display immediately)
        socket.emit('send message', { username, text });
        
        // Clear input
        messageInput.value = '';
        
        // Stop typing indicator
        socket.emit('typing', { username, isTyping: false, text: '' });
    }
}

// Handle typing indicator
function handleTyping() {
    // Clear previous timeout
    clearTimeout(typingTimeout);
    
    if (messageInput.value.length > 0) {
        // Send typing status with actual text
        socket.emit('typing', { username, isTyping: true, text: messageInput.value });
        
        // Set timeout to stop typing indicator
        typingTimeout = setTimeout(() => {
            socket.emit('typing', { username, isTyping: false, text: '' });
        }, 1000);
    } else {
        socket.emit('typing', { username, isTyping: false, text: '' });
    }
}

// Toggle online users list
function toggleOnlineUsers() {
    // Update the online users list
    updateOnlineUsersList();
    onlineUsersList.classList.toggle('hidden');
}

// Update online users list display
function updateOnlineUsersList() {
    // Clear existing list
    onlineUsersList.innerHTML = '';
    
    // Create list of online users
    const ul = document.createElement('ul');
    onlineUsers.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        ul.appendChild(li);
    });
    
    onlineUsersList.appendChild(ul);
}

// Event Listeners
joinBtn.addEventListener('click', handleJoin);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleJoin();
});

messageForm.addEventListener('submit', handleSendMessage);
messageInput.addEventListener('input', handleTyping);

onlineUsersBtn.addEventListener('click', toggleOnlineUsers);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    
    // Attempt to reconnect on interval if disconnected
    setInterval(() => {
        if (!socket.connected) {
            socket.connect();
        }
    }, 5000);
});