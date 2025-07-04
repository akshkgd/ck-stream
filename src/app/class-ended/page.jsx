import React from 'react';

export default function ClassEndedPage() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50 min-h-screen">
      <div className="text-center">
        <div className="text-neutral-500 text-6xl mb-4">📺</div>
        <h2 className="text-2xl font-bold mb-2 text-white">Live class ended</h2>
        <p className="text-neutral-400">We hope you enjoyed the live session.</p>
      </div>
    </div>
  );
}
