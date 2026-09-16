import { Router, type IRouter } from "express";
import { db, recommendationsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import {
  CreateRecommendationBody,
  CreateRecommendationResponse,
  ListRecommendationsResponse,
  GetRecommendationStatsResponse,
} from "@workspace/api-zod";
import { requiresAuth } from "../middlewares/requiresAuth";
const router: IRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────
type Atmosphere = "adventure" | "mystery" | "horror" | "romance" | "family" | "scifi" | "thriller" | "philosophical" | "philosophy" | "spiritual" | "poetry" | "selfhelp" | "history" | "science" | "classic";
type ReadingStyle = "trending" | "forgotten" | "classic" | "unknown";
type AgeGroup = "children" | "teen" | "young_adult" | "adult" | "senior";
type CanonicalAgeGroup = "children" | "teen" | "adult";
type ContentWarning =
  | "graphic_violence" | "physical_assault" | "domestic_abuse" | "child_abuse"
  | "animal_cruelty_death" | "torture" | "kidnapping" | "suicide_self_harm"
  | "eating_disorders" | "mental_illness" | "grief_loss" | "religious_trauma"
  | "explicit_sexual_content" | "sexual_assault" | "grooming" | "nudity"
  | "racism_slurs" | "terminal_illness" | "miscarriage_abortion" | "medical_trauma"
  | "drug_use_addiction" | "alcohol_abuse" | "smoking" | "foul_language"
  | "religious_themes" | "occult_magic" | "not_for_children"
  | "child_suitability_unverified";
type SourceReference = "goodreads" | "storygraph";

type BookSuggestion = {
  title: string;
  author: string;
  category: string;
  subcategory: string;
  rating: string;
  reason: string;
  quote: string;
  length?: "قصير" | "متوسط" | "طويل";
  atmosphere?: Atmosphere;
  weatherMatch?: string[];     // Clear | Clouds | Rain | Drizzle | Thunderstorm | Snow | Atmosphere
  moodMatch?: string[];        // keyword fragments to match against mood string
  timeMatch?: string[];        // morning | afternoon | evening | night
  cityBonus?: string[];        // city names that get a +1 bonus
  language?: "ar" | "en" | "fr"; // original language (default = ar)
  ageGroups?: AgeGroup[];
  suitableAgeGroups?: AgeGroup[];
  occasionMatch?: string[];    // occasion ids that boost this book
  seasonMatch?: string[];      // spring | summer | autumn | winter
  monthMatch?: number[];       // 1–12 months when this book is especially fitting
  contentWarnings?: ContentWarning[];
  sourceReferences?: SourceReference[];
};

type TrendingPeriod = "yearly" | "monthly";

type TrendingSignals = {
  yearlyRanks: Map<string, number>;
  monthlyRanks: Map<string, number>;
};

type OpenLibraryTrendingResponse = {
  works?: Array<{
    title?: unknown;
  }>;
};

function normalizeBookIdentity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}

function normalizeEditionTitle(value: string): string {
  return normalizeBookIdentity(value.replace(/\([^)]*\)|\[[^\]]*\]/g, " "));
}

const BOOK_IDENTITY_GROUPS = [
  ["ماتيلدا", "Matilda"],
  ["الفرسان الثلاثة", "The Three Musketeers", "Les Trois Mousquetaires"],
  ["حول العالم في ثمانين يوماً", "حول العالم في 80 يوماً", "Around the World in Eighty Days", "Le Tour du monde en 80 jours"],
  ["مغامرات طرزان", "Tarzan", "Tarzan of the Apes"],
  ["الأمير الصغير", "The Little Prince", "Le Petit Prince"],
  ["الحديقة السرية", "The Secret Garden"],
  ["هاري بوتر وحجر الفلاسفة", "Harry Potter and the Philosopher's Stone", "Harry Potter and the Sorcerer's Stone"],
  ["١٩٨٤", "1984"],
  ["دون", "Dune"],
  ["البؤساء", "Les Misérables"],
  ["الجريمة والعقاب", "Crime and Punishment"],
] as const;

const BOOK_IDENTITY_ALIASES = new Map<string, Set<string>>();
for (const group of BOOK_IDENTITY_GROUPS) {
  const identities = new Set(group.map(normalizeEditionTitle));
  for (const identity of identities) BOOK_IDENTITY_ALIASES.set(identity, identities);
}

function isExcludedBook(title: string, excluded: Set<string>): boolean {
  const identity = normalizeEditionTitle(title);
  const identities = BOOK_IDENTITY_ALIASES.get(identity) ?? new Set([identity]);
  return [...identities].some((candidate) => excluded.has(candidate));
}

function hasUnsafeRecommendationInput(input: {
  city: string;
  mood: string;
  category: string;
  weatherCondition: string;
  excludeBooks?: string[];
  likedBooks?: string[];
  dislikedBooks?: string[];
  preferredGenres?: string[];
}): boolean {
  const textFields = [input.city, input.mood, input.category, input.weatherCondition];
  const feedbackBooks = [...(input.likedBooks ?? []), ...(input.dislikedBooks ?? [])];
  return textFields.some(value => value.length > 180)
    || (input.excludeBooks?.length ?? 0) > 2_000
    || (input.likedBooks?.length ?? 0) > 100
    || (input.dislikedBooks?.length ?? 0) > 100
    || (input.preferredGenres?.length ?? 0) > 12
    || Boolean(input.excludeBooks?.some(title => title.length > 240))
    || Boolean(input.preferredGenres?.some(genre => genre.length > 40))
    || feedbackBooks.some(title => title.length > 240);
}

