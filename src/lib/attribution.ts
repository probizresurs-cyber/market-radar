/**
 * Сбор меток атрибуции на посадочных страницах.
 *
 * Зачем: без сохранённых utm/yclid через месяц открутки нельзя ответить на
 * единственный важный вопрос — какая кампания приносит разборы и сделки, а
 * какая только клики. Метки уходят в mini_checks.utm, оттуда переносятся в
 * kp_generations.utm, и дальше по ним считаются офлайн-конверсии для Директа.
 *
 * Почему sessionStorage: человек часто заходит по объявлению на /geo, а email
 * оставляет уже на /new — во втором URL меток нет. Первое касание в рамках
 * вкладки и есть источник, поэтому метки запоминаются и переживают переход.
 * Первые записанные метки не перетираются: атрибуция по первому клику.
 */
const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid"] as const;
const STORE_KEY = "mr_attribution";

export type Attribution = Partial<Record<(typeof KEYS)[number], string>>;

/** Метки текущего визита: из URL, а если там пусто — из памяти вкладки. */
export function readAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const out: Attribution = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const k of KEYS) {
      const v = q.get(k);
      if (v && v.trim()) out[k] = v.trim().slice(0, 200);
    }
    if (Object.keys(out).length > 0) {
      // Первый клик выигрывает: перезапись стёрла бы источник, приведший
      // человека, в пользу случайного внутреннего перехода с метками.
      if (!sessionStorage.getItem(STORE_KEY)) {
        sessionStorage.setItem(STORE_KEY, JSON.stringify(out));
      }
      return out;
    }
    const saved = sessionStorage.getItem(STORE_KEY);
    return saved ? (JSON.parse(saved) as Attribution) : {};
  } catch {
    // Приватный режим или заблокированное хранилище — метки просто не
    // сохранятся, ломать из-за этого воронку нельзя.
    return out;
  }
}
