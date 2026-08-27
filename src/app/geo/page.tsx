"use client";

/**
 * /geo — посадочная под главный кластер Директа: «GEO-оптимизация, продвижение
 * в нейросетях». В отличие от /check, который продаёт бесплатную диагностику,
 * эта страница продаёт услугу с ценой.
 *
 * Семантика, под которую написаны заголовки (Wordstat, показов/мес):
 * «geo оптимизация» 929, «продвижение в нейросетях» 894, «оптимизация сайта
 * под нейросети» 247, «как попасть в ChatGPT» 196+96, «продвижение в ChatGPT»
 * 148, «ai аудит сайта» 160, коммерческие хвосты «заказать» 75+81, «цена» 82,
 * «агентство» 200+96. Частотности на странице не печатаем — только формулировки.
 *
 * Воронка одна: и поле в первом экране, и форма заявки ставят ту же
 * бесплатную проверку (POST /api/mini-check) и уводят на /check, где уже
 * готовы диагностика и захват email. Своих эндпоинтов страница не заводит.
 *
 * ── Арт-дирекшн: «редакционный разбор», общий с /check ─────────────────────
 * Тёплая бумага, чернильные плиты на ключевых сценах, Playfair 900 в
 * заголовках, Inter в прозе, Merriweather в теле «ответа ассистента»,
 * Geist Mono на служебных подписях, один акцент — терракота.
 *
 * Signature-приём тот же — ОТВЕТ С ПРОПУСКОМ. Здесь он отработан на покрытии:
 * ассистент в шапке сцены переключается (Алиса → ChatGPT → Perplexity →
 * GigaChat → Claude), ответ меняется, а пустая рамка на месте посетителя
 * остаётся неизменной. Ниша (Head Promo, Zenlink, Digital Geeks) сообщает
 * покрытие рядом логотипов; мы показываем его одним живым объектом.
 * Второй раз приём отработан на цене: разрыв с рынком показан настоящей
 * шкалой с делениями, а не двумя карточками тарифов.
 *
 * Визуальный слой намеренно продублирован с /check, а не вынесен в общий
 * модуль: обе страницы самодостаточны. Правки в языке нужно вносить в оба
 * файла — /check/page.tsx и /geo/page.tsx.
 */
import { useCallback, useEffect, useState } from "react";
import { SerpCollage, SERP_COLLAGE_CSS } from "@/components/landing/SerpCollage";
import { AiRow, AiMark, AI_ROW_CSS, type AiKey } from "@/components/landing/AiMarks";
import { useRouter } from "next/navigation";

const YM_ID = 108999924;
const reach = (goal: string) => {
  try { (window as unknown as { ym?: (id: number, m: string, g: string) => void }).ym?.(YM_ID, "reachGoal", goal); } catch { /* нет Метрики — не мешаем */ }
};

/**
 * Разбор ответа API с человеческим текстом ошибки — тот же приём, что в /check.
 *
 * Прямой `r.json()` на упавшем роуте (5xx отдаётся с пустым телом) кидает
 * внутреннюю ошибку браузера, и посетитель видел бы «Failed to execute 'json'
 * on 'Response'…». На странице под платный трафик это недопустимо.
 */
async function readJson(r: Response): Promise<{ ok?: boolean; error?: string; [k: string]: unknown }> {
  const body = await r.json().catch(() => null);
  if (body && typeof body === "object") return body as { ok?: boolean; error?: string };
  return {
    ok: false,
    error: r.status >= 500
      ? "Сервис проверки сейчас недоступен. Попробуйте через пару минут — или напишите нам, посмотрим вручную."
      : "Не удалось связаться с сервисом. Проверьте соединение и попробуйте ещё раз.",
  };
}

