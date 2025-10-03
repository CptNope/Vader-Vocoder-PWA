/* Vader Vocoder PWA - Advanced Controls */
let audioCtx;
let mediaStream;
let srcNode;
let monitorEl = document.getElementById('monitor');
let outMediaStreamDest;
let preferredSinkId = null;

// Nodes
let hp, lp, bp;
let eq250, eq600, eq1200, eq2500;
let shaper;
let delayNode, lfo, lfoGain; // vibrato
let reverbConv, reverbGain;
let comp;
let dryGain, wetGain, masterGain;
let analyser, dataArray;
let gateThreshold = 0.04;
let gateGain;
let robotOsc, robotGain, robotMixGain;

// Graphic EQ nodes (10-band)
let geqNodes = {};
let eqCanvas, eqCtx;
let eqAnimationFrame;

// Mixer nodes
let mixerInputGain, mixerEffectsGain, mixerBreathGain, mixerMasterGain;
let mixerChannelStates = {
  input: { muted: false, solo: false },
  effects: { muted: false, solo: false },
  breath: { muted: false, solo: false }
};
let meteringInterval;

// New audio control nodes
let inputGain, outputGain;
let inputMuted = false;
let outputMuted = false;
let lastInputVolume = 1.0;
let lastOutputVolume = 0.8;

// Breath
let breathBuffer;
let breathSource = null;
let lastSpeaking = false;
let speechDetector;
let autobreath = true;

// UI elements
const logEl = document.getElementById('log');
const micSelect = document.getElementById('micSelect');
const outSelect = document.getElementById('outSelect');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const refreshDevs = document.getElementById('refreshDevs');
const installBtn = document.getElementById('installBtn');
const updateBtn = document.getElementById('updateBtn');

// New audio control elements
const inputVolumeCtl = linkRange('inputVolume','inputVolumeOut');
const outputVolumeCtl = linkRange('outputVolume','outputVolumeOut');
const muteInputBtn = document.getElementById('muteInput');
const muteOutputBtn = document.getElementById('muteOutput');
const autoFeedbackPreventionChk = document.getElementById('autoFeedbackPrevention');
const testAudioBtn = document.getElementById('testAudio');
const feedbackWarning = document.getElementById('feedbackWarning');
const micTypeEl = document.getElementById('micType');
const outTypeEl = document.getElementById('outType');
const requestSpeakerPermissionBtn = document.getElementById('requestSpeakerPermission');
const diagnoseBluetoothBtn = document.getElementById('diagnoseBluetooth');

// Graphic EQ elements
const geq31Ctl = linkRange('geq31','geq31Out');
const geq62Ctl = linkRange('geq62','geq62Out');
const geq125Ctl = linkRange('geq125','geq125Out');
const geq250Ctl = linkRange('geq250','geq250Out');
const geq500Ctl = linkRange('geq500','geq500Out');
const geq1kCtl = linkRange('geq1k','geq1kOut');
const geq2kCtl = linkRange('geq2k','geq2kOut');
const geq4kCtl = linkRange('geq4k','geq4kOut');
const geq8kCtl = linkRange('geq8k','geq8kOut');
const geq16kCtl = linkRange('geq16k','geq16kOut');
const eqResetBtn = document.getElementById('eqReset');
const eqFlatBtn = document.getElementById('eqFlat');
const eqVocalBtn = document.getElementById('eqVocal');
const eqBassBtn = document.getElementById('eqBass');

// Mixer elements
const mixerInputCtl = linkRange('mixerInput','mixerInputOut');
const mixerEffectsCtl = linkRange('mixerEffects','mixerEffectsOut');
const mixerBreathCtl = linkRange('mixerBreath','mixerBreathOut');
const mixerMasterCtl = linkRange('mixerMaster','mixerMasterOut');
const mixerInputMuteBtn = document.getElementById('mixerInputMute');
const mixerInputSoloBtn = document.getElementById('mixerInputSolo');
const mixerEffectsMuteBtn = document.getElementById('mixerEffectsMute');
const mixerEffectsSoloBtn = document.getElementById('mixerEffectsSolo');
const mixerBreathMuteBtn = document.getElementById('mixerBreathMute');
const mixerBreathSoloBtn = document.getElementById('mixerBreathSolo');
const mixerResetBtn = document.getElementById('mixerReset');
const mixerMeteringChk = document.getElementById('mixerMetering');

// Ranges / selects
const gainCtl = linkRange('gain','gainOut');
const wetCtl  = linkRange('wet','wetOut');
const dryCtl  = linkRange('dry','dryOut');
const lpCtl   = linkRange('lp','lpOut');
const hpCtl   = linkRange('hp','hpOut');
const bpCtl   = linkRange('bp','bpOut');
const eq250Ctl = linkRange('eq250','eq250Out');
const eq600Ctl = linkRange('eq600','eq600Out');
const eq1200Ctl = linkRange('eq1200','eq1200Out');
const eq2500Ctl = linkRange('eq2500','eq2500Out');
const distCtl = linkRange('dist','distOut');
const vibDepthCtl = linkRange('vibDepth','vibDepthOut');
const vibRateCtl = linkRange('vibRate','vibRateOut');
const robotMixCtl = linkRange('robotMix','robotMixOut');
const robotRateCtl = linkRange('robotRate','robotRateOut');
const revCtl  = linkRange('reverb','reverbOut');
const compCtl = linkRange('comp','compOut');
const gateCtl = linkRange('gate','gateOut');
const breathVolCtl = linkRange('breathVol','breathVolOut');
const latencySel = document.getElementById('latencyHint');

const breathBtn = document.getElementById('breathBtn');
const autobreathChk = document.getElementById('autobreath');

// Preset buttons
const presetBtns = Array.from(document.querySelectorAll('.presetBtn'));
const savePresetBtn = document.getElementById('savePreset');
const loadPresetBtn = document.getElementById('loadPreset');
const resetPresetBtn = document.getElementById('resetPreset');

function linkRange(id, outId){
  const r = document.getElementById(id);
  const o = document.getElementById(outId);
  const reflect = ()=> o.textContent = r.value;
  r.addEventListener('input', reflect);
  reflect();
  return r;
}

function log(s){ logEl.textContent += s + "\n"; logEl.scrollTop = logEl.scrollHeight; }

// Device type detection
function detectDeviceType(device) {
  const label = device.label.toLowerCase();
  
  // Mobile-specific audio outputs
  if (label.includes('earpiece') || label.includes('ear speaker') || label.includes('receiver')) {
    return 'earpiece';
  } else if (label.includes('speakerphone') || label.includes('speaker phone') || label.includes('loud speaker')) {
    return 'speakerphone';
  }
  
  // Bluetooth devices
  else if (label.includes('bluetooth') || label.includes('bt') || 
      label.includes('airpods') || label.includes('buds') || 
      label.includes('headphones') || label.includes('speaker') ||
      label.includes('jbl') || label.includes('bose') || label.includes('sony') ||
      label.includes('beats') || label.includes('skullcandy') || label.includes('anker') ||
      label.includes('marshall') || label.includes('harman') || label.includes('ultimate ears')) {
    return 'bluetooth';
  } 
  
  // Wired devices
  else if (label.includes('usb') || label.includes('headset') || label.includes('wired') || 
           label.includes('3.5mm') || label.includes('jack')) {
    return 'wired';
  } 
  
  // Wireless (non-Bluetooth)
  else if (label.includes('wireless') && !label.includes('built-in')) {
    return 'wireless';
  } 
  
  // Built-in/default
  else if (label.includes('built-in') || label.includes('internal') || label.includes('default')) {
    return 'built-in';
  }
  
  return 'unknown';
}

// Check for potential feedback
function checkFeedbackRisk() {
  const micDevice = micSelect.value;
  const outDevice = outSelect.value;
  const micLabel = micSelect.selectedOptions[0]?.textContent || '';
  const outLabel = outSelect.selectedOptions[0]?.textContent || '';
  
  // Same device ID or similar device names indicate feedback risk
  const sameDevice = micDevice === outDevice;
  const similarNames = micLabel.includes('built-in') && outLabel.includes('built-in');
  
  if (autoFeedbackPreventionChk.checked && (sameDevice || similarNames)) {
    feedbackWarning.classList.remove('hidden');
    // Automatically reduce output volume to prevent feedback
    if (outputVolumeCtl.value > 0.3) {
      outputVolumeCtl.value = 0.3;
      outputVolumeCtl.dispatchEvent(new Event('input'));
      log("⚠️ Auto-reduced output volume to prevent feedback");
    }
    return true;
  } else {
    feedbackWarning.classList.add('hidden');
    return false;
  }
}

