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

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter(d => d.kind === 'audioinput');
    const outputs = devices.filter(d => d.kind === 'audiooutput');

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
        micSelect.appendChild(opt);
      });
      log(`Found ${inputs.length} microphone(s)`);
    }

    outSelect.innerHTML = '';
    if (outputs.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Default speakers';
      outSelect.appendChild(opt);
      log("No audio output devices found, using default");
    } else {
      outputs.forEach((d, index) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        // Use device label if available, otherwise create descriptive name
        opt.textContent = d.label || `Speaker ${index + 1}`;
        outSelect.appendChild(opt);
      });
      log(`Found ${outputs.length} audio output(s)`);
    }

    if (preferredSinkId && [...outSelect.options].some(o => o.value===preferredSinkId)){
      outSelect.value = preferredSinkId;
      trySetSink(preferredSinkId);
    }
  } catch(e){
    log("Device enumeration failed: " + e.message);
    // Add fallback options
    micSelect.innerHTML = '<option value="">Default Microphone</option>';
    outSelect.innerHTML = '<option value="">Default Speakers</option>';
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
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: latencySel.value});
    
    // Handle browser autoplay policy
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
      log("AudioContext resumed (browser autoplay policy)");
    }

    // mic stream with error handling and mobile optimization
    const devId = micSelect.value || undefined;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile = isAndroid || isIOS;
    
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
    
    // iOS requires specific sample rate handling
    if (isIOS) {
      // iOS works best with 44.1kHz or let the system choose
      baseConstraints.sampleRate = 44100;
      log("iOS device detected - using 44.1kHz sample rate");
    } else if (!isAndroid) {
      // Desktop browsers can handle higher sample rates
      baseConstraints.sampleRate = 48000;
    }
    // Android: let the system choose the best sample rate
    
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

    srcNode = audioCtx.createMediaStreamSource(mediaStream);

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
    // src -> hp -> bp -> lp -> EQs -> (split) -> shaper -> delay -> (dry/wet+reverb) -> comp -> master -> out
    srcNode.connect(hp);
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
    masterGain.connect(outMediaStreamDest);
    masterGain.connect(analyser);

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

    breathBuffer = makeBreathBuffer(audioCtx);
    autobreath = autobreathChk.checked;

    if (speechDetector) clearInterval(speechDetector);
    speechDetector = setInterval(detectSpeech, 100);
    
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
      audioCtx.close(); 
      audioCtx = null; 
    }
    
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
    log("Output device selection not supported in this browser. The OS default output will be used.");
    return;
  }
  try {
    await monitorEl.setSinkId(id);
    preferredSinkId = id;
    log("Output routed to: " + id);
  } catch(e){
    log("setSinkId failed: " + e.message);
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
outSelect.addEventListener('change', ()=> trySetSink(outSelect.value));
breathBtn.addEventListener('click', playBreath);
autobreathChk.addEventListener('change', ()=> autobreath = autobreathChk.checked);
latencySel.addEventListener('change', ()=> log("Latency hint set to: " + latencySel.value));

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
  log("Audio devices changed, refreshing list...");
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