export default function GeoPage() {
  const router = useRouter();

  // Поле первого экрана и форма заявки ведут себя одинаково, но живут отдельно:
  // человек мог начать сверху, передумать и долистать до формы.
  const [heroUrl, setHeroUrl] = useState("");
  const [heroErr, setHeroErr] = useState<string | null>(null);
  const [heroBusy, setHeroBusy] = useState(false);

  const [site, setSite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  /**
   * Ставит бесплатную проверку и уводит на /check.
   *
   * Адрес сайта передаём в query — персональных данных там нет, а страница
   * проверки при желании сможет подставить его в поле.
   *
   * Контакты (email, телефон, флаг согласия) уходят в теле запроса и
   * сохраняются в `mini_checks` — роут пишет их только при consent=true.
   * Генерацию КП это НЕ запускает: расход Claude остаётся за отдельным
   * шагом на /check, куда человек попадает следом.
   */
  const startCheck = useCallback(async (raw: string, contact?: { email: string; phone: string; consent: boolean }) => {
    const r = await fetch("/api/mini-check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: raw, ...(contact ?? {}) }),
    });
    const j = await readJson(r);
    if (!j.ok) throw new Error(j.error || "Не удалось запустить проверку");
  }, []);

  const goToCheck = useCallback((raw: string) => {
    router.push(`/check?url=${encodeURIComponent(raw)}`);
  }, [router]);

  const submitHero = useCallback(async () => {
    const u = heroUrl.trim();
    if (!u) { setHeroErr("Введите адрес сайта"); return; }
    setHeroBusy(true); setHeroErr(null);
    try {
      await startCheck(u);
      goToCheck(u);
    } catch (e) {
      setHeroErr(e instanceof Error ? e.message : "Не получилось. Попробуйте ещё раз");
      setHeroBusy(false);
    }
  }, [heroUrl, startCheck, goToCheck]);

  const submitForm = useCallback(async () => {
    const u = site.trim();
    const mail = email.trim();
    if (!u) { setFormErr("Введите адрес сайта"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setFormErr("Проверьте email"); return; }
    setFormBusy(true); setFormErr(null);
    try {
      await startCheck(u, { email: mail, phone: phone.trim(), consent });
      // Цель отправляем до навигации: после router.push страница уже уходит.
      reach("geo_lead");
      goToCheck(u);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Не получилось отправить. Попробуйте ещё раз");
      setFormBusy(false);
    }
  }, [site, email, phone, consent, startCheck, goToCheck]);

  useReveal();

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
            <span className="mrc-mono mrc-topbar-tag">GEO · продвижение в нейросетях</span>
          </header>

          <div className="mrc-hero-grid">
            <div className="mrc-hero-head">
              <div className="mrc-mono mrc-eyebrow">
                <span className="mrc-dot" aria-hidden="true" />
                оптимизация сайта под нейросети
              </div>
              <h1 className="mrc-h1">
                GEO-оптимизация:<br />продвижение<br />в&nbsp;нейросетях
              </h1>
              <p className="mrc-lead mrc-hero-lead">
                Ваши клиенты всё чаще спрашивают не поисковую строку, а ассистента: «кого посоветуешь».
                Он отвечает одним абзацем и называет одну-три компании. Мы работаем над тем,
                чтобы в этом ответе называли вас.
              </p>
            </div>

            <div className="mrc-hero-scene">
              <SerpCollage slot="ваш сайт" kinds={["chatgpt","alice","claude"]} />
            </div>

            <div className="mrc-hero-form">
              <div className="mrc-urlform">
                <div className="mrc-form-row">
                  <input
                    value={heroUrl}
                    onChange={e => setHeroUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void submitHero(); }}
                    placeholder="Адрес вашего сайта"
                    inputMode="url"
                    aria-label="Адрес сайта"
                    className="mrc-input"
                  />
                  <button onClick={() => void submitHero()} disabled={heroBusy} className="mrc-btn mrc-btn-primary">
                    {heroBusy ? "Запускаем…" : "Проверить, называют ли вас"}
                  </button>
                </div>
                {heroErr && <div className="mrc-err">{heroErr}</div>}
                <div className="mrc-hero-actions">
                  <a href="#lead" className="mrc-btn mrc-btn-secondary">Обсудить проект</a>
                  <span className="mrc-mono mrc-formnote">
                    Проверка бесплатная и без звонка: покажем, что видят на вашем сайте поисковые и нейросетевые роботы.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ряд знаков ассистентов — мгновенный сигнал категории. Ряд
              одинаковых подписей эту работу не делал: категория узнаётся
              по знакам. Марки используются номинативно — называем сервисы,
              с которыми работаем, партнёрства не подразумеваем. */}
          <div className="mrc-hero-ai">
            <span className="mrc-mono mrc-hero-ai-label">работаем с ответами</span>
            <AiRow items={["alice", "chatgpt", "claude", "perplexity", "gigachat", "gemini"]} />
          </div>
        </div>
      </section>

      <main>
        <div className="mrc-wrap">
          {/* ─── 01 · Что происходит прямо сейчас ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="01"
              title="Что происходит прямо сейчас"
              sub="Клиент выбирает подрядчика раньше, чем открывает хоть один сайт. Выбор происходит внутри ответа ассистента."
            />
            <ol className="mrc-chain">
              {CHAIN.map((c, i) => (
                <li key={c.n} className={`mrc-chain-node${i === CHAIN.length - 1 ? " is-loss" : ""}`}>
                  <span className="mrc-chain-tick" aria-hidden="true" />
                  <span className="mrc-chain-ico" aria-hidden="true"><Icon name={c.icon} /></span>
                  <span className="mrc-chain-t">{c.t}</span>
                  <span className="mrc-chain-d">{c.d}</span>
                </li>
              ))}
            </ol>
            {/* Мокап выдачи: как та же ниша выглядит глазами клиента */}
            <SerpMock
              query="продвижение в нейросетях — кто делает"
              note="Первую страницу занимают те, у кого расписаны услуги и цены. Ассистент читает эту же выдачу — и берёт названия оттуда."
            />

            <div className="mrc-callout">
              <div className="mrc-mono mrc-kicker">так уже спрашивают</div>
              <p className="mrc-body">
                Формулировки «посоветуй специалиста по продвижению в нейросетях» и «подбери агентство»
                люди набирают дословно — так разговаривают не с поисковой строкой, а с ассистентом.
                Привычка спрашивать совета у машины уже сложилась. В том числе и про вашу нишу.
              </p>
            </div>
          </section>
        </div>

        {/* ─── 02 · Чем GEO отличается от SEO — чернильный разворот ─── */}
        <section className="mrc-slab mrc-slab-sec" data-reveal>
          <div className="mrc-wrap">
            <SecHead
              idx="02"
              title="Чем GEO отличается от SEO"
              sub="Коротко, без аббревиатур и лекции: это разные права, а не разные способы делать одно и то же."
            />
            <div className="mrc-cmp">
              <div className="mrc-cmp-head" aria-hidden="true">
                <span />
                <span className="mrc-mono">SEO</span>
                <span className="mrc-mono">GEO</span>
              </div>
              {COMPARE.map(row => (
                <div key={row.k} className="mrc-cmp-row">
                  <span className="mrc-mono mrc-cmp-k">{row.k}</span>
                  <span className="mrc-cmp-cell" data-tag="seo">{row.a}</span>
                  <span className="mrc-cmp-cell mrc-cmp-cell-b" data-tag="geo">{row.b}</span>
                </div>
              ))}
            </div>
            <div className="mrc-callout is-doc">
              <p className="mrc-body" style={{ margin: 0 }}>
                <b>SEO даёт право быть найденным. GEO — право быть рекомендованным.</b>{" "}
                GEO надстраивается над SEO, а не заменяет его: если поисковый робот не видит страницу,
                в ответ нейросети она не попадёт — ассистенты берут данные из того же индекса.
              </p>
            </div>
          </div>
        </section>

        <div className="mrc-wrap">
          {/* ─── 03 · Четыре слоя работы ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="03"
              title="Четыре слоя работы"
              sub="Ассистент собирает ответ из нескольких сигналов сразу. Поэтому и работа идёт сразу по нескольким направлениям."
            />
            <div className="mrc-layers">
              {LAYERS.map(l => (
                <article key={l.n} className="mrc-layer">
                  <div className="mrc-layer-top">
                    <span className="mrc-mono mrc-layer-n">{l.n}</span>
                    <span className="mrc-layer-ico" aria-hidden="true"><Icon name={l.icon} /></span>
                  </div>
                  <h3 className="mrc-h3">{l.t}</h3>
                  <p className="mrc-body">{l.d}</p>
                </article>
              ))}
            </div>
            <div className="mrc-callout is-doc">
              <p className="mrc-body" style={{ margin: 0 }}>
                <b>Работает только связка.</b> Один слой из четырёх результата не даёт: техника без контента
                оставляет отлично читаемую пустую страницу, а контент без внешних упоминаний — текст,
                которому нечем подтвердить, что ему можно верить.
              </p>
            </div>
          </section>

          {/* ─── 04 · Покрытие ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="04"
              title="Как попасть в ChatGPT, Алису и другие ассистенты"
              sub="Работаем не с одной системой, а со всеми, где ваши клиенты уже спрашивают совета."
            />
            {/* Цветная кромка и метка — как у карточек возможностей на
                marketradar24.ru: ряд одинаковых текстовых блоков не читался
                как «покрытие пяти систем». --hue задаётся инлайном. */}
            <div className="mrc-cover">
              {COVERAGE.map(c => (
                <article key={c.name} className="mrc-cover-item" style={{ ["--hue" as string]: c.hue }}>
                  <span className="mrc-cover-edge" aria-hidden="true" />
                  <div className="mrc-cover-top">
                    <span className="mrc-cover-mark" aria-hidden="true">
                      <AiMark id={c.ai} size={16} />
                    </span>
                    <div className="mrc-mono mrc-cover-n">{c.n}</div>
                  </div>
                  <h3 className="mrc-cover-name">{c.name}</h3>
                  <p className="mrc-body">{c.d}</p>
                </article>
              ))}
            </div>
            <div className="mrc-callout is-warn">
              <p className="mrc-body" style={{ margin: 0 }}>
                <b>Работать только с ChatGPT — значит потерять большую часть русскоязычной аудитории.</b>{" "}
                Она задаёт свои вопросы Алисе и Яндекс&nbsp;Нейро, прямо внутри привычного поиска.
              </p>
            </div>
          </section>

          {/* ─── 05 · Как замеряем результат ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="05"
              title="Как замеряем результат"
              sub="Позиций в генеративной выдаче не существует: ответ собирается заново под каждую формулировку. Поэтому меряем не место, а частоту."
            />
            <ol className="mrc-steps">
              {STEPS.map(s => (
                <li key={s.n} className="mrc-step">
                  <span className="mrc-mono mrc-step-n">{s.n}</span>
                  <div className="mrc-step-text">
                    <h3 className="mrc-h3">{s.t}</h3>
                    <p className="mrc-body">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mrc-questions">
              <div className="mrc-mono mrc-kicker">контрольные вопросы — примеры формулировок</div>
              <ul className="mrc-qlist">
                {QUESTIONS.map(q => <li key={q}>{q}</li>)}
              </ul>
              <p className="mrc-body" style={{ marginTop: 16 }}>
                Стартовая точка фиксируется в первый месяц — без неё сравнивать не с чем.
                Мы показываем и сам список вопросов, и ответы целиком: цифру можно перепроверить руками.
              </p>
            </div>
          </section>
        </div>

        {/* ─── 06 · Цена — чернильная плита ─── */}
        <section className="mrc-slab mrc-slab-sec" data-reveal>
          <div className="mrc-wrap">
            <SecHead
              idx="06"
              title="Сколько стоит продвижение в нейросетях"
              sub="Два способа начать: бесплатно посмотреть, как обстоят дела, или заказать сопровождение."
            />
            <div className="mrc-price">
              <article className="mrc-price-card">
                <div className="mrc-mono mrc-kicker">вход</div>
                <h3 className="mrc-h3">AI-аудит сайта</h3>
                <div className="mrc-price-value">0 ₽</div>
                <p className="mrc-body">
                  Покажем, что видят на сайте роботы, по каким запросам вас находят
                  и кто из конкурентов забирает спрос ниши. Без звонка и без регистрации.
                </p>
                <a href="#lead" className="mrc-btn mrc-btn-secondary mrc-price-btn">Начать с проверки</a>
              </article>

              <article className="mrc-price-card is-main">
                <div className="mrc-mono mrc-kicker">сопровождение</div>
                <h3 className="mrc-h3">Работа по четырём слоям</h3>
                <div className="mrc-price-value">от 25 000 ₽<span className="mrc-price-unit"> / мес</span></div>
                <p className="mrc-body">
                  Техника, контент, внешние упоминания и репутация. Ежемесячный замер по фиксированному
                  списку вопросов. Тексты, разметка, публикации и доступы остаются у вас.
                </p>
                <a href="#lead" className="mrc-btn mrc-btn-primary mrc-price-btn">Обсудить проект</a>
              </article>
            </div>

            {/* Разрыв с рынком показан шкалой — тот же измерительный язык, что и на /check */}
            <div className="mrc-gap">
              <div className="mrc-mono mrc-kicker">бюджеты на GEO, ₽ в месяц</div>
              <Scale />
              <p className="mrc-note mrc-gap-note">
                Ориентиры рынка — из отраслевого обзора GEO-услуг: вилка агентств 80&nbsp;000—200&nbsp;000 ₽/мес,
                средний рабочий бюджет 140&nbsp;000—160&nbsp;000 ₽/мес.
              </p>
            </div>

            <div className="mrc-why">
              <div className="mrc-why-col">
                <div className="mrc-mono mrc-kicker">почему у нас дешевле</div>
                <ul className="mrc-ul">
                  {CHEAPER.map(t => <li key={t}>{t}</li>)}
                </ul>
              </div>
              <div className="mrc-why-col">
                <div className="mrc-mono mrc-kicker mrc-kicker-muted">чего за эти деньги не будет</div>
                <ul className="mrc-ul mrc-ul-cross">
                  {NOT_INCLUDED.map(t => <li key={t}>{t}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <div className="mrc-wrap">
          {/* ─── 07 · Чего мы не обещаем ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="07"
              title="Чего мы не обещаем"
              sub="В этой нише принято обещать первое место в ChatGPT. Мы так не умеем и объясняем почему."
            />
            <div className="mrc-honest">
              {HONEST.map(h => (
                <article key={h.claim} className="mrc-honest-row">
                  <div className="mrc-honest-claim">
                    <span className="mrc-mono mrc-honest-tag">так обещают</span>
                    <s>«{h.claim}»</s>
                  </div>
                  <div className="mrc-honest-truth">
                    <span className="mrc-mono mrc-honest-tag mrc-honest-tag-ok">как есть</span>
                    <p className="mrc-body" style={{ margin: 0 }}>{h.truth}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ─── 08 · Когда GEO не окупится ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="08"
              title="Когда GEO не окупится"
              sub="Четыре случая, в которых мы сами не советуем начинать. Лучше сказать сразу, чем через полгода."
            />
            <div className="mrc-no">
              {NOT_FOR.map(n => (
                <article key={n.t} className="mrc-no-item">
                  <h3 className="mrc-h3">{n.t}</h3>
                  <p className="mrc-body">{n.d}</p>
                </article>
              ))}
            </div>
            <p className="mrc-note">
              Если вы попали в этот список — так и скажем по итогам проверки.
              Продавать сопровождение, которое не окупится, невыгодно нам самим.
            </p>
          </section>
        </div>

        {/* ─── Форма заявки ─── */}
        <section className="mrc-slab mrc-final" id="lead" data-reveal>
          <div className="mrc-wrap mrc-final-grid">
            <div className="mrc-final-copy">
              <div className="mrc-mono mrc-kicker">заявка</div>
              <h2 className="mrc-h2">Обсудить проект</h2>
              <p className="mrc-lead">
                Оставьте сайт и почту. Начнём с бесплатной проверки, а дальше вместе решим,
                есть ли в вашей нише смысл в сопровождении.
              </p>
            </div>

            <div className="mrc-final-form">
              <div className="mrc-fields">
                <label className="mrc-field">
                  <span className="mrc-mono mrc-field-label">сайт</span>
                  <input
                    value={site}
                    onChange={e => setSite(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void submitForm(); }}
                    placeholder="mysite.ru"
                    inputMode="url"
                    className="mrc-input"
                  />
                </label>
                <label className="mrc-field">
                  <span className="mrc-mono mrc-field-label">email</span>
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void submitForm(); }}
                    placeholder="you@company.ru"
                    inputMode="email"
                    className="mrc-input"
                  />
                </label>
                <label className="mrc-field">
                  <span className="mrc-mono mrc-field-label">телефон — необязательно</span>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void submitForm(); }}
                    placeholder="+7"
                    inputMode="tel"
                    className="mrc-input"
                  />
                </label>
              </div>

              <button
                onClick={() => void submitForm()}
                disabled={!consent || formBusy}
                className="mrc-btn mrc-btn-primary mrc-submit"
              >
                {formBusy ? "Отправляем…" : "Отправить заявку"}
              </button>

              {/* Согласие по инструкции: обе ссылки, чекбокс не проставлен заранее */}
              <label className="mrc-consent">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                  className="mrc-checkbox" />
                <span>
                  Даю{" "}
                  <a href="/legal/consent-pd" target="_blank" rel="noopener noreferrer">согласие</a>{" "}
                  на обработку персональных данных в соответствии с{" "}
                  <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">Политикой обработки персональных данных</a>
                </span>
              </label>
              {formErr && <div className="mrc-err">{formErr}</div>}
            </div>
          </div>
        </section>
      </main>

      <footer className="mrc-footer">
        <div className="mrc-wrap mrc-footer-inner">
          <span className="mrc-mono">MarketRadar · продвижение в нейросетях</span>
          <nav className="mrc-footer-nav">
            <a href="/legal/privacy">Политика обработки персональных данных</a>
            <a href="/legal/consent-pd">Согласие на обработку данных</a>
            <a href="/check">Бесплатная проверка сайта</a>
            <a href="/">О платформе</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ─── Signature-приём: ответ ассистента с пропуском ─────────────────────────
   Здесь он же несёт мысль о покрытии: ассистент переключается, ответ
   переписывается, пустая рамка на месте посетителя не меняется никогда.
   Это пример, а не реальные данные, — так и подписано в самой сцене.
   Названия конкурентов условные: выдумывать чужие бренды мы не имеем права,
   реальные имена приходят в полном разборе на /check. */

