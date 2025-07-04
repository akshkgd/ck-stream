# HLS Video Player Setup

This project includes a YouTube-style live streaming page with a custom HLS-based video player using hls.js.

## Features

- 🎥 Custom HLS video player with hls.js
- ⏰ Countdown timer before stream starts
- 🔄 Pseudo-live playback (seeks to correct position based on stream start time)
- 🚫 Restricted user controls (no pause, no seeking, no keyboard controls)
- 🔊 Mute/unmute functionality
- 📱 Responsive design
- 🎯 time display from how long stream is happening

## Setup Instructions

### 1. Install Dependencies

```bash
npm install hls.js
```

### 2. Prepare HLS Video Files

Create a `public/videos/` directory and add your HLS video files:

```
public/
└── videos/
    ├── test-stream.m3u8          # Main manifest file
    ├── test-stream_0.ts          # Video segment 1
    ├── test-stream_1.ts          # Video segment 2
    ├── test-stream_2.ts          # Video segment 3
    └── ...                       # More segments
```

### 3. HLS Video Format

Your HLS manifest (`test-stream.m3u8`) should look like this:

```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
test-stream_0.ts
#EXTINF:10.0,
test-stream_1.ts
#EXTINF:10.0,
test-stream_2.ts
#EXT-X-ENDLIST
```

### 4. Stream Configuration

Update the stream start time in `src/app/watch-hls/[slug]/page.js`:

```javascript
const STREAM_START_TIME = new Date('2025-07-03T14:30:00+05:30'); // Your start time
```

### 5. Video Sources

The player expects videos at `/videos/[slug].m3u8`. For example:
- URL: `/watch-hls/my-video`
- Video file: `/videos/my-video.m3u8`

## How It Works

### Pseudo-Live Playback

1. **Stream Start Time**: Set a fixed start time for the stream
2. **Elapsed Time Calculation**: On page load, calculate how much time has passed since the stream started
3. **Video Seeking**: Seek the video to the correct position based on elapsed time
4. **Real-time Sync**: The video plays from the correct position, simulating live playback

### User Control Restrictions

- **No Pause**: Video automatically resumes if paused
- **No Seeking**: Any seeking attempts are blocked and reset to correct position
- **No Keyboard Controls**: Space, arrow keys, etc. are disabled
- **No Speed Control**: Playback speed cannot be changed
- **Mute Only**: Users can only mute/unmute the video

### Edge Cases Handled

- **Video Duration Not Available**: Waits for `loadedmetadata` event
- **HLS Load Failures**: Shows error message with retry option
- **Stream Ended**: Shows "Stream has ended" message when video finishes
- **Browser Compatibility**: Falls back to native HLS support for Safari

## Testing

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Visit the HLS player**:
   - Go to `/watch-hls/test-stream`
   - Or click "📺 HLS Video Player" on the home page

3. **Test scenarios**:
   - **Before stream**: Shows countdown timer
   - **During stream**: Video plays from correct position
   - **After stream**: Shows "Stream has ended" message
   - **Try to pause**: Video resumes automatically
   - **Try to seek**: Position resets to correct time

## Creating HLS Videos

### Using FFmpeg

```bash
# Convert a video to HLS format
ffmpeg -i input.mp4 -profile:v baseline -level 3.0 -start_number 0 -hls_time 10 -hls_list_size 0 -f hls public/videos/test-stream.m3u8
```

### Using Online Tools

- **Bunny Stream**: Upload video and get HLS URL
- **Cloudflare Stream**: Upload video and get HLS manifest
- **AWS MediaConvert**: Convert videos to HLS format

## Customization

### Video Player Options

```javascript
const hls = new Hls({
  enableWorker: true,        // Enable web workers
  lowLatencyMode: true,      // Low latency mode
  backBufferLength: 90,      // Buffer length in seconds
  maxBufferLength: 30,       // Max buffer length
  maxMaxBufferLength: 600,   // Max max buffer length
});
```

### UI Customization

- **Colors**: Modify Tailwind classes
- **Layout**: Adjust responsive breakpoints
- **Controls**: Add more custom controls
- **Animations**: Customize loading and transition animations

## Browser Support

- **Chrome/Edge**: Full hls.js support
- **Firefox**: Full hls.js support
- **Safari**: Native HLS support (fallback)
- **Mobile**: Works on iOS and Android

## Production Considerations

- **CDN**: Serve HLS files from a CDN for better performance
- **CORS**: Ensure proper CORS headers for video files
- **Error Handling**: Add more robust error handling
- **Analytics**: Track video playback metrics
- **Accessibility**: Add keyboard navigation and screen reader support 