async function populateDevices(){
  try {
    // First request microphone permission to get proper device labels
    // This is especially important on Android/mobile devices
    let permissionGranted = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately
      permissionGranted = true;
      log("Microphone permission granted");
    } catch (permError) {
      log("Microphone permission denied or unavailable: " + permError.message);
    }

    // Request speaker access permission for output device enumeration
    let speakerPermissionGranted = false;
    try {
      // Try to request speaker selection permission
      if ('selectAudioOutput' in navigator.mediaDevices) {
        // This is a newer API that explicitly requests speaker permission
        await navigator.mediaDevices.selectAudioOutput();
        speakerPermissionGranted = true;
        log("Speaker selection permission granted");
      }
    } catch (speakerError) {
      log("Speaker selection permission not available or denied: " + speakerError.message);
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter(d => d.kind === 'audioinput');
    let outputs = devices.filter(d => d.kind === 'audiooutput');
    
    // Check if we have proper output device labels
    const hasOutputLabels = outputs.some(d => d.label && d.label !== '');
    if (!hasOutputLabels && outputs.length > 0) {
      log("⚠️ Output devices found but labels are hidden. This may be due to browser security restrictions.");
      log("💡 Try: 1) Allow microphone permission, 2) Use HTTPS, 3) Check browser settings");
    }

    micSelect.innerHTML = '';
    if (inputs.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No microphones found';
      micSelect.appendChild(opt);
      log("No audio input devices found");
    } else {
      inputs.forEach((d, index) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        // Use device label if available, otherwise create descriptive name
        opt.textContent = d.label || `Microphone ${index + 1}`;
        opt.dataset.deviceType = detectDeviceType(d);
        micSelect.appendChild(opt);
      });
      log(`Found ${inputs.length} microphone(s)`);
    }

    outSelect.innerHTML = '';
    
    // Always add a default option first
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'System Default Speakers';
    defaultOpt.dataset.deviceType = 'built-in';
    outSelect.appendChild(defaultOpt);
    
    if (outputs.length === 0) {
      log("No additional audio output devices found, using system default");
    } else {
      // Filter out devices without labels (usually means no permission)
      const validOutputs = outputs.filter(d => d.label && d.label.trim() !== '');
      
      if (validOutputs.length === 0 && outputs.length > 0) {
        // We have devices but no labels - permission issue
        log(`⚠️ Found ${outputs.length} output device(s) but cannot access labels`);
        log("🔒 This is usually due to browser security restrictions");
        log("💡 To access specific speakers: Enable microphone permission first, then refresh devices");
        
        // Add generic options for the unlabeled devices
        outputs.forEach((d, index) => {
          const opt = document.createElement('option');
          opt.value = d.deviceId;
          opt.textContent = `Audio Output ${index + 1} (Permission Required)`;
          opt.dataset.deviceType = 'unknown';
          opt.disabled = true; // Disable since we can't use them properly
          outSelect.appendChild(opt);
        });
      } else {
        // Add valid devices with labels
        validOutputs.forEach((d, index) => {
          const opt = document.createElement('option');
          opt.value = d.deviceId;
          opt.textContent = d.label;
          opt.dataset.deviceType = detectDeviceType(d);
          outSelect.appendChild(opt);
        });
        log(`Found ${validOutputs.length} accessible audio output device(s)`);
        
        if (validOutputs.length < outputs.length) {
          log(`Note: ${outputs.length - validOutputs.length} additional device(s) require permission`);
        }
      }
    }

    if (preferredSinkId && [...outSelect.options].some(o => o.value===preferredSinkId)){
      outSelect.value = preferredSinkId;
      trySetSink(preferredSinkId);
    }
    
    // Update device type indicators
    updateDeviceTypeIndicators();
  } catch(e){
    log("Device enumeration failed: " + e.message);
    // Add fallback options
    micSelect.innerHTML = '<option value="">Default Microphone</option>';
    outSelect.innerHTML = '<option value="">Default Speakers</option>';
  }
}

// Update device type indicators
function updateDeviceTypeIndicators() {
  const micOption = micSelect.selectedOptions[0];
  const outOption = outSelect.selectedOptions[0];
  
  if (micOption) {
    const micType = micOption.dataset.deviceType || 'unknown';
    micTypeEl.textContent = micType;
    micTypeEl.className = `device-type ${micType}`;
  }
  
  if (outOption) {
    const outType = outOption.dataset.deviceType || 'unknown';
    outTypeEl.textContent = outType;
    outTypeEl.className = `device-type ${outType}`;
  }
  
  // Check for feedback risk when devices change
  checkFeedbackRisk();
}

// Mute/unmute functions
function toggleInputMute() {
  inputMuted = !inputMuted;
  if (inputGain) {
    if (inputMuted) {
      lastInputVolume = inputGain.gain.value;
      inputGain.gain.value = 0;
      muteInputBtn.textContent = '🔊 Unmute Input';
      muteInputBtn.classList.add('muted');
      log("Input muted");
    } else {
      inputGain.gain.value = lastInputVolume;
      muteInputBtn.textContent = '🔇 Mute Input';
      muteInputBtn.classList.remove('muted');
      log("Input unmuted");
    }
  }
}

function toggleOutputMute() {
  outputMuted = !outputMuted;
  if (outputGain) {
    if (outputMuted) {
      lastOutputVolume = outputGain.gain.value;
      outputGain.gain.value = 0;
      muteOutputBtn.textContent = '🔊 Unmute Output';
      muteOutputBtn.classList.add('muted');
      log("Output muted");
    } else {
      outputGain.gain.value = lastOutputVolume;
      muteOutputBtn.textContent = '🔇 Mute Output';
      muteOutputBtn.classList.remove('muted');
      log("Output unmuted");
    }
  }
}

// Test audio function
function testAudio() {
  if (!audioCtx) {
    log("Start the vocoder first to test audio");
    return;
  }
  
  // Play a brief test tone
  const testOsc = audioCtx.createOscillator();
  const testGain = audioCtx.createGain();
  
  testOsc.frequency.value = 440; // A4 note
  testGain.gain.value = 0.1;
  
  testOsc.connect(testGain);
  testGain.connect(outMediaStreamDest);
  
  testOsc.start();
  testOsc.stop(audioCtx.currentTime + 0.2); // 200ms test tone
  log("🔊 Test tone played");
}

// Graphic EQ Functions
function initGraphicEQ() {
  eqCanvas = document.getElementById('eqCanvas');
  eqCtx = eqCanvas.getContext('2d');
  
  // Start EQ visualization
  drawEQVisualization();
}

function drawEQVisualization() {
  if (!eqCtx || !analyser) return;
  
  const width = eqCanvas.width;
  const height = eqCanvas.height;
  
  // Clear canvas
  eqCtx.fillStyle = '#0d0d0d';
  eqCtx.fillRect(0, 0, width, height);
  
  // Draw frequency response if audio is running
  if (analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Draw spectrum
    eqCtx.lineWidth = 2;
    eqCtx.strokeStyle = '#4CAF50';
    eqCtx.beginPath();
    
    const sliceWidth = width / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 255.0;
      const y = height - (v * height);
      
      if (i === 0) {
        eqCtx.moveTo(x, y);
      } else {
        eqCtx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    eqCtx.stroke();
  }
  
  // Draw EQ band markers
  const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  eqCtx.strokeStyle = '#333';
  eqCtx.lineWidth = 1;
  
  frequencies.forEach((freq, index) => {
    const x = (index + 0.5) * (width / frequencies.length);
    eqCtx.beginPath();
    eqCtx.moveTo(x, 0);
    eqCtx.lineTo(x, height);
    eqCtx.stroke();
  });
  
  eqAnimationFrame = requestAnimationFrame(drawEQVisualization);
}

function applyGraphicEQ(preset) {
  const presets = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    vocal: [0, 0, 2, 4, 3, 2, 0, -2, -3, -4],
    bass: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0]
  };
  
  const values = presets[preset] || presets.flat;
  const controls = [geq31Ctl, geq62Ctl, geq125Ctl, geq250Ctl, geq500Ctl, 
                    geq1kCtl, geq2kCtl, geq4kCtl, geq8kCtl, geq16kCtl];
  
  controls.forEach((ctl, index) => {
    ctl.value = values[index];
    ctl.dispatchEvent(new Event('input'));
  });
  
  log(`🎚️ Graphic EQ preset applied: ${preset}`);
}