const SCENES: { who: string; q: string; a: [string, string, string] }[] = [
  {
    who: "Алиса",
    q: "посоветуй, к кому обратиться — и сколько это стоит",
    a: ["Из тех, кто занимается этим поблизости, чаще упоминают ", " и ", ". У обоих заполнены карточки на картах и есть свежие отзывы."],
  },
  {
    who: "ChatGPT",
    q: "какие компании делают это — назови несколько",
    a: ["По открытым источникам заметны ", " и ", ": на сайтах описаны услуги, цены и условия работы."],
  },
  {
    who: "Perplexity",
    q: "подбери подрядчика и покажи, откуда данные",
    a: ["Опираюсь на два источника — ", " и ", ": у обоих есть страницы услуг с ценами."],
  },
  {
    who: "GigaChat",
    q: "к кому обратиться за этим в России",
    a: ["Из российских подрядчиков в этой нише обычно называют ", " и ", "."],
  },
  {
    who: "Claude",
    q: "кому из них можно доверять — и почему",
    a: ["Судя по описаниям на сайтах, задачу закрывают ", " и ", " — у них видно порядок работ и сроки."],
  },
];

const SERP_ROWS: { pos: string; title: [string, string, string]; url: string; snip: [string, string, string]; rate: string; reviews: string }[] = [
  {
    pos: "1",
    title: ["", "Конкурент А", " — услуги и цены, работаем с 2014 года"],
    url: "konkurent-a.ru › uslugi › ceny",
    snip: ["Полный список услуг с ", "ценами и сроками", ". Расчёт за день, договор, гарантия на работы."],
    rate: "4,8",
    reviews: "62 отзыва",
  },
  {
    pos: "2",
    title: ["Заказать у ", "Конкурента Б", ": стоимость, отзывы, портфолио"],
    url: "konkurent-b.ru › zakazat",
    snip: ["Отвечаем на ", "частые вопросы клиентов", " прямо на странице: что входит, сколько стоит, когда результат."],
    rate: "4,6",
    reviews: "41 отзыв",
  },
  {
    pos: "3",
    title: ["", "Конкурент В", " — сколько это стоит в 2026 году"],
    url: "konkurent-v.ru › blog › skolko-stoit",
    snip: ["Разбор ", "цен по рынку", " с примерами расчёта. Таблица тарифов и условия работы."],
    rate: "4,4",
    reviews: "28 отзывов",
  },
];



