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
 * бесплатную проверку (POST /api/mini-check) и уводят на /new, где уже
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
import { LANDING_CSS } from "@/components/landing/landing-css";
import { AiRow, AiMark, AI_ROW_CSS, type AiKey } from "@/components/landing/AiMarks";
import { useRouter } from "next/navigation";
import { VENDOR_PUBLIC, DEMO_REPORTS } from "@/lib/vendor-public";
import { readAttribution } from "@/lib/attribution";

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
  // Рекламное согласие отдельно от согласия на обработку ПД: смешивать их
  // нельзя, а услуга не должна зависеть от готовности получать рассылку.
  const [marketing, setMarketing] = useState(false);
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
  const startCheck = useCallback(async (raw: string, contact?: { email: string; phone: string; consent: boolean; marketing?: boolean }) => {
    const r = await fetch("/api/mini-check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: raw, utm: readAttribution(), ...(contact ?? {}) }),
    });
    const j = await readJson(r);
    if (!j.ok) throw new Error(j.error || "Не удалось запустить проверку");
  }, []);

  const goToCheck = useCallback((raw: string) => {
    router.push(`/new?url=${encodeURIComponent(raw)}`);
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
      await startCheck(u, { email: mail, phone: phone.trim(), consent, marketing });
      // Цель отправляем до навигации: после router.push страница уже уходит.
      reach("geo_lead");
      goToCheck(u);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Не получилось отправить. Попробуйте ещё раз");
      setFormBusy(false);
    }
  }, [site, email, phone, consent, marketing, startCheck, goToCheck]);

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
          {/* ─── 07 · Обещания, которых не бывает ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="07"
              title="Обещания, которых не бывает"
              sub="Фразы, которые чаще всего слышат от подрядчиков в этой нише. Разбираем, почему ни одна из них невыполнима."
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

          {/* ─── 09 · Кто это делает ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="09"
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
                  <li><a href={VENDOR_PUBLIC.telegram} target="_blank" rel="noopener noreferrer">Telegram — {VENDOR_PUBLIC.telegramLabel}</a></li>
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
              <label className="mrc-consent">
                <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)}
                  className="mrc-checkbox" />
                <span>
                  Даю{" "}
                  <a href="/legal/consent-marketing" target="_blank" rel="noopener noreferrer">согласие</a>{" "}
                  на получение рекламных и маркетинговых рассылок — необязательно
                </span>
              </label>
              {formErr && <div className="mrc-err">{formErr}</div>}
            </div>
          </div>
        </section>
      </main>

      <footer className="mrc-footer">
        <div className="mrc-wrap mrc-footer-inner">
          {/* Реквизиты в футере — тот же разбор, что и на /new: посетитель с
              рекламы должен видеть, кому он платит, а не только адрес почты. */}
          <span className="mrc-mono">
            {VENDOR_PUBLIC.legalName} · ИНН {VENDOR_PUBLIC.inn} · ОГРНИП {VENDOR_PUBLIC.ogrn}
          </span>
          <nav className="mrc-footer-nav">
            <a href={"mailto:" + VENDOR_PUBLIC.email}>{VENDOR_PUBLIC.email}</a>
            <a href="/legal/offer">Оферта</a>
            <a href="/legal/privacy">Политика обработки персональных данных</a>
            <a href="/legal/consent-pd">Согласие на обработку данных</a>
            <a href="/competitors">Анализ конкурентов</a>
            <a href="/new">Бесплатная проверка сайта</a>
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

/**
 * Сравнение цен — тремя строками, без шкалы.
 *
 * Шкала была: полоса 0–220 тыс с полосками рынка и риской «мы». На ней
 * наши 25 тысяч превращались в почти невидимую засечку у нуля, а полосы
 * рынка визуально не связывались с подписями — читатель видел пустую
 * линейку и три строки текста под ней. Приём не работал: сравнение
 * держится на числах, а не на длине полосок.
 */
function Scale() {
  const rows: { v: string; d: string; us?: boolean }[] = [
    { v: "от 25 000 ₽/мес", d: "наше сопровождение", us: true },
    { v: "140 000—160 000 ₽/мес", d: "средний рабочий бюджет на рынке" },
    { v: "80 000—200 000 ₽/мес", d: "вилка GEO-агентств" },
  ];
  return (
    <ul className="mrc-prices">
      {rows.map(r => (
        <li key={r.v} className={r.us ? "is-us" : undefined}>
          <b>{r.v}</b>
          <span>{r.d}</span>
        </li>
      ))}
    </ul>
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

const CSS = AI_ROW_CSS + LANDING_CSS + SERP_COLLAGE_CSS;