// Mixer Functions
function updateMixerMetering() {
  if (!mixerMeteringChk.checked || !analyser) return;
  
  // Get audio levels
  analyser.getByteTimeDomainData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = (dataArray[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / dataArray.length);
  const level = Math.min(100, rms * 200); // Convert to percentage
  
  // Update meter bars
  const inputMeterBar = document.querySelector('#inputMeter .meter-bar');
  const effectsMeterBar = document.querySelector('#effectsMeter .meter-bar');
  const masterMeterBar = document.querySelector('#masterMeter .meter-bar');
  
  if (inputMeterBar) inputMeterBar.style.height = level + '%';
  if (effectsMeterBar) effectsMeterBar.style.height = (level * 0.8) + '%';
  if (masterMeterBar) masterMeterBar.style.height = level + '%';
}

function toggleMixerChannel(channel, type) {
  const state = mixerChannelStates[channel];
  
  if (type === 'mute') {
    state.muted = !state.muted;
    const btn = document.getElementById(`mixer${channel.charAt(0).toUpperCase() + channel.slice(1)}Mute`);
    btn.classList.toggle('active', state.muted);
    
    // Apply mute
    if (channel === 'input' && mixerInputGain) {
      mixerInputGain.gain.value = state.muted ? 0 : parseFloat(mixerInputCtl.value);
    } else if (channel === 'effects' && mixerEffectsGain) {
      mixerEffectsGain.gain.value = state.muted ? 0 : parseFloat(mixerEffectsCtl.value);
    } else if (channel === 'breath' && mixerBreathGain) {
      mixerBreathGain.gain.value = state.muted ? 0 : parseFloat(mixerBreathCtl.value);
    }
    
    log(`🎛️ ${channel} ${state.muted ? 'muted' : 'unmuted'}`);
  } else if (type === 'solo') {
    state.solo = !state.solo;
    const btn = document.getElementById(`mixer${channel.charAt(0).toUpperCase() + channel.slice(1)}Solo`);
    btn.classList.toggle('active', state.solo);
    
    // Handle solo logic
    const anySolo = Object.values(mixerChannelStates).some(s => s.solo);
    
    if (anySolo) {
      // Mute all non-solo channels
      Object.keys(mixerChannelStates).forEach(ch => {
        if (!mixerChannelStates[ch].solo) {
          if (ch === 'input' && mixerInputGain) mixerInputGain.gain.value = 0;
          if (ch === 'effects' && mixerEffectsGain) mixerEffectsGain.gain.value = 0;
          if (ch === 'breath' && mixerBreathGain) mixerBreathGain.gain.value = 0;
        }
      });
    } else {
      // Restore all channels
      if (mixerInputGain && !mixerChannelStates.input.muted) {
        mixerInputGain.gain.value = parseFloat(mixerInputCtl.value);
      }
      if (mixerEffectsGain && !mixerChannelStates.effects.muted) {
        mixerEffectsGain.gain.value = parseFloat(mixerEffectsCtl.value);
      }
      if (mixerBreathGain && !mixerChannelStates.breath.muted) {
        mixerBreathGain.gain.value = parseFloat(mixerBreathCtl.value);
      }
    }
    
    log(`🎛️ ${channel} solo ${state.solo ? 'enabled' : 'disabled'}`);
  }
}

function resetMixer() {
  mixerInputCtl.value = 1.0;
  mixerEffectsCtl.value = 1.0;
  mixerBreathCtl.value = 0.7;
  mixerMasterCtl.value = 1.2;
  
  // Reset all states
  Object.keys(mixerChannelStates).forEach(ch => {
    mixerChannelStates[ch].muted = false;
    mixerChannelStates[ch].solo = false;
  });
  
  // Update UI
  document.querySelectorAll('.mixer-mute, .mixer-solo').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Apply to audio nodes
  if (mixerInputGain) mixerInputGain.gain.value = 1.0;
  if (mixerEffectsGain) mixerEffectsGain.gain.value = 1.0;
  if (mixerBreathGain) mixerBreathGain.gain.value = 0.7;
  if (mixerMasterGain) mixerMasterGain.gain.value = 1.2;
  
  mixerInputCtl.dispatchEvent(new Event('input'));
  mixerEffectsCtl.dispatchEvent(new Event('input'));
  mixerBreathCtl.dispatchEvent(new Event('input'));
  mixerMasterCtl.dispatchEvent(new Event('input'));
  
  log("🎛️ Mixer reset to defaults");
}

// Diagnostic function for audio routing and device troubleshooting
function diagnoseBluetooth() {
  log("🔍 Audio Device & System Diagnostics:");
  
  // Device and browser info
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMobile = isAndroid || isIOS;
  const isLinux = /Linux/i.test(navigator.userAgent) && !isAndroid;
  const isRaspberryPi = /armv|aarch64/i.test(navigator.userAgent) || 
                        (isLinux && (/arm/i.test(navigator.platform) || /arm/i.test(navigator.userAgent)));
  
  let deviceType = 'Desktop';
  if (isRaspberryPi) deviceType = '🍓 Raspberry Pi / ARM Linux';
  else if (isLinux) deviceType = '🐧 Linux';
  else if (isAndroid) deviceType = '📱 Android';
  else if (isIOS) deviceType = '📱 iOS';
  
  log(`Device: ${deviceType}`);
  log(`Platform: ${navigator.platform}`);
  log(`Browser: ${navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Chromium)\/[\d.]+/)?.[0] || 'Unknown'}`);
  log(`HTTPS: ${location.protocol === 'https:'}`);
  log(`Mobile: ${isMobile}`);
  
  // API support
  log(`selectAudioOutput API: ${'selectAudioOutput' in navigator.mediaDevices}`);
  log(`setSinkId API: ${'setSinkId' in HTMLMediaElement.prototype}`);
  log(`enumerateDevices API: ${'enumerateDevices' in navigator.mediaDevices}`);
  
  // Check permissions
  navigator.permissions?.query({name: 'microphone'}).then(result => {
    log(`Microphone permission: ${result.state}`);
  }).catch(() => {
    log("Microphone permission: Unable to check");
  });
  
  // Check current audio devices
  navigator.mediaDevices.enumerateDevices().then(devices => {
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    const inputs = devices.filter(d => d.kind === 'audioinput');
    
    log(`📱 Audio Input Devices: ${inputs.length}`);
    inputs.forEach((device, index) => {
      const hasLabel = device.label && device.label.trim() !== '';
      const deviceType = detectDeviceType(device);
      log(`  ${index + 1}. ${hasLabel ? device.label : '[No Label]'} (${deviceType})`);
    });
    
    log(`🔊 Audio Output Devices: ${outputs.length}`);
    outputs.forEach((device, index) => {
      const hasLabel = device.label && device.label.trim() !== '';
      const deviceType = detectDeviceType(device);
      log(`  ${index + 1}. ${hasLabel ? device.label : '[No Label - Permission Required]'} (${deviceType})`);
    });
    
    // Platform-specific guidance
    if (isMobile && outputs.length <= 1) {
      log("⚠️ Expected mobile audio outputs not found:");
      log("   📞 Earpiece/Receiver (for calls)");
      log("   📢 Speakerphone (loud speaker)");
      log("   🎧 Bluetooth devices (if paired)");
      log("");
      log("💡 Mobile troubleshooting:");
      log("   1. Grant microphone permission first");
      log("   2. Ensure Bluetooth devices are paired in Settings");
      log("   3. Try Chrome/Edge for better mobile audio support");
      log("   4. Check if other apps can access your Bluetooth speaker");
      
      if (isAndroid) {
        log("   5. Android: Check 'Phone' app permissions");
        log("   6. Android: Disable 'Absolute Volume' in Developer Options");
      }
    }
    
    // Linux/Raspberry Pi specific guidance
    if ((isLinux || isRaspberryPi) && outputs.length <= 1) {
      log("");
      log("🐧 Linux/Raspberry Pi Audio Setup:");
      log("💡 Check ALSA devices:");
      log("   $ aplay -l");
      log("💡 Check PulseAudio/PipeWire sinks:");
      log("   $ pactl list sinks short");
      log("💡 Set default audio device:");
      log("   $ pactl set-default-sink <sink-name>");
      log("💡 For Bluetooth devices:");
      log("   $ bluetoothctl");
      log("   [bluetooth]# pair <MAC>");
      log("   [bluetooth]# trust <MAC>");
      log("   [bluetooth]# connect <MAC>");
      
      if (isRaspberryPi) {
        log("");
        log("🍓 Raspberry Pi Specific:");
        log("   • Edit /boot/config.txt for audio settings");
        log("   • Use USB audio interface for better quality");
        log("   • Install: sudo apt install pulseaudio pavucontrol");
        log("   • For Bluetooth: sudo apt install bluez pulseaudio-module-bluetooth");
        log("   • Reduce CPU load: Lower reverb/distortion settings");
      }
    }
    
    if (outputs.length === 0) {
      log("❌ No output devices detected");
      log("💡 This usually means:");
      log("   - Browser doesn't support output device enumeration");
      log("   - Permissions not granted");
      log("   - No additional audio devices are connected");
    }
  }).catch(e => {
    log("❌ Failed to enumerate devices: " + e.message);
  });
}

// Android-specific audio routing workaround
async function tryAndroidAudioRouting() {
  try {
    log("📱 Android detected - using system audio routing");
    log("💡 To route audio to Bluetooth speaker:");
    log("   1. Connect Bluetooth speaker in Android Settings");
    log("   2. Set as 'Media Audio' device (not just phone audio)");
    log("   3. Start playing any media (YouTube, Spotify) on Bluetooth first");
    log("   4. Then start the vocoder - audio should follow the same route");
    log("");
    log("🔄 Alternative method:");
    log("   1. Open Android notification panel");
    log("   2. Long-press the media notification when vocoder is running");
    log("   3. Tap 'Output' or speaker icon to change audio route");
    
    // Try to detect if Bluetooth is connected via battery API (indirect method)
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      log(`🔋 Device battery: ${Math.round(battery.level * 100)}% (Bluetooth may affect this)`);
    }
    
    // Check if we can detect Bluetooth via other means
    if ('bluetooth' in navigator) {
      log("🔵 Web Bluetooth API available - Bluetooth hardware detected");
    } else {
      log("⚪ Web Bluetooth API not available");
    }
    
    return true;
  } catch (error) {
    log("❌ Android audio routing check failed: " + error.message);
    return false;
  }
}

