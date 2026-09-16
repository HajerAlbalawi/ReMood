import { useState, useEffect, useRef, useCallback } from "react";
import { Volume2, VolumeX, Upload, Music, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type SoundType =
  | "rain" | "ocean" | "birds"
  | "wind" | "thunder" | "stream" | "cafe" | "forest"
  | "rain_window" | "fireplace" | "insects" | "none";

// ── Sound meta ────────────────────────────────────────────────────────────────
export const SOUND_OPTIONS: { id: SoundType; label: string; emoji: string; desc: string }[] = [
  { id: "rain",        emoji: "🌧",  label: "مطر",             desc: "قطرات هادئة" },
  { id: "rain_window", emoji: "🪟",  label: "مطر على النافذة", desc: "زجاج دافئ" },
  { id: "thunder",     emoji: "⛈",  label: "عاصفة رعدية",     desc: "مطر ورعد خفيف" },
  { id: "ocean",       emoji: "🌊",  label: "أمواج البحر",     desc: "موج متكرر" },
  { id: "stream",      emoji: "🏔",  label: "نهر جبلي",        desc: "ماء جارٍ" },
  { id: "birds",       emoji: "🐦",  label: "عصافير الصباح",   desc: "تغريد نقي" },
  { id: "forest",      emoji: "🌲",  label: "غابة",            desc: "طبيعة كاملة" },
  { id: "wind",        emoji: "🌬",  label: "ريح هادئة",       desc: "نسيم خفيف" },
  { id: "cafe",        emoji: "☕",  label: "مقهى",            desc: "ضجيج لطيف" },
];

// ── Audio generators ──────────────────────────────────────────────────────────
type StopFn = () => void;

function pinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = 2 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i=0; i<len; i++) {
    const w = Math.random()*2-1;
    b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
    b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
    b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
    d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)/7; b6 = w*0.115926;
  }
  return buf;
}

function whiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = 2 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0; i<len; i++) d[i] = Math.random()*2-1;
  return buf;
}

function makeSource(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true; return src;
}

function bpf(ctx: AudioContext, f: number, q: number): BiquadFilterNode {
  const n = ctx.createBiquadFilter(); n.type="bandpass"; n.frequency.value=f; n.Q.value=q; return n;
}
function lpf(ctx: AudioContext, f: number): BiquadFilterNode {
  const n = ctx.createBiquadFilter(); n.type="lowpass"; n.frequency.value=f; return n;
}
function hpf(ctx: AudioContext, f: number): BiquadFilterNode {
  const n = ctx.createBiquadFilter(); n.type="highpass"; n.frequency.value=f; return n;
}
function gain(ctx: AudioContext, v: number): GainNode {
  const n = ctx.createGain(); n.gain.value=v; return n;
}

// 1. Rain
function startRain(ctx: AudioContext, out: AudioNode): StopFn {
  const src = makeSource(ctx, pinkNoiseBuffer(ctx));
  const f = bpf(ctx, 700, 0.3);
  const g = gain(ctx, 0.8);
  src.connect(f); f.connect(g); g.connect(out); src.start();
  return () => { try { src.stop(); } catch {} };
}

// 2. Rain on window (higher freq emphasis, softer)
function startRainWindow(ctx: AudioContext, out: AudioNode): StopFn {
  const src = makeSource(ctx, pinkNoiseBuffer(ctx));
  const f1 = bpf(ctx, 1200, 0.5);
  const f2 = lpf(ctx, 3000);
  const g = gain(ctx, 0.55);
  src.connect(f1); f1.connect(f2); f2.connect(g); g.connect(out); src.start();
  return () => { try { src.stop(); } catch {} };
}

// 3. Thunderstorm (rain + LFO rumble)
function startThunder(ctx: AudioContext, out: AudioNode): StopFn {
  // Rain layer
  const rain = makeSource(ctx, pinkNoiseBuffer(ctx));
  const rf = bpf(ctx, 600, 0.3);
  const rg = gain(ctx, 0.7);
  rain.connect(rf); rf.connect(rg); rg.connect(out); rain.start();

  // Rumble layer (very low LFO-modulated noise)
  const rumble = makeSource(ctx, whiteNoiseBuffer(ctx));
  const rlp = lpf(ctx, 80);
  const lfo = ctx.createOscillator();
  const lfoG = gain(ctx, 0.3);
  const rg2 = gain(ctx, 0.4);
  lfo.frequency.value = 0.18; lfo.start();
  lfo.connect(lfoG); lfoG.connect(rg2.gain);
  rumble.connect(rlp); rlp.connect(rg2); rg2.connect(out); rumble.start();

  return () => {
    try { rain.stop(); rumble.stop(); lfo.stop(); } catch {}
  };
}

