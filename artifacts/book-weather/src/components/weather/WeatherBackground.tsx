import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type BookAtmosphere =
  | "adventure" | "mystery" | "romance" | "family" | "scifi" | "thriller"
  | "philosophical" | "spiritual" | "poetry" | "selfhelp" | "history" | "science" | "classic"
  | null;

interface WeatherBackgroundProps {
  conditionGroup?: string;
  category?: string;
  userImageUrl?: string | null;
  timeOfDay?: TimeOfDay;
  bookAtmosphere?: BookAtmosphere;
}

// ── Palette ───────────────────────────────────────────────────────────────────
type Pal = {
  skyBase: string;       // main sky gradient
  skyGlow: string;       // radial glow near sun/moon
  skyHorizon: string;    // horizon scatter colour
  groundFar: string;     // far mountains
  groundMid: string;     // mid hills
  groundNear: string;    // near ground
  groundFore: string;    // foreground strip
  treeCol: string;
  hazeColor: string;     // atmospheric haze tint
  cloudCol: string;
  waterCol?: string;
};

const PAL: Record<string, Record<TimeOfDay, Pal>> = {
  Clear: {
    morning: {
      skyBase:    "linear-gradient(180deg,#04091c 0%,#0d1f45 18%,#7a2c06 48%,#c8580c 68%,#f0a030 88%,#ffd878 100%)",
      skyGlow:    "radial-gradient(ellipse 80% 55% at 38% 100%, rgba(255,140,30,0.55) 0%, transparent 70%)",
      skyHorizon: "radial-gradient(ellipse 100% 25% at 50% 100%, rgba(255,180,60,0.30) 0%, transparent 100%)",
      groundFar:  "#1f3c14", groundMid:  "#2a5018", groundNear: "#1e3d12", groundFore: "#142a0c",
      treeCol: "#122010", hazeColor: "rgba(255,160,60,0.10)", cloudCol: "rgba(255,210,160,0.55)",
    },
    afternoon: {
      skyBase:    "linear-gradient(180deg,#0a3c78 0%,#1566b0 22%,#2a90d8 50%,#74c4e8 78%,#c0e4f4 100%)",
      skyGlow:    "radial-gradient(ellipse 60% 50% at 78% 15%, rgba(255,248,200,0.30) 0%, transparent 65%)",
      skyHorizon: "radial-gradient(ellipse 100% 20% at 50% 100%, rgba(180,230,255,0.22) 0%, transparent 100%)",
      groundFar:  "#1c4012", groundMid:  "#286820", groundNear: "#1e4e14", groundFore: "#14340c",
      treeCol: "#163410", hazeColor: "rgba(160,220,255,0.08)", cloudCol: "rgba(255,255,255,0.78)",
    },
    evening: {
      skyBase:    "linear-gradient(180deg,#03000c 0%,#160030 14%,#50003a 34%,#a82808 56%,#e85808 76%,#ffa018 92%,#ffcc50 100%)",
      skyGlow:    "radial-gradient(ellipse 90% 60% at 40% 100%, rgba(230,80,10,0.65) 0%, transparent 68%)",
      skyHorizon: "radial-gradient(ellipse 100% 28% at 50% 100%, rgba(255,130,20,0.35) 0%, transparent 100%)",
      groundFar:  "#1a0e08", groundMid:  "#281810", groundNear: "#1c100a", groundFore: "#100806",
      treeCol: "#0a0604", hazeColor: "rgba(200,70,10,0.14)", cloudCol: "rgba(220,100,40,0.35)",
      waterCol: "#14002a",
    },
    night: {
      skyBase:    "linear-gradient(180deg,#000003 0%,#02061a 28%,#03102c 62%,#081840 100%)",
      skyGlow:    "radial-gradient(ellipse 55% 45% at 68% 18%, rgba(100,140,255,0.14) 0%, transparent 60%)",
      skyHorizon: "radial-gradient(ellipse 100% 18% at 50% 100%, rgba(10,30,80,0.30) 0%, transparent 100%)",
      groundFar:  "#06080a", groundMid:  "#0a1008", groundNear: "#080c06", groundFore: "#050804",
      treeCol: "#040604", hazeColor: "rgba(20,40,100,0.10)", cloudCol: "rgba(60,80,160,0.18)",
      waterCol: "#020610",
    },
  },
  Clouds: {
    morning: {
      skyBase:    "linear-gradient(180deg,#182430 0%,#283848 25%,#3e5468 55%,#607888 80%,#809298 100%)",
      skyGlow:    "radial-gradient(ellipse 70% 45% at 35% 90%, rgba(140,170,190,0.28) 0%, transparent 65%)",
      skyHorizon: "radial-gradient(ellipse 100% 20% at 50% 100%, rgba(120,160,180,0.20) 0%, transparent 100%)",
      groundFar:  "#1c2c18", groundMid:  "#283c20", groundNear: "#203018", groundFore: "#162010",
      treeCol: "#182818", hazeColor: "rgba(120,160,180,0.12)", cloudCol: "rgba(200,218,232,0.70)",
    },
    afternoon: {
      skyBase:    "linear-gradient(180deg,#243040 0%,#384c60 28%,#546070 58%,#748090 82%,#909898 100%)",
      skyGlow:    "radial-gradient(ellipse 65% 40% at 40% 85%, rgba(150,175,195,0.22) 0%, transparent 60%)",
      skyHorizon: "radial-gradient(ellipse 100% 20% at 50% 100%, rgba(130,160,175,0.18) 0%, transparent 100%)",
      groundFar:  "#1e3018", groundMid:  "#2c4222", groundNear: "#243618", groundFore: "#182810",
      treeCol: "#1c2c14", hazeColor: "rgba(140,165,180,0.10)", cloudCol: "rgba(215,225,232,0.72)",
    },
    evening: {
      skyBase:    "linear-gradient(180deg,#0c0818 0%,#201028 24%,#401c38 50%,#703050 76%,#984060 100%)",
      skyGlow:    "radial-gradient(ellipse 75% 50% at 55% 95%, rgba(160,60,90,0.40) 0%, transparent 68%)",
      skyHorizon: "radial-gradient(ellipse 100% 25% at 50% 100%, rgba(150,50,80,0.22) 0%, transparent 100%)",
      groundFar:  "#140e0c", groundMid:  "#201614", groundNear: "#181210", groundFore: "#100c08",
      treeCol: "#0e0a08", hazeColor: "rgba(150,50,80,0.12)", cloudCol: "rgba(180,80,110,0.50)",
    },
    night: {
      skyBase:    "linear-gradient(180deg,#020208 0%,#04040e 28%,#08081a 62%,#10102a 100%)",
      skyGlow:    "radial-gradient(ellipse 45% 38% at 60% 22%, rgba(80,90,160,0.12) 0%, transparent 55%)",
      skyHorizon: "radial-gradient(ellipse 100% 18% at 50% 100%, rgba(10,12,30,0.30) 0%, transparent 100%)",
      groundFar:  "#040606", groundMid:  "#070a07", groundNear: "#060808", groundFore: "#040604",
      treeCol: "#030403", hazeColor: "rgba(10,14,40,0.12)", cloudCol: "rgba(60,70,120,0.28)",
    },
  },
  Rain: {
    morning: {
      skyBase:    "linear-gradient(180deg,#0c1620 0%,#182430 28%,#283a48 58%,#3a5060 100%)",
      skyGlow:    "radial-gradient(ellipse 60% 40% at 40% 85%, rgba(100,140,165,0.18) 0%, transparent 60%)",
      skyHorizon: "radial-gradient(ellipse 100% 20% at 50% 100%, rgba(80,120,145,0.20) 0%, transparent 100%)",
      groundFar:  "#102010", groundMid:  "#183018", groundNear: "#143818", groundFore: "#0e2610",
      treeCol: "#0e2010", hazeColor: "rgba(100,140,165,0.18)", cloudCol: "rgba(160,190,210,0.60)",
    },
    afternoon: {
      skyBase:    "linear-gradient(180deg,#0e1820 0%,#1a2a34 28%,#283e4c 58%,#3a5060 100%)",
      skyGlow:    "radial-gradient(ellipse 55% 38% at 42% 88%, rgba(100,135,158,0.16) 0%, transparent 58%)",
      skyHorizon: "radial-gradient(ellipse 100% 20% at 50% 100%, rgba(85,120,140,0.18) 0%, transparent 100%)",
      groundFar:  "#122012", groundMid:  "#1a3018", groundNear: "#163a18", groundFore: "#102810",
      treeCol: "#102012", hazeColor: "rgba(100,135,158,0.16)", cloudCol: "rgba(158,188,208,0.62)",
    },
    evening: {
      skyBase:    "linear-gradient(180deg,#060c10 0%,#0e1820 28%,#182838 55%,#283848 100%)",
      skyGlow:    "radial-gradient(ellipse 50% 35% at 38% 90%, rgba(80,110,135,0.14) 0%, transparent 55%)",
      skyHorizon: "radial-gradient(ellipse 100% 18% at 50% 100%, rgba(60,90,115,0.20) 0%, transparent 100%)",
      groundFar:  "#0c1a0c", groundMid:  "#122010", groundNear: "#102814", groundFore: "#0a1c0c",
      treeCol: "#0a1408", hazeColor: "rgba(80,110,135,0.16)", cloudCol: "rgba(120,155,175,0.55)",
    },
    night: {
      skyBase:    "linear-gradient(180deg,#030608 0%,#06100e 28%,#0c181c 62%,#141e24 100%)",
      skyGlow:    "radial-gradient(ellipse 45% 32% at 40% 85%, rgba(60,90,115,0.12) 0%, transparent 52%)",
      skyHorizon: "radial-gradient(ellipse 100% 16% at 50% 100%, rgba(40,70,90,0.22) 0%, transparent 100%)",
      groundFar:  "#080e08", groundMid:  "#0e1a0a", groundNear: "#0c1c0e", groundFore: "#081008",
      treeCol: "#060c06", hazeColor: "rgba(60,90,115,0.14)", cloudCol: "rgba(80,110,135,0.45)",
    },
  },
  Drizzle: {
    morning: {
      skyBase:    "linear-gradient(180deg,#101c28 0%,#1e2e3c 28%,#304452 58%,#485c6e 100%)",
      skyGlow:    "radial-gradient(ellipse 58% 38% at 42% 86%, rgba(110,145,168,0.18) 0%, transparent 58%)",
      skyHorizon: "radial-gradient(ellipse 100% 20% at 50% 100%, rgba(90,125,148,0.20) 0%, transparent 100%)",
      groundFar:  "#122012", groundMid:  "#1c2e18", groundNear: "#162a14", groundFore: "#101e0c",
      treeCol: "#102010", hazeColor: "rgba(110,145,168,0.16)", cloudCol: "rgba(170,195,215,0.62)",
    },
    afternoon: {
      skyBase:    "linear-gradient(180deg,#121e28 0%,#1e2e3a 28%,#2c3c4e 58%,#404e60 100%)",
      skyGlow:    "radial-gradient(ellipse 55% 36% at 42% 87%, rgba(108,140,162,0.16) 0%, transparent 56%)",
      skyHorizon: "radial-gradient(ellipse 100% 20% at 50% 100%, rgba(88,122,142,0.18) 0%, transparent 100%)",
      groundFar:  "#142014", groundMid:  "#1e2e1a", groundNear: "#182c16", groundFore: "#122010",
      treeCol: "#122012", hazeColor: "rgba(108,140,162,0.14)", cloudCol: "rgba(165,190,210,0.60)",
    },
    evening: {
      skyBase:    "linear-gradient(180deg,#080c12 0%,#121820 28%,#1c2830 55%,#283848 100%)",
      skyGlow:    "radial-gradient(ellipse 50% 34% at 38% 90%, rgba(80,108,132,0.14) 0%, transparent 54%)",
      skyHorizon: "radial-gradient(ellipse 100% 18% at 50% 100%, rgba(62,92,112,0.20) 0%, transparent 100%)",
      groundFar:  "#0c180a", groundMid:  "#12220e", groundNear: "#102814", groundFore: "#0a1c0c",
      treeCol: "#0a1408", hazeColor: "rgba(80,108,132,0.16)", cloudCol: "rgba(110,142,165,0.55)",
    },
    night: {
      skyBase:    "linear-gradient(180deg,#040608 0%,#080e12 30%,#0e161c 62%,#161e28 100%)",
      skyGlow:    "radial-gradient(ellipse 44% 30% at 40% 84%, rgba(58,88,112,0.12) 0%, transparent 50%)",
      skyHorizon: "radial-gradient(ellipse 100% 16% at 50% 100%, rgba(38,68,88,0.22) 0%, transparent 100%)",
      groundFar:  "#080e08", groundMid:  "#0e180a", groundNear: "#0c1c0e", groundFore: "#081008",
      treeCol: "#060a06", hazeColor: "rgba(58,88,112,0.14)", cloudCol: "rgba(78,108,132,0.45)",
    },
  },
  Thunderstorm: {
    morning:   thunder(),
    afternoon: thunder(),
    evening:   thunderDark(),
    night:     thunderDark(),
  },
  Snow: {
    morning: {
      skyBase:    "linear-gradient(180deg,#a0b8d0 0%,#b8cce0 30%,#d0e0ee 65%,#e8f0f8 100%)",
      skyGlow:    "radial-gradient(ellipse 65% 45% at 42% 85%, rgba(240,248,255,0.40) 0%, transparent 68%)",
      skyHorizon: "radial-gradient(ellipse 100% 22% at 50% 100%, rgba(220,238,252,0.30) 0%, transparent 100%)",
      groundFar:  "#b8ccd8", groundMid:  "#c8d8e4", groundNear: "#d0dce8", groundFore: "#c0ccd8",
      treeCol: "#9ab0bc", hazeColor: "rgba(200,225,242,0.30)", cloudCol: "rgba(255,255,255,0.75)",
    },
    afternoon: {
      skyBase:    "linear-gradient(180deg,#90b0cc 0%,#a8c4d8 30%,#c0d8e8 65%,#d8ecf8 100%)",
      skyGlow:    "radial-gradient(ellipse 62% 42% at 75% 14%, rgba(255,252,240,0.30) 0%, transparent 62%)",
      skyHorizon: "radial-gradient(ellipse 100% 20% at 50% 100%, rgba(210,235,250,0.25) 0%, transparent 100%)",
      groundFar:  "#b0cad6", groundMid:  "#c0d4e0", groundNear: "#c8dcea", groundFore: "#b8c8d4",
      treeCol: "#92a8b4", hazeColor: "rgba(190,220,240,0.25)", cloudCol: "rgba(255,255,255,0.78)",
    },
    evening: {
      skyBase:    "linear-gradient(180deg,#383050 0%,#504868 32%,#706880 60%,#9890a4 100%)",
      skyGlow:    "radial-gradient(ellipse 70% 48% at 42% 88%, rgba(180,165,205,0.38) 0%, transparent 66%)",
      skyHorizon: "radial-gradient(ellipse 100% 24% at 50% 100%, rgba(170,155,195,0.28) 0%, transparent 100%)",
      groundFar:  "#6878888", groundMid:  "#788898", groundNear: "#8090a0", groundFore: "#707880",
      treeCol: "#5a6878", hazeColor: "rgba(160,150,185,0.20)", cloudCol: "rgba(205,200,218,0.60)",
    },
    night: {
      skyBase:    "linear-gradient(180deg,#101828 0%,#1a2440 32%,#263258 62%,#344270 100%)",
      skyGlow:    "radial-gradient(ellipse 52% 40% at 64% 20%, rgba(140,168,240,0.14) 0%, transparent 55%)",
      skyHorizon: "radial-gradient(ellipse 100% 18% at 50% 100%, rgba(55,80,120,0.28) 0%, transparent 100%)",
      groundFar:  "#283848", groundMid:  "#304258", groundNear: "#384e64", groundFore: "#202e3e",
      treeCol: "#1c2a38", hazeColor: "rgba(80,110,165,0.14)", cloudCol: "rgba(150,165,210,0.32)",
    },
  },
  Atmosphere: {
    morning: {
      skyBase:    "linear-gradient(180deg,#503828 0%,#6e5238 28%,#8e6e4e 55%,#b08c60 100%)",
      skyGlow:    "radial-gradient(ellipse 75% 50% at 42% 90%, rgba(200,155,80,0.48) 0%, transparent 68%)",
      skyHorizon: "radial-gradient(ellipse 100% 28% at 50% 100%, rgba(185,140,70,0.32) 0%, transparent 100%)",
      groundFar:  "#584030", groundMid:  "#705048", groundNear: "#604538", groundFore: "#4a3020",
      treeCol: "#4a3428", hazeColor: "rgba(190,145,75,0.35)", cloudCol: "rgba(210,175,120,0.55)",
    },
    afternoon: {
      skyBase:    "linear-gradient(180deg,#5e5648 0%,#7e7668 28%,#9e9680 58%,#c0b898 100%)",
      skyGlow:    "radial-gradient(ellipse 68% 45% at 78% 14%, rgba(220,200,155,0.30) 0%, transparent 62%)",
      skyHorizon: "radial-gradient(ellipse 100% 22% at 50% 100%, rgba(200,185,140,0.25) 0%, transparent 100%)",
      groundFar:  "#685848", groundMid:  "#807060", groundNear: "#6e5e50", groundFore: "#564836",
      treeCol: "#585040", hazeColor: "rgba(200,185,140,0.28)", cloudCol: "rgba(218,200,165,0.58)",
    },
    evening: {
      skyBase:    "linear-gradient(180deg,#281808 0%,#3c2818 25%,#583828 52%,#785040 78%,#986858 100%)",
      skyGlow:    "radial-gradient(ellipse 72% 50% at 40% 88%, rgba(195,120,75,0.50) 0%, transparent 68%)",
      skyHorizon: "radial-gradient(ellipse 100% 26% at 50% 100%, rgba(180,110,65,0.30) 0%, transparent 100%)",
      groundFar:  "#382018", groundMid:  "#503028", groundNear: "#44281e", groundFore: "#321a14",
      treeCol: "#2e1c14", hazeColor: "rgba(180,110,65,0.28)", cloudCol: "rgba(192,130,88,0.48)",
    },
    night: {
      skyBase:    "linear-gradient(180deg,#0c0808 0%,#141010 28%,#1c1818 58%,#262020 100%)",
      skyGlow:    "radial-gradient(ellipse 48% 36% at 60% 20%, rgba(120,90,70,0.10) 0%, transparent 52%)",
      skyHorizon: "radial-gradient(ellipse 100% 18% at 50% 100%, rgba(40,28,22,0.28) 0%, transparent 100%)",
      groundFar:  "#141010", groundMid:  "#1c1414", groundNear: "#181210", groundFore: "#100e0c",
      treeCol: "#0e0c0c", hazeColor: "rgba(80,60,50,0.14)", cloudCol: "rgba(110,85,72,0.40)",
    },
  },
};

