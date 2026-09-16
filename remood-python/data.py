"""Data and translations for the standalone Python version of ReMood."""

from __future__ import annotations

from dataclasses import dataclass


LANGUAGE_LABELS = {
    "ar": "العربية",
    "en": "English",
    "fr": "Français",
}

UI = {
    "ar": {
        "subtitle": "رفيقك الشخصي لاختيار الكتاب المناسب لمزاجك",
        "where": "أين أنت الآن؟",
        "weather": "طقس مدينتك",
        "mood": "كيف تشعر الآن؟",
        "category": "ماذا تريد أن تقرأ؟",
        "length": "كم وقتك للقراءة؟",
        "age": "فئتك العمرية",
        "occasion": "مناسبة خاصة",
        "season": "الفصل الحالي",
        "book_language": "لغة الكتاب",
        "automatic": "تلقائي حسب المدينة",
        "read_books": "كتب قرأتها مسبقاً (اختياري)",
        "read_books_help": "اكتب العناوين مفصولة بفواصل حتى لا تظهر في النتائج.",
        "recommend": "رشّح لي كتباً الآن",
        "results": "ترشيحاتك",
        "why": "لماذا هذا الكتاب؟",
        "read_or_listen": "اقرأ أو استمع",
        "want_to_read": "أريد قراءته",
        "analysis": "تحليل الأجواء",
        "mood_quote": "اقتباس للمزاج",
        "not_available": "غير متاح",
        "weather_error": "تعذّر جلب الطقس المباشر",
        "weather_fallback": "سيتم استخدام طقس غائم مؤقتاً للتوصية. يمكنك إعادة المحاولة.",
        "generated": "تم إنشاء الترشيحات",
        "manual_weather": "حالة الطقس المستخدمة",
        "upload": "خلفية أو صورة شخصية (اختياري)",
        "clear_image": "إزالة الصورة",
        "free": "مجاني",
        "subscription": "اشتراك",
        "paid": "مدفوع",
        "no_results": "لم نجد كتباً مطابقة تماماً؛ جرّب تغيير الفئة أو طول الكتاب.",
    },
    "en": {
        "subtitle": "Your personal guide to the perfect book for your mood",
        "where": "Where are you?",
        "weather": "Your weather",
        "mood": "How do you feel?",
        "category": "What do you want to read?",
        "length": "How much time do you have?",
        "age": "Your age group",
        "occasion": "Special occasion",
        "season": "Current season",
        "book_language": "Book language",
        "automatic": "Automatic by city",
        "read_books": "Books you have already read (optional)",
        "read_books_help": "Enter titles separated by commas to exclude them.",
        "recommend": "Recommend books for me",
        "results": "Your recommendations",
        "why": "Why this book?",
        "read_or_listen": "Read or Listen",
        "want_to_read": "I want to read it",
        "analysis": "Atmosphere analysis",
        "mood_quote": "Mood quote",
        "not_available": "Not available",
        "weather_error": "Could not fetch live weather",
        "weather_fallback": "Cloudy weather will be used temporarily. You can retry.",
        "generated": "Recommendations created",
        "manual_weather": "Weather used for recommendations",
        "upload": "Background or profile image (optional)",
        "clear_image": "Remove image",
        "free": "Free",
        "subscription": "Subscription",
        "paid": "Paid",
        "no_results": "No exact matches found; try another category or reading length.",
    },
    "fr": {
        "subtitle": "Votre guide personnel pour le livre parfait selon votre humeur",
        "where": "Où êtes-vous ?",
        "weather": "Votre météo",
        "mood": "Comment vous sentez-vous ?",
        "category": "Que voulez-vous lire ?",
        "length": "Combien de temps avez-vous ?",
        "age": "Votre groupe d'âge",
        "occasion": "Occasion spéciale",
        "season": "Saison actuelle",
        "book_language": "Langue du livre",
        "automatic": "Automatique selon la ville",
        "read_books": "Livres déjà lus (facultatif)",
        "read_books_help": "Saisissez les titres séparés par des virgules pour les exclure.",
        "recommend": "Recommandez-moi des livres",
        "results": "Vos recommandations",
        "why": "Pourquoi ce livre ?",
        "read_or_listen": "Lire ou écouter",
        "want_to_read": "Je veux le lire",
        "analysis": "Analyse de l'ambiance",
        "mood_quote": "Citation pour l'humeur",
        "not_available": "Indisponible",
        "weather_error": "Impossible de récupérer la météo",
        "weather_fallback": "Une météo nuageuse sera utilisée temporairement. Réessayez si besoin.",
        "generated": "Recommandations créées",
        "manual_weather": "Météo utilisée pour les recommandations",
        "upload": "Image de fond ou de profil (facultatif)",
        "clear_image": "Supprimer l'image",
        "free": "Gratuit",
        "subscription": "Abonnement",
        "paid": "Payant",
        "no_results": "Aucune correspondance exacte ; essayez une autre catégorie ou longueur.",
    },
}