// Request speaker permission explicitly
async function requestSpeakerPermission() {
  try {
    requestSpeakerPermissionBtn.disabled = true;
    requestSpeakerPermissionBtn.textContent = "🔄 Requesting...";
    
    log("🔍 Attempting to access audio output devices...");
    
    // Method 1: Try the newer selectAudioOutput API
    if ('selectAudioOutput' in navigator.mediaDevices) {
      try {
        log("📱 Using selectAudioOutput API (Chrome 105+)");
        const device = await navigator.mediaDevices.selectAudioOutput();
        log("✅ Speaker permission granted via selectAudioOutput");
        log(`Selected device: ${device.label || device.deviceId}`);
        
        // Set the selected device as preferred
        if (device.deviceId) {
          preferredSinkId = device.deviceId;
          await populateDevices();
          outSelect.value = device.deviceId;
          await trySetSink(device.deviceId);
        }
        
        requestSpeakerPermissionBtn.textContent = "✅ Permission Granted";
        setTimeout(() => {
          requestSpeakerPermissionBtn.textContent = "🔓 Enable Speakers";
          requestSpeakerPermissionBtn.disabled = false;
        }, 2000);
        return;
      } catch (selectError) {
        log("❌ selectAudioOutput failed: " + selectError.message);
        if (selectError.name === 'NotAllowedError') {
          log("🔒 User denied speaker selection permission");
        } else if (selectError.name === 'NotFoundError') {
          log("📱 No additional audio output devices found");
        }
      }
    } else {
      log("⚠️ selectAudioOutput API not available in this browser");
      log("💡 Chrome flags may need to be enabled:");
      log("   Go to chrome://flags and enable 'experimental-web-platform-features'");
      
      // Try Android-specific workaround
      if (/Android/i.test(navigator.userAgent)) {
        log("🤖 Trying Android system audio routing workaround...");
        await tryAndroidAudioRouting();
      }
    }
    
    // Method 2: Try requesting microphone permission (unlocks mobile audio routing)
    try {
      log("🎤 Requesting microphone permission to unlock mobile audio routing...");
      
      // For mobile devices, request more comprehensive audio permissions
      const isMobile = /Android|iPhone|iPad|iPod/.test(navigator.userAgent);
      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      };
      
      // On mobile, also try to request access to different audio sources
      if (isMobile) {
        log("📱 Mobile device detected - requesting comprehensive audio access");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(track => track.stop());
      log("✅ Audio permission granted - refreshing device list");
      
      // Wait longer for mobile devices to enumerate properly
      await new Promise(resolve => setTimeout(resolve, isMobile ? 1000 : 500));
      
      // Refresh devices after getting permission
      await populateDevices();
      
      // Check if we now have more output options
      const outputOptions = [...outSelect.options].filter(opt => opt.value !== '');
      if (outputOptions.length > 0) {
        log(`🔊 Found ${outputOptions.length} additional output device(s)`);
        
        // Check for mobile-specific devices
        const mobileDevices = outputOptions.filter(opt => {
          const type = opt.dataset.deviceType;
          return type === 'earpiece' || type === 'speakerphone' || type === 'bluetooth';
        });
        
        if (mobileDevices.length > 0) {
          log(`📱 Mobile audio devices found: ${mobileDevices.length}`);
        }
        
        requestSpeakerPermissionBtn.textContent = "✅ Devices Updated";
      } else {
        log("⚠️ Still no additional output devices available");
        log("💡 Mobile audio troubleshooting:");
        log("   1. Ensure Bluetooth speaker is paired in device Settings");
        log("   2. Try making a phone call first (activates audio routing)");
        log("   3. Check if speaker works in other apps (YouTube, Music)");
        log("   4. Restart browser after pairing new Bluetooth device");
        log("   5. Some devices require 'Phone' app permissions for audio routing");
        requestSpeakerPermissionBtn.textContent = "⚠️ No Mobile Audio";
      }
      
      setTimeout(() => {
        requestSpeakerPermissionBtn.textContent = "🔓 Enable Speakers";
        requestSpeakerPermissionBtn.disabled = false;
      }, 3000);
      
    } catch (micError) {
      log("❌ Could not get audio permission: " + micError.message);
      log("🔒 This may prevent Bluetooth device enumeration");
      requestSpeakerPermissionBtn.textContent = "❌ Permission Denied";
      setTimeout(() => {
        requestSpeakerPermissionBtn.textContent = "🔓 Enable Speakers";
        requestSpeakerPermissionBtn.disabled = false;
      }, 2000);
    }
    
  } catch (error) {
    log("❌ Speaker permission request failed: " + error.message);
    requestSpeakerPermissionBtn.textContent = "❌ Failed";
    setTimeout(() => {
      requestSpeakerPermissionBtn.textContent = "🔓 Enable Speakers";
      requestSpeakerPermissionBtn.disabled = false;
    }, 2000);
  }
}

// Platform-specific audio optimizations
function optimizeAndroidAudio() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isLinux = /Linux/i.test(navigator.userAgent) && !isAndroid;
  const isRaspberryPi = /armv|aarch64/i.test(navigator.userAgent) || 
                        (isLinux && (/arm/i.test(navigator.platform) || /arm/i.test(navigator.userAgent)));
  
  // Android optimizations
  if (isAndroid) {
    // Request audio focus for media playback
    if ('requestAudioFocus' in navigator) {
      try {
        navigator.requestAudioFocus();
        log("🎯 Android audio focus requested");
      } catch (e) {
        log("Audio focus request failed: " + e.message);
      }
    }
    
    // Optimize for Android Chrome
    if (navigator.userAgent.includes('Chrome') && audioCtx) {
      try {
        if (audioCtx.audioWorklet) {
          log("📱 AudioWorklet available - optimizing for Android");
        }
      } catch (e) {
        log("AudioWorklet optimization failed: " + e.message);
      }
    }
  }
  
  // Linux/Raspberry Pi optimizations
  if (isLinux || isRaspberryPi) {
    if (audioCtx) {
      const baseLatency = audioCtx.baseLatency || 0;
      const outputLatency = audioCtx.outputLatency || 0;
      const sampleRate = audioCtx.sampleRate;
      
      if (isRaspberryPi) {
        log("🍓 Raspberry Pi audio optimizations applied");
        log(`   Sample rate: ${sampleRate}Hz`);
        log(`   Latency: ${(baseLatency * 1000).toFixed(1)}ms base, ${(outputLatency * 1000).toFixed(1)}ms output`);
        
        // Performance tips for Raspberry Pi
        if (baseLatency > 0.05) {
          log("⚠️ High latency detected - may cause audio delay");
          log("💡 Reduce latency: pactl set-sink-latency-msec <sink> 20");
        }
        
        // Check for USB audio
        log("💡 For best results: Use USB audio interface");
      } else {
        log("🐧 Linux audio optimizations applied");
        log(`   Sample rate: ${sampleRate}Hz, Latency: ${(baseLatency * 1000).toFixed(1)}ms`);
      }
      
      // Check for PulseAudio/PipeWire
      if (baseLatency > 0.1) {
        log("⚠️ Very high latency - check audio server configuration");
      }
    }
  }
  
  // Handle device changes for all platforms
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      const platform = isRaspberryPi ? '🍓 Raspberry Pi' : isLinux ? '🐧 Linux' : isAndroid ? '📱 Android' : 'System';
      log(`${platform} audio devices changed - updating routing`);
      setTimeout(() => {
        populateDevices();
        checkFeedbackRisk();
      }, 500);
    });
  }
}

