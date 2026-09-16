import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { QUOTES } from "@/lib/quotes";
import type { Lang } from "@/lib/i18n";

interface WisdomQuoteProps {
  lang: Lang;
  isRtl: boolean;
}

const INTERVAL_MS = 9_000;

export function WisdomQuote({ lang, isRtl }: WisdomQuoteProps) {
  const pool = QUOTES[lang];
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * pool.length));
  const [dir, setDir] = useState(1);

  useEffect(() => { setIdx(Math.floor(Math.random() * QUOTES[lang].length)); }, [lang]);

  const go = useCallback((delta: number) => {
    setDir(delta);
    setIdx(i => (i + delta + pool.length) % pool.length);
  }, [pool.length]);

  useEffect(() => {
    const t = setInterval(() => go(1), INTERVAL_MS);
    return () => clearInterval(t);
  }, [go]);

  const quote = pool[idx];

  const variants = {
    enter:  (d: number) => ({ opacity: 0, x: d > 0 ? 32 : -32, filter: "blur(6px)" }),
    center:             { opacity: 1, x: 0,  filter: "blur(0px)" },
    exit:   (d: number) => ({ opacity: 0, x: d > 0 ? -28 : 28, filter: "blur(4px)" }),
  };

  return (
    <div
      className="relative w-full flex items-center gap-2 px-1"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Prev */}
      <button
        onClick={() => go(-1)}
        aria-label="السابق"
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/6 border border-white/10 text-white/30 hover:bg-white/12 hover:text-amber-300/70 transition-all"
      >
        {isRtl ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Quote body */}
      <div className="flex-1 min-w-0 relative h-[132px] sm:h-[96px] flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={`${lang}-${idx}`}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center"
          >
            {/* Fixed book icon */}
            <span className="text-base leading-none mb-0.5 opacity-70">📖</span>

            {/* Quote text */}
            <p
              className={`max-w-full break-words text-white/82 font-light leading-relaxed ${lang === "ar" ? "text-[13px] sm:text-sm" : "text-xs"}`}
              style={{ fontFamily: lang === "ar" ? "'Amiri', 'Noto Naskh Arabic', serif" : "inherit" }}
            >
              {lang === "ar" ? `«${quote.text}»` : `"${quote.text}"`}
            </p>

            {/* Author */}
            <p className="text-amber-300/55 text-[11px] font-medium tracking-wide">
              — {quote.author}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Next */}
      <button
        onClick={() => go(1)}
        aria-label="التالي"
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/6 border border-white/10 text-white/30 hover:bg-white/12 hover:text-amber-300/70 transition-all"
      >
        {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {/* Dot indicators */}
      <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 flex gap-1">
        {pool.map((_, i) => (
          <button
            key={i}
            onClick={() => { setDir(i > idx ? 1 : -1); setIdx(i); }}
            className="transition-all rounded-full"
            style={{
              width:      i === idx ? 14 : 5,
              height:     3,
              background: i === idx ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.18)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