MOODS = {
    "ar": [
        ("excited", "متحمس للقراءة 💡"),
        ("calm", "هادئ / مسترخي ☕"),
        ("curious", "فضولي ومتعطش للمعلومات 🧠"),
        ("sad", "حزين / يبحث عن إلهام 🍃"),
        ("adventure", "مشتاق للمغامرة والإثارة 🧭"),
        ("distracted", "مشتت الذهن ويريد التركيز 🎯"),
        ("tired", "مجهد ويبحث عن كتاب خفيف ☁️"),
        ("romantic", "رومانسي وعاطفي ❤️"),
        ("ambitious", "متفائل وطموح للمستقبل 🚀"),
        ("mystery", "محب للألغاز والغموض 🔍"),
    ],
    "en": [
        ("excited", "Excited to read 💡"),
        ("calm", "Calm & relaxed ☕"),
        ("curious", "Curious & hungry for knowledge 🧠"),
        ("sad", "Sad / looking for inspiration 🍃"),
        ("adventure", "Craving adventure & thrills 🧭"),
        ("distracted", "Distracted & need to focus 🎯"),
        ("tired", "Tired & want a light read ☁️"),
        ("romantic", "Romantic & emotional ❤️"),
        ("ambitious", "Optimistic & ambitious 🚀"),
        ("mystery", "Love mysteries & puzzles 🔍"),
    ],
    "fr": [
        ("excited", "Enthousiaste pour la lecture 💡"),
        ("calm", "Calme et détendu ☕"),
        ("curious", "Curieux et avide de connaissances 🧠"),
        ("sad", "Triste / en quête d'inspiration 🍃"),
        ("adventure", "En manque d'aventure 🧭"),
        ("distracted", "Distrait et besoin de concentration 🎯"),
        ("tired", "Fatigué, envie de lecture légère ☁️"),
        ("romantic", "Romantique et émotionnel ❤️"),
        ("ambitious", "Optimiste et ambitieux 🚀"),
        ("mystery", "Adore les mystères 🔍"),
    ],
}

CATEGORIES = {
    "ar": [
        ("adventure", "روايات المغامرة والاستكشاف 🗺️"),
        ("mystery", "الروايات البوليسية والغموض 🔍"),
        ("romance", "الروايات الرومانسية والعاطفية 💕"),
        ("scifi", "الخيال العلمي والفانتازيا 🚀"),
        ("thriller", "روايات الإثارة والتشويق 😱"),
        ("classic", "الروايات العربية والعالمية الكلاسيكية 📖"),
        ("selfhelp", "تطوير الذات والنجاح 🌟"),
        ("philosophy", "الفلسفة والتفكير النقدي 💭"),
        ("history", "التاريخ والحضارات 🏛️"),
        ("children", "قصص وحكايات الأطفال 🧒"),
    ],
    "en": [
        ("adventure", "Adventure & Exploration 🗺️"),
        ("mystery", "Mystery & Detective 🔍"),
        ("romance", "Romance & Emotional Fiction 💕"),
        ("scifi", "Sci-Fi & Fantasy 🚀"),
        ("thriller", "Thrillers & Suspense 😱"),
        ("classic", "Classic Literature 📖"),
        ("selfhelp", "Self-Help & Success 🌟"),
        ("philosophy", "Philosophy & Critical Thinking 💭"),
        ("history", "History & Civilizations 🏰"),
        ("children", "Children's Stories & Fairy Tales 🧒"),
    ],
    "fr": [
        ("adventure", "Aventure & Exploration 🗺️"),
        ("mystery", "Mystère & Policier 🔍"),
        ("romance", "Romans romantiques 💕"),
        ("scifi", "Science-Fiction & Fantaisie 🚀"),
        ("thriller", "Thrillers & Suspense 😱"),
        ("classic", "Littérature classique 📖"),
        ("selfhelp", "Développement personnel 🌟"),
        ("philosophy", "Philosophie & Pensée critique 💭"),
        ("history", "Histoire & Civilisations 🏰"),
        ("children", "Contes & Histoires pour enfants 🧒"),
    ],
}

