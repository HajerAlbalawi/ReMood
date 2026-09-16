import { Router, type IRouter } from "express";
import { GetGoodreadsShelfResponse } from "@workspace/api-zod";
const router: IRouter = Router();

const PAGE_SIZE = 200;
const MAX_PAGES = 25;
const MAX_BOOKS = 5_000;
const PAGE_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

interface GoodreadsBook {
  title: string;
  author: string;
  goodreadsId: string;
  coverUrl?: string;
  rating?: string;
}

const GENRE_RULES: Array<{ genre: string; pattern: RegExp; weight: number }> = [
  { genre: "fantasy", weight: 1.4, pattern: /\bfantasy\b|\bmagic(?:al)?\b|\bwitch(?:es)?\b|\bdragon(?:s)?\b|\bfae\b|\bmyth(?:ology|ological)?\b|\bretelling\b|\bsorcer(?:y|er)\b|فانتازيا|سحر|ساحر|أسطور|خراف/i },
  { genre: "mystery", weight: 1.35, pattern: /\bmystery\b|\bdetective\b|\bwhodunnit\b|\binvestigat(?:e|ion)\b|\bcrime\b|\bmurder\b|غموض|بوليسي|تحقيق|جريمة|قاتل/i },
  { genre: "thriller", weight: 1.2, pattern: /\bthriller\b|\bsuspense\b|\bpsychological thriller\b|\bserial killer\b|إثارة|تشويق/i },
  { genre: "romance", weight: 1, pattern: /\bromance\b|\blove stor(?:y|ies)\b|\bfake dating\b|\bsecond chance\b|\bmarriage\b|رومانسي|قصة حب|عشق|زواج/i },
  { genre: "horror", weight: 1.2, pattern: /\bhorror\b|\bhaunted\b|\bghost stor(?:y|ies)\b|\bnightmare\b|\bterrifying\b|رعب|مسكون|أشباح/i },
  { genre: "scifi", weight: 1.35, pattern: /\bscience fiction\b|\bsci-fi\b|\bspace opera\b|\bdystopi\w*\b|\btime travel\b|\balien\b|خيال علمي|فضاء|ديستوبيا|سفر عبر الزمن/i },
  { genre: "adventure", weight: 0.75, pattern: /\badventure\b|\bquest\b|\bexpedition\b|\bjourney\b|\bsurvival\b|\bexplor(?:e|ation)\b|مغامر|رحلة|استكشاف|بقاء/i },
  { genre: "history", weight: 0.7, pattern: /\bhistory\b|\bhistorical\b|\bempire\b|\bwar\b|\bancient\b|\bbiograph(?:y|ical)\b|\bmemoir\b|تاريخ|تاريخي|سيرة|حرب|حضارة/i },
  { genre: "selfhelp", weight: 1, pattern: /\bself-help\b|\bpersonal development\b|\bproductivity\b|\bhabits?\b|\bmotivation\b|\bparenting\b|\bpsychology\b|تطوير الذات|إنتاجية|عادات|تربية|علم النفس/i },
  { genre: "science", weight: 1, pattern: /\bscience\b|\bphysics\b|\bbiology\b|\bbrain\b|\bcosmos\b|\bevolution\b|علوم|فيزياء|أحياء|دماغ|كون/i },
  { genre: "business", weight: 1, pattern: /\bbusiness\b|\bentrepreneur\w*\b|\bstartup\b|\bmanagement\b|\binvesting\b|\bfinance\b|أعمال|ريادة|إدارة|استثمار|مال/i },
  { genre: "spiritual", weight: 1.25, pattern: /\breligion\b|\bfaith\b|\bspiritual\w*\b|\bislam\w*\b|\bquran\b|دين|إيمان|روحاني|إسلام|قرآن|حديث/i },
  { genre: "poetry", weight: 1.2, pattern: /\bpoetry\b|\bpoems?\b|\bverse\b|شعر|قصائد|ديوان/i },
  { genre: "children", weight: 0.65, pattern: /\bchildren'?s\b|\bmiddle grade\b|\byoung readers?\b|\bkids?\b|أطفال|ناشئة|فتيان/i },
  { genre: "family", weight: 0.35, pattern: /\bfamily\b|\bmother\b|\bfather\b|\bsisters?\b|\bbrothers?\b|عائل|أسرة|أمومة|أبوة/i },
];

function stripHtml(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function inferGenres(title: string, description: string): Array<{ genre: string; weight: number }> {
  const searchable = `${title} ${stripHtml(description)}`;
  return GENRE_RULES.filter(({ pattern }) => pattern.test(searchable)).map(({ genre, weight }) => ({ genre, weight }));
}

function decodeXmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: "\"",
  };

  return value.replace(/&(#x[\da-fA-F]+|#\d+|amp|apos|gt|lt|quot);/g, (entity, code) => {
    if (code in namedEntities) return namedEntities[code];
    const value = code.startsWith("#x") ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return entity;
    try {
      return String.fromCodePoint(value);
    } catch {
      return entity;
    }
  });
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return "";
  const content = m[1].trim();
  const cdata = content.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return decodeXmlEntities((cdata?.[1] ?? content).trim());
}

function extractAllItems(xml: string): string[] {
  const items: string[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    items.push(match[1]);
  }
  return items;
}