// 4. Fireplace (crackle = random burst noise at low freq)
function startFireplace(ctx: AudioContext, out: AudioNode): StopFn {
  let alive = true;

  // Base hiss (very low)
  const hiss = makeSource(ctx, whiteNoiseBuffer(ctx));
  const hlp = lpf(ctx, 200);
  const hg = gain(ctx, 0.18);
  hiss.connect(hlp); hlp.connect(hg); hg.connect(out); hiss.start();

  // Random crackles
  const crackle = () => {
    if (!alive) return;
    const t = ctx.currentTime;
    const g2 = gain(ctx, 0);
    g2.connect(out);
    const vol = 0.25 + Math.random() * 0.45;
    const dur = 0.04 + Math.random() * 0.12;
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(vol, t + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);

    const o = ctx.createOscillator();
    o.frequency.value = 60 + Math.random() * 180;
    o.connect(g2); o.start(t); o.stop(t + dur + 0.01);

    // Noise burst
    const ns = makeSource(ctx, whiteNoiseBuffer(ctx));
    const nf = bpf(ctx, 200 + Math.random()*800, 1.5);
    const ng = gain(ctx, 0);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(vol * 0.5, t + 0.005);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);
    ns.connect(nf); nf.connect(ng); ng.connect(out);
    ns.start(t); ns.stop(t + dur);

    setTimeout(crackle, 150 + Math.random() * 900);
  };
  crackle();
  return () => { alive = false; try { hiss.stop(); } catch {} };
}

// 5. Ocean waves
function startOcean(ctx: AudioContext, out: AudioNode): StopFn {
  const src = makeSource(ctx, whiteNoiseBuffer(ctx));
  const lp = lpf(ctx, 600);
  const hp = hpf(ctx, 60);
  const lfo = ctx.createOscillator();
  const lfoG = gain(ctx, 0.5);
  const masterG = gain(ctx, 0.5);
  lfo.frequency.value = 0.12;
  lfo.start();
  lfo.connect(lfoG); lfoG.connect(masterG.gain);
  src.connect(lp); lp.connect(hp); hp.connect(masterG); masterG.connect(out); src.start();
  return () => { try { src.stop(); lfo.stop(); } catch {} };
}

// 6. Mountain stream (mid-high filtered noise, fast variation)
function startStream(ctx: AudioContext, out: AudioNode): StopFn {
  const src = makeSource(ctx, pinkNoiseBuffer(ctx));
  const bp = bpf(ctx, 1500, 0.6);
  const hp2 = hpf(ctx, 200);
  const lfo = ctx.createOscillator();
  const lfoG = gain(ctx, 0.35);
  const g = gain(ctx, 0.55);
  lfo.frequency.value = 0.8;
  lfo.start();
  lfo.connect(lfoG); lfoG.connect(g.gain);
  src.connect(bp); bp.connect(hp2); hp2.connect(g); g.connect(out); src.start();
  return () => { try { src.stop(); lfo.stop(); } catch {} };
}

// 7. Birds (random chirps)
function startBirds(ctx: AudioContext, out: AudioNode): StopFn {
  let alive = true;
  const chirp = () => {
    if (!alive) return;
    const t = ctx.currentTime;
    const g2 = gain(ctx, 0);
    g2.connect(out);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.18 + Math.random()*0.12, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    const o = ctx.createOscillator();
    const base = 1800 + Math.random()*2200;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base*1.45, t+0.07);
    o.frequency.exponentialRampToValueAtTime(base*0.88, t+0.14);
    o.connect(g2); o.start(t); o.stop(t+0.18);
    setTimeout(chirp, 300 + Math.random()*2500);
  };
  [0, 700, 1500, 2400].forEach(d => setTimeout(() => chirp(), d));
  return () => { alive = false; };
}

// 8. Night insects/crickets
function startInsects(ctx: AudioContext, out: AudioNode): StopFn {
  const nodes: OscillatorNode[] = [];
  const cricket = (freq: number, mod: number, vol: number) => {
    const car = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lg = gain(ctx, vol*0.5);
    const eg = gain(ctx, vol*0.5);
    car.frequency.value = freq; lfo.frequency.value = mod;
    lfo.connect(lg); lg.connect(eg.gain);
    car.connect(eg); eg.connect(out);
    lfo.start(); car.start();
    nodes.push(car, lfo);
  };
  cricket(3600, 16, 0.18); cricket(4100, 19, 0.12); cricket(3200, 14, 0.10);
  return () => nodes.forEach(n => { try { n.stop(); } catch {} });
}