function thunder(): Pal {
  return {
    skyBase:    "linear-gradient(180deg,#020304 0%,#030508 22%,#060810 50%,#0e1318 100%)",
    skyGlow:    "radial-gradient(ellipse 60% 40% at 50% 80%, rgba(80,100,140,0.14) 0%, transparent 60%)",
    skyHorizon: "radial-gradient(ellipse 100% 18% at 50% 100%, rgba(40,55,80,0.20) 0%, transparent 100%)",
    groundFar:  "#060808", groundMid:  "#0a0c0a", groundNear: "#080a08", groundFore: "#050705",
    treeCol: "#040604", hazeColor: "rgba(50,65,90,0.20)", cloudCol: "rgba(58,68,92,0.68)",
  };
}
function thunderDark(): Pal {
  return {
    skyBase:    "linear-gradient(180deg,#010203 0%,#020305 22%,#04060a 50%,#080c10 100%)",
    skyGlow:    "radial-gradient(ellipse 55% 36% at 50% 85%, rgba(60,75,110,0.12) 0%, transparent 55%)",
    skyHorizon: "radial-gradient(ellipse 100% 16% at 50% 100%, rgba(28,38,58,0.20) 0%, transparent 100%)",
    groundFar:  "#040606", groundMid:  "#070808", groundNear: "#060706", groundFore: "#040504",
    treeCol: "#030404", hazeColor: "rgba(38,50,72,0.18)", cloudCol: "rgba(42,52,72,0.72)",
  };
}

