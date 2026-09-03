"use client";

/**
 * Коллаж «что видит клиент» для первых экранов лендингов.
 *
 * Воссоздаёт интерфейсы, по которым люди реально выбирают подрядчика:
 * выдача Яндекса, ответ Алисы AI, выдача Google, ответы ChatGPT и Claude.
 * Разметка и цвета срисованы со скриншотов живых интерфейсов (владелец
 * прислал Алису и Google, выдачу Яндекса снимал я до включения капчи).
 * Автоматически снять нельзя: и Яндекс, и Google отдают капчу на
 * автоматизированные запросы, а обходить её мы не будем.
 *
 * Почему воссоздание, а не растровые скриншоты:
 *  - на живых кадрах видны названия настоящих компаний — чужие бренды в
 *    своей рекламе не нужны, здесь названия условные;
 *  - растр не масштабируется на мобильном и стареет при смене вёрстки;
 *  - в кадр легко утекают личные данные (в присланном Google был виден
 *    аватар аккаунта владельца).
 *
 * Карточки несут СОБСТВЕННЫЕ цвета сервисов (белый фон, синий тайтл
 * Google, зелёный путь Яндекса), а не токены нашей темы: они изображают
 * снимки экрана, и перекрашивать их под лендинг было бы неправдой.
 * Единственный элемент нашего цвета — красный пустой слот клиента.
 *
 * Ниша выбирается случайно при каждой загрузке: на сервере всегда первая,
 * подмена после монтирования — иначе разошлась бы гидрация.
 */
import { useEffect, useState } from "react";

/* ─── Ниши ────────────────────────────────────────────────────────────── */

type Row = { title: string; mark?: string; url: string; rate?: string; snip?: string };
type Niche = {
  query: string;
  rows: Row[];
  answer: string;
  sources: { host: string; title: string }[];
  named: [string, string];
  priceRows: [string, string][];
};

