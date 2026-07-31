/**
 * Пресеты голоса за кадром для видео-конвейера.
 *
 * Арт-директор (content/video/plan) выбирает пресет под тему и подачу ролика:
 * медицинскому ролику подходит спокойный мужской, продающему — энергичный
 * женский, экспертному лонгриду — нейтральный рассказчик. Раньше голос был
 * жёстко один (Charlotte) на все ролики — из-за этого «все ролики звучали
 * одинаково» так же, как выглядели одинаково.
 *
 * voiceId — публичные голоса ElevenLabs из стандартной библиотеки; работают
 * с eleven_multilingual_v2 (русский). Настройки stability/style задаются не
 * здесь, а в спеке стиля — арт-директор крутит их per-ролик.
 */
import type { VoicePresetName } from "./video-style-types";

export interface VoicePreset {
  voiceId: string;
  /** Человекочитаемое описание — для UI и логов. */
  label: string;
}

export const VOICE_PRESETS: Record<VoicePresetName, VoicePreset> = {
  // Charlotte — прежний дефолт: тёплый женский, универсальный.
  "female-warm": { voiceId: "XB0fDUnXU5powFXDhCwa", label: "Женский тёплый" },
  // Rachel — чище и энергичнее, хорошо для продающих и трендовых тем.
  "female-energetic": { voiceId: "21m00Tcm4TlvDq8ikWAM", label: "Женский энергичный" },
  // Adam — низкий спокойный мужской: медицина, финансы, доверие.
  "male-calm": { voiceId: "pNInz6obpgDQGcFmaJgB", label: "Мужской спокойный" },
  // Antoni — ярче и напористее: спорт, авто, дерзкие хуки.
  "male-bold": { voiceId: "ErXwobaYiN019PkySvjV", label: "Мужской напористый" },
  // Sarah — ровный дикторский тон: обучение, инструкции, разборы.
  "neutral-narrator": { voiceId: "EXAVITQu4vr4xnSDxMaL", label: "Нейтральный диктор" },
};

/**
 * Клонированный голос бренда. Все пресеты выше — англоязычные премейды
 * ElevenLabs, русский они лишь «отыгрывают» через multilingual-модель: отсюда
 * акцент и общая неестественность, из-за которой голос в роликах звучал
 * неприятно. Клон носителя языка бьёт любой из них, поэтому если он задан —
 * он и используется, независимо от того, какой пресет выбрал арт-директор.
 *
 * Вариативность при этом не теряется полностью: арт-директор продолжает
 * крутить стабильность, выразительность и темп, а это и есть подача. Меняется
 * только тембр — но одинаковый узнаваемый голос для бренда скорее плюс.
 *
 * Задаётся через ELEVENLABS_BRAND_VOICE_ID; пусто — работают пресеты.
 */
const BRAND_VOICE_ID = process.env.ELEVENLABS_BRAND_VOICE_ID?.trim() || "";

export function resolveVoicePreset(name?: string | null): VoicePreset {
  if (BRAND_VOICE_ID) return { voiceId: BRAND_VOICE_ID, label: "Голос бренда (клон)" };
  if (name && name in VOICE_PRESETS) return VOICE_PRESETS[name as VoicePresetName];
  return VOICE_PRESETS["female-warm"];
}
