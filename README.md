# Vader Vocoder PWA

A Progressive Web App that transforms your voice into a Darth Vader-like effect using real-time audio processing with the Web Audio API.

![Vader Vocoder](icons/icon-192.png)

## Features

### 🎙️ Real-Time Voice Processing
- **Live microphone input** with configurable device selection
- **Real-time audio effects** processing with minimal latency
- **Multiple output devices** support (where browser supports setSinkId)

### 🎛️ Advanced Audio Controls
- **Master Gain** - Overall volume control
- **Wet/Dry Mix** - Balance between processed and original audio
- **Multi-band EQ** - 4-band parametric equalizer (250Hz, 600Hz, 1.2kHz, 2.5kHz)
- **Filters** - Lowpass, highpass, and bandpass filtering
- **Distortion** - Waveshaping for that classic Vader growl
- **Vibrato** - Adjustable depth and rate for voice modulation
- **Robot Effect** - Ring modulation for mechanical voice tones
- **Reverb** - Convolution reverb for spatial depth
- **Compressor** - Dynamic range control with adjustable threshold
- **Noise Gate** - Automatic silence detection and gating
- **Breathing Effects** - Synthetic breathing sounds with auto-trigger

### 🎯 Preset System
- **Vader Classic** - The iconic Darth Vader sound
- **Imperial Intercom** - Communications system effect
- **Bounty Hunter** - Mandalorian-style voice modulation
- **Custom Presets** - Save and load your own configurations

### 📱 PWA Features
- **Installable** - Add to home screen on mobile devices
- **Offline Ready** - Service worker for offline functionality
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Device Auto-Detection** - Automatic audio device enumeration

## Installation & Setup

### Quick Start
1. **Clone or download** this repository
2. **Serve the files** using a local web server (required for microphone access)
3. **Open in browser** and grant microphone permissions
4. **Select devices** and click "Start"

### Local Development Server
```bash
# Using Python 3
python -m http.server 5500

# Using Node.js (http-server)
npx http-server -p 5500

# Using PHP
php -S localhost:5500
```

### Browser Requirements
- **Chrome/Edge**: Full support including output device selection
- **Firefox**: Core functionality (no output device selection)
- **Safari**: Core functionality with some limitations
- **Mobile browsers**: Supported with touch-optimized interface

### 📱 Android Installation (Samsung S22 Ultra & Other Devices)

#### Installing as PWA
1. **Open Chrome** on your Android device
2. **Navigate** to the Vader Vocoder URL
3. **Tap the menu** (three dots) → "Add to Home screen" or "Install app"
4. **Grant permissions** when prompted for microphone access
5. **Launch** from your home screen like a native app

#### Android-Specific Setup
- **Microphone Permission**: The app will automatically request microphone access on first load
- **Device Detection**: After granting permission, you'll see actual device names instead of "default"
- **Bluetooth Audio**: Pair your Bluetooth headphones/speakers in Android Settings first
- **Performance**: Android devices use optimized audio constraints for better compatibility
- **Background Audio**: Keep the app in foreground for best performance

## Usage

### Basic Operation
1. **Grant Permissions**: Allow microphone access when prompted
2. **Select Devices**: Choose your microphone and output device
3. **Choose Preset**: Start with "Vader Classic" for the iconic sound
4. **Click Start**: Begin real-time voice processing
5. **Adjust Controls**: Fine-tune the effect parameters

### Advanced Configuration
- **Latency Hint**: Choose between "interactive", "balanced", or "playback"
- **Custom EQ**: Adjust individual frequency bands for your voice
- **Effect Mixing**: Balance wet/dry signals for subtle or dramatic effects
- **Breathing Control**: Configure automatic breathing between speech

### Tips for Best Results
- **Use a headset** or helmet microphone to prevent feedback
- **Bluetooth speakers** work great for output (pair at OS level first)
- **Close microphone placement** improves the effect quality
- **Adjust noise gate** to match your speaking volume

