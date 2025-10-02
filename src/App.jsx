import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import useIndexedDB from './hooks/useIndexedDB';
import './App.css';

let socket;

function App() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState('');
  const [typingText, setTypingText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const { isDBReady, saveMessage, loadMessages, clearMessages, updateMessageStatus } = useIndexedDB();
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const usernameInputRef = useRef(null);
  
  // Audio call states
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callNotification, setCallNotification] = useState(null);
  
  // Push notification state
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    // Try to restore session from localStorage
    const savedUsername = localStorage.getItem('chatUsername');
    const savedMessages = localStorage.getItem('chatMessages');
    
    if (savedUsername) {
      setUsername(savedUsername);
      setJoined(true);
    }
    
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error('Failed to parse saved messages', e);
      }
    }
    
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
            // Request push notification permission
            requestPushPermission(registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }
    
    socket = io();
    
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnectionStatus('connected');
      
      // If we have a saved username, rejoin with it
      if (localStorage.getItem('chatUsername')) {
        // Request message history when reconnecting
        socket.emit('request message history');
      }
      
      // Send any pending messages
      sendPendingMessages();
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    });

    socket.on('message history', (messages) => {
      setMessages(prev => {
        // Combine existing messages with history, avoiding duplicates
        const combined = [...prev, ...messages];
        // Remove duplicates based on id
        const unique = combined.filter((msg, index, self) => 
          index === self.findIndex(m => m.id === msg.id)
        );
        // Sort by timestamp
        unique.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        // Save to localStorage
        localStorage.setItem('chatMessages', JSON.stringify(unique));
        return unique;
      });
    });

    socket.on('new message', (message) => {
      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const exists = prev.some(msg => 
          msg.id === message.id || 
          (msg.status === 'sending' && msg.message === message.message && msg.username === message.username)
        );
        
        if (exists) {
          // If it's a temporary message being replaced with a saved one
          return prev.map(msg => 
            msg.id === message.id ? message : msg
          );
        }
        
        const newMessages = [...prev, message];
        // Save to localStorage
        localStorage.setItem('chatMessages', JSON.stringify(newMessages));
        return newMessages;
      });
      setIsTyping(false);
      
      // Show push notification if the user is not active
      if (!document.hasFocus() && 'serviceWorker' in navigator) {
        showPushNotification(message);
      }
    });

    socket.on('user joined', (username) => {
      setMessages(prev => {
        const newMessages = [...prev, { 
          id: uuidv4(), 
          system: true, 
          text: `${username} joined the chat` 
        }];
        // Save to localStorage
        localStorage.setItem('chatMessages', JSON.stringify(newMessages));
        return newMessages;
      });
    });

    socket.on('user left', (username) => {
      setMessages(prev => {
        const newMessages = [...prev, { 
          id: uuidv4(), 
          system: true, 
          text: `${username} left the chat` 
        }];
        // Save to localStorage
        localStorage.setItem('chatMessages', JSON.stringify(newMessages));
        return newMessages;
      });
    });

    // Handle online users count
    socket.on('online users count', (count) => {
      setOnlineUsers(count);
    });

    socket.on('users list', (users) => {
      // You could use this to display a list of users if needed
      console.log('Online users list:', users);
    });

    // Handle typing with real text
    socket.on('typing', (data) => {
      const { username, text } = data;
      setTypingUser(username);
      setTypingText(text);
      setIsTyping(true);
    });

    socket.on('stop typing', (username) => {
      setIsTyping(false);
    });

    socket.on('clear chat', () => {
      setMessages([]);
      localStorage.removeItem('chatMessages');
      clearMessages();
    });

    // Auth events
    socket.on('login success', (user) => {
      setUsername(user.username);
      setJoined(true);
      // Save username to localStorage
      localStorage.setItem('chatUsername', user.username);
      
      // Request message history
      socket.emit('request message history');
    });

    socket.on('login error', (error) => {
      alert('Login error: ' + error);
    });

    socket.on('register success', (message) => {
      alert('Registration successful: ' + message);
      setAuthMode('login'); // Switch to login after registration
    });

    socket.on('register error', (error) => {
      alert('Registration error: ' + error);
    });

    socket.on('message saved', (data) => {
      const { tempId, savedId } = data;
      setMessages(prev => {
        const updatedMessages = prev.map(msg => {
          if (msg.id === tempId) {
            return { ...msg, id: savedId, status: 'sent' };
          }
          return msg;
        });
        // Save to localStorage
        localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
        return updatedMessages;
      });
    });

    socket.on('message error', (error) => {
      alert('Message error: ' + error);
    });

    socket.on('logout success', (username) => {
      // Clear local storage
      localStorage.removeItem('chatUsername');
      localStorage.removeItem('chatMessages');
      
      // Clear IndexedDB
      clearMessages();
      
      // Reset state
      setUsername('');
      setMessages([]);
      setJoined(false);
      setNewUsername('');
      setPassword('');
      
      console.log('User logged out successfully');
    });

    socket.on('logout error', (error) => {
      alert('Logout error: ' + error);
    });
    
    // Audio call events
    socket.on('incoming audio call', (data) => {
      setIncomingCall(data);
      setCallNotification({
        type: 'incoming',
        caller: data.caller,
        message: `${data.caller} is calling you`
      });
    });
    
    socket.on('call accepted', (data) => {
      setCallNotification({
        type: 'accepted',
        accepter: data.accepter,
        message: `${data.accepter} accepted your call`
      });
      
      // Start the call
      setActiveCall({
        caller: username,
        accepter: data.accepter,
        callId: data.callId
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setCallNotification(null);
      }, 3000);
    });
    
    socket.on('call declined', (data) => {
      setCallNotification({
        type: 'declined',
        decliner: data.decliner,
        message: `${data.decliner} declined your call`
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setCallNotification(null);
      }, 3000);
    });
    
    socket.on('call ended', (data) => {
      setCallNotification({
        type: 'ended',
        message: `Call with ${data.with} ended by ${data.by}`
      });
      
      // End the active call
      setActiveCall(null);
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setCallNotification(null);
      }, 3000);
    });

    // Cleanup function
    return () => {
      socket.disconnect();
    };
  }, []);

  // Load messages from IndexedDB when DB is ready
  useEffect(() => {
    if (isDBReady) {
      loadMessages().then((dbMessages) => {
        if (dbMessages.length > 0) {
          setMessages(prev => {
            // Merge with existing messages, avoiding duplicates
            const allMessages = [...prev, ...dbMessages];
            const unique = allMessages.filter((msg, index, self) => 
              index === self.findIndex(m => m.id === msg.id)
            );
            return unique;
          });
        }
      });
    }
  }, [isDBReady, loadMessages]);

  // Focus username input on initial render
  useEffect(() => {
    if (!joined && usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  }, [joined]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Request push notification permission
  const requestPushPermission = async (registration) => {
    try {
      // Check if push notifications are supported
      if (!('PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }
      
      // Check existing permission
      if (Notification.permission === 'denied') {
        console.log('Push notifications denied');
        return;
      }
      
      if (Notification.permission === 'granted') {
        console.log('Push notifications already granted');
        subscribeToPush(registration);
        return;
      }
      
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Push notifications granted');
        subscribeToPush(registration);
      } else {
        console.log('Push notifications not granted');
      }
    } catch (error) {
      console.error('Error requesting push permission:', error);
    }
  };
  
  // Subscribe to push notifications
  const subscribeToPush = async (registration) => {
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.VAPID_PUBLIC_KEY || 'YOUR_PUBLIC_VAPID_KEY_HERE'
      });
      
      // Send subscription to server
      await fetch('/api/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      setIsSubscribed(true);
      console.log('Subscribed to push notifications');
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  };
  
  // Show push notification
  const showPushNotification = (message) => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification('New Message', {
          body: `${message.username}: ${message.message}`,
          icon: '/logo192.png',
          badge: '/favicon.ico'
        });
      });
    }
  };

  const handleLogin = () => {
    if (newUsername.trim() && password.trim()) {
      socket.emit('login', {
        username: newUsername.trim(),
        password: password.trim()
      });
    }
  };

  const handleRegister = () => {
    if (newUsername.trim() && newEmail.trim() && newPassword.trim()) {
      socket.emit('register', {
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword.trim()
      });
    }
  };

  const handleAuthKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (authMode === 'login') {
        handleLogin();
      } else {
        handleRegister();
      }
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      // Create a temporary message with a unique UUID
      const tempId = uuidv4();
      const tempMessage = {
        id: tempId,
        username: username,
        message: message,
        timestamp: new Date(),
        status: connectionStatus === 'connected' ? 'sending' : 'pending'
      };
      
      // Add to local state immediately for better UX
      setMessages(prev => {
        const newMessages = [...prev, tempMessage];
        localStorage.setItem('chatMessages', JSON.stringify(newMessages));
        return newMessages;
      });
      
      // Send to server if online
      if (connectionStatus === 'connected') {
        socket.emit('new message', {
          tempId: tempId,
          username: username,
          message: message,
          timestamp: new Date()
        });
      } else {
        // Save to IndexedDB for offline sending
        if (isDBReady) {
          saveMessage(tempMessage);
        }
      }
      
      // Clear input field
      setMessage('');
      socket.emit('stop typing');
    }
  };

  const handleTyping = (e) => {
    const text = e.target.value;
    setMessage(text);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Emit typing event with actual text
    if (text.trim()) {
      socket.emit('typing', { username, text: text.substring(0, 50) }); // Limit text length
      
      // Set new timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop typing', username);
      }, 1000);
    } else {
      socket.emit('stop typing', username);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    socket.emit('clear chat');
  };

  const handleReconnect = () => {
    if (socket) {
      socket.connect();
    }
  };

  // Send pending messages when online
  const sendPendingMessages = () => {
    if (!isDBReady || connectionStatus !== 'connected') return;
    
    loadMessages().then((messages) => {
      messages.forEach(message => {
        if (message.status === 'pending' && message.username === username) {
          socket.emit('new message', {
            username: message.username,
            message: message.message,
            timestamp: message.timestamp
          });
          
          // Update message status
          updateMessageStatus(message.id, 'sent');
        }
      });
    });
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      // Notify server about logout
      socket.emit('logout', username);
      
      // Clear local storage
      localStorage.removeItem('chatUsername');
      localStorage.removeItem('chatMessages');
      
      // Clear IndexedDB
      clearMessages();
      
      // Reset state
      setUsername('');
      setMessages([]);
      setJoined(false);
      setNewUsername('');
      setPassword('');
      
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };
  
  // Handle audio call initiation
  const handleInitiateCall = () => {
    socket.emit('initiate audio call', username);
    setCallNotification({
      type: 'calling',
      message: 'Calling users...'
    });
  };
  
  // Handle accepting an incoming call
  const handleAcceptCall = () => {
    if (incomingCall) {
      socket.emit('accept call', {
        caller: incomingCall.caller,
        accepter: username,
        callId: incomingCall.callId
      });
      
      // Start the call
      setActiveCall({
        caller: incomingCall.caller,
        accepter: username,
        callId: incomingCall.callId
      });
      
      // Clear the incoming call
      setIncomingCall(null);
      setCallNotification(null);
    }
  };
  
  // Handle declining an incoming call
  const handleDeclineCall = () => {
    if (incomingCall) {
      socket.emit('decline call', {
        caller: incomingCall.caller,
        decliner: username,
        callId: incomingCall.callId
      });
      
      // Clear the incoming call
      setIncomingCall(null);
      setCallNotification(null);
    }
  };
  
  // Handle ending an active call
  const handleEndCall = () => {
    if (activeCall) {
      socket.emit('end call', {
        caller: activeCall.caller,
        accepter: activeCall.accepter,
        endedBy: username
      });
      
      // End the call locally
      setActiveCall(null);
      setCallNotification({
        type: 'ended',
        message: 'Call ended'
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setCallNotification(null);
      }, 3000);
    }
  };

  // Show auth screen if not joined
  if (!joined) {
    return (
      <div className="container">
        <div className="header">
          <h1>Real-Time Chat</h1>
        </div>
        
        <div className="username-container">
          <div className="splash-logo">C</div>
          <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
          
          <input
            ref={usernameInputRef}
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onKeyPress={handleAuthKeyPress}
            placeholder="Username"
            className="username-input"
            autoComplete="off"
          />
          
          {authMode === 'register' && (
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyPress={handleAuthKeyPress}
              placeholder="Email"
              className="username-input"
              autoComplete="off"
            />
          )}
          
          <input
            type="password"
            value={authMode === 'login' ? password : newPassword}
            onChange={(e) => authMode === 'login' ? setPassword(e.target.value) : setNewPassword(e.target.value)}
            onKeyPress={handleAuthKeyPress}
            placeholder="Password"
            className="username-input"
            autoComplete="off"
          />
          
          {authMode === 'login' ? (
            <>
              <button onClick={handleLogin} className="join-button">
                Login
              </button>
              <button onClick={() => setAuthMode('register')} className="switch-auth-button">
                Need an account? Register
              </button>
            </>
          ) : (
            <>
              <button onClick={handleRegister} className="join-button register-button">
                Register Account
              </button>
              <button onClick={() => setAuthMode('login')} className="switch-auth-button">
                Already have an account? Login
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Show chat interface if joined
  return (
    <div className="container">
      <div className="header">
        <h1>Real-Time Chat</h1>
        <div className="header-right">
          <div className="status-indicators">
            <span className={`status ${connectionStatus}`}>
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
            <span className="online-count">{onlineUsers} user{onlineUsers !== 1 ? 's' : ''} online</span>
          </div>
          <button onClick={handleLogout} className="logout-button-top">Logout</button>
        </div>
      </div>
      
      {connectionStatus === 'disconnected' && (
        <div className="reconnect-banner">
          <span>Connection lost. </span>
          <button onClick={handleReconnect} className="reconnect-button">
            Reconnect
          </button>
        </div>
      )}
      
      {/* Call Notification */}
      {callNotification && (
        <div className="call-notification">
          <h3>Call Notification</h3>
          <p>{callNotification.message}</p>
          {callNotification.type === 'incoming' && (
            <div className="call-buttons">
              <button className="call-button accept-call" onClick={handleAcceptCall}>
                Accept
              </button>
              <button className="call-button decline-call" onClick={handleDeclineCall}>
                Decline
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Active Call Indicator */}
      {activeCall && (
        <div className="reconnect-banner" style={{ backgroundColor: '#9b59b6' }}>
          <span>Active call with {activeCall.caller === username ? activeCall.accepter : activeCall.caller}</span>
          <button onClick={handleEndCall} className="reconnect-button" style={{ backgroundColor: '#e74c3c' }}>
            End Call
          </button>
        </div>
      )}
      
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`message ${msg.username === username ? 'sent' : 'received'} ${msg.system ? 'system' : ''}`}
            >
              {msg.system ? (
                <div className="system-message">{msg.text}</div>
              ) : (
                <>
                  <div>{msg.message}</div>
                  <div className="message-info">
                    <span>{msg.username}</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </>
              )}
            </div>
          ))}
          
          {isTyping && typingText && (
            <div className="message received typing-message">
              <div>
                <strong>{typingUser}</strong> is typing: {typingText}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="input-container">
        <input
          type="text"
          value={message}
          onChange={handleTyping}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          autoComplete="off"
        />
        <button onClick={handleSendMessage}>Send</button>
        <button onClick={handleInitiateCall} className="call-button-main">
          Audio Call
        </button>
        <button onClick={handleClearChat}>Clear Chat</button>
      </div>
    </div>
  );
}

export default App;