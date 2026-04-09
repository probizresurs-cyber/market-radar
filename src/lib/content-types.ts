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

export interface PostMetrics {
  reach?: number;          // охват (уникальные просмотры)
  impressions?: number;    // показы (total)
  likes?: number;
  comments?: number;
  shares?: number;         // репосты
  saves?: number;          // сохранения
  clicks?: number;         // переходы по ссылке
  leads?: number;          // заявки / лиды
  revenue?: number;        // выручка (₽)
  adSpend?: number;        // потрачено на продвижение (₽)
  source?: string;         // vk / instagram / telegram / tiktok
  capturedAt?: string;     // когда внесли метрики
  screenshotUrl?: string;  // base64 скрина (для истории)
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
  metrics?: PostMetrics;
}

export type ReelVideoStatus = "idle" | "generating" | "ready" | "failed";

export interface ReelMetrics {
  views?: number;          // просмотры (для рилсов главная метрика)
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  avgWatchTimeSec?: number; // среднее время просмотра
  watchedFullPct?: number;  // % досмотревших до конца
  clicks?: number;
  leads?: number;
  revenue?: number;
  adSpend?: number;
  source?: string;
  capturedAt?: string;
  screenshotUrl?: string;
}

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
  metrics?: ReelMetrics;
}

export interface ReferenceImage {
  id: string;
  name: string;
  mimeType: string;
  data: string;   // base64 (without data URL prefix)
  previewUrl: string; // data URL for display
}

export interface BrandBook {
  brandName: string;           // как называем бренд/компанию в публикациях
  tagline: string;             // слоган / короткое позиционирование
  mission: string;             // миссия бренда
  colors: string[];            // hex-палитра (3-5 цветов)
  fontHeader: string;          // название шрифта для заголовков
  fontBody: string;            // название шрифта для основного текста
  toneOfVoice: string[];       // 3-5 дескрипторов тона (дружелюбный, экспертный, ...)
  forbiddenWords: string[];    // слова/формулировки, которые нельзя использовать
  goodPhrases: string[];       // примеры хороших фраз/формулировок бренда
  visualStyle: string;         // описание визуального стиля для картинок
  logoDataUrl?: string;        // base64 логотипа (необязательно)
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

// ---------- Stories ----------

export interface StorySlide {
  order: number;
  background: string;       // описание фона / картинки за текстом
  headlineText: string;     // крупный текст на экране (3-6 слов)
  bodyText?: string;        // дополнительный мелкий текст
  sticker?: string;         // опрос / emoji / countdown / quiz
  cta?: string;             // свайп вверх / ссылка / кнопка
  visualNote: string;       // режиссёрская пометка (цвета, шрифт, стиль)
}

export interface GeneratedStory {
  id: string;
  pillar: string;
  platform: "instagram" | "vk" | "telegram";
  title: string;            // название серии (для внутреннего использования)
  goal: string;             // цель серии: охват / прогрев / продажа
  slides: StorySlide[];
  hashtags: string[];
  generatedAt: string;
}

// ---------- Tone of Voice check ----------

export interface TovIssue {
  type: "forbidden_word" | "wrong_tone" | "missing_phrase_style" | "format";
  text: string;             // фрагмент с проблемой
  explanation: string;      // почему нарушение
  suggestion: string;       // как исправить
}

export interface TovCheckResult {
  score: number;            // 0-100 соответствие брендбуку
  verdict: string;          // короткий вердикт (1 предложение)
  issues: TovIssue[];
  correctedHook: string;    // исправленный крючок
  correctedBody: string;    // исправленный текст поста
  checkedAt: string;
}
