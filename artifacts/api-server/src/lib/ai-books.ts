import OpenAI from "openai";
import { logger } from "./logger";

const AI_BOOKS_MODEL = process.env.AI_BOOKS_MODEL?.trim()
  || (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim() ? "gpt-5.6-luna" : "gpt-5-mini");
const PROVIDER_TIMEOUT_MS = 15_000;
const PROVIDER_ATTEMPTS = 2;
const MAX_PROMPT_CHARS = 1_200;
const MAX_CONTEXT_CHARS = 180;
const MAX_BOOK_TEXT_CHARS = 500;

function getOpenAiClient(): OpenAI {
  const integrationBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
  const apiKey = (integrationBaseUrl
    ? process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    : process.env.OPENAI_API_KEY)?.trim();
  if (!apiKey || /[^\x00-\x7F]/.test(apiKey)) {
    throw new Error("OpenAI provider credentials are missing or invalid");
  }
  return new OpenAI({
    apiKey,
    ...(integrationBaseUrl ? { baseURL: integrationBaseUrl } : {}),
    timeout: PROVIDER_TIMEOUT_MS,
    maxRetries: 0,
  });
}

function normalizeText(value: unknown, maxLength = MAX_CONTEXT_CHARS): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function canonicalBookKey(title: string, author = ""): string {
  return `${title} ${author}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function boundedYear(value: unknown): number | undefined {
  const year = Number(value);
  const currentYear = new Date().getFullYear();
  return Number.isInteger(year) && year >= 1450 && year <= currentYear ? year : undefined;
}

async function withProviderRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < PROVIDER_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < PROVIDER_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI provider request failed");
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI provider returned an invalid JSON object");
  }
  return parsed as Record<string, unknown>;
}

export type AiBook = {
  title: string;
  author: string;
  category: string;
  subcategory: string;
  rating: string;
  reason: string;
  quote: string;
  atmosphere?: string;
  length?: string;
  publishedYear?: number;
  publishedMonth?: number;
};

export type AiBookPreview = {
  interpretedRequest: string;
  summary: string;
  books: Array<AiBook & {
    tags: string[];
    fitScore: number;
  }>;
};

export type AiBookPreviewParams = {
  prompt: string;
  mode?: "custom" | "hidden_gem" | "trending" | "classic" | "excerpt";
  searchRound?: number;
  city?: string;
  mood?: string;
  category?: string;
  weatherCondition?: string;
  temperature?: number;
  timeOfDay?: string;
  language?: "ar" | "en" | "fr";
  cityBookLang?: "ar" | "en" | "fr";
  excludeBooks?: string[];
  bookLength?: string;
  ageGroup?: string;
  season?: string;
};

// Seed phrases to bust the cache and force varied results each call
const SEED_PHRASES = [
  "overlooked gem", "hidden masterpiece", "unexpected classic", "rare find",
  "underrated novel", "forgotten treasure", "surprising pick", "fresh perspective",
  "bold recommendation", "unconventional choice", "timeless but unknown",
  "critically acclaimed", "reader favourite", "cult classic", "literary surprise",
];

function pickSeed(round: number): string {
  return SEED_PHRASES[round % SEED_PHRASES.length];
}

const LANG_LABELS: Record<string, string> = { ar: "Arabic", en: "English", fr: "French" };

export async function generateAiBooks(params: {
  mood: string;
  category: string;
  weather: string;
  timeOfDay: string;
  language: "ar" | "en" | "fr";
  ageGroup?: string;
  excludeTitles?: string[];
  bookLength?: string;
  searchRound?: number;
  count?: number;
}): Promise<AiBook[]> {
  const {
    mood, category, weather, timeOfDay, language = "ar",
    ageGroup, excludeTitles = [], bookLength, searchRound = 1, count = 5,
  } = params;
  const safeCount = Math.max(1, Math.min(10, Math.floor(count)));
  const safeMood = normalizeText(mood);
  const safeCategory = normalizeText(category);
  const safeWeather = normalizeText(weather);
  const safeTimeOfDay = normalizeText(timeOfDay);
  const safeAgeGroup = normalizeText(ageGroup, 40);
  const safeBookLength = normalizeText(bookLength, 40);
  const safeExcludedTitles = [...new Set(excludeTitles
    .map(title => normalizeText(title))
    .filter(Boolean))].slice(0, 20);

  const langLabel = LANG_LABELS[language] ?? "Arabic";
  const seed = pickSeed(searchRound);
  const exclude = safeExcludedTitles.length
    ? `\nDo NOT suggest any of these books (already shown): ${safeExcludedTitles.join("; ")}`
    : "";

  const lengthHint = safeBookLength && safeBookLength !== "أي طول" && safeBookLength !== "any"
    ? `\n- Prefer ${safeBookLength === "قصير" || safeBookLength === "short" ? "short" : "long"} books (under 300 pages / over 400 pages respectively).`
    : "";

  const ageHint = safeAgeGroup
    ? `\n- Target age group: ${safeAgeGroup}.`
    : "";

  const weatherMap: Record<string, string> = {
    Clear: "sunny and bright", Clouds: "overcast and cloudy", Rain: "rainy",
    Drizzle: "light drizzle", Thunderstorm: "stormy", Snow: "snowy",
    Atmosphere: "foggy or misty",
  };
  const weatherDesc = weatherMap[safeWeather] ?? safeWeather;

  const systemPrompt = `You are an expert multilingual book recommender. Always respond with ${langLabel} books only — books originally written in ${langLabel} or widely available in ${langLabel} translation. Your recommendations should feel fresh, varied, and personalised.`;

  const userPrompt = `Recommend exactly ${safeCount} books. Think of something like a "${seed}".

Context:
- Reader's mood: "${safeMood}"
- Book category/genre: "${safeCategory}"
- Current weather: ${weatherDesc}
- Time of day: ${safeTimeOfDay}${ageHint}${lengthHint}${exclude}

Return ONLY a JSON object with key "books" containing an array of ${safeCount} objects, each with these fields:
{
  "title": "Book title (in ${langLabel})",
  "author": "Author full name",
  "category": "Genre label",
  "subcategory": "Sub-genre or theme",
  "rating": "Empty string unless a rating is independently verifiable",
  "reason": "2-3 sentences explaining why this book perfectly fits the mood, weather, and category",
  "quote": "Always an empty string; do not provide quotes",
  "atmosphere": "one of: adventure|mystery|romance|family|scifi|thriller|philosophical|spiritual|poetry|selfhelp|history|science|classic",
  "length": "${language === "ar" ? "قصير or طويل" : "short or long"}"
}

Important: Suggest DIFFERENT books on each call. Be creative and go beyond the obvious bestsellers.
Only recommend real published books. Never invent ratings or quotes: leave both empty when not independently verifiable. Never use a publication year later than ${new Date().getFullYear()}.`;

  try {
    const response = await withProviderRetry(() => getOpenAiClient().chat.completions.create({
      model: AI_BOOKS_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    }));

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = parseJsonObject(raw);
    const candidateBooks = parsed.books
      ?? parsed.suggestions
      ?? parsed.recommendations
      ?? Object.values(parsed)[0];
    const arr: unknown[] = Array.isArray(candidateBooks) ? candidateBooks : [];

    const excludedKeys = new Set(safeExcludedTitles.map(title => canonicalBookKey(title)));
    const seen = new Set<string>();
    return arr.map((value: unknown) => {
      const book = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const title = normalizeText(book.title);
      const author = normalizeText(book.author);
      const key = canonicalBookKey(title, author);
      return {
        title,
        author,
        category: normalizeText(book.category) || safeCategory,
        subcategory: normalizeText(book.subcategory),
        rating: "", // Ratings are not verified by this provider.
        reason: normalizeText(book.reason, MAX_BOOK_TEXT_CHARS),
        quote: "", // Never present model-generated quotations as authentic.
        atmosphere: normalizeText(book.atmosphere, 40) || undefined,
        length: normalizeText(book.length, 40) || undefined,
        key,
      };
    }).filter(book => book.title && book.author &&
      !excludedKeys.has(canonicalBookKey(book.title)) &&
      !excludedKeys.has(book.key) &&
      !seen.has(book.key) &&
      Boolean(seen.add(book.key)))
      .slice(0, safeCount)
      .map(({ key: _key, ...book }) => book);
  } catch (err) {
    logger.error({ err }, "AI book generation failed");
    return [];
  }
}

const MODE_HINTS: Record<NonNullable<AiBookPreviewParams["mode"]>, string> = {
  custom: "Follow the reader's request precisely and balance it with the context.",
  hidden_gem: "Prioritise overlooked, underrated, or less famous books. Do not return only obvious bestsellers.",
  trending: "Prioritise books with current reader interest and cultural momentum, while never claiming live trend data.",
  classic: "Prioritise older, enduring, canonical, or classic books that fit the request.",
  excerpt: "Prioritise very short books, essays, poetry, short stories, or books suitable for a brief reading session.",
};

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  en: "English",
  fr: "French",
};

type LocalFallbackBook = AiBook & {
  language: "ar" | "en" | "fr";
  keywords: string[];
  popularity: number;
};

const LOCAL_FALLBACK_BOOKS: LocalFallbackBook[] = [
  {
    title: "الخيميائي",
    author: "باولو كويلو",
    category: "روايات مغامرة",
    subcategory: "رحلة وذات",
    rating: "4.8/5",
    reason: "رحلة سانتياغو تمنحك بداية دافئة ومشجعة، وتناسب من يريد قراءة تغيّر مزاجه بهدوء.",
    quote: "",
    atmosphere: "adventure",
    length: "قصير",
    publishedYear: 1988,
    publishedMonth: 8,
    language: "ar",
    keywords: ["مغامرة", "إلهام", "هدوء", "رحلة", "قصير"],
    popularity: 9,
  },
  {
    title: "جزيرة الكنز",
    author: "روبرت لويس ستيفنسون",
    category: "روايات مغامرة",
    subcategory: "مغامرة بحرية",
    rating: "4.4/5",
    reason: "خرائط وقراصنة وكنز مخبأ في حكاية سريعة تمنح جلسة القراءة طاقة ممتعة.",
    quote: "",
    atmosphere: "adventure",
    length: "قصير",
    publishedYear: 1883,
    publishedMonth: 5,
    language: "ar",
    keywords: ["مغامرة", "تشويق", "خفيف", "قصير"],
    popularity: 8,
  },
  {
    title: "حول العالم في ثمانين يوماً",
    author: "جول فيرن",
    category: "روايات مغامرة",
    subcategory: "مغامرة كلاسيكية",
    rating: "4.5/5",
    reason: "رحلة خاطفة حول العالم تناسب من يريد الهروب إلى عوالم بعيدة دون قراءة ثقيلة.",
    quote: "",
    atmosphere: "adventure",
    length: "قصير",
    publishedYear: 1873,
    publishedMonth: 1,
    language: "ar",
    keywords: ["مغامرة", "استكشاف", "سفر", "كلاسيكي"],
    popularity: 8,
  },
  {
    title: "الأمير الصغير",
    author: "أنطوان دو سانت إكزوبيري",
    category: "روايات فلسفية",
    subcategory: "حكاية وتأمل",
    rating: "4.7/5",
    reason: "حكاية قصيرة وشفافة تترك مساحة للتأمل وتناسب ليلة هادئة أو جلسة واحدة.",
    quote: "",
    atmosphere: "philosophical",
    length: "قصير",
    publishedYear: 1943,
    publishedMonth: 4,
    language: "ar",
    keywords: ["تأمل", "هادئ", "فلسفة", "قصير", "أطفال"],
    popularity: 10,
  },
  {
    title: "رجال في الشمس",
    author: "غسان كنفاني",
    category: "روايات اجتماعية",
    subcategory: "إنساني",
    rating: "4.6/5",
    reason: "رواية عربية مكثفة تفتح أسئلة إنسانية عميقة في وقت قصير، لمن يريد قراءة مؤثرة.",
    quote: "",
    atmosphere: "philosophical",
    length: "قصير",
    publishedYear: 1969,
    publishedMonth: 6,
    language: "ar",
    keywords: ["اجتماعي", "إنساني", "فلسفة", "قصير", "عربي"],
    popularity: 8,
  },
  {
    title: "آلام فرتر",
    author: "يوهان فولفغانغ فون غوته",
    category: "روايات كلاسيكية",
    subcategory: "حب وتأمل",
    rating: "4.3/5",
    reason: "رسائل عاطفية وتأملات صادقة من عمل كلاسيكي مكثف يناسب من يبحث عن قراءة قديمة ومؤثرة.",
    quote: "",
    atmosphere: "romance",
    length: "متوسط",
    publishedYear: 1774,
    publishedMonth: 9,
    language: "ar",
    keywords: ["كلاسيكي", "قديم", "حب", "تأمل", "رومانسي"],
    popularity: 7,
  },
  {
    title: "البؤساء",
    author: "فيكتور هوغو",
    category: "روايات تاريخية",
    subcategory: "عدالة وأمل",
    rating: "4.7/5",
    reason: "ملحمة إنسانية واسعة عن الرحمة والعدالة تمنح القراءة القديمة عمقاً ودفئاً.",
    quote: "",
    atmosphere: "history",
    length: "طويل",
    publishedYear: 1862,
    publishedMonth: 3,
    language: "ar",
    keywords: ["كلاسيكي", "قديم", "تاريخ", "عدالة", "أمل"],
    popularity: 9,
  },
  {
    title: "الجريمة والعقاب",
    author: "فيودور دوستويفسكي",
    category: "روايات فلسفية",
    subcategory: "ضمير وعدالة",
    rating: "4.6/5",
    reason: "رحلة نفسية وفلسفية قوية تناسب من يريد كتاباً قديماً ثقيلاً بالأفكار والأسئلة.",
    quote: "",
    atmosphere: "philosophical",
    length: "طويل",
    publishedYear: 1866,
    publishedMonth: 1,
    language: "ar",
    keywords: ["كلاسيكي", "قديم", "فلسفة", "نفس", "عدالة"],
    popularity: 9,
  },
  {
    title: "آنا كارينينا",
    author: "ليو تولستوي",
    category: "روايات كلاسيكية",
    subcategory: "الحب والمجتمع",
    rating: "4.6/5",
    reason: "رواية واسعة عن الحب والاختيارات والمجتمع، مناسبة لجلسة قراءة طويلة ومتأنية.",
    quote: "",
    atmosphere: "romance",
    length: "طويل",
    publishedYear: 1878,
    publishedMonth: 1,
    language: "ar",
    keywords: ["كلاسيكي", "قديم", "حب", "مجتمع", "طويل"],
    popularity: 9,
  },
  {
    title: "مغامرات شيرلوك هولمز",
    author: "آرثر كونان دويل",
    category: "روايات بوليسية",
    subcategory: "ألغاز وتحقيق",
    rating: "4.5/5",
    reason: "مجموعة ألغاز كلاسيكية تمنحك تشويقاً متجدداً ويمكن قراءة كل قصة منها على حدة.",
    quote: "",
    atmosphere: "mystery",
    length: "متوسط",
    publishedYear: 1892,
    publishedMonth: 10,
    language: "ar",
    keywords: ["كلاسيكي", "قديم", "غموض", "تشويق", "ألغاز"],
    popularity: 9,
  },
  {
    title: "دون كيخوته",
    author: "ميغيل دي ثيربانتس",
    category: "روايات كلاسيكية",
    subcategory: "سخرية ومغامرة",
    rating: "4.5/5",
    reason: "أحد أقدم الأعمال الروائية الكبرى، يجمع المغامرة والفكاهة والتأمل في رحلة لا تزال حية.",
    quote: "",
    atmosphere: "classic",
    length: "طويل",
    publishedYear: 1605,
    publishedMonth: 1,
    language: "ar",
    keywords: ["كلاسيكي", "قديم", "مغامرة", "فكاهة", "طويل"],
    popularity: 9,
  },
  {
    title: "فرانكنشتاين",
    author: "ماري شيلي",
    category: "خيال علمي",
    subcategory: "الخلق والمسؤولية",
    rating: "4.4/5",
    reason: "رواية مؤسسة في الخيال العلمي، تجمع الأسئلة الأخلاقية بجو غامض ومثير.",
    quote: "",
    atmosphere: "scifi",
    length: "طويل",
    publishedYear: 1818,
    publishedMonth: 1,
    language: "ar",
    keywords: ["كلاسيكي", "قديم", "خيال علمي", "غموض", "إثارة"],
    popularity: 9,
  },
  {
    title: "مدام بوفاري",
    author: "غوستاف فلوبير",
    category: "روايات كلاسيكية",
    subcategory: "المجتمع والرغبة",
    rating: "4.2/5",
    reason: "رواية دقيقة عن الرغبة والمجتمع لمن يريد قراءة قديمة هادئة وعميقة.",
    quote: "",
    atmosphere: "romance",
    length: "طويل",
    publishedYear: 1857,
    publishedMonth: 4,
    language: "ar",
    keywords: ["كلاسيكي", "قديم", "مجتمع", "حب", "طويل"],
    popularity: 8,
  },
  {
    title: "الكونت مونت كريستو",
    author: "ألكسندر دوما",
    category: "روايات مغامرة",
    subcategory: "انتقام وعدالة",
    rating: "4.7/5",
    reason: "مغامرة كلاسيكية واسعة عن الصبر والعدالة والانتقام، مناسبة لمن يريد الانغماس في عمل طويل.",
    quote: "",
    atmosphere: "adventure",
    length: "طويل",
    publishedYear: 1844,
    publishedMonth: 8,
    language: "ar",
    keywords: ["كلاسيكي", "قديم", "مغامرة", "عدالة", "طويل"],
    popularity: 9,
  },
  {
    title: "مرتفعات وذرينغ",
    author: "إميلي برونتي",
    category: "روايات رومانسية",
    subcategory: "حب وعاصفة",
    rating: "4.3/5",
    reason: "أجواء عاطفية وعاصفة في عمل كلاسيكي يليق بقراءة طويلة ومتأنية.",
    quote: "",
    atmosphere: "romance",
    length: "طويل",
    publishedYear: 1847,
    publishedMonth: 12,
    language: "ar",
    keywords: ["كلاسيكي", "قديم", "رومانسي", "عاطفة", "طويل"],
    popularity: 8,
  },
  {
    title: "The Little Prince",
    author: "Antoine de Saint-Exupéry",
    category: "Classic fiction",
    subcategory: "Reflective tale",
    rating: "4.7/5",
    reason: "A short, luminous story that leaves room for reflection and suits a calm reading session.",
    quote: "",
    atmosphere: "philosophical",
    length: "short",
    publishedYear: 1943,
    publishedMonth: 4,
    language: "en",
    keywords: ["classic", "reflective", "calm", "short", "children"],
    popularity: 10,
  },
  {
    title: "The Old Man and the Sea",
    author: "Ernest Hemingway",
    category: "Classic fiction",
    subcategory: "Courage and solitude",
    rating: "4.2/5",
    reason: "A focused, beautifully spare journey for a reader who wants quiet determination in a short book.",
    quote: "",
    atmosphere: "classic",
    length: "short",
    publishedYear: 1952,
    publishedMonth: 9,
    language: "en",
    keywords: ["classic", "calm", "focus", "short", "solitude"],
    popularity: 9,
  },
  {
    title: "Pride and Prejudice",
    author: "Jane Austen",
    category: "Romance",
    subcategory: "Wit and society",
    rating: "4.6/5",
    reason: "Sharp dialogue and generous humour make this a welcoming companion for an unhurried evening.",
    quote: "",
    atmosphere: "romance",
    length: "long",
    publishedYear: 1813,
    publishedMonth: 1,
    language: "en",
    keywords: ["romance", "classic", "humour", "evening"],
    popularity: 10,
  },
  {
    title: "The Secret Garden",
    author: "Frances Hodgson Burnett",
    category: "Family fiction",
    subcategory: "Renewal and nature",
    rating: "4.4/5",
    reason: "A restorative story of friendship and nature for a reader looking for warmth and a gentle change of pace.",
    quote: "",
    atmosphere: "family",
    length: "long",
    publishedYear: 1911,
    publishedMonth: 8,
    language: "en",
    keywords: ["family", "nature", "warm", "hope", "children"],
    popularity: 8,
  },
  {
    title: "The Time Machine",
    author: "H. G. Wells",
    category: "Science fiction",
    subcategory: "Time and discovery",
    rating: "4.1/5",
    reason: "A brisk voyage into the unknown for curious readers who want ideas, movement, and wonder.",
    quote: "",
    atmosphere: "scifi",
    length: "short",
    publishedYear: 1895,
    publishedMonth: 5,
    language: "en",
    keywords: ["science", "adventure", "curious", "discovery", "short"],
    popularity: 8,
  },
  {
    title: "Jane Eyre",
    author: "Charlotte Brontë",
    category: "Classic fiction",
    subcategory: "Identity and love",
    rating: "4.5/5",
    reason: "A fiercely independent voice and a gothic atmosphere make this an absorbing older classic.",
    quote: "",
    atmosphere: "romance",
    length: "long",
    publishedYear: 1847,
    publishedMonth: 10,
    language: "en",
    keywords: ["classic", "older", "romance", "gothic", "long"],
    popularity: 9,
  },
  {
    title: "Frankenstein",
    author: "Mary Shelley",
    category: "Classic fiction",
    subcategory: "Creation and responsibility",
    rating: "4.4/5",
    reason: "A foundational, atmospheric novel for readers who want old ideas wrapped in suspense and wonder.",
    quote: "",
    atmosphere: "scifi",
    length: "long",
    publishedYear: 1818,
    publishedMonth: 1,
    language: "en",
    keywords: ["classic", "older", "science", "mystery", "suspense"],
    popularity: 9,
  },
  {
    title: "Moby-Dick",
    author: "Herman Melville",
    category: "Classic fiction",
    subcategory: "Sea and obsession",
    rating: "4.1/5",
    reason: "An expansive sea journey for a patient reader who wants symbolism, adventure, and an unmistakably old-world scale.",
    quote: "",
    atmosphere: "adventure",
    length: "long",
    publishedYear: 1851,
    publishedMonth: 10,
    language: "en",
    keywords: ["classic", "older", "adventure", "sea", "long"],
    popularity: 8,
  },
  {
    title: "A Tale of Two Cities",
    author: "Charles Dickens",
    category: "Historical fiction",
    subcategory: "Revolution and sacrifice",
    rating: "4.4/5",
    reason: "A propulsive historical classic with high stakes, compassion, and a memorable sense of place.",
    quote: "",
    atmosphere: "history",
    length: "long",
    publishedYear: 1859,
    publishedMonth: 11,
    language: "en",
    keywords: ["classic", "older", "historical", "revolution", "long"],
    popularity: 9,
  },
  {
    title: "The Adventures of Sherlock Holmes",
    author: "Arthur Conan Doyle",
    category: "Mystery",
    subcategory: "Puzzles and deduction",
    rating: "4.5/5",
    reason: "A sequence of crisp mysteries that keeps an older classic feeling lively and easy to dip into.",
    quote: "",
    atmosphere: "mystery",
    length: "medium",
    publishedYear: 1892,
    publishedMonth: 10,
    language: "en",
    keywords: ["classic", "older", "mystery", "suspense", "puzzles"],
    popularity: 9,
  },
  {
    title: "Le Petit Prince",
    author: "Antoine de Saint-Exupéry",
    category: "Classique",
    subcategory: "Conte réflexif",
    rating: "4.7/5",
    reason: "Un récit court et lumineux qui laisse une place douce à la réflexion et à l’imagination.",
    quote: "",
    atmosphere: "philosophical",
    length: "court",
    publishedYear: 1943,
    publishedMonth: 4,
    language: "fr",
    keywords: ["classique", "réflexion", "calme", "court", "enfance"],
    popularity: 10,
  },
  {
    title: "Les Misérables",
    author: "Victor Hugo",
    category: "Roman historique",
    subcategory: "Justice et espoir",
    rating: "4.6/5",
    reason: "Une grande histoire humaine pour une lecture ample, émotionnelle et pleine d’espoir.",
    quote: "",
    atmosphere: "history",
    length: "long",
    publishedYear: 1862,
    publishedMonth: 3,
    language: "fr",
    keywords: ["historique", "classique", "espoir", "long"],
    popularity: 9,
  },
  {
    title: "Madame Bovary",
    author: "Gustave Flaubert",
    category: "Romance",
    subcategory: "Société et désir",
    rating: "4.0/5",
    reason: "Une prose précise et une atmosphère intime pour accompagner une lecture lente et attentive.",
    quote: "",
    atmosphere: "romance",
    length: "long",
    publishedYear: 1857,
    publishedMonth: 4,
    language: "fr",
    keywords: ["romance", "classique", "intime", "soir"],
    popularity: 8,
  },
  {
    title: "L’Étranger",
    author: "Albert Camus",
    category: "Philosophie",
    subcategory: "Existence et regard",
    rating: "4.2/5",
    reason: "Un texte bref et dense pour les moments où l’on cherche une pensée claire et une perspective nouvelle.",
    quote: "",
    atmosphere: "philosophical",
    length: "court",
    publishedYear: 1942,
    publishedMonth: 5,
    language: "fr",
    keywords: ["philosophie", "réflexion", "court", "focus"],
    popularity: 9,
  },
  {
    title: "Vingt mille lieues sous les mers",
    author: "Jules Verne",
    category: "Aventure",
    subcategory: "Exploration",
    rating: "4.4/5",
    reason: "Une exploration riche en images et en découvertes pour une lecture qui fait voyager loin.",
    quote: "",
    atmosphere: "adventure",
    length: "long",
    publishedYear: 1870,
    publishedMonth: 6,
    language: "fr",
    keywords: ["aventure", "exploration", "voyage", "classique"],
    popularity: 8,
  },
  {
    title: "Le Comte de Monte-Cristo",
    author: "Alexandre Dumas",
    category: "Roman classique",
    subcategory: "Aventure et justice",
    rating: "4.7/5",
    reason: "Une grande aventure de vengeance et d’espoir pour une lecture classique, ample et pleine de rebondissements.",
    quote: "",
    atmosphere: "adventure",
    length: "long",
    publishedYear: 1844,
    publishedMonth: 8,
    language: "fr",
    keywords: ["classique", "ancien", "aventure", "justice", "long"],
    popularity: 9,
  },
  {
    title: "Notre-Dame de Paris",
    author: "Victor Hugo",
    category: "Roman historique",
    subcategory: "Histoire et compassion",
    rating: "4.5/5",
    reason: "Une fresque historique et passionnée pour retrouver la puissance d’un grand roman ancien.",
    quote: "",
    atmosphere: "history",
    length: "long",
    publishedYear: 1831,
    publishedMonth: 3,
    language: "fr",
    keywords: ["classique", "ancien", "historique", "passion", "long"],
    popularity: 8,
  },
  {
    title: "Candide",
    author: "Voltaire",
    category: "Philosophie",
    subcategory: "Satire et voyage",
    rating: "4.3/5",
    reason: "Un texte court, ironique et vif pour une lecture ancienne qui provoque encore la réflexion.",
    quote: "",
    atmosphere: "philosophical",
    length: "court",
    publishedYear: 1759,
    publishedMonth: 2,
    language: "fr",
    keywords: ["classique", "ancien", "philosophie", "satire", "court"],
    popularity: 8,
  },
  {
    title: "Le Rouge et le Noir",
    author: "Stendhal",
    category: "Roman classique",
    subcategory: "Ambition et société",
    rating: "4.2/5",
    reason: "Un portrait précis de l’ambition et de la société, idéal pour une lecture longue et attentive.",
    quote: "",
    atmosphere: "classic",
    length: "long",
    publishedYear: 1830,
    publishedMonth: 11,
    language: "fr",
    keywords: ["classique", "ancien", "société", "ambition", "long"],
    popularity: 8,
  },
  {
    title: "Les Fleurs du mal",
    author: "Charles Baudelaire",
    category: "Poésie",
    subcategory: "Beauté et mélancolie",
    rating: "4.4/5",
    reason: "Des poèmes denses et musicaux pour une lecture ancienne, fragmentée et pleine d’atmosphère.",
    quote: "",
    atmosphere: "poetry",
    length: "court",
    publishedYear: 1857,
    publishedMonth: 6,
    language: "fr",
    keywords: ["classique", "ancien", "poésie", "mélancolie", "court"],
    popularity: 8,
  },
];

const LOCAL_FALLBACK_COPY: Record<"ar" | "en" | "fr", { interpreted: string; summary: string }> = {
  ar: {
    interpreted: "الوضع المجاني: اخترت لك بدايات من مكتبة ReMood المحلية.",
    summary: "تعذّر الوصول إلى مزود الذكاء الاصطناعي، لذلك أعددت لك هذه الاقتراحات المجانية من مكتبة ReMood الحالية.",
  },
  en: {
    interpreted: "Free mode: I selected starting points from ReMood’s local library.",
    summary: "The AI provider is unavailable, so these free suggestions come from ReMood’s current local library.",
  },
  fr: {
    interpreted: "Mode gratuit : j’ai choisi des points de départ dans la bibliothèque locale de ReMood.",
    summary: "Le fournisseur IA est indisponible ; ces suggestions gratuites viennent de la bibliothèque locale actuelle de ReMood.",
  },
};

type TemporalConstraints = {
  maxPublicationYear?: number;
  publicationMonth?: number;
};

function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function hashString(value: string): number {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return hash;
}

function extractTemporalConstraints(prompt: string): TemporalConstraints {
  const normalized = normalizeDigits(prompt).toLocaleLowerCase();
  const currentYear = new Date().getFullYear();
  const ageMatch = normalized.match(
    /(?:قبل|أكثر من|فوق|أقدم من|منذ أكثر من)\s*(\d{1,3})\s*(?:سنة|سنوات|عام|أعوام)|(?:older than|over|more than|before)\s*(\d{1,3})\s*years?|(?:plus de|plus âgé de|avant)\s*(\d{1,3})\s*ans?/i,
  );
  const explicitYearMatch = normalized.match(
    /(?:قبل|أقدم من|before|prior to|avant)\s*(?:عام|سنة|year|l'année)?\s*(1[0-9]{3}|20[0-9]{2})\b/i,
  );
  const age = ageMatch ? Number(ageMatch[1] ?? ageMatch[2] ?? ageMatch[3]) : undefined;
  const maxPublicationYear = explicitYearMatch
    ? Number(explicitYearMatch[1])
    : age && age > 0
      ? currentYear - age
      : undefined;
  const publicationMonthPattern = /(?:نشر|نُشر|صدر|إصدار|تاريخ النشر|تاريخ الإصدار|published|publication|release)[^.!?]{0,30}(?:نفس هذا الشهر|هذا الشهر|الشهر الحالي|في هذا الشهر|this month|same month|current month|ce mois(?:-ci)?)/i;
  const reversePublicationMonthPattern = /(?:نفس هذا الشهر|هذا الشهر|الشهر الحالي|في هذا الشهر|this month|same month|current month|ce mois(?:-ci)?)[^.!?]{0,30}(?:نشر|نُشر|صدر|إصدار|تاريخ النشر|تاريخ الإصدار|published|publication|release)/i;
  const asksForPublicationThisMonth = publicationMonthPattern.test(normalized) || reversePublicationMonthPattern.test(normalized);

  return {
    maxPublicationYear,
    publicationMonth: asksForPublicationThisMonth ? new Date().getMonth() + 1 : undefined,
  };
}

function matchesTemporalConstraints(book: AiBook, constraints: TemporalConstraints): boolean {
  if (constraints.maxPublicationYear !== undefined &&
    (book.publishedYear === undefined || book.publishedYear > constraints.maxPublicationYear)) {
    return false;
  }
  if (constraints.publicationMonth !== undefined &&
    (book.publishedMonth === undefined || book.publishedMonth !== constraints.publicationMonth)) {
    return false;
  }
  return true;
}

export function generateLocalBookPreview(params: AiBookPreviewParams): AiBookPreview {
  const responseLanguage = (params.language ?? "ar") as "ar" | "en" | "fr";
  const bookLanguage = (params.cityBookLang ?? responseLanguage) as "ar" | "en" | "fr";
  const prompt = normalizeDigits(normalizeText(params.prompt, MAX_PROMPT_CHARS)).toLocaleLowerCase();
  const excluded = new Set((params.excludeBooks ?? []).map(title => canonicalBookKey(normalizeText(title))).filter(Boolean));
  const lengthPreference = normalizeText(params.bookLength, 40).toLocaleLowerCase();
  const selectedMode = params.mode ?? "custom";
  const searchRound = Math.max(1, Math.min(1_000, Math.floor(params.searchRound ?? 1)));
  const temporalConstraints = extractTemporalConstraints(prompt);

  const ranked = LOCAL_FALLBACK_BOOKS
    .filter(book => book.language === bookLanguage)
    .filter(book => !excluded.has(canonicalBookKey(book.title)) && !excluded.has(canonicalBookKey(book.title, book.author)))
    .filter(book => matchesTemporalConstraints(book, temporalConstraints))
    .map(book => {
      let score = book.popularity;
      const bookLength = book.length?.toLocaleLowerCase() ?? "";
      const variation = (Math.abs(hashString(`${book.title}:${searchRound}`)) % 100) / 100;
      if (book.keywords.some(keyword => prompt.includes(keyword.toLocaleLowerCase()))) score += 4;
      if (params.category && book.category.toLocaleLowerCase().includes(params.category.toLocaleLowerCase())) score += 2;
      if (selectedMode === "classic" && (book.publishedYear ?? new Date().getFullYear()) <= 1980) score += 5;
      if (selectedMode === "trending") score += book.popularity * 1.5;
      if (selectedMode === "hidden_gem") score += (10 - book.popularity) * 1.5;
      if (
        selectedMode === "excerpt" &&
        (bookLength.includes("short") ||
          bookLength.includes("قصير") ||
          bookLength.includes("court"))
      ) score += 3;
      if (lengthPreference && bookLength.includes(lengthPreference)) score += 2;
      score += variation * 2;
      return { book, score };
    })
    .sort((a, b) => b.score - a.score);

  const books = ranked.slice(0, 5).map(({ book, score }) => ({
    title: book.title,
    author: book.author,
    category: book.category,
    subcategory: book.subcategory,
    rating: "",
    reason: book.reason,
    quote: book.quote,
    atmosphere: book.atmosphere,
    length: book.length,
    publishedYear: book.publishedYear,
    publishedMonth: book.publishedMonth,
    tags: [
      selectedMode === "classic" ? (responseLanguage === "ar" ? "كلاسيكي" : responseLanguage === "fr" ? "Classique" : "Classic") : "",
      book.length ?? "",
      responseLanguage === "ar" ? "مجاني" : responseLanguage === "fr" ? "Gratuit" : "Free",
    ].filter((tag): tag is string => Boolean(tag)),
    fitScore: Math.max(72, Math.min(96, Math.round(74 + score))),
  }));

  return {
    interpretedRequest: LOCAL_FALLBACK_COPY[responseLanguage].interpreted,
    summary: LOCAL_FALLBACK_COPY[responseLanguage].summary,
    books,
  };
}

const ATMOSPHERES = new Set([
  "adventure", "mystery", "romance", "family", "scifi", "thriller",
  "philosophical", "spiritual", "poetry", "selfhelp", "history", "science", "classic",
]);

function cleanPreviewBook(book: unknown, fallbackCategory: string) {
  const candidate = book && typeof book === "object" ? book as Record<string, unknown> : {};
  const tags = Array.isArray(candidate.tags)
    ? candidate.tags.map(tag => normalizeText(tag, 40)).filter(Boolean).slice(0, 5)
    : [];
  const fitScore = Number(candidate.fitScore);
  const publishedMonth = Number(candidate.publishedMonth);
  const atmosphere = normalizeText(candidate.atmosphere, 40).toLocaleLowerCase();

  return {
    title: normalizeText(candidate.title),
    author: normalizeText(candidate.author),
    category: normalizeText(candidate.category) || fallbackCategory,
    subcategory: normalizeText(candidate.subcategory),
    rating: "",
    reason: normalizeText(candidate.reason, MAX_BOOK_TEXT_CHARS),
    quote: "",
    atmosphere: ATMOSPHERES.has(atmosphere) ? atmosphere : undefined,
    length: normalizeText(candidate.length, 40) || undefined,
    publishedYear: boundedYear(candidate.publishedYear),
    publishedMonth: Number.isInteger(publishedMonth) && publishedMonth >= 1 && publishedMonth <= 12 ? publishedMonth : undefined,
    tags,
    fitScore: Number.isFinite(fitScore) ? Math.max(0, Math.min(100, Math.round(fitScore))) : 80,
  };
}

function rankPreviewBook(book: ReturnType<typeof cleanPreviewBook>, mode: NonNullable<AiBookPreviewParams["mode"]>): number {
  const year = book.publishedYear ?? new Date().getFullYear();
  const shortBook = /short|court|قصير|essay|poetry|stories/i.test(book.length ?? "") ||
    book.atmosphere === "poetry";
  switch (mode) {
    case "classic":
      return book.fitScore + (year <= 1980 ? 25 : 0) + Math.max(0, 2000 - year) / 100;
    case "excerpt":
      return book.fitScore + (shortBook ? 25 : 0) - (book.length === "long" || book.length === "طويل" ? 15 : 0);
    case "hidden_gem":
      return book.fitScore + (/overlooked|underrated|cult|مغمور|منسي/i.test(`${book.tags.join(" ")} ${book.reason}`) ? 15 : 0);
    case "trending":
      return book.fitScore + (year >= new Date().getFullYear() - 5 ? 8 : 0);
    default:
      return book.fitScore;
  }
}

export async function generateAiBookPreview(params: AiBookPreviewParams): Promise<AiBookPreview> {
  const {
    prompt,
    mode = "custom",
    searchRound = 1,
    city = "",
    mood = "",
    category = "",
    weatherCondition = "",
    temperature,
    timeOfDay = "",
    language = "ar",
    cityBookLang = language,
    excludeBooks = [],
    bookLength = "",
    ageGroup = "",
    season = "",
  } = params;
  const safePrompt = normalizeText(prompt, MAX_PROMPT_CHARS);
  const safeMode = ["custom", "hidden_gem", "trending", "classic", "excerpt"].includes(mode) ? mode : "custom";
  const safeExcludeBooks = [...new Set(excludeBooks.map(book => normalizeText(book)).filter(Boolean))].slice(0, 30);
  const safeContext = {
    city: normalizeText(city),
    mood: normalizeText(mood),
    category: normalizeText(category),
    weatherCondition: normalizeText(weatherCondition),
    timeOfDay: normalizeText(timeOfDay),
    bookLength: normalizeText(bookLength, 40),
    ageGroup: normalizeText(ageGroup, 40),
    season: normalizeText(season, 40),
  };

  const responseLanguage = LANGUAGE_NAMES[language] ?? "Arabic";
  const bookLanguage = LANGUAGE_NAMES[cityBookLang] ?? responseLanguage;
  const modeHint = MODE_HINTS[safeMode] ?? MODE_HINTS.custom;
  const temporalConstraints = extractTemporalConstraints(safePrompt);
  const currentDate = new Date();
  const contextLines = [
    safeContext.city && `- City: ${safeContext.city}`,
    safeContext.mood && `- Mood: ${safeContext.mood}`,
    safeContext.category && `- Existing category: ${safeContext.category}`,
    safeContext.weatherCondition && `- Weather: ${safeContext.weatherCondition}`,
    typeof temperature === "number" && Number.isFinite(temperature) && `- Temperature: ${Math.max(-100, Math.min(100, temperature))}°`,
    safeContext.timeOfDay && `- Local time of day: ${safeContext.timeOfDay}`,
    safeContext.season && `- Season: ${safeContext.season}`,
    safeContext.bookLength && `- Reading length preference: ${safeContext.bookLength}`,
    safeContext.ageGroup && `- Reader age group: ${safeContext.ageGroup}`,
    `- Current date: ${currentDate.toISOString().slice(0, 10)}`,
    `- Search variation: ${Math.max(1, Math.min(1_000, Math.floor(searchRound)))}. Do not repeat books from the excluded list.`,
  ].filter(Boolean).join("\n");
  const exclusions = safeExcludeBooks.length
    ? `\nNever suggest any of these already-read books: ${safeExcludeBooks.join("; ")}`
    : "";
  const temporalInstructions = [
    temporalConstraints.maxPublicationYear !== undefined &&
      `HARD CONSTRAINT: every book must have a first publication year on or before ${temporalConstraints.maxPublicationYear}.`,
    temporalConstraints.publicationMonth !== undefined &&
      `HARD CONSTRAINT: every book must have a verified first publication month equal to ${temporalConstraints.publicationMonth}.`,
    (temporalConstraints.maxPublicationYear !== undefined || temporalConstraints.publicationMonth !== undefined) &&
      "Return publishedYear and publishedMonth for every book. If either date cannot be verified, do not suggest that book.",
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are ReMood's multilingual book discovery assistant.
Respond in ${responseLanguage}. Keep the app language (${responseLanguage}) independent from the book language (${bookLanguage}).
Recommend real, published books. Never invent a title, author, rating, quote, trend claim, or excerpt.
If you are not confident in a quote, use an empty string instead of fabricating one.
Never use a publication year later than ${new Date().getFullYear()}.
${modeHint}`;

  const userPrompt = `The reader wrote:
"${safePrompt}"

Current context:
${contextLines || "- No extra context was provided."}${exclusions}
${temporalInstructions}

Return ONLY this JSON object:
{
  "interpretedRequest": "A concise, user-facing interpretation in ${responseLanguage}",
  "summary": "One warm sentence explaining the direction in ${responseLanguage}",
  "books": [
    {
      "title": "Real book title, preferably in ${bookLanguage}",
      "author": "Author",
      "category": "Genre in ${responseLanguage}",
      "subcategory": "Theme in ${responseLanguage}",
      "rating": "Known rating or empty string",
      "reason": "Two concise sentences in ${responseLanguage} tying the book to the request and context",
      "quote": "Only a short verified public-domain quote or empty string",
      "atmosphere": "one of adventure|mystery|romance|family|scifi|thriller|philosophical|spiritual|poetry|selfhelp|history|science|classic",
      "length": "short or long",
      "publishedYear": 0,
      "publishedMonth": 0,
      "tags": ["up to 5 short labels in ${responseLanguage}"],
      "fitScore": 0
    }
  ]
}
Return exactly 5 books. fitScore must be an integer from 0 to 100.`;

  const response = await withProviderRetry(() => getOpenAiClient().chat.completions.create({
    model: AI_BOOKS_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  }));

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = parseJsonObject(raw);
  const rawBooks = Array.isArray(parsed.books) ? parsed.books : [];
  const excludedKeys = new Set(safeExcludeBooks.map(title => canonicalBookKey(title)));
  const seen = new Set<string>();
  const books = rawBooks
    .map((book: unknown) => cleanPreviewBook(book, safeContext.category || "Books"))
    .filter((book: ReturnType<typeof cleanPreviewBook>) => book.title && book.author)
    .filter((book: ReturnType<typeof cleanPreviewBook>) => matchesTemporalConstraints(book, temporalConstraints))
    .filter((book: ReturnType<typeof cleanPreviewBook>) => {
      const key = canonicalBookKey(book.title, book.author);
      return !excludedKeys.has(canonicalBookKey(book.title)) &&
        !excludedKeys.has(key) && !seen.has(key) && Boolean(seen.add(key));
    })
    .sort((left, right) => rankPreviewBook(right, safeMode) - rankPreviewBook(left, safeMode))
    .slice(0, 5);

  if (books.length !== 5) {
    throw new Error("AI returned an incomplete or invalid set of book suggestions");
  }

  return {
    interpretedRequest: normalizeText(parsed.interpretedRequest, 300) || safePrompt,
    summary: normalizeText(parsed.summary, 400),
    books,
  };
}

export async function transcribeReadingRequest(audio: Buffer, contentType: string, language?: string): Promise<string> {
  const file = await OpenAI.toFile(audio, `remood-voice.${contentType.includes("wav") ? "wav" : "webm"}`, {
    type: contentType || "audio/webm",
  });
  const response = await getOpenAiClient().audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    language: language && ["ar", "en", "fr"].includes(language) ? language : undefined,
    response_format: "json",
  });
  return response.text.trim();
}