function SerpMock({ query, note }: { query: string; note: string }) {
  return (
    <figure className="mrc-serp">
      <figcaption className="mrc-mono mrc-serp-cap">
        <span className="mrc-ans-live" aria-hidden="true" />
        так выглядит выдача по вашему запросу · мокап, названия условные
      </figcaption>

      <div className="mrc-serp-bar">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor"
          strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
          <circle cx="9" cy="9" r="6" /><path d="M13.5 13.5 17 17" />
        </svg>
        <span className="mrc-serp-q">{query}</span>
      </div>

      <div className="mrc-serp-tabs" aria-hidden="true">
        <span className="is-on">Поиск</span>
        <span>Ответ ИИ</span>
        <span>Услуги</span>
        <span>Карты</span>
        <span>Картинки</span>
      </div>

      <ol className="mrc-serp-list">
        {SERP_ROWS.map(r => (
          <li key={r.pos} className="mrc-serp-item">
            <span className="mrc-mono mrc-serp-pos">{r.pos}</span>
            <div className="mrc-serp-body">
              <span className="mrc-serp-title">{r.title[0]}<b>{r.title[1]}</b>{r.title[2]}</span>
              <span className="mrc-mono mrc-serp-url">{r.url}</span>
              <p className="mrc-serp-snip">{r.snip[0]}<b>{r.snip[1]}</b>{r.snip[2]}</p>
              <span className="mrc-serp-rate">
                <svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor" aria-hidden="true">
                  <path d="m10 2.5 2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1L2.5 8l5.2-.8z" />
                </svg>
                <b>{r.rate}</b> · {r.reviews}
              </span>
            </div>
          </li>
        ))}
        <li className="mrc-serp-item is-you">
          <span className="mrc-mono mrc-serp-pos">—</span>
          <div className="mrc-serp-empty">
            <span className="mrc-mono mrc-serp-empty-t">вашего сайта здесь нет</span>
            <span className="mrc-serp-empty-d">{note}</span>
          </div>
        </li>
      </ol>
    </figure>
  );
}

