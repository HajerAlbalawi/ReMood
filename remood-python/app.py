"""ReMood — a standalone Streamlit book recommendation app."""

from __future__ import annotations

import base64
from pathlib import Path

import streamlit as st

from data import (
    AGE_GROUPS,
    CATEGORIES,
    CITIES,
    LANGUAGE_LABELS,
    LENGTHS,
    MOODS,
    OCCASIONS,
    UI,
    WEATHER_LABELS,
)
from remood import analysis, book_links, city_local_time, current_season, fetch_weather, mood_quote, recommend


st.set_page_config(page_title="ReMood", page_icon="📚", layout="wide")


def query_value(name: str, default: str | None = None) -> str | None:
    try:
        return st.query_params.get(name, default)
    except AttributeError:
        return default


SHOWCASES = {
    "spring-paris": {"city": "باريس", "ui": "fr", "book": "fr", "mood": "calm", "category": "romance", "weather": "Rain", "season": "spring", "time": "morning"},
    "summer-riyadh": {"city": "الرياض", "ui": "ar", "book": "ar", "mood": "adventure", "category": "adventure", "weather": "Clear", "season": "summer", "time": "afternoon"},
    "autumn-london": {"city": "لندن", "ui": "en", "book": "en", "mood": "mystery", "category": "mystery", "weather": "Clouds", "season": "autumn", "time": "evening"},
    "winter-moscow": {"city": "موسكو", "ui": "en", "book": "en", "mood": "sad", "category": "classic", "weather": "Snow", "season": "winter", "time": "night"},
    "storm-doha": {"city": "الدوحة", "ui": "ar", "book": "en", "mood": "distracted", "category": "selfhelp", "weather": "Thunderstorm", "season": "winter", "time": "night"},
}


def city_by_name(name: str):
    return next((city for city in CITIES if city.name == name), CITIES[0])


def init_from_showcase() -> dict:
    showcase = SHOWCASES.get(query_value("showcase", ""))
    if showcase:
        return showcase
    return {"city": CITIES[0].name, "ui": "ar", "book": "auto", "mood": "calm", "category": "classic", "weather": "Clouds", "season": current_season(), "time": city_local_time(CITIES[0])[1]}


defaults = init_from_showcase()
if "initialized" not in st.session_state:
    st.session_state.initialized = True
    st.session_state.ui_language = defaults["ui"]
    st.session_state.selected_city = defaults["city"]
    st.session_state.showcase_weather = defaults["weather"]
    st.session_state.showcase_result = bool(query_value("showcase"))
    st.session_state.recommendation = None

ui_lang = st.sidebar.selectbox(
    "Interface language / لغة الواجهة / Langue",
    options=list(LANGUAGE_LABELS),
    format_func=lambda value: f"{LANGUAGE_LABELS[value]}",
    index=list(LANGUAGE_LABELS).index(st.session_state.ui_language),
)
st.session_state.ui_language = ui_lang
t = UI[ui_lang]
rtl = ui_lang == "ar"

st.title("📚 ReMood")
st.caption(t["subtitle"])

if rtl:
    st.markdown("<div dir='rtl'>اختر مدينتك ومزاجك، وسننسّق لك جلسة قراءة مناسبة للطقس.</div>", unsafe_allow_html=True)
else:
    st.write("Choose your city and mood, and ReMood will shape a reading session around the weather.")

city_names = [city.name for city in CITIES]
selected_name = st.selectbox(
    t["where"],
    options=city_names,
    index=city_names.index(st.session_state.selected_city) if st.session_state.selected_city in city_names else 0,
    format_func=lambda name: city_by_name(name).label(ui_lang),
)
st.session_state.selected_city = selected_name
city = city_by_name(selected_name)
local_time, time_of_day = city_local_time(city)

weather, weather_error = fetch_weather(city)
if weather is None:
    weather = {"temperature": 20, "wind": 0, "group": "Clouds"}
    st.warning(f"{t['weather_error']}: {weather_error}. {t['weather_fallback']}")

if st.session_state.showcase_result and query_value("showcase") in SHOWCASES:
    config = SHOWCASES[query_value("showcase")]
    weather = {"temperature": 20 if config["weather"] == "Thunderstorm" else weather["temperature"], "wind": weather["wind"], "group": config["weather"]}
    time_of_day = config["time"]
    local_time = {"spring-paris": "09:15", "summer-riyadh": "15:40", "autumn-london": "18:25", "winter-moscow": "22:10", "storm-doha": "21:35"}[query_value("showcase")]

left, right = st.columns(2)
with left:
    st.subheader(f"🌦️ {t['weather']}")
    st.metric(WEATHER_LABELS[ui_lang][weather["group"]], f"{weather['temperature']}°C")
    st.caption(f"🕒 {local_time} · {time_of_day.title()} · 💨 {weather['wind']} km/h")
with right:
    st.subheader(f"📍 {city.label(ui_lang)}")
    st.caption(f"{t['book_language']}: {LANGUAGE_LABELS[city.book_language]} · {city.timezone}")

st.divider()