LENGTHS = {
    "ar": [("any", "📚 أي طول يناسبني"), ("short", "📖 قصير — أقل من 250 صفحة"), ("long", "📕 طويل — أكثر من 350 صفحة")],
    "en": [("any", "📚 Any length works"), ("short", "📖 Short — under 250 pages"), ("long", "📕 Long — over 350 pages")],
    "fr": [("any", "📚 Toute longueur"), ("short", "📖 Court — moins de 250 pages"), ("long", "📕 Long — plus de 350 pages")],
}

AGE_GROUPS = {
    "ar": [("", "كل الأعمار"), ("children", "أطفال 🧒 (8-12)"), ("teen", "مراهقون 🎒 (13-17)"), ("young_adult", "شباب ✨ (18-30)"), ("adult", "بالغون 📚 (31-55)"), ("senior", "كبار السن 🌟 (+55)")],
    "en": [("", "All ages"), ("children", "Children 🧒 (8-12)"), ("teen", "Teenagers 🎒 (13-17)"), ("young_adult", "Young Adults ✨ (18-30)"), ("adult", "Adults 📚 (31-55)"), ("senior", "Senior Readers 🌟 (55+)")],
    "fr": [("", "Tous les âges"), ("children", "Enfants 🧒 (8-12)"), ("teen", "Adolescents 🎒 (13-17)"), ("young_adult", "Jeunes adultes ✨ (18-30)"), ("adult", "Adultes 📚 (31-55)"), ("senior", "Séniors 🌟 (55+)")],
}

OCCASIONS = {
    "ar": [("none", "لا مناسبة محددة"), ("new_year", "رأس السنة الجديدة 🎆"), ("world_book_day", "اليوم العالمي للكتاب 📚"), ("summer_vacation", "إجازة الصيف ☀️"), ("winter_vacation", "إجازة الشتاء ❄️"), ("ramadan", "رمضان الكريم 🌙")],
    "en": [("none", "No special occasion"), ("new_year", "New Year 🎆"), ("world_book_day", "World Book Day 📚"), ("summer_vacation", "Summer Vacation ☀️"), ("winter_vacation", "Winter Vacation ❄️"), ("ramadan", "Ramadan 🌙")],
    "fr": [("none", "Aucune occasion"), ("new_year", "Nouvel An 🎆"), ("world_book_day", "Journée Mondiale du Livre 📚"), ("summer_vacation", "Vacances d'été ☀️"), ("winter_vacation", "Vacances d'hiver ❄️"), ("ramadan", "Ramadan 🌙")],
}


@dataclass(frozen=True)
class City:
    name: str
    en: str
    fr: str
    flag: str
    latitude: float
    longitude: float
    timezone: str
    book_language: str

    def label(self, language: str) -> str:
        city_name = self.name if language == "ar" else self.en if language == "en" else self.fr
        return f"{self.flag} {city_name}"