function RadarMark() {
  return (
    <svg className="mrc-logo" width="34" height="34" viewBox="0 0 64 64" fill="none"
      aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="mrc-logo-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--mrc-cyan)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--mrc-cyan)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mrc-logo-blade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--mrc-cyan)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--mrc-cyan)" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#mrc-logo-glow)" />
      {[28, 20, 12].map(r => (
        <circle key={r} cx="32" cy="32" r={r} stroke="var(--mrc-logo-ring)" strokeWidth="0.8" fill="none" opacity="0.6" />
      ))}
      <g opacity="0.5" stroke="var(--mrc-cyan)">
        <line x1="32" y1="32" x2="48" y2="18" strokeWidth="0.6" opacity="0.6" />
        <line x1="32" y1="32" x2="20" y2="22" strokeWidth="0.6" opacity="0.6" />
        <line x1="32" y1="32" x2="44" y2="46" strokeWidth="0.6" opacity="0.6" />
        <line x1="32" y1="32" x2="18" y2="42" strokeWidth="0.6" opacity="0.6" />
        <line x1="48" y1="18" x2="44" y2="46" strokeWidth="0.5" opacity="0.35" />
        <line x1="20" y1="22" x2="18" y2="42" strokeWidth="0.5" opacity="0.35" />
      </g>
      <circle cx="48" cy="18" r="2" fill="var(--mrc-green)" />
      <circle cx="20" cy="22" r="2" fill="var(--mrc-cyan)" />
      <circle cx="44" cy="46" r="2" fill="var(--mrc-violet)" />
      <circle cx="18" cy="42" r="2" fill="var(--mrc-cyan)" />
      <circle cx="54" cy="34" r="1" fill="var(--mrc-cyan)" opacity="0.5" />
      <circle cx="10" cy="30" r="1" fill="var(--mrc-cyan)" opacity="0.5" />
      <circle cx="32" cy="8" r="1" fill="var(--mrc-cyan)" opacity="0.5" />
      <g className="mrc-logo-sweep">
        <path d="M 32 32 L 60 32 A 28 28 0 0 0 52 12 Z" fill="url(#mrc-logo-blade)" />
      </g>
      <circle cx="32" cy="32" r="3" fill="var(--mrc-cyan)" />
      <circle cx="32" cy="32" r="5" stroke="var(--mrc-cyan)" strokeWidth="0.5" fill="none" opacity="0.4" />
    </svg>
  );
}