with st.form("remood_preferences"):
    col1, col2 = st.columns(2)
    with col1:
        mood_pairs = MOODS[ui_lang]
        mood_labels = [label for _, label in mood_pairs]
        default_mood = defaults["mood"] if defaults["mood"] in [key for key, _ in mood_pairs] else "calm"
        mood_key = st.selectbox(t["mood"], [key for key, _ in mood_pairs], index=[key for key, _ in mood_pairs].index(default_mood), format_func=lambda key: dict(mood_pairs)[key])
        category_pairs = CATEGORIES[ui_lang]
        category_key = st.selectbox(t["category"], [key for key, _ in category_pairs], index=[key for key, _ in category_pairs].index(defaults["category"]) if defaults["category"] in [key for key, _ in category_pairs] else 0, format_func=lambda key: dict(category_pairs)[key])
        length_key = st.selectbox(t["length"], [key for key, _ in LENGTHS[ui_lang]], format_func=lambda key: dict(LENGTHS[ui_lang])[key])
        age_key = st.selectbox(t["age"], [key for key, _ in AGE_GROUPS[ui_lang]], format_func=lambda key: dict(AGE_GROUPS[ui_lang])[key])
    with col2:
        book_options = [("auto", t["automatic"]), ("ar", "📚 العربية"), ("en", "📚 English"), ("fr", "📚 Français")]
        book_language_choice = st.selectbox(t["book_language"], [key for key, _ in book_options], index=0 if defaults["book"] == "auto" else [key for key, _ in book_options].index(defaults["book"]), format_func=lambda key: dict(book_options)[key])
        book_language = city.book_language if book_language_choice == "auto" else book_language_choice
        occasion_pairs = OCCASIONS[ui_lang]
        occasion_key = st.selectbox(t["occasion"], [key for key, _ in occasion_pairs], format_func=lambda key: dict(occasion_pairs)[key])
        season_key = st.selectbox(t["season"], ["spring", "summer", "autumn", "winter"], index=["spring", "summer", "autumn", "winter"].index(defaults["season"]), format_func=lambda key: {"spring": "🌸 Spring / Printemps / الربيع", "summer": "☀️ Summer / Été / الصيف", "autumn": "🍂 Autumn / Automne / الخريف", "winter": "❄️ Winter / Hiver / الشتاء"}[key])
        manual_weather = st.selectbox(t["manual_weather"], list(WEATHER_LABELS[ui_lang]), index=list(WEATHER_LABELS[ui_lang]).index(weather["group"]), format_func=lambda key: WEATHER_LABELS[ui_lang][key])
    excluded_text = st.text_area(t["read_books"], placeholder=t["read_books_help"], help=t["read_books_help"])
    uploaded = st.file_uploader(t["upload"], type=["png", "jpg", "jpeg", "webp"])
    submitted = st.form_submit_button(t["recommend"], type="primary", use_container_width=True)

if uploaded:
    st.image(uploaded, caption=t["upload"], width=280)

if submitted or st.session_state.showcase_result:
    # The selected book language controls the language of the complete result content.
    result_books = recommend(
        category=defaults["category"] if st.session_state.showcase_result else category_key,
        mood=defaults["mood"] if st.session_state.showcase_result else mood_key,
        weather=weather["group"] if st.session_state.showcase_result else manual_weather,
        time_of_day=time_of_day,
        season=defaults["season"] if st.session_state.showcase_result else season_key,
        length="any" if st.session_state.showcase_result else length_key,
        age="adult" if st.session_state.showcase_result else age_key,
        occasion="none" if st.session_state.showcase_result else occasion_key,
        language=defaults["book"] if st.session_state.showcase_result and defaults["book"] != "auto" else book_language,
        excluded_titles=set(excluded_text.split(",")),
    )
    if not result_books:
        st.info(t["no_results"])
    else:
        st.session_state.recommendation = {
            "books": result_books,
            "language": defaults["book"] if st.session_state.showcase_result and defaults["book"] != "auto" else book_language,
            "mood": defaults["mood"] if st.session_state.showcase_result else mood_key,
            "weather": weather["group"] if st.session_state.showcase_result else manual_weather,
            "time": time_of_day,
        }
        st.session_state.showcase_result = False

result = st.session_state.recommendation
if result:
    result_lang = result["language"]
    result_t = UI[result_lang]
    st.divider()
    st.header(f"✨ {result_t['results']}")
    st.success(result_t["generated"])
    st.subheader(f"💭 {result_t['mood_quote']}")
    st.info(mood_quote(result_lang, result["mood"]))
    st.subheader(f"🌙 {result_t['analysis']}")
    st.write(analysis(result_lang, result["weather"], result["time"]))

    cards = st.columns(3)
    for card, book in zip(cards, result["books"]):
        with card:
            st.markdown(f"### {book.title}")
            st.caption(f"{book.author} · ⭐ {book.rating}")
            st.markdown(f"**{book.subcategory}** · {book.length}")
            st.write(f"**{result_t['why']}**")
            st.write(book.reason)
            st.markdown(f"> {book.quote}")
            links = book_links(book)
            st.link_button(f"📚 {result_t['want_to_read']}", links["Goodreads"], use_container_width=True)
            with st.expander(f"🎧 {result_t['read_or_listen']}"):
                st.link_button(f"Libby · {result_t['free']}", links["Libby"], use_container_width=True)
                st.link_button(f"Gutenberg · {result_t['free']}", links["Gutenberg"], use_container_width=True)
                st.link_button(f"Storytel · {result_t['subscription']}", links["Storytel"], use_container_width=True)
                st.link_button(f"Audible · {result_t['paid']}", links["Audible"], use_container_width=True)
                st.link_button(f"Kindle · {result_t['paid']}", links["Kindle"], use_container_width=True)

st.divider()
st.caption("ReMood · Python + Streamlit · Open-Meteo weather · No API key required")