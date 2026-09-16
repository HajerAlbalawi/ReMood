import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetWeather, getGetWeatherQueryKey, useCreateRecommendation,
  useCreateAiBookPreview, useTranscribeVoice,
  type AiBookPreview, type AiBookPreviewBook, type RecommendationInputAgeGroup,
} from "@workspace/api-client-react";
import { CITIES, MOODS, CATEGORIES, READING_STYLES, getCityBookLang, getCityFlag, getCityLocalTime, getCityTimeOfDay, getCityDisplayName, CHILDREN_SECTION_START, type ReadingStyle } from "@/lib/constants";
import {
  LANGUAGES, AGE_GROUPS, OCCASIONS, T, detectSeason, detectOccasion,
  type Lang, type OccasionId, type Season,
} from "@/lib/i18n";
import { WeatherBackground, type TimeOfDay, type BookAtmosphere } from "@/components/weather/WeatherBackground";
import { AmbientSound, type SoundType } from "@/components/AmbientSound";
import { ReadingTimer } from "@/components/ReadingTimer";
import { GoodreadsConnect } from "@/components/GoodreadsConnect";
import { WisdomQuote } from "@/components/WisdomQuote";
import { trackEvent } from "@/lib/analytics";
import {
  MapPin, Sparkles, Droplets, Thermometer, Wind,
  Compass, BookOpen, Quote, ExternalLink,
  BookPlus, Camera, X, BookMarked, Headphones, Globe, Users, Calendar, ChevronDown, Clock,
  Mic, Square, Check, RefreshCw, Gem, TrendingUp, History, Timer, WandSparkles, AlertTriangle,
  ThumbsUp, ThumbsDown,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

type BookFeedback = "liked" | "disliked";
type BookFeedbackMap = Record<string, BookFeedback>;
const BOOK_FEEDBACK_STORAGE_KEY = "remood:book-feedback:v1";
const BOOK_SEEN_STORAGE_KEY = "remood:book-seen:v1";

function loadBookFeedback(): BookFeedbackMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BOOK_FEEDBACK_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, BookFeedback] =>
        entry[0].length <= 240 && (entry[1] === "liked" || entry[1] === "disliked"),
      ),
    );
  } catch {
    return {};
  }
}

function loadSeenBookTitles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BOOK_SEEN_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return [...new Set(
      parsed.filter((title): title is string => typeof title === "string" && title.length <= 240),
    )].slice(-1500);
  } catch {
    return [];
  }
}

const ATMOS_LABELS: Record<string, Record<Lang, string>> = {
  adventure:     { ar: "🗺️ مغامرة",    en: "🗺️ Adventure",   fr: "🗺️ Aventure" },
  mystery:       { ar: "🔍 غموض",      en: "🔍 Mystery",      fr: "🔍 Mystère" },
  horror:        { ar: "👻 رعب",       en: "👻 Horror",       fr: "👻 Horreur" },
  thriller:      { ar: "😱 إثارة",     en: "😱 Thriller",     fr: "😱 Thriller" },
  romance:       { ar: "💕 رومانسي",   en: "💕 Romance",      fr: "💕 Romance" },
  family:        { ar: "👨‍👩‍👧 عائلي",    en: "👨‍👩‍👧 Family",     fr: "👨‍👩‍👧 Famille" },
  scifi:         { ar: "🚀 خيال علمي", en: "🚀 Sci-Fi",       fr: "🚀 Sci-Fi" },
  philosophical: { ar: "💭 فلسفي",     en: "💭 Philosophical", fr: "💭 Philosophique" },
  spiritual:     { ar: "🕌 روحي",      en: "🕌 Spiritual",    fr: "🕌 Spirituel" },
  poetry:        { ar: "🖊️ شعري",      en: "🖊️ Poetry",       fr: "🖊️ Poésie" },
  selfhelp:      { ar: "🌟 تطوير",     en: "🌟 Self-Help",    fr: "🌟 Développement" },
  history:       { ar: "🏛️ تاريخي",    en: "🏛️ Historical",   fr: "🏛️ Historique" },
  science:       { ar: "🔬 علمي",      en: "🔬 Science",      fr: "🔬 Science" },
  classic:       { ar: "📖 كلاسيكي",   en: "📖 Classic",      fr: "📖 Classique" },
};

const CONTENT_WARNING_LABELS: Record<string, Record<Lang, string>> = {
  graphic_violence:             { ar: "عنف دموي وصريح", en: "Graphic violence", fr: "Violence graphique" },
  physical_assault:             { ar: "اعتداء جسدي", en: "Physical assault", fr: "Agression physique" },
  domestic_abuse:               { ar: "عنف أسري", en: "Domestic abuse", fr: "Violence familiale" },
  child_abuse:                  { ar: "إيذاء الأطفال", en: "Child abuse", fr: "Maltraitance infantile" },
  animal_cruelty_death:         { ar: "قسوة أو موت حيوان", en: "Animal cruelty or death", fr: "Cruauté ou mort animale" },
  torture:                      { ar: "تعذيب", en: "Torture", fr: "Torture" },
  kidnapping:                   { ar: "اختطاف أو احتجاز", en: "Kidnapping or captivity", fr: "Enlèvement ou captivité" },
  suicide_self_harm:            { ar: "انتحار أو إيذاء النفس", en: "Suicide or self-harm", fr: "Suicide ou automutilation" },
  eating_disorders:             { ar: "اضطرابات الأكل", en: "Eating disorders", fr: "Troubles alimentaires" },
  mental_illness:               { ar: "اضطرابات نفسية", en: "Mental illness", fr: "Troubles psychiques" },
  grief_loss:                   { ar: "حزن وفقد", en: "Grief and loss", fr: "Deuil et perte" },
  religious_trauma:             { ar: "صدمة أو إساءة دينية", en: "Religious trauma", fr: "Traumatisme religieux" },
  explicit_sexual_content:      { ar: "محتوى جنسي صريح", en: "Explicit sexual content", fr: "Contenu sexuel explicite" },
  sexual_assault:               { ar: "اعتداء جنسي", en: "Sexual assault", fr: "Agression sexuelle" },
  grooming:                     { ar: "استدراج أو استغلال قاصر", en: "Grooming", fr: "Manipulation d’un mineur" },
  nudity:                       { ar: "عُري", en: "Nudity", fr: "Nudité" },
  racism_slurs:                 { ar: "عنصرية أو ألفاظ عرقية مسيئة", en: "Racism or racial slurs", fr: "Racisme ou insultes raciales" },
  terminal_illness:             { ar: "مرض عضال", en: "Terminal illness", fr: "Maladie terminale" },
  miscarriage_abortion:         { ar: "إجهاض أو فقدان جنين", en: "Miscarriage or abortion", fr: "Fausse couche ou avortement" },
  medical_trauma:               { ar: "صدمة أو إجراءات طبية", en: "Medical trauma", fr: "Traumatisme médical" },
  drug_use_addiction:           { ar: "مخدرات أو إدمان", en: "Drug use or addiction", fr: "Drogues ou dépendance" },
  alcohol_abuse:                { ar: "كحول أو إدمانه", en: "Alcohol use or abuse", fr: "Alcool ou dépendance" },
  smoking:                      { ar: "تدخين", en: "Smoking", fr: "Tabagisme" },
  foul_language:                { ar: "ألفاظ نابية", en: "Foul language", fr: "Langage grossier" },
  religious_themes:             { ar: "محتوى ديني إسلامي وقصص إيمانية", en: "Islamic religious themes and faith stories", fr: "Thèmes religieux islamiques et récits de foi" },
  occult_magic:                 { ar: "سحر أو عناصر خارقة", en: "Magic or occult elements", fr: "Magie ou éléments occultes" },
  not_for_children:             { ar: "غير مناسب للأطفال", en: "Not suitable for children", fr: "Ne convient pas aux enfants" },
  child_suitability_unverified: { ar: "ملاءمة الطفل تختلف حسب الطبعة", en: "Child suitability varies by edition", fr: "L’adéquation aux enfants dépend de l’édition" },
};

function getMoodWarning(mood: string, atmosphere: string | undefined, category: string, lang: Lang): string | null {
  const sensitiveMood = /حزين|وحيد|قلق|متوتر|مضغوط|مشتت|مرهق|خائف|مكتئب/i.test(mood);
  const intenseBook = ["thriller", "mystery", "horror"].includes(atmosphere ?? "") ||
    /رعب|إثارة|بوليسية|جريمة|مأساة|حرب/i.test(category);
  if (!sensitiveMood || !intenseBook) return null;
  if (lang === "ar") return "قد يحتوي هذا الكتاب على توتر أو موضوعات ثقيلة؛ قد لا يناسبك الآن إذا كنت تبحث عن قراءة مهدئة. هذا تنبيه عام وليس تقييماً طبياً.";
  if (lang === "fr") return "Ce livre peut contenir de la tension ou des thèmes lourds ; il n’est peut-être pas idéal si vous cherchez une lecture apaisante. Ceci est une note générale, pas un avis médical.";
  return "This book may include tension or heavy themes, so it may not fit if you are looking for something calming right now. This is a general note, not medical advice.";
}