const FALLBACK = PAL.Clear;

// ── Book atmosphere tints ─────────────────────────────────────────────────────
const ATM_TINTS: Partial<Record<string, string>> = {
  mystery: "rgba(20,0,50,0.10)", thriller: "rgba(30,0,10,0.10)",
  romance: "rgba(50,0,20,0.08)", adventure: "rgba(10,25,0,0.07)",
  scifi: "rgba(0,20,40,0.10)", philosophical: "rgba(10,10,30,0.09)",
  spiritual: "rgba(30,20,0,0.09)", poetry: "rgba(25,5,30,0.08)",
};

// ── CSS keyframes injected once ───────────────────────────────────────────────
const KF = `
@keyframes cL  { from{transform:translateX(-20%)} to{transform:translateX(118%)} }
@keyframes cR  { from{transform:translateX(118%)} to{transform:translateX(-20%)} }
@keyframes cLS { from{transform:translateX(-25%)} to{transform:translateX(122%)} }
@keyframes bird{ 0%{transform:translateX(-8vw) translateY(0)} 100%{transform:translateX(110vw) translateY(-5vh)} }
@keyframes twinkle { 0%,100%{opacity:0.12} 50%{opacity:0.95} }
@keyframes sunPulse { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.07)} }
@keyframes shimmer { 0%,100%{opacity:0.50} 50%{opacity:0.78} }
`;

