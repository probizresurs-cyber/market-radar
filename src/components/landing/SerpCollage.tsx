"use client";

/**
 * Коллаж из фрагментов поисковой выдачи для первых экранов.
 *
 * Приём вдохновлён первым экраном Head Promo — там справа лежит стопка
 * скриншотов ответов ИИ под углом. Но содержимое своё: у них чужие
 * скриншоты с собственным брендом под маркером, у нас — мокапы выдачи
 * Яндекса и Google по темам ниши, где конкуренты занимают места, а на
 * месте клиента пустой слот.
 *
 * Почему мокапы, а не настоящие скриншоты: растр не переживает смену
 * темы и не масштабируется, а на живой выдаче видны названия чужих
 * компаний — ставить их в свою рекламу мы не будем. Структура и цвета
 * узнаваемы, названия условные.
 *
 * Карточки лежат стопкой под небольшими углами. На узком экране углы
 * снимаются и остаётся одна верхняя — стопка под наклоном на телефоне
 * читается плохо и режется по краям.
 */

export type SerpCard = {
  /** Подпись источника: «Яндекс», «Google». */
  engine: string;
  /** Запрос, по которому показана выдача. */
  query: string;
  rows: { pos: string; title: string; mark?: string; tail?: string; url: string; rate?: string }[];
  /** Пустой слот вместо клиента — главный смысл карточки. */
  gap?: string;
};

export function SerpCollage({ cards, slot }: { cards: SerpCard[]; slot: string }) {
  return (
    <div className="mrc-collage" aria-hidden="true">
      {cards.map((c, i) => (
        <figure key={c.engine + i} className={`mrc-collage-card is-${i}`}>
          <figcaption className="mrc-collage-head">
            <span className="mrc-mono mrc-collage-engine">{c.engine}</span>
            <span className="mrc-collage-q">{c.query}</span>
          </figcaption>
          <div className="mrc-collage-rows">
            {c.rows.map(r => (
              <div key={r.pos} className="mrc-collage-row">
                <span className="mrc-mono mrc-collage-pos">{r.pos}</span>
                <span className="mrc-collage-body">
                  <span className="mrc-collage-title">
                    {r.title}
                    {r.mark && <mark className="mrc-collage-mark">{r.mark}</mark>}
                    {r.tail}
                  </span>
                  <span className="mrc-mono mrc-collage-url">{r.url}</span>
                  {r.rate && <span className="mrc-mono mrc-collage-rate">★ {r.rate}</span>}
                </span>
              </div>
            ))}
            {c.gap && (
              <div className="mrc-collage-row is-gap">
                <span className="mrc-mono mrc-collage-pos">—</span>
                <span className="mrc-collage-slot">{slot}</span>
                <span className="mrc-mono mrc-collage-gapnote">{c.gap}</span>
              </div>
            )}
          </div>
        </figure>
      ))}
    </div>
  );
}

export const SERP_COLLAGE_CSS = `
.mrc-collage { position: relative; min-height: 540px; padding: 30px 46px 46px 0; }
.mrc-collage-card {
  position: absolute; margin: 0; width: 100%;
  background: var(--mrc-ink-soft);
  border: 1px solid color-mix(in srgb, var(--mrc-fg-soft) 26%, transparent);
  border-radius: var(--mrc-r-lg);
  padding: 15px 17px 16px;
  box-shadow: 0 22px 50px -18px rgba(0,0,0,0.75);
}
/* Стопка: нижние карточки видны краем и уходят в глубину */
.mrc-collage-card.is-2 { transform: rotate(-6.5deg) translate(-11%, 23%) scale(0.88); opacity: 0.5; z-index: 1; }
.mrc-collage-card.is-1 { transform: rotate(4.5deg) translate(13%, 12%) scale(0.94); opacity: 0.72; z-index: 2; }
.mrc-collage-card.is-0 { transform: rotate(-1.6deg) translate(-2%, -2%); z-index: 3; }

.mrc-collage-head {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  padding-bottom: 11px; margin-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--mrc-fg-soft) 20%, transparent);
}
.mrc-collage-engine { color: var(--mrc-cyan); }
.mrc-collage-q {
  font-size: 14.5px; color: var(--mrc-fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
.mrc-collage-rows { display: grid; gap: 11px; }
.mrc-collage-row { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; align-items: start; }
.mrc-collage-pos { color: var(--mrc-fg-soft); padding-top: 2px; }
.mrc-collage-body { display: grid; gap: 3px; min-width: 0; }
.mrc-collage-title {
  font-size: 14.5px; line-height: 1.35; color: var(--mrc-serp-link);
  overflow-wrap: anywhere;
}
/* Подсветка конкурента — маркером, как в разборе выдачи */
.mrc-collage-mark {
  background: color-mix(in srgb, var(--mrc-amber) 30%, transparent);
  color: inherit; padding: 0 3px; border-radius: 3px;
}
.mrc-collage-url { color: var(--mrc-serp-url); font-size: 11.5px; letter-spacing: 0.02em; text-transform: none; }
.mrc-collage-rate { color: var(--mrc-fg-soft); font-size: 11.5px; text-transform: none; }

/* Пустой слот: то же место в списке, но занять его некому */
.mrc-collage-row.is-gap {
  grid-template-columns: 18px auto minmax(0, 1fr); align-items: center;
  padding-top: 11px; border-top: 1px dashed color-mix(in srgb, var(--mrc-red) 45%, transparent);
}
.mrc-collage-slot {
  font-family: var(--f-mono); font-size: 12.5px; letter-spacing: 0.06em;
  color: var(--mrc-red); border: 1px dashed color-mix(in srgb, var(--mrc-red) 60%, transparent);
  border-radius: 6px; padding: 5px 11px; white-space: nowrap;
}
.mrc-collage-gapnote { color: var(--mrc-fg-soft); text-transform: none; letter-spacing: 0.02em; }

@media (max-width: 900px) {
  /* Стопка под наклоном на телефоне режется по краям — оставляем одну ровную. */
  .mrc-collage { min-height: 0; }
  .mrc-collage-card { position: static; transform: none; }
  .mrc-collage-card.is-1, .mrc-collage-card.is-2 { display: none; }
}
`;