CITIES = [
    City("الرياض", "Riyadh", "Riyad", "🇸🇦", 24.7136, 46.6753, "Asia/Riyadh", "ar"),
    City("جدة", "Jeddah", "Djeddah", "🇸🇦", 21.4858, 39.1925, "Asia/Riyadh", "ar"),
    City("الدوحة", "Doha", "Doha", "🇶🇦", 25.2854, 51.5310, "Asia/Qatar", "ar"),
    City("دبي", "Dubai", "Dubaï", "🇦🇪", 25.2048, 55.2708, "Asia/Dubai", "ar"),
    City("القاهرة", "Cairo", "Le Caire", "🇪🇬", 30.0444, 31.2357, "Africa/Cairo", "ar"),
    City("باريس", "Paris", "Paris", "🇫🇷", 48.8566, 2.3522, "Europe/Paris", "fr"),
    City("لندن", "London", "Londres", "🇬🇧", 51.5074, -0.1278, "Europe/London", "en"),
    City("برلين", "Berlin", "Berlin", "🇩🇪", 52.5200, 13.4050, "Europe/Berlin", "en"),
    City("موسكو", "Moscow", "Moscou", "🇷🇺", 55.7558, 37.6176, "Europe/Moscow", "en"),
    City("نيويورك", "New York", "New York", "🇺🇸", 40.7128, -74.0060, "America/New_York", "en"),
    City("طوكيو", "Tokyo", "Tokyo", "🇯🇵", 35.6762, 139.6503, "Asia/Tokyo", "en"),
    City("نيروبي", "Nairobi", "Nairobi", "🇰🇪", -1.2921, 36.8219, "Africa/Nairobi", "en"),
]

WEATHER_LABELS = {
    "ar": {"Clear": "سماء صافية", "Clouds": "غيوم", "Rain": "مطر", "Drizzle": "رذاذ", "Thunderstorm": "عاصفة رعدية", "Snow": "ثلوج", "Atmosphere": "ضباب / غبار"},
    "en": {"Clear": "Clear sky", "Clouds": "Cloudy", "Rain": "Rain", "Drizzle": "Drizzle", "Thunderstorm": "Thunderstorm", "Snow": "Snow", "Atmosphere": "Fog / Dust"},
    "fr": {"Clear": "Ciel dégagé", "Clouds": "Nuageux", "Rain": "Pluie", "Drizzle": "Bruine", "Thunderstorm": "Orage", "Snow": "Neige", "Atmosphere": "Brouillard"},
}


@dataclass(frozen=True)
class Book:
    title: str
    author: str
    language: str
    category: str
    atmosphere: str
    subcategory: str
    rating: str
    length: str
    reason: str
    quote: str
    moods: tuple[str, ...] = ()
    weather: tuple[str, ...] = ()
    times: tuple[str, ...] = ()
    seasons: tuple[str, ...] = ()
    ages: tuple[str, ...] = ("adult", "young_adult", "senior")
    occasions: tuple[str, ...] = ()


