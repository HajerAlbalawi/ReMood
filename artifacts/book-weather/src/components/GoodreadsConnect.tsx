import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetGoodreadsShelf } from "@workspace/api-client-react";
import { BookMarked, Link2, Unlink, CheckCircle, Loader2, AlertCircle, ChevronDown, ChevronUp, X } from "lucide-react";
import { T } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

const STORAGE_KEY = "goodreads_user_id";

interface Props {
  onReadBooksChange: (titles: string[]) => void;
  onGenreProfileChange?: (genres: string[]) => void;
  lang: Lang;
}

const GENRE_LABELS: Record<string, Record<Lang, string>> = {
  fantasy: { ar: "فانتازيا", en: "Fantasy", fr: "Fantastique" },
  mystery: { ar: "غموض وبوليسي", en: "Mystery", fr: "Policier" },
  thriller: { ar: "إثارة وتشويق", en: "Thriller", fr: "Thriller" },
  romance: { ar: "رومانسية", en: "Romance", fr: "Romance" },
  horror: { ar: "رعب", en: "Horror", fr: "Horreur" },
  scifi: { ar: "خيال علمي", en: "Science fiction", fr: "Science-fiction" },
  adventure: { ar: "مغامرات", en: "Adventure", fr: "Aventure" },
  history: { ar: "تاريخ وسير", en: "History", fr: "Histoire" },
  selfhelp: { ar: "تطوير الذات", en: "Self-help", fr: "Développement personnel" },
  science: { ar: "علوم", en: "Science", fr: "Sciences" },
  business: { ar: "أعمال وريادة", en: "Business", fr: "Affaires" },
  spiritual: { ar: "ديني وروحاني", en: "Spiritual", fr: "Spiritualité" },
  poetry: { ar: "شعر", en: "Poetry", fr: "Poésie" },
  children: { ar: "أطفال وناشئة", en: "Children", fr: "Jeunesse" },
  family: { ar: "عائلي واجتماعي", en: "Family", fr: "Famille" },
};

function extractGoodreadsUserId(value: string): string {
  return value.trim().match(/\d{1,20}/)?.[0] ?? "";
}

