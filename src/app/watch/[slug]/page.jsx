'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Hls from 'hls.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, onSnapshot, increment } from 'firebase/firestore';
import { getDatabase, ref as rtdbRef, set, onDisconnect, onValue } from "firebase/database";
import {
  Volume2,
  VolumeX,
  PhoneOff,
  MessageSquare,
  Smile,
  X
} from 'lucide-react';

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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function WatchPage() {
  const params = useParams();
  const eventUuid = params.slug;
  
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [streamState, setStreamState] = useState('loading'); // 'loading' | 'countdown' | 'live' | 'ended' | 'error'
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  
  // Event data from Firebase
  const [eventData, setEventData] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState(null);
  const [attendingCount, setAttendingCount] = useState(0);
  const [eventDocId, setEventDocId] = useState(null);

  // RTDB live attendance
  const [liveCount, setLiveCount] = useState(0);

  // Load event data from Firebase
  useEffect(() => {
    const loadEventData = async () => {
      try {
        setEventLoading(true);
        setEventError(null);
        
        // Query Firestore for event with matching UUID
        const eventsRef = collection(db, 'events');
        const q = query(eventsRef, where('uuid', '==', eventUuid));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setEventError('Event not found');
          setEventLoading(false);
          return;
        }
        
        const eventDoc = querySnapshot.docs[0];
        const event = { id: eventDoc.id, ...eventDoc.data() };
        setEventData(event);
        setEventDocId(eventDoc.id);
        setEventLoading(false);
      } catch (error) {
        console.error('Error loading event:', error);
        setEventError('Failed to load event data');
        setEventLoading(false);
      }
    };

    if (eventUuid) {
      loadEventData();
    }
  }, [eventUuid]);

  // RTDB live attendance
  useEffect(() => {
    if (!eventData?.uuid) return;
    
    const db = getDatabase();
    // Generate a unique client ID for this tab
    const clientId =
      typeof window !== "undefined" && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const presenceRef = rtdbRef(db, `presence/${eventData.uuid}/${clientId}`);
    const eventPresenceRef = rtdbRef(db, `presence/${eventData.uuid}`);

    // Mark this client as present
    set(presenceRef, { online: true, timestamp: Date.now() });
    onDisconnect(presenceRef).remove();

    // Listen for live count with proper error handling
    const unsubscribe = onValue(eventPresenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data) {
          // Count only online users (filter out null/offline entries)
          const onlineUsers = Object.values(data).filter(user => user && user.online);
          const count = onlineUsers.length;
          setLiveCount(count);
        } else {
          setLiveCount(0);
        }
      } else {
        setLiveCount(0);
      }
    }, (error) => {
      console.error('Error listening to presence:', error);
      setLiveCount(0);
    });

    return () => {
      // Remove presence on unmount (for React navigation)
      set(presenceRef, null);
      unsubscribe();
    };
  }, [eventData?.uuid]);

  // Check stream state on mount and as time passes
  useEffect(() => {
    if (!eventData || streamState === 'ended') return; // Stop interval/checks if ended
    
    setStreamState('loading');
    setCountdown(null);
    setError(null);
    setIsLoading(true);
    
    const streamStartTime = new Date(eventData.startDateTime);
    
    const checkState = () => {
      if (streamState === 'ended') return; // Guard inside interval
      const now = new Date();
      if (now < streamStartTime) {
        const diff = streamStartTime - now;
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown({ hours, mins, secs });
        setStreamState('countdown');
      } else {
        setCountdown(null);
        setStreamState('live');
      }
    };
    checkState();
    const timer = setInterval(checkState, 1000);
    return () => clearInterval(timer);
  }, [streamState, eventData]);

  // HLS video setup (only when live)
  useEffect(() => {
    if (!videoRef.current || streamState !== 'live' || !eventData) return;
    setError(null);
    setIsLoading(true);
    const video = videoRef.current;
    let hls;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(eventData.videoURL);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError('Stream connection failed. Please try again.');
          setStreamState('error');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = eventData.videoURL;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.play().catch(() => {});
      });
    } else {
      setError('Live streaming is not supported in this browser');
      setIsLoading(false);
      setStreamState('error');
    }
    return () => { if (hls) hls.destroy(); };
  }, [streamState, eventData]);

  // --- Detect stream ended by video playback ---
  useEffect(() => {
    if (!videoRef.current || streamState !== 'live') return;
    const video = videoRef.current;
    const onEnded = () => {
      if (streamState !== 'ended') setStreamState('ended');
    };
    video.addEventListener('ended', onEnded);
    // Fallback: check every second if video is at the end
    const interval = setInterval(() => {
      if (
        streamState !== 'ended' &&
        video.duration &&
        video.currentTime &&
        !video.paused &&
        Math.abs(video.duration - video.currentTime) < 1
      ) {
        setStreamState('ended');
      }
    }, 1000);
    return () => {
      video.removeEventListener('ended', onEnded);
      clearInterval(interval);
    };
  }, [streamState]);

  // --- Pseudo-live logic: Seek to correct stream time ---
  const [hasSeeked, setHasSeeked] = useState(false);
  const [seekAttempts, setSeekAttempts] = useState(0);
  useEffect(() => {
    if (!videoRef.current || streamState !== 'live' || hasSeeked || !eventData) return;
    const video = videoRef.current;
    const now = new Date();
    const streamStartTime = new Date(eventData.startDateTime);
    const elapsed = Math.floor((now - streamStartTime) / 1000);

    const seekToLivePosition = () => {
      if (!video.duration) return;
      if (elapsed < 0) {
        video.currentTime = 0;
        setHasSeeked(true);
        setIsLoading(false);
        video.play().catch(() => {});
        return;
      }
      if (elapsed >= video.duration) {
        setStreamState('ended');
        video.currentTime = video.duration;
        video.pause();
        setHasSeeked(true);
        setIsLoading(false);
        return;
      }
      // Try to seek to the live position
      video.currentTime = elapsed;
      setSeekAttempts(prev => prev + 1);
      // If seeking fails after multiple attempts, start from beginning
      if (seekAttempts >= 3) {
        video.currentTime = 0;
        setHasSeeked(true);
        setIsLoading(false);
        video.play().catch(() => {});
        return;
      }
      // Check if seek was successful after a short delay
      setTimeout(() => {
        if (Math.abs(video.currentTime - elapsed) > 5) {
          seekToLivePosition();
        } else {
          setHasSeeked(true);
          setIsLoading(false);
          video.play().catch(() => {});
        }
      }, 500);
    };

    const onCanPlay = () => {
      seekToLivePosition();
    };
    const onLoadedMetadata = () => {
      setTimeout(seekToLivePosition, 1000);
    };
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [streamState, hasSeeked, seekAttempts, eventData]);

  // Reset seek state when streamState changes
  useEffect(() => {
    setHasSeeked(false);
    setSeekAttempts(0);
  }, [streamState]);

  // Overlay state for fade-out animation
  const [showOverlay, setShowOverlay] = useState(true);
  useEffect(() => {
    if (hasSeeked && !isLoading) {
      // Hold overlay for 2s, then fade out for 0.7s, then remove from DOM
      const timeout = setTimeout(() => setShowOverlay(false), 2700);
      return () => clearTimeout(timeout);
    } else {
      setShowOverlay(true);
    }
  }, [hasSeeked, isLoading]);

  // Debug: Update video timestamp
  useEffect(() => {
    if (!videoRef.current || streamState !== 'live') return;
    
    const video = videoRef.current;
    const updateTime = () => {
      setCurrentVideoTime(video.currentTime);
    };
    
    video.addEventListener('timeupdate', updateTime);
    return () => video.removeEventListener('timeupdate', updateTime);
  }, [streamState]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  // --- UI RENDER LOGIC ---
  
  // Event loading state
  if (eventLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading event...</p>
        </div>
      </div>
    );
  }

  // Event error state
  if (eventError) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2 text-white">Event Not Found</h2>
          <p className="text-neutral-400 mb-4">{eventError}</p>
          <button onClick={() => window.history.back()} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">Go Back</button>
        </div>
      </div>
    );
  }

  // No event data
  if (!eventData) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center">
          <div className="text-neutral-500 text-6xl mb-4">📺</div>
          <h2 className="text-2xl font-bold mb-2 text-white">Event Not Found</h2>
          <p className="text-neutral-400">The requested event could not be found.</p>
        </div>
      </div>
    );
  }

  if (streamState === 'loading') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white text-lg">Connecting...</p>
        </div>
      </div>
    );
  }
  if (streamState === 'countdown' && countdown) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-white mb-4">{eventData.title}</h1>
          <h2 className="text-4xl text-white font-semibold mb-2">
            Live class starts in{' '}
            <span className="inline-block min-w-[2ch] text-center animate-pulse">{countdown.hours.toString().padStart(2, '0')}</span>
            :
            <span className="inline-block min-w-[2ch] text-center animate-pulse">{countdown.mins.toString().padStart(2, '0')}</span>
            :
            <span className="inline-block min-w-[2ch] text-center animate-pulse">{countdown.secs.toString().padStart(2, '0')}</span>
          </h2>
          <p className="border border-neutral-900 rounded-md px-2 py-1 text-neutral-500">Event ID: {eventData.uuid}</p>
        </div>
      </div>
    );
  }
  if (streamState === 'ended') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center">
          <div className="text-neutral-500 text-6xl mb-4">📺</div>
          <h2 className="text-2xl font-bold mb-2 text-white">Live class ended</h2>
          <p className="text-neutral-400">We hope you enjoyed the live session.</p>
        </div>
      </div>
    );
  }
  if (streamState === 'error') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">📡</div>
          <p className="text-red-600 text-xl mb-2 font-semibold">Stream Connection Failed</p>
          <p className="text-neutral-400 mb-4">Unable to connect to the live stream. Please check your connection and try again.</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">Reconnect to Stream</button>
        </div>
      </div>
    );
  }

  // Only show video when live and hasSeeked and not loading
  // Show Connecting... until video is ready at correct position
  if (streamState === 'live' && hasSeeked && !isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Header */}
        <header className="fixed top-0 left-0 w-full z-30 bg-black text-white flex items-center justify-between h-16 px-11 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">{eventData.title}</span>
            <span className="inline-block text-xs font-semibold bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 align-middle ml-1">LIVE</span>
          </div>
          <div className="flex items-center gap-8">
            <nav className="flex items-center gap-8">
              <a href="#" className="uppercase tracking-wide text-sm font-medium hover:text-neutral-300">Chat</a>
              <a href="#" className="uppercase tracking-wide text-sm font-medium hover:text-neutral-300">Speakers</a>
            </nav>
            <span className="flex items-center gap-1 text-xs bg-neutral-800 rounded px-3 py-1 ml-6">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5Z"/></svg>
              {liveCount} users
            </span>
          </div>
        </header>
        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center w-full pt-24 pb-32 relative">
          <div className="relative flex flex-row items-stretch justify-center w-full gap-6 transition-all duration-500" style={{ minHeight: '400px' }}>
            {/* Video + Controls */}
            <div className={`flex flex-col items-center justify-center transition-all duration-500 w-full max-w-3xl aspect-video ${showChat ? '' : ''}`} style={{ transitionProperty: 'margin' }}>
              <div className="w-full h-full shadow-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-800/60 flex items-center justify-center relative overflow-hidden transition-all duration-500 p-0">
                {error ? (
                  <div className="text-red-400 text-lg">{error}</div>
                ) : (
                  <div className="relative w-full h-full">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-contain bg-black"
                      autoPlay
                      muted={isMuted}
                      playsInline
                      controls={false}
                      disablePictureInPicture
                      disableRemotePlayback
                    />
                    {/* Debug overlay - show current video time */}
                    <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white px-3 py-1 rounded text-sm font-mono z-30">
                      Debug: {Math.floor(currentVideoTime)}s
                    </div>
                    {/* Black overlay with fade-out animation */}
                    {showOverlay && (
                      <div className={`absolute inset-0 bg-black transition-opacity duration-700 z-20 pointer-events-none ${hasSeeked && !isLoading ? 'opacity-0' : 'opacity-100'}`}></div>
                    )}
                  </div>
                )}
            </div>
            </div>
            {/* Chat Box (flex, perfectly aligned) */}
            {showChat && (
              <div className="w-96 h-full aspect-video max-w-2xl bg-black border border-neutral-800 shadow-2xl flex flex-col p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-black">
                  <span className="font-semibold text-g text-neutral-200">Chat</span>
                  <button onClick={() => setShowChat(false)} className="p-1 rounded hover:bg-neutral-800">
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto h-full">
                  <div className="text-neutral-400 text-center text-sm mt-8">Ashish has changed the chat view to host only!</div>
                    </div>
              </div>
            )}
          </div>
          {/* Controls Bar fixed at bottom center */}
          <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 flex gap-8 bg-black bg-opacity-70 rounded-full px-6 py-4 shadow-lg border border-neutral-800">
            {/* Join Audio */}
            <button
              onClick={toggleMute}
              className="relative h-8 w-10 flex flex-col items-center justify-center text-white hover:text-blue-400 focus:outline-none cursor-pointer group"
            >
              {isMuted ? (
                <VolumeX className="w-6 h-6" />
              ) : (
                <Volume2 className="w-6 h-6" />
              )}
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 bg-black bg-opacity-90 text-xs text-white px-3 py-1 rounded shadow-lg whitespace-nowrap z-10">
                Join Audio
                <span className='absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-black bg-opacity-90 rotate-45'></span>
              </span>
            </button>
            {/* Leave Meeting */}
            <button className="relative h-8 w-10 flex flex-col items-center justify-center text-white hover:text-red-400 focus:outline-none cursor-pointer group">
              <PhoneOff className="w-6 h-6" />
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 bg-black bg-opacity-90 text-xs text-white px-3 py-1 rounded shadow-lg whitespace-nowrap z-10">
                Leave
                <span className='absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-black bg-opacity-90 rotate-45'></span>
              </span>
            </button>
            {/* Chat */}
            <button
              className="relative h-8 w-10 flex flex-col items-center justify-center text-white hover:text-blue-400 focus:outline-none cursor-pointer group"
              onClick={() => setShowChat((v) => !v)}
            >
              <MessageSquare className="w-6 h-6" />
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 bg-black bg-opacity-90 text-xs text-white px-3 py-1 rounded shadow-lg whitespace-nowrap z-10">
                Chat
                <span className='absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-black bg-opacity-90 rotate-45'></span>
              </span>
            </button>
            {/* Reactions */}
            <button className="relative h-8 w-10 flex flex-col items-center justify-center text-white hover:text-yellow-400 focus:outline-none cursor-pointer group">
              <Smile className="w-6 h-6" />
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 bg-black bg-opacity-90 text-xs text-white px-3 py-1 rounded shadow-lg whitespace-nowrap z-10">
                Reactions
                <span className='absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-black bg-opacity-90 rotate-45'></span>
              </span>
            </button>
              </div>
          </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
              <header className="fixed top-0 left-0 w-full z-30 bg-black text-white flex items-center justify-between h-16 px-12 border-b border-neutral-800">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold">{eventData.title}</span>
            <span className="inline-block text-xs font-semibold bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 align-middle ml-1">LIVE</span>
          </div>
          <div className="flex items-center gap-8">
            <nav className="flex items-center gap-8">
              <a href="#" className="uppercase tracking-wide text-sm font-medium hover:text-neutral-300">Chat</a>
              <a href="#" className="uppercase tracking-wide text-sm font-medium hover:text-neutral-300">Speakers</a>
            </nav>
            <span className="flex items-center gap-1 text-xs bg-neutral-800 rounded px-3 py-1 ml-6">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5Z"/></svg>
              {liveCount} users
            </span>
          </div>
        </header>
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center w-full pt-24 pb-32 relative">
        <div className="relative flex flex-row items-stretch justify-center w-full gap-6 transition-all duration-500" style={{ minHeight: '400px' }}>
          {/* Video + Controls */}
          <div className={`flex flex-col items-center justify-center transition-all duration-500 w-full max-w-3xl aspect-video ${showChat ? '' : ''}`} style={{ transitionProperty: 'margin' }}>
            <div className="w-full h-full shadow-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-800/60 flex items-center justify-center relative overflow-hidden transition-all duration-500 p-0">
              {error ? (
                <div className="text-red-400 text-lg">{error}</div>
              ) : (
                                  <div className="relative w-full h-full">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-contain bg-black"
                      autoPlay
                      muted={isMuted}
                      playsInline
                      controls={false}
                      disablePictureInPicture
                      disableRemotePlayback
                    />
                    {/* Debug overlay - show current video time */}
                    <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white px-3 py-1 rounded text-sm font-mono z-30">
                      Debug: {Math.floor(currentVideoTime)}s
                    </div>
                    {/* Black overlay with fade-out animation */}
                    {showOverlay && (
                      <div className={`absolute inset-0 bg-black transition-opacity duration-700 z-20 pointer-events-none ${hasSeeked && !isLoading ? 'opacity-0' : 'opacity-100'}`}></div>
                    )}
                  </div>
              )}
          </div>
          </div>
          {/* Chat Box (flex, perfectly aligned) */}
          {showChat && (
            <div className="w-96 h-full aspect-video max-w-2xl bg-black border border-neutral-800 shadow-2xl flex flex-col p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-black">
                <span className="font-semibold text-g text-neutral-200">Chat</span>
                <button onClick={() => setShowChat(false)} className="p-1 rounded hover:bg-neutral-800">
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto h-full">
                <div className="text-neutral-400 text-center text-sm mt-8">Ashish has changed the chat view to host only!</div>
                  </div>
            </div>
          )}
        </div>
        {/* Controls Bar fixed at bottom center */}
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 flex gap-8 bg-black bg-opacity-70 rounded-full px-6 py-4 shadow-lg border border-neutral-800">
          {/* Join Audio */}
          <button
            onClick={toggleMute}
            className="relative h-8 w-10 flex flex-col items-center justify-center text-white hover:text-blue-400 focus:outline-none cursor-pointer group"
          >
            {isMuted ? (
              <VolumeX className="w-6 h-6" />
            ) : (
              <Volume2 className="w-6 h-6" />
            )}
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 bg-black bg-opacity-90 text-xs text-white px-3 py-1 rounded shadow-lg whitespace-nowrap z-10">
              Join Audio
              <span className='absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-black bg-opacity-90 rotate-45'></span>
            </span>
          </button>
          {/* Leave Meeting */}
          <button className="relative h-8 w-10 flex flex-col items-center justify-center text-white hover:text-red-400 focus:outline-none cursor-pointer group">
            <PhoneOff className="w-6 h-6" />
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 bg-black bg-opacity-90 text-xs text-white px-3 py-1 rounded shadow-lg whitespace-nowrap z-10">
              Leave
              <span className='absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-black bg-opacity-90 rotate-45'></span>
            </span>
          </button>
          {/* Chat */}
          <button
            className="relative h-8 w-10 flex flex-col items-center justify-center text-white hover:text-blue-400 focus:outline-none cursor-pointer group"
            onClick={() => setShowChat((v) => !v)}
          >
            <MessageSquare className="w-6 h-6" />
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 bg-black bg-opacity-90 text-xs text-white px-3 py-1 rounded shadow-lg whitespace-nowrap z-10">
              Chat
              <span className='absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-black bg-opacity-90 rotate-45'></span>
            </span>
          </button>
          {/* Reactions */}
          <button className="relative h-8 w-10 flex flex-col items-center justify-center text-white hover:text-yellow-400 focus:outline-none cursor-pointer group">
            <Smile className="w-6 h-6" />
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 bg-black bg-opacity-90 text-xs text-white px-3 py-1 rounded shadow-lg whitespace-nowrap z-10">
              Reactions
              <span className='absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-black bg-opacity-90 rotate-45'></span>
            </span>
          </button>
            </div>
        </main>
    </div>
  );
} 