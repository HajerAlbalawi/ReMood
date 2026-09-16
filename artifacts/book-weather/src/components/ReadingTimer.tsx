import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Play, Pause, RotateCcw, Plus, Minus, X } from "lucide-react";

const PRESETS = [15, 25, 45, 60];

// ── Completion chime via Web Audio ────────────────────────────────────────────
function playChime(ctx: AudioContext) {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C (arpeggio)
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.7);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ReadingTimer() {
  const [open,      setOpen]      = useState(false);
  const [totalSecs, setTotalSecs] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running,   setRunning]   = useState(false);
  const [finished,  setFinished]  = useState(false);

  const ctxRef   = useRef<AudioContext | null>(null);
  const ivRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current)
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctxRef.current;
  }, []);

  // Countdown tick
  useEffect(() => {
    if (running) {
      ivRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            setRunning(false);
            setFinished(true);
            setOpen(true);
            try { playChime(getCtx()); } catch {}
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (ivRef.current) clearInterval(ivRef.current);
    }
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [running, getCtx]);

  const handleStart = () => {
    setFinished(false);
    setRunning(true);
    try { getCtx().resume(); } catch {}
  };
  const handlePause = () => setRunning(false);
  const handleReset = () => {
    setRunning(false);
    setFinished(false);
    setRemaining(totalSecs);
  };

  const setPreset = (mins: number) => {
    const s = mins * 60;
    setTotalSecs(s);
    setRemaining(s);
    setRunning(false);
    setFinished(false);
  };

  // Adjust time while NOT running (+1 / -1 or +5 / -5)
  const adjust = (deltaSecs: number) => {
    if (running) return;
    const next = Math.max(1 * 60, Math.min(120 * 60, totalSecs + deltaSecs));
    setTotalSecs(next);
    setRemaining(next);
    setFinished(false);
  };

  // Format helpers
  const mm  = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss  = String(remaining % 60).padStart(2, "0");
  const timeStr = `${mm}:${ss}`;
  const totalMins = Math.floor(totalSecs / 60);

  // Circular ring
  const R            = 42;
  const CIRC         = 2 * Math.PI * R;
  const dashOffset   = CIRC * (1 - remaining / totalSecs);
  const ringColor    = finished ? "#4ade80" : running ? "#fbbf24" : "#f59e0b";

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2" style={{ direction: "rtl" }}>

      {/* ── Compact pill button ── */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs backdrop-blur-md transition-all ${
          finished
            ? "bg-green-400/20 border-green-400/40 text-green-300"
            : running
            ? "bg-amber-400/20 border-amber-400/40 text-amber-300"
            : "bg-black/45 border-white/15 text-white/60 hover:bg-white/10 hover:text-white"
        }`}
        animate={running ? { boxShadow: ["0 0 0px rgba(251,191,36,0)", "0 0 12px rgba(251,191,36,0.35)", "0 0 0px rgba(251,191,36,0)"] } : {}}
        transition={running ? { duration: 2, repeat: Infinity } : {}}
      >
        <Timer className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-mono font-bold tracking-wider">{timeStr}</span>
        {running && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />}
        {finished && <span className="text-[10px]">🎉</span>}
      </motion.button>

      {/* ── Expanded panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="w-80 backdrop-blur-2xl bg-black/75 border border-white/12 rounded-2xl p-5 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-semibold text-white/85 flex items-center gap-2">
                <Timer className="w-4 h-4 text-amber-300" />
                مؤقت القراءة
              </span>
              <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/70 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ring + time display */}
            <div className="flex flex-col items-center mb-5">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full" style={{ transform: "rotate(-90deg)" }}>
                  {/* Track */}
                  <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                  {/* Progress */}
                  <circle
                    cx="64" cy="64" r={R}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={dashOffset}
                    style={{ transition: running ? "stroke-dashoffset 1s linear" : "stroke-dashoffset 0.35s ease" }}
                  />
                </svg>
                <div className="text-center z-10">
                  <div className={`text-3xl font-mono font-bold tracking-tight leading-none ${finished ? "text-green-300" : "text-white"}`}>
                    {timeStr}
                  </div>
                  <div className="text-[11px] text-white/35 mt-1">
                    {finished ? "أحسنت! 🎉" : running ? "جارٍ القراءة" : "جاهز"}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Time adjust row ── */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {/* -5 */}
              <button onClick={() => adjust(-5 * 60)} disabled={running || totalSecs <= 5 * 60}
                className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-white/6 border border-white/10 text-white/50 hover:bg-white/12 hover:text-white disabled:opacity-25 transition-all text-xs">
                <Minus className="w-3 h-3" /><span>5</span>
              </button>
              {/* -1 */}
              <button onClick={() => adjust(-1 * 60)} disabled={running || totalSecs <= 1 * 60}
                className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-white/6 border border-white/10 text-white/50 hover:bg-white/12 hover:text-white disabled:opacity-25 transition-all text-xs">
                <Minus className="w-3 h-3" /><span>1</span>
              </button>

              {/* Current minutes */}
              <span className="px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-300 text-sm font-bold font-mono min-w-[52px] text-center">
                {totalMins}د
              </span>

              {/* +1 */}
              <button onClick={() => adjust(+1 * 60)} disabled={running || totalSecs >= 120 * 60}
                className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-white/6 border border-white/10 text-white/50 hover:bg-white/12 hover:text-white disabled:opacity-25 transition-all text-xs">
                <Plus className="w-3 h-3" /><span>1</span>
              </button>
              {/* +5 */}
              <button onClick={() => adjust(+5 * 60)} disabled={running || totalSecs >= 120 * 60}
                className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-white/6 border border-white/10 text-white/50 hover:bg-white/12 hover:text-white disabled:opacity-25 transition-all text-xs">
                <Plus className="w-3 h-3" /><span>5</span>
              </button>
            </div>

            {/* ── Start / Pause / Reset ── */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={running ? handlePause : handleStart}
                disabled={remaining === 0 && !finished}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  running
                    ? "bg-white/10 border-white/15 text-white/80 hover:bg-white/15"
                    : "bg-amber-400/18 border-amber-400/35 text-amber-300 hover:bg-amber-400/28"
                } disabled:opacity-30`}
              >
                {running
                  ? <><Pause className="w-4 h-4" />إيقاف مؤقت</>
                  : finished
                  ? <><RotateCcw className="w-4 h-4" />ابدأ مجدداً</>
                  : <><Play  className="w-4 h-4" />ابدأ</>
                }
              </button>
              <button
                onClick={handleReset}
                title="إعادة تعيين"
                className="w-11 flex items-center justify-center rounded-xl bg-white/6 border border-white/10 text-white/45 hover:bg-white/12 hover:text-white transition-all"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* ── Preset shortcuts ── */}
            <div className="grid grid-cols-4 gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`py-1.5 rounded-xl text-xs border transition-all ${
                    totalSecs === p * 60
                      ? "bg-amber-400/18 border-amber-400/35 text-amber-300 font-semibold"
                      : "bg-white/5 border-white/10 text-white/45 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  {p}د
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