BOOKS = [
    # Arabic
    Book("الخيميائي", "باولو كويلو", "ar", "adventure", "adventure", "رحلة وذات", "4.8/5", "short", "رحلة سانتياغو نحو كنزه الخاص تشعل فيك جذوة الحلم وتذكّرك أن تتبع روحك.", "«حين تريد شيئاً، يتآمر الكون كله على مساعدتك.»", ("adventure", "ambitious"), ("Clear",), ("morning", "afternoon"), ("spring", "summer")),
    Book("حول العالم في ثمانين يوماً", "جول فيرن", "ar", "adventure", "adventure", "مغامرة كلاسيكية", "4.5/5", "short", "جولة خاطفة حول الكرة الأرضية تملأ الروح بالحيوية وتناسب نهاراً مشمساً.", "«العالم صغير لمن يعرف كيف يتجوّله.»", ("adventure", "excited", "curious"), ("Clear", "Clouds"), ("morning", "afternoon"), ("summer",)),
    Book("جزيرة الكنز", "روبرت لويس ستيفنسون", "ar", "adventure", "adventure", "مغامرة بحرية", "4.4/5", "short", "قراصنة وخرائط وكنوز مخبأة في جزر مجهولة لقراءة صيفية ممتعة.", "«الإبحار بحثاً عن المجهول هو أجمل ما قد يفعله قلب جسور.»", ("adventure", "excited"), ("Clear", "Clouds"), ("morning", "afternoon"), ("summer",)),
    Book("موسم الهجرة إلى الشمال", "الطيب صالح", "ar", "classic", "philosophical", "أدب عربي", "4.6/5", "short", "نص عميق عن الهوية والرحلة والذاكرة، مثالي للتأمل في مساء هادئ.", "«إنني أجيء إليكم من أرض يطاردها شبح الموت.»", ("calm", "curious", "sad"), ("Rain", "Clouds"), ("evening", "night"), ("autumn", "winter")),
    Book("عزازيل", "يوسف زيدان", "ar", "history", "history", "رواية تاريخية", "4.5/5", "long", "رحلة تاريخية وفكرية غنية تناسب القارئ الباحث عن إجابات.", "«ليس كل ما نعرفه حقاً، وليس كل ما نجهله باطلاً.»", ("curious", "mystery"), ("Clouds", "Rain"), ("evening", "night"), ("autumn", "winter")),
    Book("رجال في الشمس", "غسان كنفاني", "ar", "classic", "philosophical", "أدب إنساني", "4.4/5", "short", "قصة مكثفة تفتح باباً للتفكير في الأمل والاختيارات الإنسانية.", "«لماذا لم تدقوا جدران الخزان؟»", ("sad", "curious"), ("Clouds", "Rain"), ("evening", "night"), ("autumn",)),
    Book("قواعد العشق الأربعون", "إليف شافاق", "ar", "romance", "romance", "رومانسية وتأمل", "4.5/5", "long", "مزيج دافئ من الحب والتحول الداخلي للأمسيات الهادئة.", "«ما من أحد يحب شخصاً آخر من دون أن يتغير.»", ("romantic", "calm"), ("Rain", "Clouds"), ("evening", "night"), ("winter",)),
    Book("الرجل الذي حسب زوجته قبعة", "أوليفر ساكس", "ar", "philosophy", "philosophical", "علم النفس", "4.3/5", "short", "حكايات علمية إنسانية توقظ الفضول وتساعد العقل على التركيز.", "«لكل إنسان قصته، وهذه القصة هي هويته.»", ("curious", "distracted"), ("Clouds", "Rain"), ("afternoon", "evening"), ("autumn", "winter")),
    Book("فاتتني صلاة", "إسلام جمال", "ar", "selfhelp", "spiritual", "تطوير روحي", "4.5/5", "short", "صفحات هادئة تساعدك على استعادة التركيز والسكينة.", "«حين تضيق بك الحياة، اتسع لها بالصلاة.»", ("calm", "tired"), ("Thunderstorm", "Rain", "Clouds"), ("evening", "night"), ("winter",), ("ramadan",)),
    Book("قصص الأنبياء للأطفال", "مجموعة مؤلفين", "ar", "children", "family", "حكايات وقيم", "4.7/5", "short", "حكايات مبسطة ودافئة لجلسة قراءة عائلية.", "«خير القصص ما علّم القلب معنى جميلاً.»", ("calm", "curious"), ("Clear", "Clouds"), ("morning", "afternoon"), ("spring", "summer"), ("children", "teen")),
    # English
    Book("The Alchemist", "Paulo Coelho", "en", "adventure", "adventure", "Journey & Self-discovery", "4.8/5", "short", "Santiago's journey is a timeless reminder to follow your dreams and listen to your inner voice.", "“When you want something, all the universe conspires in helping you to achieve it.”", ("adventure", "ambitious"), ("Clear",), ("morning", "afternoon"), ("spring", "summer")),
    Book("Dune", "Frank Herbert", "en", "scifi", "scifi", "Epic Sci-Fi", "4.9/5", "long", "A sweeping saga of politics, ecology, faith, and human potential on a desert planet.", "“I must not fear. Fear is the mind-killer.”", ("adventure", "curious", "ambitious"), ("Clear", "Atmosphere"), ("afternoon", "evening"), ("summer",)),
    Book("1984", "George Orwell", "en", "scifi", "scifi", "Dystopian Fiction", "4.8/5", "short", "A chilling portrait of power and language that makes you question freedom and truth.", "“War is peace. Freedom is slavery. Ignorance is strength.”", ("curious", "mystery"), ("Clouds", "Rain", "Thunderstorm"), ("evening", "night"), ("autumn", "winter")),
    Book("Atomic Habits", "James Clear", "en", "selfhelp", "selfhelp", "Productivity & Habits", "4.9/5", "short", "A practical system for building good habits and becoming one percent better every day.", "“You do not rise to the level of your goals. You fall to the level of your systems.”", ("ambitious", "distracted", "excited"), ("Clear", "Clouds"), ("morning", "afternoon"), ("spring", "winter"), ("new_year",)),
    Book("Deep Work", "Cal Newport", "en", "selfhelp", "selfhelp", "Focus & Productivity", "4.7/5", "short", "A clear guide to reclaiming attention in a distracted world and making focused work meaningful.", "“Clarity about what matters provides clarity about what does not.”", ("distracted", "ambitious"), ("Clouds", "Rain", "Thunderstorm"), ("afternoon", "evening"), ("autumn", "winter")),
    Book("The Hobbit", "J.R.R. Tolkien", "en", "adventure", "adventure", "Fantasy Adventure", "4.7/5", "long", "A warm, imaginative quest for a rainy day when you want to leave ordinary life behind.", "“Not all those who wander are lost.”", ("adventure", "calm", "excited"), ("Rain", "Clouds"), ("afternoon", "evening"), ("autumn", "winter")),
    Book("Murder on the Orient Express", "Agatha Christie", "en", "mystery", "mystery", "Classic Mystery", "4.6/5", "short", "A clever puzzle for a quiet evening, with clues that reward careful attention.", "“The impossible could not have happened, therefore the impossible must be possible in spite of appearances.”", ("mystery", "curious"), ("Rain", "Clouds", "Thunderstorm"), ("evening", "night"), ("autumn", "winter")),
    Book("The Little Prince", "Antoine de Saint-Exupéry", "en", "classic", "philosophical", "Classic Literature", "4.7/5", "short", "A gentle, philosophical story that brings perspective and wonder to a quiet reading break.", "“It is only with the heart that one can see rightly.”", ("calm", "sad", "curious"), ("Rain", "Clouds"), ("morning", "evening"), ("spring", "autumn")),
    Book("Pride and Prejudice", "Jane Austen", "en", "romance", "romance", "Romantic Classic", "4.8/5", "long", "Wit, weather, and warm human comedy for a reflective evening with a little romance.", "“There is no charm equal to tenderness of heart.”", ("romantic", "calm"), ("Rain", "Clouds"), ("evening", "night"), ("autumn", "winter")),
    Book("The Midnight Library", "Matt Haig", "en", "philosophy", "philosophical", "Hope & Possibility", "4.4/5", "short", "A hopeful exploration of regret and possibility for nights when you need a new perspective.", "“Between life and death there is a library.”", ("sad", "curious", "calm"), ("Snow", "Clouds", "Thunderstorm"), ("night", "evening"), ("winter",)),
    # French
    Book("Le Petit Prince", "Antoine de Saint-Exupéry", "fr", "classic", "philosophical", "Classique", "4.8/5", "short", "Un conte délicat et profond pour un matin paisible et rêveur.", "«On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.»", ("calm", "curious", "sad"), ("Rain", "Clouds"), ("morning", "evening"), ("spring", "autumn")),
    Book("Le Comte de Monte-Cristo", "Alexandre Dumas", "fr", "adventure", "adventure", "Aventure classique", "4.9/5", "long", "Une immense aventure de justice et de renaissance pour les soirées orageuses.", "«Attendre et espérer.»", ("adventure", "sad", "excited"), ("Rain", "Thunderstorm", "Clouds"), ("evening", "night"), ("autumn", "winter")),
    Book("Madame Bovary", "Gustave Flaubert", "fr", "romance", "romance", "Roman réaliste", "4.0/5", "long", "Une prose poétique et une atmosphère française parfaite sous la pluie.", "«Elle voulait mourir, mais elle voulait aussi vivre à Paris.»", ("romantic", "sad", "calm"), ("Rain", "Drizzle"), ("evening", "night"), ("autumn",)),
    Book("L'Étranger", "Albert Camus", "fr", "philosophy", "philosophical", "Existentialisme", "4.4/5", "short", "Une lecture claire et troublante pour interroger le sens, le choix et la liberté.", "«J'ai compris que j'avais détruit l'équilibre du jour.»", ("curious", "sad"), ("Clear", "Atmosphere"), ("afternoon", "evening"), ("summer",)),
    Book("Le Petit Nicolas", "René Goscinny", "fr", "children", "family", "Humour familial", "4.6/5", "short", "Des histoires drôles et chaleureuses pour une lecture familiale pleine de sourires.", "«On a bien rigolé, et c'est déjà beaucoup.»", ("calm", "excited"), ("Clear", "Clouds"), ("morning", "afternoon"), ("spring", "summer"), ("children", "teen")),
    Book("L'Art subtil de s'en foutre", "Mark Manson", "fr", "selfhelp", "selfhelp", "Développement personnel", "4.2/5", "short", "Une perspective directe pour réduire le bruit mental et se concentrer sur l'essentiel.", "«Le désir d'une expérience positive est lui-même une expérience négative.»", ("distracted", "ambitious", "tired"), ("Clouds", "Rain", "Thunderstorm"), ("afternoon", "evening"), ("autumn", "winter")),
    Book("Les Quatre Accords Toltèques", "Don Miguel Ruiz", "fr", "selfhelp", "spiritual", "Sagesse pratique", "4.5/5", "short", "Des principes simples pour retrouver calme, clarté et liberté intérieure.", "«Que votre parole soit impeccable.»", ("calm", "tired", "ambitious"), ("Rain", "Clouds"), ("morning", "evening"), ("spring", "winter")),
    Book("Vingt mille lieues sous les mers", "Jules Verne", "fr", "adventure", "adventure", "Aventure scientifique", "4.6/5", "long", "Une exploration maritime spectaculaire pour les lecteurs curieux et avides d'évasion.", "«La mer est tout !»", ("adventure", "curious", "excited"), ("Clear", "Clouds"), ("morning", "afternoon"), ("summer",)),
    Book("La Peste", "Albert Camus", "fr", "history", "philosophical", "Roman humaniste", "4.4/5", "long", "Une histoire de solidarité et de courage, profonde pour un après-midi de réflexion.", "«Il y a dans les hommes plus de choses à admirer que de choses à mépriser.»", ("sad", "curious", "calm"), ("Clouds", "Rain", "Drizzle"), ("afternoon", "evening"), ("autumn", "winter")),
    Book("Parler pour que les enfants écoutent", "Adele Faber & Elaine Mazlish", "fr", "children", "family", "Éducation positive", "4.9/5", "short", "Des outils concrets pour communiquer avec les enfants avec plus de calme et de confiance.", "«Écouter, c'est le plus grand cadeau qu'on puisse offrir à un enfant.»", ("calm", "tired", "curious"), ("Clouds", "Rain"), ("evening", "afternoon"), ("autumn", "winter"), ("adult", "senior")),
]

