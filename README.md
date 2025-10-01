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

## File Structure

```
Vader-Vocoder-PWA/
├── README.md              # This documentation file
├── index.html             # Main HTML file
├── app.js                 # Core application logic
├── style.css              # Styling and responsive design
├── manifest.webmanifest   # PWA manifest for installation
├── sw.js                  # Service worker for offline functionality
├── LICENSE                # MIT license
└── icons/                 # PWA icons directory
    ├── icon-192.png       # 192x192 icon
    └── icon-512.png       # 512x512 icon
```

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

### 📱 Mobile Installation

#### 🤖 Android Installation (Samsung S22 Ultra & Other Devices)

**Installing as PWA**
1. **Open Chrome** on your Android device
2. **Navigate** to the Vader Vocoder URL
3. **Tap the menu** (three dots) → "Add to Home screen" or "Install app"
4. **Grant permissions** when prompted for microphone access
5. **Launch** from your home screen like a native app

**Android-Specific Setup**
- **Microphone Permission**: The app will automatically request microphone access on first load
- **Device Detection**: After granting permission, you'll see actual device names instead of "default"
- **Bluetooth Audio**: Pair your Bluetooth headphones/speakers in Android Settings first
- **Performance**: Android devices use optimized audio constraints for better compatibility
- **Background Audio**: Keep the app in foreground for best performance
- **Auto-Updates**: The app will automatically check for GitHub updates and show an "Update Available" button

#### 🍎 iOS Installation (iPhone & iPad)

**Installing as PWA**
1. **Open Safari** on your iOS device (Chrome won't work for PWA installation)
2. **Navigate** to the Vader Vocoder URL
3. **Tap the Share button** (square with arrow up)
4. **Scroll down** and tap "Add to Home Screen"
5. **Confirm** the installation and **grant microphone permission** when prompted
6. **Launch** from your home screen - it will run in fullscreen mode

**iOS-Specific Setup**
- **Safari Required**: Only Safari can install PWAs on iOS
- **Microphone Permission**: iOS will prompt for microphone access on first use
- **Audio Optimization**: iOS devices use 44.1kHz sample rate for optimal compatibility
- **Background Limitations**: iOS may pause audio when switching apps
- **Bluetooth Support**: AirPods and other Bluetooth devices work seamlessly

## 🔄 Getting Updates from GitHub

### **How PWA Updates Work**
When you install the PWA on your device, it creates a cached version. GitHub updates don't automatically sync, but the app includes an update system:

### **Automatic Update Detection**
1. **Open your installed PWA** - it checks for updates in the background
2. **Look for "Update Available" button** - appears in the header when updates are found
3. **Click "Update Available"** - instantly updates to the latest GitHub version
4. **Check status log** - shows "Ready to start vocoding! Version 2.1" with latest features

### **Manual Update Methods**

#### **Method 1: Use Update Button (Recommended)**
- Open your installed PWA and look for the **"Update Available"** button
- Click it to instantly get the latest version from GitHub

#### **Method 2: Refresh Cache**
1. Open the PWA and check the **Status section** at the bottom
2. Look for update messages or version numbers
3. If no update detected, try closing and reopening the app

#### **Method 3: Clear Cache (If stuck on old version)**
1. **Android**: Long press PWA icon → App info → Storage & cache → Clear cache
2. **iOS**: Settings → Safari → Clear History and Website Data (affects all sites)

#### **Method 4: Reinstall PWA**
1. **Uninstall** current PWA from home screen
2. **Visit GitHub Pages URL** in browser
3. **Reinstall** fresh copy with latest updates

### **Checking Your Version**
- Open the PWA and check the **Status log** at the bottom
- Latest version shows: *"Ready to start vocoding! Version 2.1 with mobile optimizations"*

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

### 🍎 iOS-Specific Troubleshooting

#### PWA Installation Issues
- **Safari Only**: PWA installation only works in Safari, not Chrome or other browsers
- **Share Button**: Look for the share button (square with up arrow) in Safari's toolbar
- **iOS Version**: Requires iOS 11.3+ for PWA support
- **Storage Space**: Ensure sufficient storage for PWA installation

#### iPhone/iPad Audio Issues
- **Microphone Permission**: Check Settings → Privacy & Security → Microphone → Safari
- **Silent Mode**: Disable silent/mute switch - it can affect audio processing
- **Background App**: iOS may pause audio when switching apps - keep app in foreground
- **AirPods/Bluetooth**: Works great with AirPods - they'll show up in device selection
- **Sample Rate**: iOS automatically uses 44.1kHz for optimal compatibility

#### Device Detection Problems
- **Permission First**: Grant microphone permission before device names appear
- **Refresh Needed**: Tap refresh (↻) button after connecting/disconnecting devices
- **Limited Selection**: iOS may show fewer device options than Android
- **Default Fallback**: If no devices show, "Default" will use the system's preferred audio

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