const PUBLICATION_YEARS: Record<string, number> = {
  "الخيميائي": 1988,
  "حول العالم في ثمانين يوماً": 1873,
  "حول العالم في 80 يوماً": 1873,
  "الكونت مونت كريستو": 1844,
  "جزيرة الكنز": 1883,
  "قلب الظلام": 1899,
  "عشرون ألف فرسخ تحت الماء": 1870,
  "روبنسون كروزو": 1719,
  "جريمة في قطار الشرق السريع": 1934,
  "اسم الوردة": 1980,
  "شيرلوك هولمز: دراسة في اللون القرمزي": 1887,
  "قاتل ABC": 1936,
  "المريض الصامت": 2019,
  "البنت في القطار": 2015,
  "دا فينشي كود": 2003,
  "فتاة مختفية": 2012,
  "بيت الأرواح": 1982,
  "ذاكرة الجسد": 1993,
  "ألف شمس مشرقة": 2007,
  "طائر الشوك": 1977,
  "حكاية الجارية": 1985,
  "Atomic Habits": 2018,
  "Deep Work": 2016,
  "The Little Prince": 1943,
  "Le Petit Prince": 1943,
  "Madame Bovary": 1857,
  "À la recherche du temps perdu": 1913,
  "Murder on the Orient Express": 1934,
  "The Hound of the Baskervilles": 1902,
  "Crime and Punishment": 1866,
  "Anna Karenina": 1878,
  "White Nights": 1848,
  "قواعد العشق الأربعون": 2007,
  "العاشق": 1984,
  "وقت الحب": 1985,
  "مؤسسة": 1951,
  "دون": 1965,
  "هاري بوتر وحجر الفلاسفة": 1997,
  "١٩٨٤": 1949,
  "عالم شجاع جديد": 1932,
  "الفرسان الثلاثة": 1844,
  "مئة عام من العزلة": 1967,
  "البؤساء": 1862,
  "الجريمة والعقاب": 1866,
  "الحرب والسلام": 1869,
  "الشيخ والبحر": 1952,
  "أيام": 1970,
  "العادات الذرية": 2018,
  "قوة الآن": 1997,
  "التفكير بسرعة وببطء": 2011,
  "فن اللامبالاة": 2016,
  "من أحرك قطعة الجبن؟": 1998,
  "لماذا ننام؟": 2017,
  "الإنسان يبحث عن معنى": 1946,
  "الإنسان في البحث عن المعنى": 1946,
  "نظرية الكل": 2002,
  "الكون في قشرة جوز": 2001,
  "قصة الحضارة": 1935,
  "الإنسان العاقل: تاريخ موجز للبشرية": 2011,
  "تأملات": 180,
  "البداية والنهاية": 1371,
  "الرحيق المختوم": 1976,
  "إحياء علوم الدين": 1095,
  "فكر وازدد ثراءً": 1937,
  "صفر إلى واحد": 2014,
  "كليلة ودمنة": 750,
  "ألف ليلة وليلة": 1704,
  "The Alchemist": 1988,
  "1984": 1949,
  "Dune": 1965,
  "Thinking, Fast and Slow": 2011,
  "Sapiens: A Brief History of Humankind": 2011,
  "The Hitchhiker's Guide to the Galaxy": 1979,
  "Pride and Prejudice": 1813,
  "Harry Potter and the Philosopher's Stone": 1997,
  "The Power of Now": 1997,
  "Man's Search for Meaning": 1946,
  "Good to Great": 2001,
  "The Hunger Games": 2008,
  "To Kill a Mockingbird": 1960,
  "The Great Gatsby": 1925,
  "The Lord of the Rings": 1954,
  "Life of Pi": 2001,
  "Into the Wild": 1996,
  "Wild": 2012,
  "Gone Girl": 2012,
  "Big Little Lies": 2014,
  "The Girl with the Dragon Tattoo": 2005,
  "Normal People": 2018,
  "Me Before You": 2012,
  "The Notebook": 1996,
  "Educated": 2018,
  "Steve Jobs": 2011,
  "How to Win Friends and Influence People": 1936,
  "The 7 Habits of Highly Effective People": 1989,
  "Rich Dad Poor Dad": 1997,
  "Zero to One": 2014,
  "Meditations": 180,
  "The Subtle Art of Not Giving a F*ck": 2016,
  "Guns, Germs, and Steel": 1997,
  "A Brief History of Time": 1988,
  "Milk and Honey": 2014,
  "Ender's Game": 1985,
  "Rebecca": 1938,
  "And Then There Were None": 1939,
  "The Kite Runner": 2003,
  "Beloved": 1987,
  "The Power of Habit": 2012,
  "Ikigai": 2016,
  "The Old Man and the Sea": 1952,
  "The Diary of a Young Girl": 1947,
  "Norwegian Wood": 1987,
  "The Secret": 2006,
  "The Fault in Our Stars": 2012,
  "Brave New World": 1932,
  "Born a Crime": 2016,
  "Les Misérables": 1862,
  "L'Étranger": 1942,
  "Les Trois Mousquetaires": 1844,
  "Candide": 1759,
  "Charlotte's Web": 1952,
  "Charlie and the Chocolate Factory": 1964,
  "Matilda": 1988,
  "The Lion, the Witch and the Wardrobe": 1950,
  "Percy Jackson & the Lightning Thief": 2005,
  "Wonder": 2012,
  "Diary of a Wimpy Kid": 2007,
  "A Wrinkle in Time": 1962,
  "The BFG": 1982,
  "Les Aventures de Tintin": 1929,
  "Astérix le Gaulois": 1959,
  "20 000 lieues sous les mers": 1870,
  "Les Malheurs de Sophie": 1859,
  "Le Tour du monde en 80 jours": 1873,
  "الأمير الصغير": 1943,
  "ماتيلدا": 1988,
  "الحديقة السرية": 1911,
  "مكتبة ساحة الأعشاب": 2017,
  "أيام في مكتبة موريساكي": 2017,
  "المكتبة المفقودة": 2023,
  "من قتل وليد؟": 2025,
  "The Lost Bookshop": 2023,
  "Days at the Morisaki Bookshop": 2017,
  "The Door-to-Door Bookstore": 2020,
};

const ARABIC_TITLE_ALIASES: Record<string, string[]> = {
  "فتاة مختفية": ["الفتاة المفقودة", "Gone Girl"],
  "Gone Girl": ["الفتاة المفقودة", "فتاة مختفية"],
  "البنت في القطار": ["The Girl on the Train"],
  "المريض الصامت": ["The Silent Patient"],
  "جريمة في قطار الشرق السريع": ["Murder on the Orient Express"],
  "اسم الوردة": ["The Name of the Rose"],
  "شيرلوك هولمز: دراسة في اللون القرمزي": ["A Study in Scarlet"],
  "حول العالم في ثمانين يوماً": ["حول العالم في 80 يوماً", "Around the World in Eighty Days"],
  "الأمير الصغير": ["The Little Prince"],
  "ماتيلدا": ["Matilda"],
  "الحديقة السرية": ["The Secret Garden"],
  "هاري بوتر وحجر الفلاسفة": ["Harry Potter and the Philosopher's Stone"],
  "المكتبة المفقودة": ["The Lost Bookshop"],
  "The Lost Bookshop": ["المكتبة المفقودة"],
  "أيام في مكتبة موريساكي": ["Days at the Morisaki Bookshop"],
  "Days at the Morisaki Bookshop": ["أيام في مكتبة موريساكي"],
  "مكتبة ساحة الأعشاب": ["La librairie de la place aux herbes", "La librería de los deseos"],
};

const BOOK_HISTORY_DETAILS: Record<string, Record<Lang, string>> = {
  Matilda: {
    ar: "«ماتيلدا» رواية إنجليزية للأطفال كتبها المؤلف البريطاني من أصول نرويجية روالد دال، ونُشرت لأول مرة عام 1988.",
    en: "Matilda is an English children's novel by British author of Norwegian descent Roald Dahl, first published in 1988.",
    fr: "Matilda est un roman anglais pour enfants de Roald Dahl, auteur britannique d’origine norvégienne, publié pour la première fois en 1988.",
  },
  "ماتيلدا": {
    ar: "«ماتيلدا» رواية إنجليزية للأطفال كتبها المؤلف البريطاني من أصول نرويجية روالد دال، ونُشرت لأول مرة عام 1988. العنوان المعروض هو ترجمتها العربية.",
    en: "Matilda is an English children's novel by British author of Norwegian descent Roald Dahl, first published in 1988. The displayed title is the Arabic translation.",
    fr: "Matilda est un roman anglais pour enfants de Roald Dahl, auteur britannique d’origine norvégienne, publié pour la première fois en 1988. Le titre affiché est sa traduction arabe.",
  },
};

function getOriginalBookHistory(
  title: string,
  year: number | undefined,
  lang: Lang,
  aliases: string[],
): string {
  const detailed = BOOK_HISTORY_DETAILS[title]?.[lang];
  if (detailed) return detailed;

  const originalTitle = aliases.find((alias) => /[A-Za-zÀ-ÿ]/.test(alias));
  if (originalTitle && year) {
    if (lang === "en") return `Originally published as “${originalTitle}” in ${year}; the displayed title is an Arabic translation.`;
    if (lang === "fr") return `Publié pour la première fois sous le titre « ${originalTitle} » en ${year} ; le titre affiché est une traduction arabe.`;
    return `نُشر العمل لأول مرة بعنوان «${originalTitle}» عام ${year}، والعنوان المعروض هو ترجمته العربية.`;
  }

  if (year) {
    if (lang === "en") return `This book was first published in ${year}.`;
    if (lang === "fr") return `Ce livre a été publié pour la première fois en ${year}.`;
    return `نُشر هذا الكتاب لأول مرة عام ${year}.`;
  }

  if (lang === "en") return "The original publication date is still being verified and is not shown as a confirmed fact yet.";
  if (lang === "fr") return "La date de publication originale est encore en cours de vérification et n’est pas encore présentée comme un fait confirmé.";
  return "تاريخ النشر الأصلي لهذا الكتاب قيد التوثيق، لذلك لا يُعرض كحقيقة مؤكدة بعد.";
}