MOOD_QUOTES = {
    "ar": {
        "excited": "«الحماس هو الخميرة التي ترفع أحلامك إلى نجوم السماء.» — هنري فورد",
        "calm": "«الهدوء الداخلي هو أعمق شكل من أشكال القوة.» — الدالاي لاما",
        "curious": "«الفضول هو العقل الأكثر صحةً على وجه الأرض.» — ألبرت أينشتاين",
        "sad": "«الأحزان تمر مثل الغيوم، وتُخلّف وراءها سماءً أكثر صفاءً.» — جبران خليل جبران",
        "adventure": "«كل من يتجول ليس تائهاً.» — تولكين",
        "distracted": "«في الهدوء تجد الوضوح، وفي الكتاب تجد الهدوء.»",
        "tired": "«الراحة ليست خمولاً؛ إنها ضرورة يحتاجها العقل.»",
        "romantic": "«الحب وحده يعلّمنا كيف نكون بشراً حقاً.»",
        "ambitious": "«الأحلام لا تتحقق أثناء النوم، بل حين تستيقظ وتعمل.»",
        "mystery": "«الغموض هو بداية كل معرفة.»",
    },
    "en": {
        "excited": '"Enthusiasm is the yeast that raises your dough to the stars." — Henry Ford',
        "calm": '"Calm is a superpower." — The Dalai Lama',
        "curious": '"Curiosity is the most powerful thing you own." — James Cameron',
        "sad": '"Sorrows pass like clouds, leaving a clearer sky behind." — Khalil Gibran',
        "adventure": '"Not all those who wander are lost." — J.R.R. Tolkien',
        "distracted": '"In the silence you will find what you need." — Lao Tzu',
        "tired": '"Almost everything will work again if you unplug it for a few minutes — including you." — Anne Lamott',
        "romantic": '"Love is the only force capable of transforming an enemy into a friend." — Martin Luther King Jr.',
        "ambitious": '"Dreams don’t work unless you do." — John C. Maxwell',
        "mystery": '"The mystery is the beginning of knowledge."',
    },
    "fr": {
        "excited": "«L'enthousiasme est la levure qui fait monter vos rêves jusqu'aux étoiles.» — Henry Ford",
        "calm": "«Le calme est une force.» — Le Dalaï-Lama",
        "curious": "«La curiosité est la chose la plus puissante que vous possédez.»",
        "sad": "«Les chagrins passent comme des nuages et laissent un ciel plus clair.» — Khalil Gibran",
        "adventure": "«Tous ceux qui errent ne sont pas perdus.» — Tolkien",
        "distracted": "«Dans le silence, vous trouverez ce dont vous avez besoin.» — Lao Tseu",
        "tired": "«Presque tout fonctionne mieux si vous le débranchez quelques minutes — vous y compris.»",
        "romantic": "«L'amour seul peut transformer un ennemi en ami.» — Martin Luther King",
        "ambitious": "«Les rêves ne fonctionnent que si vous travaillez.»",
        "mystery": "«Le mystère est le début de toute connaissance.»",
    },
}

