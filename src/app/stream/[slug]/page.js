"use client";
import { useEffect, useRef, useState, use } from 'react';
import Hls from 'hls.js';

// --- CONFIG ---
const HLS_URL = 'https://vz-09b5be34-aef.b-cdn.net/429e492d-a215-4a5a-961a-3fb277fd9c24/playlist.m3u8';
const STREAM_START_TIME = new Date('2025-07-03T20:15:00+05:30'); // IST

// --- HeaderBar ---
function HeaderBar() {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b bg-white sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <img src="/vercel.svg" alt="Logo" className="h-7 w-7" />
        <span className="font-semibold text-lg">Sandmeyer Reaction & Gattermann Reaction</span>
      </div>
      <div className="flex items-center gap-8">
        <div className="text-sm text-neutral-600">1:24:41 / 1:30:00</div>
        <div className="flex items-center gap-2 text-neutral-600">
          <span className="inline-block w-5 h-5 bg-neutral-200 rounded-full text-center">👤</span>
          <span>2.3K</span>
        </div>
        <button className="px-4 py-2 rounded bg-neutral-100 text-neutral-700 font-medium">CLASS SETTINGS</button>
        <button className="px-4 py-2 rounded bg-red-100 text-red-700 font-medium">END CLASS</button>
      </div>
    </header>
  );
}

// --- MainContent (Whiteboard/Slides) ---
function MainContent() {
  return (
    <main className="flex-1 bg-white flex flex-col items-center justify-center p-8 min-h-[600px]">
      {/* TODO: Replace with dynamic whiteboard/slides */}
      <div className="w-full max-w-2xl bg-white rounded-lg shadow p-6 border">
        <div className="mb-4 text-blue-700 font-bold text-lg">unacademy</div>
        <div className="mb-4 font-medium">4. PQ is a double ordinate of the parabola y² = 8x. If the normal at P intersect the line passing through Q and parallel to x-axis at G, then locus of G is a parabola with</div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>(A) vertex (8, 0)</div>
          <div>(B) focus (10, 0)</div>
          <div>(C) directrix as the line x=6</div>
          <div>(D) length of latus rectum equal to 8</div>
        </div>
        <img src="/public/slide-placeholder.png" alt="Slide" className="w-full max-w-xs mx-auto my-4" />
        {/* TODO: Add drawing tools, pen, highlight, etc. */}
      </div>
    </main>
  );
}

// --- HLSPlayer (pseudo-live logic) ---
function HLSPlayer({ isMuted, setIsMuted, streamEnded, setStreamEnded, setPageState }) {
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeeked, setHasSeeked] = useState(false);
  const [seekAttempts, setSeekAttempts] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setHasSeeked(false);
    setSeekAttempts(0);
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
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = HLS_URL;
      video.addEventListener('loadedmetadata', () => setIsLoading(false));
    }
    return () => { if (hls) hls.destroy(); };
  }, []);

  // Pseudo-live logic
  useEffect(() => {
    if (!videoRef.current || hasSeeked) return;
    const video = videoRef.current;
    const seekToLivePosition = () => {
      const now = new Date();
      const elapsed = Math.floor((now - STREAM_START_TIME) / 1000);
      if (elapsed < 0) {
        video.currentTime = 0;
        setHasSeeked(true);
        video.play().catch(() => {});
        return;
      }
      if (video.duration && elapsed >= video.duration) {
        setStreamEnded(true);
        setPageState('ended');
        video.currentTime = video.duration;
        video.pause();
        setHasSeeked(true);
        return;
      }
      video.currentTime = elapsed;
      setSeekAttempts(prev => prev + 1);
      if (seekAttempts >= 3) {
        video.currentTime = 0;
        setHasSeeked(true);
        video.play().catch(() => {});
        return;
      }
      setTimeout(() => {
        if (Math.abs(video.currentTime - elapsed) > 5) {
          seekToLivePosition();
        } else {
          setHasSeeked(true);
          video.play().catch(() => {});
        }
      }, 500);
    };
    const onCanPlay = () => {
      setVideoDuration(video.duration);
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
  }, [hasSeeked, seekAttempts, setStreamEnded, setPageState]);

  // Ended event
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnded = () => {
      setStreamEnded(true);
      setPageState('ended');
    };
    video.addEventListener('ended', onEnded);
    return () => video.removeEventListener('ended', onEnded);
  }, [setStreamEnded, setPageState]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-neutral-700 text-lg">Connecting to live stream...</p>
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
      {!isLoading && !streamEnded && (
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = !videoRef.current.muted;
              setIsMuted(!isMuted);
            }
          }}
          className="absolute bottom-4 right-4 bg-black bg-opacity-80 p-2 rounded hover:bg-opacity-90 transition-all z-20"
        >
          {isMuted ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L5.5 14H3a1 1 0 01-1-1V7a1 1 0 011-1h2.5l3.883-3.707zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L5.5 14H3a1 1 0 01-1-1h2.5l3.883-3.707zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      )}
      {/* Live badge */}
      {!isLoading && !streamEnded && (
        <div className="absolute top-4 left-4 z-20">
          <div className="bg-red-600 text-white px-2 py-1 rounded text-sm font-semibold flex items-center">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
            LIVE
          </div>
        </div>
      )}
    </div>
  );
}

