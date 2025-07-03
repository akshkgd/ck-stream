# YouTube-Style Live Stream Setup

This project includes a YouTube-style live streaming page with real-time chat functionality.

## Features

- 🎥 Bunny Stream video player
- 💬 Real-time chat with Firebase Firestore
- ⏰ Countdown timer before stream starts
- 📱 Responsive design (desktop/mobile)
- 🔄 Auto-play video when stream starts
- 🗑️ Automatic chat cleanup after stream ends

## Setup Instructions

### 1. Firebase Configuration

1. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Get your Firebase config from Project Settings > General > Your apps
4. Update the `.env.local` file with your actual Firebase configuration values:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-actual-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 2. Stream Times Configuration

Update the hardcoded stream times in `src/app/watch/[slug]/page.js` for each stream (use IST timezone):

```javascript
const STREAM_START_TIME = new Date('2025-07-03T20:00:00+05:30'); // Your start time in IST
const STREAM_END_TIME = new Date('2025-07-03T22:00:00+05:30'); // Your end time in IST
```

**Note**: In a production environment, you might want to fetch stream times from an API based on the stream slug.

### 3. Bunny Stream Video ID

The video player uses the URL slug as the Bunny Stream video ID. For example:
- URL: `/watch/my-video-123`
- Video source: `https://iframe.mediadelivery.net/embed/my-video-123/video`

Make sure your Bunny Stream video ID matches the URL slug you want to use.

### 4. Firestore Security Rules

Set up Firestore security rules to allow read/write access to the chat collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /chats/{chatId}/messages/{messageId} {
      allow read, write: if true; // For development - add proper auth for production
    }
  }
}
```

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Visit the home page and click "Watch Live Stream" or navigate directly to `/watch/test-stream`

3. Enter your name when prompted (stored in localStorage)

4. The page will show:
   - Countdown timer before stream starts
   - Video player when stream is live
   - Real-time chat on the right side
   - "Stream ended" message after stream ends

## File Structure

```
src/app/
├── page.js                    # Home page with link to watch
├── watch/
│   └── [slug]/
│       └── page.js           # Main watch page with all features
```

## Customization

- **Styling**: Modify Tailwind classes in the components
- **Video Player**: Replace Bunny Stream with any video provider
- **Chat Features**: Add user avatars, reactions, moderation, etc.
- **Authentication**: Add Firebase Auth for user management
- **Stream Management**: Connect to your streaming platform's API

## Production Considerations

- Add proper Firebase authentication
- Implement rate limiting for chat messages
- Add moderation features
- Use environment variables for Firebase config
- Add error handling and loading states
- Implement proper video player fallbacks 