ANALYSIS = {
    "ar": {
        "morning": "الصباح الباكر وقت الوضوح والإمكانية — ذهنك في أقوى حالاته لاستيعاب أعمق الأفكار.",
        "afternoon": "هدوء منتصف النهار يدعو إلى قراءة متأنية ومركّزة.",
        "evening": "المساء يفتح أبواب التأمل والقصص التي تحرّك المشاعر.",
        "night": "هدوء الليل يحمل الأفكار الكبرى إلى آفاق جديدة.",
    },
    "en": {
        "morning": "Early morning sharpens the mind — the perfect time to absorb deep ideas.",
        "afternoon": "The midday calm invites focused, unhurried reading.",
        "evening": "Evening opens the door to reflection and meaningful stories.",
        "night": "The quiet of night carries great thoughts to new heights.",
    },
    "fr": {
        "morning": "Le matin aiguise l'esprit — le moment idéal pour absorber de grandes idées.",
        "afternoon": "Le calme de midi invite à une lecture posée et profonde.",
        "evening": "Le soir ouvre la porte à la réflexion et aux histoires qui touchent.",
        "night": "Le silence de la nuit porte les grandes pensées vers de nouveaux horizons.",
    },
}

WEATHER_ANALYSIS = {
    "ar": {
        "Clear": "الجو المشمس يوقظ الطاقة ويهيئ الروح للإلهام.",
        "Clouds": "الغيوم تخلق جواً من التأمل العميق بعيداً عن الصخب.",
        "Rain": "صوت المطر على النوافذ هو أجمل موسيقى للقراءة.",
        "Drizzle": "رذاذ خفيف وهواء منعش — أجواء رائعة للتأمل.",
        "Thunderstorm": "العاصفة تجعل الدفء الداخلي أجمل؛ والكتاب رفيق مثالي.",
        "Snow": "الثلج يحوّل العالم إلى سكون لوحي، وقت الكتب التي تأخذك إلى الأعماق.",
        "Atmosphere": "الضباب والرياح يضفيان غموضاً جميلاً على اليوم.",
    },
    "en": {
        "Clear": "Sunny skies awaken energy and prime the soul for inspiration.",
        "Clouds": "Clouds create a mood of deep contemplation, away from the noise.",
        "Rain": "Rain on the window is the finest music for reading.",
        "Drizzle": "A soft drizzle and fresh air are perfect for books that ask for focus.",
        "Thunderstorm": "The storm makes inner warmth all the sweeter — a book is the ideal companion.",
        "Snow": "Snow turns the world into a silent canvas — time for books that take you inward.",
        "Atmosphere": "Fog and wind lend a beautiful mystery to the day.",
    },
    "fr": {
        "Clear": "Le soleil réveille l'énergie et prépare l'âme à l'inspiration.",
        "Clouds": "Les nuages créent une ambiance de contemplation profonde.",
        "Rain": "La pluie sur la fenêtre est la plus belle musique pour lire.",
        "Drizzle": "Une bruine légère et l'air frais invitent à la concentration.",
        "Thunderstorm": "L'orage rend la chaleur intérieure encore plus douce.",
        "Snow": "La neige transforme le monde en silence — l'heure des livres qui vous emportent.",
        "Atmosphere": "Le brouillard et le vent ajoutent un mystère envoûtant à la journée.",
    },
}