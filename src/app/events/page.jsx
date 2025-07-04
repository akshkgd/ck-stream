'use client';

import { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Copy, Edit, Trash2, Plus, Calendar, User } from 'lucide-react';
import { getDatabase, ref as rtdbRef, onValue } from "firebase/database";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    startDateTime: '',
    videoURL: ''
  });
  const [copiedId, setCopiedId] = useState(null);

  // RTDB live attendance for all events
  const [liveCounts, setLiveCounts] = useState({});

  // Load events from Firebase (real-time)
  useEffect(() => {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'undefined') return;
    setIsLoading(true);
    const unsub = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsData);
      setIsLoading(false);
    }, (error) => {
      console.error('Error loading events:', error);
      alert(`Error loading events: ${error.message}`);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!events.length) return;
    const db = getDatabase();
    const listeners = [];

    events.forEach((event) => {
      if (!event.uuid) return;
      const eventPresenceRef = rtdbRef(db, `presence/${event.uuid}`);
      const listener = onValue(eventPresenceRef, (snapshot) => {
        setLiveCounts((prev) => ({
          ...prev,
          [event.uuid]: snapshot.size || 0,
        }));
      });
      listeners.push(listener);
    });

    return () => {
      listeners.forEach((unsub) => unsub && unsub());
    };
  }, [events]);

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.startDateTime || !formData.videoURL) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const eventData = {
        title: formData.title,
        startDateTime: formData.startDateTime,
        videoURL: formData.videoURL,
        createdAt: new Date().toISOString(),
        uuid: generateUUID()
      };

      if (editingEvent) {
        // Update existing event
        await updateDoc(doc(db, 'events', editingEvent.id), {
          title: formData.title,
          startDateTime: formData.startDateTime,
          videoURL: formData.videoURL,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create new event
        await addDoc(collection(db, 'events'), eventData);
      }

      // Reset form and reload events
      setFormData({ title: '', startDateTime: '', videoURL: '' });
      setShowForm(false);
      setEditingEvent(null);
      // The onSnapshot listener will handle reloading events
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Error saving event. Please try again.');
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      startDateTime: event.startDateTime,
      videoURL: event.videoURL
    });
    setShowForm(true);
  };

  const handleDelete = async (eventId) => {
    if (confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteDoc(doc(db, 'events', eventId));
        // The onSnapshot listener will handle reloading events
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error deleting event. Please try again.');
      }
    }
  };

  const copyToClipboard = async (text, eventId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(eventId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    
    // Get day with ordinal suffix
    const day = date.getDate();
    const daySuffix = getDaySuffix(day);
    
    // Get month name
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const month = monthNames[date.getMonth()];
    
    // Format time
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    return `${day}${daySuffix} ${month} ${displayHours}:${displayMinutes} ${ampm}`;
  };

  const getDaySuffix = (day) => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const getEventStatus = (startDateTime) => {
    const now = new Date();
    const start = new Date(startDateTime);
    
    if (now < start) {
      return 'upcoming';
    } else if (now >= start && now <= new Date(start.getTime() + 2 * 60 * 60 * 1000)) { // 2 hours window
      return 'live';
    } else {
      return 'ended';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'live': return 'bg-red-500';
      case 'upcoming': return 'bg-blue-500';
      case 'ended': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'live': return 'LIVE';
      case 'upcoming': return 'UPCOMING';
      case 'ended': return 'ENDED';
      default: return 'UNKNOWN';
    }
  };

  // Debug: Show Firebase config status
  const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading events...</p>
          {!isFirebaseConfigured && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded text-yellow-800 text-sm">
              ⚠️ Firebase not configured. Please check your environment variables.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Live Stream Events</h1>
            <p className="text-gray-600 ">Manage your live streaming events</p>
          </div>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingEvent(null);
              setFormData({ title: '', startDateTime: '', videoURL: '' });
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Event
          </button>
        </div>

        {/* Debug Info */}
        {!isFirebaseConfigured && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 rounded-lg">
            <h3 className="text-red-800 font-semibold mb-2">Firebase Configuration Error</h3>
            <p className="text-red-700 text-sm mb-2">
              Firebase is not properly configured. Please check your environment variables.
            </p>
            <details className="text-xs text-red-600">
              <summary className="cursor-pointer">Show Firebase Config</summary>
              <pre className="mt-2 bg-red-50 p-2 rounded overflow-auto">
                {JSON.stringify(firebaseConfig, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-6">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter event title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startDateTime}
                    onChange={(e) => setFormData({ ...formData, startDateTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video URL (HLS)
                  </label>
                  <input
                    type="url"
                    value={formData.videoURL}
                    onChange={(e) => setFormData({ ...formData, videoURL: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/stream.m3u8"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    {editingEvent ? 'Update Event' : 'Create Event'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingEvent(null);
                      setFormData({ title: '', startDateTime: '', videoURL: '' });
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const status = getEventStatus(event.startDateTime);
            const watchUrl = `${window.location.origin}/watch/${event.uuid}`;
            
            return (
              <div key={event.id} className="bg-white rounded-xl p-6 flex flex-col gap-4 min-h-[220px] border border-neutral-200">
                {/* Minimal Status and Actions */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getStatusColor(status)} text-white`}>{getStatusText(status)}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(event)} className="p-1 text-gray-400 hover:text-blue-600" title="Edit"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(event.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-gray-900 font-semibold text-lg mb-1">{event.title}</div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDateTime(event.startDateTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <User className="w-4 h-4" />
                    <span>{liveCounts[event.uuid] || 0} attending</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => copyToClipboard(event.uuid, event.id)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-md text-sm border border-gray-200 transition-colors"
                  >
                    Copy Live Class ID
                  </button>
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded-md text-sm transition-colors"
                  >
                    Watch Stream
                  </a>
                </div>
                {copiedId === event.id && (
                  <div className="text-xs text-green-600 mt-1 text-center">✓ Live Class ID copied!</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {events.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📺</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No events yet</h3>
            <p className="text-gray-600 mb-6">Create your first live stream event to get started.</p>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingEvent(null);
                setFormData({ title: '', startDateTime: '', videoURL: '' });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Your First Event
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 