const NICHES: Niche[] = [
  {
    query: "натяжные потолки цена москва",
    rows: [
      { title: "натяжные потолки в Москве — цены за м² с установкой", mark: "Компания А", url: "company-a.ru › ceny", rate: "4,8 · 62 отзыва", snip: "Расчёт за день, договор, гарантия 10 лет. Матовые, глянцевые, тканевые." },
      { title: "натяжные потолки недорого, выезд бесплатно", mark: "Компания Б", url: "company-b.ru › potolki", rate: "4,6 · 41 отзыв", snip: "Цены от 450 ₽/м². Монтаж за один день, выезд мастера бесплатно." },
      { title: "Сколько стоит натяжной потолок в 2026 году", url: "company-v.ru › blog", snip: "Полный разбор стоимости по фактуре полотна и площади помещения." },
    ],
    answer: "Натяжной потолок в Москве в 2026 году стоит в среднем 700–1500 ₽/м² под ключ. Разброс зависит от фактуры полотна и дополнительных работ.",
    sources: [
      { host: "company-a.ru", title: "Цены на натяжные потолки в Москве: разбор за м²" },
      { host: "company-b.ru", title: "Недорогие натяжные потолки в Москве" },
      { host: "company-v.ru", title: "Натяжные потолки с установкой, заказать" },
    ],
    named: ["Компанию А", "Компанию Б"],
    priceRows: [["Матовый ПВХ", "от 450–500 ₽"], ["Глянцевый ПВХ", "от 520–550 ₽"], ["Тканевый", "1200–2500 ₽"]],
  },
  {
    query: "ремонт квартир под ключ цена",
    rows: [
      { title: "ремонт квартир под ключ в Москве — смета за 1 день", mark: "Компания А", url: "company-a.ru › remont", rate: "4,9 · 128 отзывов", snip: "Фиксированная смета, договор, поэтапная оплата. Дизайн-проект в подарок." },
      { title: "ремонт квартир: цены за м², портфолио работ", mark: "Компания Б", url: "company-b.ru › ceny", rate: "4,7 · 83 отзыва", snip: "Косметический от 4 500 ₽/м², капитальный от 9 800 ₽/м²." },
      { title: "Сколько стоит ремонт квартиры — калькулятор", url: "company-v.ru › calc", snip: "Расчёт по площади, типу работ и классу материалов." },
    ],
    answer: "Ремонт квартиры под ключ в Москве обходится в 9 000–18 000 ₽ за м² в зависимости от класса отделки и состояния помещения.",
    sources: [
      { host: "company-a.ru", title: "Ремонт квартир под ключ: цены и сроки" },
      { host: "company-b.ru", title: "Стоимость ремонта за квадратный метр" },
      { host: "company-v.ru", title: "Калькулятор стоимости ремонта квартиры" },
    ],
    named: ["Компанию А", "Компанию Б"],
    priceRows: [["Косметический", "от 4 500 ₽/м²"], ["Капитальный", "от 9 800 ₽/м²"], ["Дизайнерский", "от 18 000 ₽/м²"]],
  },
  {
    query: "стоматология рядом со мной отзывы",
    rows: [
      { title: "стоматология в Москве — приём в день обращения", mark: "Клиника А", url: "clinic-a.ru › uslugi", rate: "4,9 · 214 отзывов", snip: "Лечение без боли, рассрочка 0%, гарантия на работы 3 года." },
      { title: "стоматологическая клиника: цены, врачи, отзывы", mark: "Клиника Б", url: "clinic-b.ru › ceny", rate: "4,7 · 96 отзывов", snip: "Консультация бесплатно, снимок в подарок при первом визите." },
      { title: "Как выбрать стоматологию: на что смотреть", url: "clinic-v.ru › blog", snip: "Разбор по оборудованию, квалификации врачей и отзывам пациентов." },
    ],
    answer: "При выборе стоматологии в Москве смотрят на отзывы, гарантию на работы и стоимость первичной консультации. Средний чек лечения кариеса — 6 000–12 000 ₽.",
    sources: [
      { host: "clinic-a.ru", title: "Стоматология в Москве: цены и запись онлайн" },
      { host: "clinic-b.ru", title: "Отзывы пациентов и рейтинг врачей" },
      { host: "clinic-v.ru", title: "Как выбрать стоматологическую клинику" },
    ],
    named: ["Клинику А", "Клинику Б"],
    priceRows: [["Консультация", "0–1 500 ₽"], ["Лечение кариеса", "6 000–12 000 ₽"], ["Имплант", "от 45 000 ₽"]],
  },
  {
    query: "грузоперевозки по москве заказать",
    rows: [
      { title: "грузоперевозки по Москве и области — подача за 30 минут", mark: "Компания А", url: "company-a.ru › gruzoperevozki", rate: "4,8 · 74 отзыва", snip: "Газели, фургоны, грузчики. Оплата по факту, документы для бухгалтерии." },
      { title: "заказать газель с грузчиками — цены по часам", mark: "Компания Б", url: "company-b.ru › zakaz", rate: "4,5 · 52 отзыва", snip: "От 900 ₽/час, минимальный заказ 2 часа. Работаем круглосуточно." },
      { title: "Сколько стоит переезд квартиры: расчёт", url: "company-v.ru › pereezd", snip: "Стоимость зависит от объёма, этажа и наличия лифта." },
    ],
    answer: "Грузоперевозки по Москве стоят от 900 ₽ в час за газель с водителем. Квартирный переезд под ключ обходится в 8 000–20 000 ₽.",
    sources: [
      { host: "company-a.ru", title: "Грузоперевозки по Москве: тарифы и подача" },
      { host: "company-b.ru", title: "Заказать газель с грузчиками недорого" },
      { host: "company-v.ru", title: "Стоимость квартирного переезда" },
    ],
    named: ["Компанию А", "Компанию Б"],
    priceRows: [["Газель, 1 час", "от 900 ₽"], ["Грузчик, 1 час", "от 600 ₽"], ["Переезд под ключ", "8 000–20 000 ₽"]],
  },
];

