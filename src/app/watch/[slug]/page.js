'use client';

import { useState, useEffect, useRef, use } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, getDocs } from 'firebase/firestore';

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

// Stream times - hardcoded for now, can be fetched from API in future (IST timezone)
const STREAM_START_TIME = new Date('2025-07-03T14:30:00+05:30'); // Example: July 3, 8 PM IST
const STREAM_END_TIME = new Date('2025-07-03T22:00:00+05:30'); // Example: July 3, 10 PM IST

export default function WatchPage({ params }) {
  const { slug } = use(params);
  const [chatName, setChatName] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [timeUntilStream, setTimeUntilStream] = useState(null);
  const [isStreamLive, setIsStreamLive] = useState(false);
  const [isStreamEnded, setIsStreamEnded] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check for chat name on load
  useEffect(() => {
    const savedName = localStorage.getItem('chatName');
    if (!savedName) {
      const name = prompt('Please enter your name for the chat:');
      if (name && name.trim()) {
        const trimmedName = name.trim();
        setChatName(trimmedName);
        localStorage.setItem('chatName', trimmedName);
      } else {
        // If user cancels or enters empty name, use a default
        const defaultName = `User${Math.floor(Math.random() * 1000)}`;
        setChatName(defaultName);
        localStorage.setItem('chatName', defaultName);
      }
    } else {
      setChatName(savedName);
    }
  }, []);

  // Countdown timer and stream status
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      
      if (now < STREAM_START_TIME) {
        const diff = STREAM_START_TIME - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeUntilStream({ days, hours, minutes, seconds });
        setIsStreamLive(false);
        setIsStreamEnded(false);
      } else if (now >= STREAM_START_TIME && now < STREAM_END_TIME) {
        setTimeUntilStream(null);
        setIsStreamLive(true);
        setIsStreamEnded(false);
      } else {
        setTimeUntilStream(null);
        setIsStreamLive(false);
        setIsStreamEnded(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-play video when stream starts (iframe handles this automatically)
  useEffect(() => {
    if (isStreamLive) {
      console.log('Stream is now live!');
    }
  }, [isStreamLive]);

  // Listen to chat messages
  useEffect(() => {
    if (!slug) return;

    try {
      const q = query(collection(db, `chats/${slug}/messages`), orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messageList = [];
        snapshot.forEach((doc) => {
          messageList.push({ id: doc.id, ...doc.data() });
        });
        setMessages(messageList);
      }, (error) => {
        console.error('Firestore error:', error);
        // Continue without chat if Firestore fails
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up Firestore listener:', error);
    }
  }, [slug]);

  // Clean up messages after stream ends
  useEffect(() => {
    if (isStreamEnded) {
      const cleanupMessages = async () => {
        try {
          const messagesRef = collection(db, `chats/${slug}/messages`);
          const snapshot = await getDocs(messagesRef);
          const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
          console.log('All chat messages deleted after stream ended');
        } catch (error) {
          console.error('Error deleting messages:', error);
        }
      };
      
      cleanupMessages();
    }
  }, [isStreamEnded, slug]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatName) return;

    try {
      await addDoc(collection(db, `chats/${slug}/messages`), {
        text: newMessage.trim(),
        userName: chatName,
        timestamp: new Date()
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Countdown Timer */}
      {timeUntilStream && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              Stream starts in {timeUntilStream.days > 0 && `${timeUntilStream.days}d `}{timeUntilStream.hours > 0 && `${timeUntilStream.hours}h `}{timeUntilStream.minutes}m {timeUntilStream.seconds}s
            </h1>
            <p className="text-xl text-gray-300">Get ready for the live stream!</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row h-screen">
        {/* Video Section */}
        <div className="flex-1 bg-black">
          <div className="relative w-full h-full">
            {isStreamLive ? (
              <iframe
                src="https://iframe.mediadelivery.net/embed/304187/f8913a49-ac01-4fef-9035-4490e24fb94c"
                loading="lazy"
                style={{ border: 'none' }}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            ) : !timeUntilStream ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Stream has ended</h2>
                  <p className="text-gray-400">Thanks for watching!</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Stream starting soon</h2>
                  <p className="text-gray-400">Please wait...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Section */}
        <div className="w-full lg:w-80 bg-gray-800 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold">Live Chat</h2>
            <p className="text-sm text-gray-400">
              {isStreamLive ? 'Live' : isStreamEnded ? 'Ended' : 'Starting soon'}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col">
                <div className="flex items-start space-x-2">
                  <span className="text-sm font-medium text-blue-400">
                    {message.userName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(message.timestamp.toDate())}
                  </span>
                </div>
                <p className="text-sm text-gray-200 mt-1 break-words">
                  {message.text}
                </p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-gray-700">
            <form onSubmit={sendMessage} className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!isStreamLive}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || !isStreamLive}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 