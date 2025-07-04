"use client";

import { useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

// Firebase config from env
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getDatabase(app);

export default function FirebaseRTDBTest() {
  const [writeStatus, setWriteStatus] = useState("");
  const [readValue, setReadValue] = useState("");
  const [liveValue, setLiveValue] = useState("");

  const testWrite = async () => {
    try {
      await set(ref(db, "test/value"), "Hello RTDB!");
      setWriteStatus("✅ Write successful!");
    } catch (e) {
      setWriteStatus("❌ Write failed: " + e.message);
    }
  };

  const testRead = async () => {
    try {
      const snapshot = await get(ref(db, "test/value"));
      if (snapshot.exists()) {
        setReadValue(snapshot.val());
      } else {
        setReadValue("No value found");
      }
    } catch (e) {
      setReadValue("❌ Read failed: " + e.message);
    }
  };

  // Live updates
  const subscribeLive = () => {
    onValue(ref(db, "test/value"), (snapshot) => {
      setLiveValue(snapshot.val() || "");
    });
  };

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Firebase RTDB Test</h1>
      <button
        onClick={testWrite}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-2 mr-2"
      >
        Write "Hello RTDB!"
      </button>
      <span>{writeStatus}</span>
      <br />
      <button
        onClick={testRead}
        className="bg-green-600 text-white px-4 py-2 rounded mb-2 mr-2"
      >
        Read Value
      </button>
      <span>{readValue}</span>
      <br />
      <button
        onClick={subscribeLive}
        className="bg-purple-600 text-white px-4 py-2 rounded mb-2"
      >
        Subscribe to Live Updates
      </button>
      <div className="mt-2 text-gray-700">
        <b>Live Value:</b> {liveValue}
      </div>
      <div className="mt-6 text-xs text-gray-500">
        Make sure your <code>NEXT_PUBLIC_FIREBASE_DATABASE_URL</code> is set in your .env.local.<br/>
        Example: https://your-project-id.firebaseio.com
      </div>
    </div>
  );
} 