// 9. Forest (birds + wind + rustling)
function startForest(ctx: AudioContext, out: AudioNode): StopFn {
  const stopB = startBirds(ctx, out);
  // Wind layer
  const src = makeSource(ctx, pinkNoiseBuffer(ctx));
  const lp = lpf(ctx, 300);
  const g = gain(ctx, 0.25);
  src.connect(lp); lp.connect(g); g.connect(out); src.start();
  // Rustle
  const src2 = makeSource(ctx, whiteNoiseBuffer(ctx));
  const bp = bpf(ctx, 2000, 2);
  const g2 = gain(ctx, 0.08);
  const lfo = ctx.createOscillator();
  const lg = gain(ctx, 0.06);
  lfo.frequency.value = 0.4; lfo.start();
  lfo.connect(lg); lg.connect(g2.gain);
  src2.connect(bp); bp.connect(g2); g2.connect(out); src2.start();
  return () => {
    stopB();
    try { src.stop(); src2.stop(); lfo.stop(); } catch {}
  };
}

// 10. Gentle wind
function startWind(ctx: AudioContext, out: AudioNode): StopFn {
  const src = makeSource(ctx, whiteNoiseBuffer(ctx));
  const lp = lpf(ctx, 320);
  const lfo = ctx.createOscillator();
  const lg = gain(ctx, 0.3);
  const g = gain(ctx, 0.38);
  lfo.frequency.value = 0.08; lfo.start();
  lfo.connect(lg); lg.connect(g.gain);
  src.connect(lp); lp.connect(g); g.connect(out); src.start();
  return () => { try { src.stop(); lfo.stop(); } catch {} };
}

// 11. Cafe (multi-layer background chatter simulation)
function startCafe(ctx: AudioContext, out: AudioNode): StopFn {
  // Background murmur
  const src = makeSource(ctx, pinkNoiseBuffer(ctx));
  const lp = lpf(ctx, 1200);
  const hp = hpf(ctx, 150);
  const g = gain(ctx, 0.22);
  src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(out); src.start();

  // Subtle cutlery / random high tones
  let alive = true;
  const clink = () => {
    if (!alive) return;
    const t = ctx.currentTime;
    const g2 = gain(ctx, 0);
    g2.connect(out);
    const vol = 0.04 + Math.random()*0.06;
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(vol, t+0.005);
    g2.gain.exponentialRampToValueAtTime(0.001, t+0.35);
    const o = ctx.createOscillator();
    o.frequency.value = 900 + Math.random()*1400;
    o.connect(g2); o.start(t); o.stop(t+0.4);
    setTimeout(clink, 1500 + Math.random()*4000);
  };
  clink();

  return () => {
    alive = false;
    try { src.stop(); } catch {}
  };
}

const GENERATORS: Record<SoundType, ((ctx: AudioContext, out: AudioNode) => StopFn) | null> = {
  rain:        startRain,
  rain_window: startRainWindow,
  thunder:     startThunder,
  fireplace:   startFireplace,
  ocean:       startOcean,
  stream:      startStream,
  birds:       startBirds,
  insects:     startInsects,
  forest:      startForest,
  wind:        startWind,
  cafe:        startCafe,
  none:        null,
};

// ── Component ─────────────────────────────────────────────────────────────────
interface AmbientSoundProps {
  soundType: SoundType; // auto-suggestion from weather
}