function bookLinks(title: string, author: string, aliases: string[] = []) {
  const searchTitle = [title, ...aliases].filter(Boolean).join(" ");
  const q  = encodeURIComponent(`${searchTitle} ${author}`);
  const qt = encodeURIComponent(searchTitle);
  const siteSearch = (domain: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${searchTitle} ${author}`)}`;
  return {
    libby:      `https://libbyapp.com/search?query=${qt}`,
    storytel:   `https://www.storytel.com/search?q=${q}`,
    audible:    `https://www.audible.com/search?keywords=${q}`,
    kindle:     `https://www.amazon.com/s?k=${q}&i=digital-text`,
    googleBooks: `https://books.google.com/books?q=${q}`,
    openLibrary:`https://openlibrary.org/search?q=${q}`,
    safahat:    siteSearch("safahat.org"),
    hindawi:    siteSearch("hindawi.org"),
    jarir:      siteSearch("jarir.com"),
    kobo:       `https://www.kobo.com/search?query=${q}`,
    goodreads:  `https://www.goodreads.com/search?q=${q}`,
    storygraph: `https://app.thestorygraph.com/browse?search_term=${q}`,
  };
}

function deriveSoundType(conditionGroup: string, tod: TimeOfDay): SoundType {
  if (conditionGroup === "Rain" || conditionGroup === "Drizzle" || conditionGroup === "Thunderstorm") return "rain";
  if (tod === "morning") return "birds";
  if (tod === "night" || tod === "evening") return "wind";
  return "birds";
}

const SEASON_ICONS: Record<Season, string> = {
  spring: "🌸", summer: "☀️", autumn: "🍂", winter: "❄️",
};

type ShowcaseConfig = {
  city: string;
  lang: Lang;
  bookLang: Lang;
  season: Season;
  timeOfDay: TimeOfDay;
  localTime: string;
  conditionGroup: string;
  condition: string;
  temperature: number;
};

const SHOWCASE_CONFIGS: Record<string, ShowcaseConfig> = {
  "spring-paris": { city: "باريس", lang: "fr", bookLang: "fr", season: "spring", timeOfDay: "morning", localTime: "09:15", conditionGroup: "Rain", condition: "Pluie légère", temperature: 13 },
  "summer-riyadh": { city: "الرياض", lang: "ar", bookLang: "ar", season: "summer", timeOfDay: "afternoon", localTime: "15:40", conditionGroup: "Clear", condition: "سماء صافية تماماً", temperature: 45 },
  "autumn-london": { city: "لندن", lang: "en", bookLang: "en", season: "autumn", timeOfDay: "evening", localTime: "18:25", conditionGroup: "Clouds", condition: "Overcast clouds", temperature: 14 },
  "winter-moscow": { city: "موسكو", lang: "en", bookLang: "en", season: "winter", timeOfDay: "night", localTime: "22:10", conditionGroup: "Snow", condition: "Light snow", temperature: -8 },
  "rain-jeddah": { city: "جدة", lang: "ar", bookLang: "ar", season: "summer", timeOfDay: "evening", localTime: "19:05", conditionGroup: "Rain", condition: "زخات مطرية", temperature: 29 },
  "cloudy-berlin": { city: "برلين", lang: "en", bookLang: "en", season: "autumn", timeOfDay: "afternoon", localTime: "14:30", conditionGroup: "Clouds", condition: "Overcast", temperature: 16 },
  "night-tokyo": { city: "طوكيو", lang: "en", bookLang: "en", season: "spring", timeOfDay: "night", localTime: "00:20", conditionGroup: "Clear", condition: "Clear sky", temperature: 18 },
  "morning-nairobi": { city: "نيروبي", lang: "en", bookLang: "en", season: "summer", timeOfDay: "morning", localTime: "07:45", conditionGroup: "Clear", condition: "Clear sky", temperature: 19 },
  "french-casablanca": { city: "الدار البيضاء", lang: "fr", bookLang: "fr", season: "autumn", timeOfDay: "afternoon", localTime: "16:00", conditionGroup: "Clouds", condition: "Nuageux", temperature: 23 },
  "english-new-york": { city: "نيويورك", lang: "en", bookLang: "en", season: "winter", timeOfDay: "morning", localTime: "08:50", conditionGroup: "Snow", condition: "Snow showers", temperature: -2 },
  "arabic-cairo": { city: "القاهرة", lang: "ar", bookLang: "ar", season: "spring", timeOfDay: "evening", localTime: "18:45", conditionGroup: "Clear", condition: "سماء صافية", temperature: 27 },
  "storm-doha": { city: "الدوحة", lang: "ar", bookLang: "en", season: "winter", timeOfDay: "night", localTime: "21:35", conditionGroup: "Thunderstorm", condition: "عاصفة رعدية", temperature: 20 },
};

const showcaseKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("showcase") : null;
const showcaseConfig = showcaseKey ? SHOWCASE_CONFIGS[showcaseKey] : undefined;
const SHOWCASE_RESULTS: Record<string, {
  mood: string;
  category: string;
  moodQuote: string;
  aiAnalysis: string;
  books: Array<{ title: string; author: string; subcategory: string; rating: string; reason: string; quote: string; atmosphere: string; length: string }>;
}> = {
  "spring-paris": {
    mood: "هادئ ومتأمل", category: "روايات رومانسية وعاطفية",
    moodQuote: "Un matin pluvieux de printemps appelle un livre qui laisse place à la rêverie, au rythme des gouttes.",
    aiAnalysis: "J'ai choisi des romans français chaleureux, entre romantisme et douceur, pour accompagner une lecture intime près de la fenêtre.",
    books: [
      { title: "Le Petit Prince", author: "Antoine de Saint-Exupéry", subcategory: "Classique", rating: "4.3", reason: "Un conte délicat et profond pour un matin paisible.", quote: "L'essentiel est invisible pour les yeux.", atmosphere: "philosophical", length: "Court" },
      { title: "Madame Bovary", author: "Gustave Flaubert", subcategory: "Romance", rating: "4.0", reason: "Une prose poétique et une atmosphère française parfaite sous la pluie.", quote: "Elle voulait mourir, mais elle voulait aussi vivre à Paris.", atmosphere: "romance", length: "Long" },
      { title: "À la recherche du temps perdu", author: "Marcel Proust", subcategory: "Réflexion", rating: "4.1", reason: "Une lecture lente, riche en mémoire et en émotions.", quote: "Le véritable voyage de découverte ne consiste pas à chercher de nouveaux paysages.", atmosphere: "philosophical", length: "Long" },
    ],
  },
  "summer-riyadh": {
    mood: "متحمس للقراءة", category: "روايات المغامرة والاستكشاف",
    moodQuote: "حين تشتد الشمس، افتح كتاباً يأخذك إلى عوالم بعيدة دون أن تغادر مكانك.",
    aiAnalysis: "هذه المجموعة مليئة بالحركة والخيال، وتمنحك مغامرة منعشة تناسب أجواء الصيف والنهار الطويل.",
    books: [
      { title: "حول العالم في 80 يوماً", author: "جول فيرن", subcategory: "مغامرة", rating: "4.2", reason: "رحلة سريعة وممتعة حول العالم.", quote: "كل ما هو مستحيل سيظل مستحيلاً حتى يتحقق.", atmosphere: "adventure", length: "طويل" },
      { title: "جزيرة الكنز", author: "روبرت لويس ستيفنسون", subcategory: "مغامرة", rating: "4.1", reason: "كنز وقراصنة وتشويق لقراءة صيفية مثالية.", quote: "السفر يفتح العقل كما تفتح الريح الشراع.", atmosphere: "adventure", length: "قصير" },
      { title: "مئة عام من العزلة", author: "غابرييل غارسيا ماركيز", subcategory: "خيال", rating: "4.4", reason: "عالم ساحر يليق بالهروب من حرارة اليوم.", quote: "لم يمت أحد ما دام هناك من يتذكره.", atmosphere: "adventure", length: "طويل" },
    ],
  },
  "autumn-london": {
    mood: "هادئ ومتأمل", category: "الروايات البوليسية",
    moodQuote: "Autumn leaves and cloudy skies are the perfect invitation to a mystery solved only on the final page.",
    aiAnalysis: "These autumn recommendations blend London's atmospheric mystery with clever characters for a compelling evening read.",
    books: [
      { title: "Murder on the Orient Express", author: "Agatha Christie", subcategory: "Mystery", rating: "4.3", reason: "A classic puzzle for a quiet, rainy evening.", quote: "The best time to solve a crime is when everyone is asleep.", atmosphere: "mystery", length: "Short" },
      { title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle", subcategory: "Detective", rating: "4.4", reason: "Devon fog and autumn atmosphere on every page.", quote: "The world is full of obvious things which nobody ever observes.", atmosphere: "mystery", length: "Short" },
      { title: "The Name of the Rose", author: "Umberto Eco", subcategory: "Historical", rating: "4.2", reason: "A richly layered investigation for detail lovers.", quote: "Books are not made to be believed, but to be subjected to inquiry.", atmosphere: "mystery", length: "Long" },
    ],
  },
  "winter-moscow": {
    mood: "حزين ويبحث عن إلهام", category: "الروايات التاريخية",
    moodQuote: "On a cold winter night, a great human story can offer the warmth you are looking for.",
    aiAnalysis: "I chose deep Russian literature about loneliness and hope — rewarding companions for a thoughtful read by warm light.",
    books: [
      { title: "Crime and Punishment", author: "Fyodor Dostoevsky", subcategory: "Classic", rating: "4.4", reason: "A profound psychological journey from guilt to redemption.", quote: "Pain and suffering are always inevitable for a large intelligence and a deep heart.", atmosphere: "philosophical", length: "Long" },
      { title: "Anna Karenina", author: "Leo Tolstoy", subcategory: "Romance", rating: "4.3", reason: "A sweeping human epic for a long winter night.", quote: "All happy families are alike; each unhappy family is unhappy in its own way.", atmosphere: "romance", length: "Long" },
      { title: "White Nights", author: "Fyodor Dostoevsky", subcategory: "Romance", rating: "4.2", reason: "A short, intimate story about loneliness and dreams.", quote: "My God, a whole moment of happiness! Is that really too little for the whole of a person's life?", atmosphere: "romance", length: "Short" },
    ],
  },
  "storm-doha": {
    mood: "مشتت الذهن ويريد التركيز", category: "تطوير الذات والنجاح",
    moodQuote: "Amid the thunder, give yourself just one focused chapter; small beginnings create calm.",
    aiAnalysis: "These practical, inspiring books help you organise your thoughts and regain focus, even on the most unsettled days.",
    books: [
      { title: "Atomic Habits", author: "James Clear", subcategory: "Self-Help", rating: "4.5", reason: "Small, practical steps for building a focused reading routine.", quote: "Every action is a vote for the type of person you wish to become.", atmosphere: "selfhelp", length: "Long" },
      { title: "Deep Work", author: "Cal Newport", subcategory: "Productivity", rating: "4.2", reason: "A clear guide to reclaiming attention in a distracted world.", quote: "The ability to concentrate without distraction is a rare and valuable skill.", atmosphere: "selfhelp", length: "Short" },
      { title: "The Subtle Art of Not Giving a F*ck", author: "Mark Manson", subcategory: "Self-Help", rating: "4.0", reason: "A direct perspective that quiets the noise and focuses on what matters.", quote: "The desire for a more positive experience is itself a negative experience.", atmosphere: "selfhelp", length: "Short" },
    ],
  },
};
const showcaseResult = showcaseKey ? SHOWCASE_RESULTS[showcaseKey] : undefined;

type AssistantMode = "custom" | "hidden_gem" | "trending" | "classic" | "excerpt";

type AssistantProps = {
  lang: Lang;
  isRtl: boolean;
  city: string;
  weather?: { temperature: number; condition: string };
  mood: string;
  category: string;
  bookLang: Lang;
  timeOfDay: TimeOfDay;
  season: Season;
  bookLength: "short" | "any" | "long";
  ageGroup: string;
  excludeBooks: string[];
  onApply: (books: AiBookPreviewBook[], summary: string) => void;
};

function AiBookAssistant({
  lang, isRtl, city, weather, mood, category, bookLang, timeOfDay, season,
  bookLength, ageGroup, excludeBooks, onApply,
}: AssistantProps) {
  const t = T[lang];
  const [mode, setMode] = useState<AssistantMode>("custom");
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<AiBookPreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searchRound, setSearchRound] = useState(1);
  const [shownTitles, setShownTitles] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isMountedRef = useRef(true);

  const previewMutation = useCreateAiBookPreview();
  const transcribeMutation = useTranscribeVoice();

  const modeOptions: Array<{
    id: AssistantMode;
    label: string;
    description: string;
    icon: typeof Sparkles;
  }> = [
    { id: "custom", label: t.aiAssistantCustom, description: t.aiAssistantCustomDesc, icon: WandSparkles },
    { id: "hidden_gem", label: t.aiAssistantHiddenGem, description: t.aiAssistantHiddenGemDesc, icon: Gem },
    { id: "trending", label: t.aiAssistantTrending, description: t.aiAssistantTrendingDesc, icon: TrendingUp },
    { id: "classic", label: t.aiAssistantClassic, description: t.aiAssistantClassicDesc, icon: History },
    { id: "excerpt", label: t.aiAssistantShort, description: t.aiAssistantShortDesc, icon: Timer },
  ];

  const modePrompts: Record<AssistantMode, string> = {
    custom: prompt,
    hidden_gem: t.aiAssistantHiddenGemDesc,
    trending: t.aiAssistantTrendingDesc,
    classic: t.aiAssistantClassicDesc,
    excerpt: t.aiAssistantShortDesc,
  };
  const requestForPreview = prompt.trim() || (mode === "custom" ? "" : modePrompts[mode]);

  const toggleSelection = (index: number) => {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  const finishRecording = () => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    recorderRef.current.stop();
    if (isMountedRef.current) setRecording(false);
    stopStream();
  };

  const startRecording = async () => {
    setRecordingError(false);
    setTranscriptionError(false);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const mimeType = preferredMimeTypes.find(type => MediaRecorder.isTypeSupported?.(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (!isMountedRef.current) return;
        if (!blob.size) {
          setTranscriptionError(true);
          return;
        }
        transcribeMutation.mutate({ data: blob }, {
          onSuccess: result => {
            if (!isMountedRef.current) return;
            setPrompt(current => current ? `${current.trim()} ${result.text}` : result.text);
            setSearchRound(1);
            setShownTitles([]);
            setTranscriptionError(false);
            trackEvent("ai_voice_transcribed", { language: lang });
          },
          onError: () => {
            if (isMountedRef.current) {
              setTranscriptionError(true);
              trackEvent("ai_voice_failed", { language: lang });
            }
          },
        });
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      stopStream();
      if (isMountedRef.current) setRecordingError(true);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      stopStream();
    };
  }, []);

  const submitPreview = (round = searchRound, additionalExcluded: string[] = []) => {
    const request = requestForPreview;
    if (request.length < 3 || !weather) return;
    setRecordingError(false);
    setTranscriptionError(false);
    setPreview(null);
    setSelected(new Set());
    const temporaryExclusions = [...new Set([...excludeBooks, ...shownTitles, ...additionalExcluded])];
    trackEvent("ai_book_preview_requested", {
      mode,
      language: lang,
      book_language: bookLang,
      search_round: round,
      has_weather: Boolean(weather),
    });
    previewMutation.mutate({
      data: {
        prompt: request,
        mode,
        searchRound: round,
        city,
        mood: mood || undefined,
        category: category || undefined,
        weatherCondition: weather.condition,
        temperature: weather.temperature,
        timeOfDay,
        cityBookLang: bookLang,
        language: lang,
        excludeBooks: temporaryExclusions.length ? temporaryExclusions : undefined,
        bookLength: bookLength !== "any" ? (bookLength === "short" ? "قصير" : "طويل") : undefined,
        ageGroup: ageGroup || undefined,
        season,
      },
    }, {
      onSuccess: result => {
        setPreview(result);
        setSelected(new Set(result.books.map((_, index) => index)));
        setShownTitles(current => [...new Set([...current, ...result.books.map(book => book.title)])]);
        trackEvent("ai_book_preview_succeeded", {
          mode,
          language: lang,
          book_language: bookLang,
          result_count: result.books.length,
        });
      },
      onError: () => trackEvent("ai_book_preview_failed", { mode, language: lang, book_language: bookLang }),
    });
  };

  const requestOtherOptions = () => {
    if (!preview) return;
    const nextRound = searchRound + 1;
    setSearchRound(nextRound);
    trackEvent("ai_other_options_requested", { mode, search_round: nextRound });
    submitPreview(nextRound, preview.books.map(book => book.title));
  };

  const allSelected = Boolean(preview?.books.length) && selected.size === preview?.books.length;
  const toggleAll = () => {
    if (!preview) return;
    setSelected(allSelected ? new Set() : new Set(preview.books.map((_, index) => index)));
  };

  const applySelected = () => {
    if (!preview || selected.size === 0) return;
    onApply(preview.books.filter((_, index) => selected.has(index)), preview.summary);
    trackEvent("ai_books_applied", { mode, language: lang, book_language: bookLang, selected_count: selected.size });
    setPreview(null);
    setSelected(new Set());
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.42 }}
      className="ai-assistant-panel backdrop-blur-md bg-amber-950/20 border border-amber-300/20 rounded-3xl p-5 md:p-7 space-y-5"
      aria-labelledby="ai-assistant-title"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-300 mb-2">
            <span className="ai-assistant-mark"><Sparkles className="w-4 h-4" /></span>
            <h2 id="ai-assistant-title" className="text-base font-semibold">{t.aiAssistantTitle}</h2>
          </div>
          <p className="text-sm text-white/60 leading-relaxed max-w-2xl">{t.aiAssistantIntro}</p>
        </div>
        <span className="hidden sm:inline-flex rounded-full border border-amber-300/20 bg-amber-300/8 px-3 py-1 text-[11px] text-amber-200/70">
          {LANGUAGES.find(item => item.id === bookLang)?.label}
        </span>
      </div>

      <div className="space-y-2">
        <label htmlFor="ai-book-request" className="text-xs font-semibold text-amber-200/80">{t.aiAssistantPromptLabel}</label>
        <div className="relative">
          <textarea
            id="ai-book-request"
            value={prompt}
            onChange={event => {
              setPrompt(event.target.value.slice(0, 1200));
              setSearchRound(1);
              setShownTitles([]);
            }}
            placeholder={t.aiAssistantPlaceholder}
            rows={3}
            maxLength={1200}
            className="w-full resize-none rounded-2xl border border-white/12 bg-black/25 px-4 py-3 pe-16 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-amber-300/50"
          />
          <button
            type="button"
            onClick={recording ? finishRecording : startRecording}
            disabled={transcribeMutation.isPending}
            className={`absolute bottom-3 ${isRtl ? "left-3" : "right-3"} flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
              recording
                ? "border-rose-300/60 bg-rose-400/20 text-rose-200"
                : "border-white/15 bg-white/8 text-white/65 hover:border-amber-300/40 hover:text-amber-200"
            } disabled:cursor-not-allowed disabled:opacity-50`}
            aria-label={recording ? t.aiAssistantStopRecording : t.aiAssistantStartRecording}
            title={recording ? t.aiAssistantStopRecording : t.aiAssistantStartRecording}
          >
            {recording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/35">
          <span aria-live="polite">
            {recording ? <span className="text-rose-200">{t.aiAssistantRecording}</span> : transcribeMutation.isPending ? t.aiAssistantTranscribing : ""}
          </span>
          <span>{prompt.length}/1200</span>
        </div>
        {recordingError && <p className="text-xs text-rose-200" role="alert">{t.aiAssistantVoiceError}</p>}
        {transcriptionError && <p className="text-xs text-rose-200" role="alert">{t.aiAssistantTranscriptionError}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-amber-200/80">{t.aiAssistantModes}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {modeOptions.map(option => {
            const Icon = option.icon;
            const isActive = mode === option.id;
            return (
              <button
                type="button"
                key={option.id}
                onClick={() => {
                  setMode(option.id);
                  setSearchRound(1);
                  setShownTitles([]);
                  setPreview(null);
                  setSelected(new Set());
                  trackEvent("ai_mode_selected", { mode: option.id });
                }}
                className={`text-start rounded-2xl border px-3 py-3 transition-all ${
                  isActive
                    ? "border-amber-300/55 bg-amber-300/12 text-amber-100"
                    : "border-white/10 bg-black/15 text-white/65 hover:border-white/25 hover:bg-white/6"
                }`}
                aria-pressed={isActive}
              >
                <Icon className={`w-4 h-4 mb-2 ${isActive ? "text-amber-300" : "text-white/40"}`} />
                <span className="block text-xs font-semibold">{option.label}</span>
                <span className="mt-1 block text-[10px] leading-snug text-white/40">{option.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-white/35">{t.aiAssistantContext}</span>
        {[city, weather ? `${Math.round(weather.temperature)}°` : null, timeOfDay, season, bookLang].filter(Boolean).map(value => (
          <span key={value} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/55">{value}</span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => submitPreview()}
        disabled={!weather || requestForPreview.length < 3 || previewMutation.isPending || recording || transcribeMutation.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {previewMutation.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" />{t.aiAssistantLoading}</> : <><Sparkles className="w-4 h-4" />{t.aiAssistantPreview}</>}
      </button>

      {previewMutation.isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300/25 bg-rose-400/8 p-4 text-sm text-rose-100" role="alert">
          <span>{t.aiAssistantError}</span>
          <button type="button" onClick={() => submitPreview()} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200/25 px-3 py-2 text-xs hover:bg-rose-200/10">
            <RefreshCw className="w-3 h-3" />{t.aiAssistantRetry}
          </button>
        </div>
      )}

      {previewMutation.isPending && (
        <div className="space-y-3 rounded-2xl border border-white/8 bg-black/15 p-4" aria-label={t.aiAssistantLoading}>
          <div className="h-3 w-1/3 rounded-full bg-white/10 animate-pulse" />
          <div className="h-16 rounded-2xl bg-white/6 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[0, 1, 2].map(item => <div key={item} className="h-28 rounded-2xl bg-white/6 animate-pulse" />)}
          </div>
        </div>
      )}

      {preview && !previewMutation.isPending && (
        <div className="ai-assistant-preview space-y-4 rounded-2xl border border-amber-300/20 bg-slate-950/35 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-amber-100">{t.aiAssistantPreviewTitle}</h3>
              <p className="mt-1 text-xs text-white/40">{t.aiAssistantInterpreted}: <span className="text-white/65">{preview.interpretedRequest}</span></p>
            </div>
            <span className="rounded-full bg-amber-300/12 px-2.5 py-1 text-xs text-amber-200">
              {t.aiAssistantSelected.replace("{n}", String(selected.size))}
            </span>
          </div>
          <p className="rounded-xl border border-white/8 bg-white/5 p-3 text-sm leading-relaxed text-white/70">{preview.summary}</p>
          {preview.books.length === 0 ? (
            <div className="rounded-xl border border-white/8 p-5 text-center text-sm text-white/55">{t.aiAssistantEmpty}</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={toggleAll} aria-pressed={allSelected} aria-label={allSelected ? t.aiAssistantClearAll : t.aiAssistantSelectAll} className="inline-flex items-center gap-2 text-xs text-amber-200 hover:text-amber-100">
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${allSelected ? "border-amber-300 bg-amber-300 text-slate-950" : "border-white/25"}`}>
                    {allSelected && <Check className="w-3 h-3" />}
                  </span>
                  {allSelected ? t.aiAssistantClearAll : t.aiAssistantSelectAll}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {preview.books.map((book, index) => {
                  const isSelected = selected.has(index);
                  return (
                    <button
                      type="button"
                      key={`${book.title}-${index}`}
                      onClick={() => toggleSelection(index)}
                      className={`text-start rounded-2xl border p-4 transition-all ${isSelected ? "border-amber-300/50 bg-amber-300/8" : "border-white/10 bg-black/15 opacity-65"}`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold leading-snug text-amber-200">{book.title}</h4>
                          <p className="mt-1 text-xs text-white/45">{book.author}</p>
                        </div>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${isSelected ? "border-amber-300 bg-amber-300 text-slate-950" : "border-white/20"}`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-white/60">{book.reason}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/45">{book.subcategory}</span>
                        {book.publishedYear && (
                          <span className="rounded-md border border-sky-300/15 bg-sky-300/8 px-2 py-1 text-[10px] text-sky-200/70">
                            {t.aiAssistantPublished}: {book.publishedYear}{book.publishedMonth ? `/${String(book.publishedMonth).padStart(2, "0")}` : ""}
                          </span>
                        )}
                        <span className="rounded-md border border-amber-300/15 bg-amber-300/8 px-2 py-1 text-[10px] text-amber-200/70">{book.fitScore}% fit</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
                <button type="button" onClick={requestOtherOptions} disabled={previewMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/25 px-4 py-2.5 text-xs text-amber-200 hover:bg-amber-200/10 disabled:cursor-not-allowed disabled:opacity-50">
                  <RefreshCw className="w-3.5 h-3.5" />{t.aiAssistantOtherOptions}
                </button>
                <button type="button" onClick={() => {
                  trackEvent("ai_preview_cancelled", { mode });
                  setPreview(null);
                  setSelected(new Set());
                }} className="rounded-xl border border-white/12 px-4 py-2.5 text-xs text-white/55 hover:bg-white/8 hover:text-white/80">
                  {t.aiAssistantCancel}
                </button>
                <button type="button" onClick={applySelected} disabled={selected.size === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40">
                  <Check className="w-3.5 h-3.5" />{t.aiAssistantApply}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </motion.section>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Home() {
  const showcaseCity = showcaseConfig && CITIES.find(c => c.name === showcaseConfig.city);
  const [lang, setLang]                         = useState<Lang>(showcaseConfig?.lang ?? "ar");
  const [selectedCity, setSelectedCity]         = useState(showcaseCity ?? CITIES[0]);
  const [selectedMoodIdx, setSelectedMoodIdx]   = useState<number | null>(showcaseConfig ? 0 : null);
  const [selectedCatIdx, setSelectedCatIdx]     = useState<number | null>(showcaseConfig ? 0 : null);
  const [readingStyle, setReadingStyle]         = useState<ReadingStyle | "">("");
  const [bookLength, setBookLength]             = useState<"short" | "any" | "long">("any");
  const [ageGroup, setAgeGroup]                 = useState<RecommendationInputAgeGroup>("adult");
  const [occasion, setOccasion]                 = useState<OccasionId>(showcaseConfig ? "none" : detectOccasion);
  const [showOccasionPicker, setShowOccasionPicker] = useState(false);
  const [season]                                = useState<Season>(showcaseConfig?.season ?? detectSeason);
  const [showResults, setShowResults]           = useState(Boolean(showcaseResult));
  const [readBooks, setReadBooks]               = useState<string[]>([]);
  const [preferredGenres, setPreferredGenres]   = useState<string[]>([]);
  const [userImageUrl, setUserImageUrl]         = useState<string | null>(null);
  const [timeOfDay, setTimeOfDay]               = useState<TimeOfDay>(() => showcaseConfig?.timeOfDay ?? getCityTimeOfDay(selectedCity!.tz));
  const [cityLocalTime, setCityLocalTime]       = useState(() => showcaseConfig?.localTime ?? getCityLocalTime(selectedCity!.tz));
  const [bookAtmosphere, setBookAtmosphere]     = useState<BookAtmosphere>(null);
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<number>>(new Set());
  const [showLangPicker, setShowLangPicker]     = useState(false);
  const [bookLang, setBookLang]                 = useState<Lang>(() => showcaseConfig?.bookLang ?? getCityBookLang(CITIES[0].name));
  const [bookFeedback, setBookFeedback]         = useState<BookFeedbackMap>(loadBookFeedback);
  const [seenBookTitles, setSeenBookTitles]     = useState<string[]>(loadSeenBookTitles);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = T[lang];
  const resultT = T[bookLang];
  const isRtl = lang === "ar";

  useEffect(() => {
    try {
      window.localStorage.setItem(BOOK_FEEDBACK_STORAGE_KEY, JSON.stringify(bookFeedback));
    } catch {
      // Feedback still works for the current session when browser storage is unavailable.
    }
  }, [bookFeedback]);

  useEffect(() => {
    try {
      window.localStorage.setItem(BOOK_SEEN_STORAGE_KEY, JSON.stringify(seenBookTitles));
    } catch {
      // The current session still keeps the seen-book list when storage is unavailable.
    }
  }, [seenBookTitles]);

  // Auto-reset book language when city changes
  useEffect(() => {
    if (!showcaseConfig) setBookLang(getCityBookLang(selectedCity!.name));
  }, [selectedCity]);

  const BOOK_LANG_OPTIONS: { id: Lang; label: string; shortLabel: string; color: string; activeColor: string }[] = [
    { id: "ar", label: "📚 كتب عربية",      shortLabel: "عربي",    color: "text-white/50 border-white/10 bg-white/5",   activeColor: "text-amber-300 bg-amber-400/15 border-amber-400/40" },
    { id: "en", label: "📚 English Books",   shortLabel: "English", color: "text-white/50 border-white/10 bg-white/5",   activeColor: "text-sky-300 bg-sky-400/15 border-sky-400/40" },
    { id: "fr", label: "📚 Livres français", shortLabel: "Français",color: "text-white/50 border-white/10 bg-white/5",   activeColor: "text-violet-300 bg-violet-400/15 border-violet-400/40" },
  ];
  const activeBookLangOpt = BOOK_LANG_OPTIONS.find(o => o.id === bookLang)!;

  // Always send Arabic mood/category to the API regardless of UI language
  const selectedMood     = selectedMoodIdx !== null ? MOODS.ar[selectedMoodIdx]    : "";
  const selectedCategory = selectedCatIdx  !== null ? CATEGORIES.ar[selectedCatIdx] : "";

  const bookLengthMap: Record<"short" | "any" | "long", string> = {
    short: "قصير", any: "أي طول", long: "طويل",
  };

  const { data: liveWeather, isLoading: liveWeatherLoading, isError: liveWeatherError, refetch: refetchWeather } = useGetWeather(
    { city: selectedCity!.name, lat: selectedCity!.lat, lng: selectedCity!.lng },
    { query: { enabled: true, queryKey: getGetWeatherQueryKey({ city: selectedCity!.name, lat: selectedCity!.lat, lng: selectedCity!.lng }) } }
  );
  const weather = showcaseConfig
    ? { temperature: showcaseConfig.temperature, condition: showcaseConfig.condition, conditionGroup: showcaseConfig.conditionGroup }
    : liveWeather;
  const weatherLoading = showcaseConfig ? false : liveWeatherLoading;
  const weatherError = showcaseConfig ? false : liveWeatherError;

  const createRec = useCreateRecommendation();
  const recommendation = showcaseResult && showcaseConfig
    ? {
        id: 0,
        city: selectedCity.name,
        mood: selectedMood,
        category: selectedCategory,
        weatherCondition: showcaseConfig.condition,
        temperature: showcaseConfig.temperature,
        books: showcaseResult.books,
        moodQuote: showcaseResult.moodQuote,
        aiAnalysis: showcaseResult.aiAnalysis,
        createdAt: "2026-08-26T00:00:00.000Z",
      }
    : createRec.data;

  const displayRecommendation = recommendation
    ? recommendation
    : null;

  useEffect(() => {
    if (createRec.data?.books?.[0]) {
      const first = createRec.data.books[0] as { atmosphere?: string };
      if (first.atmosphere) setBookAtmosphere(first.atmosphere as BookAtmosphere);
    }
    if (createRec.data?.books?.length) {
      const newTitles = createRec.data.books.map((book) => book.title);
      setSeenBookTitles((current) => {
        const next = [...new Set([...current, ...newTitles])].slice(-1500);
        return next.length === current.length && next.every((title, index) => title === current[index])
          ? current
          : next;
      });
    }
  }, [createRec.data]);

  // Change document direction on lang change
  useEffect(() => {
    document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
  }, [isRtl, lang]);

  // Update timeOfDay + local clock whenever city changes, refresh every minute
  useEffect(() => {
    const update = () => {
      setTimeOfDay(showcaseConfig?.timeOfDay ?? getCityTimeOfDay(selectedCity!.tz));
      setCityLocalTime(showcaseConfig?.localTime ?? getCityLocalTime(selectedCity!.tz));
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [selectedCity]);

  const handleReadBooksChange = useCallback((titles: string[]) => setReadBooks(titles), []);
  const handleGenreProfileChange = useCallback((genres: string[]) => setPreferredGenres(genres), []);

  const handleCityChange = (cityName: string) => {
    const nextCity = CITIES.find(city => city.name === cityName);
    if (!nextCity || nextCity.name === selectedCity.name) return;
    setSelectedCity(nextCity);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) setUserImageUrl(ev.target.result as string); };
    reader.readAsDataURL(file); e.target.value = "";
  };

  const handleGenerate = () => {
    if (!weather || !selectedMood || !selectedCategory) return;
    const likedBooks = Object.entries(bookFeedback)
      .filter(([, feedback]) => feedback === "liked")
      .map(([title]) => title)
      .slice(-100);
    const dislikedBooks = Object.entries(bookFeedback)
      .filter(([, feedback]) => feedback === "disliked")
      .map(([title]) => title)
      .slice(-100);
    const excludedTitles = [...new Set([
      ...readBooks,
      ...seenBookTitles,
      ...likedBooks,
      ...dislikedBooks,
    ])].slice(-1800);
    setShowResults(true); setBookAtmosphere(null);
    trackEvent("recommendation_requested", {
      book_language: bookLang,
      book_length: bookLength,
      has_goodreads: readBooks.length > 0,
      has_feedback: Object.keys(bookFeedback).length > 0,
      has_occasion: occasion !== "none",
    });
    createRec.mutate({ data: {
      city: selectedCity!.name, mood: selectedMood, category: selectedCategory,
      weatherCondition: weather.condition, temperature: weather.temperature,
       excludeBooks: excludedTitles.length > 0 ? excludedTitles : undefined,
      likedBooks: likedBooks.length > 0 ? likedBooks : undefined,
      dislikedBooks: dislikedBooks.length > 0 ? dislikedBooks : undefined,
      bookLength: bookLength !== "any" ? bookLengthMap[bookLength] : undefined,
      timeOfDay, cityName: selectedCity!.name,
       // Keep recommendation content in the selected book language. The UI
       // language remains independent and only controls interface labels.
       language: bookLang,
      ageGroup: ageGroup || undefined,
      occasion: occasion !== "none" ? occasion : undefined,
      season,
       cityBookLang: bookLang,
       readingStyle: readingStyle || undefined,
      preferredGenres: preferredGenres.length > 0 ? preferredGenres : undefined,
     }}, {
       onSuccess: result => trackEvent("recommendation_succeeded", {
         result_count: result.books.length,
         book_language: bookLang,
         has_goodreads: readBooks.length > 0,
       }),
       onError: () => trackEvent("recommendation_failed", { book_language: bookLang }),
     });
  };

  const handleBookFeedback = (title: string, feedback: BookFeedback) => {
    setBookFeedback(current => {
      if (current[title] === feedback) {
        const next = { ...current };
        delete next[title];
        return next;
      }
      return { ...current, [title]: feedback };
    });
    trackEvent("book_feedback", { sentiment: feedback });
  };

  const conditionGroup = weather?.conditionGroup ?? "Clear";
  const goodreadsUrl = (title: string, author: string) =>
    bookLinks(title, author, ARABIC_TITLE_ALIASES[title] ?? []).goodreads;

  const greetings: Record<TimeOfDay, string> = {
    morning: t.morning, afternoon: t.afternoon, evening: t.evening, night: t.night,
  };

  const lengthOptions: { key: "short" | "any" | "long"; label: string }[] = [
    { key: "short", label: t.short },
    { key: "any",   label: t.anyLength },
    { key: "long",  label: t.long },
  ];

  const autoDetectedOccasion = occasion !== "none";
  const occasionLabel = OCCASIONS[lang].find(o => o.id === occasion)?.label ?? "";

  return (
    <>
      <WeatherBackground conditionGroup={conditionGroup} category={selectedCategory} userImageUrl={userImageUrl} timeOfDay={timeOfDay} bookAtmosphere={bookAtmosphere} />
      <AmbientSound soundType={deriveSoundType(conditionGroup, timeOfDay)} />
      <ReadingTimer />

      {/* Image upload — top left */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        {userImageUrl ? (
          <motion.button initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            onClick={() => setUserImageUrl(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/50 border border-white/20 text-white/80 text-xs hover:bg-red-900/50 hover:text-red-300 transition-all backdrop-blur-md">
            <X className="w-3.5 h-3.5" /> {t.removeImage}
          </motion.button>
        ) : (
          <motion.button initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 border border-white/15 text-white/70 text-xs hover:bg-white/10 hover:text-white hover:border-white/30 transition-all backdrop-blur-md">
            <Camera className="w-3.5 h-3.5" /> {t.customBg}
          </motion.button>
        )}
      </div>

      <div className={`relative z-10 w-full min-h-screen px-4 py-12 md:px-8 max-w-4xl mx-auto flex flex-col gap-7 ${isRtl ? "" : "font-sans"}`}>

        {/* ── Header ── */}
        <header className="text-center space-y-2 pt-8">
          <motion.div initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
            {/* Language + Season row */}
            <div className="flex items-center justify-center gap-3 mb-3">
              {/* Season badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 border border-white/12 text-white/60 text-xs backdrop-blur-sm">
                <span>{t[`season${season.charAt(0).toUpperCase() + season.slice(1)}` as keyof typeof t]}</span>
              </div>

              {/* Language picker */}
              <div className="relative">
                <button onClick={() => setShowLangPicker(p => !p)}
                  type="button"
                  aria-label="Change language"
                  aria-expanded={showLangPicker}
                  aria-controls="language-picker"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 border border-white/12 text-white/60 text-xs hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm">
                  <Globe className="w-3 h-3" />
                  <span>{LANGUAGES.find(l => l.id === lang)?.flag}</span>
                  <span>{LANGUAGES.find(l => l.id === lang)?.label}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showLangPicker ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {showLangPicker && (
                    <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      id="language-picker"
                      className="absolute top-9 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-xl border border-white/12 rounded-xl overflow-hidden shadow-xl min-w-[140px]">
                      {LANGUAGES.map(l => (
                        <button key={l.id} type="button" onClick={() => {
                          trackEvent("interface_language_changed", { language: l.id });
                          setLang(l.id);
                          setShowLangPicker(false);
                          setSelectedMoodIdx(null);
                          setSelectedCatIdx(null);
                        }}
                          aria-pressed={lang === l.id}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-white/10 ${lang === l.id ? "bg-amber-400/15 text-amber-300" : "text-white/70"}`}>
                          <span>{l.flag}</span><span>{l.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="text-xs text-amber-300/60 mb-2 tracking-widest">{greetings[timeOfDay]}</div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500">
              ReMood
            </h1>
            <p className="text-white/65 mt-2 text-base md:text-lg font-light">{t.subtitle}</p>
          </motion.div>
        </header>

        {/* ── Wisdom Quote ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="backdrop-blur-md bg-black/25 border border-white/8 rounded-2xl px-4 pt-4 pb-7"
        >
          <WisdomQuote lang={lang} isRtl={isRtl} />
        </motion.div>

        {/* ── Occasion Banner ── */}
        <AnimatePresence>
          {autoDetectedOccasion && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="backdrop-blur-md bg-amber-400/10 border border-amber-400/25 p-4 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <div>
                  <div className="text-xs text-amber-400/70">{t.autoOccasion}</div>
                  <div className="text-sm font-semibold text-amber-200">{occasionLabel}</div>
                </div>
              </div>
              <button onClick={() => setShowOccasionPicker(p => !p)}
                type="button"
                aria-expanded={showOccasionPicker}
                aria-controls="occasion-picker"
                className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2">
                {showOccasionPicker ? "▲" : t.occasion + " ▼"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Occasion picker */}
        <AnimatePresence>
          {showOccasionPicker && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              id="occasion-picker"
              className="backdrop-blur-md bg-white/6 border border-white/10 p-4 rounded-2xl">
              <div className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" />{t.occasion}</div>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS[lang].map(o => (
                  <button key={o.id} type="button" onClick={() => { setOccasion(o.id as OccasionId); setShowOccasionPicker(false); }}
                    aria-pressed={occasion === o.id}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all whitespace-nowrap ${
                      occasion === o.id
                        ? "bg-amber-400 text-slate-900 border-amber-400"
                        : "bg-black/20 border-white/10 text-white/70 hover:bg-white/10"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Place + weather in one calm card ── */}
        <motion.section
          className="backdrop-blur-md bg-white/8 border border-white/12 rounded-2xl p-5 md:p-6 overflow-hidden"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          aria-labelledby="place-weather-title"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
            <div>
              <h2 id="place-weather-title" className="text-sm font-semibold flex items-center gap-2 text-amber-300">
                <MapPin className="w-4 h-4" />{t.weatherLibraryTitle}
              </h2>
              <p className="text-xs text-white/40 mt-1">{t.weatherLibrarySubtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="city-weather-selector" className="text-xs text-white/55">{t.whereAreYou}</label>
                <select
                  id="city-weather-selector"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none outline-none focus:border-amber-400/50 transition-colors text-sm"
                  value={selectedCity.name}
                  onChange={(e) => handleCityChange(e.target.value)}
                >
                  {CITIES.map(c => (
                    <option key={c.name} value={c.name} className="bg-slate-900 text-white">
                      {getCityFlag(c.name)} {getCityDisplayName(c.name, lang)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-mono font-semibold bg-indigo-500/10 border-indigo-400/25 text-indigo-300">
                  <Clock className="w-3 h-3" />{cityLocalTime}
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs border font-medium ${
                  timeOfDay === "morning" ? "bg-orange-400/10 border-orange-400/25 text-orange-300" :
                  timeOfDay === "afternoon" ? "bg-yellow-400/10 border-yellow-400/25 text-yellow-300" :
                  timeOfDay === "evening" ? "bg-purple-400/10 border-purple-400/25 text-purple-300" :
                  "bg-slate-500/10 border-slate-400/25 text-slate-300"
                }`}>
                  {timeOfDay === "morning" ? (lang === "ar" ? "🌅 صباح" : lang === "fr" ? "🌅 Matin" : "🌅 Morning") :
                   timeOfDay === "afternoon" ? (lang === "ar" ? "☀️ نهار" : lang === "fr" ? "☀️ Après-midi" : "☀️ Afternoon") :
                   timeOfDay === "evening" ? (lang === "ar" ? "🌆 مساء" : lang === "fr" ? "🌆 Soir" : "🌆 Evening") :
                   (lang === "ar" ? "🌙 ليل" : lang === "fr" ? "🌙 Nuit" : "🌙 Night")}
                </div>
                {weatherLoading && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-amber-400/25 bg-amber-400/10 text-amber-200" role="status" aria-live="polite">
                    <RefreshCw className="w-3 h-3 animate-spin" />{t.weatherLoading}
                  </div>
                )}
                {weatherError && (
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs border border-rose-400/30 bg-rose-400/10 text-rose-100" role="alert">
                    <span>{t.weatherError}</span>
                    <button type="button" onClick={() => refetchWeather()} className="inline-flex items-center gap-1 text-rose-100 underline underline-offset-2 hover:text-white" aria-label={t.weatherRetry}>
                      <RefreshCw className="w-3 h-3" />{t.weatherRetry}
                    </button>
                  </div>
                )}
                {weather && !weatherLoading && !weatherError && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-white/10 bg-white/5 text-white/65">
                    {conditionGroup === "Rain" || conditionGroup === "Drizzle" ? <Droplets className="w-3.5 h-3.5 text-sky-300" /> :
                     conditionGroup === "Clear" ? <Thermometer className="w-3.5 h-3.5 text-amber-300" /> :
                     <Wind className="w-3.5 h-3.5 text-slate-300" />}
                    {Math.round(weather.temperature)}°C
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs text-white/40">{t.bookLangLabel}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {BOOK_LANG_OPTIONS.map(opt => (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        trackEvent("book_language_selected", { book_language: opt.id });
                        setBookLang(opt.id);
                      }}
                      aria-pressed={bookLang === opt.id}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-medium transition-colors ${bookLang === opt.id ? opt.activeColor : opt.color}`}
                    >
                      {opt.shortLabel}
                    </motion.button>
                  ))}
                </div>
                <motion.p key={bookLang} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`text-xs font-medium ${activeBookLangOpt.activeColor.split(" ")[0]}`}>
                  {activeBookLangOpt.label}
                </motion.p>
              </div>
            </div>

          </div>
        </motion.section>

        {/* ── Goodreads ── */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <GoodreadsConnect
            onReadBooksChange={handleReadBooksChange}
            onGenreProfileChange={handleGenreProfileChange}
            lang={lang}
          />
        </motion.div>

        {/* ── Age Group ── */}
        <motion.div className="backdrop-blur-md bg-white/8 border border-white/12 p-5 rounded-2xl flex flex-col gap-3"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33 }}>
          <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-300"><Users className="w-4 h-4" />{t.ageGroup}</h2>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS[lang].map(ag => (
              <button key={ag.id} type="button" onClick={() => setAgeGroup(ag.id as RecommendationInputAgeGroup)}
                aria-pressed={ageGroup === ag.id}
                className={`text-sm px-3 py-1.5 rounded-full transition-all duration-200 border whitespace-nowrap ${
                  ageGroup === ag.id
                    ? "bg-amber-400 text-slate-900 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.3)]"
                    : "bg-black/20 border-white/10 text-white/75 hover:bg-white/10 hover:border-white/20"}`}>
                {ag.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Mood & Category side by side ── */}
        <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
          {/* Mood */}
          <div className="backdrop-blur-md bg-white/8 border border-white/12 p-5 rounded-2xl flex flex-col gap-3">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-300"><Compass className="w-4 h-4" />{t.howFeel}</h2>
            <div className="overflow-y-auto flex flex-wrap gap-2 max-h-52 pr-1"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(251,191,36,0.25) transparent" }}>
              {MOODS[lang].map((mood, idx) => (
                <button key={idx} type="button" onClick={() => setSelectedMoodIdx(idx)}
                  aria-pressed={selectedMoodIdx === idx}
                  className={`text-sm px-3 py-1.5 rounded-full transition-all duration-200 border whitespace-nowrap ${
                    selectedMoodIdx === idx
                      ? "bg-amber-400 text-slate-900 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.3)]"
                      : "bg-black/20 border-white/10 text-white/75 hover:bg-white/10 hover:border-white/20"}`}>
                  {mood}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="backdrop-blur-md bg-white/8 border border-white/12 p-5 rounded-2xl flex flex-col gap-3">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-300"><BookOpen className="w-4 h-4" />{t.whatRead}</h2>
            <div className="overflow-y-auto flex flex-col gap-2 max-h-64 pl-1"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(251,191,36,0.25) transparent" }}>

              <div className="flex flex-col gap-2">
                <span className="text-xs text-white/45">{t.readingStyle}</span>
                <div className="grid grid-cols-2 gap-2">
                  {READING_STYLES[lang].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setReadingStyle((current) => current === style.id ? "" : style.id)}
                      aria-pressed={readingStyle === style.id}
                      title={style.description}
                      className={`text-xs px-2.5 py-2 rounded-xl transition-all duration-200 border text-start leading-snug ${
                        readingStyle === style.id
                          ? "bg-amber-400 text-slate-900 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.25)]"
                          : "bg-amber-400/8 border-amber-300/15 text-amber-100/80 hover:bg-amber-400/15 hover:border-amber-300/30"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Adult categories grid */}
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES[lang].slice(0, CHILDREN_SECTION_START).map((cat, idx) => (
                  <button key={idx} type="button" onClick={() => setSelectedCatIdx(idx)}
                    aria-pressed={selectedCatIdx === idx}
                    className={`text-sm px-2.5 py-2 rounded-xl transition-all duration-200 border text-right leading-snug ${
                      selectedCatIdx === idx
                        ? "bg-amber-400 text-slate-900 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.25)]"
                        : "bg-black/20 border-white/10 text-white/75 hover:bg-white/10 hover:border-white/20"}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Children's section divider */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-400/40 to-transparent" />
                <span className="text-[11px] font-semibold tracking-widest px-2 py-0.5 rounded-full bg-pink-400/12 border border-pink-400/25 text-pink-300/80">
                  {lang === "ar" ? "🧒 قسم الأطفال" : lang === "fr" ? "🧒 Section Enfants" : "🧒 Children's"}
                </span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent via-pink-400/40 to-transparent" />
              </div>

              {/* Children's categories grid */}
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES[lang].slice(CHILDREN_SECTION_START).map((cat, i) => {
                  const idx = CHILDREN_SECTION_START + i;
                  return (
                    <button key={idx} type="button" onClick={() => setSelectedCatIdx(idx)}
                      aria-pressed={selectedCatIdx === idx}
                      className={`text-xs px-2 py-2.5 rounded-xl transition-all duration-200 border text-center leading-snug ${
                        selectedCatIdx === idx
                          ? "bg-gradient-to-br from-pink-400 to-purple-500 text-white border-pink-400 shadow-[0_0_14px_rgba(236,72,153,0.35)]"
                          : "bg-pink-400/8 border-pink-400/18 text-pink-200/75 hover:bg-pink-400/15 hover:border-pink-400/30 hover:text-pink-100"}`}>
                      {cat}
                    </button>
                  );
                })}
              </div>

            </div>
          </div>
        </motion.div>

        {/* ── Book Length ── */}
        <motion.div className="backdrop-blur-md bg-white/8 border border-white/12 p-5 rounded-2xl flex flex-col gap-3"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.40 }}>
          <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-300"><BookMarked className="w-4 h-4" />{t.pageCount}</h2>
          <div className="flex gap-3">
            {lengthOptions.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setBookLength(key)}
                aria-pressed={bookLength === key}
                className={`flex-1 py-3 px-2 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 border text-center ${
                  bookLength === key
                    ? "bg-amber-400 text-slate-900 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.22)]"
                    : "bg-black/20 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"}`}>
                {label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Generate recommendation ── */}
        <motion.div className="backdrop-blur-md bg-amber-950/20 border border-amber-300/20 p-5 rounded-2xl flex flex-col gap-3"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.40 }}>
          <button onClick={handleGenerate}
            disabled={!selectedMood || !selectedCategory || !weather || createRec.isPending}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-bold text-sm px-5 py-3 rounded-xl shadow-[0_0_24px_rgba(251,191,36,0.18)] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:brightness-105 active:scale-[0.99]">
            {createRec.isPending
              ? <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />{t.generating}</>
              : <><Sparkles className="w-4 h-4" />{t.generate}</>}
          </button>
          {readBooks.length > 0 && (
            <p className="text-xs text-emerald-400/75">{t.excludeNote.replace("{n}", String(readBooks.length))}</p>
          )}
        </motion.div>

        {/* ── Error ── */}
        <AnimatePresence>
          {showResults && createRec.isError && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="backdrop-blur-md bg-red-900/30 border border-red-400/30 p-6 rounded-2xl text-center text-red-300">
              <p className="text-lg font-semibold mb-1">
                {lang === "ar" ? "حدث خطأ" : lang === "fr" ? "Une erreur s'est produite" : "An error occurred"}
              </p>
              <button onClick={handleGenerate} className="mt-3 px-6 py-2 rounded-full bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30 transition-colors text-sm">
                {lang === "ar" ? "حاول مجدداً" : lang === "fr" ? "Réessayer" : "Try again"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results ── */}
        <AnimatePresence>
          {showResults && displayRecommendation && (
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="mt-2 space-y-6 pb-16">
              {/* Quote */}
              <div className="backdrop-blur-md bg-white/8 border border-amber-400/18 p-7 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-56 h-56 bg-amber-400/5 rounded-full blur-[50px] -z-10" />
                <Quote className="text-amber-400/35 w-9 h-9 mb-4" />
                <p className="text-xl md:text-2xl leading-relaxed text-amber-50 italic font-light">{displayRecommendation.moodQuote}</p>
                <div className="mt-5 pt-5 border-t border-white/8">
                  <p className="text-white/65 leading-relaxed text-sm">{displayRecommendation.aiAnalysis}</p>
                </div>
              </div>

              {/* Book Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {displayRecommendation.books.map((book, idx) => {
                   const extBook = book as typeof book & {
                     atmosphere?: string;
                     length?: string;
                     publishedYear?: number;
                     publishedMonth?: number;
                     contentWarnings?: string[];
                     suitableAgeGroups?: string[];
                     sourceReferences?: string[];
                   };
                   const titleAliases = ARABIC_TITLE_ALIASES[book.title] ?? [];
                  const atmosLabel = extBook.atmosphere ? (ATMOS_LABELS[extBook.atmosphere]?.[bookLang] ?? null) : null;
                  const moodWarning = getMoodWarning(selectedMood, extBook.atmosphere, selectedCategory, lang);
                  const publishedYear = extBook.publishedYear ?? PUBLICATION_YEARS[book.title];
                   const links = bookLinks(book.title, book.author, titleAliases);
                   const feedback = bookFeedback[book.title];
                   const religiousContentNotes = (extBook.contentWarnings ?? [])
                     .filter((warning) => warning === "religious_themes")
                     .map((warning) => CONTENT_WARNING_LABELS[warning]?.[lang])
                     .filter((warning): warning is string => Boolean(warning));
                   const contentWarnings = (extBook.contentWarnings ?? [])
                     .filter((warning) => warning !== "religious_themes")
                     .map((warning) => CONTENT_WARNING_LABELS[warning]?.[lang])
                     .filter((warning): warning is string => Boolean(warning));
                   const suitableAges = (extBook.suitableAgeGroups ?? [])
                     .map((group) => AGE_GROUPS[lang].find((item) => item.id === group)?.label)
                     .filter((label): label is string => Boolean(label));
                  const isForAllAges = ["children", "teen", "adult"]
                     .every((group) => extBook.suitableAgeGroups?.includes(group));
                   const originalBookHistory = getOriginalBookHistory(
                     book.title,
                     publishedYear,
                     lang,
                     titleAliases,
                   );
                  const platforms = [
                    { label: "🎧 Libby",       sub: resultT.freeLabel,        href: links.libby,       free: true },
                    { label: resultT.sourceOpenLibrary, sub: resultT.freeLabel, href: links.openLibrary, free: true },
                    ...(bookLang === "ar" ? [{
                      label: resultT.sourceArabic,
                      sub: resultT.freeLabel,
                      href: links.safahat,
                      free: true,
                     }, {
                       label: resultT.sourceHindawi,
                       sub: resultT.freeLabel,
                       href: links.hindawi,
                       free: true,
                     }] : []),
                     { label: resultT.sourceJarir,    sub: resultT.paidLabel,        href: links.jarir,      free: false },
                    { label: "🎧 StoryTel",    sub: resultT.subscriptionLabel, href: links.storytel,    free: false },
                    { label: "🎵 Audible",     sub: resultT.paidLabel,         href: links.audible,     free: false },
                    { label: "📱 Kindle",      sub: resultT.paidLabel,         href: links.kindle,      free: false },
                     { label: "📖 Google Books", sub: resultT.paidLabel,        href: links.googleBooks, free: false },
                    { label: "📕 Kobo",        sub: resultT.paidLabel,         href: links.kobo,        free: false },
                  ];
                  return (
                    <motion.div key={idx} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.18 + 0.1 }}
                      className="backdrop-blur-md bg-white/8 border border-white/12 p-5 rounded-2xl flex flex-col gap-4">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-white/8 text-white/55 border border-white/10">{book.subcategory}</span>
                        {atmosLabel && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300/90 border border-amber-400/20">{atmosLabel}</span>
                        )}
                        {extBook.length && (
                          <span className={`text-xs px-2 py-0.5 rounded-md border ${extBook.length === "قصير" ? "bg-emerald-500/12 border-emerald-500/25 text-emerald-300" : "bg-blue-500/12 border-blue-500/25 text-blue-300"}`}>
                            {extBook.length}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-md border ${
                          publishedYear
                            ? "bg-sky-400/10 text-sky-200/80 border-sky-400/20"
                            : "bg-white/5 text-white/45 border-white/10"
                        }`}>
                          {resultT.published}: {publishedYear
                            ? `${publishedYear}${extBook.publishedMonth ? `/${String(extBook.publishedMonth).padStart(2, "0")}` : ""}`
                            : resultT.publishedUnavailable}
                        </span>
                      </div>
                      {/* Title */}
                      <div>
                        <h3 className="text-lg font-bold text-amber-300 leading-snug">{book.title}</h3>
                        <p className="text-white/55 text-sm mt-0.5">{book.author}</p>
                        {titleAliases.length > 0 && (
                          <p className="text-sky-200/65 text-xs mt-1.5 leading-relaxed">
                            {resultT.alsoKnownAs}: {titleAliases.join(" · ")}
                          </p>
                        )}
                        <p className="text-amber-400/60 text-xs mt-1">⭐ {book.rating}</p>
                      </div>
                      {/* Reason */}
                      <div className="flex-1 bg-black/18 rounded-xl p-3.5 text-sm leading-relaxed border border-white/5 text-white/75">
                        <span className="text-amber-300/75 font-semibold block mb-1 text-xs">{resultT.whyThisBook}</span>
                        {book.reason}
                      </div>
                      <div className="flex gap-2 rounded-xl border border-indigo-300/20 bg-indigo-400/8 p-3 text-xs leading-relaxed text-indigo-100/80" role="note">
                        <History className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                        <div>
                          <span className="mb-1 block font-semibold text-indigo-200">{t.originalBookHistory}</span>
                          {originalBookHistory}
                        </div>
                      </div>
                      {moodWarning && (
                        <div className="flex gap-2 rounded-xl border border-orange-300/25 bg-orange-400/10 p-3 text-xs leading-relaxed text-orange-100/80" role="note">
                          <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0 text-orange-300" />
                          <div><span className="font-semibold text-orange-200">{t.moodWarning}: </span>{moodWarning}</div>
                        </div>
                      )}
                      {suitableAges.length > 0 && (
                        <div className="rounded-xl border border-amber-300/20 bg-amber-400/8 p-3" role="note">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-200">
                            <Users className="h-4 w-4 shrink-0 text-amber-300" />
                            {t.suitableAges}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(isForAllAges ? [t.allAges] : suitableAges).map((age) => (
                              <span key={age} className="rounded-md border border-amber-300/20 bg-black/15 px-2 py-1 text-[11px] text-amber-100/85">
                                {age}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {religiousContentNotes.length > 0 && (
                        <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3" role="note">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-200">
                            <BookOpen className="h-4 w-4 shrink-0 text-emerald-300" />
                            {t.religiousContentNotes}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {religiousContentNotes.map((note) => (
                              <span key={note} className="rounded-md border border-emerald-300/20 bg-black/15 px-2 py-1 text-[11px] text-emerald-100/85">
                                {note}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {contentWarnings.length > 0 && (
                        <div className="rounded-xl border border-rose-300/25 bg-rose-400/10 p-3" role="note">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-rose-200">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
                            {t.contentWarning}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {contentWarnings.map((warning) => (
                              <span key={warning} className="rounded-md border border-rose-300/20 bg-black/15 px-2 py-1 text-[11px] text-rose-100/85">
                                {warning}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {extBook.sourceReferences && extBook.sourceReferences.length > 0 && (
                        <div className="rounded-xl border border-sky-300/20 bg-sky-400/8 p-3 text-xs text-sky-100/75">
                          <div className="mb-1.5 font-semibold text-sky-200">{t.catalogReferences}</div>
                          <div className="flex flex-wrap gap-2">
                            {extBook.sourceReferences.includes("goodreads") && (
                              <a href={links.goodreads} target="_blank" rel="noopener noreferrer" className="underline decoration-sky-300/40 underline-offset-2 hover:text-white">
                                Goodreads
                              </a>
                            )}
                            {extBook.sourceReferences.includes("storygraph") && (
                              <a href={links.storygraph} target="_blank" rel="noopener noreferrer" className="underline decoration-sky-300/40 underline-offset-2 hover:text-white">
                                StoryGraph
                              </a>
                            )}
                          </div>
                          <p className="mt-1.5 text-[10px] leading-relaxed text-sky-100/45">{t.referenceDisclaimer}</p>
                        </div>
                      )}
                      {/* Quote */}
                      <div className="italic text-white/48 text-sm border-r-2 border-amber-400/28 pr-3 py-0.5 leading-relaxed">{book.quote}</div>
                       {/* Reader feedback */}
                       <div className="rounded-xl border border-white/8 bg-black/15 p-3">
                         <p className="mb-2 text-xs font-medium text-white/60">{resultT.feedbackPrompt}</p>
                         <div className="grid grid-cols-2 gap-2">
                           <button
                             type="button"
                             onClick={() => handleBookFeedback(book.title, "liked")}
                             aria-pressed={feedback === "liked"}
                             className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                               feedback === "liked"
                                 ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-200"
                                 : "border-white/10 bg-white/5 text-white/55 hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
                             }`}
                           >
                             <ThumbsUp className="h-3.5 w-3.5" />{resultT.likedBook}
                           </button>
                           <button
                             type="button"
                             onClick={() => handleBookFeedback(book.title, "disliked")}
                             aria-pressed={feedback === "disliked"}
                             className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                               feedback === "disliked"
                                 ? "border-rose-400/60 bg-rose-400/20 text-rose-200"
                                 : "border-white/10 bg-white/5 text-white/55 hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-200"
                             }`}
                           >
                             <ThumbsDown className="h-3.5 w-3.5" />{resultT.dislikedBook}
                           </button>
                         </div>
                         {feedback && (
                           <p className="mt-2 text-[11px] text-amber-200/65" role="status">{resultT.feedbackSaved}</p>
                         )}
                       </div>
                      {/* Platforms */}
                      <div className="flex flex-col gap-2 pt-1 border-t border-white/8">
                        <button type="button" onClick={() => setExpandedPlatforms(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; })}
                          aria-expanded={expandedPlatforms.has(idx)}
                          aria-controls={`book-platforms-${idx}`}
                          className="flex items-center justify-between text-xs text-white/45 hover:text-white/70 transition-colors py-0.5">
                          <span className="flex items-center gap-1.5"><Headphones className="w-3 h-3" />{resultT.readOrListen}</span>
                          <span className="text-white/30">{expandedPlatforms.has(idx) ? "▲" : "▼"}</span>
                        </button>
                        {expandedPlatforms.has(idx) && (
                          <motion.div id={`book-platforms-${idx}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-2 gap-1.5">
                            {platforms.map(p => (
                              <a key={p.label} href={p.href} target="_blank" rel="noopener noreferrer"
                                className={`flex flex-col items-start px-2.5 py-2 rounded-xl border text-xs transition-all hover:scale-[1.02] active:scale-95 ${
                                  p.free ? "bg-emerald-500/10 border-emerald-500/22 text-emerald-300 hover:bg-emerald-500/18"
                                         : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"}`}>
                                <span className="font-medium leading-tight">{p.label}</span>
                                <span className={`text-[10px] ${p.free ? "text-emerald-400/70" : "text-white/30"}`}>{p.sub}</span>
                              </a>
                            ))}
                          </motion.div>
                        )}
                        <div className="flex gap-2">
                          <a href={goodreadsUrl(book.title, book.author)} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#553b08]/50 hover:bg-[#f4f1ea]/8 border border-amber-700/28 hover:border-amber-400/35 text-amber-300 text-xs font-medium transition-all">
                            <BookPlus className="w-3.5 h-3.5" />{resultT.iWantToRead}
                          </a>
                           <a href={goodreadsUrl(book.title, book.author)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/45 hover:text-white/65 text-xs transition-all">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
