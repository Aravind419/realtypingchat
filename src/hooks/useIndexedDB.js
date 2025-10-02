import { useState, useEffect } from 'react';

const DB_NAME = 'ChatAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

let db;

export const useIndexedDB = () => {
  const [isDBReady, setIsDBReady] = useState(false);

  useEffect(() => {
    const initDB = () => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error('Database error:', event.target.error);
      };
      
      request.onsuccess = (event) => {
        db = event.target.result;
        setIsDBReady(true);
        console.log('Database initialized');
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('username', 'username', { unique: false });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        console.log('Database created');
      };
    };

    if ('indexedDB' in window) {
      initDB();
    }
  }, []);

  const saveMessage = (message) => {
    if (!db || !isDBReady) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(message);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  };

  const loadMessages = () => {
    if (!db || !isDBReady) return Promise.resolve([]);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  };

  const clearMessages = () => {
    if (!db || !isDBReady) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  };

  const updateMessageStatus = (id, status) => {
    if (!db || !isDBReady) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const getRequest = objectStore.get(id);
      
      getRequest.onsuccess = () => {
        const message = getRequest.result;
        if (message) {
          message.status = status;
          const putRequest = objectStore.put(message);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = (event) => reject(event.target.error);
        } else {
          resolve();
        }
      };
      
      getRequest.onerror = (event) => reject(event.target.error);
    });
  };

  return {
    isDBReady,
    saveMessage,
    loadMessages,
    clearMessages,
    updateMessageStatus
  };
};

export default useIndexedDB;