function AnswerScene({ slot }: { slot: string }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI(v => (v + 1) % SCENES.length), 4600);
    return () => clearInterval(t);
  }, [auto]);

  const s = SCENES[i];

  return (
    <figure className="mrc-ans">
      <figcaption className="mrc-mono mrc-ans-cap">
        <span className="mrc-ans-live" aria-hidden="true" />
        пример ответа ассистента · названия условные
      </figcaption>

      <div className="mrc-tabs" role="tablist" aria-label="Ассистент">
        {SCENES.map((sc, n) => (
          <button
            key={sc.who}
            role="tab"
            aria-selected={n === i}
            className={`mrc-tab mrc-mono${n === i ? " is-on" : ""}`}
            onClick={() => { setI(n); setAuto(false); }}
          >
            {sc.who}
          </button>
        ))}
      </div>

      <div className="mrc-ans-q">
        <span className="mrc-mono mrc-ans-qlabel">вопрос клиента</span>
        <p className="mrc-ans-qtext" key={`q${i}`}>
          «{s.q}»<i className="mrc-caret" aria-hidden="true" />
        </p>
      </div>

      <div className="mrc-ans-body">
        <p className="mrc-ans-text" key={`a${i}`}>
          {s.a[0]}
          <mark className="mrc-name">Конкурент&nbsp;А</mark>
          {s.a[1]}
          <mark className="mrc-name mrc-name-2">Конкурент&nbsp;Б</mark>
          {s.a[2]}
        </p>
        <div className="mrc-slot">
          <span className="mrc-slot-box" title={slot}>{slot}</span>
          <span className="mrc-mono mrc-slot-note">в ответе не назван</span>
        </div>
      </div>
    </figure>
  );
}

/* ─── Контент разделов ─────────────────────────────────────────────────── */

const CHAIN: { n: string; icon: IconName; t: string; d: string }[] = [
  { n: "01", icon: "ask", t: "Человек спрашивает ассистента", d: "Не «сайты по запросу», а прямой вопрос: кого посоветуешь, к кому обратиться, где заказать и сколько это стоит." },
  { n: "02", icon: "answer", t: "Тот называет несколько компаний", d: "Не список из десяти ссылок, а короткий ответ: одна-три компании и пара аргументов, почему именно они." },
  { n: "03", icon: "decide", t: "Выбор сделан до сайтов", d: "Человек не открывает десять вкладок. Он идёт к тем, кого ему назвали, — а часто сразу к одному." },
  { n: "04", icon: "out", t: "Кого не назвали — того нет", d: "Вы не проиграли сравнение. Вы в него не попали: сравнивать вас с кем-то было не на чем." },
];

const COMPARE: { k: string; a: string; b: string }[] = [
  { k: "какое право даёт", a: "Быть найденным в поиске", b: "Быть названным в рекомендации" },
  { k: "что видит клиент", a: "Список ссылок, выбирает сам", b: "Готовый ответ с именами компаний" },
  { k: "за что идёт борьба", a: "За место в первой тройке выдачи", b: "За упоминание внутри самого ответа" },
  { k: "как считается результат", a: "Позиции по запросам и трафик", b: "Доля ответов, где назван ваш бренд" },
  { k: "что первично", a: "Фундамент — без него ничего", b: "Надстройка поверх фундамента" },
];

const LAYERS: { n: string; icon: IconName; t: string; d: string }[] = [
  { n: "01", icon: "gear", t: "Техника сайта", d: "Скорость, структура, заголовки, разметка данных, карта сайта, доступ для поисковых и нейросетевых роботов. Чтобы машина могла прочитать, чем вы занимаетесь, для кого и на каких условиях." },
  { n: "02", icon: "text", t: "Контент под извлечение ответа", d: "Страницы услуг, прямые ответы на реальные вопросы клиентов, цены и условия словами, а не картинкой. Ассистент пересказывает текст — если текста нет, пересказывать нечего." },
  { n: "03", icon: "link", t: "Внешние упоминания и Digital PR", d: "Публикации на отраслевых площадках, каталоги, профили на картах, экспертные материалы. Робот больше доверяет тому, о ком пишут не только на его собственном сайте." },
  { n: "04", icon: "star", t: "Репутация", d: "Отзывы там, где их читают, и ответы на них. Оценки и формулировки из отзывов попадают в ответ ассистента почти дословно — вместе с претензиями." },
];

/* Каждому ассистенту — свой цвет из палитры продакшена: ряд одинаковых
   строк не читался как «покрытие». Глифы абстрактные, чужие товарные
   знаки не воспроизводим. */
const COVERAGE: { n: string; ai: AiKey; name: string; d: string; hue: string }[] = [
  { n: "01", ai: "alice" as AiKey, name: "Алиса и Яндекс Нейро", d: "Ответы прямо внутри привычного поиска и в колонках. Основной канал русскоязычного спроса — и чаще всего самый недооценённый.", hue: "var(--mrc-red)" },
  { n: "02", ai: "chatgpt" as AiKey, name: "ChatGPT", d: "Самый известный ассистент, в том числе с веб-поиском. Обычно первый, кого пробуют, — и первый, где замечают отсутствие бренда.", hue: "var(--mrc-green)" },
  { n: "03", ai: "claude" as AiKey, name: "Claude", d: "Помощник для рабочих задач и длинных текстов. Отвечает по тем же сигналам: структура страницы, разметка, внешние источники.", hue: "var(--mrc-violet)" },
  { n: "04", ai: "perplexity" as AiKey, name: "Perplexity", d: "Ассистент-поисковик: отвечает со ссылками на источники. Удобен тем, что прямо показывает, откуда взялось упоминание.", hue: "var(--mrc-cyan)" },
  { n: "05", ai: "gigachat" as AiKey, name: "GigaChat", d: "Российский ассистент. Важен там, где клиент — корпоративный или государственный сегмент.", hue: "var(--mrc-amber)" },
];

const STEPS: { n: string; t: string; d: string }[] = [
  { n: "01", t: "Фиксируем список контрольных вопросов", d: "Реальные формулировки, которыми ваших клиентов спрашивают ассистента. Список согласуется один раз и дальше не меняется — иначе замеры несравнимы." },
  { n: "02", t: "Прогоняем его каждый месяц", d: "Те же вопросы, те же системы, тот же порядок. Меняется только дата прогона." },
  { n: "03", t: "Считаем долю ответов с упоминанием", d: "Сколько ответов из прогона содержат ваш бренд. Это и есть метрика — её видно в динамике месяц к месяцу." },
];

