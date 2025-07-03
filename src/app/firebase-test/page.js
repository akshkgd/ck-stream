'use client';

import { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function FirebaseTest() {
  const [status, setStatus] = useState('Testing...');
  const [messages, setMessages] = useState([]);

  const testFirebase = async () => {
    try {
      setStatus('Testing Firebase connection...');
      
      // Try to add a test document
      const docRef = await addDoc(collection(db, 'test'), {
        message: 'Test message',
        timestamp: new Date()
      });
      
      setStatus(`✅ Firebase working! Document ID: ${docRef.id}`);
      
      // Try to read documents
      const querySnapshot = await getDocs(collection(db, 'test'));
      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(docs);
      
    } catch (error) {
      setStatus(`❌ Firebase error: ${error.message}`);
      console.error('Firebase test error:', error);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Firebase Test</h1>
      
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Configuration:</h2>
        <pre className="bg-gray-100 p-2 rounded text-sm">
          {JSON.stringify(firebaseConfig, null, 2)}
        </pre>
      </div>
      
      <button 
        onClick={testFirebase}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Test Firebase
      </button>
      
      <div className="mt-4">
        <h2 className="text-lg font-semibold mb-2">Status:</h2>
        <p>{status}</p>
      </div>
      
      {messages.length > 0 && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">Test Documents:</h2>
          <ul>
            {messages.map((msg) => (
              <li key={msg.id} className="mb-2">
                <strong>ID:</strong> {msg.id} | <strong>Message:</strong> {msg.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 