// ── Canvases ──────────────────────────────────────────────────────────────────
function RainCanvas({ heavy = false }: { heavy?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
    resize(); addEventListener("resize", resize);
    const drops = Array.from({ length: heavy ? 360 : 200 }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      len: Math.random() * (heavy ? 34 : 22) + 10, spd: Math.random() * (heavy ? 22 : 12) + 5,
      op: Math.random() * 0.38 + 0.07,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      drops.forEach(d => {
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1.6, d.y + d.len);
        ctx.strokeStyle = `rgba(180,220,255,${d.op})`; ctx.lineWidth = 0.75; ctx.stroke();
        d.y += d.spd; d.x -= 1.1;
        if (d.y > cv.height) { d.y = -d.len; d.x = Math.random() * cv.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, [heavy]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 12 }} />;
}

function RippleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    cv.width = innerWidth; cv.height = innerHeight;
    type R = { x: number; y: number; r: number; maxR: number; op: number };
    const list: R[] = [];
    const iv = setInterval(() => list.push({ x: Math.random() * cv.width, y: cv.height * (0.72 + Math.random() * 0.22), r: 0, maxR: 20 + Math.random() * 30, op: 0.40 }), 360);
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i]; r.r += 0.88; r.op = 0.40 * (1 - r.r / r.maxR);
        if (r.op <= 0) { list.splice(i, 1); continue; }
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.28, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(150,200,255,${r.op})`; ctx.lineWidth = 0.9; ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); clearInterval(iv); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 13 }} />;
}

function SnowCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
    resize(); addEventListener("resize", resize);
    const flakes = Array.from({ length: 145 }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      r: Math.random() * 3.5 + 1, spd: Math.random() * 1.5 + 0.3,
      drift: Math.random() * 0.8 - 0.4, ang: Math.random() * Math.PI * 2,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      flakes.forEach(f => {
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(230,242,255,0.84)"; ctx.fill();
        f.y += f.spd; f.x += f.drift + Math.sin(f.ang) * 0.28; f.ang += 0.018;
        if (f.y > cv.height) { f.y = -f.r; f.x = Math.random() * cv.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 12 }} />;
}

function StarsCanvas({ fireflies = false }: { fireflies?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
    resize(); addEventListener("resize", resize);
    const items = Array.from({ length: fireflies ? 38 : 130 }, () => ({
      x: Math.random() * innerWidth,
      y: fireflies ? Math.random() * innerHeight * 0.9 : Math.random() * innerHeight * 0.62,
      r: fireflies ? Math.random() * 2.5 + 1.5 : Math.random() * 1.8 + 0.3,
      op: Math.random(), maxOp: fireflies ? 0.9 : Math.random() * 0.85 + 0.15,
      spd: (Math.random() * 0.012 + 0.004) * (Math.random() > 0.5 ? 1 : -1),
      vx: fireflies ? (Math.random() - 0.5) * 0.32 : 0,
      vy: fireflies ? (Math.random() - 0.5) * 0.22 : 0,
      hue: fireflies ? [55, 90, 135, 200][Math.floor(Math.random() * 4)] : 215,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      items.forEach(s => {
        s.op += s.spd;
        if (s.op > s.maxOp || s.op < 0) s.spd *= -1;
        if (fireflies) { s.x += s.vx; s.y += s.vy; if (s.x < 0 || s.x > cv.width) s.vx *= -1; if (s.y < 0 || s.y > cv.height) s.vy *= -1; }
        const op = Math.max(0, s.op);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        if (fireflies) { ctx.shadowBlur = s.r * 5; ctx.shadowColor = `hsla(${s.hue},100%,70%,${op})`; ctx.fillStyle = `hsla(${s.hue},100%,80%,${op})`; }
        else { ctx.fillStyle = `hsla(${s.hue},35%,92%,${op})`; }
        ctx.fill(); ctx.shadowBlur = 0;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, [fireflies]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 11 }} />;
}

function DustCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
    resize(); addEventListener("resize", resize);
    const p = Array.from({ length: 220 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 3.5 + 1, spd: Math.random() * 2.8 + 0.8, op: Math.random() * 0.22 + 0.04 }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      p.forEach(q => { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(200,160,80,${q.op})`; ctx.fill(); q.x += q.spd; if (q.x > cv.width + q.r) { q.x = -q.r; q.y = Math.random() * cv.height; } });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 12 }} />;
}