const QUESTIONS = [
  "посоветуй специалиста по …",
  "подбери агентство, которое занимается …",
  "к кому обратиться за … в Москве",
  "где заказать … и сколько это стоит",
  "какие компании делают … — назови несколько",
];

const CHEAPER = [
  "Платформа вместо команды подрядчиков: сбор данных, семантика, мониторинг ответов и подготовка контента идут через MarketRadar. Человек подключается там, где нужен человек.",
  "Digital PR без наценки: платные размещения оплачиваются по счёту площадки напрямую. Мы не перепродаём публикации.",
  "Нет слоя аккаунт-менеджмента: вы общаетесь с теми, кто делает работу, без отдельного человека с презентацией между вами.",
];

const NOT_INCLUDED = [
  "Персональной команды из пяти человек на вашем проекте.",
  "Еженедельных презентаций в переговорной.",
  "Гарантии позиции в ответе нейросети — её не существует ни за 25, ни за 200 тысяч.",
];

const HONEST: { claim: string; truth: string }[] = [
  {
    claim: "Первое место в ChatGPT",
    truth: "Фиксированных мест в ответах нейросетей не существует: ответ собирается заново под каждую формулировку вопроса и меняется от запроса к запросу. Подрядчик, который обещает первое место, либо сам не разобрался, либо рассчитывает, что вы не станете проверять.",
  },
  {
    claim: "Результат с первой недели",
    truth: "Первые изменения обычно видны через 1–3 месяца, устойчивый эффект — от полугода. Роботам нужно заново обойти сайт, публикациям — разойтись по площадкам, отзывам — накопиться. Быстрее этого не работает ни у кого.",
  },
  {
    claim: "Всё останется у подрядчика",
    truth: "Тексты, статьи, разметка, публикации, доступы и аккаунты — ваши с первого дня. Если мы расстанемся, всё сделанное остаётся работать на вас, а не выключается вместе с договором.",
  },
];

const NOT_FOR: { t: string; d: string }[] = [
  { t: "Клиенты приходят только по рекомендациям и тендерам", d: "Если сделки закрываются в личных контактах и на закупочных площадках, ассистент в этой цепочке просто не участвует." },
  { t: "О вашей нише почти не спрашивают ассистентов", d: "Есть рынки, где решение принимают по каталогу, ГОСТу или прайсу поставщика. Это видно на этапе проверки — и мы скажем прямо." },
  { t: "Результат нужен через две недели", d: "За две недели успевает измениться техника сайта — и на этом всё. Внешние сигналы и переобход так быстро не работают." },
  { t: "Готовы вкладываться только в один слой из четырёх", d: "Отдельно взятая техника или отдельно взятый Digital PR эффекта не дают. Лучше не начинать, чем потратить бюджет на четверть работы." },
];

/* ─── Шкала бюджетов ───────────────────────────────────────────────────── */

/** Верх шкалы — с запасом над рыночным потолком, чтобы деления читались. */
const SCALE_MAX = 220_000;
const pct = (v: number) => `${((v / SCALE_MAX) * 100).toFixed(2)}%`;
const SCALE_TICKS = [0, 50_000, 100_000, 150_000, 200_000];

function Scale() {
  return (
    <div className="mrc-scale">
      <div className="mrc-scale-track">
        {/* Вилка агентств 80–200 тыс, внутри неё — средний рабочий бюджет 140–160 тыс */}
        <span className="mrc-scale-band" style={{ left: pct(80_000), width: pct(120_000) }} />
        <span className="mrc-scale-core" style={{ left: pct(140_000), width: pct(20_000) }} />
        <span className="mrc-scale-us" style={{ left: pct(25_000) }} />
      </div>
      <div className="mrc-scale-ruler" aria-hidden="true">
        {SCALE_TICKS.map(t => (
          <span key={t} className="mrc-scale-tick" style={{ left: pct(t) }}>
            <i />
            <em className="mrc-mono">{t === 0 ? "0" : `${t / 1000} тыс`}</em>
          </span>
        ))}
      </div>
      <ul className="mrc-scale-legend">
        <li><span className="mrc-swatch is-us" aria-hidden="true" />
          <b>25 000 ₽/мес</b> — наше сопровождение</li>
        <li><span className="mrc-swatch is-core" aria-hidden="true" />
          <b>140 000—160 000 ₽/мес</b> — средний рабочий бюджет на рынке</li>
        <li><span className="mrc-swatch is-band" aria-hidden="true" />
          <b>80 000—200 000 ₽/мес</b> — вилка GEO-агентств</li>
      </ul>
    </div>
  );
}

/* ─── Общие блоки ──────────────────────────────────────────────────────── */

function SecHead({ idx, title, sub }: { idx: string; title: string; sub: string }) {
  return (
    <header className="mrc-sec-head">
      <span className="mrc-num" aria-hidden="true">{idx}</span>
      <div className="mrc-sec-text">
        <h2 className="mrc-h2">{title}</h2>
        <p className="mrc-lead">{sub}</p>
      </div>
    </header>
  );
}

/* ─── Иконки: один набор, 20×20, обводка currentColor ──────────────────── */

type IconName = "ask" | "answer" | "decide" | "out" | "gear" | "text" | "link" | "star";

