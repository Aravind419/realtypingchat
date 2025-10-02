const CACHE_NAME = 'chat-app-react-v1.3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Install event - cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For API requests, try network first
  if (event.request.url.includes('/socket.io/') || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        // Clone the request because it's a stream and can only be consumed once
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response because it's a stream and can only be consumed once
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
            
          return response;
        });
      })
      .catch(() => {
        // If fetch fails, return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push notification event
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'Chat App Notification';
    const options = {
      body: data.body || 'You have a new message',
      icon: '/logo192.png',
      badge: '/favicon.ico',
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Focus the client or open a new window
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Background sync for sending messages when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'send-message') {
    event.waitUntil(sendOfflineMessages());
  }
});

// Function to send offline messages
function sendOfflineMessages() {
  // This would be implemented to send queued messages
  // when the connection is restored
  return Promise.resolve();
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'BACKGROUND_SYNC') {
    // Register background sync
    if ('sync' in registration) {
      registration.sync.register('send-message');
    }
  }
  
  if (event.data && event.data.type === 'CACHE_MESSAGE') {
    // Cache a message
    cacheMessage(event.data.message);
  }
  
  if (event.data && event.data.type === 'SUBSCRIBE_PUSH') {
    // Subscribe to push notifications
    subscribeToPush();
  }
});

// Function to subscribe to push notifications
function subscribeToPush() {
  return self.registration.pushManager.getSubscription()
    .then(function(subscription) {
      if (subscription) {
        return subscription;
      }
      
      const applicationServerKey = urlBase64ToUint8Array('YOUR_PUBLIC_VAPID_KEY_HERE');
      return self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
    })
    .then(function(subscription) {
      // Send subscription to server
      return fetch('/api/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Failed to subscribe to push notifications');
      }
      console.log('Subscribed to push notifications');
    })
    .catch(function(error) {
      console.error('Failed to subscribe to push notifications', error);
    });
}

// Function to convert base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Function to cache messages
function cacheMessage(message) {
  // Store message in IndexedDB via the client
  // This is a simplified approach - in a real app, you'd use a more robust solution
  console.log('Caching message:', message);
}