// ─── Master Book Library (80+ books) ─────────────────────────────────────────
const BOOKS: BookSuggestion[] = [

  // ╔══════════════════════════════════════════════════╗
  // ║  روايات المغامرة والاستكشاف                     ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "الخيميائي", author: "باولو كويلو",
    category: "روايات مغامرة", subcategory: "رحلة وذات", rating: "4.8/5", length: "قصير",
    atmosphere: "adventure",
    weatherMatch: ["Clear"],
    moodMatch: ["مغامرة", "إثارة", "مرتبك", "إجابات", "طموح"],
    timeMatch: ["morning", "afternoon"],
    reason: "رحلة سانتياغو الشاب نحو كنزه الخاص تشعل فيك جذوة الحلم وتُذكّرك أن الكون يتآمر لصالح من يتبع روحه.",
    quote: "«حين تريد شيئاً، يتآمر الكون كله على مساعدتك.»",
  },
  {
    title: "حول العالم في ثمانين يوماً", author: "جول فيرن",
    category: "روايات مغامرة", subcategory: "مغامرة كلاسيكية", rating: "4.5/5", length: "قصير",
    atmosphere: "adventure",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["مغامرة", "متحمس", "فضولي"],
    timeMatch: ["morning", "afternoon"],
    reason: "جولة خاطفة حول الكرة الأرضية مع فيلياس فوج وخادمه باسبارتو — مغامرة تملأ الروح بالحيوية.",
    quote: "«العالم صغير لمن يعرف كيف يتجوّله.»",
  },
  {
    title: "الكونت مونت كريستو", author: "ألكسندر دوماس",
    category: "روايات مغامرة", subcategory: "انتقام وعدالة", rating: "4.9/5", length: "طويل",
    atmosphere: "adventure",
    weatherMatch: ["Clouds", "Thunderstorm", "Rain"],
    moodMatch: ["مغامرة", "حزين", "إلهام", "إثارة"],
    timeMatch: ["evening", "night"],
    reason: "أحد أعظم الروايات في التاريخ — قصة إدمون دانتيس الذي تحوّل من السجن إلى القمة بصبر أسطوري.",
    quote: "«انتظر واأمل — هاتان الكلمتان لخّصتا فلسفتي في الحياة.»",
  },
  {
    title: "جزيرة الكنز", author: "روبرت لويس ستيفنسون",
    category: "روايات مغامرة", subcategory: "مغامرة بحرية", rating: "4.4/5", length: "قصير",
    atmosphere: "adventure",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["مغامرة", "متحمس", "خفيف"],
    timeMatch: ["morning", "afternoon"],
    reason: "الكلاسيكية الأجمل في أدب المغامرة — قراصنة وخرائط وكنوز مخبأة في جزر مجهولة.",
    quote: "«الإبحار بحثاً عن المجهول هو أجمل ما قد يفعله قلب جسور.»",
  },
  {
    title: "قلب الظلام", author: "جوزيف كونراد",
    category: "روايات مغامرة", subcategory: "رحلة نفسية", rating: "4.6/5", length: "قصير",
    atmosphere: "adventure",
    weatherMatch: ["Rain", "Thunderstorm", "Clouds"],
    moodMatch: ["مغامرة", "حزين", "فضولي", "فلسفي"],
    timeMatch: ["evening", "night"],
    reason: "رحلة في أعماق القارة الأفريقية وأعماق النفس البشرية — مظلمة وجميلة في آنٍ واحد.",
    quote: "«الظلام ليس في الغابة، بل في قلب الإنسان حين ينسى إنسانيته.»",
  },
  {
    title: "عشرون ألف فرسخ تحت الماء", author: "جول فيرن",
    category: "روايات مغامرة", subcategory: "استكشاف", rating: "4.5/5", length: "طويل",
    atmosphere: "adventure",
    weatherMatch: ["Rain", "Drizzle", "Thunderstorm"],
    moodMatch: ["مغامرة", "فضولي", "علوم"],
    timeMatch: ["afternoon", "evening"],
    reason: "عالم تحت الماء لا تتخيله — الغواصة نيموتاكس تأخذك في رحلة أسطورية في أعماق المحيطات.",
    quote: "«البحر يخفي في أعماقه أسراراً لم تطل عليها الشمس قط.»",
  },
  {
    title: "روبنسون كروزو", author: "دانيال ديفو",
    category: "روايات مغامرة", subcategory: "بقاء وتحدٍّ", rating: "4.3/5", length: "قصير",
    atmosphere: "adventure",
    weatherMatch: ["Thunderstorm", "Clear"],
    moodMatch: ["مغامرة", "تحدي", "إنتاجية"],
    timeMatch: ["morning"],
    reason: "درس بقاء فلسفي على جزيرة منعزلة — يذكّرك أن الإنسان قادر على صنع الحضارة من العدم.",
    quote: "«أعظم إنجازاتي كانت حين لم يكن لديّ شيء سوى عزيمتي.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  الروايات البوليسية                              ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "جريمة في قطار الشرق السريع", author: "أجاثا كريستي",
    category: "روايات بوليسية", subcategory: "بوليسية كلاسيكية", rating: "4.8/5", length: "قصير",
    atmosphere: "mystery",
    weatherMatch: ["Snow", "Clouds", "Rain"],
    moodMatch: ["ألغاز", "غموض", "إثارة", "مشتاق"],
    timeMatch: ["evening", "night"],
    cityBonus: ["حائل", "تبوك"],
    reason: "جثة في قطار محاصر بالثلج والكل مشتبه به — كريستي في أوجها تُربكك حتى السطر الأخير.",
    quote: "«كل إنسان يحمل سراً يظنه مدفوناً، لكن الحقيقة دائماً تطفو.»",
  },
  {
    title: "اسم الوردة", author: "أمبرتو إيكو",
    category: "روايات بوليسية", subcategory: "غموض تاريخي", rating: "4.7/5", length: "طويل",
    atmosphere: "mystery",
    weatherMatch: ["Rain", "Clouds", "Snow"],
    moodMatch: ["ألغاز", "غموض", "تاريخ", "فلسفي"],
    timeMatch: ["evening", "night"],
    reason: "دير معزول في الجبال وسلسلة جرائم غامضة — رواية تمزج الفلسفة بالتشويق بشكل فريد.",
    quote: "«الكتب لا تُخلق لتُصدَّق، بل لتُفحَص ويُتأمَّل فيها.»",
  },
  {
    title: "شيرلوك هولمز: دراسة في اللون القرمزي", author: "آرثر كونان دويل",
    category: "روايات بوليسية", subcategory: "تحقيق كلاسيكي", rating: "4.7/5", length: "قصير",
    atmosphere: "mystery",
    weatherMatch: ["Clouds", "Rain", "Drizzle"],
    moodMatch: ["ألغاز", "غموض", "فضولي", "تركيز"],
    timeMatch: ["afternoon", "evening", "night"],
    reason: "أول ظهور لهولمز — ذكاء استنتاجي خارق يشحن عقلك ويُعلمك التفكير من زاوية مختلفة.",
    quote: "«حين تستبعد المستحيل، ما يبقى، مهما كان غير محتمل، هو الحقيقة.»",
  },
  {
    title: "قاتل ABC", author: "أجاثا كريستي",
    category: "روايات بوليسية", subcategory: "بوليسية كلاسيكية", rating: "4.6/5", length: "قصير",
    atmosphere: "mystery",
    weatherMatch: ["Clouds", "Drizzle"],
    moodMatch: ["ألغاز", "غموض", "إثارة"],
    timeMatch: ["evening", "night"],
    reason: "قاتل يُرسل دليله قبل كل جريمة — بواريه يتحدى منطقك في لعبة شطرنج مميتة.",
    quote: "«الكمال ليس في ارتكاب الجريمة، بل في اختيار الضحية.»",
  },
  {
    title: "المريض الصامت", author: "أليكس مايكليديس",
    category: "روايات بوليسية", subcategory: "إثارة نفسية", rating: "4.6/5", length: "قصير",
    atmosphere: "thriller",
    weatherMatch: ["Rain", "Clouds", "Thunderstorm"],
    moodMatch: ["ألغاز", "غموض", "إثارة", "نفس"],
    timeMatch: ["evening", "night"],
    reason: "فنانة تلتزم الصمت بعد قتل زوجها — والمحلل النفسي يكشف السر ويصدمك في النهاية.",
    quote: "«الصمت أحياناً هو الحقيقة الوحيدة التي لا تكذب.»",
  },
  {
    title: "البنت في القطار", author: "باولا هوكينز",
    category: "روايات بوليسية", subcategory: "إثارة نفسية", rating: "4.4/5", length: "قصير",
    atmosphere: "thriller",
    weatherMatch: ["Rain", "Drizzle", "Clouds"],
    moodMatch: ["ألغاز", "غموض", "إثارة"],
    timeMatch: ["evening", "night"],
    reason: "مشاهدة من نافذة قطار تتحول إلى تورط في جريمة اختفاء — لن تتوقف عن القراءة.",
    quote: "«ما نراه من بعيد دائماً أجمل وأخطر مما هو في الواقع.»",
  },
  {
    title: "دا فينشي كود", author: "دان براون",
    category: "روايات بوليسية", subcategory: "غموض تاريخي", rating: "4.4/5", length: "طويل",
    atmosphere: "mystery",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["ألغاز", "غموض", "فضولي", "تاريخ", "مغامرة"],
    timeMatch: ["afternoon", "evening"],
    reason: "ألغاز دا فينشي وأسرار الفاتيكان في ليلة واحدة — رواية تجعلك تعيد النظر في كل ما تعرفه.",
    quote: "«التاريخ يكتبه المنتصرون، والحقيقة تبقى مُشفَّرة في اللوحات.»",
  },
  {
    title: "فتاة مختفية", author: "غيليان فلين",
    category: "روايات بوليسية", subcategory: "إثارة نفسية", rating: "4.5/5", length: "طويل",
    atmosphere: "thriller",
    weatherMatch: ["Rain", "Thunderstorm", "Clouds"],
    moodMatch: ["ألغاز", "غموض", "إثارة"],
    timeMatch: ["night", "evening"],
    reason: "زوجة تختفي وزوجها المشتبه به — رواية تُحطم كل توقعاتك وتصدمك في كل فصل.",
    quote: "«لا أحد يعرف حقاً من يكون شريك حياته خلف الأبواب المغلقة.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  الروايات العائلية والاجتماعية                  ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "بيت الأرواح", author: "إيزابيل الليندي",
    category: "روايات عائلية", subcategory: "ملحمة عائلية", rating: "4.7/5", length: "طويل",
    atmosphere: "family",
    weatherMatch: ["Clouds", "Rain", "Clear"],
    moodMatch: ["عائلة", "رومانسي", "عاطفي", "تاريخ"],
    timeMatch: ["afternoon", "evening"],
    reason: "ثلاثة أجيال من عائلة ترويبا في أمريكا اللاتينية — ملحمة إنسانية تمس كل قيمة في حياتنا.",
    quote: "«الحياة أقصر من أن نضيعها على الأحقاد، وأطول من أن ننساها بسهولة.»",
  },
  {
    title: "ذاكرة الجسد", author: "أحلام مستغانمي",
    category: "روايات عائلية", subcategory: "أدب عربي", rating: "4.8/5", length: "طويل",
    atmosphere: "romance",
    ageGroups: ["adult"],
    weatherMatch: ["Rain", "Clouds"],
    moodMatch: ["رومانسي", "عاطفي", "حزين", "إلهام", "عائلة"],
    timeMatch: ["evening", "night"],
    cityBonus: ["الجزائر"],
    reason: "رواية خالد وحياة — حب مستحيل بين الجزائر وسويسرا بأجمل لغة عربية رومانسية.",
    quote: "«نحن لا نحب الأشخاص لما هم عليه، بل لما يُيقظونه فينا.»",
  },
  {
    title: "ألف شمس مشرقة", author: "خالد حسيني",
    category: "روايات عائلية", subcategory: "إنسانية", rating: "4.9/5", length: "طويل",
    atmosphere: "family",
    weatherMatch: ["Clouds", "Rain", "Snow"],
    moodMatch: ["حزين", "إلهام", "رومانسي", "عاطفي"],
    timeMatch: ["evening", "night"],
    reason: "ملحمة المرأة الأفغانية في زمن الحرب — ستبكي وستشعر بأن الإنسانية أقوى من كل قهر.",
    quote: "«لكل ألم حد، ولكل صبر نهاية تكافئه.»",
  },
  {
    title: "طائر الشوك", author: "كوليين ماكولا",
    category: "روايات عائلية", subcategory: "ملحمة رومانسية", rating: "4.7/5", length: "طويل",
    atmosphere: "family",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["رومانسي", "عاطفي", "عائلة"],
    timeMatch: ["afternoon", "evening"],
    reason: "قصة حب مستحيل تمتد عبر عقود في أستراليا — رواية لن تنساها بقية حياتك.",
    quote: "«طائر الشوك يغني مرة واحدة في حياته، لكن أغنيته أجمل ما في العالم.»",
  },
  {
    title: "عائلة براديشا", author: "إيمي تان",
    category: "روايات عائلية", subcategory: "علاقات عائلية", rating: "4.5/5", length: "طويل",
    atmosphere: "family",
    weatherMatch: ["Rain", "Clouds"],
    moodMatch: ["عائلة", "حزين", "إلهام"],
    timeMatch: ["evening"],
    reason: "أمهات صينيات وبناتهن الأمريكيات — كيف تتشابك الجذور الثقافية مع جيل الأحفاد.",
    quote: "«لا تستطيع اختيار أمك، لكن تستطيع اختيار أن تفهمها.»",
  },
  {
    title: "حكاية الجارية", author: "مارغريت أتوود",
    category: "روايات عائلية", subcategory: "روائع حديثة", rating: "4.7/5", length: "طويل",
    atmosphere: "thriller",
    ageGroups: ["adult"],
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["فضولي", "إثارة", "مغامرة"],
    timeMatch: ["evening", "night"],
    reason: "مجتمع دستوبي تُعامَل فيه المرأة كأداة — رواية مقلقة ومهمة تُوقظ الوعي.",
    quote: "«المقاومة ليست دائماً صرخة، أحياناً هي همسة في الظلام.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  الروايات الرومانسية                            ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "كبرياء وهوى", author: "جين أوستن",
    category: "روايات رومانسية", subcategory: "رومانسية كلاسيكية", rating: "4.7/5", length: "طويل",
    atmosphere: "romance",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["رومانسي", "عاطفي", "ترفيه", "خفيف"],
    timeMatch: ["afternoon", "morning"],
    reason: "إليزابيث بينيت ودارسي — لعبة الكبرياء والحب في مجتمع انجليزي ظريف وعميق.",
    quote: "«القلب المفتوح يرى الجمال حيث لا يراه غيره.»",
  },
  {
    title: "جين إير", author: "شارلوت برونتي",
    category: "روايات رومانسية", subcategory: "رومانسية كلاسيكية", rating: "4.8/5", length: "طويل",
    atmosphere: "romance",
    weatherMatch: ["Rain", "Drizzle", "Clouds"],
    moodMatch: ["رومانسي", "عاطفي", "حزين", "إلهام"],
    timeMatch: ["evening", "afternoon"],
    reason: "قصة حب في الأيام الرمادية — جين البطلة القوية التي لا تُضيّع كرامتها من أجل أحد.",
    quote: "«أنا حر ومستقل مثلك تماماً، وروحينا متساويتان.»",
  },
  {
    title: "قواعد العشق الأربعون", author: "إليف شافاق",
    category: "روايات رومانسية", subcategory: "رومانسية روحية", rating: "4.7/5", length: "طويل",
    atmosphere: "romance",
    weatherMatch: ["Clouds", "Rain", "Clear"],
    moodMatch: ["رومانسي", "عاطفي", "روحي", "إجابات"],
    timeMatch: ["evening", "night"],
    reason: "العشق الصوفي بين جلال الدين الرومي وشمس التبريزي — رواية تُغيّر نظرتك للحب والروح.",
    quote: "«قلب حقيقي لا يستطيع التوقف عن العطاء، كالشمع الذي يذوب ليضيء.»",
  },
  {
    title: "العاشق", author: "مارغريت دوراس",
    category: "روايات رومانسية", subcategory: "أدب عالمي", rating: "4.4/5", length: "قصير",
    atmosphere: "romance",
    weatherMatch: ["Rain", "Drizzle"],
    moodMatch: ["رومانسي", "عاطفي", "حزين"],
    timeMatch: ["evening", "night"],
    reason: "حب ممنوع في فيتنام الاستعمارية — سرد شعري نادر يجعل الحزن جميلاً.",
    quote: "«أحياناً الحب لا يُقال، يُعاش فقط في تفاصيل لحظة واحدة.»",
  },
  {
    title: "وقت الحب", author: "غابرييل غارسيا ماركيز",
    category: "روايات رومانسية", subcategory: "رومانسية عالمية", rating: "4.6/5", length: "طويل",
    atmosphere: "romance",
    weatherMatch: ["Clear", "Clouds", "Rain"],
    moodMatch: ["رومانسي", "عاطفي"],
    timeMatch: ["afternoon", "evening"],
    reason: "انتظار خمسين عاماً من أجل حب واحد — ماركيز يُعلمك أن الزمن لا يُميت المشاعر الحقيقية.",
    quote: "«لا سبيل للإفلات من الشيخوخة وحيداً، لكن يمكن احتماله مع من تُحب.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  الخيال العلمي والفانتازيا                      ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "مؤسسة", author: "آيزاك أزيموف",
    category: "خيال علمي", subcategory: "ملحمة كونية", rating: "4.8/5", length: "طويل",
    atmosphere: "scifi",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["فضولي", "علوم", "مغامرة", "تاريخ"],
    timeMatch: ["night", "evening"],
    reason: "إنقاذ الحضارة البشرية في ١٢٠٠٠ سنة — أزيموف يبني إمبراطورية من الأفكار الخالدة.",
    quote: "«لا يمكنك الهروب من التاريخ — يمكنك فقط أن تُشكّله.»",
  },
  {
    title: "دون", author: "فرانك هربرت",
    category: "خيال علمي", subcategory: "ملحمة كونية", rating: "4.8/5", length: "طويل",
    atmosphere: "scifi",
    weatherMatch: ["Atmosphere", "Clear"],
    moodMatch: ["مغامرة", "فضولي", "علوم", "تحدي"],
    timeMatch: ["evening", "night"],
    cityBonus: ["الرياض", "الدمام", "تبوك"],
    reason: "كوكب الصحراء وصراع السلطة والبيئة — ملحمة كونية تُذكّرك بقيمة الماء والحياة.",
    quote: "«لا أعرف أي ملوك أو رجال، أعرف فقط القوانين التي تسير بها الكائنات.»",
  },
  {
    title: "هاري بوتر وحجر الفلاسفة", author: "ج. ك. رولينغ",
    category: "خيال علمي", subcategory: "فانتازيا", rating: "4.8/5", length: "قصير",
    atmosphere: "adventure",
    weatherMatch: ["Rain", "Clouds", "Snow"],
    moodMatch: ["مغامرة", "خفيف", "ترفيه", "متحمس"],
    timeMatch: ["morning", "afternoon"],
    reason: "قصة السحر التي لا تشيخ — هاري بوتر يُعلم الأطفال والكبار قيمة الصداقة والشجاعة.",
    quote: "«الشجاعة ليست غياب الخوف، بل فعل ما يجب رغم الخوف.»",
  },
  {
    title: "١٩٨٤", author: "جورج أورويل",
    category: "خيال علمي", subcategory: "دستوبيا", rating: "4.8/5", length: "قصير",
    atmosphere: "thriller",
    weatherMatch: ["Rain", "Clouds", "Thunderstorm"],
    moodMatch: ["فضولي", "مرتبك", "إجابات", "فلسفي"],
    timeMatch: ["evening", "night"],
    reason: "مجتمع المراقبة المطلقة حيث الكلمات تُعاد كتابتها — كتاب يُغيّر نظرتك للحرية.",
    quote: "«من يتحكم في الماضي يتحكم في المستقبل، ومن يتحكم في الحاضر يتحكم في الماضي.»",
  },
  {
    title: "عالم شجاع جديد", author: "ألدوس هكسلي",
    category: "خيال علمي", subcategory: "دستوبيا", rating: "4.5/5", length: "قصير",
    atmosphere: "philosophical",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["فضولي", "فلسفي", "مرتبك"],
    timeMatch: ["evening", "night"],
    reason: "عالم تنتج فيه الناس بيولوجياً وتُقدَّم لهم السعادة كدواء — هل هذا هو الكمال؟",
    quote: "«السعادة الحقيقية تحتاج شيئاً يمكن الإحساس به حين تخسره.»",
  },
  {
    title: "أرض الأحلام", author: "أورسولا لو غوين",
    category: "خيال علمي", subcategory: "فلسفة فانتازيا", rating: "4.6/5", length: "قصير",
    atmosphere: "philosophical",
    weatherMatch: ["Clouds", "Drizzle"],
    moodMatch: ["فضولي", "فلسفي", "إجابات"],
    timeMatch: ["evening", "night"],
    reason: "أحلام شخص واحد تغير الواقع بالكامل — رواية تتساءل عن حدود الوعي والمسؤولية.",
    quote: "«الحلم ليس هروباً من الواقع، بل طريقة لاكتشاف ما يمكن أن يكون.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  روايات الإثارة والتشويق                        ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "الشبكة", author: "جون غريشام",
    category: "روايات إثارة", subcategory: "إثارة قانونية", rating: "4.4/5", length: "طويل",
    atmosphere: "thriller",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["إثارة", "ألغاز", "غموض"],
    timeMatch: ["evening", "night"],
    reason: "محامٍ يكتشف مؤامرة تطيح بالعدالة — جريشام الأستاذ في جعلك تنسى تاريخ النوم.",
    quote: "«الحقيقة لا تكفل العدالة، والعدالة لا تكفل الإنصاف.»",
  },
  {
    title: "الأوهام السبعة", author: "جاي سيتي ديا",
    category: "روايات إثارة", subcategory: "إثارة نفسية", rating: "4.4/5", length: "قصير",
    atmosphere: "thriller",
    weatherMatch: ["Rain", "Thunderstorm"],
    moodMatch: ["إثارة", "ألغاز", "غموض"],
    timeMatch: ["night", "evening"],
    reason: "سبعة أوهام تحيط بشخصية واحدة — إثارة نفسية تُعيدك إلى نقطة البداية كل فصل.",
    quote: "«الوهم هو الحقيقة التي نختار أن نؤمن بها لأنها أكثر احتمالاً.»",
  },
  {
    title: "الحاج كلينتون", author: "عزيز نسين",
    category: "روايات إثارة", subcategory: "إثارة ساخرة", rating: "4.3/5", length: "قصير",
    atmosphere: "thriller",
    weatherMatch: ["Clouds"],
    moodMatch: ["إثارة", "ترفيه", "ضحك"],
    timeMatch: ["afternoon"],
    reason: "رواية ساخرة مليئة بالمفاجآت — تضحك وتفكر في آن واحد.",
    quote: "«الحياة مسرح، والسياسيون أسوأ ممثليه.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  الروايات التاريخية                             ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "الزيني بركات", author: "جمال الغيطاني",
    category: "روايات تاريخية", subcategory: "تاريخي عربي", rating: "4.6/5", length: "طويل",
    atmosphere: "history",
    weatherMatch: ["Clouds", "Atmosphere"],
    moodMatch: ["تاريخ", "فضولي", "فلسفي"],
    timeMatch: ["evening", "night"],
    reason: "مصر في القرن الخامس عشر والسلطة والمراقبة — رواية تجعلك تسأل كيف يتكرر التاريخ.",
    quote: "«السلطة لا تتغير، تتغير فقط أسماء من يحملونها.»",
  },
  {
    title: "البيت الكبير", author: "نجيب محفوظ",
    category: "روايات تاريخية", subcategory: "أدب عربي كلاسيكي", rating: "4.8/5", length: "طويل",
    atmosphere: "family",
    weatherMatch: ["Clouds", "Clear"],
    moodMatch: ["تاريخ", "عائلة", "فضولي"],
    timeMatch: ["afternoon", "evening"],
    cityBonus: ["القاهرة"],
    reason: "ثلاثية القاهرة — ملحمة العائلة المصرية عبر أجيال في أزقة الحسين القديمة.",
    quote: "«الزمن كالنيل، يمضي ولا يعود، لكنه يُخصب كل ما يمر عليه.»",
  },
  {
    title: "الفرسان الثلاثة", author: "ألكسندر دوماس",
    category: "روايات تاريخية", subcategory: "مغامرة تاريخية", rating: "4.7/5", length: "طويل",
    atmosphere: "adventure",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["مغامرة", "تاريخ", "متحمس"],
    timeMatch: ["morning", "afternoon"],
    reason: "الإخاء والشرف وخنجر الإنتريغ — دارتانيان والمسكيتيرز الثلاثة لا يشيخون أبداً.",
    quote: "«الواحد للجميع، والجميع للواحد.»",
  },
  {
    title: "اسم الله الأعظم", author: "محمد عبد الغني حسن",
    category: "روايات تاريخية", subcategory: "تاريخ إسلامي", rating: "4.5/5", length: "قصير",
    atmosphere: "spiritual",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["تاريخ", "ديني", "إسلامي"],
    timeMatch: ["morning", "evening"],
    cityBonus: ["مكة المكرمة", "المدينة المنورة"],
    reason: "رحلة في أعماق التاريخ الإسلامي بأسلوب قصصي شيق — تُعيدك إلى جذورك بأجمل طريقة.",
    quote: "«التاريخ الإسلامي ليس ماضياً — هو دستور للمستقبل.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  الروايات الكلاسيكية                            ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "مئة عام من العزلة", author: "غابرييل غارسيا ماركيز",
    category: "روايات كلاسيكية", subcategory: "واقعية سحرية", rating: "4.9/5", length: "طويل",
    atmosphere: "family",
    weatherMatch: ["Rain", "Clear", "Clouds"],
    moodMatch: ["فضولي", "مغامرة", "فلسفي", "رومانسي"],
    timeMatch: ["afternoon", "evening"],
    reason: "عائلة بوينديا عبر مئة عام من الحب والحرب والوحدة — الرواية التي لا تُنسى.",
    quote: "«كان مقدراً للعالم أن يكون جديداً لدرجة أن الأشياء كثيراً ما كانت تفتقر إلى أسماء.»",
  },
  {
    title: "البؤساء", author: "فيكتور هوغو",
    category: "روايات كلاسيكية", subcategory: "اجتماعية كلاسيكية", rating: "4.9/5", length: "طويل",
    atmosphere: "family",
    weatherMatch: ["Rain", "Clouds", "Snow"],
    moodMatch: ["حزين", "إلهام", "تاريخ"],
    timeMatch: ["evening", "night"],
    reason: "جان فالجان والعدالة والرحمة والفداء — رواية تجعل قلبك يتسع للإنسانية كلها.",
    quote: "«أن تحب شخصاً ما هو أن ترى وجه الله.»",
  },
  {
    title: "الجريمة والعقاب", author: "فيودور دوستويفسكي",
    category: "روايات كلاسيكية", subcategory: "نفسية عميقة", rating: "4.8/5", length: "طويل",
    atmosphere: "philosophical",
    weatherMatch: ["Rain", "Thunderstorm", "Clouds"],
    moodMatch: ["فلسفي", "حزين", "إجابات", "مرتبك"],
    timeMatch: ["evening", "night"],
    reason: "راسكولنيكوف يقتل ويُعذَّب بضميره — أعظم رواية في التاريخ عن الذنب والخلاص.",
    quote: "«المعاناة ضرورة للإنسان، بدونها لن يتعلم شيئاً.»",
  },
  {
    title: "الحرب والسلام", author: "ليو تولستوي",
    category: "روايات كلاسيكية", subcategory: "ملحمة تاريخية", rating: "4.8/5", length: "طويل",
    atmosphere: "history",
    weatherMatch: ["Snow", "Clouds"],
    moodMatch: ["تاريخ", "مغامرة", "فلسفي"],
    timeMatch: ["evening", "afternoon"],
    reason: "روسيا في عهد نابليون — أعظم الكتب التي كُتبت عن الحرب والإنسانية والحب.",
    quote: "«لا يوجد عظمة حيث لا يوجد صدق وطيبة وحق.»",
  },
  {
    title: "الشيخ والبحر", author: "إرنست همنغواي",
    category: "روايات كلاسيكية", subcategory: "نوفيلا كلاسيكية", rating: "4.7/5", length: "قصير",
    atmosphere: "adventure",
    weatherMatch: ["Clear", "Thunderstorm", "Rain"],
    moodMatch: ["حزين", "إلهام", "طموح", "تحدي"],
    timeMatch: ["morning", "evening"],
    reason: "شيخ وسمكة عملاقة في المحيط — قصة الكفاح البشري ضد القدر والطبيعة.",
    quote: "«الإنسان يُدمَّر لكن لا يُهزم.»",
  },
  {
    title: "أيام", author: "طه حسين",
    category: "روايات كلاسيكية", subcategory: "أدب عربي", rating: "4.8/5", length: "قصير",
    atmosphere: "philosophy",
    weatherMatch: ["Clouds", "Drizzle"],
    moodMatch: ["حزين", "إلهام", "إجابات", "طموح"],
    timeMatch: ["morning", "afternoon"],
    cityBonus: ["القاهرة"],
    reason: "رحلة طه حسين من القرية المصرية البسيطة إلى أعلى المراتب العلمية رغم العمى.",
    quote: "«العلم كالنور يجيء من حيث لا تحتسب.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  تطوير الذات                                    ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "العادات الذرية", author: "جيمس كلير",
    category: "تطوير ذات", subcategory: "بناء العادات", rating: "4.9/5", length: "قصير",
    atmosphere: "selfhelp",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["إنتاجية", "تحدي", "طموح", "تطوير"],
    timeMatch: ["morning"],
    reason: "١٪ تحسن يومياً = ٣٧ ضعفاً في سنة — العلم الحقيقي وراء بناء العادات الناجحة.",
    quote: "«التغيير الحقيقي يأتي من تغيير الهوية، لا السلوك.»",
  },
  {
    title: "قوة الآن", author: "إيكهارت تول",
    category: "تطوير ذات", subcategory: "وعي وتأمل", rating: "4.7/5", length: "قصير",
    atmosphere: "philosophical",
    weatherMatch: ["Clouds", "Rain", "Drizzle"],
    moodMatch: ["قلق", "حزين", "مشتت", "هادئ", "مرتبك"],
    timeMatch: ["morning", "evening"],
    reason: "تعلّم أن تعيش في اللحظة الحاضرة — الكتاب الذي يُهدئ العقل الصاخب.",
    quote: "«الوقت وهم. اللحظة الحاضرة هي كل ما لديك دائماً.»",
  },
  {
    title: "التفكير بسرعة وببطء", author: "دانيال كانيمان",
    category: "تطوير ذات", subcategory: "علم القرار", rating: "4.8/5", length: "طويل",
    atmosphere: "science",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["فضولي", "تركيز", "علوم", "إنتاجية"],
    timeMatch: ["morning", "afternoon"],
    reason: "كيف يخدعنا عقلنا في كل قرار نتخذه — مزيج علمي وعملي مُذهل.",
    quote: "«ما تراه هو كل ما هو موجود — هذا هو الفخ الكبير للعقل.»",
  },
  {
    title: "فن اللامبالاة", author: "مارك مانسون",
    category: "تطوير ذات", subcategory: "فلسفة عملية", rating: "4.4/5", length: "قصير",
    atmosphere: "selfhelp",
    weatherMatch: ["Clouds", "Clear"],
    moodMatch: ["مشتت", "قلق", "مجهد", "خفيف"],
    timeMatch: ["afternoon", "morning"],
    reason: "حدد ما يستحق الاهتمام فعلاً في حياتك — أسلوب صريح وصادق بلا زيف.",
    quote: "«لا تأمل في حياة سهلة، بل ابحث عن قوة تتحمل حياة صعبة.»",
  },
  {
    title: "من أحرك قطعة الجبن؟", author: "سبنسر جونسون",
    category: "تطوير ذات", subcategory: "إدارة التغيير", rating: "4.3/5", length: "قصير",
    atmosphere: "selfhelp",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["مرتبك", "إجابات", "خفيف", "تطوير"],
    timeMatch: ["morning", "afternoon"],
    reason: "أسرع قراءة وأعمق رسالة — كيف تتكيف مع التغيير قبل أن يُطيح بك.",
    quote: "«التغيير يحدث. استعد للتغيير بسرعة.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  علم النفس                                      ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "لماذا ننام؟", author: "ماثيو ووكر",
    category: "علم نفس", subcategory: "علم أعصاب", rating: "4.7/5", length: "طويل",
    atmosphere: "science",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["فضولي", "علوم", "هادئ", "مجهد"],
    timeMatch: ["night", "evening"],
    reason: "النوم يؤثر على كل خلية في جسمك — ووكر يُقنعك بأن النوم هو أقوى دواء وُجد.",
    quote: "«النوم هو أعظم أداة شفاء اخترعتها الطبيعة.»",
  },
  {
    title: "تأثير الإيهام", author: "روبرت شيالديني",
    category: "علم نفس", subcategory: "علم الإقناع", rating: "4.7/5", length: "طويل",
    atmosphere: "science",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["فضولي", "إنتاجية", "أعمال"],
    timeMatch: ["morning", "afternoon"],
    reason: "ستة مبادئ يستخدمها من يقنعونك يومياً — اعرفها لتحمي نفسك وتستخدمها بحكمة.",
    quote: "«الأذكياء يستجيبون لأسباب جيدة، والعامة يستجيبون لسبب وجيه واحد يُقدَّم بالطريقة الصحيحة.»",
  },
  {
    title: "الإنسان يبحث عن معنى", author: "فيكتور فرانكل",
    category: "علم نفس", subcategory: "فلسفة ووجودية", rating: "4.9/5", length: "قصير",
    atmosphere: "philosophical",
    weatherMatch: ["Rain", "Clouds", "Snow"],
    moodMatch: ["حزين", "إلهام", "إجابات", "مرتبك"],
    timeMatch: ["evening", "night"],
    reason: "فرانكل نجا من معسكرات الاعتقال النازية وخرج بنظرية: المعنى هو ما يُبقيك حياً.",
    quote: "«من يملك سبباً للعيش يتحمل أي كيف.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  العلوم والتقنية                                ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "نظرية الكل", author: "ستيفن هوكينج",
    category: "علوم", subcategory: "فيزياء نظرية", rating: "4.6/5", length: "قصير",
    atmosphere: "science",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["فضولي", "علوم", "متحمس"],
    timeMatch: ["morning", "afternoon"],
    reason: "رحلة في الزمن والفضاء مع أعظم العقول — تُشعرك بعظمة الكون وضآلتنا الجميلة.",
    quote: "«نحن مجرد نوع متقدم من القرود على كوكب صغير لنجم متوسط — لكن يمكننا أن نفهم الكون.»",
  },
  {
    title: "الكون في قشرة جوز", author: "ستيفن هوكينج",
    category: "علوم", subcategory: "فيزياء", rating: "4.5/5", length: "قصير",
    atmosphere: "science",
    weatherMatch: ["Clear"],
    moodMatch: ["فضولي", "علوم"],
    timeMatch: ["night", "evening"],
    reason: "الكون من منظور هوكينج الموسوعي — عظمة العلم في لغة بسيطة رائعة.",
    quote: "«الكون لا يكترث بمشاعرك — هذا ما يجعله رائعاً.»",
  },
  {
    title: "المختصر المفيد في الدماغ", author: "ريتشارد ريستاك",
    category: "علوم", subcategory: "علم أعصاب", rating: "4.4/5", length: "قصير",
    atmosphere: "science",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["فضولي", "علوم", "تركيز"],
    timeMatch: ["morning"],
    reason: "كيف يعمل دماغك في كل لحظة من يومك — معرفة مذهلة بأسلوب سهل ممتع.",
    quote: "«الدماغ الذي يفهم نفسه يُبدع طرقاً جديدة لأن يكون أفضل.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  التاريخ والحضارات                              ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "قصة الحضارة", author: "ويل ديورانت",
    category: "تاريخ", subcategory: "تاريخ عام", rating: "4.9/5", length: "طويل",
    atmosphere: "history",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["تاريخ", "فضولي", "فلسفي"],
    timeMatch: ["afternoon", "evening"],
    reason: "الموسوعة التاريخية الشاملة — رحلة عبر آلاف السنين في حضن أعظم عقل موسوعي.",
    quote: "«الحضارة هي جهد متواصل لبناء مجتمع إنساني في مواجهة الطبيعة والزمن.»",
  },
  {
    title: "أعظم لحظات التاريخ", author: "ستيفان تسفايغ",
    category: "تاريخ", subcategory: "لحظات فارقة", rating: "4.7/5", length: "قصير",
    atmosphere: "history",
    weatherMatch: ["Clouds", "Thunderstorm"],
    moodMatch: ["تاريخ", "مغامرة", "إثارة"],
    timeMatch: ["evening"],
    reason: "لحظات غيّرت مسار البشرية في ساعات — تسفايغ يُحيي التاريخ بقلمه الشعري.",
    quote: "«اللحظة النادرة التي يقرر فيها التاريخ مصير الإنسانية في جلسة واحدة.»",
  },
  {
    title: "الحضارة الإسلامية", author: "آدم متز",
    category: "تاريخ", subcategory: "تاريخ إسلامي", rating: "4.8/5", length: "طويل",
    atmosphere: "history",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["تاريخ", "فضولي", "ديني"],
    timeMatch: ["morning", "afternoon"],
    cityBonus: ["مكة المكرمة", "المدينة المنورة"],
    reason: "العصر الذهبي الإسلامي في تفاصيل مذهلة — حين كانت بغداد عاصمة العالم.",
    quote: "«كانت بغداد عاصمة العالم في القرن العاشر بكل معنى الكلمة.»",
  },
  {
    title: "الإنسان العاقل: تاريخ موجز للبشرية", author: "يوفال نوح هراري",
    category: "تاريخ", subcategory: "تاريخ بشري", rating: "4.7/5", length: "طويل",
    atmosphere: "history",
    weatherMatch: ["Clouds", "Clear"],
    moodMatch: ["فضولي", "تاريخ", "فلسفي"],
    timeMatch: ["morning", "afternoon"],
    reason: "كيف أصبح الإنسان سيد الكوكب — هراري يُعيد كتابة التاريخ بمنظور جديد صادم.",
    quote: "«الأسطورة المشتركة هي ما جمع البشر وصنع الحضارات.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  الفلسفة                                        ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "تأملات", author: "ماركوس أوريليوس",
    category: "فلسفة", subcategory: "رواقية", rating: "4.9/5", length: "قصير",
    atmosphere: "philosophical",
    weatherMatch: ["Clouds", "Rain", "Drizzle"],
    moodMatch: ["فلسفي", "قلق", "هادئ", "إجابات"],
    timeMatch: ["morning", "evening"],
    reason: "يوميات إمبراطور روما الخاصة — حكمة رجل يحكم العالم ويُجاهد نفسه بالفلسفة.",
    quote: "«لا تضيع الوقت في التفكير فيما يتوقعه الآخرون منك.»",
  },
  {
    title: "الإنسان والدولة", author: "برتراند راسل",
    category: "فلسفة", subcategory: "فلسفة سياسية", rating: "4.6/5", length: "طويل",
    atmosphere: "philosophical",
    weatherMatch: ["Rain", "Clouds"],
    moodMatch: ["فلسفي", "فضولي", "إجابات"],
    timeMatch: ["evening", "night"],
    reason: "راسل يسأل الأسئلة الكبرى عن الحرية والمجتمع بذكاء ساخر نادر.",
    quote: "«العلم ما نعرفه، والفلسفة ما لا نعرفه بعد.»",
  },
  {
    title: "الإنسان في البحث عن المعنى", author: "فيكتور فرانكل",
    category: "فلسفة", subcategory: "فلسفة وجودية", rating: "4.9/5", length: "قصير",
    atmosphere: "philosophical",
    weatherMatch: ["Rain", "Clouds", "Snow"],
    moodMatch: ["حزين", "إلهام", "فلسفي", "إجابات"],
    timeMatch: ["evening", "night"],
    reason: "الكتاب الذي أنقذ عقول من الاستسلام — المعنى هو ما يبقيك قائماً في أشد اللحظات سواداً.",
    quote: "«من يملك سبباً للعيش يتحمل أي كيف.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  الكتب الدينية والإسلامية                       ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "الرحيق المختوم", author: "صفي الرحمن المباركفوري",
    category: "إسلامي", subcategory: "سيرة نبوية", rating: "4.9/5", length: "طويل",
    atmosphere: "spiritual",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["ديني", "إسلامي", "هادئ", "تاريخ"],
    timeMatch: ["morning", "evening"],
    cityBonus: ["مكة المكرمة", "المدينة المنورة"],
    reason: "أجمل وأشمل سيرة للنبي ﷺ — تملأ القلب إيماناً ومحبةً بكل سطر.",
    quote: "«كان أكثر الناس تبسماً، وأجملهم في الحديث.»",
  },
  {
    title: "إحياء علوم الدين", author: "أبو حامد الغزالي",
    category: "إسلامي", subcategory: "تزكية النفس", rating: "4.8/5", length: "طويل",
    atmosphere: "spiritual",
    weatherMatch: ["Rain", "Clouds", "Clear"],
    moodMatch: ["ديني", "إسلامي", "هادئ", "فلسفي"],
    timeMatch: ["morning", "evening", "night"],
    cityBonus: ["مكة المكرمة", "المدينة المنورة"],
    reason: "أعمق كتاب في تزكية النفس على مرّ العصور — الغزالي يُداوي الروح من أمراضها.",
    quote: "«من عرف نفسه فقد عرف ربه.»",
  },
  {
    title: "مدارج السالكين", author: "ابن القيم الجوزية",
    category: "إسلامي", subcategory: "سلوك روحي", rating: "4.9/5", length: "طويل",
    atmosphere: "spiritual",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["ديني", "إسلامي", "فلسفي"],
    timeMatch: ["evening", "night"],
    cityBonus: ["مكة المكرمة", "المدينة المنورة"],
    reason: "رحلة روحية في طريق العبودية لله — ابن القيم في أعمق وأجمل ما كتب.",
    quote: "«القلب في سيره إلى الله كالطائر؛ المحبة رأسه والخوف والرجاء جناحاه.»",
  },
  {
    title: "الفوائد", author: "ابن القيم الجوزية",
    category: "إسلامي", subcategory: "حكمة إسلامية", rating: "4.8/5", length: "قصير",
    atmosphere: "spiritual",
    weatherMatch: ["Clouds", "Rain", "Clear"],
    moodMatch: ["ديني", "إسلامي", "هادئ", "حزين"],
    timeMatch: ["morning", "evening"],
    reason: "دُرر ودقائق نادرة في التفكر والحكمة — كتاب يُفيدك جملة جملة.",
    quote: "«القلب الصحيح هو الذي يطمئن إلى الله وحده.»",
  },
  {
    title: "البداية والنهاية", author: "ابن كثير",
    category: "إسلامي", subcategory: "تاريخ إسلامي", rating: "4.8/5", length: "طويل",
    atmosphere: "spiritual",
    weatherMatch: ["Clouds", "Clear"],
    moodMatch: ["ديني", "تاريخ", "فضولي"],
    timeMatch: ["morning", "afternoon"],
    cityBonus: ["مكة المكرمة", "المدينة المنورة"],
    reason: "تاريخ الكون من الخلق حتى آخر الزمان — مرجع عظيم لا يُستغنى عنه.",
    quote: "«معرفة التاريخ بوابة معرفة سنن الله في خلقه.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  السير الذاتية والمذكرات                        ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "حياتي قصتي", author: "هيلين كيلر",
    category: "سيرة ذاتية", subcategory: "إلهام إنساني", rating: "4.7/5", length: "قصير",
    atmosphere: "selfhelp",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["حزين", "إلهام", "إجابات", "تحدي"],
    timeMatch: ["morning", "afternoon"],
    reason: "هيلين التي فقدت البصر والسمع وهي رضيعة ونالت شهادة الجامعة — أعظم قصة تحدٍّ في التاريخ.",
    quote: "«الحياة إما مغامرة شجاعة أو لا شيء.»",
  },
  {
    title: "يوميات الغرفة الصغيرة", author: "شينيتشي سوزوكي",
    category: "سيرة ذاتية", subcategory: "تأمل إبداعي", rating: "4.5/5", length: "قصير",
    atmosphere: "philosophical",
    weatherMatch: ["Rain", "Drizzle", "Clouds"],
    moodMatch: ["هادئ", "فضولي", "تأمل"],
    timeMatch: ["evening", "night"],
    reason: "تأملات موسيقار ياباني في أسرار التعلم والنمو — هدوء عميق في كل صفحة.",
    quote: "«الموهبة ليست هبة السماء — هي نتيجة عناية ومثابرة متواضعة.»",
  },
  {
    title: "الرجل الذي خلط الأوراق", author: "فرانك أبيغنيل",
    category: "سيرة ذاتية", subcategory: "قصة مثيرة", rating: "4.5/5", length: "قصير",
    atmosphere: "thriller",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["مغامرة", "إثارة", "ترفيه"],
    timeMatch: ["afternoon", "evening"],
    reason: "النصاب الأشهر في التاريخ يحكي قصته بنفسه — أكثر المذكرات إثارة وتشويقاً.",
    quote: "«أسهل شيء في العالم هو الكذب — الصعب هو أن تتذكر كذبتك.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  الأعمال والريادة                               ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "فكر وازدد ثراءً", author: "نابليون هيل",
    category: "أعمال", subcategory: "ثروة وعقلية", rating: "4.5/5", length: "طويل",
    atmosphere: "selfhelp",
    weatherMatch: ["Clear"],
    moodMatch: ["طموح", "إنتاجية", "أعمال", "تحدي"],
    timeMatch: ["morning"],
    reason: "الكتاب الذي ألّفه هيل بعد دراسة أنجح ٥٠٠ شخص في التاريخ — سر العقلية الثرية.",
    quote: "«أي شيء يستطيع العقل تصوره والإيمان به، يستطيع تحقيقه.»",
  },
  {
    title: "الشركات الناشئة الخالدة", author: "جيم كولينز",
    category: "أعمال", subcategory: "قيادة استراتيجية", rating: "4.6/5", length: "طويل",
    atmosphere: "selfhelp",
    weatherMatch: ["Clouds", "Clear"],
    moodMatch: ["أعمال", "طموح", "إنتاجية", "تطوير"],
    timeMatch: ["morning", "afternoon"],
    reason: "ما الذي يجعل بعض الشركات خالدة وأخرى تتفكك — درس استراتيجي نادر.",
    quote: "«الشركات العظيمة لا تبحث عن مجالات رائعة — تصنع ما تفعله رائعاً.»",
  },
  {
    title: "صفر إلى واحد", author: "بيتر ثيل",
    category: "أعمال", subcategory: "ريادة أعمال", rating: "4.5/5", length: "قصير",
    atmosphere: "selfhelp",
    weatherMatch: ["Clear"],
    moodMatch: ["أعمال", "طموح", "إنتاجية", "فضولي"],
    timeMatch: ["morning"],
    reason: "مؤسس PayPal يُعلمك كيف تبني شركة تخلق مستقبلاً بدلاً من نسخ الحاضر.",
    quote: "«كل شركة ناجحة تحل مشكلة مختلفة. الاحتكار سر النجاح.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  الشعر والأدب                                   ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "ديوان المتنبي", author: "المتنبي",
    category: "شعر", subcategory: "شعر عربي كلاسيكي", rating: "4.9/5", length: "طويل",
    atmosphere: "poetry",
    weatherMatch: ["Clear", "Thunderstorm"],
    moodMatch: ["متحمس", "طموح", "إنتاجية", "تحدي"],
    timeMatch: ["morning", "afternoon"],
    reason: "أمير شعراء العربية — كل قصيدة صرخة كبرياء وحكمة تزيدك شموخاً.",
    quote: "«أنا الذي نظر الأعمى إلى أدبي، وأسمعت كلماتي من به صمم.»",
  },
  {
    title: "على هذه الأرض ما يستحق الحياة", author: "محمود درويش",
    category: "شعر", subcategory: "شعر عربي حديث", rating: "4.9/5", length: "قصير",
    atmosphere: "poetry",
    weatherMatch: ["Rain", "Clouds", "Drizzle"],
    moodMatch: ["حزين", "إلهام", "رومانسي"],
    timeMatch: ["evening", "night"],
    reason: "درويش يحوّل الألم إلى أجمل لغة عربية — شعر يلمس ما لا تصله الكلمات العادية.",
    quote: "«على هذه الأرض ما يستحق الحياة: ردد في نيسان.»",
  },
  {
    title: "رباعيات الخيام", author: "عمر الخيام",
    category: "شعر", subcategory: "رباعيات فارسية", rating: "4.7/5", length: "قصير",
    atmosphere: "poetry",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["هادئ", "فلسفي", "رومانسي"],
    timeMatch: ["evening", "night"],
    reason: "فلسفة اللحظة الحاضرة في رباعيات مُذهلة — الخيام يُعلمك احتضان اليوم.",
    quote: "«لست أدري أيُّ يوم آتٍ، فاجعل كل يوم عيداً.»",
  },
  {
    title: "ديوان نزار قباني", author: "نزار قباني",
    category: "شعر", subcategory: "شعر عربي رومانسي", rating: "4.8/5", length: "طويل",
    atmosphere: "romance",
    weatherMatch: ["Clear", "Rain"],
    moodMatch: ["رومانسي", "عاطفي"],
    timeMatch: ["evening", "night"],
    reason: "الحب والمرأة والوطن بأجمل لغة — نزار الذي جعل الشعر يُقرأ في كل بيت عربي.",
    quote: "«لو كان الحب حرفاً، لكان عربياً.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  English Books                                   ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "The Alchemist", author: "Paulo Coelho",
    category: "روايات مغامرة", subcategory: "Journey & Self-discovery", rating: "4.8/5", length: "قصير",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Clear"],
    moodMatch: ["مغامرة", "طموح", "متحمس", "مرتبك"],
    timeMatch: ["morning", "afternoon"],
    ageGroups: ["young_adult", "adult"],
    seasonMatch: ["spring", "summer"],
    occasionMatch: ["world_book_day", "new_year"],
    reason: "Santiago's journey to find his treasure is a timeless reminder that the universe conspires in favor of those who follow their dreams.",
    quote: "«When you want something, all the universe conspires in helping you to achieve it.»",
  },
  {
    title: "1984", author: "George Orwell",
    category: "خيال علمي", subcategory: "Dystopian Fiction", rating: "4.8/5", length: "قصير",
    atmosphere: "scifi", language: "en",
    weatherMatch: ["Clouds", "Rain", "Thunderstorm"],
    moodMatch: ["فضولي", "مغامرة", "مرتبك", "فلسفي"],
    timeMatch: ["evening", "night"],
    ageGroups: ["young_adult", "adult"],
    seasonMatch: ["winter", "autumn"],
    reason: "A chilling portrait of a totalitarian world that makes you question freedom, truth, and the power of language.",
    quote: "«War is peace. Freedom is slavery. Ignorance is strength.»",
  },
  {
    title: "Dune", author: "Frank Herbert",
    category: "خيال علمي", subcategory: "Epic Sci-Fi", rating: "4.9/5", length: "طويل",
    atmosphere: "scifi", language: "en",
    weatherMatch: ["Clear", "Atmosphere"],
    moodMatch: ["مغامرة", "فضولي", "طموح"],
    timeMatch: ["afternoon", "evening"],
    ageGroups: ["young_adult", "adult"],
    seasonMatch: ["summer"],
    reason: "The greatest science fiction epic ever written — a saga of politics, religion, ecology, and human potential on a desert planet.",
    quote: "«I must not fear. Fear is the mind-killer.»",
  },
  {
    title: "Atomic Habits", author: "James Clear",
    category: "تطوير ذات", subcategory: "Productivity & Habits", rating: "4.9/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["طموح", "مليء بالطاقة", "متحمس", "مشتت"],
    timeMatch: ["morning", "afternoon"],
    ageGroups: ["young_adult", "adult", "senior"],
    seasonMatch: ["spring", "winter"],
    occasionMatch: ["new_year"],
    reason: "A practical, evidence-based system for building good habits and breaking bad ones — the 1% better every day philosophy.",
    quote: "«You do not rise to the level of your goals. You fall to the level of your systems.»",
  },
  {
    title: "Thinking, Fast and Slow", author: "Daniel Kahneman",
    category: "علم نفس", subcategory: "Behavioral Psychology", rating: "4.7/5", length: "طويل",
    atmosphere: "philosophical", language: "en",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["فضولي", "مرتبك", "مشتت", "فلسفي"],
    timeMatch: ["afternoon", "evening"],
    ageGroups: ["adult", "senior"],
    seasonMatch: ["autumn", "winter"],
    reason: "Nobel laureate Kahneman reveals the two systems that drive the way we think — a revolutionary guide to understanding your own mind.",
    quote: "«Nothing in life is as important as you think it is, while you are thinking about it.»",
  },
  {
    title: "Sapiens: A Brief History of Humankind", author: "Yuval Noah Harari",
    category: "تاريخ", subcategory: "Human History", rating: "4.8/5", length: "طويل",
    atmosphere: "history", language: "en",
    weatherMatch: ["Clouds", "Atmosphere"],
    moodMatch: ["فضولي", "طموح", "فلسفي"],
    timeMatch: ["afternoon", "evening"],
    ageGroups: ["young_adult", "adult", "senior"],
    seasonMatch: ["autumn", "winter"],
    reason: "A sweeping narrative of humankind from the Stone Age to the AI era — the most mind-expanding history book you'll ever read.",
    quote: "«We are the only animals that can cooperate with countless strangers who share our imagined realities.»",
  },
  {
    title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams",
    category: "خيال علمي", subcategory: "Comedic Sci-Fi", rating: "4.7/5", length: "قصير",
    atmosphere: "scifi", language: "en",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["متحمس", "مجهد", "خفيف", "يبحث عن الضحك"],
    timeMatch: ["morning", "afternoon"],
    ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["spring", "summer"],
    reason: "The answer to life, the universe, and everything is 42 — the funniest and most philosophical sci-fi ever written.",
    quote: "«Don't panic.»",
  },
  {
    title: "Pride and Prejudice", author: "Jane Austen",
    category: "روايات رومانسية", subcategory: "Classic Romance", rating: "4.8/5", length: "قصير",
    atmosphere: "romance", language: "en",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["رومانسي", "عاطفي", "كلاسيكي"],
    timeMatch: ["afternoon", "evening"],
    ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["spring"],
    occasionMatch: ["valentine"],
    reason: "The definitive romance novel — Darcy and Elizabeth's witty sparring is endlessly re-readable and surprisingly modern.",
    quote: "«It is a truth universally acknowledged…»",
  },
  {
    title: "Murder on the Orient Express", author: "Agatha Christie",
    category: "روايات بوليسية", subcategory: "Classic Mystery", rating: "4.7/5", length: "قصير",
    atmosphere: "mystery", language: "en",
    weatherMatch: ["Clouds", "Rain", "Snow", "Thunderstorm"],
    moodMatch: ["ألغاز", "إثارة", "متحمس"],
    timeMatch: ["evening", "night"],
    ageGroups: ["adult", "young_adult", "senior"],
    seasonMatch: ["autumn", "winter"],
    occasionMatch: ["halloween"],
    reason: "Hercule Poirot's most iconic case — twelve suspects, one dead man, and a train snowed in the mountains. Perfect armchair mystery.",
    quote: "«The impossible could not have happened, therefore the impossible must be possible in spite of appearances.»",
  },
  {
    title: "Harry Potter and the Philosopher's Stone", author: "J.K. Rowling",
    category: "خيال علمي", subcategory: "Fantasy / YA", rating: "4.9/5", length: "قصير",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["مغامرة", "متحمس", "خفيف"],
    timeMatch: ["morning", "afternoon"],
    ageGroups: ["children", "teen", "young_adult"],
    seasonMatch: ["autumn"],
    occasionMatch: ["halloween"],
    reason: "The book that made a generation of readers — magic, friendship, and the courage to face the darkness within and without.",
    quote: "«It does not do to dwell on dreams and forget to live.»",
  },
  {
    title: "The Little Prince", author: "Antoine de Saint-Exupéry",
    category: "روايات كلاسيكية", subcategory: "Philosophical Fable", rating: "4.9/5", length: "قصير",
    atmosphere: "philosophical", language: "en",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["حزين", "رومانسي", "فلسفي", "طفولي"],
    timeMatch: ["morning", "evening"],
    ageGroups: ["children", "teen", "young_adult", "adult", "senior"],
    seasonMatch: ["spring", "summer"],
    occasionMatch: ["world_book_day", "mothers_day"],
    reason: "The most widely translated book in the world after the Bible — a poem in prose about love, loss, and what matters most.",
    quote: "«It is only with the heart that one can see rightly; what is essential is invisible to the eye.»",
  },
  {
    title: "The Power of Now", author: "Eckhart Tolle",
    category: "تطوير ذات", subcategory: "Mindfulness & Spirituality", rating: "4.7/5", length: "قصير",
    atmosphere: "spiritual", language: "en",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["حزين", "مجهد", "مشتت", "هادئ"],
    timeMatch: ["morning", "evening", "night"],
    ageGroups: ["young_adult", "adult", "senior"],
    seasonMatch: ["autumn", "winter"],
    occasionMatch: ["ramadan"],
    reason: "A guide to spiritual enlightenment through the practice of present-moment awareness — transformative for the restless mind.",
    quote: "«Realize deeply that the present moment is all you ever have.»",
  },
  {
    title: "Man's Search for Meaning", author: "Viktor E. Frankl",
    category: "تطوير ذات", subcategory: "Existential Psychology", rating: "4.9/5", length: "قصير",
    atmosphere: "philosophical", language: "en",
    weatherMatch: ["Rain", "Thunderstorm", "Clouds"],
    moodMatch: ["حزين", "مرتبك", "مغامرة", "طموح"],
    timeMatch: ["evening", "night"],
    ageGroups: ["young_adult", "adult", "senior"],
    seasonMatch: ["winter", "autumn"],
    occasionMatch: ["ramadan"],
    reason: "From the Holocaust's darkest depths, Frankl emerged with a philosophy of meaning that has helped millions find purpose.",
    quote: "«Everything can be taken from a man but one thing: the last of the human freedoms — to choose one's attitude in any given set of circumstances.»",
  },
  {
    title: "Good to Great", author: "Jim Collins",
    category: "أعمال", subcategory: "Business Strategy", rating: "4.7/5", length: "طويل",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear"],
    moodMatch: ["طموح", "مليء بالطاقة", "متحمس"],
    timeMatch: ["morning", "afternoon"],
    ageGroups: ["adult"],
    seasonMatch: ["spring"],
    reason: "What separates a good company from a great one? 5 years of research distilled into timeless leadership and business principles.",
    quote: "«Good is the enemy of great.»",
  },
  {
    title: "The Hunger Games", author: "Suzanne Collins",
    category: "روايات إثارة", subcategory: "YA Dystopian", rating: "4.7/5", length: "قصير",
    atmosphere: "thriller", language: "en",
    weatherMatch: ["Clouds", "Thunderstorm"],
    moodMatch: ["مغامرة", "إثارة", "متحمس"],
    timeMatch: ["afternoon", "evening"],
    ageGroups: ["teen", "young_adult"],
    seasonMatch: ["summer"],
    reason: "A pulse-pounding dystopian thriller about survival, media manipulation, and the courage to resist oppression.",
    quote: "«May the odds be ever in your favor.»",
  },

  // ── More English Books ────────────────────────────────────────────────────────
  {
    title: "To Kill a Mockingbird", author: "Harper Lee",
    category: "روايات كلاسيكية", subcategory: "American Classic", rating: "4.9/5", length: "قصير",
    atmosphere: "classic", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["فضولي", "هادئ", "فلسفي"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["summer"], monthMatch: [6, 7, 8],
    reason: "Atticus Finch's defense of an innocent Black man in the Deep South — a landmark of moral literature and human dignity.",
    quote: "«You never really understand a person until you consider things from his point of view.»",
  },
  {
    title: "The Great Gatsby", author: "F. Scott Fitzgerald",
    category: "روايات كلاسيكية", subcategory: "American Dream", rating: "4.5/5", length: "قصير",
    atmosphere: "classic", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["رومانسي", "حزين", "فلسفي"],
    timeMatch: ["evening", "night"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["summer"], monthMatch: [6, 7, 8],
    reason: "The quintessential American novel — Gatsby's green light, Daisy's voice, and the relentless pursuit of an impossible dream.",
    quote: "«So we beat on, boats against the current, borne back ceaselessly into the past.»",
  },
  {
    title: "The Lord of the Rings", author: "J.R.R. Tolkien",
    category: "خيال علمي", subcategory: "High Fantasy", rating: "4.9/5", length: "طويل",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Clouds", "Rain", "Snow"], moodMatch: ["مغامرة", "متحمس", "هادئ"],
    timeMatch: ["afternoon", "evening", "night"], ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9, 10, 11, 12, 1],
    reason: "The foundational epic of modern fantasy — a journey across a living world where courage and friendship overcome the darkest of powers.",
    quote: "«Not all those who wander are lost.»",
  },
  {
    title: "Life of Pi", author: "Yann Martel",
    category: "روايات مغامرة", subcategory: "Survival & Faith", rating: "4.7/5", length: "قصير",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Clear", "Rain", "Thunderstorm"], moodMatch: ["فضولي", "مغامرة", "روحاني"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["summer"], monthMatch: [6, 7, 8],
    reason: "A boy, a Bengal tiger, and 227 days adrift in the Pacific Ocean — a story that will make you believe in God, or at least in storytelling.",
    quote: "«I suppose in the end, the whole of life becomes an act of letting go.»",
  },
  {
    title: "Into the Wild", author: "Jon Krakauer",
    category: "سيرة ذاتية", subcategory: "Adventure Non-Fiction", rating: "4.6/5", length: "قصير",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["مغامرة", "طموح", "مرتبك"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["summer", "spring"], monthMatch: [5, 6, 7, 8],
    reason: "The true story of Christopher McCandless who gave everything away to live alone in the Alaskan wilderness — a meditation on freedom and its costs.",
    quote: "«Happiness is only real when shared.»",
  },
  {
    title: "Wild", author: "Cheryl Strayed",
    category: "سيرة ذاتية", subcategory: "Memoir / Hiking", rating: "4.6/5", length: "قصير",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["مغامرة", "حزين", "متحمس"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["summer"], monthMatch: [6, 7, 8],
    reason: "After losing her mother and her marriage, Strayed hikes 1,100 miles alone — a raw, triumphant memoir about finding yourself by getting lost.",
    quote: "«I didn't get to be the woman I wanted to be. I was the woman I'd become.»",
  },
  {
    title: "Gone Girl", author: "Gillian Flynn",
    category: "روايات بوليسية", subcategory: "Psychological Thriller", rating: "4.5/5", length: "طويل",
    atmosphere: "thriller", language: "en",
    weatherMatch: ["Clouds", "Rain", "Thunderstorm"], moodMatch: ["إثارة", "غموض", "مرتبك"],
    timeMatch: ["evening", "night"], ageGroups: ["adult"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9, 10, 11],
    reason: "Nick's wife vanishes on their anniversary — whose version of events do you believe? Flynn's unreliable narrators will keep you guessing all night.",
    quote: "«We are the most polished liars, my wife and I.»",
  },
  {
    title: "Big Little Lies", author: "Liane Moriarty",
    category: "روايات بوليسية", subcategory: "Domestic Noir", rating: "4.6/5", length: "طويل",
    atmosphere: "thriller", language: "en",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["إثارة", "اجتماعي", "متحمس"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["adult"],
    seasonMatch: ["autumn", "summer"], monthMatch: [6, 7, 8, 9],
    reason: "Three mothers, one school, and a murder at trivia night. Moriarty's sharp wit and warm characters make this impossible to put down.",
    quote: "«Sometimes it's the small lies that end up being the biggest ones.»",
  },
  {
    title: "The Girl with the Dragon Tattoo", author: "Stieg Larsson",
    category: "روايات إثارة", subcategory: "Scandinavian Crime", rating: "4.7/5", length: "طويل",
    atmosphere: "thriller", language: "en",
    weatherMatch: ["Clouds", "Snow", "Rain"], moodMatch: ["إثارة", "غموض", "مغامرة"],
    timeMatch: ["afternoon", "evening", "night"], ageGroups: ["adult"],
    seasonMatch: ["winter", "autumn"], monthMatch: [10, 11, 12, 1, 2],
    reason: "Lisbeth Salander is one of fiction's most unforgettable protagonists — a hacker vigilante helping solve a 40-year-old disappearance.",
    quote: "«A good liar needs a good memory.»",
  },
  {
    title: "Normal People", author: "Sally Rooney",
    category: "روايات رومانسية", subcategory: "Contemporary Romance", rating: "4.4/5", length: "قصير",
    atmosphere: "romance", language: "en",
    weatherMatch: ["Clear", "Clouds", "Rain"], moodMatch: ["رومانسي", "حزين", "عاطفي"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["summer", "spring"], monthMatch: [5, 6, 7, 8],
    reason: "Connell and Marianne's intimate, honest love story across years and continents — Rooney captures the complexity of young love with piercing clarity.",
    quote: "«She had always thought of herself as an independent person but somehow everything with Connell was different.»",
  },
  {
    title: "Me Before You", author: "Jojo Moyes",
    category: "روايات رومانسية", subcategory: "Emotional Drama", rating: "4.6/5", length: "قصير",
    atmosphere: "romance", language: "en",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["رومانسي", "حزين", "عاطفي"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["summer", "spring"], monthMatch: [4, 5, 6, 7, 8],
    occasionMatch: ["valentine"],
    reason: "A love story that breaks your heart and mends it — Louisa Clark and Will Traynor teach each other to really live.",
    quote: "«Push yourself. Don't settle. Just live well. Just live.»",
  },
  {
    title: "The Notebook", author: "Nicholas Sparks",
    category: "روايات رومانسية", subcategory: "Romantic Drama", rating: "4.5/5", length: "قصير",
    atmosphere: "romance", language: "en",
    weatherMatch: ["Clear", "Rain"], moodMatch: ["رومانسي", "عاطفي", "حزين"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["summer"], monthMatch: [6, 7, 8],
    occasionMatch: ["valentine"],
    reason: "An old man reads to a woman with Alzheimer's the story of their love — Sparks at his most tender and heartbreaking.",
    quote: "«I am nothing special; just a common man with common thoughts. There are no monuments dedicated to me.»",
  },
  {
    title: "Educated", author: "Tara Westover",
    category: "سيرة ذاتية", subcategory: "Memoir", rating: "4.8/5", length: "قصير",
    atmosphere: "history", language: "en",
    weatherMatch: ["Clouds", "Snow"], moodMatch: ["فضولي", "طموح", "مرتبك"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9, 10, 11],
    reason: "Born to survivalists in the Idaho mountains, Westover never attended school — yet she earned a PhD from Cambridge. An astonishing story of self-invention.",
    quote: "«You could call it a paradox, but really it's just life.»",
  },
  {
    title: "Steve Jobs", author: "Walter Isaacson",
    category: "سيرة ذاتية", subcategory: "Biography", rating: "4.7/5", length: "طويل",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["طموح", "فضولي", "مليء بالطاقة"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["spring", "summer"], monthMatch: [3, 4, 8, 9],
    reason: "The full story of the man who put a dent in the universe — his obsessive perfectionism, his cruelty, and his genius that changed everything.",
    quote: "«The people who are crazy enough to think they can change the world are the ones who do.»",
  },
  {
    title: "How to Win Friends and Influence People", author: "Dale Carnegie",
    category: "تطوير ذات", subcategory: "Social Skills", rating: "4.7/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear"], moodMatch: ["طموح", "مليء بالطاقة", "اجتماعي"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["spring", "summer"], monthMatch: [1, 2, 3, 8, 9],
    reason: "The best-selling self-improvement book of all time — timeless principles for making people like you, winning them to your way of thinking.",
    quote: "«You can make more friends in two months by becoming interested in other people than you can in two years by trying to get people interested in you.»",
  },
  {
    title: "The 7 Habits of Highly Effective People", author: "Stephen R. Covey",
    category: "تطوير ذات", subcategory: "Leadership & Productivity", rating: "4.8/5", length: "طويل",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["طموح", "متحمس", "مليء بالطاقة"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["adult"],
    seasonMatch: ["spring", "winter"], monthMatch: [1, 2, 9],
    occasionMatch: ["new_year"],
    reason: "Seven principles that align character and competence — the most influential business book of the 20th century, still transforming lives today.",
    quote: "«Begin with the end in mind.»",
  },
  {
    title: "Rich Dad Poor Dad", author: "Robert Kiyosaki",
    category: "أعمال", subcategory: "Personal Finance", rating: "4.6/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["طموح", "مليء بالطاقة", "مشتت"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["spring"], monthMatch: [1, 2, 3, 9],
    occasionMatch: ["new_year"],
    reason: "The book that taught millions that the rich don't work for money — they make money work for them. A paradigm shift in financial thinking.",
    quote: "«The poor and the middle class work for money. The rich have money work for them.»",
  },
  {
    title: "Zero to One", author: "Peter Thiel",
    category: "أعمال", subcategory: "Entrepreneurship", rating: "4.6/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear"], moodMatch: ["طموح", "فضولي", "مليء بالطاقة"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["spring", "summer"], monthMatch: [3, 4, 8, 9],
    reason: "PayPal co-founder Thiel argues that true innovation creates something new, not just better — the ultimate contrarian guide to startups.",
    quote: "«Every moment in business happens only once. The next Bill Gates will not build an operating system.»",
  },
  {
    title: "Deep Work", author: "Cal Newport",
    category: "تطوير ذات", subcategory: "Productivity & Focus", rating: "4.7/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["طموح", "مشتت", "مليء بالطاقة"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["winter", "autumn"], monthMatch: [9, 10, 11, 1],
    reason: "In a distracted world, the ability to focus deeply is the superpower of the 21st century. Newport shows you how to cultivate it.",
    quote: "«Clarity about what matters provides clarity about what does not.»",
  },
  {
    title: "Meditations", author: "Marcus Aurelius",
    category: "فلسفة", subcategory: "Stoic Philosophy", rating: "4.8/5", length: "قصير",
    atmosphere: "philosophical", language: "en",
    weatherMatch: ["Clouds", "Rain", "Clear"], moodMatch: ["فلسفي", "هادئ", "مرتبك", "حزين"],
    timeMatch: ["morning", "evening", "night"], ageGroups: ["adult", "senior"],
    seasonMatch: ["winter", "autumn"], monthMatch: [9, 10, 11, 12, 1],
    reason: "The private journal of a Roman Emperor — 2,000 years old and still the most practical guide to living with clarity, courage, and calm.",
    quote: "«You have power over your mind, not outside events. Realize this, and you will find strength.»",
  },
  {
    title: "The Subtle Art of Not Giving a F*ck", author: "Mark Manson",
    category: "تطوير ذات", subcategory: "Radical Self-Help", rating: "4.5/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["مجهد", "مرتبك", "مشتت"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9, 10, 11],
    reason: "A counterintuitive approach to living a good life — Manson argues that embracing life's problems, not avoiding them, is the key to happiness.",
    quote: "«The desire for more positive experience is itself a negative experience.»",
  },
  {
    title: "Guns, Germs, and Steel", author: "Jared Diamond",
    category: "تاريخ", subcategory: "World History", rating: "4.6/5", length: "طويل",
    atmosphere: "history", language: "en",
    weatherMatch: ["Clouds", "Atmosphere"], moodMatch: ["فضولي", "فلسفي"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["adult", "senior"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9, 10, 11, 12],
    reason: "Why did some civilizations conquer others? Diamond's Pulitzer-winning answer reshapes how we understand human history.",
    quote: "«History followed different courses for different peoples because of differences among peoples' environments.»",
  },
  {
    title: "A Brief History of Time", author: "Stephen Hawking",
    category: "علوم", subcategory: "Cosmology & Physics", rating: "4.7/5", length: "قصير",
    atmosphere: "science", language: "en",
    weatherMatch: ["Clear"], moodMatch: ["فضولي", "فلسفي"],
    timeMatch: ["evening", "night"], ageGroups: ["teen", "young_adult", "adult", "senior"],
    seasonMatch: ["summer", "spring"], monthMatch: [6, 7, 8],
    reason: "Hawking makes black holes, the Big Bang, and the nature of time accessible to everyone — a reminder of how wondrous our universe is.",
    quote: "«However difficult life may seem, there is always something you can do and succeed at.»",
  },
  {
    title: "Milk and Honey", author: "Rupi Kaur",
    category: "شعر", subcategory: "Contemporary Poetry", rating: "4.4/5", length: "قصير",
    atmosphere: "poetry", language: "en",
    weatherMatch: ["Rain", "Clouds"], moodMatch: ["حزين", "رومانسي", "عاطفي"],
    timeMatch: ["evening", "night"], ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["spring", "autumn"], monthMatch: [3, 4, 9, 10],
    reason: "Raw, minimalist poems about love, loss, trauma, and healing — Kaur's voice resonates with a generation finding language for their pain.",
    quote: "«You tell me to quiet down cause my opinions make me less beautiful but I was not made with a quiet mouth.»",
  },
  {
    title: "Ender's Game", author: "Orson Scott Card",
    category: "خيال علمي", subcategory: "Military Sci-Fi", rating: "4.8/5", length: "قصير",
    atmosphere: "scifi", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["مغامرة", "فضولي", "متحمس"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["summer", "autumn"], monthMatch: [7, 8, 9, 10],
    reason: "Gifted children trained to save humanity from alien invasion — a gripping exploration of leadership, loneliness, and the morality of war.",
    quote: "«In the moment when I truly understand my enemy, understand him well enough to defeat him, then in that very moment I also love him.»",
  },
  {
    title: "Rebecca", author: "Daphne du Maurier",
    category: "روايات بوليسية", subcategory: "Gothic Mystery", rating: "4.7/5", length: "قصير",
    atmosphere: "mystery", language: "en",
    weatherMatch: ["Clouds", "Rain", "Thunderstorm"], moodMatch: ["غموض", "حزين", "مرتبك"],
    timeMatch: ["evening", "night"], ageGroups: ["adult", "senior"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9, 10, 11, 12],
    reason: "Last night I dreamt I went to Manderley again… The greatest Gothic romance ever written — beautiful, sinister, and utterly gripping.",
    quote: "«Last night I dreamt I went to Manderley again.»",
  },
  {
    title: "And Then There Were None", author: "Agatha Christie",
    category: "روايات بوليسية", subcategory: "Classic Thriller", rating: "4.8/5", length: "قصير",
    atmosphere: "thriller", language: "en",
    weatherMatch: ["Clouds", "Rain", "Thunderstorm"], moodMatch: ["إثارة", "غموض", "متحمس"],
    timeMatch: ["evening", "night"], ageGroups: ["young_adult", "adult", "senior"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9, 10, 11, 12],
    occasionMatch: ["halloween"],
    reason: "Ten strangers, an island, and a nursery rhyme — the best-selling mystery novel of all time. You will not guess the killer.",
    quote: "«Ten little Indians, going out to dine…»",
  },
  {
    title: "The Kite Runner", author: "Khaled Hosseini",
    category: "روايات عائلية", subcategory: "Friendship & Redemption", rating: "4.8/5", length: "طويل",
    atmosphere: "family", language: "en",
    weatherMatch: ["Clouds", "Clear"], moodMatch: ["حزين", "رومانسي", "اجتماعي", "فلسفي"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["spring", "autumn"], monthMatch: [4, 5, 9, 10],
    reason: "A boy betrays his best friend in Kabul, and spends his life seeking redemption — Hosseini's debut remains one of the most affecting novels ever written.",
    quote: "«For you, a thousand times over.»",
  },
  {
    title: "Beloved", author: "Toni Morrison",
    category: "روايات كلاسيكية", subcategory: "American Literature", rating: "4.7/5", length: "طويل",
    atmosphere: "classic", language: "en",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["حزين", "فلسفي", "مرتبك"],
    timeMatch: ["evening", "night"], ageGroups: ["adult", "senior"],
    seasonMatch: ["autumn", "winter"], monthMatch: [10, 11, 12],
    reason: "Morrison's Pulitzer-winning masterpiece about the legacy of slavery — haunting, beautiful, and devastating in equal measure.",
    quote: "«124 was spiteful. Full of a baby's venom.»",
  },
  {
    title: "The Alchemist Code: Foundation", author: "Isaac Asimov",
    category: "خيال علمي", subcategory: "Space Opera", rating: "4.8/5", length: "طويل",
    atmosphere: "scifi", language: "en",
    weatherMatch: ["Clear", "Atmosphere"], moodMatch: ["فضولي", "مغامرة", "طموح"],
    timeMatch: ["afternoon", "evening", "night"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["summer", "autumn"], monthMatch: [7, 8, 9, 10],
    reason: "Asimov's galactic saga about saving civilization through the science of psychohistory — the most ambitious science fiction series ever conceived.",
    quote: "«Violence is the last refuge of the incompetent.»",
  },
  {
    title: "The Power of Habit", author: "Charles Duhigg",
    category: "علم نفس", subcategory: "Behavioral Science", rating: "4.6/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["طموح", "مشتت", "مليء بالطاقة"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["spring", "winter"], monthMatch: [1, 2, 3, 9],
    occasionMatch: ["new_year"],
    reason: "The science of habit formation — cue, routine, reward. Duhigg shows how to reshape the neurological loops that govern our behaviour.",
    quote: "«Change might not be fast and it isn't always easy. But with time and effort, almost any habit can be reshaped.»",
  },
  {
    title: "Ikigai", author: "Héctor García & Francesc Miralles",
    category: "تطوير ذات", subcategory: "Purpose & Longevity", rating: "4.5/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["هادئ", "فضولي", "طموح"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["young_adult", "adult", "senior"],
    seasonMatch: ["spring", "summer"], monthMatch: [3, 4, 5, 6, 7, 8],
    reason: "The Japanese secret to a long and happy life — finding the intersection of what you love, what you're good at, and what the world needs.",
    quote: "«Our ikigai is different for all of us, but one thing we have in common is that we are all searching for meaning.»",
  },
  {
    title: "The Old Man and the Sea", author: "Ernest Hemingway",
    category: "روايات كلاسيكية", subcategory: "Minimalist Classic", rating: "4.6/5", length: "قصير",
    atmosphere: "classic", language: "en",
    weatherMatch: ["Clear", "Thunderstorm"], moodMatch: ["هادئ", "فلسفي", "مغامرة"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["adult", "senior"],
    seasonMatch: ["summer"], monthMatch: [6, 7, 8],
    reason: "An old Cuban fisherman battles a giant marlin alone in the Gulf Stream — Hemingway's Pulitzer-winning meditation on perseverance and dignity.",
    quote: "«A man can be destroyed but not defeated.»",
  },
  {
    title: "The Diary of a Young Girl", author: "Anne Frank",
    category: "سيرة ذاتية", subcategory: "Historical Memoir", rating: "4.9/5", length: "قصير",
    atmosphere: "history", language: "en",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["حزين", "فلسفي", "طموح"],
    timeMatch: ["evening", "night"], ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["autumn", "winter"], monthMatch: [10, 11, 12],
    reason: "A teenage girl's journal written in hiding from the Nazis — the most widely read firsthand account of the Holocaust and a testament to the human spirit.",
    quote: "«Despite everything, I believe that people are really good at heart.»",
  },
  {
    title: "Norwegian Wood", author: "Haruki Murakami",
    category: "روايات رومانسية", subcategory: "Literary Fiction", rating: "4.7/5", length: "قصير",
    atmosphere: "romance", language: "en",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["حزين", "رومانسي", "هادئ"],
    timeMatch: ["evening", "night"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["autumn"], monthMatch: [9, 10, 11],
    reason: "Toru's haunting memory of lost love in 1960s Tokyo — Murakami's most emotionally direct novel, soaked in longing and jazz and loneliness.",
    quote: "«If you only read the books that everyone else is reading, you can only think what everyone else is thinking.»",
  },
  {
    title: "The Secret", author: "Rhonda Byrne",
    category: "تطوير ذات", subcategory: "Law of Attraction", rating: "4.2/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear"], moodMatch: ["طموح", "متحمس", "مليء بالطاقة"],
    timeMatch: ["morning"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["spring", "summer"], monthMatch: [3, 4, 7, 8],
    reason: "The law of attraction explained — how positive thinking, visualisation, and gratitude can attract the life you desire.",
    quote: "«Your thoughts become things.»",
  },
  {
    title: "The Fault in Our Stars", author: "John Green",
    category: "روايات رومانسية", subcategory: "YA Romance", rating: "4.7/5", length: "قصير",
    atmosphere: "romance", language: "en",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["رومانسي", "حزين", "عاطفي"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["teen", "young_adult"],
    seasonMatch: ["spring", "summer"], monthMatch: [5, 6, 7, 8],
    reason: "Two teenagers with cancer fall in love and travel to Amsterdam — Green's meditation on mortality, love, and leaving a mark on the world.",
    quote: "«Okay? Okay.»",
  },
  {
    title: "Brave New World", author: "Aldous Huxley",
    category: "خيال علمي", subcategory: "Dystopian Classic", rating: "4.6/5", length: "قصير",
    atmosphere: "scifi", language: "en",
    weatherMatch: ["Clear", "Atmosphere"], moodMatch: ["فضولي", "فلسفي", "مغامرة"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["summer", "autumn"], monthMatch: [7, 8, 9, 10],
    reason: "A world of engineered happiness, promiscuity, and soma — Huxley's dystopia may be more prescient than Orwell's. Disturbing and brilliant.",
    quote: "«Everyone belongs to everyone else.»",
  },
  {
    title: "Born a Crime", author: "Trevor Noah",
    category: "سيرة ذاتية", subcategory: "Memoir / Comedy", rating: "4.9/5", length: "قصير",
    atmosphere: "family", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["خفيف", "اجتماعي", "فضولي", "متحمس"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["young_adult", "adult"],
    seasonMatch: ["summer", "spring"], monthMatch: [4, 5, 6, 7, 8],
    reason: "Growing up mixed-race under apartheid in South Africa — Noah tells his incredible, funny, heartbreaking story with warmth and sharp wit.",
    quote: "«The racist wanted to separate the races, so my existence was a crime.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  French Books                                    ║
  // ╚══════════════════════════════════════════════════╝
  {
    title: "Les Misérables", author: "Victor Hugo",
    category: "روايات كلاسيكية", subcategory: "Roman historique & social", rating: "4.9/5", length: "طويل",
    atmosphere: "classic", language: "fr",
    weatherMatch: ["Rain", "Clouds"],
    moodMatch: ["حزين", "إلهام", "فلسفي", "تاريخي"],
    timeMatch: ["evening", "night"],
    ageGroups: ["young_adult", "adult", "senior"],
    seasonMatch: ["winter", "autumn"],
    reason: "L'épopée de Jean Valjean — une fresque monumentale sur la justice, la grâce et la rédemption dans la France du XIXe siècle.",
    quote: "«Aimer, c'est agir.»",
  },
  {
    title: "Le Petit Prince", author: "Antoine de Saint-Exupéry",
    category: "روايات كلاسيكية", subcategory: "Conte philosophique", rating: "4.9/5", length: "قصير",
    atmosphere: "philosophical", language: "fr",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["حزين", "رومانسي", "فلسفي"],
    timeMatch: ["morning", "evening"],
    ageGroups: ["children", "teen", "young_adult", "adult", "senior"],
    seasonMatch: ["spring", "summer"],
    occasionMatch: ["world_book_day", "mothers_day"],
    reason: "Le livre le plus traduit au monde après la Bible — une poésie en prose sur l'amour, la perte et ce qui compte vraiment.",
    quote: "«On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.»",
  },
  {
    title: "L'Étranger", author: "Albert Camus",
    category: "فلسفة", subcategory: "Roman existentialiste", rating: "4.7/5", length: "قصير",
    atmosphere: "philosophical", language: "fr",
    weatherMatch: ["Clear", "Atmosphere"],
    moodMatch: ["فلسفي", "مرتبك", "هادئ"],
    timeMatch: ["afternoon", "evening"],
    ageGroups: ["young_adult", "adult"],
    seasonMatch: ["summer"],
    reason: "Meursault et son absurde impassibilité face au monde — le chef-d'œuvre de Camus qui interroge le sens de l'existence.",
    quote: "«Aujourd'hui, maman est morte.»",
  },
  {
    title: "Les Trois Mousquetaires", author: "Alexandre Dumas",
    category: "روايات مغامرة", subcategory: "Aventure historique", rating: "4.8/5", length: "طويل",
    atmosphere: "adventure", language: "fr",
    weatherMatch: ["Clear", "Clouds"],
    moodMatch: ["مغامرة", "متحمس", "تاريخي"],
    timeMatch: ["morning", "afternoon"],
    ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["spring", "summer"],
    reason: "Athos, Porthos, Aramis et d'Artagnan — la plus grande aventure de cape et d'épée jamais écrite.",
    quote: "«Tous pour un, un pour tous.»",
  },
  {
    title: "Candide", author: "Voltaire",
    category: "فلسفة", subcategory: "Conte philosophique satirique", rating: "4.6/5", length: "قصير",
    atmosphere: "philosophical", language: "fr",
    weatherMatch: ["Clouds", "Rain"],
    moodMatch: ["فلسفي", "فضولي", "هادئ"],
    timeMatch: ["afternoon", "evening"],
    ageGroups: ["young_adult", "adult", "senior"],
    seasonMatch: ["autumn", "winter"],
    reason: "La satire la plus mordante des Lumières — Voltaire démonte l'optimisme naïf à travers les aventures rocambolesques de Candide.",
    quote: "«Il faut cultiver notre jardin.»",
  },
  {
    title: "Le Mystère de la chambre jaune", author: "Gaston Leroux",
    category: "روايات بوليسية", subcategory: "Mystère classique", rating: "4.6/5", length: "قصير",
    atmosphere: "mystery", language: "fr",
    weatherMatch: ["Rain", "Clouds", "Thunderstorm"], moodMatch: ["غموض", "إثارة", "ألغاز"],
    timeMatch: ["evening", "night"], ageGroups: ["young_adult", "adult", "senior"],
    seasonMatch: ["autumn", "winter"],
    reason: "Une agression dans une chambre close à clé : Rouletabille doit résoudre l'impossible par la logique et l'observation.",
    quote: "«Le bon bout de la raison est parfois caché dans le détail le plus étrange.»",
  },
  {
    title: "Le Fantôme de l'Opéra", author: "Gaston Leroux",
    category: "روايات إثارة", subcategory: "Mystère gothique", rating: "4.7/5", length: "متوسط",
    atmosphere: "thriller", language: "fr",
    weatherMatch: ["Rain", "Clouds", "Thunderstorm"], moodMatch: ["غموض", "إثارة", "خائف"],
    timeMatch: ["evening", "night"], ageGroups: ["young_adult", "adult", "senior"],
    seasonMatch: ["autumn", "winter"], occasionMatch: ["halloween"],
    reason: "Dans les souterrains de l'Opéra de Paris, un amour obsessionnel et un fantôme entretiennent une atmosphère sombre et inquiétante.",
    quote: "«Les ombres de l'Opéra savent mieux que personne garder un secret.»",
  },
  {
    title: "Arsène Lupin, gentleman-cambrioleur", author: "Maurice Leblanc",
    category: "روايات بوليسية", subcategory: "Enquêtes et cambriolages", rating: "4.6/5", length: "قصير",
    atmosphere: "mystery", language: "fr",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["غموض", "إثارة", "مغامرة"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["autumn", "winter"],
    reason: "Le gentleman cambrioleur transforme chaque vol en énigme élégante, pleine de ruses, de poursuites et de retournements.",
    quote: "«La meilleure serrure est celle que l'on ne pense pas à regarder.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  Children's Books — AR / EN / FR                 ║
  // ╚══════════════════════════════════════════════════╝

  // ── Arabic Children's ─────────────────────────────────────────────────────
  {
    title: "كليلة ودمنة", author: "ابن المقفع",
    category: "أطفال", subcategory: "قصص حيوانات وحكم", rating: "4.9/5", length: "قصير",
    atmosphere: "adventure", language: "ar",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["فضولي", "خفيف", "اجتماعي", "هادئ"],
    timeMatch: ["morning", "afternoon", "evening"], ageGroups: ["children", "teen", "young_adult", "adult", "senior"],
    seasonMatch: ["spring", "summer", "autumn", "winter"], monthMatch: [1,2,3,4,5,6,7,8,9,10,11,12],
    reason: "كنز الحكمة الشرقية — قصص الحيوانات التي تعلّم الذكاء والأخلاق والسياسة منذ قرون.",
    quote: "«العاقل من عمل بعلمه، والعالم من تعلّم بعمله.»",
  },
  {
    title: "حكايات جحا", author: "تراث شعبي",
    category: "أطفال", subcategory: "قصص حكم وفكاهة", rating: "4.8/5", length: "قصير",
    atmosphere: "family", language: "ar",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["خفيف", "اجتماعي", "مرح"],
    timeMatch: ["morning", "afternoon", "evening"], ageGroups: ["children", "teen", "young_adult", "adult", "senior"],
    seasonMatch: ["spring", "summer", "autumn", "winter"], monthMatch: [1,2,3,4,5,6,7,8,9,10,11,12],
    reason: "شخصية جحا الخالدة — الحكيم الطريف الذي يُعلّم الأطفال والكبار الحكمة بأسلوب فكاهي لا يُنسى.",
    quote: "«سافر جحا فرأى الدنيا كلها، لكن أجمل ما رآه بيته حين عاد.»",
  },
  {
    title: "ألف ليلة وليلة", author: "تراث عربي",
    category: "أطفال", subcategory: "قصص خيالية وحكايات", rating: "4.9/5", length: "طويل",
    atmosphere: "adventure", language: "ar",
    weatherMatch: ["Clear", "Clouds", "Rain"], moodMatch: ["مغامرة", "خيال", "فضولي", "متحمس"],
    timeMatch: ["evening", "night"], ageGroups: ["teen", "young_adult", "adult"],
    seasonMatch: ["spring", "summer", "autumn", "winter"], monthMatch: [1,2,3,4,5,6,7,8,9,10,11,12],
    reason: "علاء الدين وسندباد وشهرزاد — إرث الخيال العربي الأغنى والأوسع في تاريخ الأدب الإنساني.",
    quote: "«كان ياما كان في قديم الزمان…»",
  },
  {
    title: "قصص الأنبياء للأطفال", author: "ابن كثير (مختصر)",
    category: "أطفال", subcategory: "قصص دينية للأطفال", rating: "4.9/5", length: "قصير",
    atmosphere: "spiritual", language: "ar",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["روحاني", "هادئ", "فضولي"],
    timeMatch: ["morning", "evening"], ageGroups: ["children", "teen"],
    seasonMatch: ["spring", "summer", "autumn", "winter"], monthMatch: [1,2,3,4,5,6,7,8,9,10,11,12],
    reason: "قصص الأنبياء مُقدَّمة للأطفال بأسلوب شيّق ومبسّط — تربية روحية وإيمانية أصيلة.",
    quote: "«{وَنُقَصُّ عَلَيْكَ مِنْ أَنبَاءِ الرُّسُلِ مَا نُثَبِّتُ بِهِ فُؤَادَكَ}»",
  },
  {
    title: "سلسلة المغامرون الخمسة", author: "محمود سالم",
    category: "أطفال", subcategory: "فتيان ومغامرات", rating: "4.7/5", length: "قصير",
    atmosphere: "adventure", language: "ar",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["مغامرة", "متحمس", "فضولي"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen"],
    seasonMatch: ["summer", "spring"], monthMatch: [6,7,8,4,5],
    reason: "الأصدقاء الخمسة ومغامراتهم الشيّقة — أكثر سلاسل الأطفال العربية شعبيةً وإثارةً.",
    quote: "«معاً نستطيع أن نحل أي لغز.»",
  },
  {
    title: "رحلات سندباد البحري", author: "تراث عربي",
    category: "أطفال", subcategory: "مغامرات بحرية", rating: "4.8/5", length: "قصير",
    atmosphere: "adventure", language: "ar",
    weatherMatch: ["Clear", "Clouds", "Thunderstorm"], moodMatch: ["مغامرة", "متحمس", "فضولي"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen", "young_adult"],
    seasonMatch: ["summer"], monthMatch: [6,7,8],
    reason: "سبع رحلات بحرية مليئة بالمخلوقات العجيبة والجزر المجهولة — ملحمة المغامرة العربية الكبرى.",
    quote: "«البحر لا يُصاد بالخوف، بل يُعبَر بالشجاعة.»",
  },
  {
    title: "مغامرات طرزان", author: "إدغار رايس بوروز (مترجم)",
    category: "أطفال", subcategory: "فتيان ومغامرات", rating: "4.6/5", length: "قصير",
    atmosphere: "adventure", language: "ar",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["مغامرة", "متحمس", "مليء بالطاقة"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen"],
    seasonMatch: ["summer", "spring"], monthMatch: [5,6,7,8],
    reason: "الطفل الذي نشأ بين الغوريلا وأصبح ملك الغابة — رحلة مثيرة بين الطبيعة الوحشية والبشرية.",
    quote: "«الغابة دار من لا دار له.»",
  },
  {
    title: "أسرار الغابة السحرية", author: "أحمد خالد توفيق",
    category: "أطفال", subcategory: "قصص خيال للفتيان", rating: "4.7/5", length: "قصير",
    atmosphere: "adventure", language: "ar",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["مغامرة", "غموض", "فضولي"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["children", "teen"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9,10,11],
    reason: "قلم أحمد خالد توفيق السحري يُدخل الأطفال عالماً من الرعب الخفيف والمغامرة المثيرة.",
    quote: "«الخيال هو الباب الوحيد الذي لا يُغلَق أبداً.»",
  },
  {
    title: "الأمير الصغير", author: "أنطوان دو سانت إكزوبيري",
    category: "أطفال", subcategory: "حكاية فلسفية مترجمة", rating: "—", length: "قصير",
    atmosphere: "philosophical", language: "ar",
    weatherMatch: ["Clear", "Clouds", "Rain"], moodMatch: ["هادئ", "فضولي", "عاطفي"],
    timeMatch: ["morning", "evening"], ageGroups: ["children", "teen", "young_adult", "adult", "senior"],
    seasonMatch: ["spring", "summer", "autumn", "winter"],
    contentWarnings: ["grief_loss"],
    sourceReferences: ["goodreads", "storygraph"],
    reason: "ترجمة عربية لحكاية تجمع الخيال بأسئلة الصداقة والفقد والمسؤولية، وتناسب القراءة المشتركة بين الطفل ووالديه.",
    quote: "نسخة عربية مترجمة؛ تحقّق من بيانات الطبعة والعمر المقترح قبل الاختيار.",
  },
  {
    title: "ماتيلدا", author: "رولد دال",
    category: "أطفال", subcategory: "قصة أطفال مترجمة", rating: "—", length: "قصير",
    atmosphere: "adventure", language: "ar",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["فضولي", "متحمس", "خفيف"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen"],
    seasonMatch: ["spring", "summer", "autumn"],
    contentWarnings: ["child_abuse"],
    sourceReferences: ["goodreads", "storygraph"],
    reason: "قصة مترجمة عن طفلة محبة للقراءة تستخدم ذكاءها لمواجهة معاملة قاسية من بعض البالغين.",
    quote: "نسخة عربية مترجمة؛ يفضّل أن يناقش الوالدان مشاهد القسوة مع الأطفال الأصغر.",
  },
  {
    title: "الحديقة السرية", author: "فرانسيس هودجسون برنيت",
    category: "أطفال", subcategory: "كلاسيكيات أطفال مترجمة", rating: "—", length: "متوسط",
    atmosphere: "family", language: "ar",
    weatherMatch: ["Clear", "Clouds", "Rain"], moodMatch: ["هادئ", "عاطفي", "فضولي"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen", "young_adult"],
    seasonMatch: ["spring", "summer"],
    contentWarnings: ["grief_loss", "medical_trauma"],
    sourceReferences: ["goodreads", "storygraph"],
    reason: "رواية مترجمة عن طفلين يواجهان الوحدة والمرض ويستعيدان الأمل من خلال الصداقة والطبيعة.",
    quote: "نسخة عربية مترجمة؛ تختلف اللغة والتفاصيل باختلاف الطبعة.",
  },

  // ── English Children's ────────────────────────────────────────────────────
  {
    title: "Charlotte's Web", author: "E.B. White",
    category: "أطفال", subcategory: "قصص أطفال", rating: "4.8/5", length: "قصير",
    atmosphere: "family", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["حزين", "خفيف", "عاطفي", "هادئ"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen"],
    seasonMatch: ["spring", "summer"], monthMatch: [5,6,7,8],
    reason: "Wilbur the pig and Charlotte the spider — one of the most beloved friendships in children's literature. A gentle story about life, death, and loyalty.",
    quote: "«You have been my friend. That in itself is a tremendous thing.»",
  },
  {
    title: "Charlie and the Chocolate Factory", author: "Roald Dahl",
    category: "أطفال", subcategory: "قصص أطفال", rating: "4.9/5", length: "قصير",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Clouds", "Rain", "Clear"], moodMatch: ["خفيف", "مرح", "متحمس"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen"],
    seasonMatch: ["winter", "autumn"], monthMatch: [10,11,12,1],
    reason: "Willy Wonka's magical factory and five golden tickets — Dahl's most inventive, delightfully absurd adventure.",
    quote: "«A little nonsense now and then, is cherished by the wisest men.»",
  },
  {
    title: "Matilda", author: "Roald Dahl",
    category: "أطفال", subcategory: "فتيان ومغامرات", rating: "4.9/5", length: "قصير",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Clouds", "Rain"], moodMatch: ["طموح", "فضولي", "متحمس", "خفيف"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9,10,11],
    reason: "A brilliant girl with telekinetic powers and terrible parents — Matilda is Dahl's ultimate love letter to books and the magic of reading.",
    quote: "«Never do anything by halves if you want to get away with it.»",
  },
  {
    title: "The Lion, the Witch and the Wardrobe", author: "C.S. Lewis",
    category: "أطفال", subcategory: "مغامرات خيالية", rating: "4.9/5", length: "قصير",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Snow", "Clouds"], moodMatch: ["مغامرة", "فضولي", "متحمس"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["children", "teen", "young_adult"],
    seasonMatch: ["winter", "autumn"], monthMatch: [10,11,12,1,2],
    reason: "Through the wardrobe into Narnia — a land of talking animals, White Witches, and eternal winter. Lewis's timeless portal fantasy.",
    quote: "«Once a king or queen in Narnia, always a king or queen.»",
  },
  {
    title: "Percy Jackson & the Lightning Thief", author: "Rick Riordan",
    category: "أطفال", subcategory: "فتيان ومغامرات", rating: "4.8/5", length: "قصير",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Thunderstorm", "Clear"], moodMatch: ["مغامرة", "متحمس", "خفيف"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen", "young_adult"],
    seasonMatch: ["summer"], monthMatch: [6,7,8],
    reason: "A dyslexic boy discovers he's the son of Poseidon — Greek mythology meets modern adventure in Riordan's irresistible series opener.",
    quote: "«Being a half-blood is dangerous. It's scary. Most of the time, it gets you killed.»",
  },
  {
    title: "Wonder", author: "R.J. Palacio",
    category: "أطفال", subcategory: "فتيان وقيم", rating: "4.9/5", length: "قصير",
    atmosphere: "family", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["عاطفي", "حزين", "طموح", "اجتماعي"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen"],
    seasonMatch: ["spring", "autumn"], monthMatch: [3,4,9,10],
    reason: "August Pullman was born with a facial difference — his first year at school teaches classmates and readers alike that everyone deserves kindness.",
    quote: "«When given the choice between being right and being kind, choose kind.»",
  },
  {
    title: "Diary of a Wimpy Kid", author: "Jeff Kinney",
    category: "أطفال", subcategory: "قصص أطفال", rating: "4.7/5", length: "قصير",
    atmosphere: "family", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["خفيف", "مرح", "اجتماعي"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen"],
    seasonMatch: ["summer", "spring"], monthMatch: [5,6,7,8],
    reason: "Greg Heffley's illustrated diary of middle-school survival — laugh-out-loud funny and painfully relatable for kids and nostalgic adults alike.",
    quote: "«I'll be famous one day, but for now I'm stuck in middle school.»",
  },
  {
    title: "A Wrinkle in Time", author: "Madeleine L'Engle",
    category: "أطفال", subcategory: "مغامرات خيالية", rating: "4.6/5", length: "قصير",
    atmosphere: "scifi", language: "en",
    weatherMatch: ["Clear", "Atmosphere"], moodMatch: ["مغامرة", "فضولي", "طموح"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["children", "teen", "young_adult"],
    seasonMatch: ["winter", "autumn"], monthMatch: [9,10,11,12],
    reason: "Meg Murry travels through space and time to rescue her father — a pioneering work of children's science fantasy with heart and intelligence.",
    quote: "«Maybe I don't like being different, but I don't want to be anyone else.»",
  },
  {
    title: "The BFG", author: "Roald Dahl",
    category: "أطفال", subcategory: "قصص أطفال", rating: "4.8/5", length: "قصير",
    atmosphere: "adventure", language: "en",
    weatherMatch: ["Clouds", "Rain", "Clear"], moodMatch: ["خفيف", "مرح", "مغامرة", "هادئ"],
    timeMatch: ["morning", "afternoon", "evening"], ageGroups: ["children", "teen"],
    seasonMatch: ["spring", "summer", "autumn"], monthMatch: [4,5,6,7,8,9],
    reason: "Sophie and the Big Friendly Giant catch nightmares and deliver good dreams — Dahl's most warm-hearted and whimsical adventure.",
    quote: "«I is not understanding human beans. You is not loving each other.»",
  },

  // ── French Children's ─────────────────────────────────────────────────────
  {
    title: "Les Aventures de Tintin", author: "Hergé",
    category: "أطفال", subcategory: "قصص أطفال", rating: "4.9/5", length: "قصير",
    atmosphere: "adventure", language: "fr",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["مغامرة", "متحمس", "خفيف", "فضولي"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen", "young_adult", "adult"],
    seasonMatch: ["spring", "summer", "autumn", "winter"], monthMatch: [1,2,3,4,5,6,7,8,9,10,11,12],
    reason: "Tintin, Milou et le capitaine Haddock voyagent aux quatre coins du monde — la bande dessinée la plus lue de l'histoire de la francophonie.",
    quote: "«Tonnerre de Brest! Mille millions de mille sabords!»",
  },
  {
    title: "Astérix le Gaulois", author: "René Goscinny & Albert Uderzo",
    category: "أطفال", subcategory: "قصص أطفال", rating: "4.9/5", length: "قصير",
    atmosphere: "adventure", language: "fr",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["خفيف", "مرح", "متحمس"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen", "young_adult", "adult"],
    seasonMatch: ["spring", "summer", "autumn", "winter"], monthMatch: [1,2,3,4,5,6,7,8,9,10,11,12],
    reason: "Un village gaulois résiste à l'envahisseur romain grâce à une potion magique — l'humour inimitable de Goscinny pour petits et grands.",
    quote: "«Ils sont fous ces Romains!»",
  },
  {
    title: "20 000 lieues sous les mers", author: "Jules Verne",
    category: "أطفال", subcategory: "مغامرات خيالية", rating: "4.8/5", length: "طويل",
    atmosphere: "adventure", language: "fr",
    weatherMatch: ["Clouds", "Rain", "Clear"], moodMatch: ["مغامرة", "فضولي", "علوم"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen", "young_adult"],
    seasonMatch: ["summer", "spring"], monthMatch: [5,6,7,8],
    reason: "Le capitaine Nemo et le Nautilus — Jules Verne invente la science-fiction et emmène ses lecteurs dans les abysses les plus mystérieuses.",
    quote: "«La mer est tout. Elle couvre les sept dixièmes du globe terrestre.»",
  },
  {
    title: "Les Malheurs de Sophie", author: "Comtesse de Ségur",
    category: "أطفال", subcategory: "قصص أطفال", rating: "4.6/5", length: "قصير",
    atmosphere: "family", language: "fr",
    weatherMatch: ["Clouds", "Clear"], moodMatch: ["خفيف", "مرح", "اجتماعي"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen"],
    seasonMatch: ["spring", "summer"], monthMatch: [4,5,6,7,8],
    reason: "Sophie et ses bêtises irrésistibles — la comtesse de Ségur croque avec tendresse l'enfance et ses apprentissages.",
    quote: "«Les enfants sont comme les roses: il faut les soigner avec amour.»",
  },
  {
    title: "Le Tour du monde en 80 jours", author: "Jules Verne",
    category: "أطفال", subcategory: "فتيان ومغامرات", rating: "4.8/5", length: "قصير",
    atmosphere: "adventure", language: "fr",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["مغامرة", "متحمس", "فضولي"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["children", "teen", "young_adult", "adult"],
    seasonMatch: ["summer", "spring"], monthMatch: [5,6,7,8],
    reason: "Phileas Fogg parie de faire le tour du monde en 80 jours — une course haletante à travers continents et océans.",
    quote: "«Tout ce qui est impossible reste à accomplir.»",
  },

  // ╔══════════════════════════════════════════════════╗
  // ║  Child Development & Parenting — AR / EN / FR    ║
  // ╚══════════════════════════════════════════════════╝

  // ── Arabic Child Development ───────────────────────────────────────────────
  {
    title: "طفلك من الميلاد حتى المراهقة", author: "د. سهير كمال",
    category: "تطوير الطفل", subcategory: "تطوير الطفل والتربية", rating: "4.8/5", length: "طويل",
    atmosphere: "selfhelp", language: "ar",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["هادئ", "فضولي", "طموح"],
    timeMatch: ["morning", "afternoon", "evening"], ageGroups: ["adult", "senior"],
    seasonMatch: ["spring", "summer", "autumn", "winter"], monthMatch: [1,2,3,4,5,6,7,8,9,10,11,12],
    reason: "مرجع شامل لكل مرحلة من مراحل نمو الطفل — يجيب على أسئلة كل أب وأم بأسلوب علمي ودافئ.",
    quote: "«الطفل لا يحتاج إلى كمالك، بل إلى حضورك.»",
  },
  {
    title: "قوة الحب في التربية", author: "جون غوتمان",
    category: "تطوير الطفل", subcategory: "تطوير الطفل والتربية", rating: "4.7/5", length: "متوسط",
    atmosphere: "selfhelp", language: "ar",
    weatherMatch: ["Clear", "Rain", "Clouds"], moodMatch: ["هادئ", "رومانسي", "طموح"],
    timeMatch: ["evening", "night", "afternoon"], ageGroups: ["adult", "senior"],
    seasonMatch: ["spring", "autumn", "winter"], monthMatch: [1,2,3,9,10,11,12],
    reason: "يكشف كيف تبني علاقة عاطفية متينة مع طفلك تُحصّنه للحياة — مبني على 35 عاماً من الأبحاث.",
    quote: "«أكثر ما يحتاجه الطفل هو أن يُشعر بأنه مُحبوب بلا شروط.»",
  },
  {
    title: "تربية أطفال أحرار", author: "لينور سكينازي",
    category: "تطوير الطفل", subcategory: "تطوير الطفل والتربية", rating: "4.6/5", length: "متوسط",
    atmosphere: "selfhelp", language: "ar",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["مغامرة", "فضولي", "طموح", "متحمس"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["adult", "young_adult"],
    seasonMatch: ["spring", "summer"], monthMatch: [3,4,5,6,7,8],
    reason: "ثورة تربوية تدعو لإعطاء الأطفال استقلاليتهم — كيف نُربي أطفالاً واثقين بأنفسهم في عالم خائف.",
    quote: "«الطفل الذي تسمح له بالفشل اليوم هو البالغ القادر على النجاح غداً.»",
  },
  {
    title: "لغات الحب الخمس للأطفال", author: "غاري تشابمان",
    category: "تطوير الطفل", subcategory: "تطوير الطفل والتربية", rating: "4.9/5", length: "قصير",
    atmosphere: "spiritual", language: "ar",
    weatherMatch: ["Clear", "Rain", "Clouds", "Drizzle"], moodMatch: ["هادئ", "رومانسي", "مشتت", "حزين"],
    timeMatch: ["evening", "night"], ageGroups: ["adult", "senior"],
    seasonMatch: ["autumn", "winter"], monthMatch: [10,11,12,1,2],
    reason: "اكتشف لغة الحب التي يفهمها طفلك — كتاب يُغيّر طريقة تواصلك معه إلى الأبد.",
    quote: "«أطفالنا يتكلمون لغات مختلفة — حبنا يجب أن يتعلم لغتهم.»",
  },
  {
    title: "عقلية النمو عند الأطفال", author: "كارول دويك",
    category: "تطوير الطفل", subcategory: "تطوير الطفل والتربية", rating: "4.8/5", length: "متوسط",
    atmosphere: "selfhelp", language: "ar",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["طموح", "فضولي", "متحمس", "مشتت"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["adult", "young_adult"],
    seasonMatch: ["spring", "summer", "autumn"], monthMatch: [3,4,5,6,7,8,9,10],
    reason: "أثبتت الأبحاث أن طريقة مدحنا لأطفالنا تحدد مستقبلهم — هذا الكتاب يُعلّمنا المدح الصحيح.",
    quote: "«المدح الصحيح لا يقول 'أنت ذكي' — بل يقول 'أحسنت المحاولة'.»",
  },

  // ── English Child Development ──────────────────────────────────────────────
  {
    title: "The Whole-Brain Child", author: "Daniel J. Siegel & Tina Payne Bryson",
    category: "تطوير الطفل", subcategory: "Child Development & Parenting", rating: "4.8/5", length: "متوسط",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear", "Clouds", "Rain"], moodMatch: ["فضولي", "هادئ", "طموح"],
    timeMatch: ["morning", "afternoon", "evening"], ageGroups: ["adult", "young_adult", "senior"],
    seasonMatch: ["spring", "summer", "autumn", "winter"], monthMatch: [1,2,3,4,5,6,7,8,9,10,11,12],
    reason: "12 revolutionary strategies to nurture your child's developing mind — turning tantrums into teaching moments.",
    quote: "\"Connect first, then redirect.\"",
  },
  {
    title: "How to Talk So Kids Will Listen & Listen So Kids Will Talk", author: "Adele Faber & Elaine Mazlish",
    category: "تطوير الطفل", subcategory: "Child Development & Parenting", rating: "4.9/5", length: "متوسط",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear", "Clouds", "Rain", "Drizzle"], moodMatch: ["هادئ", "مشتت", "قلق"],
    timeMatch: ["evening", "night", "afternoon"], ageGroups: ["adult", "senior"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9,10,11,12,1,2],
    reason: "The communication classic that has helped millions of parents — practical tools to build genuine respect with your child.",
    quote: "\"Children don't need our approval; they need our presence.\"",
  },
  {
    title: "Unconditional Parenting", author: "Alfie Kohn",
    category: "تطوير الطفل", subcategory: "Child Development & Parenting", rating: "4.6/5", length: "متوسط",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clouds", "Rain", "Drizzle"], moodMatch: ["هادئ", "حزين", "فضولي"],
    timeMatch: ["evening", "night"], ageGroups: ["adult", "young_adult"],
    seasonMatch: ["autumn", "winter"], monthMatch: [10,11,12,1,2,3],
    reason: "A thought-provoking challenge to reward-and-punishment parenting — raising children who love learning for its own sake.",
    quote: "\"We need to work with children, not do things to them.\"",
  },
  {
    title: "The Montessori Toddler", author: "Simone Davies",
    category: "تطوير الطفل", subcategory: "Child Development & Parenting", rating: "4.7/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["فضولي", "متحمس", "هادئ"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["adult", "young_adult"],
    seasonMatch: ["spring", "summer"], monthMatch: [3,4,5,6,7,8],
    reason: "Bring Montessori philosophy into your home — fostering independence, curiosity, and calm in young children.",
    quote: "\"Never help a child with a task at which they feel they can succeed.\" — Maria Montessori",
  },
  {
    title: "Raising Good Humans", author: "Hunter Clarke-Fields",
    category: "تطوير الطفل", subcategory: "Child Development & Parenting", rating: "4.7/5", length: "قصير",
    atmosphere: "selfhelp", language: "en",
    weatherMatch: ["Clear", "Clouds", "Rain"], moodMatch: ["هادئ", "قلق", "طموح"],
    timeMatch: ["morning", "evening", "afternoon"], ageGroups: ["adult", "young_adult"],
    seasonMatch: ["spring", "autumn"], monthMatch: [3,4,9,10,11],
    reason: "Mindfulness-based parenting that breaks reactive cycles — practical tools to raise kind, confident, independent children.",
    quote: "\"When we pause before we react, we teach our children to do the same.\"",
  },

  // ── French Child Development ───────────────────────────────────────────────
  {
    title: "Parler pour que les enfants écoutent", author: "Adele Faber & Elaine Mazlish",
    category: "تطوير الطفل", subcategory: "Développement de l'enfant", rating: "4.9/5", length: "متوسط",
    atmosphere: "selfhelp", language: "fr",
    weatherMatch: ["Clouds", "Rain", "Drizzle"], moodMatch: ["هادئ", "مشتت", "قلق"],
    timeMatch: ["evening", "afternoon"], ageGroups: ["adult", "senior"],
    seasonMatch: ["autumn", "winter"], monthMatch: [9,10,11,12,1,2],
    reason: "Le classique de la communication parent-enfant, traduit en 30 langues — des outils concrets pour être vraiment entendu.",
    quote: "«Écouter, c'est le plus grand cadeau qu'on puisse offrir à un enfant.»",
  },
  {
    title: "L'Enfant et son développement", author: "Donald W. Winnicott",
    category: "تطوير الطفل", subcategory: "Développement de l'enfant", rating: "4.7/5", length: "متوسط",
    atmosphere: "philosophical", language: "fr",
    weatherMatch: ["Clouds", "Rain", "Drizzle", "Thunderstorm"], moodMatch: ["فضولي", "هادئ", "حزين"],
    timeMatch: ["evening", "night"], ageGroups: ["adult", "senior"],
    seasonMatch: ["autumn", "winter"], monthMatch: [10,11,12,1,2],
    reason: "Le grand pédiatre-psychanalyste britannique explique comment l'enfant construit sa personnalité — une lecture fondamentale.",
    quote: "«Il n'existe pas de bébé sans mère.»",
  },
  {
    title: "Élever son enfant avec la méthode Montessori", author: "Charlotte Poussin",
    category: "تطوير الطفل", subcategory: "Développement de l'enfant", rating: "4.6/5", length: "قصير",
    atmosphere: "selfhelp", language: "fr",
    weatherMatch: ["Clear", "Clouds"], moodMatch: ["فضولي", "متحمس", "هادئ"],
    timeMatch: ["morning", "afternoon"], ageGroups: ["adult", "young_adult"],
    seasonMatch: ["spring", "summer"], monthMatch: [3,4,5,6,7,8],
    reason: "Appliquer Montessori au quotidien — créer un environnement qui stimule l'autonomie et la curiosité naturelle de l'enfant.",
    quote: "«Aide-moi à faire seul.» — Maria Montessori",
  },
  {
    title: "مكتبة ساحة الأعشاب", author: "إيريك دو كيرمل",
    category: "روايات عائلية", subcategory: "قراءة دافئة في مكتبة", rating: "—", length: "قصير",
    atmosphere: "family", language: "ar",
    weatherMatch: ["Clouds", "Rain", "Clear"], moodMatch: ["مجهد", "مرهق", "خفيف", "هادئ", "مشتت"],
    timeMatch: ["morning", "afternoon", "evening"], ageGroups: ["adult"],
    seasonMatch: ["spring", "autumn", "winter"], sourceReferences: ["goodreads"],
    reason: "رواية دافئة عن ناتالي التي تترك صخب المدينة وتدير مكتبة هادئة؛ حكايات الزوار والكتب تمنح جلسة قراءة خفيفة ولطيفة.",
    quote: "",
  },
  {
    title: "أيام في مكتبة موريساكي", author: "ساتوشي ياغيساوا",
    category: "روايات عائلية", subcategory: "كتب وشفاء هادئ", rating: "—", length: "قصير",
    atmosphere: "family", language: "ar",
    weatherMatch: ["Clouds", "Rain", "Clear"], moodMatch: ["مجهد", "مرهق", "خفيف", "هادئ"],
    timeMatch: ["morning", "afternoon", "evening"], ageGroups: ["adult"],
    seasonMatch: ["spring", "autumn", "winter"], sourceReferences: ["goodreads"],
    reason: "حكاية قصيرة وهادئة عن العودة إلى الحياة من خلال الكتب ومكتبة عائلية صغيرة؛ مناسبة عندما تحتاج إلى قراءة مريحة بلا ثقل.",
    quote: "",
  },
  {
    title: "المكتبة المفقودة", author: "إيفي وودز",
    category: "روايات عائلية", subcategory: "مكتبة وأسرار لطيفة", rating: "—", length: "طويل",
    atmosphere: "family", language: "ar",
    weatherMatch: ["Clouds", "Rain", "Clear"], moodMatch: ["مجهد", "مرهق", "خفيف", "هادئ", "فضولي"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["adult"],
    seasonMatch: ["autumn", "winter"], sourceReferences: ["goodreads"],
    reason: "رواية حديثة عن متجر كتب غامض وشخصيات تبحث عن بداية جديدة؛ تمنح دفء المكتبات مع قدر لطيف من الفضول.",
    quote: "",
  },
  {
    title: "The Lost Bookshop", author: "Evie Woods",
    category: "روايات عائلية", subcategory: "Cozy bookshop fiction", rating: "—", length: "طويل",
    atmosphere: "family", language: "en",
    weatherMatch: ["Clouds", "Rain", "Clear"], moodMatch: ["مجهد", "مرهق", "خفيف", "هادئ", "فضولي"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["adult"],
    seasonMatch: ["autumn", "winter"], sourceReferences: ["goodreads"],
    reason: "A recent, warm-hearted story about a mysterious bookshop and new beginnings, chosen for a gentle reading session.",
    quote: "",
  },
  {
    title: "Days at the Morisaki Bookshop", author: "Satoshi Yagisawa",
    category: "روايات عائلية", subcategory: "Books and quiet healing", rating: "—", length: "قصير",
    atmosphere: "family", language: "en",
    weatherMatch: ["Clouds", "Rain", "Clear"], moodMatch: ["مجهد", "مرهق", "خفيف", "هادئ"],
    timeMatch: ["morning", "afternoon", "evening"], ageGroups: ["adult"],
    seasonMatch: ["spring", "autumn", "winter"], sourceReferences: ["goodreads"],
    reason: "A short, tender novel about finding steadiness among books in a small family bookshop.",
    quote: "",
  },
  {
    title: "The Door-to-Door Bookstore", author: "Carsten Henn",
    category: "روايات عائلية", subcategory: "A gentle bookish journey", rating: "—", length: "متوسط",
    atmosphere: "family", language: "en",
    weatherMatch: ["Clouds", "Rain", "Clear"], moodMatch: ["مجهد", "مرهق", "خفيف", "هادئ"],
    timeMatch: ["afternoon", "evening"], ageGroups: ["adult"],
    seasonMatch: ["autumn", "winter"], sourceReferences: ["goodreads"],
    reason: "A gentle, recent story about a bookseller who delivers novels by hand and reconnects people through reading.",
    quote: "",
  },
  {
    title: "من قتل وليد؟", author: "خلف زون",
    category: "روايات بوليسية", subcategory: "غموض وتحقيق وجريمة", rating: "—", length: "طويل",
    atmosphere: "mystery", language: "ar",
    weatherMatch: ["Clouds", "Rain", "Thunderstorm", "Snow"], moodMatch: ["ألغاز", "غموض", "إثارة", "متحمس", "فضولي"],
    timeMatch: ["afternoon", "evening", "night"], ageGroups: ["adult"],
    seasonMatch: ["autumn", "winter"], sourceReferences: ["goodreads"],
    reason: "رواية عربية حديثة من 2025 في الغموض والتحقيق والجريمة، وتدور حول كشف حقيقة مقتل وليد وتشابك الأسرار بين الشخصيات.",
    quote: "",
  },
];

const GENTLE_FATIGUE_TITLES = new Set([
  "مكتبة ساحة الأعشاب",
  "أيام في مكتبة موريساكي",
  "المكتبة المفقودة",
  "The Lost Bookshop",
  "Days at the Morisaki Bookshop",
  "The Door-to-Door Bookstore",
]);

const RECENT_TITLES = new Set([
  "مكتبة ساحة الأعشاب",
  "أيام في مكتبة موريساكي",
  "المكتبة المفقودة",
  "The Lost Bookshop",
  "Days at the Morisaki Bookshop",
  "The Door-to-Door Bookstore",
  "من قتل وليد؟",
]);

// Older catalogue entries predate age metadata. Treat those entries as adult
// catalogue items, while keeping explicitly child/teen entries excluded.
for (const book of BOOKS) {
  if (!book.ageGroups) book.ageGroups = ["adult"];
}

function canonicalAgeGroup(group: AgeGroup): CanonicalAgeGroup {
  if (group === "young_adult") return "teen";
  if (group === "senior") return "adult";
  return group;
}

function getCanonicalAgeGroups(book: BookSuggestion): CanonicalAgeGroup[] {
  return [...new Set((book.ageGroups ?? ["adult"]).map(canonicalAgeGroup))];
}

const CURATED_CONTENT_WARNINGS = new Map<string, ContentWarning[]>([
  ["قلب الظلام", ["graphic_violence", "racism_slurs"]],
  ["ألف شمس مشرقة", ["domestic_abuse", "physical_assault", "grief_loss"]],
  ["حكاية الجارية", ["sexual_assault", "domestic_abuse", "religious_trauma"]],
  ["١٩٨٤", ["torture", "physical_assault"]],
  ["المريض الصامت", ["physical_assault", "mental_illness"]],
  ["البنت في القطار", ["alcohol_abuse", "mental_illness", "physical_assault"]],
  ["فتاة مختفية", ["domestic_abuse", "physical_assault", "foul_language"]],
  ["قواعد العشق الأربعون", ["religious_themes"]],
  ["قصص الأنبياء للأطفال", ["religious_themes"]],
  ["ألف ليلة وليلة", ["physical_assault", "occult_magic", "child_suitability_unverified"]],
  ["رحلات سندباد البحري", ["physical_assault", "occult_magic"]],
  ["أسرار الغابة السحرية", ["occult_magic"]],
  ["مغامرات طرزان", ["physical_assault", "animal_cruelty_death"]],
]);

function withResolvedContentWarnings(book: BookSuggestion, ageGroup?: CanonicalAgeGroup): BookSuggestion {
  const warnings = new Set<ContentWarning>([
    ...(book.contentWarnings ?? []),
    ...(CURATED_CONTENT_WARNINGS.get(book.title) ?? []),
  ]);
  if (ageGroup === "children" && !getCanonicalAgeGroups(book).includes("children")) {
    warnings.add("not_for_children");
  }

  return {
    ...book,
    ...(warnings.size > 0 ? { contentWarnings: [...warnings] } : {}),
    suitableAgeGroups: getCanonicalAgeGroups(book),
  };
}

// ─── Category Mapping ─────────────────────────────────────────────────────────
function getCategoryBooks(category: string, language?: string): BookSuggestion[] {
  // Detect language from the category text (English/French categories won't contain Arabic)
  const isArabicCat = /[\u0600-\u06FF]/.test(category);
  const langFilter  = language ?? (isArabicCat ? "ar" : "en");

  // Language-strict pool: only books in the target language
  const strictPool = BOOKS.filter(b => (b.language ?? "ar") === langFilter);
  // Use strict pool; fall back to all books only if strict pool is entirely empty
  const pool = strictPool.length > 0 ? strictPool : BOOKS;

  if (category.includes("مغامرة") || category.includes("استكشاف") || category.toLowerCase().includes("adventure") || category.toLowerCase().includes("aventure"))
    return pool.filter(b => b.category === "روايات مغامرة" || b.atmosphere === "adventure");
  const normalizedCategory = category.toLocaleLowerCase();
  if (
    category.includes("الرعب") ||
    normalizedCategory.includes("horror") ||
    normalizedCategory.includes("horreur")
  )
    return pool.filter(b => b.atmosphere === "mystery" || b.atmosphere === "thriller" || b.atmosphere === "horror");
  if (category.includes("بوليسية") || category.includes("غموض") || normalizedCategory.includes("mystery") || normalizedCategory.includes("mystère") || normalizedCategory.includes("policier"))
    return pool.filter(b => b.category === "روايات بوليسية" || b.atmosphere === "mystery" || b.atmosphere === "thriller");
  if (category.includes("عائلية") || category.includes("اجتماعية") || category.toLowerCase().includes("family") || category.toLowerCase().includes("social") || category.toLowerCase().includes("famili"))
    return pool.filter(b => b.category === "روايات عائلية" || b.atmosphere === "family");
  if (category.includes("رومانسية") || category.includes("عاطفية") || category.toLowerCase().includes("romance") || category.toLowerCase().includes("romantic"))
    return pool.filter(b => b.category === "روايات رومانسية" || b.atmosphere === "romance");
  if (category.includes("خيال علمي") || category.includes("فانتازيا") || category.toLowerCase().includes("sci-fi") || category.toLowerCase().includes("fantasy") || category.toLowerCase().includes("science-fiction"))
    return pool.filter(b => b.category === "خيال علمي" || b.atmosphere === "scifi");
  if (category.includes("إثارة") || category.includes("تشويق") || category.toLowerCase().includes("thriller") || category.toLowerCase().includes("suspense"))
    return pool.filter(b => b.category === "روايات إثارة" || b.atmosphere === "thriller");
  if (category.includes("التاريخية") || (category.includes("تاريخية") && category.includes("روايات")) || category.toLowerCase().includes("historical"))
    return pool.filter(b => b.category === "روايات تاريخية" || b.atmosphere === "history");
  if (category.includes("الكلاسيكية") || category.includes("العالمية") || category.toLowerCase().includes("classic") || category.toLowerCase().includes("classique"))
    return pool.filter(b => b.category === "روايات كلاسيكية" || b.atmosphere === "classic");
  if (category.includes("تطوير") || category.includes("النجاح") || category.toLowerCase().includes("self-help") || category.toLowerCase().includes("développement"))
    return pool.filter(b => b.category === "تطوير ذات" || b.atmosphere === "selfhelp");
  if (category.includes("النفس") || category.includes("العقل") || category.toLowerCase().includes("psychology") || category.toLowerCase().includes("psychologie"))
    return pool.filter(b => b.category === "علم نفس");
  if (category.includes("العلوم") || category.includes("التقنية") || category.toLowerCase().includes("science") || category.toLowerCase().includes("technology") || category.toLowerCase().includes("technologie"))
    return pool.filter(b => b.category === "علوم");
  if (category.includes("التاريخ") || category.includes("الحضارات") || category.toLowerCase().includes("history") || category.toLowerCase().includes("histoire") || category.toLowerCase().includes("civilization"))
    return pool.filter(b => b.category === "تاريخ");
  if (category.includes("الفلسفة") || category.toLowerCase().includes("philosophy") || category.toLowerCase().includes("philosophie"))
    return pool.filter(b => b.category === "فلسفة" || b.atmosphere === "philosophical");
  if (category.includes("الدينية") || category.includes("الإسلامية") || category.toLowerCase().includes("religion") || category.toLowerCase().includes("spiritual"))
    return pool.filter(b => b.category === "إسلامي" || b.atmosphere === "spiritual");
  if (category.includes("السير") || category.includes("المذكرات") || category.toLowerCase().includes("memoir") || category.toLowerCase().includes("biography"))
    return pool.filter(b => b.category === "سيرة ذاتية");
  if (category.includes("الأعمال") || category.includes("الريادة") || category.toLowerCase().includes("business") || category.toLowerCase().includes("entrepreneur") || category.toLowerCase().includes("affaires"))
    return pool.filter(b => b.category === "أعمال");
  if (category.includes("الشعر") || category.includes("الأدب") || category.toLowerCase().includes("poetry") || category.toLowerCase().includes("poésie") || category.toLowerCase().includes("literary"))
    return pool.filter(b => b.category === "شعر" || b.atmosphere === "poetry");
  if (category.includes("قصص وحكايات") || category.toLowerCase().includes("children's stories") || category.toLowerCase().includes("contes"))
    return pool.filter(b => b.category === "أطفال" && b.ageGroups?.includes("children"));
  if (category.includes("فتيان") || category.includes("ناشئين") || category.includes("الناشئة") || category.toLowerCase().includes("middle grade") || category.toLowerCase().includes("young readers") || category.toLowerCase().includes("young adult") || category.toLowerCase().includes("emerging") || category.toLowerCase().includes("jeunesse"))
    return pool.filter(b => b.category === "أطفال" && getCanonicalAgeGroups(b).includes("teen"));
  if (category.includes("الأطفال الخيالية") || category.toLowerCase().includes("kids' adventure") || category.toLowerCase().includes("fantaisie pour enfants"))
    return pool.filter(b => b.category === "أطفال" && b.atmosphere === "adventure");
  if (category.includes("تطوير الطفل") || category.includes("التربية") || category.toLowerCase().includes("child development") || category.toLowerCase().includes("parenting") || category.toLowerCase().includes("développement de l'enfant"))
    return pool.filter(b => b.category === "تطوير الطفل");
  if (category.includes("المانجا") || category.includes("المصورة") || category.toLowerCase().includes("manga") || category.toLowerCase().includes("graphic"))
    return pool.filter(b => b.atmosphere === "adventure").slice(0, 5);
  // fallback
  return pool.filter(b => b.category.startsWith("روايات") || b.atmosphere === "classic" || b.atmosphere === "adventure");
}

function getGentleFatigueBooks(language?: string): BookSuggestion[] {
  const langFilter = language ?? "ar";
  return BOOKS.filter((book) =>
    (book.language ?? "ar") === langFilter && GENTLE_FATIGUE_TITLES.has(book.title),
  );
}

const TRENDING_TITLES = new Set([
  "الخيميائي", "قواعد العشق الأربعون", "ألف شمس مشرقة", "العادات الذرية",
  "الإنسان العاقل: تاريخ موجز للبشرية", "The Alchemist", "Atomic Habits",
  "Sapiens: A Brief History of Humankind", "Normal People", "The Hunger Games",
]);

const TRENDING_TITLE_ALIASES = new Map<string, string>([
  [normalizeBookIdentity("العادات الذرية"), normalizeBookIdentity("Atomic Habits")],
  [normalizeBookIdentity("الإنسان العاقل: تاريخ موجز للبشرية"), normalizeBookIdentity("Sapiens: A Brief History of Humankind")],
  [normalizeBookIdentity("الأب الغني والأب الفقير"), normalizeBookIdentity("Rich Dad Poor Dad")],
]);

const TRENDING_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TRENDING_FETCH_LIMIT = 100;
const TRENDING_FETCH_TIMEOUT_MS = 10_000;
const TRENDING_RETRY_DELAY_MS = 15 * 60 * 1000;
let trendingCache: { expiresAt: number; signals: TrendingSignals } | null = null;
let trendingRequest: Promise<TrendingSignals | null> | null = null;
let trendingRetryAfter = 0;

async function fetchTrendingRanks(period: TrendingPeriod): Promise<Map<string, number>> {
  const url = new URL(`https://openlibrary.org/trending/${period}.json`);
  url.searchParams.set("limit", String(TRENDING_FETCH_LIMIT));
  const response = await fetch(url, {
    headers: { "User-Agent": "ReMood/1.0 (book recommendation app)" },
    signal: AbortSignal.timeout(TRENDING_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Open Library trending ${period} returned ${response.status}`);

  const data = await response.json() as OpenLibraryTrendingResponse;
  const ranks = new Map<string, number>();
  for (const [rank, work] of (data.works ?? []).entries()) {
    if (typeof work.title !== "string") continue;
    const identity = normalizeBookIdentity(work.title);
    if (identity && !ranks.has(identity)) ranks.set(identity, rank);
  }
  return ranks;
}

async function refreshCurrentTrendingSignals(): Promise<TrendingSignals | null> {
  const now = Date.now();
  if (trendingCache && trendingCache.expiresAt > now) return trendingCache.signals;
  if (trendingRequest) return trendingRequest;
  if (trendingRetryAfter > now) return null;

  trendingRequest = (async () => {
    const [yearlyResult, monthlyResult] = await Promise.allSettled([
      fetchTrendingRanks("yearly"),
      fetchTrendingRanks("monthly"),
    ]);
    const signals: TrendingSignals = {
      yearlyRanks: yearlyResult.status === "fulfilled" ? yearlyResult.value : new Map(),
      monthlyRanks: monthlyResult.status === "fulfilled" ? monthlyResult.value : new Map(),
    };
    if (!signals.yearlyRanks.size && !signals.monthlyRanks.size) {
      trendingRetryAfter = Date.now() + TRENDING_RETRY_DELAY_MS;
      console.warn("Open Library trending lists are unavailable; using curated fallback rankings.");
      return null;
    }
    trendingRetryAfter = 0;
    trendingCache = { expiresAt: now + TRENDING_CACHE_TTL_MS, signals };
    return signals;
  })().finally(() => {
    trendingRequest = null;
  });

  return trendingRequest;
}

function getCurrentTrendingSignals(): TrendingSignals | null {
  const now = Date.now();
  if (trendingCache && trendingCache.expiresAt > now) return trendingCache.signals;
  void refreshCurrentTrendingSignals();
  return trendingCache?.signals ?? null;
}

// Warm the yearly and monthly trend cache without delaying a reader's request.
void refreshCurrentTrendingSignals();
const FORGOTTEN_TITLES = new Set([
  "عائلة براديشا", "يوميات الغرفة الصغيرة", "الرجل الذي خلط الأوراق",
  "المختصر المفيد في الدماغ", "أعظم لحظات التاريخ", "مدارج السالكين",
  "الفوائد", "The Alchemist Code: Foundation", "The Whole-Brain Child",
]);
const UNKNOWN_TITLES = new Set([
  "حكايات جحا", "رحلات سندباد البحري", "أسرار الغابة السحرية",
  "يوميات الغرفة الصغيرة", "الرجل الذي خلط الأوراق", "عائلة براديشا",
  "The Alchemist Code: Foundation", "The Montessori Toddler",
]);

function scoreReadingStyle(book: BookSuggestion, style?: ReadingStyle, trending?: TrendingSignals | null): number {
  if (!style) return 0;
  const title = normalizeBookIdentity(book.title);
  const searchable = `${book.category} ${book.subcategory}`.toLocaleLowerCase();
  if (style === "trending") {
    const trendingTitle = TRENDING_TITLE_ALIASES.get(title) ?? title;
    const yearlyRank = trending?.yearlyRanks.get(trendingTitle);
    const monthlyRank = trending?.monthlyRanks.get(trendingTitle);
    const yearlyScore = yearlyRank === undefined ? 0 : Math.max(4, 15 - Math.floor(yearlyRank / 10));
    const monthlyScore = monthlyRank === undefined ? 0 : Math.max(5, 18 - Math.floor(monthlyRank / 8));
    return yearlyScore
      + monthlyScore
      + (TRENDING_TITLES.has(book.title) ? 3 : 0)
      + (Number.parseFloat(book.rating) >= 4.7 && book.atmosphere !== "classic" ? 2 : 0);
  }
  if (style === "forgotten") {
    return (FORGOTTEN_TITLES.has(book.title) ? 11 : 0)
      + (searchable.includes("مغمور") || searchable.includes("discreet") || searchable.includes("méconnu") ? 3 : 0);
  }
  if (style === "unknown") {
    return (UNKNOWN_TITLES.has(book.title) ? 12 : 0)
      + (searchable.includes("غير معروف") || searchable.includes("méconnu") || searchable.includes("hidden") ? 3 : 0);
  }
  return book.atmosphere === "classic"
    || searchable.includes("كلاسيك")
    || searchable.includes("classic")
    || searchable.includes("classique")
    || searchable.includes("قديم")
    ? 12
    : 0;
}

function scoreReaderPreferences(book: BookSuggestion, likedBooks?: string[]): number {
  if (!likedBooks?.length) return 0;

  const likedIdentities = new Set(likedBooks.map(normalizeBookIdentity).filter(Boolean));
  const likedDetails = BOOKS.filter(candidate => likedIdentities.has(normalizeBookIdentity(candidate.title)));
  if (!likedDetails.length) return 0;

  const atmospheres = new Set(likedDetails.map(candidate => candidate.atmosphere).filter(Boolean));
  const categories = new Set(likedDetails.map(candidate => normalizeBookIdentity(candidate.category)));
  const subcategories = new Set(likedDetails.map(candidate => normalizeBookIdentity(candidate.subcategory)));
  const authors = new Set(likedDetails.map(candidate => normalizeBookIdentity(candidate.author)));

  let score = 0;
  if (book.atmosphere && atmospheres.has(book.atmosphere)) score += 3;
  if (categories.has(normalizeBookIdentity(book.category))) score += 2;
  if (subcategories.has(normalizeBookIdentity(book.subcategory))) score += 1.5;
  if (authors.has(normalizeBookIdentity(book.author))) score += 1;
  return score;
}

const READER_GENRE_TERMS: Record<string, string[]> = {
  fantasy: ["fantasy", "fantastique", "فانتازيا", "خيال سحري", "سحر", "أساطير"],
  mystery: ["mystery", "detective", "policier", "غموض", "بوليسية", "تحقيق"],
  thriller: ["thriller", "suspense", "إثارة", "تشويق"],
  romance: ["romance", "romantique", "رومانسية", "عشق"],
  horror: ["horror", "horreur", "رعب"],
  scifi: ["scifi", "science fiction", "خيال علمي", "دستوبيا"],
  adventure: ["adventure", "aventure", "مغامرة", "استكشاف"],
  history: ["history", "historical", "histoire", "تاريخ", "حضارة"],
  selfhelp: ["selfhelp", "self help", "development", "تطوير", "تنمية", "تربية"],
  science: ["science", "علوم", "فيزياء", "دماغ"],
  business: ["business", "entrepreneur", "أعمال", "ريادة", "إدارة"],
  spiritual: ["spiritual", "religion", "روحاني", "ديني", "إسلام"],
  poetry: ["poetry", "poésie", "شعر", "ديوان"],
  children: ["children", "kids", "enfant", "أطفال", "فتيان"],
  family: ["family", "famille", "عائلة", "اجتماعية"],
};

function matchesReaderGenre(book: BookSuggestion, genre: string): boolean {
  const searchable = normalizeBookIdentity(
    `${book.title} ${book.category} ${book.subcategory} ${book.atmosphere ?? ""} ${book.moodMatch?.join(" ") ?? ""}`,
  );
  return (READER_GENRE_TERMS[genre] ?? [genre]).some((term) =>
    searchable.includes(normalizeBookIdentity(term)),
  );
}

function scoreReaderGenres(book: BookSuggestion, preferredGenres?: string[]): number {
  if (!preferredGenres?.length) return 0;
  const weights = [14, 10, 7, 4, 2];
  return preferredGenres.slice(0, weights.length).reduce(
    (score, genre, index) => score + (matchesReaderGenre(book, genre) ? weights[index] : 0),
    0,
  );
}

// ─── Extra Scoring (age, occasion, season, month) ────────────────────────────
function scoreExtras(
  book: BookSuggestion,
  opts: { ageGroup?: string; occasion?: string; season?: string }
): number {
  // Map vacation occasions → their natural season for extra season boost
  const VACATION_SEASON: Record<string, string> = {
    summer_vacation: "summer",
    autumn_vacation: "autumn",
    winter_vacation: "winter",
    spring_vacation: "spring",
  };
  const resolvedSeason = opts.occasion ? (VACATION_SEASON[opts.occasion] ?? opts.season) : opts.season;

  let score = 0;
  if (opts.ageGroup && getCanonicalAgeGroups(book).includes(opts.ageGroup as CanonicalAgeGroup)) score += 2;
  if (opts.occasion && book.occasionMatch?.includes(opts.occasion)) score += 2.5;
  // Vacation occasions also get the season boost for their matching season books
  if (resolvedSeason && book.seasonMatch?.includes(resolvedSeason)) score += 1.5;
  // Month-based boost: server uses its own clock (UTC), no need for client input
  const currentMonth = new Date().getMonth() + 1; // 1–12
  if (book.monthMatch?.includes(currentMonth)) score += 1.8;
  return score;
}

// ─── Smart Scoring ────────────────────────────────────────────────────────────
function scoreBook(
  book: BookSuggestion,
  opts: { weather: string; mood: string; timeOfDay: string; city: string; bookLength?: string; readingStyle?: ReadingStyle; likedBooks?: string[]; preferredGenres?: string[]; trending?: TrendingSignals | null }
): number {
  let score = Math.random() * 0.8; // always some randomness for variety
  score += scoreReadingStyle(book, opts.readingStyle, opts.trending);
  score += scoreReaderPreferences(book, opts.likedBooks);
  score += scoreReaderGenres(book, opts.preferredGenres);

  // Weather match
  if (book.weatherMatch?.includes(opts.weather)) score += 3;

  // Mood match
  if (book.moodMatch?.some((m) => opts.mood.includes(m))) score += 2.5;
  if (/مجهد|مرهق|tired|fatigué|fatigue/i.test(opts.mood) && GENTLE_FATIGUE_TITLES.has(book.title)) {
    score += 10;
  }
  if (RECENT_TITLES.has(book.title)) score += 4;

  // Time of day match
  if (book.timeMatch?.includes(opts.timeOfDay)) score += 1.5;

  // City bonus
  if (book.cityBonus?.includes(opts.city)) score += 1;

  // Length match
  if (opts.bookLength && opts.bookLength !== "أي طول" && book.length === opts.bookLength) score += 2;

  // Night = mystery/thriller bonus
  if (opts.timeOfDay === "night" && (book.atmosphere === "mystery" || book.atmosphere === "thriller")) score += 1;

  // Morning = adventure/selfhelp bonus
  if (opts.timeOfDay === "morning" && (book.atmosphere === "adventure" || book.atmosphere === "selfhelp")) score += 1;

  // Rainy days = philosophical + mystery bonus
  if ((opts.weather === "Rain" || opts.weather === "Drizzle") &&
    (book.atmosphere === "philosophical" || book.atmosphere === "mystery")) score += 1;

  // Snow = mystery + thriller + classics bonus
  if (opts.weather === "Snow" && (book.atmosphere === "mystery" || book.atmosphere === "classic" || book.atmosphere === "history")) score += 1.5;

  // Hot/Atmosphere = sci-fi + adventure
  if (opts.weather === "Atmosphere" && (book.atmosphere === "scifi" || book.atmosphere === "adventure")) score += 1.2;

  return score;
}

type ScoredBook = { book: BookSuggestion; score: number };

function scoreRecommendationPool(
  pool: BookSuggestion[],
  exclude: Set<string>,
  ageGroup: CanonicalAgeGroup,
  bookLength: string | undefined,
  scoreContext: Parameters<typeof scoreBook>[1],
  extraContext: { occasion?: string; season?: string },
): ScoredBook[] {
  return pool
    .filter((book) => !isExcludedBook(book.title, exclude))
    .filter((book) => !bookLength || bookLength === "أي طول" || !book.length || book.length === bookLength)
    .filter((book) => getCanonicalAgeGroups(book).includes(ageGroup))
    .map((book) => ({
      book,
      score: scoreBook(book, scoreContext) + scoreExtras(book, { ageGroup, ...extraContext }),
    }))
    .sort((a, b) => b.score - a.score);
}

function mergeScoredBooks(...groups: ScoredBook[][]): ScoredBook[] {
  const bestByIdentity = new Map<string, ScoredBook>();
  for (const group of groups) {
    for (const candidate of group) {
      const identity = `${normalizeBookIdentity(candidate.book.title)}:${normalizeBookIdentity(candidate.book.author)}`;
      const current = bestByIdentity.get(identity);
      if (!current || candidate.score > current.score) bestByIdentity.set(identity, candidate);
    }
  }
  return [...bestByIdentity.values()].sort((a, b) => b.score - a.score);
}

// ─── Quotes & Analysis ────────────────────────────────────────────────────────
// Each mood has 4 quotes — selected by timeOfDay so the same mood gives a fresh
// quote morning / afternoon / evening / night and never repeats in the same session.
const MOOD_QUOTES: Record<string, Record<string, string>> = {
  "متحمس": {
    morning:   "«الصباح هو البداية الذهبية لمن يحمل حماس المستحيل.» — روبرت فروست",
    afternoon: "«الحماس هو الخميرة التي ترفع أحلامك إلى نجوم السماء.» — هنري فورد",
    evening:   "«الحماس لا يُطفئه الغروب — يزداد توهجاً في الهدوء.»",
    night:     "«أعظم ما يحمله المتحمس: أنه ينام وفي قلبه غدٌ أجمل.»",
  },
  "هادئ": {
    morning:   "«الصباح الهادئ يُلملم شتات الروح ويُرتّب الأفكار.»",
    afternoon: "«الهدوء الداخلي هو أعمق شكل من أشكال القوة.» — الدالاي لاما",
    evening:   "«في المساء الهادئ يتكلم القلب بما لم يجرؤ عليه النهار.»",
    night:     "«الهدوء الليلي يُحوّل الكلمات إلى حكمة والأفكار إلى سلام.»",
  },
  "فضولي": {
    morning:   "«فضولك في الصباح هو بوصلة يومك — اتبعه.» — ريتشارد فاينمان",
    afternoon: "«الفضول هو العقل الأكثر صحةً على وجه الأرض.» — ألبرت أينشتاين",
    evening:   "«كل سؤال لم تسأله اليوم هو فصلٌ لم تقرأه بعد.»",
    night:     "«الفضوليون لا يُغلقون عقولهم مع الستائر — الليل يفتح أبواباً أخرى.»",
  },
  "حزين": {
    morning:   "«الحزن الصباحي ليس نهاية — إنه المطر الذي يُنمّي ما لم تزرعه بعد.»",
    afternoon: "«الأحزان تمر مثل الغيوم، وتُخلّف وراءها سماءً أكثر صفاءً.» — جبران خليل جبران",
    evening:   "«في الغروب يجد الحزن نافذةً يتسرب منها إلى هواء أخف.»",
    night:     "«الكتاب ليس هروباً من الحزن — بل يداً ممدودة في الظلام.»",
  },
  "قلق": {
    morning:   "«خُذ نفساً عميقاً بعرض الصباح — القلق يتقلص أمام النور.»",
    afternoon: "«لا تقلق بشأن ما لا تستطيع التحكم فيه، وتصرف بحكمة فيما تستطيع.» — ماركوس أوريليوس",
    evening:   "«المساء يُقنّن القلق: ما لم يُحلّ اليوم ينتظر — والكتاب يُهدّئ الانتظار.»",
    night:     "«القلق في الليل يبحث عن صفحة يستقر عليها — أعطه كتاباً.»",
  },
  "مرهق": {
    morning:   "«البداية المرهقة لا تعني نهاية ثقيلة — الكتاب يُعيد تشغيل الروح.»",
    afternoon: "«الراحة ليست خمولاً — إنها ضرورة يحتاجها العقل كما يحتاجها الجسد.» — جون لوبوك",
    evening:   "«حين يتعب الجسم بحث عن كلمات تحمله بدلاً عنه.»",
    night:     "«الإرهاق الليلي يُذيب مع السطر الأول، ويختفي مع الأخير.»",
  },
  "رومانسي": {
    morning:   "«الحب في الصباح طازج كندى الحديقة — الكلمات تحمله لمن لا يراك.»",
    afternoon: "«الحب وحده يُعلّمنا كيف نكون بشراً حقاً.» — ليو تولستوي",
    evening:   "«المساء هو وقت الحب الصادق — حين تهدأ الضوضاء ويبقى القلب.»",
    night:     "«الليل يحتضن الحب الحقيقي كما تحتضن النجوم الفضاء.»",
  },
  "طموح": {
    morning:   "«كل صباح هو فرصة لم تُعطَ لأحد سواك — استخدمها.»",
    afternoon: "«الأحلام لا تتحقق أثناء النوم، بل حين تستيقظ وتعمل.»",
    evening:   "«مسافة الطموح لا تُقاس بالساعات — بل بالصفحات التي قرأتها.»",
    night:     "«الطموح الليلي يزرع بذوراً تنبت بالفجر.» — نابليون هيل",
  },
  "مغامرة": {
    morning:   "«الصباح هو دعوة للمجهول — الكتاب يُعلّمك كيف تقبلها.»",
    afternoon: "«المغامر الحقيقي لا يبحث عن طريق آمن — يصنع طريقه.» — روبرت فروست",
    evening:   "«قبل الغروب تُغلق المغامرات الحقيقية فصلاً وتبدأ آخر.»",
    night:     "«الليل هو الجزء الخفي من الخريطة — المغامر يقرأه بشغف.»",
  },
  "مشتت": {
    morning:   "«حين يتشتت الذهن صباحاً ابحث عن سطر واحد يُرسو عليه.»",
    afternoon: "«في الهدوء تجد الوضوح، وفي الكتاب تجد الهدوء.»",
    evening:   "«التشتت المسائي يذوب حين تجد قصة تسكن فيها كاملاً.»",
    night:     "«الكتاب مركزٌ في الفوضى — نقطة ثابتة لعقل يتأرجح.»",
  },
  "ألغاز": {
    morning:   "«كل صباح يحمل لغزاً — الفضولي يبحث والقارئ يجد.»",
    afternoon: "«الغموض هو بداية كل معرفة.» — جرتشن روبين",
    evening:   "«مع الغسق تبدأ الأسرار الحقيقية بالكلام.»",
    night:     "«الليل هو الوقت الأمثل لكل ما لا تُفسّره النهارات.»",
  },
  "مجهد": {
    morning:   "«حتى حين يتعب الجسم يبقى العقل عطشاً — الكتاب يرويه.»",
    afternoon: "«حين يكون الجسم مرهقاً، يتكلم الكتاب بدلاً عنك.»",
    evening:   "«الإجهاد المسائي يُذيب مع أول صفحة تحبس فيها أنفاسك.»",
    night:     "«الإجهاد دعوة للراحة، والكتاب أجملها وأعمقها.»",
  },
};

// Extra time-keyed quotes used as final fallback when no mood matches
const FALLBACK_QUOTES: Record<string, string> = {
  morning:   "«الصباح وعد جديد — والكتاب أحسن من تُفتح به صفحته.»",
  afternoon:  "«الكتاب مرآة العقل وتاريخ الروح.» — بورخيس",
  evening:   "«في المساء يُعيد الكتاب ما أخذه منك اليوم.»",
  night:     "«الليل والكتاب شريكان لا يخذلان بعضهما.»",
};

// ─── English Mood Quotes ──────────────────────────────────────────────────────
const MOOD_QUOTES_EN: Record<string, string> = {
  "excited":    "\"Enthusiasm is the yeast that raises your dough to the stars.\" — Henry Ford",
  "calm":       "\"Calm is a superpower.\" — The Dalai Lama",
  "curious":    "\"Curiosity is the most powerful thing you own.\" — James Cameron",
  "sad":        "\"Sorrows pass like clouds, leaving a clearer sky behind.\" — Khalil Gibran",
  "anxious":    "\"You can't stop the waves, but you can learn to surf.\" — Jon Kabat-Zinn",
  "tired":      "\"Almost everything will work again if you unplug it for a few minutes — including you.\" — Anne Lamott",
  "romantic":   "\"Love is the only force capable of transforming an enemy into a friend.\" — Martin Luther King Jr.",
  "ambitious":  "\"Dreams don't work unless you do.\" — John C. Maxwell",
  "adventure":  "\"Not all those who wander are lost.\" — J.R.R. Tolkien",
  "distracted": "\"In the silence you will find what you need.\" — Lao Tzu",
};
const FALLBACK_QUOTES_EN: string =
  "\"A reader lives a thousand lives before he dies. The man who never reads lives only one.\" — George R.R. Martin";

// ─── French Mood Quotes ───────────────────────────────────────────────────────
const MOOD_QUOTES_FR: Record<string, string> = {
  "متحمس":    "«L'enthousiasme est la levure qui fait monter votre pâte jusqu'aux étoiles.» — Henry Ford",
  "هادئ":     "«Le calme est une force.» — Le Dalaï-Lama",
  "فضولي":    "«La curiosité est la chose la plus puissante que vous possédez.»",
  "حزين":     "«Les chagrins passent comme des nuages et laissent un ciel plus clair.» — Khalil Gibran",
  "قلق":      "«On ne peut pas arrêter les vagues, mais on peut apprendre à surfer.»",
  "مرهق":     "«Presque tout fonctionne mieux si vous le débranchez quelques minutes — vous y compris.»",
  "رومانسي":  "«L'amour seul peut transformer un ennemi en ami.» — Martin Luther King",
  "طموح":     "«Les rêves ne fonctionnent que si vous travaillez.»",
  "مغامرة":   "«Tous ceux qui errent ne sont pas perdus.» — Tolkien",
  "مشتت":     "«Dans le silence, tu trouveras ce dont tu as besoin.» — Lao Tseu",
};
const FALLBACK_QUOTES_FR: string =
  "«Un lecteur vit mille vies avant de mourir. Celui qui ne lit jamais n'en vit qu'une.» — George R.R. Martin";

const TIME_ANALYSIS: Record<string, string> = {
  morning:   "الصباح الباكر وقت الوضوح والإمكانية — ذهنك في أقوى حالاته ليستوعب أعمق الأفكار.",
  afternoon: "المنتصف النهاري وقت التأمل الهادئ — أجواء مثالية للقراءة المتأنية.",
  evening:   "المساء يفتح أبواب التأمل والعمق — وقت الكتب التي تُحرّك المشاعر.",
  night:     "الليل يُزيل الضوضاء ويُحيي الأفكار الكبرى — الكتب الثقيلة تجد طريقها إلى العقل هنا.",
};

const WEATHER_ANALYSIS: Record<string, string> = {
  Clear:        "الجو المشمس يوقظ الطاقة ويُهيئ الروح للاستيعاب والإلهام.",
  Clouds:       "الغيوم تخلق جواً من التأمل العميق — بعيداً عن صخب الأيام الصافية.",
  Rain:         "صوت المطر على النوافذ هو أجمل موسيقى للقراءة — يعزلك بلطف عن العالم.",
  Drizzle:      "رذاذ خفيف وهواء منعّم — أجواء رائعة لكتب تحتاج تركيزاً وتأملاً.",
  Thunderstorm: "العاصفة تجعل الدفء الداخلي أجمل — الكتاب الرفيق المثالي في ليلة كهذه.",
  Snow:         "الثلج يُحوّل العالم إلى سكون لوحي — وقت الكتب التي تأخذك إلى أعماق.",
  Atmosphere:   "الضباب والرياح الرملية يُضفيان غموضاً جميلاً على اليوم.",
};

function getMoodQuote(mood: string, timeOfDay: string, language?: string): string {
  const lang = language ?? "ar";

  if (lang === "en") {
    for (const [k, q] of Object.entries(MOOD_QUOTES_EN)) {
      if (mood.toLowerCase().includes(k)) return q;
    }
    // Try Arabic mood keys as fallback lookup
    for (const [k, q] of Object.entries(MOOD_QUOTES_EN)) { void k; void q; }
    return FALLBACK_QUOTES_EN;
  }

  if (lang === "fr") {
    for (const [k, q] of Object.entries(MOOD_QUOTES_FR)) {
      if (mood.includes(k)) return q;
    }
    return FALLBACK_QUOTES_FR;
  }

  // Arabic (default)
  for (const [k, byTime] of Object.entries(MOOD_QUOTES)) {
    if (mood.includes(k)) {
      return byTime[timeOfDay] ?? byTime["afternoon"] ?? Object.values(byTime)[0];
    }
  }
  return FALLBACK_QUOTES[timeOfDay] ?? FALLBACK_QUOTES["afternoon"];
}

const TIME_ANALYSIS_EN: Record<string, string> = {
  morning:   "Early morning sharpens the mind — the perfect time to absorb deep ideas.",
  afternoon: "The midday calm invites focused, unhurried reading.",
  evening:   "Evening opens the door to reflection and meaningful stories.",
  night:     "The quiet of night carries great thoughts to new heights.",
};
const TIME_ANALYSIS_FR: Record<string, string> = {
  morning:   "Le matin aiguise l'esprit — le moment idéal pour absorber de grandes idées.",
  afternoon: "Le calme de midi invite à une lecture posée et profonde.",
  evening:   "Le soir ouvre la porte à la réflexion et aux histoires qui touchent.",
  night:     "Le silence de la nuit porte les grandes pensées vers de nouveaux horizons.",
};
const WEATHER_ANALYSIS_EN: Record<string, string> = {
  Clear:        "Sunny skies awaken energy and prime the soul for inspiration.",
  Clouds:       "Clouds create a mood of deep contemplation, away from the noise.",
  Rain:         "Rain on the window is the finest music for reading — gently closing out the world.",
  Drizzle:      "A soft drizzle and fresh air — perfect for books that ask for focus and thought.",
  Thunderstorm: "The storm makes inner warmth all the sweeter — a book is the ideal companion tonight.",
  Snow:         "Snow turns the world into silent canvas — time for books that take you inward.",
  Atmosphere:   "Fog and wind lend a beautiful mystery to the day.",
};
const WEATHER_ANALYSIS_FR: Record<string, string> = {
  Clear:        "Le soleil réveille l'énergie et prépare l'âme à l'inspiration.",
  Clouds:       "Les nuages créent une ambiance de contemplation profonde.",
  Rain:         "La pluie sur la fenêtre est la plus belle musique pour lire.",
  Drizzle:      "Une bruine légère et l'air frais — idéal pour les livres qui demandent concentration.",
  Thunderstorm: "L'orage rend la chaleur intérieure encore plus douce — un livre est le compagnon idéal.",
  Snow:         "La neige transforme le monde en silence — l'heure des livres qui vous emportent.",
  Atmosphere:   "Le brouillard et le vent ajoutent un mystère envoûtant à la journée.",
};

function getAnalysis(weather: string, _mood: string, timeOfDay: string, _city: string, language?: string): string {
  const lang = language ?? "ar";
  if (lang === "en") {
    const w = WEATHER_ANALYSIS_EN[weather] ?? WEATHER_ANALYSIS_EN["Clear"];
    const t = TIME_ANALYSIS_EN[timeOfDay] ?? TIME_ANALYSIS_EN["afternoon"];
    return `${t} ${w} Weather and mood align today to craft a rare reading experience made just for you.`;
  }
  if (lang === "fr") {
    const w = WEATHER_ANALYSIS_FR[weather] ?? WEATHER_ANALYSIS_FR["Clear"];
    const t = TIME_ANALYSIS_FR[timeOfDay] ?? TIME_ANALYSIS_FR["afternoon"];
    return `${t} ${w} Aujourd'hui, météo et humeur s'unissent pour créer une expérience de lecture unique, rien que pour vous.`;
  }
  const w = WEATHER_ANALYSIS[weather] ?? WEATHER_ANALYSIS["Clear"];
  const t = TIME_ANALYSIS[timeOfDay] ?? TIME_ANALYSIS["afternoon"];
  return `${t} ${w} يجتمع الطقس والمزاج اليوم ليصنعا توليفة قراءة نادرة خُصّصت لك وحدك.`;
}

// ─── Routes ────────────────────────────────────────────────────────────────────
router.post("/recommendations", async (req, res): Promise<void> => {
  const parsed = CreateRecommendationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    city, mood, category, weatherCondition, temperature,
    excludeBooks, likedBooks, dislikedBooks, bookLength, timeOfDay, cityName,
    language, ageGroup: _requestedAgeGroup, occasion, season, cityBookLang, readingStyle, preferredGenres,
  } = parsed.data;
  const ageGroup: CanonicalAgeGroup = (_requestedAgeGroup as CanonicalAgeGroup | undefined) ?? "adult";
  if (hasUnsafeRecommendationInput({ city, mood, category, weatherCondition, excludeBooks, likedBooks, dislikedBooks, preferredGenres })) {
    res.status(413).json({ error: "طلب التوصية يتجاوز الحدود المسموحة" });
    return;
  }

  // cityBookLang (from city selection) takes priority over UI language for book filtering
  const bookLang = cityBookLang ?? language;
  const fatigueMood = /مجهد|مرهق|tired|fatigué|fatigue/i.test(mood);
  const categoryPool = fatigueMood && ageGroup === "adult"
    ? getGentleFatigueBooks(bookLang)
    : getCategoryBooks(category, bookLang);
  const profilePool = preferredGenres?.length && !fatigueMood
    ? BOOKS.filter((book) =>
        (book.language ?? "ar") === (bookLang ?? "ar")
        && preferredGenres.slice(0, 3).some((genre) => matchesReaderGenre(book, genre)),
      )
    : [];
  const personalizedPool = [...categoryPool, ...profilePool].filter((book, index, all) =>
    all.findIndex((candidate) =>
      normalizeBookIdentity(candidate.title) === normalizeBookIdentity(book.title)
      && normalizeBookIdentity(candidate.author) === normalizeBookIdentity(book.author)
    ) === index,
  );
  const pool = personalizedPool;
  const exclude = new Set(
    [...(excludeBooks ?? []), ...(likedBooks ?? []), ...(dislikedBooks ?? [])]
      .map(normalizeEditionTitle)
      .filter(Boolean),
  );
  const tod = timeOfDay ?? "afternoon";
  const resolvedCity = cityName ?? city;
  const trending = readingStyle === "trending" ? getCurrentTrendingSignals() : null;

  // Prefer unseen books in the requested category. If that pool is exhausted,
  // broaden to new books in the same language and age group before allowing a
  // final repeat, so repeated searches do not return an empty response.
  const scoreContext = {
    weather: weatherCondition,
    mood,
    timeOfDay: tod,
    city: resolvedCity,
    bookLength,
    readingStyle,
    likedBooks,
    preferredGenres,
    trending,
  };
  const broaderPool = BOOKS.filter((book) =>
    (book.language ?? "ar") === (bookLang ?? "ar")
    && getCanonicalAgeGroups(book).includes(ageGroup),
  );
  let scored = scoreRecommendationPool(pool, exclude, ageGroup, bookLength, scoreContext, { occasion, season });
  if (scored.length < 3) {
    scored = mergeScoredBooks(
      scored,
      scoreRecommendationPool(broaderPool, exclude, ageGroup, bookLength, scoreContext, { occasion, season }),
    );
  }
  if (scored.length < 3) {
    scored = mergeScoredBooks(
      scored,
      scoreRecommendationPool(pool.length > 0 ? pool : broaderPool, new Set(), ageGroup, bookLength, scoreContext, { occasion, season }),
    );
  }

  // Take top picks (ensure variety from the scored list)
  const picked: BookSuggestion[] = [];
  const pickedBooks = new Set<string>();
  const seenAtmospheres = new Set<string>();
  for (const { book } of scored) {
    const identity = `${normalizeBookIdentity(book.title)}:${normalizeBookIdentity(book.author)}`;
    if (pickedBooks.has(identity)) continue;
    const atmosphere = book.atmosphere ?? book.category;
    if (!seenAtmospheres.has(atmosphere)) {
      picked.push(book);
      pickedBooks.add(identity);
      seenAtmospheres.add(atmosphere);
    }
    if (picked.length >= 3) break;
  }

  if (picked.length < 3) {
    for (const { book } of scored) {
      const identity = `${normalizeBookIdentity(book.title)}:${normalizeBookIdentity(book.author)}`;
      if (!pickedBooks.has(identity)) {
        picked.push(book);
        pickedBooks.add(identity);
      }
      if (picked.length >= 3) break;
    }
  }

  const books = picked.slice(0, 3).map((book) => withResolvedContentWarnings(book, ageGroup));
  // The selected book language controls every piece of recommendation content,
  // including the quote and analysis—not only the book pool.
  const moodQuote  = getMoodQuote(mood, tod, bookLang);
  const aiAnalysis = getAnalysis(weatherCondition, mood, tod, resolvedCity, bookLang);

  const createdAt = new Date();
  const baseResult = {
    id: 0,
    city,
    mood,
    category,
    weatherCondition,
    temperature,
    books,
    moodQuote,
    aiAnalysis,
    createdAt: createdAt.toISOString(),
  };

  let resultData = baseResult;
  if (req.isAuthenticated()) {
    const [inserted] = await db
      .insert(recommendationsTable)
      .values({
        userId: req.user.id,
        city,
        mood,
        category,
        weatherCondition,
        temperature,
        books: books as unknown as Record<string, unknown>[],
        moodQuote,
        aiAnalysis,
      })
      .returning();
    if (inserted) {
      resultData = {
        ...baseResult,
        id: inserted.id,
        createdAt: inserted.createdAt.toISOString(),
      };
    }
  }

  const result = CreateRecommendationResponse.parse(resultData);

  res.json(result);
});

router.get("/recommendations", requiresAuth, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "10"), 10) || 10, 50);
  const rows = await db
    .select()
    .from(recommendationsTable)
    .where(eq(recommendationsTable.userId, req.user!.id))
    .orderBy(desc(recommendationsTable.createdAt))
    .limit(limit);
  const result = ListRecommendationsResponse.parse(
    rows.map((r) => ({ ...r, books: r.books as BookSuggestion[], createdAt: r.createdAt.toISOString() }))
  );
  res.json(result);
});

router.get("/recommendations/stats", requiresAuth, async (req, res): Promise<void> => {
  const userFilter = eq(recommendationsTable.userId, req.user!.id);
  const [totalResult, moodRows, categoryRows, weatherRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(recommendationsTable).where(userFilter),
    db.select({ mood: recommendationsTable.mood, count: sql<number>`count(*)::int` })
      .from(recommendationsTable).where(userFilter).groupBy(recommendationsTable.mood).orderBy(desc(sql`count(*)`)).limit(5),
    db.select({ category: recommendationsTable.category, count: sql<number>`count(*)::int` })
      .from(recommendationsTable).where(userFilter).groupBy(recommendationsTable.category).orderBy(desc(sql`count(*)`)).limit(5),
    db.select({ condition: recommendationsTable.weatherCondition, count: sql<number>`count(*)::int` })
      .from(recommendationsTable).where(userFilter).groupBy(recommendationsTable.weatherCondition).orderBy(desc(sql`count(*)`)).limit(5),
  ]);

  const result = GetRecommendationStatsResponse.parse({
    totalRecommendations: totalResult[0]?.count ?? 0,
    topMoods: moodRows,
    topCategories: categoryRows,
    weatherBreakdown: weatherRows,
  });
  res.json(result);
});

export default router;