function Icon({ name }: { name: IconName }) {
  const P: Record<IconName, React.ReactNode> = {
    ask: <><path d="M17 12a2 2 0 0 1-2 2H7l-4 3V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /><path d="M8 7.5a2 2 0 1 1 2.7 1.9c-.4.2-.7.6-.7 1.1" /><path d="M10 12.6v.01" /></>,
    answer: <><path d="M3 4h14M3 9h14M3 14h9" /></>,
    decide: <><path d="m3 10 4 4 10-10" /><path d="M17 10v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4" /></>,
    out: <><path d="M11 3h6v6" /><path d="M17 3 9 11" /><path d="M15 12v5H3V5h5" /></>,
    gear: <><circle cx="10" cy="10" r="3" /><path d="M10 1v3M10 16v3M1 10h3M16 10h3M3.6 3.6l2.1 2.1M14.3 14.3l2.1 2.1M16.4 3.6l-2.1 2.1M5.7 14.3l-2.1 2.1" /></>,
    text: <><path d="M4 3h12v14H4z" /><path d="M7 7h6M7 10h6M7 13h3" /></>,
    link: <><path d="M8 12a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L9 6" /><path d="M12 8a3.5 3.5 0 0 0-5 0l-2.5 2.5a3.5 3.5 0 0 0 5 5L11 14" /></>,
    star: <><path d="m10 2.5 2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1L2.5 8l5.2-.8z" /></>,
  };
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}

/* ─── Ревилы: включаются только если движение разрешено ────────────────── */

function useReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // В скрытой вкладке IntersectionObserver не срабатывает — анимацию не
    // включаем вовсе, иначе контент остался бы на opacity: 0.
    if (document.hidden) return;
    const root = document.querySelector(".mrc-root");
    if (!root) return;
    // Скрывающий класс вешаем из JS: без скрипта контент виден всегда.
    root.classList.add("mrc-anim");
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      }
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });
    root.querySelectorAll("[data-reveal]").forEach(el => {
      // Уже видимое на первом экране показываем сразу, не дожидаясь колбэка.
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
      else io.observe(el);
    });
    return () => io.disconnect();
  }, []);
}

/* ─── Стили страницы ───────────────────────────────────────────────────────
   Тот же язык, что и на /check. Роли цвета заданы четырьмя переменными —
   --rule, --soft, --surface, --flare-use, — и переопределяются внутри
   чернильной плиты (.mrc-slab): один компонент живёт на бумаге и на графите
   без дублей стилей. Глобальный globals.css душит h1/h2 на мобильном через
   !important, поэтому размеры заголовков помечены !important и здесь. */

const CSS = AI_ROW_CSS + `
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
  font-size: 12.5px;
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
  padding: 8px 11px; font-size: 10.5px; letter-spacing: 0.06em; text-transform: none;
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
  font-family: var(--f-mono); font-size: 12.5px; letter-spacing: 0.06em;
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
  text-transform: none; letter-spacing: 0.02em; font-size: 11.5px; max-width: 46ch;
}
.mrc-consent {
  display: flex; gap: 11px; align-items: flex-start; margin-top: 16px;
  cursor: pointer; font-size: 12.5px; line-height: 1.55; color: var(--soft);
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
.mrc-num {
  font-family: var(--f-display); font-size: clamp(48px, 5vw, 76px); font-weight: 900;
  line-height: 0.72; letter-spacing: -0.04em;
  color: transparent;
  -webkit-text-stroke: 1px color-mix(in oklch, var(--flare-use) 55%, transparent);
}
@supports not ((-webkit-text-stroke: 1px red)) {
  .mrc-num { color: color-mix(in oklch, var(--flare-use) 30%, transparent); }
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
.mrc-scale { padding: 4px 14px 0; }
.mrc-scale-track {
  position: relative; height: 28px; margin-bottom: 4px;
  border-left: 1px solid var(--rule); border-right: 1px solid var(--rule);
}
.mrc-scale-band {
  position: absolute; top: 8px; height: 12px;
  background: color-mix(in oklch, var(--soft) 30%, transparent);
}
.mrc-scale-core {
  position: absolute; top: 4px; height: 20px;
  background: color-mix(in oklch, var(--soft) 65%, transparent);
}
.mrc-scale-us {
  position: absolute; top: 0; width: 5px; height: 28px;
  background: var(--flare-use);
  box-shadow: 0 0 0 4px color-mix(in oklch, var(--flare-use) 22%, transparent);
}
.mrc-scale-ruler { position: relative; height: 28px; }
.mrc-scale-tick { position: absolute; top: 0; transform: translateX(-50%); text-align: center; }
.mrc-scale-tick i { display: block; width: 1px; height: 7px; background: var(--rule); margin: 0 auto 5px; }
.mrc-scale-tick em { font-style: normal; color: var(--soft); font-size: 10px; white-space: nowrap; }
.mrc-scale-legend { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 8px; }
.mrc-scale-legend li {
  display: flex; align-items: baseline; gap: 10px;
  font-size: 13px; line-height: 1.5; color: var(--soft);
}
.mrc-scale-legend b { color: inherit; font-variant-numeric: tabular-nums; font-weight: 700; }
.mrc-swatch { width: 12px; height: 12px; flex-shrink: 0; transform: translateY(1px); }
.mrc-swatch.is-us { background: var(--flare-use); }
.mrc-swatch.is-core { background: color-mix(in oklch, var(--soft) 65%, transparent); }
.mrc-swatch.is-band { background: color-mix(in oklch, var(--soft) 30%, transparent); }
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
.mrc-footer { border-top: 1px solid var(--rule); padding: 26px 0 38px; }
.mrc-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.mrc-footer-inner > .mrc-mono { color: var(--soft); }
.mrc-footer-nav { display: flex; gap: 20px; flex-wrap: wrap; }
.mrc-footer-nav a {
  font-size: 12.5px; color: var(--soft); text-decoration: none;
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
  .mrc-eyebrow { margin-bottom: 16px; font-size: 10px; letter-spacing: 0.07em; }
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
  .mrc-slot-box { font-size: 11.5px; padding: 0 12px; }
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
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--soft);
  }
  .mrc-cmp-cell-b::before { color: var(--flare-use); }

  .mrc-layers, .mrc-cover, .mrc-price, .mrc-no, .mrc-why, .mrc-fields { grid-template-columns: minmax(0, 1fr); }
  .mrc-honest-row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .mrc-step { grid-template-columns: 44px minmax(0, 1fr); gap: 0 12px; }

  .mrc-scale { padding: 4px 18px 0; }
  .mrc-scale-tick em { font-size: 9px; }
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

` + SERP_COLLAGE_CSS;