/* ─── Интерфейсы ──────────────────────────────────────────────────────── */

function Gap({ slot, note, tight }: { slot: string; note: string; tight?: boolean }) {
  return (
    <div className={`mrc-ui-gap${tight ? " is-tight" : ""}`}>
      <span className="mrc-ui-gap-slot">{slot}</span>
      <span>{note}</span>
    </div>
  );
}

function YandexSerp({ n, slot }: { n: Niche; slot: string }) {
  return (
    <div className="mrc-ui">
      <div className="mrc-ui-bar">
        <span className="mrc-ui-ya-logo">Я</span>
        <span className="mrc-ui-input">{n.query}</span>
        <span className="mrc-ui-find">Найти</span>
      </div>
      <div className="mrc-ui-tabs">
        {["Поиск", "Алиса AI", "Картинки", "Видео", "Карты", "Товары"].map((t, i) => (
          <span key={t} className={i === 0 ? "is-on" : ""}>{t}</span>
        ))}
      </div>
      <div className="mrc-ui-results">
        {n.rows.map((r, i) => (
          <div key={i} className="mrc-ui-res">
            <div className="mrc-ui-t">{r.mark && <mark>{r.mark}</mark>}{r.mark ? " — " : ""}{r.title}</div>
            <div className="mrc-ui-u mrc-ui-u-ya">{r.url}</div>
            {r.snip && <div className="mrc-ui-s">{r.snip}</div>}
            {r.rate && <div className="mrc-ui-r">★ {r.rate}</div>}
          </div>
        ))}
        <Gap slot={slot} note="на первой странице не найден" />
      </div>
    </div>
  );
}

function AliceAnswer({ n, slot }: { n: Niche; slot: string }) {
  return (
    <div className="mrc-ui">
      <div className="mrc-ui-tabs">
        {["Поиск", "Алиса AI", "Картинки", "Видео", "Карты"].map(t => (
          <span key={t} className={t === "Алиса AI" ? "is-on" : ""}>{t}</span>
        ))}
      </div>
      <div className="mrc-ui-bubble">{n.query}</div>
      <div className="mrc-ui-alice-grid">
        <div>
          <div className="mrc-ui-think">Рассуждения</div>
          <p className="mrc-ui-answer">{n.answer}</p>
          <div className="mrc-ui-tablehead">Цены и условия</div>
          {n.priceRows.map(([k, v]) => (
            <div key={k} className="mrc-ui-tablerow"><span>{k}</span><span>{v}</span></div>
          ))}
        </div>
        <aside className="mrc-ui-sites">
          <div className="mrc-ui-sites-h">Сайты</div>
          {n.sources.map(s => (
            <div key={s.host} className="mrc-ui-site">
              <span className="mrc-ui-site-host">{s.host}</span>
              <span className="mrc-ui-site-t">{s.title}</span>
            </div>
          ))}
          <Gap slot={slot} note="не в источниках" tight />
        </aside>
      </div>
    </div>
  );
}

function GoogleSerp({ n, slot }: { n: Niche; slot: string }) {
  return (
    <div className="mrc-ui">
      <div className="mrc-ui-bar">
        <span className="mrc-ui-g-logo">
          <b style={{ color: "#4285F4" }}>G</b><b style={{ color: "#EA4335" }}>o</b>
          <b style={{ color: "#FBBC05" }}>o</b><b style={{ color: "#4285F4" }}>g</b>
          <b style={{ color: "#34A853" }}>l</b><b style={{ color: "#EA4335" }}>e</b>
        </span>
        <span className="mrc-ui-input">{n.query}</span>
      </div>
      <div className="mrc-ui-results">
        {n.rows.slice(0, 3).map((r, i) => (
          <div key={i} className="mrc-ui-res">
            <div className="mrc-ui-u mrc-ui-u-g">{r.url.split(" › ")[0]}</div>
            <div className="mrc-ui-t mrc-ui-t-g">{r.mark && <mark>{r.mark}</mark>}{r.mark ? " — " : ""}{r.title}</div>
            {r.snip && <div className="mrc-ui-s">{r.snip}</div>}
          </div>
        ))}
        <Gap slot={slot} note="в результатах не найден" />
      </div>
    </div>
  );
}

