"""Recommendation logic and weather helpers for ReMood."""

from __future__ import annotations

import random
from datetime import datetime
from urllib.parse import quote_plus
from zoneinfo import ZoneInfo

import requests

from data import ANALYSIS, BOOKS, MOOD_QUOTES, WEATHER_ANALYSIS, Book, City


def city_local_time(city: City) -> tuple[str, str]:
    now = datetime.now(ZoneInfo(city.timezone))
    hour = now.hour
    if 5 <= hour < 12:
        time_of_day = "morning"
    elif 12 <= hour < 17:
        time_of_day = "afternoon"
    elif 17 <= hour < 21:
        time_of_day = "evening"
    else:
        time_of_day = "night"
    return now.strftime("%H:%M"), time_of_day


def current_season() -> str:
    month = datetime.now().month
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    if month in (9, 10, 11):
        return "autumn"
    return "winter"


def weather_group(code: int) -> str:
    if code in (0, 1):
        return "Clear"
    if code in (2, 3):
        return "Clouds"
    if code in (45, 48):
        return "Atmosphere"
    if code in (51, 53, 55, 56, 57):
        return "Drizzle"
    if code in (61, 63, 65, 66, 67, 80, 81, 82):
        return "Rain"
    if code in (71, 73, 75, 77, 85, 86):
        return "Snow"
    if code in (95, 96, 99):
        return "Thunderstorm"
    return "Clouds"


def fetch_weather(city: City) -> tuple[dict | None, str | None]:
    """Fetch current weather from Open-Meteo, which does not require an API key."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": city.latitude,
        "longitude": city.longitude,
        "current": "temperature_2m,weather_code,wind_speed_10m",
        "timezone": city.timezone,
    }
    try:
        response = requests.get(url, params=params, timeout=8)
        response.raise_for_status()
        current = response.json()["current"]
        return {
            "temperature": round(float(current["temperature_2m"])),
            "wind": round(float(current.get("wind_speed_10m", 0))),
            "group": weather_group(int(current["weather_code"])),
        }, None
    except (requests.RequestException, KeyError, TypeError, ValueError) as exc:
        return None, str(exc)


def score_book(
    book: Book,
    *,
    category: str,
    mood: str,
    weather: str,
    time_of_day: str,
    season: str,
    length: str,
    age: str,
    occasion: str,
) -> float:
    score = random.random() * 0.8
    score += 4.0 if book.category == category else 0
    score += 3.0 if weather in book.weather else 0
    score += 2.5 if mood in book.moods else 0
    score += 1.5 if time_of_day in book.times else 0
    score += 1.5 if season in book.seasons else 0
    score += 2.0 if length != "any" and book.length == length else 0
    score += 2.0 if age and age in book.ages else 0
    score += 2.5 if occasion != "none" and occasion in book.occasions else 0
    if time_of_day == "night" and book.atmosphere in {"mystery", "thriller"}:
        score += 1
    if weather in {"Rain", "Drizzle"} and book.atmosphere == "philosophical":
        score += 1
    if weather == "Snow" and book.atmosphere in {"mystery", "classic", "history"}:
        score += 1.5
    return score


def recommend(
    *,
    category: str,
    mood: str,
    weather: str,
    time_of_day: str,
    season: str,
    length: str,
    age: str,
    occasion: str,
    language: str,
    excluded_titles: set[str] | None = None,
) -> list[Book]:
    excluded = {title.strip().casefold() for title in (excluded_titles or set()) if title.strip()}
    pool = [book for book in BOOKS if book.language == language and book.title.casefold() not in excluded]
    scored = sorted(
        pool,
        key=lambda item: score_book(
            item,
            category=category,
            mood=mood,
            weather=weather,
            time_of_day=time_of_day,
            season=season,
            length=length,
            age=age,
            occasion=occasion,
        ),
        reverse=True,
    )
    picked: list[Book] = []
    atmospheres: set[str] = set()
    for book in scored:
        if book.atmosphere not in atmospheres or len(picked) < 3:
            picked.append(book)
            atmospheres.add(book.atmosphere)
        if len(picked) == 3:
            break
    return picked


def mood_quote(language: str, mood: str) -> str:
    return MOOD_QUOTES[language].get(mood, next(iter(MOOD_QUOTES[language].values())))


def analysis(language: str, weather: str, time_of_day: str) -> str:
    time_part = ANALYSIS[language].get(time_of_day, ANALYSIS[language]["afternoon"])
    weather_part = WEATHER_ANALYSIS[language].get(weather, WEATHER_ANALYSIS[language]["Clouds"])
    endings = {
        "ar": "يجتمع الطقس والمزاج اليوم ليصنعا تجربة قراءة خُصّصت لك وحدك.",
        "en": "Weather and mood align today to create a reading experience made just for you.",
        "fr": "Aujourd'hui, météo et humeur s'unissent pour créer une expérience unique, rien que pour vous.",
    }
    return f"{time_part} {weather_part} {endings[language]}"


def book_links(book: Book) -> dict[str, str]:
    query = quote_plus(f"{book.title} {book.author}")
    title = quote_plus(book.title)
    return {
        "Goodreads": f"https://www.goodreads.com/search?q={title}",
        "Libby": f"https://libbyapp.com/search/losangeles/search/query-{title}",
        "Gutenberg": f"https://www.gutenberg.org/ebooks/search/?query={title}",
        "Storytel": f"https://www.storytel.com/search?q={query}",
        "Audible": f"https://www.audible.com/search?keywords={query}",
        "Kindle": f"https://www.amazon.com/s?k={query}&i=digital-text",
        "Google Play": f"https://play.google.com/store/search?q={query}&c=books",
        "Kobo": f"https://www.kobo.com/search?query={query}",
    }