function normalizeBookText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function extractReportedTotal(xml: string): number | undefined {
  const match = xml.match(/<(?:reviews|books)[^>]*\btotal=["'](\d+)["']/i)
    ?? xml.match(/<(?:total|total_results)>\s*(\d+)\s*<\/(?:total|total_results)>/i);
  if (!match) return undefined;

  const total = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(total) && total >= 0 ? total : undefined;
}

async function readResponseText(response: Response): Promise<string> {
  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error("Goodreads RSS response exceeds the size limit");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Goodreads RSS response exceeds the size limit");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

router.get("/goodreads/shelf", async (req, res): Promise<void> => {
  const rawUserId = req.query.userId;
  const rawShelf = req.query.shelf;
  const userId = typeof rawUserId === "string" ? rawUserId.trim() : "";
  const shelf = typeof rawShelf === "string" ? rawShelf.trim() : "read";

  if (!/^\d{1,20}$/.test(userId)) {
    res.status(400).json({ error: "يجب أن يكون userId معرّف Goodreads رقمياً صالحاً." });
    return;
  }

  const validShelves = ["read", "to-read", "currently-reading"];
  if (!validShelves.includes(shelf)) {
    res.status(400).json({ error: "shelf غير صالح، يجب أن يكون: read أو to-read أو currently-reading" });
    return;
  }

  const books: GoodreadsBook[] = [];
  const genreScores = new Map<string, number>();
  const seenBooks = new Set<string>();
  const pageSignatures = new Set<string>();
  let reportedTotal: number | undefined;
  let complete = false;
  let warning: string | undefined;

  for (let page = 1; page <= MAX_PAGES && books.length < MAX_BOOKS; page += 1) {
    const rssUrl = `https://www.goodreads.com/review/list_rss/${encodeURIComponent(userId)}?shelf=${encodeURIComponent(shelf)}&per_page=${PAGE_SIZE}&page=${page}`;
    let xmlText: string;
    try {
      const response = await fetch(rssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BookGuide/1.0)",
          "Accept": "application/rss+xml, application/xml, text/xml",
        },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (!response.ok) {
        if (page === 1) {
          req.log.warn({ status: response.status }, "Goodreads RSS non-OK");
          res.status(502).json({ error: "لم نتمكن من الوصول إلى Goodreads. تأكد من أن الملف الشخصي عام وأن المعرّف صحيح." });
          return;
        }
        req.log.warn({ status: response.status, page }, "Goodreads RSS page unavailable");
        warning = "تم تحميل جزء فقط من رف Goodreads لأن صفحة لاحقة لم تكن متاحة.";
        break;
      }
      xmlText = await readResponseText(response);
    } catch {
      if (page === 1) {
        req.log.error("Failed to fetch Goodreads RSS");
        res.status(502).json({ error: "فشل الاتصال بـ Goodreads" });
        return;
      }
      req.log.warn({ page }, "Failed to fetch Goodreads RSS page");
      warning = "تم تحميل جزء فقط من رف Goodreads بسبب انتهاء مهلة صفحة لاحقة أو تعذّر الوصول إليها.";
      break;
    }

    reportedTotal ??= extractReportedTotal(xmlText);
    const items = extractAllItems(xmlText);
    if (items.length === 0) {
      complete = true;
      break;
    }

    const pageSignature = items.map((item) => extractTag(item, "book_id") || `${extractTag(item, "title")}\u0000${extractTag(item, "author_name")}`).join("\u0001");
    if (pageSignatures.has(pageSignature)) {
      warning = "تم تحميل جزء فقط من رف Goodreads لأن Goodreads أعاد صفحة مكررة.";
      break;
    }
    pageSignatures.add(pageSignature);

    for (const item of items) {
      const title = normalizeBookText(extractTag(item, "title"));
      const author = normalizeBookText(extractTag(item, "author_name"));
      const goodreadsId = normalizeBookText(extractTag(item, "book_id"));
      if (!title || !author) continue;

      const dedupeKey = goodreadsId
        ? `id:${goodreadsId}`
        : `book:${title.toLocaleLowerCase()}\u0000${author.toLocaleLowerCase()}`;
      if (seenBooks.has(dedupeKey)) continue;
      seenBooks.add(dedupeKey);

      books.push({
        title,
        author,
        goodreadsId,
        coverUrl: normalizeBookText(extractTag(item, "book_large_image_url") || extractTag(item, "book_image_url")) || undefined,
        rating: normalizeBookText(extractTag(item, "user_rating")) || undefined,
      });
      const userRating = Number.parseInt(extractTag(item, "user_rating"), 10);
      const shelfWeight = shelf === "read"
        ? (userRating >= 4 ? 3 : userRating === 3 ? 1.5 : userRating > 0 ? 0.35 : 1)
        : shelf === "to-read" ? 1 : 1.25;
      for (const { genre, weight } of inferGenres(title, extractTag(item, "book_description"))) {
        genreScores.set(genre, (genreScores.get(genre) ?? 0) + shelfWeight * weight);
      }
      if (books.length === MAX_BOOKS) break;
    }
  }

  if (!complete && !warning) {
    warning = books.length === MAX_BOOKS
      ? "تم تحميل جزء فقط من رف Goodreads بسبب حدّ أمان عدد الكتب."
      : "تم تحميل جزء فقط من رف Goodreads بسبب حدّ أمان عدد الصفحات.";
  }

  const estimatedTotal = Math.max(reportedTotal ?? 0, books.length);
  const genreProfile = [...genreScores.entries()]
    .map(([genre, score]) => ({ genre, score: Math.round(score * 10) / 10 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  res.json(GetGoodreadsShelfResponse.parse({
    userId,
    shelf,
    books,
    genreProfile,
    total: estimatedTotal,
    loaded: books.length,
    reportedTotal: reportedTotal ?? null,
    estimatedTotal,
    complete,
    warning: warning ?? null,
  }));
});

export default router;
