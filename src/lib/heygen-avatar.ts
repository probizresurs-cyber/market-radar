/**
 * Общее между кик-роутом (generate-avatar-clip) и статус-роутом
 * (generate-avatar-clip/status) — вынесено, чтобы не дублировать парсер
 * ошибок HeyGen и форму payload в двух местах.
 */
export const MAX_AUDIO_BYTES = 32 * 1024 * 1024;

export interface HeygenError { error?: { code?: string; message?: string } }

export function heygenMessage(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as HeygenError;
    const code = parsed.error?.code;
    const msg = parsed.error?.message;
    if (msg) return code ? `${code}: ${msg}` : msg;
  } catch { /* не JSON — отдаём как есть */ }
  return `${status}: ${text.slice(0, 300)}`;
}

export interface CreatePayload {
  type: "avatar";
  avatar_id: string;
  aspect_ratio: string;
  resolution: string;
  background: { type: "color"; value: string };
  title?: string;
  audio_asset_id?: string;
  script?: string;
  voice_id?: string;
  engine?: { type: string };
}