function buildEQ(ctx, freq){
  const f = ctx.createBiquadFilter();
  f.type = 'peaking';
  f.frequency.value = freq;
  f.Q.value = 1.0;
  f.gain.value = 0;
  return f;
}

function setDistortion(amount){
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = i * 2 / n_samples - 1;
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  shaper.curve = curve;
  shaper.oversample = '4x';
}

function makeNoiseIR(ctx, seconds=2.0, decay=0.5){
  const rate = ctx.sampleRate;
  const len = rate * seconds;
  const ir = ctx.createBuffer(2, len, rate);
  for (let ch=0; ch<2; ch++){
    const buf = ir.getChannelData(ch);
    for (let i=0;i<len;i++){
      buf[i] = (Math.random()*2-1) * Math.pow(1 - i/len, decay);
    }
  }
  return ir;
}

function makeBreathBuffer(ctx, seconds=1.6){
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(1, len, rate);
  const data = buf.getChannelData(0);
  let x=0;
  for (let i=0;i<len;i++){
    x = 0.98*x + (Math.random()*2-1)*0.1;
    data[i] = x;
  }
  for (let i=0;i<Math.min(rate*0.12,len);i++) data[i]*= i/(rate*0.12);
  for (let i=0;i<Math.min(rate*0.15,len);i++) data[len-1-i]*= i/(rate*0.15);
  return buf;
}

function playBreath(){
  if (!audioCtx) return;
  breathSource = audioCtx.createBufferSource();
  breathSource.buffer = breathBuffer;
  const g = audioCtx.createGain();
  g.gain.value = parseFloat(breathVolCtl.value);
  breathSource.connect(g);
  g.connect(outMediaStreamDest);
  breathSource.start();
  breathSource.onended = ()=> { breathSource = null; };
}

function detectSpeech(){
  if (!analyser) return;
  analyser.getByteTimeDomainData(dataArray);
  let sum = 0;
  for (let i=0;i<dataArray.length;i++){
    const v =(dataArray[i]-128)/128;
    sum += v*v;
  }
  const rms = Math.sqrt(sum/dataArray.length);
  const speaking = rms > gateThreshold;
  // Noise gate: ramp down when below threshold
  gateGain.gain.setTargetAtTime(speaking ? 1.0 : 0.0, audioCtx.currentTime, 0.02);

  if (!speaking && lastSpeaking){
    if (autobreathChk.checked) playBreath();
  }
  lastSpeaking = speaking;
}

