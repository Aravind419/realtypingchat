// Client-side JavaScript for real-time chat with PWA support
const socket = io();

// DOM elements
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const clearButton = document.getElementById('clear-button');
const typingIndicator = document.getElementById('typing-indicator');
const typingUser = document.getElementById('typing-user');
const connectionStatus = document.getElementById('connection-status');
const onlineUsers = document.getElementById('online-users');

// User information
let username = '';
let typingTimeout;
let db;

// Initialize IndexedDB for offline storage
function initDB() {
    const request = indexedDB.open('ChatAppDB', 1);
    
    request.onerror = (event) => {
        console.error('Database error:', event.target.error);
    };
    
    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Database initialized');
        loadMessagesFromDB();
    };
    
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const objectStore = db.createObjectStore('messages', { keyPath: 'id' });
        objectStore.createIndex('username', 'username', { unique: false });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('Database created');
    };
}

// Save message to IndexedDB
function saveMessageToDB(message) {
    if (!db) return;
    
    const transaction = db.transaction(['messages'], 'readwrite');
    const objectStore = transaction.objectStore('messages');
    objectStore.add(message);
}

// Load messages from IndexedDB
function loadMessagesFromDB() {
    if (!db) return;
    
    const transaction = db.transaction(['messages'], 'readonly');
    const objectStore = transaction.objectStore('messages');
    const request = objectStore.getAll();
    
    request.onsuccess = (event) => {
        const messages = event.target.result;
        messages.forEach(displayMessage);
    };
}

// Remove all messages from IndexedDB
function clearMessagesFromDB() {
    if (!db) return;
    
    const transaction = db.transaction(['messages'], 'readwrite');
    const objectStore = transaction.objectStore('messages');
    objectStore.clear();
}

// Prompt for username on connection
window.addEventListener('DOMContentLoaded', () => {
    // Show splash screen
    showSplashScreen();
    
    // Initialize database
    initDB();
    
    username = prompt('Enter your username:');
    if (!username) {
        username = 'Anonymous';
    }
    
    // Notify server that user has joined
    socket.emit('user joined', username);
    
    // Update connection status
    connectionStatus.textContent = 'Connected';
    connectionStatus.style.color = 'green';
});

// Show splash screen
function showSplashScreen() {
    const splash = document.createElement('div');
    splash.id = 'splash-screen';
    splash.innerHTML = `
        <div class="splash-logo">C</div>
        <div class="splash-text">Chat App</div>
    `;
    document.body.appendChild(splash);
    
    // Hide splash screen after 2 seconds
    setTimeout(() => {
        splash.classList.add('hidden');
        setTimeout(() => {
            document.body.removeChild(splash);
        }, 300);
    }, 2000);
}

// Handle sending messages
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        const messageData = {
            id: Date.now(),
            username: username,
            message: message,
            timestamp: new Date(),
            status: 'pending' // pending, sent, delivered
        };
        
        // Save to IndexedDB
        saveMessageToDB(messageData);
        
        // Send to server if online
        if (navigator.onLine) {
            socket.emit('new message', {
                username: username,
                message: message
            });
            messageData.status = 'sent';
        }
        
        displayMessage(messageData);
        messageInput.value = '';
        
        // Stop typing indicator
        socket.emit('stop typing');
    }
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
    
    // Emit typing event
    socket.emit('typing', username);
    
    // Clear previous timeout
    clearTimeout(typingTimeout);
    
    // Set new timeout to stop typing indicator
    typingTimeout = setTimeout(() => {
        socket.emit('stop typing');
    }, 1000);
});

clearButton.addEventListener('click', () => {
    socket.emit('clear chat');
    clearMessagesFromDB();
});

// Socket event handlers
socket.on('new message', (data) => {
    const messageData = {
        id: Date.now(),
        username: data.username,
        message: data.message,
        timestamp: new Date(),
        status: 'received'
    };
    
    // Save to IndexedDB
    saveMessageToDB(messageData);
    displayMessage(messageData);
});

socket.on('message history', (messages) => {
    messages.forEach(message => {
        const messageData = {
            id: message.id,
            username: message.username,
            message: message.message,
            timestamp: new Date(message.timestamp),
            status: 'received'
        };
        saveMessageToDB(messageData);
        displayMessage(messageData);
    });
});

socket.on('typing', (username) => {
    if (username !== this.username) {
        typingUser.textContent = username;
        typingIndicator.classList.remove('hidden');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});

socket.on('stop typing', () => {
    typingIndicator.classList.add('hidden');
});

socket.on('user joined', (username) => {
    const joinMessage = document.createElement('div');
    joinMessage.className = 'join-message';
    joinMessage.textContent = `${username} joined the chat`;
    joinMessage.style.textAlign = 'center';
    joinMessage.style.fontSize = '0.8rem';
    joinMessage.style.color = '#666';
    joinMessage.style.margin = '10px 0';
    messagesContainer.appendChild(joinMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

socket.on('user left', (username) => {
    const leaveMessage = document.createElement('div');
    leaveMessage.className = 'leave-message';
    leaveMessage.textContent = `${username} left the chat`;
    leaveMessage.style.textAlign = 'center';
    leaveMessage.style.fontSize = '0.8rem';
    leaveMessage.style.color = '#666';
    leaveMessage.style.margin = '10px 0';
    messagesContainer.appendChild(leaveMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

socket.on('users list', (users) => {
    onlineUsers.textContent = `${users.length} user${users.length !== 1 ? 's' : ''} online`;
});

socket.on('clear chat', () => {
    messagesContainer.innerHTML = '';
    clearMessagesFromDB();
});

socket.on('connect', () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.style.color = 'green';
    
    // Rejoin with the same username
    if (username) {
        socket.emit('user joined', username);
    }
});

socket.on('disconnect', () => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.style.color = 'red';
});

// Handle online/offline events
window.addEventListener('online', () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.style.color = 'green';
    // Try to send any pending messages
    sendPendingMessages();
});

window.addEventListener('offline', () => {
    connectionStatus.textContent = 'Offline';
    connectionStatus.style.color = 'orange';
});

// Send pending messages when online
function sendPendingMessages() {
    if (!db) return;
    
    const transaction = db.transaction(['messages'], 'readwrite');
    const objectStore = transaction.objectStore('messages');
    const request = objectStore.getAll();
    
    request.onsuccess = (event) => {
        const messages = event.target.result;
        messages.forEach(message => {
            if (message.status === 'pending' && message.username === username) {
                socket.emit('new message', {
                    username: message.username,
                    message: message.message
                });
                
                // Update message status
                message.status = 'sent';
                objectStore.put(message);
            }
        });
    };
}

// Helper function to display messages
function displayMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    
    // Determine if this is our own message
    if (data.username === username) {
        messageElement.classList.add('sent');
    } else {
        messageElement.classList.add('received');
    }
    
    // Format timestamp
    const timestamp = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageElement.innerHTML = `
        <div>${data.message}</div>
        <div class="message-info">
            <span>${data.username}</span>
            <span>${timestamp}</span>
        </div>
    `;
    
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Hide typing indicator when a new message arrives
    typingIndicator.classList.add('hidden');
}