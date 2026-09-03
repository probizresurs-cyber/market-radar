"use client";

/**
 * /competitors — посадочная под кластер «анализ конкурентов».
 *
 * Появилась потому, что этот адрес уже стоял среди направлений рекламы и
 * отдавал 404: платный клик уходил в никуда, а Директ за 404 режет качество
 * объявления сильнее, чем расхождение текста.
 *
 * Оффер отличается от соседних страниц. /new продаёт диагностику своего
 * сайта, /geo — попадание в ответы ассистентов. Здесь предмет разговора —
 * ЧУЖИЕ сайты: кто именно забирает спрос и чего у них есть такого, чего нет
 * у вас. Поэтому первый экран говорит не «проверим ваш сайт», а «покажем
 * поимённо, кто выше вас и по каким запросам».
 *
 * Воронка общая: поле ставит ту же бесплатную проверку (POST /api/mini-check)
 * и уводит на /new, где уже готовы и показ диагностики, и захват контакта.
 * Своих эндпоинтов и второй реализации формы страница не заводит — иначе
 * правки начнут расходиться между тремя посадочными.
 *
 * ОТСЮДА — ФОРМУЛИРОВКИ ПРО ДВА ШАГА. Мини-проверка меряет три вещи про
 * САМ сайт: видимость, скорость, читаемость для ассистентов. Конкурентов
 * поимённо в ней нет — они появляются в полном разборе, следующим шагом.
 * Поэтому кнопка называет обе ступени, а не только вторую: обещание
 * «показать конкурентов» на экране, который их не показывает, — то же
 * самое, за что мы ругаем рынок в разделе про частые обещания.
 *
 * ГЛАВНОЕ ОГРАНИЧЕНИЕ, ОТ КОТОРОГО НАПИСАН ТЕКСТ. Про конкурентов легко
 * наобещать лишнего: «покажем их бюджеты», «отдадим их семантику целиком»,
 * «расскажем, откуда у них заявки». Ничего из этого измерить нельзя — видно
 * только открытое: позиции в выдаче, содержимое страниц, упоминания и отзывы.
 * Страница обещает ровно это и отдельным разделом перечисляет, чего узнать
 * нельзя в принципе.
 *
 * Визуальный слой общий с /new и /geo (LANDING_CSS, LandingBits) — язык
 * оформления один, содержание своё.
 */
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { SerpCollage, SERP_COLLAGE_CSS } from "@/components/landing/SerpCollage";
import { AI_ROW_CSS } from "@/components/landing/AiMarks";
import { LANDING_CSS } from "@/components/landing/landing-css";
import { RadarMark, SecHead } from "@/components/landing/LandingBits";
import { VENDOR_PUBLIC, DEMO_REPORTS } from "@/lib/vendor-public";
import { readAttribution } from "@/lib/attribution";

const YM_ID = 108999924;
const reach = (goal: string) => {
  try {
    (window as unknown as { ym?: (id: number, m: string, g: string) => void }).ym?.(YM_ID, "reachGoal", goal);
  } catch { /* нет Метрики — не мешаем отправке */ }
};

/** Разбор ответа API с человеческим текстом ошибки — тот же приём, что на /new. */
async function readJson(r: Response): Promise<{ ok?: boolean; error?: string }> {
  const body = await r.json().catch(() => null);
  if (body && typeof body === "object") return body as { ok?: boolean; error?: string };
  return {
    ok: false,
    error: r.status >= 500
      ? "Сервис проверки сейчас недоступен. Попробуйте через пару минут — или напишите нам, посмотрим вручную."
      : "Не получилось запустить проверку. Попробуйте ещё раз.",
  };
}

/* Своего CSS у страницы почти нет: акцент в заголовке и сброс списка.
   Всё остальное — общие классы из LANDING_CSS. */
const CSS = AI_ROW_CSS + LANDING_CSS + SERP_COLLAGE_CSS + `
.mrcc-grad {
  background: linear-gradient(92deg, var(--mrc-cyan), var(--mrc-violet));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.mrcc-list { list-style: none; margin: 0; padding: 0; }
`;