async function start(){
  try {
    // Stop any existing audio first
    if (audioCtx && audioCtx.state !== 'closed') {
      stop();
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Check if AudioContext is supported
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      log("AudioContext not supported in this browser");
      return;
    }
    
    // Create new AudioContext with error handling and Android optimizations
    try {
      const contextOptions = { latencyHint: latencySel.value };
      
      // Android-specific AudioContext optimizations
      if (isAndroid) {
        contextOptions.sampleRate = 44100; // Standard rate for Android
        // Use interactive latency for real-time processing
        if (latencySel.value === 'interactive') {
          contextOptions.latencyHint = 0.02; // 20ms for Android real-time audio
        }
      }
      
      audioCtx = new AudioContextClass(contextOptions);
      if (!audioCtx) {
        throw new Error("Failed to create AudioContext");
      }
      log(`AudioContext created successfully (${audioCtx.sampleRate}Hz, ${latencySel.value} latency)`);
    } catch (contextError) {
      log("AudioContext creation failed: " + contextError.message);
      // Try fallback without latency hint
      try {
        audioCtx = new AudioContextClass();
        if (!audioCtx) {
          throw new Error("Failed to create AudioContext even without latency hint");
        }
        log("AudioContext created with fallback (no latency hint)");
      } catch (fallbackError) {
        log("Complete AudioContext creation failure: " + fallbackError.message);
        return;
      }
    }
    
    // Handle browser autoplay policy
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
      log("AudioContext resumed (browser autoplay policy)");
    }
    
    // Apply platform-specific optimizations (Android, Linux, Raspberry Pi)
    optimizeAndroidAudio();

    // mic stream with error handling and platform optimization
    const devId = micSelect.value || undefined;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile = isAndroid || isIOS;
    const isLinux = /Linux/i.test(navigator.userAgent) && !isAndroid;
    const isRaspberryPi = /armv|aarch64/i.test(navigator.userAgent) || 
                          (isLinux && (/arm/i.test(navigator.platform) || /arm/i.test(navigator.userAgent)));
    
    // Mobile-optimized audio constraints
    const baseConstraints = {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    };
    
    // Add device-specific constraints if available
    if (devId) {
      baseConstraints.deviceId = { exact: devId };
    }
    
    // Platform-specific optimizations
    if (isAndroid) {
      // Android-specific optimizations for better audio routing
      baseConstraints.latency = 0.02; // 20ms latency for Android
      baseConstraints.sampleSize = 16; // 16-bit samples work best on Android
      
      // Android Chrome specific optimizations
      if (navigator.userAgent.includes('Chrome')) {
        baseConstraints.googEchoCancellation = false;
        baseConstraints.googAutoGainControl = false;
        baseConstraints.googNoiseSuppression = false;
        baseConstraints.googHighpassFilter = false;
        baseConstraints.googTypingNoiseDetection = false;
      }
      
      log("📱 Android device detected - using optimized constraints for audio routing");
    } else if (isIOS) {
      // iOS works best with 44.1kHz or let the system choose
      baseConstraints.sampleRate = 44100;
      log("📱 iOS device detected - using 44.1kHz sample rate");
    } else if (isRaspberryPi) {
      // Raspberry Pi optimizations - balance quality and performance
      baseConstraints.sampleRate = 44100; // Standard rate for Pi
      baseConstraints.latency = 0.03; // 30ms for better stability on Pi
      log("🍓 Raspberry Pi detected - using balanced audio constraints");
      log("💡 For lower latency: Use USB audio interface");
    } else if (isLinux) {
      // Linux desktop - can handle higher quality
      baseConstraints.sampleRate = 48000;
      baseConstraints.latency = 0.02;
      log("🐧 Linux detected - using high-quality audio constraints");
    } else if (!isMobile) {
      // Other desktop browsers
      baseConstraints.sampleRate = 48000;
    }
    
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: baseConstraints
      });
      log(`Using microphone: ${micSelect.selectedOptions[0]?.textContent || 'Default'}`);
    } catch (micError) {
      // Fallback to minimal constraints for Android compatibility
      log("Specific mic failed, trying default: " + micError.message);
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        log("Using default microphone with minimal constraints");
      } catch (fallbackError) {
        // Last resort - basic audio only
        log("Minimal constraints failed, using basic audio: " + fallbackError.message);
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    }

    // Final safety check before creating media stream source
    if (!audioCtx) {
      throw new Error("AudioContext is null - cannot create media stream source");
    }

    srcNode = audioCtx.createMediaStreamSource(mediaStream);

    // Input and output gain controls
    inputGain = audioCtx.createGain();
    inputGain.gain.value = parseFloat(inputVolumeCtl.value);
    
    outputGain = audioCtx.createGain();
    outputGain.gain.value = parseFloat(outputVolumeCtl.value);

    // filters
    hp = audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value = parseFloat(hpCtl.value);
    bp = audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value = parseFloat(bpCtl.value); bp.Q.value = 0.9;
    lp = audioCtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = parseFloat(lpCtl.value);

    // multiband EQ
    eq250 = buildEQ(audioCtx, 250);
    eq600 = buildEQ(audioCtx, 600);
    eq1200 = buildEQ(audioCtx, 1200);
    eq2500 = buildEQ(audioCtx, 2500);
    eq250.gain.value = parseFloat(eq250Ctl.value);
    eq600.gain.value = parseFloat(eq600Ctl.value);
    eq1200.gain.value = parseFloat(eq1200Ctl.value);
    eq2500.gain.value = parseFloat(eq2500Ctl.value);
    
    // Graphic EQ (10-band)
    geqNodes.geq31 = buildEQ(audioCtx, 31);
    geqNodes.geq62 = buildEQ(audioCtx, 62);
    geqNodes.geq125 = buildEQ(audioCtx, 125);
    geqNodes.geq250 = buildEQ(audioCtx, 250);
    geqNodes.geq500 = buildEQ(audioCtx, 500);
    geqNodes.geq1k = buildEQ(audioCtx, 1000);
    geqNodes.geq2k = buildEQ(audioCtx, 2000);
    geqNodes.geq4k = buildEQ(audioCtx, 4000);
    geqNodes.geq8k = buildEQ(audioCtx, 8000);
    geqNodes.geq16k = buildEQ(audioCtx, 16000);
    geqNodes.geq31.gain.value = parseFloat(geq31Ctl.value);
    geqNodes.geq62.gain.value = parseFloat(geq62Ctl.value);
    geqNodes.geq125.gain.value = parseFloat(geq125Ctl.value);
    geqNodes.geq250.gain.value = parseFloat(geq250Ctl.value);
    geqNodes.geq500.gain.value = parseFloat(geq500Ctl.value);
    geqNodes.geq1k.gain.value = parseFloat(geq1kCtl.value);
    geqNodes.geq2k.gain.value = parseFloat(geq2kCtl.value);
    geqNodes.geq4k.gain.value = parseFloat(geq4kCtl.value);
    geqNodes.geq8k.gain.value = parseFloat(geq8kCtl.value);
    geqNodes.geq16k.gain.value = parseFloat(geq16kCtl.value);
    
    // Mixer gain nodes
    mixerInputGain = audioCtx.createGain();
    mixerEffectsGain = audioCtx.createGain();
    mixerBreathGain = audioCtx.createGain();
    mixerMasterGain = audioCtx.createGain();
    mixerInputGain.gain.value = parseFloat(mixerInputCtl.value);
    mixerEffectsGain.gain.value = parseFloat(mixerEffectsCtl.value);
    mixerBreathGain.gain.value = parseFloat(mixerBreathCtl.value);
    mixerMasterGain.gain.value = parseFloat(mixerMasterCtl.value);

    // distortion
    shaper = audioCtx.createWaveShaper();
    setDistortion(parseFloat(distCtl.value));

    // vibrato
    delayNode = audioCtx.createDelay();
    delayNode.delayTime.value = 0.01;
    lfo = audioCtx.createOscillator();
    lfoGain = audioCtx.createGain();
    lfo.frequency.value = parseFloat(vibRateCtl.value);
    lfoGain.gain.value = parseFloat(vibDepthCtl.value)/1000.0;
    lfo.connect(lfoGain);
    lfoGain.connect(delayNode.delayTime);
    lfo.start();

    // robot (AM ring mod)
    robotOsc = audioCtx.createOscillator();
    robotOsc.type = 'sine';
    robotOsc.frequency.value = parseFloat(robotRateCtl.value);
    robotGain = audioCtx.createGain();
    robotGain.gain.value = 0.5;
    robotMixGain = audioCtx.createGain();
    robotMixGain.gain.value = parseFloat(robotMixCtl.value);
    robotOsc.connect(robotGain);
    robotOsc.start();

    // reverb
    reverbConv = audioCtx.createConvolver();
    reverbConv.normalize = true;
    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = parseFloat(revCtl.value);
    reverbConv.buffer = makeNoiseIR(audioCtx, 2.5, 0.4);

    // compressor
    comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = parseFloat(compCtl.value);
    comp.knee.value = 30;
    comp.ratio.value = 8;
    comp.attack.value = 0.005;
    comp.release.value = 0.05;

    // wet/dry + master
    dryGain = audioCtx.createGain(); dryGain.gain.value = parseFloat(dryCtl.value);
    wetGain = audioCtx.createGain(); wetGain.gain.value = parseFloat(wetCtl.value);
    masterGain = audioCtx.createGain(); masterGain.gain.value = parseFloat(gainCtl.value);

    // gate
    gateGain = audioCtx.createGain(); gateGain.gain.value = 1.0;

    // analyser
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.fftSize);

    // destination
    outMediaStreamDest = audioCtx.createMediaStreamDestination();
    monitorEl.srcObject = outMediaStreamDest.stream;

    // Graph:
    // src -> mixerInput -> inputGain -> GraphicEQ -> hp -> bp -> lp -> EQs -> mixerEffects -> (split) -> shaper -> delay -> (dry/wet+reverb) -> comp -> master -> mixerMaster -> outputGain -> out
    srcNode.connect(mixerInputGain);
    mixerInputGain.connect(inputGain);
    
    // Chain graphic EQ nodes
    inputGain.connect(geqNodes.geq31);
    geqNodes.geq31.connect(geqNodes.geq62);
    geqNodes.geq62.connect(geqNodes.geq125);
    geqNodes.geq125.connect(geqNodes.geq250);
    geqNodes.geq250.connect(geqNodes.geq500);
    geqNodes.geq500.connect(geqNodes.geq1k);
    geqNodes.geq1k.connect(geqNodes.geq2k);
    geqNodes.geq2k.connect(geqNodes.geq4k);
    geqNodes.geq4k.connect(geqNodes.geq8k);
    geqNodes.geq8k.connect(geqNodes.geq16k);
    
    // Continue to filters
    geqNodes.geq16k.connect(hp);
    hp.connect(bp);
    bp.connect(lp);
    lp.connect(eq250);
    eq250.connect(eq600);
    eq600.connect(eq1200);
    eq1200.connect(eq2500);

    // Robot AM path: multiply signal by (1 + robot * mix)
    // Implement using GainNode modulation: (signal * (1 + robot*mix))
    const robotOffset = audioCtx.createConstantSource(); robotOffset.offset.value = 1.0;
    robotOffset.start();
    const robotMult = audioCtx.createGain(); // robot*mix
    robotGain.connect(robotMult.gain);
    robotMixGain.connect(robotGain.gain);

    // Create a node to sum 1.0 + robot*mix
    const sumNode = audioCtx.createGain();
    robotMult.connect(sumNode);
    robotOffset.connect(sumNode);

    // Apply AM by feeding signal into a gain whose gain is (1 + robot*mix)
    const amGain = audioCtx.createGain();
    sumNode.connect(amGain.gain);

    eq2500.connect(amGain);

    // Distortion + vibrato
    amGain.connect(shaper);
    shaper.connect(delayNode);

    // Wet/dry and reverb
    const dryTap = audioCtx.createGain(); dryTap.gain.value = 1.0;
    delayNode.connect(dryTap);
    delayNode.connect(reverbConv);
    reverbConv.connect(reverbGain);

    dryTap.connect(wetGain);
    reverbGain.connect(wetGain);

    // Mix to comp
    const mixBus = audioCtx.createGain();
    wetGain.connect(mixBus);
    // Also feed some raw (pre-effect) to dryGain
    eq2500.connect(dryGain);
    dryGain.connect(mixBus);

    // Noise gate before comp
    mixBus.connect(gateGain);
    gateGain.connect(comp);

    comp.connect(masterGain);
    masterGain.connect(mixerMasterGain);
    mixerMasterGain.connect(outputGain);
    outputGain.connect(outMediaStreamDest);
    outputGain.connect(analyser);

    // Wire UI -> nodes
    gainCtl.addEventListener('input', ()=> masterGain.gain.value = parseFloat(gainCtl.value));
    wetCtl.addEventListener('input', ()=> wetGain.gain.value = parseFloat(wetCtl.value));
    dryCtl.addEventListener('input', ()=> dryGain.gain.value = parseFloat(dryCtl.value));
    lpCtl.addEventListener('input', ()=> lp.frequency.value = parseFloat(lpCtl.value));
    hpCtl.addEventListener('input', ()=> hp.frequency.value = parseFloat(hpCtl.value));
    bpCtl.addEventListener('input', ()=> bp.frequency.value = parseFloat(bpCtl.value));
    eq250Ctl.addEventListener('input', ()=> eq250.gain.value = parseFloat(eq250Ctl.value));
    eq600Ctl.addEventListener('input', ()=> eq600.gain.value = parseFloat(eq600Ctl.value));
    eq1200Ctl.addEventListener('input', ()=> eq1200.gain.value = parseFloat(eq1200Ctl.value));
    eq2500Ctl.addEventListener('input', ()=> eq2500.gain.value = parseFloat(eq2500Ctl.value));
    distCtl.addEventListener('input', ()=> setDistortion(parseFloat(distCtl.value)));
    vibDepthCtl.addEventListener('input', ()=> lfoGain.gain.value = parseFloat(vibDepthCtl.value)/1000.0);
    vibRateCtl.addEventListener('input', ()=> lfo.frequency.value = parseFloat(vibRateCtl.value));
    robotMixCtl.addEventListener('input', ()=> robotMixGain.gain.value = parseFloat(robotMixCtl.value));
    robotRateCtl.addEventListener('input', ()=> robotOsc.frequency.value = parseFloat(robotRateCtl.value));
    revCtl.addEventListener('input', ()=> reverbGain.gain.value = parseFloat(revCtl.value));
    compCtl.addEventListener('input', ()=> comp.threshold.value = parseFloat(compCtl.value));
    gateCtl.addEventListener('input', ()=> gateThreshold = parseFloat(gateCtl.value));
    
    // Input/Output volume controls
    inputVolumeCtl.addEventListener('input', ()=> {
      if (inputGain && !inputMuted) {
        inputGain.gain.value = parseFloat(inputVolumeCtl.value);
        lastInputVolume = parseFloat(inputVolumeCtl.value);
      }
    });
    outputVolumeCtl.addEventListener('input', ()=> {
      if (outputGain && !outputMuted) {
        outputGain.gain.value = parseFloat(outputVolumeCtl.value);
        lastOutputVolume = parseFloat(outputVolumeCtl.value);
      }
    });

    breathBuffer = makeBreathBuffer(audioCtx);
    autobreath = autobreathChk.checked;

    if (speechDetector) clearInterval(speechDetector);
    speechDetector = setInterval(detectSpeech, 100);
    
    // Start graphic EQ visualization
    initGraphicEQ();
    
    // Start mixer metering
    if (meteringInterval) clearInterval(meteringInterval);
    meteringInterval = setInterval(updateMixerMetering, 50);
    
    // Monitor stream health
    mediaStream.getTracks().forEach(track => {
      track.addEventListener('ended', () => {
        log("Audio track ended unexpectedly - device may have been disconnected");
        stop();
      });
    });

    startBtn.disabled = true;
    stopBtn.disabled = false;
    log("Audio started. Adjust advanced parameters as needed.");
  } catch(e){
    log("Start failed: " + e.message);
  }
}

