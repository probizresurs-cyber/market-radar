/**
 * GET  /api/ai/key — проверка статуса API-ключей (только admin)
 * POST /api/ai/key — тест подключения к AI-провайдеру
 *
 * Не раскрывает реальные ключи — только статус (настроен / не настроен / рабочий).
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

interface KeyStatus {
  name: string;
  envVar: string;
  configured: boolean;
  masked: string;       // последние 4 символа
}

function maskKey(key: string | undefined): string {
  if (!key) return "—";
  if (key.length <= 8) return "****";
  return "****" + key.slice(-4);
}

// GET — show which API keys are configured
export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const keys: KeyStatus[] = [
    {
      name: "Anthropic (Claude)",
      envVar: "ANTHROPIC_API_KEY",
      configured: !!process.env.ANTHROPIC_API_KEY,
      masked: maskKey(process.env.ANTHROPIC_API_KEY),
    },
    {
      name: "Anthropic Base URL",
      envVar: "ANTHROPIC_BASE_URL",
      configured: !!process.env.ANTHROPIC_BASE_URL,
      masked: process.env.ANTHROPIC_BASE_URL
        ? process.env.ANTHROPIC_BASE_URL.replace(/^(https?:\/\/[^/]{0,6}).*/, "$1…")
        : "—",
    },
    {
      name: "OpenAI (GPT-4o)",
      envVar: "OPENAI_API_KEY",
      configured: !!process.env.OPENAI_API_KEY,
      masked: maskKey(process.env.OPENAI_API_KEY),
    },
    {
      name: "Google Gemini",
      envVar: "GEMINI_API_KEY",
      configured: !!process.env.GEMINI_API_KEY,
      masked: maskKey(process.env.GEMINI_API_KEY),
    },
    {
      name: "Google Places",
      envVar: "GOOGLE_PLACES_API_KEY",
      configured: !!process.env.GOOGLE_PLACES_API_KEY,
      masked: maskKey(process.env.GOOGLE_PLACES_API_KEY),
    },
    {
      name: "Yandex Maps",
      envVar: "YANDEX_MAPS_API_KEY",
      configured: !!process.env.YANDEX_MAPS_API_KEY,
      masked: maskKey(process.env.YANDEX_MAPS_API_KEY),
    },
    {
      name: "2GIS",
      envVar: "TWOGIS_API_KEY",
      configured: !!process.env.TWOGIS_API_KEY,
      masked: maskKey(process.env.TWOGIS_API_KEY),
    },
    {
      name: "HeyGen",
      envVar: "HEYGEN_API_KEY",
      configured: !!process.env.HEYGEN_API_KEY,
      masked: maskKey(process.env.HEYGEN_API_KEY),
    },
    {
      name: "Telegram Bot",
      envVar: "TELEGRAM_BOT_TOKEN",
      configured: !!process.env.TELEGRAM_BOT_TOKEN,
      masked: maskKey(process.env.TELEGRAM_BOT_TOKEN),
    },
    {
      name: "DaData",
      envVar: "DADATA_API_KEY",
      configured: !!process.env.DADATA_API_KEY,
      masked: maskKey(process.env.DADATA_API_KEY),
    },
  ];

  const configured = keys.filter(k => k.configured).length;
  const total = keys.length;

  return NextResponse.json({ ok: true, keys, summary: { configured, total } });
}

// POST — test AI connectivity
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const provider = (body.provider as string) || "anthropic";

  try {
    if (provider === "anthropic") {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ ok: false, provider, error: "ANTHROPIC_API_KEY не задан" });
      }
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL,
      });
      const start = Date.now();
      const resp = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      });
      const duration = Date.now() - start;
      return NextResponse.json({
        ok: true,
        provider,
        duration_ms: duration,
        model: resp.model,
        stop_reason: resp.stop_reason,
      });
    }

    if (provider === "openai") {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ ok: false, provider, error: "OPENAI_API_KEY не задан" });
      }
      const start = Date.now();
      const resp = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/models`, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      const duration = Date.now() - start;
      return NextResponse.json({ ok: resp.ok, provider, duration_ms: duration, status: resp.status });
    }

    return NextResponse.json({ ok: false, error: `Unknown provider: ${provider}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, provider, error: String(e) }, { status: 500 });
  }
}