/** Что видно про конкурента и откуда именно — источник у каждой строки свой. */
const WHAT_WE_SEE: { t: string; d: string; src: string }[] = [
  {
    t: "Кто стоит выше вас и по каким запросам",
    d: "Списком: домен, запрос, его позиция и ваша. Не «лидеры рынка» вообще, а конкретные адреса, которые забирают спрос прямо сейчас.",
    src: "база видимости, топ-50 Яндекса",
  },
  {
    t: "Запросы, которых у вас нет вовсе",
    d: "Спрос ниши, по которому вас не находят: что ищут ваши клиенты и куда они попадают вместо вас.",
    src: "сопоставление семантики доменов",
  },
  {
    t: "Что у них написано на странице",
    d: "Цены, условия, ответы на вопросы, разметка услуг. Обычно разрыв не в бюджете, а в том, что у соседа это написано словами, а у вас — картинкой или никак.",
    src: "разбор страниц конкурента",
  },
  {
    t: "Кого называют ассистенты",
    d: "Что отвечают Алиса, ChatGPT и Google AI на вопросы ваших клиентов и чьи сайты они цитируют как источник.",
    src: "живые запросы к ассистентам",
  },
  {
    t: "Что о них пишут снаружи",
    d: "Упоминания на отраслевых площадках, профили на картах, оценки и формулировки из отзывов — они попадают в ответ ассистента почти дословно.",
    src: "карты, каталоги, публикации",
  },
];

/** Чего узнать нельзя — граница названа до того, как её нащупает клиент. */
const LIMITS: { t: string; d: string }[] = [
  {
    t: "Рекламные бюджеты конкурента",
    d: "Их не публикует ни одна площадка. Оценки «по косвенным признакам» — гадание, и мы такое не продаём.",
  },
  {
    t: "Сколько у них заявок",
    d: "Это внутренние данные компании. Снаружи видна активность и видимость, а не результат.",
  },
  {
    t: "Их полную семантику",
    d: "Видно то, что попало в топ-50 и в открытые источники. Часть запросов останется за кадром — у любого инструмента, включая дорогие.",
  },
  {
    t: "Что они планируют делать дальше",
    d: "Видно только сделанное. Прогноз чужих планов — фантазия, а не аналитика.",
  },
];

/** Три фразы из ниши и почему они невыполнимы. Тон тот же, что на /new и /geo. */
const HONEST: { claim: string; truth: string }[] = [
  {
    claim: "Отдадим все ключи конкурента",
    truth: "Целиком чужую семантику не видит никто: открытые базы показывают запросы, по которым домен попал в топ-50, и это лишь часть. Обещание «всех ключей» означает, что подрядчик выдаёт срез за полный список.",
  },
  {
    claim: "Скажем их рекламный бюджет",
    truth: "Площадки не публикуют затраты рекламодателей. Любая названная сумма — оценка по косвенным признакам, которую не сможете проверить ни вы, ни мы.",
  },
  {
    claim: "Обгоним их за месяц",
    truth: "Первые изменения видны через один-три месяца — это сроки самих площадок: переобход сайта, накопление публикаций и отзывов. Обгон занимает столько, сколько конкурент шёл к своим позициям, минус то, что можно наверстать работой.",
  },
];

/** Где обычно проходит разрыв: одна и та же характеристика у вас и у них. */
const GAPS: [string, string, string][] = [
  ["цены", "«Рассчитывается индивидуально» или только по запросу", "Указаны прямо на странице — числом, с условиями"],
  ["услуги", "Общий список без подробностей", "Отдельная страница на каждую услугу, с ответами на вопросы"],
  ["разметка", "Нет — робот видит текст, но не понимает, что это услуга и её цена", "Услуги и цены размечены, ассистенту есть что процитировать"],
  ["отзывы", "Есть, но не там, где их читают", "На картах и в каталогах, с ответами компании"],
  ["упоминания", "Только собственный сайт", "Публикации на отраслевых площадках и в каталогах"],
];