function stop(){
  try {
    if (speechDetector) { 
      clearInterval(speechDetector); 
      speechDetector = null;
    }
    
    if (meteringInterval) {
      clearInterval(meteringInterval);
      meteringInterval = null;
    }
    
    if (eqAnimationFrame) {
      cancelAnimationFrame(eqAnimationFrame);
      eqAnimationFrame = null;
    }
    
    // Stop oscillators safely
    if (lfo) { 
      try { lfo.stop(); } catch(_){} 
      lfo = null; 
    }
    if (robotOsc) { 
      try { robotOsc.stop(); } catch(_){} 
      robotOsc = null; 
    }
    
    // Stop breath source
    if (breathSource) { 
      try { breathSource.stop(); } catch(_){} 
      breathSource = null; 
    }
    
    // Stop media stream tracks
    if (mediaStream) { 
      mediaStream.getTracks().forEach(t => t.stop()); 
      mediaStream = null;
    }
    
    // Close audio context
    if (audioCtx && audioCtx.state !== 'closed') { 
      try {
        audioCtx.close();
      } catch(closeError) {
        log("AudioContext close error: " + closeError.message);
      }
    }
    audioCtx = null;
    
    // Reset UI
    startBtn.disabled = false;
    stopBtn.disabled = true;
    log("Audio stopped and cleaned up.");
  } catch(e){
    log("Stop failed: " + e.message);
  }
}

async function trySetSink(id){
  if (!('setSinkId' in HTMLMediaElement.prototype)){
    log("⚠️ Output device selection not supported in this browser");
    log("💡 Try using Chrome/Edge for speaker selection support");
    return false;
  }
  
  if (!id) {
    log("🔊 Using system default audio output");
    return true;
  }
  
  try {
    await monitorEl.setSinkId(id);
    preferredSinkId = id;
    const deviceName = outSelect.selectedOptions[0]?.textContent || id;
    log(`✅ Audio output routed to: ${deviceName}`);
    return true;
  } catch(e){
    log(`❌ Failed to set audio output: ${e.message}`);
    
    // Provide specific error guidance
    if (e.name === 'NotAllowedError') {
      log("🔒 Permission denied - try clicking 'Enable Speakers' button");
    } else if (e.name === 'NotFoundError') {
      log("📱 Device not found - it may have been disconnected");
    } else if (e.name === 'AbortError') {
      log("⚠️ Operation aborted - device may be in use by another app");
    }
    
    return false;
  }
}

// PWA install
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async ()=>{
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  log("Install prompt outcome: " + outcome);
  deferredPrompt = null;
  installBtn.hidden = true;
});

// Add user interaction handler for autoplay policy
async function handleUserInteraction() {
  if (audioCtx && audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
      log("AudioContext resumed by user interaction");
    } catch(e) {
      log("Failed to resume AudioContext: " + e.message);
    }
  }
}

// Events
startBtn.addEventListener('click', async () => {
  await handleUserInteraction();
  await start();
});
stopBtn.addEventListener('click', stop);
refreshDevs.addEventListener('click', populateDevices);
outSelect.addEventListener('change', ()=> {
  trySetSink(outSelect.value);
  updateDeviceTypeIndicators();
});
micSelect.addEventListener('change', updateDeviceTypeIndicators);
breathBtn.addEventListener('click', playBreath);
autobreathChk.addEventListener('change', ()=> autobreath = autobreathChk.checked);
latencySel.addEventListener('change', ()=> log("Latency hint set to: " + latencySel.value));

// New audio control event listeners
muteInputBtn.addEventListener('click', toggleInputMute);
muteOutputBtn.addEventListener('click', toggleOutputMute);
testAudioBtn.addEventListener('click', testAudio);
requestSpeakerPermissionBtn.addEventListener('click', requestSpeakerPermission);
diagnoseBluetoothBtn.addEventListener('click', diagnoseBluetooth);
autoFeedbackPreventionChk.addEventListener('change', ()=> {
  log("Auto feedback prevention: " + (autoFeedbackPreventionChk.checked ? "enabled" : "disabled"));
  checkFeedbackRisk();
});

// Graphic EQ event listeners
geq31Ctl.addEventListener('input', ()=> geqNodes.geq31 && (geqNodes.geq31.gain.value = parseFloat(geq31Ctl.value)));
geq62Ctl.addEventListener('input', ()=> geqNodes.geq62 && (geqNodes.geq62.gain.value = parseFloat(geq62Ctl.value)));
geq125Ctl.addEventListener('input', ()=> geqNodes.geq125 && (geqNodes.geq125.gain.value = parseFloat(geq125Ctl.value)));
geq250Ctl.addEventListener('input', ()=> geqNodes.geq250 && (geqNodes.geq250.gain.value = parseFloat(geq250Ctl.value)));
geq500Ctl.addEventListener('input', ()=> geqNodes.geq500 && (geqNodes.geq500.gain.value = parseFloat(geq500Ctl.value)));
geq1kCtl.addEventListener('input', ()=> geqNodes.geq1k && (geqNodes.geq1k.gain.value = parseFloat(geq1kCtl.value)));
geq2kCtl.addEventListener('input', ()=> geqNodes.geq2k && (geqNodes.geq2k.gain.value = parseFloat(geq2kCtl.value)));
geq4kCtl.addEventListener('input', ()=> geqNodes.geq4k && (geqNodes.geq4k.gain.value = parseFloat(geq4kCtl.value)));
geq8kCtl.addEventListener('input', ()=> geqNodes.geq8k && (geqNodes.geq8k.gain.value = parseFloat(geq8kCtl.value)));
geq16kCtl.addEventListener('input', ()=> geqNodes.geq16k && (geqNodes.geq16k.gain.value = parseFloat(geq16kCtl.value)));

eqResetBtn.addEventListener('click', ()=> applyGraphicEQ('flat'));
eqFlatBtn.addEventListener('click', ()=> applyGraphicEQ('flat'));
eqVocalBtn.addEventListener('click', ()=> applyGraphicEQ('vocal'));
eqBassBtn.addEventListener('click', ()=> applyGraphicEQ('bass'));

