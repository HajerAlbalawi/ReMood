import express, { Router, type IRouter } from "express";
import {
  CreateAiBookPreviewBody,
  CreateAiBookPreviewResponse,
  TranscribeVoiceResponse,
} from "@workspace/api-zod";
import {
  generateLocalBookPreview,
  generateAiBookPreview,
  transcribeReadingRequest,
} from "../lib/ai-books";

const router: IRouter = Router();
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function getSafeProviderError(error: unknown) {
  if (!error || typeof error !== "object") return { name: typeof error };
  const candidate = error as Record<string, unknown>;
  return {
    name: error instanceof Error ? error.name : "ProviderError",
    status: typeof candidate.status === "number" ? candidate.status : undefined,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    type: typeof candidate.type === "string" ? candidate.type : undefined,
  };
}

router.post("/ai/book-preview", async (req, res): Promise<void> => {
  const parsed = CreateAiBookPreviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "طلب معاينة الكتب غير صالح" });
    return;
  }

  try {
    const preview = await generateAiBookPreview(parsed.data);
    const validated = CreateAiBookPreviewResponse.safeParse(preview);
    if (!validated.success) {
      req.log.error({ issues: validated.error.issues }, "AI preview response failed validation");
      res.status(503).json({ error: "تعذّر التحقق من اقتراحات الذكاء الاصطناعي" });
      return;
    }
    res.json(validated.data);
  } catch (err) {
    req.log.warn(
      { fallback: "local-library", providerError: getSafeProviderError(err) },
      "AI book preview provider unavailable; using local fallback",
    );
    const fallback = CreateAiBookPreviewResponse.safeParse(generateLocalBookPreview(parsed.data));
    if (fallback.success && fallback.data.books.length > 0) {
      res.json(fallback.data);
      return;
    }
    req.log.error({ issues: fallback.success ? [] : fallback.error.issues }, "AI book preview fallback failed validation");
    res.status(503).json({ error: "مساعد الكتب غير متاح حالياً. يمكنك متابعة التوصيات المعتادة دون تغيير." });
  }
});

router.post(
  "/ai/transcribe",
  express.raw({
    type: ["audio/*", "application/octet-stream"],
    limit: MAX_AUDIO_BYTES,
  }),
  async (req, res): Promise<void> => {
    const audio = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (audio.length === 0 || audio.length > MAX_AUDIO_BYTES) {
      res.status(400).json({ error: "التسجيل فارغ أو يتجاوز الحد المسموح (10 ميغابايت)" });
      return;
    }

    const contentType = String(req.headers["content-type"] ?? "audio/webm").split(";")[0];
    if (!contentType.startsWith("audio/") && contentType !== "application/octet-stream") {
      res.status(400).json({ error: "صيغة التسجيل الصوتي غير مدعومة" });
      return;
    }

    try {
      const text = await transcribeReadingRequest(audio, contentType);
      const validated = TranscribeVoiceResponse.safeParse({ text });
      if (!validated.success) {
        req.log.error({ issues: validated.error.issues }, "Transcription response failed validation");
        res.status(503).json({ error: "تعذّر التحقق من النص المحوّل" });
        return;
      }
      res.json(validated.data);
    } catch (err) {
      req.log.error({ err }, "Voice transcription failed");
      res.status(503).json({ error: "تعذّر تحويل التسجيل إلى نص. يمكنك الكتابة بدلاً من ذلك." });
    }
  },
);

export default router;