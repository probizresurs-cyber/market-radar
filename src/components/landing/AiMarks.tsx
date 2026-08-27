"use client";

/**
 * Знаки нейросетей для лендингов.
 *
 * Зачем: ряд одинаковых текстовых пилюль не читается как «покрытие пяти
 * систем» — категория узнаётся по знакам, а не по подписям. Так же
 * устроены первые экраны у Head Promo и Zenlink.
 *
 * Правовая рамка: марки используются номинативно — чтобы назвать сервисы,
 * с которыми мы работаем. Партнёрства и одобрения не подразумеваем, знаки
 * не встраиваем в собственный логотип и не выдаём за свои. Формы упрощены
 * до монохромных глифов и красятся currentColor, поэтому это не
 * воспроизведение фирменных начертаний в оригинальном виде.
 *
 * Ключи совпадают с названиями ассистентов на страницах.
 */

export type AiKey = "chatgpt" | "claude" | "alice" | "yandex" | "perplexity" | "gigachat" | "gemini";

/** Цвет знака — из палитры продакшена, у каждого свой, чтобы ряд читался. */
export const AI_HUE: Record<AiKey, string> = {
  chatgpt: "var(--mrc-green)",
  claude: "var(--mrc-amber)",
  alice: "var(--mrc-red)",
  yandex: "var(--mrc-red)",
  perplexity: "var(--mrc-cyan)",
  gigachat: "var(--mrc-violet)",
  gemini: "var(--mrc-indigo-fg)",
};

export const AI_LABEL: Record<AiKey, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  alice: "Алиса",
  yandex: "Яндекс Нейро",
  perplexity: "Perplexity",
  gigachat: "GigaChat",
  gemini: "Gemini",
};

/** Глифы: 24×24, заливка currentColor, без внутренних цветов. */
const PATHS: Record<AiKey, React.ReactNode> = {
  // Узел OpenAI — упрощён до шестиугольной петли
  chatgpt: (
    <path d="M12 2.4 20.3 7.2v9.6L12 21.6 3.7 16.8V7.2Zm0 2.3L5.7 8.35v7.3L12 19.3l6.3-3.65v-7.3Zm0 3.1 3.6 2.08v4.16L12 15.92 8.4 13.84V9.68Z" />
  ),
  // Знак Claude — расходящиеся лучи
  claude: (
    <path d="M12 2.6c.5 0 .9.4.9.9v5.1l3.1-3.1a.9.9 0 0 1 1.3 1.3l-3.1 3.1h5.1a.9.9 0 0 1 0 1.8h-5.1l3.1 3.1a.9.9 0 0 1-1.3 1.3l-3.1-3.1v5.1a.9.9 0 0 1-1.8 0v-5.1l-3.1 3.1a.9.9 0 0 1-1.3-1.3l3.1-3.1H4.7a.9.9 0 0 1 0-1.8h5.1L6.7 6.8a.9.9 0 0 1 1.3-1.3l3.1 3.1V3.5c0-.5.4-.9.9-.9Z" />
  ),
  // Алиса — круг с вырезом-«улыбкой»
  alice: (
    <path d="M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8Zm0 2a7.4 7.4 0 0 1 7.3 6.2H4.7A7.4 7.4 0 0 1 12 4.6Z" />
  ),
  // Яндекс Нейро — «Я»-подобная засечка
  yandex: (
    <path d="M13.4 2.8h3.1v18.4h-2.9v-7.1h-1.1l-3.3 7.1H5.9l3.8-7.8C7.6 12.6 6.3 11 6.3 8.5c0-3.4 2.4-5.7 7.1-5.7Zm-.1 2.4c-2.6 0-3.9 1.3-3.9 3.4 0 2 1.1 3.2 3.6 3.2h.6V5.2Z" />
  ),
  // Perplexity — строки ответа со ссылкой
  perplexity: (
    <path d="M3.4 5.2h17.2v2.1H3.4Zm0 5.7h17.2V13H3.4Zm0 5.7h10.9v2.2H3.4Z" />
  ),
  // GigaChat — круг с орбитой
  gigachat: (
    <path d="M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8Zm0 2a7.4 7.4 0 1 1 0 14.8 7.4 7.4 0 0 1 0-14.8Zm0 3.1a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6Z" />
  ),
  // Gemini — четырёхлучевая искра
  gemini: (
    <path d="M12 2.4c.6 4.9 3.2 7.5 8.1 8.1v2.4c-4.9.6-7.5 3.2-8.1 8.1H9.6c-.6-4.9-3.2-7.5-8.1-8.1v-2.4c4.9-.6 7.5-3.2 8.1-8.1Z" />
  ),
};

export function AiMark({ id, size = 18 }: { id: AiKey; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      {PATHS[id]}
    </svg>
  );
}

/**
 * Ряд знаков с подписями — используется в первых экранах и в покрытии.
 * `tone="chip"` — компактные пилюли, `tone="tile"` — крупные плитки.
 */
export function AiRow({ items, tone = "chip" }: { items: AiKey[]; tone?: "chip" | "tile" }) {
  return (
    <ul className={`mrc-airow is-${tone}`}>
      {items.map(k => (
        <li key={k} style={{ ["--hue" as string]: AI_HUE[k] }}>
          <span className="mrc-airow-mark"><AiMark id={k} size={tone === "tile" ? 22 : 16} /></span>
          <span className="mrc-airow-name">{AI_LABEL[k]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Стили ряда — подключаются страницей один раз. */
export const AI_ROW_CSS = `
.mrc-airow { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }
.mrc-airow li {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1px solid color-mix(in srgb, var(--hue) 38%, transparent);
  background: color-mix(in srgb, var(--hue) 9%, transparent);
  border-radius: 999px; padding: 6px 13px 6px 8px;
  font-family: var(--f-mono); font-size: 11.5px; letter-spacing: 0.02em;
}
.mrc-airow .mrc-airow-mark { display: inline-flex; color: var(--hue); }
.mrc-airow.is-tile { gap: 10px; }
.mrc-airow.is-tile li {
  flex-direction: column; align-items: flex-start; gap: 10px;
  border-radius: var(--mrc-r-lg); padding: 16px 18px; flex: 1 1 150px;
  font-size: 13px; letter-spacing: 0;
}
.mrc-airow.is-tile .mrc-airow-mark {
  width: 38px; height: 38px; border-radius: 11px;
  align-items: center; justify-content: center;
  border: 1px solid color-mix(in srgb, var(--hue) 42%, transparent);
  background: color-mix(in srgb, var(--hue) 13%, transparent);
}
.mrc-airow.is-tile .mrc-airow-name { font-family: var(--f-text); font-weight: 700; font-size: 15px; }
@media (max-width: 700px) { .mrc-airow.is-tile li { flex: 1 1 100%; } }
`;