// ── Sun ──────────────────────────────────────────────────────────────────────
function Sun({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  if (timeOfDay === "night") return null;
  const cfg: Record<TimeOfDay, { left: string; top: string; disk: number; corona: number; diskCol: string; glowCol: string; outerCol: string } | null> = {
    morning:   { left:"35%", top:"70%", disk:44, corona:180, diskCol:"#ffcc60", glowCol:"rgba(255,145,30,0.72)", outerCol:"rgba(255,110,20,0.22)" },
    afternoon: { left:"76%", top:"14%", disk:52, corona:240, diskCol:"#fff8b0", glowCol:"rgba(255,248,160,0.50)", outerCol:"rgba(255,240,120,0.14)" },
    evening:   { left:"40%", top:"74%", disk:48, corona:200, diskCol:"#ff9020", glowCol:"rgba(230,75,10,0.78)", outerCol:"rgba(200,50,5,0.25)" },
    night: null,
  };
  const c = cfg[timeOfDay]; if (!c) return null;
  return (
    <div className="absolute pointer-events-none" style={{ zIndex:4, left:c.left, top:c.top, transform:"translate(-50%,-50%)" }}>
      {/* Outer corona */}
      <div style={{ position:"absolute", width:c.corona*1.8, height:c.corona*1.8, borderRadius:"50%", background:`radial-gradient(circle, ${c.outerCol} 0%, transparent 68%)`, transform:"translate(-50%,-50%)", left:"50%", top:"50%" }} />
      {/* Inner glow */}
      <div style={{ position:"absolute", width:c.corona, height:c.corona, borderRadius:"50%", background:`radial-gradient(circle, ${c.glowCol} 0%, transparent 70%)`, transform:"translate(-50%,-50%)", left:"50%", top:"50%", animation:"sunPulse 7s ease-in-out infinite" }} />
      {/* Sun disk */}
      <div style={{ position:"absolute", width:c.disk, height:c.disk, borderRadius:"50%", background:`radial-gradient(circle at 35% 35%, #fff8e0 0%, ${c.diskCol} 55%, ${c.glowCol.replace("0.72","1").replace("0.50","1").replace("0.78","1")} 100%)`, boxShadow:`0 0 ${c.disk*1.2}px ${c.disk*0.6}px ${c.glowCol}`, transform:"translate(-50%,-50%)", left:"50%", top:"50%", animation:"sunPulse 5s ease-in-out infinite" }} />
    </div>
  );
}

// ── Moon ─────────────────────────────────────────────────────────────────────
function Moon({ timeOfDay, snow }: { timeOfDay: TimeOfDay; snow?: boolean }) {
  if (timeOfDay !== "night") return null;
  const mc = snow ? "#f0f4ff" : "#f0e8d0";
  const shadowBg = snow ? "#263258" : "#04102e";
  return (
    <div className="absolute pointer-events-none" style={{ zIndex:4, left:"68%", top:"13%", transform:"translate(-50%,-50%)" }}>
      {/* Outer atmospheric glow */}
      <div style={{ position:"absolute", width:220, height:220, borderRadius:"50%", background:`radial-gradient(circle, ${mc}14 0%, transparent 70%)`, transform:"translate(-50%,-50%)", left:"50%", top:"50%", animation:"sunPulse 10s ease-in-out infinite" }} />
      {/* Inner halo */}
      <div style={{ position:"absolute", width:90, height:90, borderRadius:"50%", background:`radial-gradient(circle, ${mc}30 0%, transparent 70%)`, transform:"translate(-50%,-50%)", left:"50%", top:"50%" }} />
      {/* Moon disk */}
      <div style={{ position:"absolute", width:44, height:44, borderRadius:"50%", background:`radial-gradient(circle at 38% 32%, #fffce8 0%, ${mc} 52%, ${mc}cc 100%)`, boxShadow:`0 0 28px 10px ${mc}38, 0 0 60px 20px ${mc}18`, transform:"translate(-50%,-50%)", left:"50%", top:"50%", overflow:"hidden" }}>
        {/* Crescent shadow */}
        <div style={{ position:"absolute", width:36, height:36, borderRadius:"50%", background:shadowBg, top:-4, right:-10 }} />
      </div>
    </div>
  );
}

// ── 3D Cloud Blob (realistic volumetric) ─────────────────────────────────────
type CloudDef = { top: number; width: number; anim: string; dur: number; blur: number; opacity: number; scale?: number };

function Cloud3D({ top, width, anim, dur, blur, opacity, scale = 1, cloudCol }: CloudDef & { cloudCol: string }) {
  // Each cloud = group of overlapping blurred ellipses for volume
  const sz = width * scale;
  return (
    <div style={{
      position: "absolute", top: `${top}%`, left: 0,
      width: `${sz}%`, minWidth: 80,
      height: `${sz * 0.38}%`, minHeight: 35,
      animation: `${anim} ${dur}s linear infinite`,
      opacity,
      filter: `blur(${blur}px)`,
      willChange: "transform",
    }}>
      {/* Cloud body made of CSS shapes */}
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {/* Base large blob */}
        <div style={{ position:"absolute", bottom:0, left:"8%", width:"82%", height:"55%", borderRadius:"50% 50% 50% 50%/60% 60% 40% 40%", background:cloudCol, boxShadow:`inset 0 -8px 20px rgba(0,0,0,0.18), inset 0 8px 16px rgba(255,255,255,0.35)` }} />
        {/* Top bump 1 (left) */}
        <div style={{ position:"absolute", bottom:"42%", left:"12%", width:"45%", height:"65%", borderRadius:"50%", background:cloudCol, boxShadow:`inset 0 -4px 12px rgba(0,0,0,0.12), inset 0 6px 12px rgba(255,255,255,0.32)` }} />
        {/* Top bump 2 (right) */}
        <div style={{ position:"absolute", bottom:"36%", left:"42%", width:"40%", height:"70%", borderRadius:"50%", background:cloudCol, boxShadow:`inset 0 -4px 12px rgba(0,0,0,0.10), inset 0 6px 12px rgba(255,255,255,0.28)` }} />
        {/* Top peak */}
        <div style={{ position:"absolute", bottom:"52%", left:"28%", width:"30%", height:"58%", borderRadius:"50%", background:cloudCol, boxShadow:`inset 0 6px 10px rgba(255,255,255,0.38)` }} />
        {/* Soft shadow underneath */}
        <div style={{ position:"absolute", bottom:"-8%", left:"15%", width:"70%", height:"18%", borderRadius:"50%", background:"rgba(0,0,0,0.18)", filter:"blur(6px)" }} />
      </div>
    </div>
  );
}

function CloudLayer({ condition, cloudCol }: { condition: string; cloudCol: string }) {
  const cvg = condition==="Thunderstorm" ? 1 : condition==="Clouds" ? 0.92 : (condition==="Rain"||condition==="Drizzle") ? 0.80 : condition==="Snow" ? 0.68 : condition==="Atmosphere" ? 0.58 : 0.28;
  // [top%, width%, anim, dur, blur, opacity]
  type CD = [number, number, string, number, number, number];
  const defs: CD[] = [
    [3,  28, "cL",  52, 6, 0.82],
    [10, 24, "cR",  68, 5, 0.68],
    [17, 36, "cLS", 44, 4, 0.78],
    [6,  20, "cR",  78, 7, 0.55],
    [22, 30, "cL",  60, 3, 0.72],
    [14, 32, "cLS", 48, 4, 0.88],
  ];
  const active = defs.slice(0, Math.round(defs.length * cvg));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex:5 }}>
      {active.map(([top, width, anim, dur, blur, opacity], i) => (
        <Cloud3D key={i} top={top} width={width} anim={anim} dur={dur} blur={blur} opacity={opacity} cloudCol={cloudCol} />
      ))}
    </div>
  );
}

