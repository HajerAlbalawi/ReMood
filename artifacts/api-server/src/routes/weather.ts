import { Router, type IRouter } from "express";
import { GetWeatherQueryParams, GetWeatherResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const WEATHER_BACKGROUNDS: Record<string, string> = {
  Clear: "https://images.unsplash.com/photo-1504386106331-3e4e71712b38?q=80&w=1200",
  Clouds: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?q=80&w=1200",
  Rain: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?q=80&w=1200",
  Atmosphere: "https://images.unsplash.com/photo-1536244636800-a3f74db0f3cf?q=80&w=1200",
};

function interpretWeatherCode(code: number): { condition: string; conditionGroup: string } {
  if (code === 0) return { condition: "سماء صافية تماماً", conditionGroup: "Clear" };
  if (code >= 1 && code <= 3) return { condition: "غائم جزئياً", conditionGroup: "Clouds" };
  if (code >= 45 && code <= 48) return { condition: "ضبابي", conditionGroup: "Atmosphere" };
  if (code >= 51 && code <= 67) return { condition: "أمطار خفيفة / رذاذ", conditionGroup: "Rain" };
  if (code >= 71 && code <= 82) return { condition: "هطول أمطار مستمر", conditionGroup: "Rain" };
  if (code >= 95 && code <= 99) return { condition: "عواصف رعدية", conditionGroup: "Atmosphere" };
  return { condition: "أجواء غير اعتيادية", conditionGroup: "Atmosphere" };
}

router.get("/weather", async (req, res): Promise<void> => {
  const parsed = GetWeatherQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { city, lat, lng } = parsed.data;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&forecast_days=1`;

  const response = await fetch(url);
  if (!response.ok) {
    res.status(502).json({ error: "فشل الاتصال بخادم الطقس" });
    return;
  }

  const data = (await response.json()) as {
    current: { temperature_2m: number; weather_code: number };
    hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] };
  };

  const { condition, conditionGroup } = interpretWeatherCode(data.current.weather_code);

  const hourlyForecast = data.hourly.time.slice(0, 8).map((time, i) => ({
    time: time.split("T")[1],
    temp: data.hourly.temperature_2m[i],
    weatherCode: data.hourly.weather_code[i],
  }));

  const result = GetWeatherResponse.parse({
    city,
    temperature: data.current.temperature_2m,
    condition,
    conditionGroup,
    backgroundImage: WEATHER_BACKGROUNDS[conditionGroup] ?? WEATHER_BACKGROUNDS.Clouds,
    hourlyForecast,
  });

  res.json(result);
});

export default router;