function ChatAnswer({ n, slot, brand }: { n: Niche; slot: string; brand: "chatgpt" | "claude" }) {
  const isGpt = brand === "chatgpt";
  return (
    <div className={`mrc-ui mrc-ui-chat is-${brand}`}>
      <div className="mrc-ui-chat-h">
        <span className="mrc-ui-chat-mark">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
            {isGpt
              ? <path d="M12 2.4 20.3 7.2v9.6L12 21.6 3.7 16.8V7.2Zm0 2.3L5.7 8.35v7.3L12 19.3l6.3-3.65v-7.3Z" />
              : <path d="M12 2.6c.5 0 .9.4.9.9v5.1l3.1-3.1a.9.9 0 0 1 1.3 1.3l-3.1 3.1h5.1a.9.9 0 0 1 0 1.8h-5.1l3.1 3.1a.9.9 0 0 1-1.3 1.3l-3.1-3.1v5.1a.9.9 0 0 1-1.8 0v-5.1l-3.1 3.1a.9.9 0 0 1-1.3-1.3l3.1-3.1H4.7a.9.9 0 0 1 0-1.8h5.1L6.7 6.8a.9.9 0 0 1 1.3-1.3l3.1 3.1V3.5c0-.5.4-.9.9-.9Z" />}
          </svg>
          {isGpt ? "ChatGPT" : "Claude"}
        </span>
      </div>
      <div className="mrc-ui-bubble is-right">{n.query}</div>
      <p className="mrc-ui-answer">
        {n.answer} Чаще всего называют {n.named[0]} и {n.named[1]} — у них описаны услуги, указаны цены и есть отзывы.
      </p>
      <div className="mrc-ui-cites">
        {n.sources.map((s, i) => <span key={s.host} className="mrc-ui-cite">{i + 1}. {s.host}</span>)}
      </div>
      <Gap slot={slot} note="не упомянут" tight />
    </div>
  );
}

/* ─── Коллаж ──────────────────────────────────────────────────────────── */

export type CollageKind = "ya" | "alice" | "google" | "chatgpt" | "claude";

export function SerpCollage({ slot, kinds }: { slot: string; kinds?: CollageKind[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(Math.floor(Math.random() * NICHES.length)); }, []);

  const n = NICHES[idx];
  const base: CollageKind[] = kinds ?? ["alice", "ya", "chatgpt"];
  // Порядок стопки — состояние: верхняя карточка уходит в конец.
  const [order, setOrder] = useState<CollageKind[]>(base);
  // Пауза и счётчик перезапуска. Пауза — чтобы карточку не выдёргивали
  // из-под читающего; счётчик перезапускает таймер после ручного клика,
  // иначе сразу за кликом могла бы прийти автосмена.
  const [paused, setPaused] = useState(false);
  const [restart, setRestart] = useState(0);
  const advance = () => { setOrder(o => [...o.slice(1), o[0]]); setRestart(r => r + 1); };

  /* Карточки перелистываются сами.
     Раньше стопка стояла неподвижно и ждала клика — а на первом экране
     никто не кликает: человек читает заголовок и уходит к форме, так и
     не увидев, что примеров три. Смена сама показывает все источники.
     Клик оставлен: он по-прежнему работает и просто ускоряет листание.
     Анимация уже описана в CSS карточки (transform/opacity, 0.42s), здесь
     только тайминг. */
  useEffect(() => {
    if (paused) return;
    // Уважает системную настройку «уменьшить движение»: там стопка
    // остаётся статичной, и переключать её можно только руками.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setOrder(o => [...o.slice(1), o[0]]), 2000);
    return () => clearInterval(t);
  }, [paused, restart]);
  const render = (k: CollageKind) =>
    k === "ya" ? <YandexSerp n={n} slot={slot} />
    : k === "google" ? <GoogleSerp n={n} slot={slot} />
    : k === "chatgpt" ? <ChatAnswer n={n} slot={slot} brand="chatgpt" />
    : k === "claude" ? <ChatAnswer n={n} slot={slot} brand="claude" />
    : <AliceAnswer n={n} slot={slot} />;

  const label: Record<CollageKind, string> = {
    ya: "выдача Яндекса", alice: "ответ Алисы", google: "выдача Google",
    chatgpt: "ответ ChatGPT", claude: "ответ Claude",
  };

  return (
    <div
      className="mrc-collage"
      // Пауза и на мыши, и на клавиатуре: содержимое, которое меняется само,
      // должно останавливаться, пока человек его изучает.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {order.map((k, i) => (
        <button
          key={k}
          type="button"
          className={`mrc-collage-card is-${i}`}
          onClick={advance}
          aria-label={`Показать следующий пример: ${label[order[(i + 1) % order.length]]}`}
        >
          <span className="mrc-collage-tag">{label[k]}</span>
          <span aria-hidden="true">{render(k)}</span>
        </button>
      ))}
    </div>
  );
}