## Technical Details

### Audio Processing Chain
```
Microphone → Highpass → Bandpass → Lowpass → 4-Band EQ → 
Robot AM → Distortion → Vibrato → Wet/Dry Mix → Reverb → 
Noise Gate → Compressor → Master Gain → Output
```

### Key Technologies
- **Web Audio API** - Real-time audio processing
- **MediaDevices API** - Microphone and device access
- **Service Workers** - Offline functionality and caching
- **Web App Manifest** - PWA installation and theming

### Performance Optimizations
- **Efficient audio graph** with minimal processing overhead
- **Smart device handling** with automatic fallbacks
- **Memory management** with proper cleanup on stop/restart
- **Browser compatibility** layers for cross-platform support

## File Structure

```
vader-vocoder-pwa/
├── vader-pwa/
│   ├── index.html          # Main application interface
│   ├── app.js              # Core audio processing logic
│   ├── style.css           # Application styling
│   ├── sw.js               # Service worker for PWA features
│   ├── manifest.webmanifest # PWA manifest
│   └── icons/              # Application icons
│       ├── icon-192.png
│       └── icon-512.png
└── README.md               # This file
```

## Troubleshooting

### Audio Cuts Out or Won't Restart
- **Recent Fix**: Improved AudioContext state management and oscillator cleanup
- **Try**: Refresh the page and restart the application
- **Check**: Browser console for specific error messages

### No Microphone Access
- **Ensure HTTPS**: Microphone requires secure context (https:// or localhost)
- **Check Permissions**: Browser may have blocked microphone access
- **Try Different Browser**: Some browsers have stricter policies

### Poor Audio Quality
- **Reduce Latency**: Set latency hint to "interactive"
- **Check Device**: Ensure microphone is working properly
- **Adjust Levels**: Lower master gain if distorting

### Device Selection Issues
- **Refresh Devices**: Click the refresh button (↻) to update device list
- **Browser Support**: Output device selection requires Chrome/Edge
- **OS Pairing**: Bluetooth devices must be paired at system level first

### 🤖 Android-Specific Troubleshooting

#### "Only Default Device" Issue
- **Grant Permission First**: The app automatically requests microphone permission on load
- **Check Status Log**: Look for "Microphone permission granted" in the status section
- **Refresh After Permission**: Click the refresh button (↻) after granting permission
- **Chrome Required**: Use Chrome browser for best Android compatibility

#### Samsung S22 Ultra Specific
- **Multiple Microphones**: Your device has multiple mics - choose the one that works best
- **Bluetooth Priority**: Samsung devices prioritize Bluetooth audio when connected
- **Performance Mode**: Enable "High Performance" in battery settings for better audio processing
- **Do Not Disturb**: Disable DND mode as it can interfere with audio permissions

#### General Android Issues
- **Background Limits**: Keep the app in foreground to prevent audio interruption
- **Battery Optimization**: Disable battery optimization for Chrome if audio cuts out
- **Storage Permission**: Ensure Chrome has storage access for PWA installation
- **Clear Cache**: Clear Chrome cache if device detection fails repeatedly

## Development

### Recent Improvements (v2.0)
- ✅ **Fixed AudioContext state management** - Proper cleanup and recreation
- ✅ **Enhanced error handling** - Graceful fallbacks for device failures
- ✅ **Improved oscillator lifecycle** - Prevents "already started" errors
- ✅ **Browser autoplay policy support** - Automatic AudioContext resumption
- ✅ **Device change detection** - Automatic device list updates
- ✅ **Stream health monitoring** - Detects device disconnection

### Contributing
1. Fork the repository
2. Create a feature branch
3. Test thoroughly across browsers
4. Submit a pull request

## License

This project is open source. Feel free to use, modify, and distribute.

## Credits

Built with the Web Audio API and modern web standards. Inspired by the iconic voice of Darth Vader from Star Wars.

---

*"The Force is strong with this one."* - Use responsibly and have fun! 🎭