export function GoodreadsConnect({ onReadBooksChange, onGenreProfileChange, lang }: Props) {
  const t = T[lang];
  const isRtl = lang === "ar";

  const [inputId, setInputId]       = useState("");
  const [connectedId, setConnectedId] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [showBooks, setShowBooks]   = useState(false);

  const { data: readData, isLoading: isReadLoading, isError, error } = useGetGoodreadsShelf(
    { userId: connectedId, shelf: "read" },
    { query: { enabled: !!connectedId, staleTime: 5 * 60 * 1000, retry: 1, queryKey: ["goodreads-shelf", connectedId, "read"] } }
  );
  const { data: toReadData, isLoading: isToReadLoading } = useGetGoodreadsShelf(
    { userId: connectedId, shelf: "to-read" },
    { query: { enabled: !!connectedId, staleTime: 5 * 60 * 1000, retry: 1, queryKey: ["goodreads-shelf", connectedId, "to-read"] } }
  );
  const { data: currentData, isLoading: isCurrentLoading } = useGetGoodreadsShelf(
    { userId: connectedId, shelf: "currently-reading" },
    { query: { enabled: !!connectedId, staleTime: 5 * 60 * 1000, retry: 1, queryKey: ["goodreads-shelf", connectedId, "currently-reading"] } }
  );
  const data = readData;
  const isLoading = isReadLoading || isToReadLoading || isCurrentLoading;
  const combinedLoaded = (readData?.loaded ?? 0) + (toReadData?.loaded ?? 0) + (currentData?.loaded ?? 0);

  useEffect(() => {
    if (readData?.books) {
      onReadBooksChange([
        ...readData.books.map((b) => b.title),
        ...(currentData?.books.map((b) => b.title) ?? []),
      ]);
      trackEvent("goodreads_shelf_loaded", { has_books: readData.books.length > 0 });
    } else onReadBooksChange([]);
  }, [readData, currentData, onReadBooksChange]);

  useEffect(() => {
    const scores = new Map<string, number>();
    for (const item of readData?.genreProfile ?? []) {
      scores.set(item.genre, (scores.get(item.genre) ?? 0) + item.score);
    }
    for (const item of toReadData?.genreProfile ?? []) {
      scores.set(item.genre, (scores.get(item.genre) ?? 0) + item.score * 0.45);
    }
    for (const item of currentData?.genreProfile ?? []) {
      scores.set(item.genre, (scores.get(item.genre) ?? 0) + item.score * 0.8);
    }
    onGenreProfileChange?.(
      [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([genre]) => genre),
    );
  }, [readData, toReadData, currentData, onGenreProfileChange]);

  const handleConnect = () => {
    const id = extractGoodreadsUserId(inputId); if (!id) return;
    trackEvent("goodreads_connect_submitted");
    setConnectedId(id); localStorage.setItem(STORAGE_KEY, id); setInputId("");
  };
  const handleDisconnect = () => {
    trackEvent("goodreads_disconnected");
    setConnectedId(""); localStorage.removeItem(STORAGE_KEY); onReadBooksChange([]); onGenreProfileChange?.([]); setShowBooks(false);
  };

  useEffect(() => {
    if (isError) trackEvent("goodreads_shelf_failed");
  }, [isError]);

  // ── Not connected ────────────────────────────────────────────────────────────
  if (!connectedId) {
    return (
      <motion.div
        className="backdrop-blur-md bg-white/10 border border-white/15 rounded-2xl p-5"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="flex items-center gap-2 mb-3">
          <BookMarked className="w-5 h-5 text-amber-300 flex-shrink-0" />
          <h2 className="text-base font-semibold text-amber-300">{t.grTitle}</h2>
        </div>

        <p className="text-white/60 text-sm mb-4 leading-relaxed">{t.grDesc}</p>

        {/* How to find user ID */}
        <details className="mb-4 group">
          <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60 transition-colors select-none">
            {t.grHowLabel}
          </summary>
          <div className="mt-2 text-xs text-white/50 leading-relaxed bg-black/20 rounded-lg p-3 border border-white/5">
            {t.grHowBody}<br />
            <span className="font-mono text-amber-300/70" dir="ltr">
              goodreads.com/user/show/<strong>12345678</strong>-name
            </span><br />
            {t.grHowPublic}
          </div>
        </details>

        <div className="flex gap-2" dir="ltr">
          <input
            type="text" value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            placeholder="123456789"
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-amber-400/50 transition-colors placeholder:text-white/25"
          />
          <button
            onClick={handleConnect} disabled={!inputId.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 text-slate-900 font-semibold text-sm disabled:opacity-40 hover:bg-amber-300 transition-colors"
          >
            <Link2 className="w-4 h-4" />
            {t.grConnect}
          </button>
        </div>
      </motion.div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="backdrop-blur-md bg-white/10 border border-white/15 rounded-2xl overflow-hidden"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="w-8 h-8 rounded-full bg-amber-400/15 flex items-center justify-center flex-shrink-0">
          <BookMarked className="w-4 h-4 text-amber-300" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isLoading
              ? <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              : isError
              ? <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              : <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="text-sm font-medium text-white">
              {isLoading
                ? t.grLoading
                : isError
                ? t.grError
                : t.grProfileLoaded
                  .replace("{read}", String(readData?.loaded ?? 0))
                  .replace("{toRead}", String(toReadData?.loaded ?? 0))
                  .replace("{current}", String(currentData?.loaded ?? 0))
                  .replace("{total}", String(combinedLoaded))}
            </span>
          </div>
          <p className="text-xs text-white/40 font-mono mt-0.5 truncate" dir="ltr">ID: {connectedId}</p>
          {(readData?.genreProfile?.length ?? 0) > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-[10px] text-white/40">{t.grTasteProfile}</p>
              <div className="flex flex-wrap gap-1">
                {readData!.genreProfile.slice(0, 4).map(({ genre }) => (
                  <span key={genre} className="rounded-full border border-amber-300/15 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100/75">
                    {GENRE_LABELS[genre]?.[lang] ?? genre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {!isError && data && data.loaded > 0 && (
          <button
            onClick={() => setShowBooks((v) => !v)}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
            title={t.grShowBooks}
          >
            {showBooks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}

        <button
          onClick={handleDisconnect}
          className="text-white/30 hover:text-red-400 transition-colors p-1"
          title={t.grDisconnect}
        >
          <Unlink className="w-4 h-4" />
        </button>
      </div>

      {isError && (
        <div className="px-4 pb-4 text-xs text-red-300/80 leading-relaxed">
          {(error as { message?: string })?.message ?? t.grErrorHint}
        </div>
      )}

      {!isLoading && !isError && data && !data.complete && data.warning && (
        <div className="mx-4 mb-3 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100/90">
          <AlertCircle className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-amber-300" />
          {data.warning}
        </div>
      )}
      {!isLoading && toReadData && !toReadData.complete && toReadData.warning && (
        <div className="mx-4 mb-3 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100/90">
          <AlertCircle className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-amber-300" />
          {toReadData.warning}
        </div>
      )}

      <AnimatePresence>
        {showBooks && data && data.books.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-4 pb-4 pt-3 max-h-52 overflow-y-auto space-y-1.5">
              <p className="text-xs text-white/40 mb-2">{t.grReadList}</p>
              {data.books.slice(0, 50).map((book) => (
                <div key={book.goodreadsId || `${book.title}\u0000${book.author}`} className="flex items-center gap-2 text-xs text-white/70">
                  <X className="w-3 h-3 text-red-400/60 flex-shrink-0" />
                  <span className="truncate">{book.title}</span>
                  <span className="text-white/30 truncate">— {book.author}</span>
                </div>
              ))}
              {data.loaded > 50 && (
                <p className="text-xs text-white/30 pt-1">{t.grMoreBooks.replace("{n}", String(data.loaded - 50))}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isLoading && !isError && (
        <div className="px-4 pb-3">
          <p className="text-xs text-emerald-400/70">{t.grActiveNote}</p>
        </div>
      )}
    </motion.div>
  );
}