// ── 3D Terrain System ─────────────────────────────────────────────────────────
// Uses CSS clip-path polygons with progressive atmospheric depth
// Each layer: lighter/more blurred = farther away

const HILL_PATHS = {
  farMountains: "polygon(0% 42%, 6% 28%, 14% 34%, 22% 22%, 30% 30%, 38% 18%, 46% 26%, 54% 16%, 62% 24%, 70% 14%, 78% 22%, 86% 16%, 93% 24%, 100% 28%, 100% 100%, 0% 100%)",
  farHills:     "polygon(0% 56%, 8% 44%, 18% 50%, 30% 40%, 42% 48%, 55% 38%, 67% 46%, 78% 38%, 88% 44%, 96% 40%, 100% 44%, 100% 100%, 0% 100%)",
  midHills:     "polygon(0% 66%, 10% 54%, 22% 62%, 36% 52%, 50% 60%, 64% 50%, 76% 58%, 88% 52%, 96% 58%, 100% 60%, 100% 100%, 0% 100%)",
  nearGround:   "polygon(0% 78%, 12% 68%, 25% 74%, 40% 66%, 55% 72%, 70% 64%, 84% 70%, 94% 68%, 100% 70%, 100% 100%, 0% 100%)",
  foreground:   "polygon(0% 88%, 15% 82%, 35% 86%, 55% 80%, 75% 84%, 90% 80%, 100% 82%, 100% 100%, 0% 100%)",
};

// Snow variant — flatter, snowy hills
const SNOW_HILLS = {
  farMountains: "polygon(0% 48%, 8% 32%, 18% 38%, 28% 26%, 38% 34%, 50% 24%, 62% 32%, 72% 22%, 82% 28%, 92% 22%, 100% 28%, 100% 100%, 0% 100%)",
  farHills:     "polygon(0% 60%, 10% 48%, 22% 56%, 34% 44%, 48% 52%, 62% 42%, 74% 50%, 86% 44%, 96% 48%, 100% 50%, 100% 100%, 0% 100%)",
  midHills:     "polygon(0% 72%, 12% 60%, 26% 66%, 40% 56%, 54% 64%, 68% 56%, 80% 62%, 92% 58%, 100% 62%, 100% 100%, 0% 100%)",
  nearGround:   "polygon(0% 82%, 14% 72%, 28% 76%, 44% 68%, 58% 74%, 72% 68%, 86% 72%, 96% 70%, 100% 72%, 100% 100%, 0% 100%)",
  foreground:   "polygon(0% 90%, 18% 85%, 38% 88%, 58% 82%, 76% 86%, 92% 82%, 100% 84%, 100% 100%, 0% 100%)",
};

// Tree silhouettes (rendered on midHills as SVG overlay)
function TreeLayer({ condition, fill }: { condition: string; fill: string }) {
  const isSnow    = condition === "Snow";
  const isRain    = condition === "Rain" || condition === "Drizzle";
  const isCloudy  = condition === "Clouds";

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex:8 }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" style={{ position:"absolute", bottom:0, left:0 }}>
        {isSnow  && <PineTrees3D fill={fill} />}
        {isRain  && <ParkTrees3D fill={fill} />}
        {isCloudy && <LoneTrees3D fill={fill} />}
        {!isSnow && !isRain && !isCloudy && <DefaultTrees3D fill={fill} />}
      </svg>
    </div>
  );
}

function PineTrees3D({ fill }: { fill: string }) {
  const xs = [4, 11, 21, 32, 44, 57, 68, 80, 90, 96];
  return <>
    {xs.map((x, i) => {
      const h = 9 + (i % 3) * 3.5; const base = 68 - (i % 4) * 0.5;
      return <g key={i} transform={`translate(${x},0)`}>
        <rect x="-0.8" y={base} width="1.6" height="6" fill={fill} opacity="0.9" />
        <polygon points={`0,${base-h} ${-h*0.43},${base} ${h*0.43},${base}`} fill={fill} opacity="0.95" />
        <polygon points={`0,${base-h*0.72} ${-h*0.40},${base-h*0.32} ${h*0.40},${base-h*0.32}`} fill={fill} opacity="0.88" />
        <polygon points={`0,${base-h*0.50} ${-h*0.32},${base-h*0.16} ${h*0.32},${base-h*0.16}`} fill={fill} opacity="0.75" />
        {/* Snow cap */}
        <polygon points={`0,${base-h-0.5} ${-h*0.12},${base-h+2} ${h*0.12},${base-h+2}`} fill="rgba(230,242,255,0.85)" />
      </g>;
    })}
  </>;
}

function ParkTrees3D({ fill }: { fill: string }) {
  const data = [[6,18,0.9],[16,20,1.0],[29,15,0.85],[44,19,0.95],[59,16,0.88],[72,21,0.98],[84,14,0.82],[92,18,0.90]];
  return <>
    {data.map(([x, h, op], i) => {
      const base = 66; const rw = h * 0.60;
      return <g key={i} transform={`translate(${x},0)`} opacity={op}>
        <rect x="-0.9" y={base-h} width="1.8" height={h} fill={fill} />
        <ellipse cx="0" cy={base-h}      rx={rw/2}       ry={rw*0.56} fill={fill} />
        <ellipse cx="0" cy={base-h-rw*0.32} rx={rw*0.42} ry={rw*0.48} fill={fill} opacity="0.88" />
        <ellipse cx="0" cy={base-h-rw*0.55} rx={rw*0.30} ry={rw*0.35} fill={fill} opacity="0.75" />
      </g>;
    })}
  </>;
}

