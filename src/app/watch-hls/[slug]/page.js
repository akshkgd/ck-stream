'use client';

import { useEffect, useRef, useState, use } from 'react';
import Hls from 'hls.js';

// --- CONFIG ---
const HLS_URL = 'https://vz-09b5be34-aef.b-cdn.net/429e492d-a215-4a5a-961a-3fb277fd9c24/playlist.m3u8';
const STREAM_START_TIME = new Date('2025-07-03T11:58:00+05:30'); // IST

export default function WatchHLSPage({ params }) {
  const { slug } = use(params);
  const videoRef = useRef(null);
  const [pageState, setPageState] = useState('loading'); // 'loading' | 'countdown' | 'live' | 'ended' | 'error'
  const [countdown, setCountdown] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [streamEnded, setStreamEnded] = useState(false);
  const [videoDuration, setVideoDuration] = useState(null); // null until known
  const [currentTime, setCurrentTime] = useState(0);
  const [hasSeeked, setHasSeeked] = useState(false);

  // --- Loader and state check on mount ---
  useEffect(() => {
    setPageState('loading');
    setCountdown(null);
    setError(null);
    setStreamEnded(false);
    setIsLoading(true);
    setHasSeeked(false);
    
    const now = new Date();
    
    // Initial check: if we're way past stream start time (more than 2 hours), assume ended
    const twoHoursAfterStart = new Date(STREAM_START_TIME.getTime() + 2 * 60 * 60 * 1000);
    if (now > twoHoursAfterStart) {
      setPageState('ended');
      setCountdown(null);
      return;
    }
    
    // Wait for video duration to be known before deciding if ended
    let timer;
    const checkState = () => {
      const now = new Date();
      if (videoDuration) {
        const streamEnd = new Date(STREAM_START_TIME.getTime() + videoDuration * 1000);
        if (now > streamEnd) {
          setPageState('ended');
          setCountdown(null);
          return;
        }
      }
      if (now < STREAM_START_TIME) {
        const diff = STREAM_START_TIME - now;
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown({ mins, secs });
        setPageState('countdown');
      } else {
        setCountdown(null);
        setPageState('live');
      }
    };
    checkState();
    timer = setInterval(checkState, 1000);
    return () => clearInterval(timer);
  }, [slug, videoDuration]);

  // --- HLS.js setup ---
  useEffect(() => {
    if (!videoRef.current || pageState !== 'live') return;
    setError(null);
    setIsLoading(true);
    setHasSeeked(false);
    setStreamEnded(false);
    const video = videoRef.current;
    let hls;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(HLS_URL);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError('Stream connection failed. Please try again.');
          setPageState('error');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = HLS_URL;
      video.addEventListener('loadedmetadata', () => setIsLoading(false));
    } else {
      setError('Live streaming is not supported in this browser');
      setIsLoading(false);
      setPageState('error');
    }
    return () => { if (hls) hls.destroy(); };
  }, [slug, pageState]);

  // --- Pseudo-live logic ---
  useEffect(() => {
    if (!videoRef.current || pageState !== 'live' || hasSeeked) return;
    const video = videoRef.current;
    const onCanPlay = () => {
      setVideoDuration(video.duration);
      const now = new Date();
      const elapsed = Math.floor((now - STREAM_START_TIME) / 1000);
      if (elapsed < 0) return; // before stream
      if (elapsed >= video.duration) {
        setStreamEnded(true);
        setPageState('ended');
        video.currentTime = 0;
        video.pause();
        return;
      }
      // Only seek if buffered, else start from 0
      let canSeek = false;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= elapsed && elapsed <= video.buffered.end(i)) {
          canSeek = true;
          break;
        }
      }
      if (canSeek) {
        video.currentTime = elapsed;
      } else {
        video.currentTime = 0;
      }
      setHasSeeked(true);
      video.play().catch(() => {});
    };
    video.addEventListener('canplay', onCanPlay);
    return () => video.removeEventListener('canplay', onCanPlay);
  }, [slug, pageState, hasSeeked]);

  // --- Track current time ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  // --- Mute toggle ---
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  // --- Format time ---
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // --- Lucide Volume Icon SVG ---
  const LucideVolume = (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12a7 7 0 00-7-7m7 7a7 7 0 01-7 7" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Loader always shows first */}
      {pageState === 'loading' && (
        <div className="fixed inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50">
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg text-neutral-500 font-medium">Checking stream status...</p>
          </div>
        </div>
      )}
      {/* Countdown */}
      {pageState === 'countdown' && countdown && (
        <div className="fixed inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-blue-600 text-6xl mb-4">📺</div>
            <h1 className="text-4xl md:text-4xl font-bold text-neutral-950 ">
              Live class starts in {countdown.mins.toString().padStart(2, '0')}:{countdown.secs.toString().padStart(2, '0')}
            </h1>
            <p className="text-xl text-neutral-600">Get ready for the live broadcast!</p>
          </div>
        </div>
      )}
      {/* Error */}
      {pageState === 'error' && (
        <div className="fixed inset-0 bg-neutral-100 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">📡</div>
            <p className="text-red-600 text-xl mb-2 font-semibold">Stream Connection Failed</p>
            <p className="text-neutral-600 mb-4">Unable to connect to the live stream. Please check your connection and try again.</p>
            <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">Reconnect to Stream</button>
          </div>
        </div>
      )}
      {/* Stream Ended */}
      {pageState === 'ended' && (
        <div className="fixed inset-0 bg-neutral-100 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-neutral-500 text-6xl mb-4">📺</div>
            <h2 className="text-2xl font-bold mb-2 text-neutral-800">Live Stream Ended</h2>
            <p className="text-neutral-600">The live stream has concluded. Thanks for watching!</p>
          </div>
        </div>
      )}
      {/* Main Content */}
      <div className="flex flex-col lg:flex-row h-screen">
        {/* Video Section */}
        <div className="flex-1 bg-black relative flex items-center justify-center">
          <div className="relative w-full max-w-5xl aspect-video mx-auto">
            {/* Only render video and controls when live */}
            {pageState === 'live' && (
              <>
                {/* Join Audio Button */}
                {isMuted && !isLoading && !error && !streamEnded && (
                  <button
                    onClick={toggleMute}
                    className="fixed bottom-8 left-8 z-30 flex items-center bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-3 rounded-full shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    {LucideVolume}
                    Join Audio
                  </button>
                )}
                {isLoading && !error && !streamEnded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-neutral-700 text-lg">Connecting to live stream...</p>
                      <p className="text-neutral-500 text-sm mt-2">Please wait while we establish the connection</p>
                    </div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain bg-neutral-800"
                  autoPlay
                  muted={isMuted}
                  playsInline
                  controls={false}
                  disablePictureInPicture
                  disableRemotePlayback
                  style={{ background: '#262626' }}
                />
                {/* Controls */}
                {!isLoading && !error && !streamEnded && (
                  <div className="absolute bottom-4 right-4 flex items-center space-x-4 z-20">
                    <div className="bg-black bg-opacity-80 px-3 py-1 rounded text-sm text-white font-medium">
                      {formatTime(currentTime)} / {formatTime(videoDuration)}
                    </div>
                    <button
                      onClick={toggleMute}
                      className="bg-black bg-opacity-80 p-2 rounded hover:bg-opacity-90 transition-all"
                    >
                      {isMuted ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L5.5 14H3a1 1 0 01-1-1V7a1 1 0 011-1h2.5l3.883-3.707zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L5.5 14H3a1 1 0 01-1-1V7a1 1 0 011-1h2.5l3.883-3.707zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
                {/* Live badge */}
                {!isLoading && !error && !streamEnded && (
                  <div className="absolute top-4 left-4 z-20">
                    <div className="bg-red-600 text-white px-2 py-1 rounded text-sm font-semibold flex items-center">
                      <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                      LIVE
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {/* Chat Placeholder */}
        <div className="w-full lg:w-80 bg-neutral-50 border-l border-neutral-200 flex flex-col">
          <div className="p-4 border-b border-neutral-200 bg-white">
            <h2 className="text-lg font-semibold text-neutral-800">Live Chat</h2>
            <p className="text-sm text-neutral-500">Join the conversation</p>
          </div>
          <div className="flex-1 p-4">
            <div className="text-center py-8">
              <div className="text-neutral-400 text-4xl mb-2">💬</div>
              <p className="text-neutral-500">Chat functionality coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 