export function AmbientSound({ soundType: suggestedSound }: AmbientSoundProps) {
  const [open, setOpen]           = useState(false);
  const [muted, setMuted]         = useState(true);
  const [active, setActive]       = useState<SoundType>("none");
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");

  const ctxRef     = useRef<AudioContext | null>(null);
  const masterRef  = useRef<GainNode | null>(null);
  const stopFnRef  = useRef<StopFn | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const fileRef    = useRef<HTMLInputElement>(null);

  const stopAll = useCallback(() => {
    stopFnRef.current?.(); stopFnRef.current = null;
    audioElRef.current?.pause();
  }, []);

  useEffect(() => () => {
    stopAll();
    if (customUrl) URL.revokeObjectURL(customUrl);
  }, [customUrl, stopAll]);

  // When user picks a sound or mute changes → restart
  useEffect(() => {
    if (muted) { stopAll(); return; }

    // Custom audio file (uploaded from desktop) — takes priority over presets
    if (customUrl) {
      stopFnRef.current?.(); stopFnRef.current = null; // stop any web-audio generator
      const a = audioElRef.current ?? new Audio();
      if (a.src !== customUrl) {
        a.src = customUrl;
        audioElRef.current = a;
      }
      a.loop = true;
      a.volume = 0.45;
      a.play().catch(() => {});
      return () => { a.pause(); };
    }

    if (active === "none") { stopAll(); return; }

    // Web Audio generator
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    if (!masterRef.current) {
      masterRef.current = ctx.createGain();
      masterRef.current.connect(ctx.destination);
    }
    masterRef.current.gain.value = 0.55;
    stopAll();

    const gen = GENERATORS[active];
    if (gen) stopFnRef.current = gen(ctx, masterRef.current);

    return stopAll;
  }, [muted, active, customUrl, stopAll]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    setCustomUrl(url);
    setCustomName(file.name.replace(/\.[^.]+$/, "").slice(0, 22));
    setActive("none"); setMuted(false); setOpen(false);
    e.target.value = "";
  };

  const pick = (id: SoundType) => {
    setCustomUrl(null); setCustomName("");
    setActive(id); setMuted(false); setOpen(false);
  };

  const currentMeta = SOUND_OPTIONS.find(s => s.id === active);
  const label = customName || currentMeta?.label || "";

  return (
    <>
      <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />

      {/* Floating controls — top right */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">

        {/* Active sound label (when playing) */}
        {!muted && label && (
          <motion.div
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/50 border border-amber-400/25 text-amber-300 text-xs backdrop-blur-md"
          >
            <span>{currentMeta?.emoji ?? "🎵"}</span>
            <span className="max-w-[90px] truncate">{label}</span>
            <button onClick={() => { setMuted(true); setActive("none"); setCustomUrl(null); setCustomName(""); }}
              aria-label="إيقاف الصوت"
              className="text-white/35 hover:text-red-400 transition-colors mr-0.5">✕</button>
          </motion.div>
        )}

        {/* Picker toggle */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="فتح إعدادات أصوات الطبيعة"
          aria-expanded={open}
          aria-controls="ambient-sound-picker"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs transition-all backdrop-blur-md ${
            !muted && active !== "none"
              ? "bg-black/55 border-amber-400/30 text-amber-300"
              : "bg-black/40 border-white/15 text-white/55 hover:bg-white/10 hover:text-white"
          }`}
          title="أصوات الطبيعة"
        >
          {muted || active === "none" ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Sound picker panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            id="ambient-sound-picker"
            className="fixed top-14 right-4 z-50 w-72 backdrop-blur-2xl bg-black/70 border border-white/12 rounded-2xl p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white/80">أصوات الطبيعة للقراءة</span>
              {/* Upload custom */}
              <button
                onClick={() => { setOpen(false); fileRef.current?.click(); }}
                  aria-label="رفع ملف صوتي مخصص"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/8 hover:bg-white/14 border border-white/10 text-white/50 hover:text-white/80 text-xs transition-all"
              >
                <Upload className="w-3 h-3" /> رفع
              </button>
            </div>

            {/* Suggested by weather */}
            {suggestedSound !== "none" && suggestedSound !== active && (
              <div className="mb-3 px-2.5 py-1.5 rounded-xl bg-amber-400/8 border border-amber-400/18 text-xs text-amber-300/80 flex items-center justify-between">
                <span>مقترح حسب طقسك: {SOUND_OPTIONS.find(s=>s.id===suggestedSound)?.emoji} {SOUND_OPTIONS.find(s=>s.id===suggestedSound)?.label}</span>
                <button onClick={() => pick(suggestedSound)} aria-label={`تشغيل الصوت المقترح: ${SOUND_OPTIONS.find(s => s.id === suggestedSound)?.label ?? ""}`} className="text-amber-400 font-medium hover:underline">تشغيل</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {SOUND_OPTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => active === s.id ? (setMuted(m => !m)) : pick(s.id)}
                  aria-pressed={active === s.id && !muted}
                  aria-label={`${active === s.id && !muted ? "إيقاف" : "تشغيل"} ${s.label}`}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 hover:scale-[1.02] active:scale-95 ${
                    active === s.id && !muted
                      ? "bg-amber-400/18 border-amber-400/40 text-amber-200"
                      : "bg-white/5 border-white/10 text-white/65 hover:bg-white/10 hover:text-white hover:border-white/20"
                  }`}
                >
                  <span className="text-xl leading-none">{s.emoji}</span>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-xs font-medium leading-tight truncate w-full">{s.label}</span>
                    <span className="text-[10px] text-white/35 leading-tight">{s.desc}</span>
                  </div>
                  {active === s.id && !muted && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Stop all */}
            {(!muted && (active !== "none" || customName)) && (
              <button
                onClick={() => { setMuted(true); setActive("none"); setCustomUrl(null); setCustomName(""); setOpen(false); }}
                aria-label="إيقاف كل الأصوات"
                className="mt-3 w-full py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-red-900/20 hover:border-red-400/25 text-white/45 hover:text-red-300 text-xs transition-all"
              >
                إيقاف الصوت
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