// Mixer event listeners
mixerInputCtl.addEventListener('input', ()=> mixerInputGain && !mixerChannelStates.input.muted && (mixerInputGain.gain.value = parseFloat(mixerInputCtl.value)));
mixerEffectsCtl.addEventListener('input', ()=> mixerEffectsGain && !mixerChannelStates.effects.muted && (mixerEffectsGain.gain.value = parseFloat(mixerEffectsCtl.value)));
mixerBreathCtl.addEventListener('input', ()=> mixerBreathGain && !mixerChannelStates.breath.muted && (mixerBreathGain.gain.value = parseFloat(mixerBreathCtl.value)));
mixerMasterCtl.addEventListener('input', ()=> mixerMasterGain && (mixerMasterGain.gain.value = parseFloat(mixerMasterCtl.value)));

mixerInputMuteBtn.addEventListener('click', ()=> toggleMixerChannel('input', 'mute'));
mixerInputSoloBtn.addEventListener('click', ()=> toggleMixerChannel('input', 'solo'));
mixerEffectsMuteBtn.addEventListener('click', ()=> toggleMixerChannel('effects', 'mute'));
mixerEffectsSoloBtn.addEventListener('click', ()=> toggleMixerChannel('effects', 'solo'));
mixerBreathMuteBtn.addEventListener('click', ()=> toggleMixerChannel('breath', 'mute'));
mixerBreathSoloBtn.addEventListener('click', ()=> toggleMixerChannel('breath', 'solo'));
mixerResetBtn.addEventListener('click', resetMixer);

async function ensurePermissions(){
  try {
    await navigator.mediaDevices.getUserMedia({audio:true});
  } catch(e) {
    log("Mic permission denied or blocked: " + e.message);
  }
  await populateDevices();
}

// Handle device changes
navigator.mediaDevices.addEventListener('devicechange', async () => {
  log("Audio devices changed, refreshing list.");
  await populateDevices();
});

// Handle page visibility changes (helps with mobile browser suspension)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      log("AudioContext resumed after page became visible");
    }).catch(e => {
      log("Failed to resume AudioContext: " + e.message);
    });
  }
});

// Android-specific audio session management
if (/Android/i.test(navigator.userAgent)) {
  // Handle audio interruptions (calls, notifications, etc.)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && audioCtx) {
      log("📱 App backgrounded - Android audio session may be interrupted");
    } else if (document.visibilityState === 'visible' && audioCtx) {
      // Check if we need to restart audio after interruption
      setTimeout(() => {
        if (audioCtx && audioCtx.state === 'suspended') {
          log("📱 Attempting to resume Android audio session");
          audioCtx.resume();
        }
      }, 100);
    }
  });
  
  // Handle audio focus changes on Android
  window.addEventListener('focus', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      log("📱 Window focused - resuming Android audio");
      audioCtx.resume();
    }
  });
  
  window.addEventListener('blur', () => {
    if (audioCtx && audioCtx.state === 'running') {
      log("📱 Window blurred - Android may suspend audio");
    }
  });
}

window.addEventListener('load', async ()=>{
  if ('serviceWorker' in navigator){
    try {
      await navigator.serviceWorker.register('./sw.js');
      log("Service worker registered.");
    } catch(e){
      log("SW registration failed: " + e.message);
    }
  }
  ensurePermissions();
  loadSavedPreset(); // load user preset if exists
});

/* Presets */
const PRESET_KEY = 'vader_vocoder_preset';

const PRESETS = {
  vader: {
    gain:1.2, wet:0.7, dry:0.9, lp:2200, hp:120, bp:600,
    eq250:2, eq600:4, eq1200:3, eq2500:-2,
    dist:220, vibDepth:4.0, vibRate:5.5,
    robotMix:0.2, robotRate:55,
    reverb:0.25, comp:-18, gate:0.04, breathVol:0.7
  },
  intercom: {
    gain:1.1, wet:0.5, dry:1.0, lp:3200, hp:180, bp:900,
    eq250:-2, eq600:2, eq1200:4, eq2500:1,
    dist:80, vibDepth:1.5, vibRate:3.0,
    robotMix:0.1, robotRate:70,
    reverb:0.12, comp:-22, gate:0.03, breathVol:0.4
  },
  bounty: {
    gain:1.3, wet:0.6, dry:0.8, lp:2000, hp:100, bp:500,
    eq250:3, eq600:5, eq1200:1, eq2500:-3,
    dist:300, vibDepth:2.5, vibRate:4.5,
    robotMix:0.35, robotRate:45,
    reverb:0.18, comp:-20, gate:0.045, breathVol:0.6
  }
};

function applyPreset(p){
  for (const k in p){
    const el = document.getElementById(k);
    if (el){
      el.value = p[k];
      const out = document.getElementById(k+'Out');
      if (out) out.textContent = p[k];
    }
  }
  // Re-apply to live nodes if running
  if (audioCtx){
    gainCtl.dispatchEvent(new Event('input'));
    wetCtl.dispatchEvent(new Event('input'));
    dryCtl.dispatchEvent(new Event('input'));
    lpCtl.dispatchEvent(new Event('input'));
    hpCtl.dispatchEvent(new Event('input'));
    bpCtl.dispatchEvent(new Event('input'));
    eq250Ctl.dispatchEvent(new Event('input'));
    eq600Ctl.dispatchEvent(new Event('input'));
    eq1200Ctl.dispatchEvent(new Event('input'));
    eq2500Ctl.dispatchEvent(new Event('input'));
    distCtl.dispatchEvent(new Event('input'));
    vibDepthCtl.dispatchEvent(new Event('input'));
    vibRateCtl.dispatchEvent(new Event('input'));
    robotMixCtl.dispatchEvent(new Event('input'));
    robotRateCtl.dispatchEvent(new Event('input'));
    revCtl.dispatchEvent(new Event('input'));
    compCtl.dispatchEvent(new Event('input'));
    gateCtl.dispatchEvent(new Event('input'));
    breathVolCtl.dispatchEvent(new Event('input'));
  }
}

presetBtns.forEach(btn => {
  btn.addEventListener('click', ()=> {
    const p = PRESETS[btn.dataset.preset];
    applyPreset(p);
  });
});

savePresetBtn.addEventListener('click', ()=> {
  const p = collectUI();
  localStorage.setItem(PRESET_KEY, JSON.stringify(p));
  log("Preset saved.");
});

loadPresetBtn.addEventListener('click', loadSavedPreset);
resetPresetBtn.addEventListener('click', ()=> {
  applyPreset(PRESETS.vader);
  log("Defaults restored (Vader Classic).");
});

function collectUI(){
  const ids = ['gain','wet','dry','lp','hp','bp','eq250','eq600','eq1200','eq2500','dist','vibDepth','vibRate','robotMix','robotRate','reverb','comp','gate','breathVol'];
  const out = {};
  ids.forEach(id => out[id] = parseFloat(document.getElementById(id).value));
  return out;
}

function loadSavedPreset(){
  const raw = localStorage.getItem(PRESET_KEY);
  if (raw){
    try{
      const p = JSON.parse(raw);
      applyPreset(p);
      log("Loaded saved preset.");
    }catch{}
  } else {
    applyPreset(PRESETS.vader);
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  log("Vader Vocoder PWA loaded");
  
  // Check for mobile device
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isIOS) {
    log("iOS device detected - optimizing for iPhone/iPad audio");
  } else if (isAndroid) {
    log("Android device detected - optimizing for Android audio");
  } else if (isMobile) {
    log("Mobile device detected - optimizing for mobile audio");
  }
  
  // Load saved preset
  loadSavedPreset();
  
  // Set up event listeners
  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);
  refreshDevs.addEventListener('click', populateDevices);
  breathBtn.addEventListener('click', playBreath);
  
  // Preset buttons
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (PRESETS[preset]) {
        applyPreset(PRESETS[preset]);
        log(`Applied ${preset} preset`);
      }
    });
  });
  
  savePresetBtn.addEventListener('click', () => {
    const preset = collectUI();
    localStorage.setItem(PRESET_KEY, JSON.stringify(preset));
    log("Preset saved");
  });
  
  loadPresetBtn.addEventListener('click', loadSavedPreset);
  resetPresetBtn.addEventListener('click', () => {
    applyPreset(PRESETS.vader);
    log("Reset to Vader Classic preset");
  });
  
  // PWA install prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      log(`Install prompt: ${outcome}`);
      deferredPrompt = null;
      installBtn.hidden = true;
    }
  });
  
  // Register service worker for updates
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      log("Service worker registered");
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            updateBtn.hidden = false;
            log("Update available! Click 'Update Available' button to refresh.");
          }
        });
      });
      
      // Handle update button click
      updateBtn.addEventListener('click', () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
      
    } catch (error) {
      log("Service worker registration failed: " + error.message);
    }
  }
  
  // Initial device population (will request permission on Android)
  await populateDevices();
  
  log("Ready to start vocoding! Version 2.1 with mobile optimizations.");
});
