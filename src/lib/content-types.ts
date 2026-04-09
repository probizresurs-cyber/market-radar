// Content Factory types
// Generated content plan based on SMM analysis + company info,
// individual post/reel generation, and HeyGen video tracking.

export type ContentFormat = "post" | "reel";

export interface ContentPillar {
  name: string;
  description: string;
  share: string; // e.g. "30%"
}

export interface ContentPostIdea {
  id: string;
  pillar: string;            // которая опора контента
  format: "carousel" | "single" | "longread" | "story";
  hook: string;              // крючок / заголовок
  angle: string;             // угол подачи
  goal: string;              // цель поста (рост / продажа / прогрев)
  cta: string;               // призыв
  platform: string;          // vk / instagram / telegram / ...
}

export interface ContentReelIdea {
  id: string;
  pillar: string;
  hook: string;              // 0-3 секунды
  intrigue: string;          // удержание
  problem: string;           // боль аудитории
  solution: string;          // решение
  result: string;            // желаемый результат / трансформация
  cta: string;               // призыв
  durationSec: number;       // 15 / 30 / 60
  visualStyle: string;       // как снимать
  hashtags: string[];
}

export interface ContentPlan {
  generatedAt: string;
  companyName: string;
  bigIdea: string;
  pillars: ContentPillar[];
  postIdeas: ContentPostIdea[];
  reelIdeas: ContentReelIdea[];
  weeklyRhythm: string;            // ритм публикаций по дням недели
  thirtyDayCalendar: string[];     // 30 пунктов: день — что публикуем
}

export interface GeneratedPost {
  id: string;
  ideaId: string;
  pillar: string;
  hook: string;
  body: string;            // полный текст поста
  hashtags: string[];
  imagePrompt: string;     // промпт для DALL-E
  imageUrl?: string;       // готовая картинка (DALL-E url)
  platform: string;
  generatedAt: string;
}

export type ReelVideoStatus = "idle" | "generating" | "ready" | "failed";

export interface GeneratedReel {
  id: string;
  ideaId: string;
  pillar: string;
  title: string;
  // Полный сценарий (формат: [00:00] голос — действие в кадре — текст на экране)
  scenario: string;
  // Чистый текст для озвучки аватаром (одна строка для HeyGen)
  voiceoverScript: string;
  hashtags: string[];
  durationSec: number;
  // HeyGen
  heygenVideoId?: string;
  videoStatus: ReelVideoStatus;
  videoUrl?: string;
  videoError?: string;
  generatedAt: string;
}

export interface ReferenceImage {
  id: string;
  name: string;
  mimeType: string;
  data: string;   // base64 (without data URL prefix)
  previewUrl: string; // data URL for display
}

export interface AvatarSettings {
  avatarId: string;            // HeyGen avatar_id
  voiceId: string;             // HeyGen voice_id
  avatarDescription: string;   // как должен выглядеть аватар (для подсказки в визуале)
  voiceDescription: string;    // каким должен быть голос (тон, темп, эмоция)
  aspect: "portrait" | "landscape";
}

export interface ContentFactoryState {
  plan: ContentPlan | null;
  posts: GeneratedPost[];
  reels: GeneratedReel[];
  avatarSettings?: AvatarSettings;
}
