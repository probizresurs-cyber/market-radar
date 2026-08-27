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
 * Арт-дирекшн наследует /check — «лист замеров»: рейка с засечкой, Geist Mono
 * на служебных подписях, Inter на прозе, острые радиусы токена, плотность
 * вместо воздуха. Визуальный слой намеренно продублирован, а не вынесен в
 * общий модуль: обе страницы самодостаточны. Правки в языке нужно вносить
 * в оба файла — /check/page.tsx и /geo/page.tsx.
 *
 * Signature-приём здесь дополнительно отработан на цене: разрыв с рынком
 * показан настоящей шкалой с делениями, а не двумя карточками тарифов.
 */
import { useCallback, useEffect, useState } from "react";
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

      <header className="mrc-topbar">
        <a href="/" className="mrc-wordmark">
          <span className="mrc-logo-tick" aria-hidden="true" />
          MarketRadar
        </a>
        <span className="mrc-mono mrc-topbar-tag">GEO · продвижение в нейросетях</span>
      </header>

      <main>
        {/* ─── Первый экран ─── */}
        <section className="mrc-hero">
          <div className="mrc-wrap mrc-hero-inner">
            <div className="mrc-mono mrc-eyebrow">
              <span className="mrc-dot" aria-hidden="true" />
              оптимизация сайта под нейросети
            </div>
            <h1 className="mrc-h1">
              GEO-оптимизация: продвижение&nbsp;в&nbsp;нейросетях
            </h1>
            <p className="mrc-lead mrc-hero-lead">
              Ваши клиенты всё чаще спрашивают не поисковую строку, а ассистента: «кого посоветуешь».
              ChatGPT, Алиса и Perplexity отвечают одним абзацем и называют одну-три компании.
              Мы работаем над тем, чтобы в этом ответе называли вас.
            </p>

            <div className="mrc-urlform">
              <div className="mrc-form-row">
                <input
                  value={heroUrl}
                  onChange={e => setHeroUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void submitHero(); }}
                  placeholder="Адрес сайта, например mysite.ru"
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
        </section>

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
                  <span className="mrc-mono mrc-chain-n">{c.n}</span>
                  <span className="mrc-chain-ico" aria-hidden="true"><Icon name={c.icon} /></span>
                  <span className="mrc-chain-t">{c.t}</span>
                  <span className="mrc-chain-d">{c.d}</span>
                </li>
              ))}
            </ol>
            <div className="mrc-callout">
              <span className="mrc-tick mrc-tick-primary" aria-hidden="true" />
              <div className="mrc-mono mrc-kicker">так уже спрашивают</div>
              <p className="mrc-body">
                Формулировки «посоветуй специалиста по продвижению в нейросетях» и «подбери агентство»
                люди набирают дословно — так разговаривают не с поисковой строкой, а с ассистентом.
                Привычка спрашивать совета у машины уже сложилась. В том числе и про вашу нишу.
              </p>
            </div>
          </section>

          {/* ─── 02 · Чем GEO отличается от SEO ─── */}
          <section className="mrc-sec" data-reveal>
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
            <div className="mrc-conclusion">
              <span className="mrc-tick mrc-tick-primary" aria-hidden="true" />
              <p className="mrc-body" style={{ margin: 0 }}>
                <b>SEO даёт право быть найденным. GEO — право быть рекомендованным.</b>{" "}
                GEO надстраивается над SEO, а не заменяет его: если поисковый робот не видит страницу,
                в ответ нейросети она не попадёт — ассистенты берут данные из того же индекса.
              </p>
            </div>
          </section>

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
                  <span className="mrc-tick" aria-hidden="true" />
                  <div className="mrc-layer-top">
                    <span className="mrc-mono mrc-layer-n">{l.n}</span>
                    <span className="mrc-layer-ico" aria-hidden="true"><Icon name={l.icon} /></span>
                  </div>
                  <h3 className="mrc-h3">{l.t}</h3>
                  <p className="mrc-body">{l.d}</p>
                </article>
              ))}
            </div>
            <div className="mrc-strip">
              <span className="mrc-tick mrc-tick-primary" aria-hidden="true" />
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
            <div className="mrc-cover">
              {COVERAGE.map(c => (
                <article key={c.name} className="mrc-cover-item">
                  <span className="mrc-tick" aria-hidden="true" />
                  <div className="mrc-mono mrc-cover-n">{c.n}</div>
                  <h3 className="mrc-cover-name">{c.name}</h3>
                  <p className="mrc-body">{c.d}</p>
                </article>
              ))}
            </div>
            <div className="mrc-strip is-warn">
              <span className="mrc-tick" style={{ background: "var(--warning)" }} aria-hidden="true" />
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
                  <span className="mrc-step-tick" aria-hidden="true" />
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
                {QUESTIONS.map(q => <li key={q} className="mrc-mono">{q}</li>)}
              </ul>
              <p className="mrc-body" style={{ marginTop: 14 }}>
                Стартовая точка фиксируется в первый месяц — без неё сравнивать не с чем.
                Мы показываем и сам список вопросов, и ответы целиком: цифру можно перепроверить руками.
              </p>
            </div>
          </section>

          {/* ─── 06 · Цена ─── */}
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="06"
              title="Сколько стоит продвижение в нейросетях"
              sub="Два способа начать: бесплатно посмотреть, как обстоят дела, или заказать сопровождение."
            />
            <div className="mrc-price">
              <article className="mrc-price-card">
                <span className="mrc-tick" aria-hidden="true" />
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
                <span className="mrc-tick mrc-tick-primary" aria-hidden="true" />
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
          </section>

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
                  <span className="mrc-tick" style={{ background: "var(--destructive)" }} aria-hidden="true" />
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

          {/* ─── Форма заявки ─── */}
          <section className="mrc-final" id="lead" data-reveal>
            <span className="mrc-tick mrc-tick-primary" aria-hidden="true" />
            <div className="mrc-mono mrc-kicker">заявка</div>
            <h2 className="mrc-h2">Обсудить проект</h2>
            <p className="mrc-lead">
              Оставьте сайт и почту. Начнём с бесплатной проверки, а дальше вместе решим,
              есть ли в вашей нише смысл в сопровождении.
            </p>

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
          </section>
        </div>
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