// --- Poll (placeholder) ---
function Poll() {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="font-semibold mb-2">Poll 12</div>
      {/* TODO: Add poll logic and results */}
      <div className="h-24 flex items-center justify-center text-neutral-400">Poll functionality coming soon</div>
    </div>
  );
}

// --- Chat (placeholder) ---
function Chat() {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex-1 flex flex-col">
      <div className="font-semibold mb-2">Live Chat</div>
      {/* TODO: Add chat messages and input */}
      <div className="flex-1 flex items-center justify-center text-neutral-400">Chat functionality coming soon</div>
    </div>
  );
}

// --- RightSidebar ---
function RightSidebar({ isMuted, setIsMuted, streamEnded, setStreamEnded, pageState, setPageState }) {
  return (
    <aside className="w-full max-w-xs flex flex-col gap-4 p-4 bg-neutral-50 border-l border-neutral-200 min-h-screen">
      <HLSPlayer isMuted={isMuted} setIsMuted={setIsMuted} streamEnded={streamEnded} setStreamEnded={setStreamEnded} setPageState={setPageState} />
      <Poll />
      <Chat />
    </aside>
  );
}

// --- Main Page ---
export default function LiveClassPage() {
  const [isMuted, setIsMuted] = useState(true);
  const [streamEnded, setStreamEnded] = useState(false);
  const [pageState, setPageState] = useState('loading'); // 'loading' | 'countdown' | 'live' | 'ended' | 'error'
  const [countdown, setCountdown] = useState(null);

  // Countdown logic
  useEffect(() => {
    setPageState('loading');
    setCountdown(null);
    setStreamEnded(false);
    const checkState = () => {
      const now = new Date();
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
    const timer = setInterval(() => {
      const now = new Date();
      if (now < STREAM_START_TIME) {
        const diff = STREAM_START_TIME - now;
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown({ mins, secs });
        setPageState('countdown');
      } else {
        setCountdown(null);
        setPageState('live');
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ended overlay
  if (pageState === 'ended' || streamEnded) {
    return (
      <div className="min-h-screen flex flex-col">
        <HeaderBar />
        <div className="flex flex-1">
          <MainContent />
          <aside className="w-full max-w-xs flex flex-col gap-4 p-4 bg-neutral-50 border-l border-neutral-200 min-h-screen">
            <div className="bg-white rounded-lg shadow p-8 flex flex-col items-center justify-center h-full">
              <div className="text-neutral-500 text-6xl mb-4">📺</div>
              <h2 className="text-2xl font-bold mb-2 text-neutral-800">Live class ended</h2>
              <p className="text-neutral-600">We hope you enjoyed the live session.</p>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // Countdown overlay
  if (pageState === 'countdown' && countdown) {
    return (
      <div className="min-h-screen flex flex-col">
        <HeaderBar />
        <div className="flex flex-1">
          <MainContent />
          <aside className="w-full max-w-xs flex flex-col gap-4 p-4 bg-neutral-50 border-l border-neutral-200 min-h-screen">
            <div className="bg-white rounded-lg shadow p-8 flex flex-col items-center justify-center h-full">
              <div className="text-blue-600 text-6xl mb-4">📺</div>
              <h1 className="text-4xl font-bold text-neutral-950 mb-2">
                Live class starts in {countdown.mins.toString().padStart(2, '0')}:{countdown.secs.toString().padStart(2, '0')}
              </h1>
              <p className="text-xl text-neutral-600">Get ready for the live broadcast!</p>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // Main layout
  return (
    <div className="min-h-screen flex flex-col">
      <HeaderBar />
      <div className="flex flex-1">
        <MainContent />
        <RightSidebar
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          streamEnded={streamEnded}
          setStreamEnded={setStreamEnded}
          pageState={pageState}
          setPageState={setPageState}
        />
      </div>
    </div>
  );
} 