export default function CompetitorsPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = useCallback(async () => {
    const u = url.trim();
    if (!u) { setErr("Введите адрес сайта"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/mini-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u, utm: readAttribution() }),
      });
      const j = await readJson(r);
      if (!j.ok) throw new Error(j.error || "Не удалось запустить проверку");
      // Общая цель воронки — по ней учатся стратегии всех трёх кампаний;
      // отдельная цель страницы оставлена для отчётности по источнику.
      reach("mini_check_start");
      reach("competitors_check_start");
      // На /new человек видит результат проверки своего сайта; имена
      // конкурентов — в разборе за ней. Последовательность названа в
      // подписи под полем, чтобы переход не выглядел подменой.
      router.push(`/нейросети?url=${encodeURIComponent(u)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }, [url, router]);

  /* Форма стоит дважды — на первом и последнем экране. Одна разметка на обе:
     разъехавшиеся кнопки на одной странице выглядят как разные продукты. */
  const form = (note: string) => (
    <div className="mrc-urlform">
      <div className="mrc-form-row">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void start(); }}
          placeholder="Адрес сайта, например mysite.ru"
          inputMode="url"
          aria-label="Адрес сайта"
          className="mrc-input"
        />
        <button onClick={() => void start()} disabled={busy} className="mrc-btn mrc-btn-primary">
          {busy ? "Запускаем…" : "Проверить сайт и найти конкурентов"}
        </button>
      </div>
      {err && <div className="mrc-err">{err}</div>}
      <div className="mrc-mono mrc-formnote">{note}</div>
    </div>
  );

  return (
    <div className="mrc-root">
      <style>{CSS}</style>

      {/* ─── Первый экран ─── */}
      <section className="mrc-slab mrc-hero">
        <div className="mrc-wrap">
          <header className="mrc-topbar">
            <a href="/" className="mrc-wordmark" aria-label="MarketRadar24">
              <RadarMark />
              <span aria-hidden="true">Market<b>Radar24</b></span>
            </a>
            <span className="mrc-mono mrc-topbar-tag">анализ конкурентов · 0 ₽</span>
          </header>

          <div className="mrc-hero-grid">
            <div className="mrc-hero-head">
              <div className="mrc-mono mrc-eyebrow">
                <span className="mrc-dot" aria-hidden="true" />
                бесплатно · без звонка · результат на экране
              </div>
              <h1 className="mrc-h1">
                Кто забирает<br /><span className="mrcc-grad">ваших клиентов</span>
              </h1>
              <p className="mrc-lead mrc-hero-lead">
                Не «лидеры рынка» вообще, а конкретные сайты: кто стоит выше вас,
                по каким запросам и чего у них есть такого, чего нет у вас.
                Начинаем с бесплатной проверки вашего сайта — ни почты, ни звонка;
                следом разбор, где конкуренты названы поимённо.
              </p>
            </div>

            <div className="mrc-hero-scene">
              <SerpCollage slot="ваш сайт" kinds={["ya", "alice", "chatgpt"]} />
            </div>

            <div className="mrc-hero-form">
              {form("Первый шаг — проверка вашего сайта: нужен только адрес. Имена конкурентов приходят следом, в разборе.")}
            </div>
          </div>
        </div>
      </section>

      <main>
        <div className="mrc-wrap">
          {/* ─── 01 · Что именно вы увидите ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="01"
              title="Что именно вы увидите"
              sub="Это содержимое разбора — второго шага после проверки сайта. Каждая строка с источником: откуда взяли и что это доказывает."
            />
            <ol className="mrcc-list">
              {WHAT_WE_SEE.map((w, i) => (
                <li key={w.t} className="mrc-instr-row">
                  <span className="mrc-mono mrc-instr-n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mrc-instr-t">{w.t}</span>
                  <span className="mrc-instr-d">
                    {w.d}
                    <br />
                    <span className="mrc-note">источник: {w.src}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* ─── 02 · Где обычно разрыв ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="02"
              title="Где обычно проходит разрыв"
              sub="За редким исключением дело не в бюджете. Разница видна на самих страницах."
            />
            <div className="mrc-cmp">
              <div className="mrc-cmp-head mrc-mono" aria-hidden="true">
                <span />
                <span>как чаще всего у вас</span>
                <span>как у того, кто выше</span>
              </div>
              {GAPS.map(([k, you, them]) => (
                <div key={k} className="mrc-cmp-row">
                  <span className="mrc-mono mrc-cmp-k">{k}</span>
                  <span className="mrc-cmp-cell" data-tag="у вас">{you}</span>
                  <span className="mrc-cmp-cell mrc-cmp-cell-b" data-tag="у них">{them}</span>
                </div>
              ))}
            </div>
            <div className="mrc-callout">
              <p className="mrc-body" style={{ margin: 0 }}>
                <b>Почти всё в этой таблице — работа, а не бюджет.</b>{" "}
                Поэтому разрыв сокращается: цены и условия можно описать словами, услуги — разметить,
                отзывы — собрать там, где их читают. Что именно делать в вашем случае, покажет разбор.
              </p>
            </div>
          </section>

          {/* ─── 03 · Чего узнать нельзя ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="03"
              title="Чего узнать нельзя"
              sub="Про конкурентов принято обещать лишнего. Границу называем сразу, а не когда вы её нащупаете."
            />
            <div className="mrc-no">
              {LIMITS.map(l => (
                <article key={l.t} className="mrc-no-item">
                  <h3 className="mrc-h3">{l.t}</h3>
                  <p className="mrc-body" style={{ margin: "8px 0 0" }}>{l.d}</p>
                </article>
              ))}
            </div>
            <p className="mrc-note">
              Видно то, что открыто: позиции, содержимое страниц, упоминания и отзывы.
              Этого хватает, чтобы понять, за счёт чего конкурент выше — и что из этого повторимо.
            </p>
          </section>

          {/* ─── 04 · Разбираем частые обещания ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="04"
              title="Разбираем частые обещания"
              sub="Три фразы, которые чаще всего слышат при заказе анализа конкурентов."
            />
            <div className="mrc-honest">
              {HONEST.map(h => (
                <article key={h.claim} className="mrc-honest-row">
                  <div className="mrc-honest-claim">
                    <span className="mrc-mono mrc-honest-tag">часто обещают</span>
                    <s>«{h.claim}»</s>
                  </div>
                  <div className="mrc-honest-truth">
                    <span className="mrc-mono mrc-honest-tag mrc-honest-tag-ok">почему так не бывает</span>
                    <p className="mrc-body" style={{ margin: 0 }}>{h.truth}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ─── 05 · Кто это делает ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="05"
              title="Кто это делает"
              sub="Договор, оплата по счёту, закрывающие документы."
            />
            <div className="mrc-who">
              <article className="mrc-who-card">
                <div className="mrc-mono mrc-who-label">исполнитель</div>
                <div className="mrc-who-name">MarketRadar</div>
                <p className="mrc-who-about">
                  Команда, которая делает и саму платформу анализа, и работы по её находкам.
                  Не перепродаём подряд: техника сайта, контент, внешние упоминания и репутация —
                  внутри одной команды, один счёт и один ответственный.
                </p>
                <p className="mrc-who-about">
                  Работаем по договору, оплата по счёту. Реквизиты — в подвале страницы.
                </p>
              </article>
              <article className="mrc-who-card">
                <div className="mrc-mono mrc-who-label">связь</div>
                <ul className="mrc-who-links">
                  <li><a href={"mailto:" + VENDOR_PUBLIC.email}>{VENDOR_PUBLIC.email}</a></li>
                  <li>
                    <a href={VENDOR_PUBLIC.telegram} target="_blank" rel="noopener noreferrer">
                      Telegram — {VENDOR_PUBLIC.telegramLabel}
                    </a>
                  </li>
                </ul>
                <div className="mrc-mono mrc-who-label" style={{ marginTop: 18 }}>документы</div>
                <ul className="mrc-who-links">
                  <li><a href="/legal/offer" target="_blank" rel="noopener noreferrer">Публичная оферта</a></li>
                  <li><a href="/legal/privacy" target="_blank" rel="noopener noreferrer">Политика обработки персональных данных</a></li>
                </ul>
              </article>
            </div>

            {DEMO_REPORTS.length > 0 && (
              <>
                <div className="mrc-mono mrc-who-label" style={{ marginTop: 26 }}>как выглядит разбор</div>
                <div className="mrc-who-demos">
                  {DEMO_REPORTS.map(d => (
                    <a key={d.href} className="mrc-who-demo" href={d.href} target="_blank" rel="noopener noreferrer">
                      <span className="mrc-who-demo-t">{d.title}</span>
                      <span className="mrc-note">{d.note}</span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        {/* ─── Финальный экран ─── */}
        <section className="mrc-slab mrc-final" data-reveal>
          <div className="mrc-wrap mrc-final-grid">
            <div>
              <div className="mrc-mono mrc-kicker">анализ конкурентов</div>
              <h2 className="mrc-h2">Начните с адреса,<br />а не с договора</h2>
              <p className="mrc-lead">
                Введите сайт: сначала бесплатная проверка, следом разбор с именами тех, кто стоит выше вас.
                Дальше решите сами, нужны мы вам или нет.
              </p>
            </div>
            <div>
              {form("Бесплатно и без звонка. Сначала проверка сайта, имена конкурентов — в разборе следом.")}
              <div className="mrc-callout">
                <p className="mrc-body" style={{ margin: 0 }}>
                  Разбор с конкурентами — <b>0 ₽</b>. Работа по его находкам —{" "}
                  <b>от 25 000 ₽ в месяц</b>: техника сайта, контент, внешние упоминания
                  и репутация ведутся вместе, по одному счёту.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mrc-footer">
        <div className="mrc-wrap mrc-footer-inner">
          {/* Реквизиты в подвале — как на /new и /geo: посетитель с рекламы
              должен видеть, кому он платит, а не только адрес почты. */}
          <span className="mrc-mono">
            {VENDOR_PUBLIC.legalName} · ИНН {VENDOR_PUBLIC.inn} · ОГРНИП {VENDOR_PUBLIC.ogrn}
          </span>
          <nav className="mrc-footer-nav">
            <a href={"mailto:" + VENDOR_PUBLIC.email}>{VENDOR_PUBLIC.email}</a>
            <a href="/legal/offer">Оферта</a>
            <a href="/legal/privacy">Политика обработки персональных данных</a>
            <a href="/legal/consent-pd">Согласие на обработку данных</a>
            <a href="/geo">Продвижение в нейросетях</a>
            <a href="/нейросети">Бесплатная проверка сайта</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
