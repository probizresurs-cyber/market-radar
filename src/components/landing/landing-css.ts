/**
 * Общий визуальный слой посадочных страниц (/new, /geo, /competitors).
 *
 * Раньше эти стили жили копией в каждой странице: две копии ещё держались в
 * синхроне вручную, третья гарантированно разъехалась бы — правку контраста
 * или размера шрифта пришлось бы вносить в трёх местах, и ровно одно из них
 * однажды забыли бы. Здесь один источник.
 *
 * Токены и классы прежние (.mrc-*): страницы остаются самодостаточными по
 * содержанию, общий у них только язык оформления.
 */
export const LANDING_CSS = `

/* Акцент дублируем на :root: куки-баннер живёт в layout, СНАРУЖИ .mrc-root,
   и без этого красился синим примари платформы — чужим элементом на
   терракотовой странице. Правило действует только пока страница смонтирована. */
:root { --mrc-flare-ink: #4f46e5; }
:root.dark { --mrc-flare-ink: #4f46e5; } /* белый текст 5.6:1 в обеих темах */

.mrc-root {
  --f-display: var(--font-inter), Inter, system-ui, sans-serif;
  --f-text: var(--font-inter), Inter, system-ui, sans-serif;
  --f-doc: var(--font-merriweather), Georgia, 'Times New Roman', serif;
  --f-mono: var(--font-geist-mono), ui-monospace, 'SFMono-Regular', Menlo, monospace;

  /* ── Палитра marketradar24.ru ──────────────────────────────────────────
     indigo — основное действие; cyan — служебный акцент и логотип;
     green — статус «готово»; red/pink — потеря и предупреждение;
     magenta→violet→cyan — градиент заголовка первого экрана. */
  --mrc-ink: #f4f6f9;      /* светлая земля страницы */
  --mrc-ink-deep: #ffffff; /* плита ярче земли — первый экран */
  --mrc-ink-soft: #ffffff; /* карточки */
  --mrc-fg: #0f172a;
  --mrc-fg-mid: #35404f; /* было #3d4859 — 4.40 при норме AA 4.5 */
  --mrc-fg-soft: #566275; /* slate-500 давал ровно 4.40 при норме 4.5 */

  --mrc-indigo: #4f46e5; /* indigo-600: с белым текстом 5.6:1, у #6366f1 было 4.47 — ниже AA */
  --mrc-indigo-lift: #818cf8;
  --mrc-indigo-fg: #4338ca;
  --mrc-cyan: #0e7490;   /* неон #00d4ff на белом не читается */
  --mrc-green: #166534;  /* на светлой подложке #15803d давал 3.41 */
  --mrc-amber: #b45309;
  --mrc-pink: #be185d;
  --mrc-violet: #7c3aed;
  --mrc-magenta: #a21caf;
  --mrc-red: #dc2626;
  --mrc-logo-ring: #94a3b8;
  /* Выдача поиска: синий тайтл и зелёный путь, поднятые до читаемых на графите */
  --mrc-serp-link: #0b57d0; /* цвета выдачи под светлый фон, как в реальном поиске */
  --mrc-serp-url: #05713a;

  --mrc-r: 10px;      /* радиус кнопок продакшена */
  --mrc-r-lg: 14px;   /* радиус панелей и карточек */

  --rule: color-mix(in srgb, var(--mrc-fg-soft) 22%, transparent);
  --soft: var(--mrc-fg-soft);
  --surface: var(--mrc-ink-soft);
  --flare-use: var(--mrc-indigo-fg);
  --field-bg: color-mix(in srgb, var(--mrc-fg) 5%, transparent);
  --loss: var(--mrc-red);

  min-height: 100vh;
  background: var(--mrc-ink);
  color: var(--mrc-fg);
  font-family: var(--f-text);
  overflow-x: hidden;
}
:root.dark .mrc-root { --mrc-ink: #f4f6f9; } /* лендинг светлый в любой теме приложения */
:root.warm .mrc-root { --mrc-ink: #f4f6f9; }

.mrc-wrap { max-width: 1180px; margin: 0 auto; padding: 0 28px; }

/* Чернильная плита: внутри неё роли цвета инвертируются */
.mrc-slab {
  position: relative;
  background: var(--mrc-ink);
  color: var(--mrc-ink-fg);
  --rule: color-mix(in oklch, var(--mrc-ink-fg) 18%, transparent);
  --soft: color-mix(in oklch, var(--mrc-ink-fg) 66%, transparent);
  --surface: color-mix(in oklch, var(--mrc-ink-fg) 5%, transparent);
  --flare-use: var(--mrc-indigo-fg);
  --field-bg: color-mix(in oklch, var(--mrc-ink-fg) 8%, transparent);
}
.mrc-slab::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image: repeating-linear-gradient(90deg,
    color-mix(in oklch, var(--mrc-ink-fg) 5%, transparent) 0 1px, transparent 1px 116px);
  -webkit-mask-image: linear-gradient(to bottom, #000, transparent 78%);
  mask-image: linear-gradient(to bottom, #000, transparent 78%);
}
.mrc-slab > * { position: relative; }
.mrc-slab-sec { padding: 54px 0 60px; }

.mrc-mono {
  font-family: var(--f-mono);
  font-size: 14px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}

/* ── Верхняя планка ── */
.mrc-topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 20px 0 34px;
}
.mrc-wordmark {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--f-display); font-size: 20px; font-weight: 700; letter-spacing: 0.005em;
  color: inherit; text-decoration: none;
}
.mrc-logo-tick { width: 16px; height: 4px; background: var(--mrc-indigo-fg); display: inline-block; }
.mrc-topbar-tag { color: var(--soft); }

/* ── Типографика ── */
.mrc-h1 {
  font-family: var(--f-display);
  font-size: clamp(36px, 4.1vw, 54px) !important;
  font-weight: 900; line-height: 1.02; letter-spacing: -0.022em;
  margin: 0 0 20px;
}
.mrc-h2 {
  font-family: var(--f-display);
  font-size: clamp(26px, 3.4vw, 42px) !important;
  font-weight: 900; line-height: 1.06; letter-spacing: -0.02em; margin: 0 0 12px;
}
.mrc-h3 { font-size: 16.5px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; margin: 0 0 8px; }
.mrc-lead { font-size: 19px; line-height: 1.58; color: var(--mrc-fg-mid); margin: 0; max-width: 58ch; }
.mrc-body { font-size: 16px; line-height: 1.6; color: var(--mrc-fg-mid); margin: 0; }
.mrc-note { font-size: 13px; line-height: 1.55; color: var(--soft); }
.mrc-err { color: var(--destructive); font-size: 13.5px; margin-top: 10px; }
.mrc-slab .mrc-err { color: var(--mrc-indigo-fg); }
.mrc-kicker { color: var(--flare-use); margin-bottom: 10px; }
.mrc-kicker-muted { color: var(--soft); }
.mrc-ul { margin: 12px 0 0; padding-left: 0; list-style: none; }
.mrc-ul li {
  position: relative; padding-left: 18px; font-size: 13.5px; line-height: 1.55;
  color: var(--soft); margin-bottom: 10px;
}
.mrc-ul li::before {
  content: ''; position: absolute; left: 0; top: 0.62em;
  width: 9px; height: 1px; background: var(--flare-use);
}
.mrc-ul-cross li::before {
  content: '×'; top: 0; left: 1px; width: auto; height: auto;
  background: none; color: var(--destructive);
  font-size: 14px; line-height: 1.55;
}
.mrc-slab .mrc-ul-cross li::before { color: var(--mrc-indigo-fg); }

/* ── Первый экран ── */
.mrc-hero { padding-bottom: 62px; }
/* Сцена занимает правую колонку целиком, текст и форма — левую сверху вниз.
   На мобильном порядок меняется: сначала обещание, потом доказательство,
   потом поле — чтобы «показывает» попало в первый экран раньше формы. */
.mrc-hero-grid {
  display: grid; grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
  grid-template-areas: "head scene" "form scene";
  grid-template-rows: auto 1fr;
  gap: 30px 46px; align-items: start;
}
.mrc-hero-head { grid-area: head; padding-top: 6px; }
.mrc-hero-form { grid-area: form; }
/* Ряд знаков под первым экраном: отделён линейкой, во всю ширину сетки. */
.mrc-hero-ai {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  margin-top: 34px; padding-top: 22px;
  border-top: 1px solid color-mix(in srgb, var(--mrc-fg-soft) 20%, transparent);
}
.mrc-hero-ai-label { color: var(--soft); flex-shrink: 0; }
.mrc-hero-scene { grid-area: scene; }
.mrc-eyebrow {
  display: inline-flex; align-items: center; gap: 9px;
  color: var(--soft); margin-bottom: 22px;
  border: 1px solid var(--rule); padding: 7px 12px;
}
.mrc-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--mrc-indigo-fg);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--mrc-indigo-fg) 25%, transparent);
}
.mrc-hero-lead { font-size: 17px; margin-bottom: 0; max-width: 48ch; }
.mrc-hero-actions {
  display: flex; align-items: center; gap: 18px; flex-wrap: wrap; margin-top: 16px;
}
.mrc-hero-actions .mrc-formnote { margin-top: 0; flex: 1 1 240px; }

/* ── Сцена «ответ с пропуском» — signature ── */
.mrc-ans {
  margin: 0; padding: 22px 24px 22px;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--flare-use);
}
.mrc-ans-cap {
  display: flex; align-items: center; gap: 8px;
  color: var(--soft); margin-bottom: 16px;
}
.mrc-ans-live {
  width: 7px; height: 7px; border-radius: 50%; background: var(--flare-use);
  animation: mrc-blink 2.2s var(--ease) infinite;
}
.mrc-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
.mrc-tab {
  border: 1px solid var(--rule); background: transparent; color: var(--soft);
  padding: 8px 13px; font-size: 13px; letter-spacing: 0.04em; text-transform: none;
  cursor: pointer; border-radius: 0; font-family: var(--f-mono);
  transition: color var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease);
}
.mrc-tab:hover { color: inherit; border-color: var(--flare-use); }
.mrc-tab.is-on {
  color: var(--mrc-ink); background: var(--flare-use); border-color: var(--flare-use);
  font-weight: 700;
}
.mrc-ans-qlabel { display: block; color: var(--flare-use); margin-bottom: 8px; }
.mrc-ans-qtext {
  margin: 0 0 20px; font-size: 17px; line-height: 1.45; font-weight: 500;
  letter-spacing: -0.01em; color: inherit;
  animation: mrc-qin 460ms var(--ease) both;
}
.mrc-caret {
  display: inline-block; width: 2px; height: 1.05em; margin-left: 4px;
  background: var(--flare-use); vertical-align: -0.15em;
  animation: mrc-blink 1s steps(1, end) infinite;
}
.mrc-ans-body { border-top: 1px solid var(--rule); padding-top: 18px; }
.mrc-ans-text {
  font-family: var(--f-doc);
  font-size: 15.5px; line-height: 1.72; margin: 0 0 20px; color: inherit;
  animation: mrc-qin 520ms var(--ease) both;
}
/* Маркер редактора: подсветка ведётся background-size, поэтому лежит под
   глиссадой текста и не требует отдельного слоя со z-index. */
.mrc-name {
  background-color: transparent; color: inherit; font-weight: 700;
  padding: 0 2px 4px; white-space: nowrap;
  background-image: linear-gradient(color-mix(in oklch, var(--flare-use) 45%, transparent),
                                    color-mix(in oklch, var(--flare-use) 45%, transparent));
  background-repeat: no-repeat; background-position: 0 100%;
  background-size: 0% 7px;
  animation: mrc-mark 640ms var(--ease) 460ms both;
}
.mrc-name-2 { animation-delay: 980ms; }
.mrc-slot { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.mrc-slot-box {
  display: inline-flex; align-items: center; min-height: 42px; padding: 0 18px;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border: 2px dashed color-mix(in oklch, var(--flare-use) 70%, transparent);
  color: var(--flare-use);
  font-family: var(--f-mono); font-size: 14px; letter-spacing: 0.06em;
  animation: mrc-slotpulse 2.8s var(--ease) infinite;
}
.mrc-slot-note { color: var(--soft); }

@keyframes mrc-mark { from { background-size: 0% 7px; } to { background-size: 100% 7px; } }
@keyframes mrc-qin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mrc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
@keyframes mrc-slotpulse {
  0%, 100% { border-color: color-mix(in oklch, var(--flare-use) 40%, transparent); }
  50% { border-color: color-mix(in oklch, var(--flare-use) 95%, transparent); }
}

/* ── Формы ── */
.mrc-urlform { max-width: 600px; }
.mrc-form-row { display: flex; gap: 10px; flex-wrap: wrap; }
.mrc-input {
  flex: 1 1 240px; min-width: 0; width: 100%; height: 52px; padding: 0 16px;
  font-family: inherit; font-size: 15px;
  border-radius: var(--mrc-r); border: 1px solid color-mix(in srgb, var(--mrc-fg-soft) 34%, transparent);
  background: var(--field-bg); color: inherit; outline: none;
  transition: border-color var(--motion-fast) var(--ease), box-shadow var(--motion-fast) var(--ease);
}
.mrc-input::placeholder { color: var(--soft); }
.mrc-input:focus {
  border-color: var(--flare-use);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--flare-use) 22%, transparent);
}
.mrc-btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 52px; min-height: 52px; padding: 0 26px;
  font-family: inherit; font-size: 15px; font-weight: 700; letter-spacing: -0.005em;
  border: 1px solid transparent; border-radius: var(--mrc-r);
  cursor: pointer; white-space: nowrap; text-decoration: none;
  transition: filter var(--motion-fast) var(--ease), opacity var(--motion-fast) var(--ease),
              background-color var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease),
              transform var(--motion-fast) var(--ease);
}
/* Индиго продакшена + белый текст = 5.6:1. Бледная заливка --mrc-indigo-fg
   читалась как неактивная кнопка. */
.mrc-btn-primary {
  background: var(--mrc-indigo); color: #fff;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--mrc-indigo) 34%, transparent);
}
.mrc-btn-primary:hover:not(:disabled) { background: var(--mrc-indigo-lift); }
.mrc-btn-primary:active:not(:disabled) { transform: translateY(1px); }
.mrc-btn-secondary { background: transparent; color: inherit; border-color: var(--rule); }
.mrc-btn-secondary:hover:not(:disabled) { border-color: var(--flare-use); color: var(--flare-use); }
.mrc-btn:disabled { opacity: 0.55; cursor: not-allowed; }
/* Заливка акцентом в неактивном состоянии мутнеет в грязный кирпич —
   поэтому неактивная кнопка становится контурной, а не полупрозрачной. */
.mrc-btn-primary:disabled {
  opacity: 1; background: transparent; color: var(--soft); border-color: var(--rule);
}
.mrc-btn:focus-visible, .mrc-input:focus-visible, .mrc-tab:focus-visible,
.mrc-root a:focus-visible, .mrc-checkbox:focus-visible {
  outline: 2px solid var(--flare-use); outline-offset: 2px;
}
.mrc-formnote {
  color: var(--soft); margin-top: 14px; line-height: 1.5;
  text-transform: none; letter-spacing: 0.02em; font-size: 14px; max-width: 52ch;
}
.mrc-consent {
  display: flex; gap: 11px; align-items: flex-start; margin-top: 16px;
  cursor: pointer; font-size: 14.5px; line-height: 1.55; color: var(--mrc-fg-mid);
}
.mrc-consent a { color: var(--flare-use); text-decoration: underline; text-underline-offset: 2px; }
.mrc-checkbox {
  margin: 1px 0 0; width: 17px; height: 17px; min-height: 17px;
  accent-color: var(--flare-use); flex-shrink: 0; cursor: pointer;
}

/* ── Секции ── */
.mrc-sec { position: relative; border-top: 1px solid var(--rule); padding: 44px 0 52px; }
.mrc-sec-head {
  display: grid; grid-template-columns: 128px minmax(0, 1fr); align-items: start;
  margin-bottom: 30px;
}
/* Номера разделов были контурными и полупрозрачными — «блёклыми».
   Залиты фирменным градиентом первого экрана, как на /check. */
.mrc-num {
  font-family: var(--f-display); font-size: clamp(48px, 5vw, 76px); font-weight: 900;
  line-height: 0.72; letter-spacing: -0.04em;
  background: linear-gradient(140deg, var(--mrc-magenta) 6%, var(--mrc-violet) 48%, var(--mrc-cyan) 96%);
  -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
}
@supports not ((-webkit-background-clip: text) or (background-clip: text)) {
  .mrc-num { color: var(--mrc-violet); -webkit-text-fill-color: var(--mrc-violet); }
}
.mrc-sec-text { min-width: 0; }

/* ── Схема ── */
.mrc-chain {
  list-style: none; margin: 0; padding: 0; position: relative;
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 16px;
}
.mrc-chain::before {
  content: ''; position: absolute; left: 0; right: 0; top: 6px; height: 1px; background: var(--rule);
}
.mrc-chain-node { position: relative; padding-top: 26px; }
.mrc-chain-tick {
  position: absolute; top: 0; left: 0; width: 13px; height: 13px;
  background: var(--background); border: 3px solid var(--flare-use);
}
.mrc-chain-node.is-loss .mrc-chain-tick { border-color: var(--destructive); }
.mrc-chain-n { color: var(--soft); display: block; margin-bottom: 12px; }
.mrc-chain-ico { display: block; color: var(--flare-use); margin-bottom: 12px; }
.mrc-chain-node.is-loss .mrc-chain-ico { color: var(--destructive); }
.mrc-chain-t { display: block; font-size: 15.5px; font-weight: 700; letter-spacing: -0.015em; margin-bottom: 7px; }
.mrc-chain-d { display: block; font-size: 13px; line-height: 1.55; color: var(--soft); }

/* ── Плашки ── */
.mrc-callout {
  margin-top: 26px; padding: 22px 24px;
  background: var(--surface);
  border: 1px solid var(--rule); border-left: 3px solid var(--flare-use);
}
.mrc-callout.is-warn { border-left-color: var(--warning); }
.mrc-callout .mrc-body { color: inherit; font-size: 14.5px; }
.mrc-callout.is-doc .mrc-body { font-family: var(--f-doc); font-size: 15px; line-height: 1.7; }
.mrc-sec > .mrc-note { display: block; margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--rule); }

/* ── Сравнение ── */
.mrc-cmp { border-top: 1px solid var(--rule); }
.mrc-cmp-head, .mrc-cmp-row {
  display: grid; grid-template-columns: minmax(0, 210px) minmax(0, 1fr) minmax(0, 1fr); gap: 0 22px;
}
.mrc-cmp-head { padding: 12px 0; border-bottom: 1px solid var(--rule); color: var(--soft); }
.mrc-cmp-head span:nth-child(3) { color: var(--flare-use); }
.mrc-cmp-row { padding: 17px 0; border-bottom: 1px solid var(--rule); align-items: baseline; }
.mrc-cmp-k { color: var(--soft); }
.mrc-cmp-cell { font-size: 14.5px; line-height: 1.5; color: var(--soft); }
.mrc-cmp-cell-b { color: inherit; font-weight: 600; }

/* ── Слои ── */
.mrc-layers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.mrc-layer {
  position: relative; background: var(--surface); border: 1px solid var(--rule);
  padding: 24px;
  transition: border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease);
}
.mrc-layer:hover { border-color: var(--flare-use); transform: translateY(-2px); }
.mrc-layer-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.mrc-layer-n { color: var(--flare-use); }
.mrc-layer-ico { color: var(--soft); display: inline-flex; }

/* ── Покрытие ── */
.mrc-cover { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }

/* Карточка ассистента: цветная верхняя кромка и метка своего оттенка —
   приём с карточек возможностей продакшена. --hue задаётся инлайном. */
.mrc-cover-item {
  position: relative; overflow: hidden;
  background: var(--surface); border: 1px solid var(--rule);
  padding: 22px; border-radius: var(--mrc-r-lg);
}
.mrc-cover-edge {
  position: absolute; inset: 0 0 auto 0; height: 2px;
  background: linear-gradient(90deg, var(--hue), transparent 70%);
}
.mrc-cover-top { display: flex; align-items: center; gap: 9px; }
.mrc-cover-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--hue) 45%, transparent);
  background: color-mix(in srgb, var(--hue) 12%, transparent);
}
.mrc-cover-mark svg { fill: var(--hue); }
.mrc-cover-n { color: var(--soft); margin-bottom: 0; }
.mrc-cover-name {
  font-family: var(--f-display); font-size: 22px; font-weight: 700;
  letter-spacing: -0.015em; line-height: 1.15; margin: 0 0 10px;
}

/* ── Шаги замера ── */
.mrc-steps { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule); }
.mrc-step {
  position: relative; display: grid; grid-template-columns: 128px minmax(0, 1fr);
  gap: 0 20px; padding: 22px 0; border-bottom: 1px solid var(--rule);
}
.mrc-step-n { color: var(--flare-use); padding-top: 3px; }
.mrc-step-text { min-width: 0; }

.mrc-questions {
  margin-top: 26px; padding: 24px; background: var(--surface);
  border: 1px solid var(--rule);
}
.mrc-qlist { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.mrc-qlist li {
  position: relative; padding: 12px 14px 12px 34px;
  border: 1px solid var(--rule);
  font-family: var(--f-doc); font-size: 13.5px; line-height: 1.4;
  color: inherit; overflow-wrap: anywhere;
}
.mrc-qlist li::before {
  content: '?'; position: absolute; left: 14px; top: 11px;
  color: var(--flare-use); font-weight: 700; font-family: var(--f-mono);
}

/* ── Цена ── */
.mrc-price { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.mrc-price-card {
  position: relative; display: flex; flex-direction: column;
  background: var(--surface); border: 1px solid var(--rule);
  padding: 26px;
}
.mrc-price-card.is-main { border-color: var(--flare-use); border-top-width: 3px; }
.mrc-price-value {
  font-family: var(--f-display);
  font-size: clamp(34px, 4.6vw, 52px); font-weight: 900; letter-spacing: -0.03em;
  line-height: 1.02; margin: 6px 0 14px; font-variant-numeric: tabular-nums;
}
.mrc-price-card.is-main .mrc-price-value { color: var(--flare-use); }
.mrc-price-unit { font-size: 0.36em; font-weight: 600; color: var(--soft); letter-spacing: 0; font-family: var(--f-text); }
.mrc-price-btn { margin-top: auto; align-self: flex-start; }
.mrc-price-card .mrc-body { margin-bottom: 20px; }

/* Шкала бюджетов — рыночный разрыв как измерительный прибор */
.mrc-gap {
  margin-top: 26px; padding: 24px; background: var(--surface);
  border: 1px solid var(--rule);
}
.mrc-gap-note { display: block; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--rule); }

.mrc-why { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 32px; margin-top: 28px; }
.mrc-why-col { min-width: 0; }

/* ── Чего не обещаем ── */
.mrc-honest { border-top: 1px solid var(--rule); }
.mrc-honest-row {
  display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr); gap: 16px 28px;
  padding: 22px 0; border-bottom: 1px solid var(--rule); align-items: start;
}
.mrc-honest-tag { display: block; color: var(--soft); margin-bottom: 10px; }
.mrc-honest-tag-ok { color: var(--mrc-green); } /* --success из темы приложения давал 3.41 */
.mrc-honest-claim s {
  font-family: var(--f-display); font-size: 21px; font-weight: 700; letter-spacing: -0.015em;
  line-height: 1.2; display: inline-block;
  color: var(--soft); text-decoration-thickness: 1.5px;
  text-decoration-color: var(--destructive);
}
.mrc-honest-truth .mrc-body { color: inherit; font-size: 14.5px; }

/* ── Когда не окупится ── */
.mrc-no { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.mrc-no-item {
  position: relative; background: var(--surface); border: 1px solid var(--rule);
  border-left: 3px solid var(--destructive);
  padding: 24px;
}

/* ── Форма заявки ── */
.mrc-final { padding: 62px 0 68px; scroll-margin-top: 0; }
.mrc-final-grid {
  display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 46px; align-items: start;
}
.mrc-fields {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px;
}
/* Поле внутри колоночного flex: без сброса flex-basis 240px становится
   высотой и растягивает инпут на четверть экрана. */
.mrc-field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.mrc-field .mrc-input { flex: 0 0 auto; height: 52px; }
.mrc-field-label { color: var(--soft); }
.mrc-submit { align-self: flex-start; }

/* ── Подвал ── */
/* Блок «кто исполнитель»: доказательство, что за лендингом есть команда и
   юрлицо, а не только форма. Тот же приём и та же вёрстка, что на /new. */
.mrc-who { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.mrc-who-card {
  border: 1px solid var(--rule); border-radius: 14px; padding: 20px 22px;
  background: var(--surface);
}
.mrc-who-label { color: var(--soft); letter-spacing: .08em; text-transform: uppercase; font-size: 13px; }
.mrc-who-name { font-weight: 700; font-size: 22px; margin: 8px 0 14px; }
.mrc-who-about { font-size: 15.5px; line-height: 1.6; color: var(--mrc-fg-mid); margin: 0 0 12px; }
.mrc-who-about:last-child { margin-bottom: 0; }
.mrc-who-links { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 8px; }
.mrc-who-links a {
  color: var(--mrc-fg); text-decoration: none; font-size: 15px;
  border-bottom: 1px solid var(--rule); padding-bottom: 2px;
}
.mrc-who-links a:hover { border-bottom-color: var(--flare-use); }
.mrc-who-demos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
.mrc-who-demo {
  display: grid; gap: 4px; padding: 16px 18px; text-decoration: none; color: inherit;
  border: 1px solid var(--rule); border-radius: 12px; background: var(--surface);
}
.mrc-who-demo:hover { border-color: var(--flare-use); }
.mrc-who-demo-t { font-weight: 600; }
@media (max-width: 720px) {
  .mrc-who, .mrc-who-demos { grid-template-columns: minmax(0, 1fr); }
}
.mrc-footer { border-top: 1px solid var(--rule); padding: 26px 0 38px; }
.mrc-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.mrc-footer-inner > .mrc-mono { color: var(--soft); }
.mrc-footer-nav { display: flex; gap: 20px; flex-wrap: wrap; }
.mrc-footer-nav a {
  font-size: 15px; color: var(--soft); text-decoration: none;
  border-bottom: 1px solid transparent;
}
.mrc-footer-nav a:hover { color: var(--foreground); border-bottom-color: var(--flare-use); }

/* ── Ревилы ── */
.mrc-anim [data-reveal] { opacity: 0; transform: translateY(16px); }
.mrc-anim [data-reveal].is-in {
  opacity: 1; transform: none;
  transition: opacity 560ms var(--ease), transform 560ms var(--ease);
}

/* ── Планшет ── */
@media (max-width: 1000px) {
  .mrc-hero-grid {
    grid-template-columns: minmax(0, 1fr);
    /* Форма выше сцены — иначе поле ввода уходит ниже сгиба на мобильном
       (см. тот же фикс в /check). Сцена видна первым же скроллом. */
    grid-template-areas: "head" "form" "scene";
    grid-template-rows: auto; gap: 28px;
  }
  .mrc-final-grid { grid-template-columns: minmax(0, 1fr); gap: 34px; }
  .mrc-hero-lead { max-width: 60ch; }
  .mrc-chain { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 18px; }
  .mrc-chain::before { display: none; }
  .mrc-chain-node { padding-top: 22px; border-top: 1px solid var(--rule); }
  .mrc-cover { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mrc-sec-head, .mrc-step { grid-template-columns: 96px minmax(0, 1fr); }
}

/* ── Мобильный ── */
@media (max-width: 767px) {
  .mrc-wrap { padding: 0 18px; }
  .mrc-h1 { font-size: clamp(30px, 8.4vw, 40px) !important; }
  .mrc-h2 { font-size: clamp(25px, 7vw, 32px) !important; }
  .mrc-topbar { padding: 12px 0 26px; }
  .mrc-wordmark { min-height: 44px; font-size: 18px; }
  .mrc-topbar-tag { display: none; }
  .mrc-hero { padding-bottom: 44px; }
  .mrc-eyebrow { margin-bottom: 16px; font-size: 13px; letter-spacing: 0.04em; }
  .mrc-hero-lead { font-size: 15.5px; margin-bottom: 22px; }

  .mrc-form-row { flex-direction: column; }
  .mrc-input, .mrc-btn { width: 100%; flex: 1 1 auto; }
  .mrc-input { font-size: 16px; }
  /* В колонке flex-basis становится ВЫСОТОЙ — без сброса подпись раздувала
     первый экран на лишние 240px пустоты. */
  .mrc-hero-actions { flex-direction: column; align-items: stretch; gap: 12px; }
  .mrc-hero-actions .mrc-formnote { flex: 0 0 auto; max-width: none; }

  .mrc-ans { padding: 18px 16px 18px; }
  .mrc-ans-qtext { font-size: 15.5px; }
  .mrc-ans-text { font-size: 14.5px; }
  .mrc-slot-box { font-size: 13.5px; padding: 0 12px; }
  .mrc-tab { min-height: 44px; padding: 0 12px; display: inline-flex; align-items: center; }

  .mrc-sec { padding: 32px 0 38px; }
  .mrc-slab-sec { padding: 40px 0 44px; }
  .mrc-final { padding: 44px 0 48px; }
  .mrc-sec-head { grid-template-columns: minmax(0, 1fr); gap: 6px; margin-bottom: 22px; }
  .mrc-num { font-size: 40px; line-height: 1; }

  .mrc-chain { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .mrc-chain-ico { margin-bottom: 8px; }

  .mrc-cmp-head { display: none; }
  .mrc-cmp-row { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 18px 0; }
  .mrc-cmp-cell { position: relative; padding-left: 68px; font-size: 13.5px; }
  .mrc-cmp-cell::before {
    content: attr(data-tag); position: absolute; left: 0; top: 2px; width: 60px;
    font-family: var(--f-mono);
    font-size: 12.5px; letter-spacing: 0.05em; text-transform: uppercase;
    color: var(--soft);
  }
  .mrc-cmp-cell-b::before { color: var(--flare-use); }

  .mrc-layers, .mrc-cover, .mrc-price, .mrc-no, .mrc-why, .mrc-fields { grid-template-columns: minmax(0, 1fr); }
  .mrc-honest-row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .mrc-step { grid-template-columns: 44px minmax(0, 1fr); gap: 0 12px; }

      .mrc-price-btn, .mrc-submit { align-self: stretch; width: 100%; }

  .mrc-questions, .mrc-gap { padding: 16px; }
  .mrc-footer-nav { gap: 0 18px; flex-direction: column; }
  .mrc-footer-nav a { display: flex; align-items: center; min-height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  .mrc-root *, .mrc-root *::before, .mrc-root *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .mrc-anim [data-reveal] { opacity: 1; transform: none; }
  .mrc-caret { opacity: 1; }
}

/* Строки замеров: тоже были сноской — поднимаем до карточек с номером */
.mrc-instr-row {
  display: grid; grid-template-columns: 64px minmax(0, 300px) minmax(0, 1fr);
  gap: 0 22px; align-items: center;
  padding: 22px 20px; margin-bottom: 12px;
  background: var(--mrc-ink-soft); border: 1px solid var(--rule);
  border-radius: var(--mrc-r-lg); border-bottom: 1px solid var(--rule);
  transition: border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease);
}
.mrc-instr-row:hover {
  background: var(--mrc-ink-soft);
  border-color: color-mix(in srgb, var(--mrc-indigo) 45%, transparent);
  transform: translateY(-2px);
}
.mrc-instr-n { color: var(--mrc-indigo); font-size: 18px; font-weight: 800; }
.mrc-instr-t { font-size: 19px; font-weight: 750; letter-spacing: -0.02em; }
.mrc-instr-d { font-size: 15.5px; line-height: 1.55; color: var(--mrc-fg-mid); }
@media (max-width: 780px) {
  .mrc-instr-row { grid-template-columns: minmax(0, 1fr); gap: 8px; }
}

/* Промежуточная точка действия между разделами */
.mrc-midcta {
  display: flex; align-items: center; justify-content: space-between; gap: 22px;
  flex-wrap: wrap; margin-top: 30px; padding: 24px 26px;
  border-radius: var(--mrc-r-lg);
  background: linear-gradient(96deg,
    color-mix(in srgb, var(--mrc-indigo) 10%, var(--mrc-ink-soft)),
    color-mix(in srgb, var(--mrc-cyan) 9%, var(--mrc-ink-soft)));
  border: 1px solid color-mix(in srgb, var(--mrc-indigo) 26%, transparent);
}
.mrc-midcta-t { font-size: 21px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 5px; }
.mrc-midcta-d { font-size: 15.5px; line-height: 1.5; color: var(--mrc-fg-mid); max-width: 56ch; }
@media (max-width: 700px) { .mrc-midcta { padding: 20px; } .mrc-midcta .mrc-btn { width: 100%; } }

/* ── Цепочка потерь: нить, а не карточки ──────────────────────────────
   Карточка с градиентной кромкой и иконкой в квадратике — типовой набор,
   которым выглядит любой сгенерированный лендинг. Здесь работает сама
   линия: шаги нанизаны на неё, а на последнем она рвётся и уходит из
   кадра пунктиром со стрелкой. Это и есть «заявка ушла» — рисунком,
   а не подписью. Номера убраны: порядок задаёт линия. */
.mrc-chain {
  list-style: none; margin: 0; padding: 0; position: relative;
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0 20px;
}
/* Сама нить */
.mrc-chain::before {
  content: ''; position: absolute; left: 8px; right: 12%; top: 9px; height: 2px;
  background: linear-gradient(90deg, var(--mrc-indigo), var(--mrc-cyan) 55%, var(--mrc-red));
  border-radius: 2px;
}
/* Обрыв: пунктир уходит вправо за край с наклоном */
.mrc-chain::after {
  content: ''; position: absolute; right: -8px; top: 9px; width: 14%; height: 2px;
  background: repeating-linear-gradient(90deg, var(--mrc-red) 0 7px, transparent 7px 14px);
  transform-origin: left center; transform: rotate(11deg);
}
.mrc-chain-node { position: relative; padding: 26px 0 0; background: none; border: 0; box-shadow: none; }
.mrc-chain-node::after { display: none; }
/* Узел на нити */
.mrc-chain-tick {
  display: block; position: absolute; top: 3px; left: 4px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--mrc-indigo); border: 0;
  box-shadow: 0 0 0 4px var(--mrc-ink);
}
.mrc-chain-node.is-loss .mrc-chain-tick {
  background: var(--mrc-ink); border: 2.5px solid var(--mrc-red);
}
/* Иконка — без плитки, просто знак нужного цвета */
.mrc-chain-ico {
  display: block; width: auto; height: auto; margin: 0 0 14px;
  border: 0; background: none; color: var(--mrc-indigo);
}
.mrc-chain-node.is-loss .mrc-chain-ico { color: var(--mrc-red); }
.mrc-chain-t {
  display: block; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;
  line-height: 1.2; margin-bottom: 10px;
}
.mrc-chain-node.is-loss .mrc-chain-t { color: var(--mrc-red); }
.mrc-chain-d { display: block; font-size: 15.5px; line-height: 1.55; color: var(--mrc-fg-mid); }

@media (max-width: 1100px) {
  /* На узком нить горизонтально не живёт — разворачиваем в вертикальную */
  .mrc-chain { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .mrc-chain::before { left: 9px; right: auto; top: 10px; bottom: 42px; width: 2px; height: auto;
    background: linear-gradient(180deg, var(--mrc-indigo), var(--mrc-cyan) 55%, var(--mrc-red)); }
  .mrc-chain::after { right: auto; left: 9px; bottom: 12px; top: auto; width: 2px; height: 30px;
    background: repeating-linear-gradient(180deg, var(--mrc-red) 0 7px, transparent 7px 14px);
    transform: rotate(0deg); }
  .mrc-chain-node { padding: 0 0 30px 40px; }
  .mrc-chain-tick { top: 4px; left: 3px; }
  .mrc-chain-ico { margin-bottom: 10px; }
}

/* Сравнение цен строками: число крупно, расшифровка рядом. Наша строка
   выделена рамкой и акцентом — она единственная, которую надо запомнить. */
.mrc-prices { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.mrc-prices li {
  display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
  padding: 16px 18px; border-radius: var(--mrc-r-lg);
  border: 1px solid var(--rule); background: var(--mrc-ink-soft);
}
.mrc-prices li.is-us {
  border-color: color-mix(in srgb, var(--mrc-indigo) 45%, transparent);
  background: color-mix(in srgb, var(--mrc-indigo) 7%, var(--mrc-ink-soft));
}
.mrc-prices b { font-size: 21px; font-weight: 800; letter-spacing: -0.02em; white-space: nowrap; }
.mrc-prices li.is-us b { color: var(--mrc-indigo); }
.mrc-prices span { font-size: 15.5px; color: var(--mrc-fg-mid); }

`;