const COVERAGE: { n: string; name: string; d: string }[] = [
  { n: "01", name: "Алиса и Яндекс Нейро", d: "Ответы прямо внутри привычного поиска и в колонках. Основной канал русскоязычного спроса — и чаще всего самый недооценённый." },
  { n: "02", name: "ChatGPT", d: "Самый известный ассистент, в том числе с веб-поиском. Обычно первый, кого пробуют, — и первый, где замечают отсутствие бренда." },
  { n: "03", name: "Claude", d: "Помощник для рабочих задач и длинных текстов. Отвечает по тем же сигналам: структура страницы, разметка, внешние источники." },
  { n: "04", name: "Perplexity", d: "Ассистент-поисковик: отвечает со ссылками на источники. Удобен тем, что прямо показывает, откуда взялось упоминание." },
  { n: "05", name: "GigaChat", d: "Российский ассистент. Важен там, где клиент — корпоративный или государственный сегмент." },
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
            <em className="mrc-mono">{t === 0 ? "0" : `${t / 1000} тыс`}</em>
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
      <span className="mrc-mono mrc-sec-idx">{idx}</span>
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
   Тот же язык, что и на /check: только токены дизайн-системы, оттенки через
   color-mix от токенов, светлая и тёмная темы без правок. Своя таблица нужна
   из-за медиа-запросов, hover/focus и анимаций, которых inline-стили не умеют. */

const CSS = `
.mrc-root {
  --mrc-tint: color-mix(in oklch, var(--primary) 6%, transparent);
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-inter), 'Inter', system-ui, sans-serif;
  overflow-x: hidden;
}
.mrc-wrap { max-width: 1060px; margin: 0 auto; padding: 0 20px; }

.mrc-mono {
  font-family: var(--font-geist-mono), ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}

/* ── Верхняя планка ── */
.mrc-topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  max-width: 1060px; margin: 0 auto; padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}
.mrc-wordmark {
  display: inline-flex; align-items: center; gap: 9px;
  font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
  color: var(--foreground); text-decoration: none;
}
.mrc-logo-tick { width: 14px; height: 3px; background: var(--primary); display: inline-block; }
.mrc-topbar-tag { color: var(--muted-foreground); }

/* ── Типографика ── */
.mrc-h1 {
  font-size: clamp(28px, 5.6vw, 52px);
  font-weight: 800; line-height: 1.06; letter-spacing: -0.03em;
  margin: 0 0 16px; text-wrap: balance;
}
.mrc-h2 {
  font-size: clamp(21px, 3.2vw, 30px);
  font-weight: 750; line-height: 1.18; letter-spacing: -0.02em; margin: 0 0 8px;
}
.mrc-h3 { font-size: 16.5px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; margin: 0 0 8px; }
.mrc-lead { font-size: 15px; line-height: 1.6; color: var(--muted-foreground); margin: 0; max-width: 62ch; }
.mrc-body { font-size: 14px; line-height: 1.62; color: var(--muted-foreground); margin: 0; }
.mrc-note { font-size: 13px; line-height: 1.55; color: var(--muted-foreground); }
.mrc-err { color: var(--destructive); font-size: 13.5px; margin-top: 10px; }
.mrc-kicker { color: var(--primary); margin-bottom: 8px; }
.mrc-kicker-muted { color: var(--muted-foreground); }
.mrc-ul { margin: 10px 0 0; padding-left: 0; list-style: none; }
.mrc-ul li {
  position: relative; padding-left: 18px; font-size: 13.5px; line-height: 1.55;
  color: var(--muted-foreground); margin-bottom: 9px;
}
.mrc-ul li::before {
  content: ''; position: absolute; left: 0; top: 0.62em;
  width: 8px; height: 1px; background: var(--muted-foreground); opacity: 0.7;
}
.mrc-ul-cross li::before {
  content: '×'; top: 0; left: 1px; width: auto; height: auto;
  background: none; opacity: 1; color: var(--destructive);
  font-size: 14px; line-height: 1.55;
}

/* Засечка на рейке — signature-приём */
.mrc-tick {
  position: absolute; top: -1px; left: -1px;
  width: 26px; height: 3px; background: var(--border);
}
.mrc-tick-primary { background: var(--primary); }

/* ── Первый экран ── */
.mrc-hero { position: relative; border-bottom: 1px solid var(--border); overflow: hidden; }
.mrc-hero::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(to right, color-mix(in oklch, var(--border) 60%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklch, var(--border) 60%, transparent) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(130% 90% at 50% 0%, #000 0%, transparent 72%);
  mask-image: radial-gradient(130% 90% at 50% 0%, #000 0%, transparent 72%);
}
.mrc-hero-inner { position: relative; z-index: 1; padding-top: 34px; padding-bottom: 40px; }
.mrc-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  color: var(--muted-foreground); margin-bottom: 18px;
  border: 1px solid var(--border); background: var(--card);
  padding: 6px 11px; border-radius: var(--radius-sm);
}
.mrc-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--success) 22%, transparent);
}
.mrc-hero-lead { font-size: 16px; margin-bottom: 24px; max-width: 58ch; }
.mrc-hero-actions {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 14px;
}
.mrc-hero-actions .mrc-formnote { margin-top: 0; flex: 1 1 260px; }

/* ── Формы ── */
.mrc-urlform { max-width: 620px; }
.mrc-form-row { display: flex; gap: 8px; flex-wrap: wrap; }
.mrc-input {
  flex: 1 1 240px; min-width: 0; width: 100%; height: 48px; padding: 0 14px;
  font-family: inherit; font-size: 15px;
  border-radius: var(--radius); border: 1px solid var(--input);
  background: var(--input-bg); color: var(--foreground); outline: none;
  transition: border-color var(--motion-fast) var(--ease), box-shadow var(--motion-fast) var(--ease);
}
.mrc-input::placeholder { color: var(--muted-foreground); }
.mrc-input:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 18%, transparent);
}
.mrc-btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 48px; min-height: 48px; padding: 0 22px;
  font-family: inherit; font-size: 15px; font-weight: 650; letter-spacing: -0.01em;
  border: 1px solid transparent; border-radius: var(--radius);
  cursor: pointer; white-space: nowrap; text-decoration: none;
  transition: filter var(--motion-fast) var(--ease), opacity var(--motion-fast) var(--ease),
              background-color var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease);
}
.mrc-btn-primary { background: var(--primary); color: var(--primary-foreground); }
.mrc-btn-primary:hover:not(:disabled) { filter: brightness(0.92); }
.mrc-btn-secondary { background: transparent; color: var(--foreground); border-color: var(--border); }
.mrc-btn-secondary:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.mrc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mrc-btn:focus-visible, .mrc-input:focus-visible, .mrc-root a:focus-visible, .mrc-checkbox:focus-visible {
  outline: 2px solid var(--ring); outline-offset: 2px;
}
.mrc-formnote {
  color: var(--muted-foreground); margin-top: 12px; line-height: 1.5;
  text-transform: none; letter-spacing: 0.02em; font-size: 11.5px;
}
.mrc-consent {
  display: flex; gap: 10px; align-items: flex-start; margin-top: 14px;
  cursor: pointer; font-size: 12.5px; line-height: 1.55; color: var(--muted-foreground);
}
.mrc-consent a { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
.mrc-checkbox {
  margin: 1px 0 0; width: 16px; height: 16px; min-height: 16px;
  accent-color: var(--primary); flex-shrink: 0; cursor: pointer;
}

/* ── Секции ── */
.mrc-sec { position: relative; border-top: 1px solid var(--border); padding: 34px 0 42px; }
.mrc-sec::before { content: ''; position: absolute; top: -1px; left: 0; width: 26px; height: 3px; background: var(--primary); }
.mrc-sec-head {
  display: grid; grid-template-columns: 56px minmax(0, 1fr); align-items: start;
  margin-bottom: 24px;
}
.mrc-sec-idx { color: var(--muted-foreground); padding-top: 6px; font-size: 12px; }
.mrc-sec-text { min-width: 0; }

/* ── Схема ── */
.mrc-chain {
  list-style: none; margin: 0; padding: 0; position: relative;
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 14px;
}
.mrc-chain::before {
  content: ''; position: absolute; left: 0; right: 0; top: 5px; height: 1px; background: var(--border);
}
.mrc-chain-node { position: relative; padding-top: 22px; }
.mrc-chain-tick {
  position: absolute; top: 0; left: 0; width: 11px; height: 11px;
  background: var(--background); border: 3px solid var(--primary);
}
.mrc-chain-node.is-loss .mrc-chain-tick { border-color: var(--destructive); }
.mrc-chain-n { color: var(--muted-foreground); display: block; margin-bottom: 10px; }
.mrc-chain-ico { display: block; color: var(--primary); margin-bottom: 10px; }
.mrc-chain-node.is-loss .mrc-chain-ico { color: var(--destructive); }
.mrc-chain-t { display: block; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 6px; }
.mrc-chain-d { display: block; font-size: 13px; line-height: 1.55; color: var(--muted-foreground); }

/* ── Плашки ── */
.mrc-callout, .mrc-strip, .mrc-conclusion {
  position: relative; margin-top: 22px; padding: 18px 20px;
  background: var(--mrc-tint);
  border: 1px solid color-mix(in srgb, var(--primary) 30%, var(--border));
  border-radius: var(--radius);
}
.mrc-strip.is-warn {
  background: color-mix(in oklch, var(--warning) 10%, transparent);
  border-color: color-mix(in srgb, var(--warning) 40%, var(--border));
}
.mrc-callout .mrc-body, .mrc-strip .mrc-body, .mrc-conclusion .mrc-body {
  color: var(--foreground); font-size: 14.5px;
}
.mrc-sec > .mrc-note { display: block; margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--border); }

/* ── Сравнение ── */
.mrc-cmp { border-top: 1px solid var(--border); }
.mrc-cmp-head, .mrc-cmp-row {
  display: grid; grid-template-columns: minmax(0, 200px) minmax(0, 1fr) minmax(0, 1fr); gap: 0 18px;
}
.mrc-cmp-head { padding: 10px 0; border-bottom: 1px solid var(--border); color: var(--muted-foreground); }
.mrc-cmp-head span:nth-child(3) { color: var(--primary); }
.mrc-cmp-row { padding: 14px 0; border-bottom: 1px solid var(--border); align-items: baseline; }
.mrc-cmp-k { color: var(--muted-foreground); }
.mrc-cmp-cell { font-size: 14px; line-height: 1.5; }
.mrc-cmp-cell-b { color: var(--foreground); font-weight: 600; }

/* ── Слои ── */
.mrc-layers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.mrc-layer {
  position: relative; background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
  transition: border-color var(--motion-fast) var(--ease);
}
.mrc-layer:hover { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); }
.mrc-layer:hover > .mrc-tick { background: var(--primary); }
.mrc-layer-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.mrc-layer-n { color: var(--muted-foreground); }
.mrc-layer-ico { color: var(--primary); display: inline-flex; }

/* ── Покрытие ── */
.mrc-cover { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.mrc-cover-item {
  position: relative; background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px 20px;
}
.mrc-cover-n { color: var(--muted-foreground); margin-bottom: 10px; }
.mrc-cover-name { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 8px; }

/* ── Шаги замера ── */
.mrc-steps { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
.mrc-step {
  position: relative; display: grid; grid-template-columns: 56px minmax(0, 1fr);
  gap: 0 16px; padding: 18px 0; border-bottom: 1px solid var(--border);
}
.mrc-step-tick { position: absolute; top: -1px; left: 0; width: 26px; height: 3px; background: var(--primary); }
.mrc-step-n { color: var(--muted-foreground); padding-top: 2px; }
.mrc-step-text { min-width: 0; }

.mrc-questions {
  margin-top: 22px; padding: 20px; background: var(--card);
  border: 1px solid var(--border); border-radius: var(--radius);
}
.mrc-qlist { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.mrc-qlist li {
  position: relative; padding: 9px 12px 9px 30px;
  background: var(--background); border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-size: 12px; letter-spacing: 0.02em; text-transform: none;
  color: var(--foreground); overflow-wrap: anywhere;
}
.mrc-qlist li::before {
  content: '?'; position: absolute; left: 12px; top: 9px;
  color: var(--primary); font-weight: 700;
}

/* ── Цена ── */
.mrc-price { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.mrc-price-card {
  position: relative; display: flex; flex-direction: column;
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 22px;
}
.mrc-price-card.is-main { border-color: var(--primary); }
.mrc-price-value {
  font-size: clamp(28px, 4.4vw, 40px); font-weight: 800; letter-spacing: -0.03em;
  line-height: 1.05; margin: 4px 0 12px; font-variant-numeric: tabular-nums;
}
.mrc-price-unit { font-size: 0.42em; font-weight: 600; color: var(--muted-foreground); letter-spacing: 0; }
.mrc-price-btn { margin-top: auto; align-self: flex-start; }
.mrc-price-card .mrc-body { margin-bottom: 18px; }

/* Шкала бюджетов — рыночный разрыв как измерительный прибор */
.mrc-gap {
  margin-top: 22px; padding: 20px; background: var(--card);
  border: 1px solid var(--border); border-radius: var(--radius);
}
.mrc-scale { padding: 4px 14px 0; }
.mrc-scale-track {
  position: relative; height: 26px; margin-bottom: 4px;
  border-left: 1px solid var(--border); border-right: 1px solid var(--border);
}
.mrc-scale-band {
  position: absolute; top: 7px; height: 12px;
  background: color-mix(in oklch, var(--muted-foreground) 24%, transparent);
  border-radius: 2px;
}
.mrc-scale-core {
  position: absolute; top: 3px; height: 20px;
  background: color-mix(in oklch, var(--muted-foreground) 55%, transparent);
  border-radius: 2px;
}
.mrc-scale-us {
  position: absolute; top: 0; width: 4px; height: 26px;
  background: var(--primary); border-radius: 1px;
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 18%, transparent);
}
.mrc-scale-ruler { position: relative; height: 26px; }
.mrc-scale-tick { position: absolute; top: 0; transform: translateX(-50%); text-align: center; }
.mrc-scale-tick i { display: block; width: 1px; height: 6px; background: var(--border); margin: 0 auto 4px; }
.mrc-scale-tick em { font-style: normal; color: var(--muted-foreground); font-size: 10px; white-space: nowrap; }
.mrc-scale-legend { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 7px; }
.mrc-scale-legend li {
  display: flex; align-items: baseline; gap: 9px;
  font-size: 13px; line-height: 1.5; color: var(--muted-foreground);
}
.mrc-scale-legend b { color: var(--foreground); font-variant-numeric: tabular-nums; font-weight: 650; }
.mrc-swatch { width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; transform: translateY(1px); }
.mrc-swatch.is-us { background: var(--primary); }
.mrc-swatch.is-core { background: color-mix(in oklch, var(--muted-foreground) 55%, transparent); }
.mrc-swatch.is-band { background: color-mix(in oklch, var(--muted-foreground) 24%, transparent); }
.mrc-gap-note { display: block; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); }

.mrc-why { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 28px; margin-top: 24px; }
.mrc-why-col { min-width: 0; }

/* ── Чего не обещаем ── */
.mrc-honest { border-top: 1px solid var(--border); }
.mrc-honest-row {
  display: grid; grid-template-columns: minmax(0, 300px) minmax(0, 1fr); gap: 16px 24px;
  padding: 18px 0; border-bottom: 1px solid var(--border); align-items: start;
}
.mrc-honest-tag { display: block; color: var(--muted-foreground); margin-bottom: 8px; }
.mrc-honest-tag-ok { color: var(--success); }
.mrc-honest-claim s {
  font-size: 16px; font-weight: 650; letter-spacing: -0.01em;
  color: var(--muted-foreground); text-decoration-thickness: 1px;
  text-decoration-color: var(--destructive);
}
.mrc-honest-truth .mrc-body { color: var(--foreground); }

/* ── Когда не окупится ── */
.mrc-no { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.mrc-no-item {
  position: relative; background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
}

/* ── Форма заявки ── */
.mrc-final {
  position: relative; margin: 8px 0 48px; padding: 34px 26px 30px;
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  scroll-margin-top: 16px;
}
.mrc-final .mrc-h2 { margin-bottom: 10px; }
.mrc-final .mrc-lead { margin-bottom: 22px; }
.mrc-fields {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px;
}
.mrc-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.mrc-field-label { color: var(--muted-foreground); }
.mrc-submit { align-self: flex-start; }

/* ── Подвал ── */
.mrc-footer { border-top: 1px solid var(--border); padding: 22px 0 34px; }
.mrc-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.mrc-footer-inner > .mrc-mono { color: var(--muted-foreground); }
.mrc-footer-nav { display: flex; gap: 18px; flex-wrap: wrap; }
.mrc-footer-nav a {
  font-size: 12.5px; color: var(--muted-foreground); text-decoration: none;
  border-bottom: 1px solid transparent;
}
.mrc-footer-nav a:hover { color: var(--foreground); border-bottom-color: var(--border); }

/* ── Ревилы ── */
.mrc-anim [data-reveal] { opacity: 0; transform: translateY(14px); }
.mrc-anim [data-reveal].is-in {
  opacity: 1; transform: none;
  transition: opacity 520ms var(--ease), transform 520ms var(--ease);
}

/* ── Планшет ── */
@media (max-width: 900px) {
  .mrc-chain { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 16px; }
  .mrc-chain::before { display: none; }
  .mrc-chain-node { padding-top: 20px; border-top: 1px solid var(--border); }
  .mrc-cover { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* ── Мобильный ── */
@media (max-width: 767px) {
  .mrc-wrap { padding: 0 16px; }
  .mrc-topbar { padding: 2px 16px; }
  .mrc-wordmark { min-height: 44px; }
  .mrc-topbar-tag { display: none; }
  .mrc-hero-inner { padding-top: 24px; padding-bottom: 30px; }
  .mrc-eyebrow { margin-bottom: 14px; font-size: 10px; letter-spacing: 0.06em; }
  .mrc-hero-lead { font-size: 15px; margin-bottom: 18px; }

  .mrc-form-row { flex-direction: column; }
  .mrc-input, .mrc-btn { width: 100%; flex: 1 1 auto; }
  .mrc-input { font-size: 16px; }
  .mrc-hero-actions { flex-direction: column; align-items: stretch; gap: 10px; }

  .mrc-sec { padding: 26px 0 32px; }
  .mrc-sec-head { grid-template-columns: minmax(0, 1fr); gap: 10px; margin-bottom: 18px; }
  .mrc-sec-idx { padding-top: 0; }

  .mrc-chain { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .mrc-chain-ico { margin-bottom: 8px; }

  .mrc-cmp-head { display: none; }
  .mrc-cmp-row { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 16px 0; }
  .mrc-cmp-cell { position: relative; padding-left: 66px; font-size: 13.5px; }
  .mrc-cmp-cell::before {
    content: attr(data-tag); position: absolute; left: 0; top: 2px; width: 58px;
    font-family: var(--font-geist-mono), ui-monospace, monospace;
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .mrc-cmp-cell-b::before { color: var(--primary); }

  .mrc-layers, .mrc-cover, .mrc-price, .mrc-no, .mrc-why, .mrc-fields { grid-template-columns: minmax(0, 1fr); }
  .mrc-honest-row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .mrc-step { grid-template-columns: 40px minmax(0, 1fr); gap: 0 12px; }

  .mrc-scale { padding: 4px 18px 0; }
  .mrc-scale-tick em { font-size: 9px; }
  .mrc-price-btn, .mrc-submit { align-self: stretch; width: 100%; }

  .mrc-final { padding: 26px 18px 24px; margin-bottom: 36px; }
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
}
`;