function LoneTrees3D({ fill }: { fill: string }) {
  return <>
    {/* Main dramatic lone tree */}
    <g transform="translate(62,0)">
      <rect x="-1.2" y="35" width="2.4" height="11" fill={fill} />
      <ellipse cx="0"   cy="30"   rx="9"   ry="6.5" fill={fill} opacity="0.95" />
      <ellipse cx="-4"  cy="32.5" rx="7"   ry="5.8" fill={fill} />
      <ellipse cx="4"   cy="33"   rx="7.5" ry="5.8" fill={fill} />
      <ellipse cx="0"   cy="26"   rx="7.5" ry="5.8" fill={fill} opacity="0.88" />
      <ellipse cx="-2.5" cy="23"  rx="6"   ry="4.5" fill={fill} opacity="0.75" />
      <ellipse cx="2"   cy="22"   rx="5.5" ry="4"   fill={fill} opacity="0.62" />
    </g>
    {/* Small tree */}
    <g transform="translate(22,0)">
      <rect x="-0.8" y="40" width="1.6" height="8" fill={fill} />
      <ellipse cx="0" cy="36" rx="5.2" ry="4.2" fill={fill} />
      <ellipse cx="0" cy="33.5" rx="4.5" ry="3.8" fill={fill} opacity="0.85" />
      <ellipse cx="0" cy="31" rx="3.8" ry="3"   fill={fill} opacity="0.70" />
    </g>
    {/* Bush */}
    <g transform="translate(82,0)">
      <ellipse cx="0" cy="42" rx="4.5" ry="3.2" fill={fill} opacity="0.72" />
      <ellipse cx="0" cy="40.5" rx="3.5" ry="2.8" fill={fill} opacity="0.60" />
    </g>
  </>;
}

function DefaultTrees3D({ fill }: { fill: string }) {
  const trees = [[8,0.88],[20,1.0],[33,0.80],[48,0.95],[62,0.85],[76,1.02],[88,0.78]];
  return <>
    {trees.map(([x, sc], i) => {
      const base = 70; const h = 11 * sc;
      return <g key={i} transform={`translate(${x},${base - h * 10}) scale(${sc})`} style={{ transformOrigin:`${x}px ${base}px` }}>
        <rect x="-1.1" y={h*10-2} width="2.2" height="9" fill={fill} />
        <ellipse cx="0"   cy={h*10-8}  rx="6"   ry="5"   fill={fill} opacity="0.95" />
        <ellipse cx="-2.5" cy={h*10-6} rx="5"   ry="4.5" fill={fill} opacity="0.90" />
        <ellipse cx="2.5" cy={h*10-5.5} rx="5.5" ry="4.2" fill={fill} opacity="0.88" />
        <ellipse cx="0"   cy={h*10-12} rx="5.5" ry="4.5" fill={fill} opacity="0.82" />
        <ellipse cx="0"   cy={h*10-16} rx="4.5" ry="3.8" fill={fill} opacity="0.70" />
      </g>;
    })}
  </>;
}

function Terrain3D({ condition, timeOfDay, pal }: { condition: string; timeOfDay: TimeOfDay; pal: Pal }) {
  const isSnow = condition === "Snow";
  const paths = isSnow ? SNOW_HILLS : HILL_PATHS;
  const isEvening = timeOfDay === "evening" || timeOfDay === "night";

  // Mix ground color with a hint of sky-horizon for atmospheric perspective
  const mixColor = (base: string, opacity: number) =>
    `linear-gradient(180deg, ${base} 0%, ${base} 100%)`;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex:6 }}>
      {/* Water layer (clear evening/night) */}
      {isEvening && pal.waterCol && condition === "Clear" && (
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"32%", background:`linear-gradient(180deg, transparent, ${pal.waterCol} 100%)`, zIndex:5, animation:"shimmer 6s ease-in-out infinite" }} />
      )}

      {/* Far mountains — very hazy/light (atmospheric perspective depth) */}
      <div style={{
        position:"absolute", inset:0,
        clipPath: paths.farMountains,
        background: mixColor(pal.groundFar, 1),
        opacity: 0.42,
        filter: "blur(2.5px)",
        mixBlendMode: "normal",
      }} />

      {/* Far hills — second depth layer */}
      <div style={{
        position:"absolute", inset:0,
        clipPath: paths.farHills,
        background: `linear-gradient(180deg, ${pal.groundFar} 0%, ${pal.groundMid} 100%)`,
        opacity: 0.65,
        filter: "blur(1.2px)",
      }} />

      {/* Mid hills */}
      <div style={{
        position:"absolute", inset:0,
        clipPath: paths.midHills,
        background: `linear-gradient(180deg, ${pal.groundMid} 0%, ${pal.groundNear} 100%)`,
        opacity: 0.85,
        filter: "blur(0.4px)",
      }} />

      {/* Trees on mid hills */}
      <TreeLayer condition={condition} fill={pal.treeCol} />

      {/* Near ground */}
      <div style={{
        position:"absolute", inset:0,
        clipPath: paths.nearGround,
        background: `linear-gradient(180deg, ${pal.groundNear} 0%, ${pal.groundFore} 100%)`,
        opacity: 0.94,
      }} />

      {/* Foreground strip */}
      <div style={{
        position:"absolute", inset:0,
        clipPath: paths.foreground,
        background: `linear-gradient(180deg, ${pal.groundNear} 0%, ${pal.groundFore} 100%)`,
        opacity: 1,
      }} />

      {/* Atmospheric haze gradient (horizon glow fading up) */}
      <div style={{
        position:"absolute", inset:0,
        background:`linear-gradient(180deg, transparent 40%, ${pal.hazeColor} 72%, ${pal.hazeColor.replace(/[\d.]+\)$/, '0.0)')} 100%)`,
        pointerEvents:"none",
      }} />
    </div>
  );
}

