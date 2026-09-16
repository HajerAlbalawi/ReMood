import type { Lang } from "./i18n";

export type Quote = {
  text: string;
  author: string;
};

export const QUOTES: Record<Lang, Quote[]> = {
  // ── العربية ─────────────────────────────────────────────────────────────────
  ar: [
    {
      text: "الكتب هي أطياف تسكن في عقولنا، وحين يشتد المطر في الخارج، تصبح تلك الأطياف وطناً دافئاً للروح.",
      author: "جبران خليل جبران",
    },
    {
      text: "في الطقس البارد والغائم، وحدها الكلمات القادمة من الأعماق تستطيع أن تمنحنا الدفء الذي عجزت عنه الشمس.",
      author: "أحلام مستغانمي",
    },
    {
      text: "الطبيعة تتحدث بلغات شتى؛ فمن ريح هادئة إلى سماء ممطرة، وفي كل طقس، هناك كتاب ينتظر أن يترجم ما يجول في خاطرك.",
      author: "ميخائيل نعيمة",
    },
    {
      text: "الأيام الغائمة تدعونا للتأمل، وأفضل مرآة للتأمل هي صفحات كتاب قديم تحكي عن أسرار النفوس.",
      author: "نجيب محفوظ",
    },
    {
      text: "وعلى هذا الأرض ما يستحق الحياة.. كجلسة هادئة تحت مطر خفيف مع كتاب يختصر مسافات الحنين.",
      author: "محمود درويش",
    },
    {
      text: "حين يعكر الطقس صفو يومك، افتح كتاباً.. ستجد فيه سماءً أخرى تتسع لكل غيومك.",
      author: "غادة السمان",
    },
    {
      text: "ما أجمل أن يختلي المرء بنفسه في يوم عاصف، وحوله أسفار ناطقة تهدئ صخب الطبيعة في صدره.",
      author: "المنفلوطي",
    },
    {
      text: "الصحراء تعلمك قراءة السكينة في حرها، والكتب تعلمك قراءة العواصف في بردها.",
      author: "إبراهيم الكوني",
    },
    {
      text: "إن كتاباً جيداً لصديق وفيّ في ليلة شتوية باردة، يغنيك عن ألف وجه يتلوّن مع تقلبات الجو.",
      author: "مصطفى لطفي المنفلوطي",
    },
    {
      text: "القراءة تنعش الروح تماماً كما تنعش قطرات المطر الساقطة أوراق الشجر اليابسة.",
      author: "عباس محمود العقاد",
    },
  ],

  // ── English ──────────────────────────────────────────────────────────────────
  en: [
    {
      text: "Lock up your libraries if you like; but there is no gate, no lock, no bolt that you can set upon the freedom of my mind.",
      author: "Virginia Woolf",
    },
    {
      text: "You can never get a cup of tea large enough or a book long enough to suit me.",
      author: "C.S. Lewis",
    },
    {
      text: "Without libraries what have we? We have no past and no future.",
      author: "Ray Bradbury",
    },
    {
      text: "A reader lives a thousand lives before he dies. The man who never reads lives only one.",
      author: "George R.R. Martin",
    },
    {
      text: "The person, be it gentleman or lady, who has not pleasure in a good novel, must be intolerably stupid.",
      author: "Jane Austen",
    },
    {
      text: "There is no friend as loyal as a book.",
      author: "Ernest Hemingway",
    },
    {
      text: "It was one of those March days when the sun shines hot and the wind blows cold: when it is summer in the light, and winter in the shade.",
      author: "Charles Dickens",
    },
    {
      text: "Whatever our souls are made of, his and mine are the same.",
      author: "Emily Brontë",
    },
    {
      text: "I do believe something very magical can happen when you read a good book.",
      author: "J.K. Rowling",
    },
    {
      text: "Books are the treasured wealth of the world and the fit inheritance of generations and nations.",
      author: "Henry David Thoreau",
    },
  ],

  // ── Français ─────────────────────────────────────────────────────────────────
  fr: [
    {
      text: "Lire, c'est boire et manger. L'esprit qui ne lit pas maigrit comme le corps qui ne mange pas.",
      author: "Victor Hugo",
    },
    {
      text: "Au milieu de l'hiver, j'apprenais enfin qu'il y avait en moi un été invincible.",
      author: "Albert Camus",
    },
    {
      text: "Chaque lecteur est, quand il lit, le propre lecteur de soi-même.",
      author: "Marcel Proust",
    },
    {
      text: "Tous les genres sont bons, hors le genre ennuyeux.",
      author: "Voltaire",
    },
    {
      text: "Lisez peu, mais lisez bien.",
      author: "Jean-Jacques Rousseau",
    },
    {
      text: "Lisez pour vivre.",
      author: "Gustave Flaubert",
    },
    {
      text: "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.",
      author: "Antoine de Saint-Exupéry",
    },
    {
      text: "Toute la sagesse humaine se résume en deux mots : attendre et espérer.",
      author: "Alexandre Dumas",
    },
    {
      text: "Enivrez-vous de vin, de poésie ou de vertu, à votre guise.",
      author: "Charles Baudelaire",
    },
    {
      text: "Il y a des matins où le ciel bas et lourd invite admirablement au murmure des pages qui se tournent.",
      author: "Colette",
    },
  ],
};