export const SERP_COLLAGE_CSS = `
.mrc-collage { position: relative; min-height: 560px; padding: 28px 40px 16px 0; }
.mrc-collage-card {
  position: absolute; width: 100%;
  border-radius: 12px; overflow: hidden;
  box-shadow: 0 24px 56px -20px rgba(15,23,42,0.38), 0 2px 8px rgba(15,23,42,0.08);
}
.mrc-collage-card.is-2 { transform: rotate(-6deg) translate(-10%, 23%) scale(0.88); opacity: 0.64; z-index: 1; }
.mrc-collage-card.is-1 { transform: rotate(4.5deg) translate(12%, 12%) scale(0.93); opacity: 0.84; z-index: 2; }
.mrc-collage-card.is-0 { transform: rotate(-1.6deg); z-index: 3; }

/* Основа снимка: собственные цвета сервисов, не токены лендинга */
.mrc-ui {
  background: #fff; color: #202124;
  font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
  font-size: 14.5px; line-height: 1.4; padding: 14px 16px 15px;
  border: 1px solid #dfe3e8;
}
.mrc-ui-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 11px; }
.mrc-ui-ya-logo {
  width: 24px; height: 24px; border-radius: 50%; background: #fc3f1d; color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 15px; flex-shrink: 0;
}
.mrc-ui-g-logo { font-size: 17px; letter-spacing: -0.5px; flex-shrink: 0; }
.mrc-ui-input {
  flex: 1; min-width: 0; border: 1px solid #dadce0; border-radius: 999px;
  padding: 6px 13px; font-size: 13px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mrc-ui-find {
  background: #fc3f1d; color: #fff; border-radius: 999px;
  padding: 6px 15px; font-size: 14px; font-weight: 500; flex-shrink: 0;
}
.mrc-ui-tabs { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 12px; font-size: 14px; color: #5f6368; }
.mrc-ui-tabs .is-on { background: #f0f0f0; border-radius: 999px; padding: 3px 11px; color: #202124; font-weight: 500; }
.mrc-ui-tabs span:not(.is-on) { padding: 3px 4px; }

.mrc-ui-results { display: grid; gap: 13px; }
.mrc-ui-res { display: grid; gap: 2px; }
.mrc-ui-t { color: #0b57d0; font-size: 14.5px; line-height: 1.3; }
.mrc-ui-t-g { color: #1a0dab; font-size: 15px; }
.mrc-ui-t mark { background: #fff3b0; color: inherit; padding: 0 2px; border-radius: 2px; }
.mrc-ui-u { font-size: 13.5px; }
.mrc-ui-u-ya { color: #068a3f; }
.mrc-ui-u-g { color: #4d5156; }
.mrc-ui-s { color: #4d5156; font-size: 14px; }
.mrc-ui-r { color: #70757a; font-size: 13.5px; }

/* Пустое место клиента — единственный элемент нашего цвета */
.mrc-ui-gap {
  display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
  margin-top: 4px; padding-top: 10px; border-top: 1px dashed #f0a5a5;
  font-size: 13px; color: #b91c1c;
}
.mrc-ui-gap.is-tight { margin-top: 10px; }
.mrc-ui-gap-slot {
  border: 1px dashed #dc2626; border-radius: 6px; padding: 4px 10px;
  font-family: ui-monospace, Menlo, monospace; font-size: 13px; white-space: nowrap;
}

/* Алиса */
.mrc-ui-bubble {
  background: #f0f0f0; border-radius: 14px; padding: 7px 13px;
  font-size: 13px; margin: 0 0 12px auto; width: fit-content; max-width: 80%;
}
.mrc-ui-alice-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 16px; }
.mrc-ui-think { color: #70757a; font-size: 13px; margin-bottom: 7px; }
.mrc-ui-answer { margin: 0 0 12px; font-size: 13px; color: #202124; }
.mrc-ui-tablehead { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
.mrc-ui-tablerow {
  display: flex; justify-content: space-between; gap: 12px;
  font-size: 14px; color: #4d5156; padding: 5px 0; border-top: 1px solid #eceff1;
}
.mrc-ui-sites { background: #f7f8fa; border-radius: 10px; padding: 12px 13px; }
.mrc-ui-sites-h { font-weight: 600; font-size: 14px; margin-bottom: 9px; }
.mrc-ui-site { margin-bottom: 9px; display: grid; gap: 1px; }
.mrc-ui-site-host { color: #0b57d0; font-size: 13.5px; }
.mrc-ui-site-t { color: #4d5156; font-size: 13px; line-height: 1.3; }

/* Чаты */
.mrc-ui-chat-h { margin-bottom: 11px; padding-bottom: 9px; border-bottom: 1px solid #eceff1; }
.mrc-ui-chat-mark { display: inline-flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 600; }
.mrc-ui-chat.is-chatgpt .mrc-ui-chat-mark { color: #0d8a5f; }
.mrc-ui-chat.is-claude .mrc-ui-chat-mark { color: #c15f3c; }
.mrc-ui-cites { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px; }
.mrc-ui-cite { color: #0b57d0; font-size: 13px; }

@media (max-width: 900px) {
  .mrc-collage { min-height: 0; padding: 0; }
  .mrc-collage-card { position: static; transform: none; opacity: 1; }
  .mrc-collage-card.is-1, .mrc-collage-card.is-2 { display: none; }
  .mrc-ui-alice-grid { grid-template-columns: minmax(0, 1fr); }
}
/* Карточки кликабельны: клик проматывает стопку. Кнопка, а не div —
   чтобы работало с клавиатуры и читалось скринридером. */
.mrc-collage-card {
  appearance: none; border: 0; padding: 0; background: none; text-align: left;
  cursor: pointer; font: inherit; color: inherit;
  transition: transform .42s cubic-bezier(.22,.61,.36,1), opacity .42s ease, box-shadow .3s ease;
}
.mrc-collage-card:hover { box-shadow: 0 30px 64px -18px rgba(15,23,42,.46); }
.mrc-collage-card.is-0:hover { transform: rotate(-1.6deg) translateY(-4px); }
.mrc-collage-card:focus-visible { outline: 3px solid var(--mrc-indigo); outline-offset: 4px; }
.mrc-collage-tag {
  position: absolute; top: 10px; right: 12px; z-index: 4;
  font-family: var(--f-mono); font-size: 13px; letter-spacing: .06em;
  background: #0f172a; color: #fff; border-radius: 999px; padding: 4px 11px;
  opacity: 0; transition: opacity .25s ease;
}
.mrc-collage-card.is-0 .mrc-collage-tag { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .mrc-collage-card { transition: none; }
}

`;