// ── Birds ─────────────────────────────────────────────────────────────────────
function Birds({ count = 7 }: { count?: number }) {
  const list = Array.from({ length: count }, (_, i) => ({ top: 6 + i * 3.5, delay: i * 3.2 + (i % 2) * 5.5, dur: 22 + i * 4.5, sz: 10 + (i % 3) * 3, op: 0.30 + (i % 3) * 0.14 }));
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex:9 }}>
      {list.map((b, i) => (
        <svg key={i} style={{ position:"absolute", top:`${b.top}%`, left:0, width:b.sz, height:b.sz * 0.58, opacity:b.op, animation:`bird ${b.dur}s ${b.delay}s linear infinite` }} viewBox="0 0 20 12">
          <path d="M10,8 Q5,1.5 0,4.5 Q5,6 10,8 Q15,6 20,4.5 Q15,1.5 10,8Z" fill="white" />
        </svg>
      ))}
    </div>
  );
}

// ── Lightning ─────────────────────────────────────────────────────────────────
function Lightning() {
  return (
    <motion.div className="absolute inset-0 bg-slate-100/6 pointer-events-none" style={{ zIndex:14 }}
      animate={{ opacity:[0,0,0,0,0,0.6,0.08,0.35,0,0,0,0,0,0] }}
      transition={{ duration:9, repeat:Infinity, ease:"easeOut" }} />
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const ISLAMIC = ["دينية", "إسلامية", "إسلامي"];
const isIslamic = (c?: string) => c ? ISLAMIC.some(k => c.includes(k)) : false;

export function WeatherBackground({ conditionGroup="Clear", category, userImageUrl, timeOfDay="afternoon", bookAtmosphere }: WeatherBackgroundProps) {
  const islamic   = isIslamic(category);
  const pal       = (PAL[conditionGroup] ?? FALLBACK)[timeOfDay];
  const atmTint   = bookAtmosphere ? (ATM_TINTS[bookAtmosphere] ?? null) : null;
  const isNight   = timeOfDay === "night";
  const isSnow    = conditionGroup === "Snow";
  const isRain    = conditionGroup === "Rain" || conditionGroup === "Drizzle";
  const isThunder = conditionGroup === "Thunderstorm";
  const isClear   = conditionGroup === "Clear";
  const isFoggy   = conditionGroup === "Atmosphere";
  const showBirds = !isThunder && !isRain && !isSnow && (isClear || conditionGroup === "Clouds");
  const key       = `${conditionGroup}-${timeOfDay}-${!!islamic}`;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <style>{KF}</style>

      {/* ① Sky gradient */}
      <AnimatePresence mode="wait">
        {userImageUrl ? (
          <motion.div key="user"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage:`url("${userImageUrl}")` }}
            initial={{ opacity:0, scale:1.08 }}
            animate={{ opacity:1, scale:[1.08,1.02,1.06], x:[0,-12,0], y:[0,-6,0] }}
            exit={{ opacity:0 }}
            transition={{ opacity:{duration:2.2}, scale:{duration:30,repeat:Infinity}, x:{duration:30,repeat:Infinity}, y:{duration:30,repeat:Infinity} }}
          />
        ) : (
          <motion.div key={`sky-${key}`}
            className="absolute inset-0"
            style={{ background: islamic ? "linear-gradient(180deg,#000003 0%,#020818 28%,#04102e 65%,#091840 100%)" : pal.skyBase }}
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:2.5 }}
          />
        )}
      </AnimatePresence>

      {!userImageUrl && (
        <>
          {/* ② Sky glow — sun/moon position atmospheric scatter */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex:1, background:pal.skyGlow }} />
          {/* ③ Horizon scatter */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex:2, background:pal.skyHorizon }} />

          {/* ④ Sun / Moon */}
          {!islamic && <><Sun timeOfDay={timeOfDay} /><Moon timeOfDay={timeOfDay} snow={isSnow} /></>}

          {/* ⑤ Cloud layer */}
          <AnimatePresence mode="wait">
            <motion.div key={`cl-${key}`} className="absolute inset-0"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:2 }}>
              <CloudLayer condition={conditionGroup} cloudCol={pal.cloudCol} />
            </motion.div>
          </AnimatePresence>

          {/* ⑥ 3D Terrain */}
          <AnimatePresence mode="wait">
            <motion.div key={`terrain-${key}`} className="absolute inset-0"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:2.2 }}>
              <Terrain3D condition={conditionGroup} timeOfDay={timeOfDay} pal={pal} />
            </motion.div>
          </AnimatePresence>

          {/* ⑦ Birds */}
          {showBirds && <Birds count={conditionGroup === "Clouds" ? 9 : 6} />}

          {/* ⑧ Weather FX */}
          <AnimatePresence mode="wait">
            <motion.div key={`fx-${key}`} className="absolute inset-0"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:1.4 }}>
              {islamic && <><StarsCanvas /><StarsCanvas fireflies /></>}
              {!islamic && isClear && isNight  && <StarsCanvas />}
              {!islamic && isRain   && <><RainCanvas /><RippleCanvas /></>}
              {!islamic && isThunder && <><RainCanvas heavy /><RippleCanvas /><Lightning /></>}
              {!islamic && isSnow   && <SnowCanvas />}
              {!islamic && isFoggy  && <DustCanvas />}
            </motion.div>
          </AnimatePresence>

          {/* ⑨ Atmospheric depth overlay — makes far objects look hazy/real */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex:10, background:"linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.08) 65%, transparent 100%)" }} />
        </>
      )}

      {/* ⑩ Book atmosphere tint */}
      <AnimatePresence>
        {atmTint && (
          <motion.div key={`atm-${bookAtmosphere}`} className="absolute inset-0"
            style={{ background:atmTint, zIndex:15, pointerEvents:"none" }}
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:2.2 }} />
        )}
      </AnimatePresence>

      {/* ⑪ Vignettes (keep UI readable) */}
      <div className="absolute bottom-0 left-0 right-0 h-80 pointer-events-none" style={{ background:"linear-gradient(to top, rgba(2,6,23,0.97) 0%, rgba(2,6,23,0.26) 60%, transparent 100%)", zIndex:16 }} />
      <div className="absolute top-0 left-0 right-0 h-36 pointer-events-none"    style={{ background:"linear-gradient(to bottom, rgba(2,6,23,0.28) 0%, transparent 100%)", zIndex:16 }} />
      <div className="absolute inset-y-0 left-0 w-24 pointer-events-none"  style={{ background:"linear-gradient(to right, rgba(2,6,23,0.16) 0%, transparent 100%)", zIndex:16 }} />
      <div className="absolute inset-y-0 right-0 w-24 pointer-events-none" style={{ background:"linear-gradient(to left, rgba(2,6,23,0.16) 0%, transparent 100%)", zIndex:16 }} />
    </div>
  );
}
