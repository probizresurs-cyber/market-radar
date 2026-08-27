"use client";

/**
 * /check — посадочная «Почему ваш сайт не приносит заявки?».
 *
 * Верх воронки под Директ. Построен на выводах ресёрча (см. записку
 * «Воронка до заявки» и разбор ниши 27.08.26):
 *  - у B2B-посадочных ~50% отскока и окно внимания 2–3 минуты (Databox/
 *    Leadsourcing) → всё главное в первом экране, одно поле, ноль лишних шагов;
 *  - лидеры GEO-ниши берут за вход деньги или контакт (Head Promo — аудит
 *    50 000 ₽, Digital Geeks — «оставьте данные») → наш дифференциатор
 *    прямо в подзаголовке: бесплатно, без звонков, результат на экране;
 *  - страхи покупателя из отраслевого обзора: обещания «топ-1 в ChatGPT»
 *    (= признак обмана), тариф-галочка, непонятные метрики → показываем
 *    только проверяемые цифры, ничего не обещаем.
 *
 * Механика: URL → POST /api/mini-check (без Claude, себестоимость ≈0) →
 * поллинг, блоки дорисовываются по мере готовности проб → email за полный
 * разбор (это уже настоящее КП через kp-public).
 *
 * Арт-дирекшн — «измерительный прибор»: страница читается как лист замеров,
 * а не как рекламный буклет. Signature-приём — рейка с засечкой: каждый
 * раздел, каждая карточка и каждый узел схемы начинается с волосяной линейки
 * и жирной засечки, номера и подписи набраны моноширинным. Ниша (Zenlink,
 * Head Promo) сидит на белом фоне, кислотных кнопках-пилюлях и радиусе 35–74px —
 * отсюда осознанный уход: плотная сетка, острые радиусы токена, мономаркировка.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniCheckResult } from "@/lib/mini-check";

const YM_ID = 108999924;
const reach = (goal: string) => {
  try { (window as unknown as { ym?: (id: number, m: string, g: string) => void }).ym?.(YM_ID, "reachGoal", goal); } catch { /* нет Метрики — не мешаем */ }
};

type KpState = "idle" | "queued" | "done" | "error";
type Tone = "bad" | "warn" | "ok";

/* Пороги вердиктов — единственный источник правды: ими красится и заголовок
   вердикта, и засечка карточки. Значения не менять без пересчёта формулировок. */
/**
 * Разбор ответа API с человеческим текстом ошибки.
 *
 * Прямой `r.json()` на упавшем роуте (5xx отдаётся с пустым телом) кидает
 * внутреннюю ошибку браузера, и посетитель видел «Failed to execute 'json'
 * on 'Response'…». На странице под платный трафик это недопустимо: человек
 * пришёл по рекламе и должен понять, что делать дальше, а не читать
 * внутренности. Любой сбой сети или сервера превращаем в понятную фразу.
 */
async function readJson(r: Response): Promise<{ ok?: boolean; error?: string; [k: string]: unknown }> {
  const body = await r.json().catch(() => null);
  if (body && typeof body === "object") return body as { ok?: boolean; error?: string };
  return {
    ok: false,
    error: r.status >= 500
      ? "Сервис проверки сейчас недоступен. Попробуйте через пару минут — или напишите нам, проверим вручную."
      : "Не удалось связаться с сервисом. Проверьте соединение и попробуйте ещё раз.",
  };
}

const semTone = (n: number): Tone => (n < 50 ? "bad" : n < 300 ? "warn" : "ok");
const spdTone = (p: number): Tone => (p < 50 ? "bad" : p < 90 ? "warn" : "ok");
const rdTone = (passed: number): Tone => (passed <= 3 ? "bad" : passed <= 5 ? "warn" : "ok");
const toneColor = (t?: Tone) =>
  t === "bad" ? "var(--destructive)" : t === "warn" ? "var(--warning)" : t === "ok" ? "var(--success)" : "var(--primary)";

export default function CheckPage() {
  const [url, setUrl] = useState("");
  const [checkId, setCheckId] = useState<string | null>(null);
  const [result, setResult] = useState<MiniCheckResult>({});
  const [checkDomain, setCheckDomain] = useState("");
  const [startErr, setStartErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [kpState, setKpState] = useState<KpState>("idle");
  const [kpUrl, setKpUrl] = useState<string | null>(null);
  const [leadErr, setLeadErr] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const start = useCallback(async () => {
    const u = url.trim();
    if (!u) { setStartErr("Введите адрес сайта"); return; }
    setStarting(true); setStartErr(null);
    try {
      const r = await fetch("/api/mini-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const j = await readJson(r);
      if (!j.ok) throw new Error(j.error || "Не удалось запустить проверку");
      setCheckId(String(j.id));
      reach("mini_check_start");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e) {
      setStartErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setStarting(false);
    }
  }, [url]);

  // Поллинг мини-проверки: пробы дорисовываются по мере готовности.
  useEffect(() => {
    if (!checkId) return;
    let stop = false;
    const tick = async () => {
      const j = await fetch(`/api/mini-check?id=${checkId}`).then(r => r.json()).catch(() => null);
      if (stop || !j?.ok) return;
      setResult(j.result ?? {});
      setCheckDomain(j.domain ?? "");
      if (j.status === "done") return;
      setTimeout(tick, 3000);
    };
    void tick();
    return () => { stop = true; };
  }, [checkId]);

  const submitLead = useCallback(async () => {
    if (!checkId) return;
    setLeadErr(null);
    try {
      const r = await fetch("/api/mini-check/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: checkId, email: email.trim(), consent }),
      });
      const j = await readJson(r);
      if (!j.ok) throw new Error(j.error || "Не получилось отправить — попробуйте ещё раз");
      setKpState("queued");
      reach("mini_check_lead");
      // Поллинг полного КП: готово → ссылка; упало → честный фолбэк (лид сохранён).
      const poll = async () => {
        const s = await fetch(`/api/kp-public/${j.kpId}`).then(x => x.json()).catch(() => null);
        if (s?.ok && s.data?.status === "done") { setKpUrl(s.data.shareUrl); setKpState("done"); return; }
        if (s?.ok && s.data?.status === "error") { setKpState("error"); return; }
        setTimeout(poll, 5000);
      };
      void poll();
    } catch (e) {
      setLeadErr(e instanceof Error ? e.message : "Ошибка");
    }
  }, [checkId, email, consent]);

  useReveal();

  const sem = result.semantics;
  const spd = result.speed;
  const rd = result.readability;
  const readyProbes = [sem, spd, rd].filter(p => p && p.status !== "pending").length;

  return (
    <div className="mrc-root">
      <style>{CSS}</style>

      <header className="mrc-topbar">
        <a href="/" className="mrc-wordmark">
          <span className="mrc-logo-tick" aria-hidden="true" />
          MarketRadar
        </a>
        <span className="mrc-mono mrc-topbar-tag">диагностика сайта · 0 ₽</span>
      </header>

      <main>
      {/* ─── 00 · Первый экран: вопрос-боль + одно поле ─── */}
      <section className="mrc-hero">
        <div className="mrc-wrap mrc-hero-inner">
          <div className="mrc-mono mrc-eyebrow">
            <span className="mrc-dot" aria-hidden="true" />
            бесплатно · без звонков · результат на экране
          </div>
          <h1 className="mrc-h1">
            Почему ваш сайт<br />не приносит заявки?
          </h1>
          <p className="mrc-lead mrc-hero-lead">
            Снимем три замера и покажем, на каком из них теряются обращения. Без регистрации
            и разговора с менеджером — диагноз появится прямо здесь, на этой странице.
          </p>

          <UrlForm
            id="hero"
            url={url} setUrl={setUrl} starting={starting} onStart={start}
            error={startErr}
            note="Нужен только адрес сайта — ни почты, ни телефона на этом шаге."
          />
        </div>
      </section>

      <div className="mrc-wrap">
        {/* ─── Что замеряем — лист приборов, пока проверка не запущена ─── */}
        {!checkId && (
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="00"
              title="Три замера"
              sub="Каждый отвечает за свой участок пути клиента к заявке."
            />
            <ol className="mrc-instr-list">
              {[
                ["01", "Видимость в Яндексе", "По скольким запросам вас вообще находят — и какой спрос ниши достаётся конкурентам."],
                ["02", "Скорость на телефоне", "Медленный сайт теряет мобильные заявки до того, как человек увидел цены."],
                ["03", "Читаемость для нейросетей", "Могут ли Алиса и ChatGPT прочитать ваши услуги — или рекомендуют других."],
              ].map(([n, t, d]) => (
                <li key={n} className="mrc-instr-row">
                  <span className="mrc-mono mrc-instr-n">{n}</span>
                  <span className="mrc-instr-t">{t}</span>
                  <span className="mrc-instr-d">{d}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ─── Результаты: дорисовываются по мере готовности проб ─── */}
        {checkId && (
          <section className="mrc-sec" ref={resultsRef} style={{ scrollMarginTop: 16 }}>
            <div className="mrc-readout-head">
              <div>
                <div className="mrc-mono mrc-readout-label">лист замеров</div>
                <h2 className="mrc-h2 mrc-readout-domain">{checkDomain || "ваш сайт"}</h2>
              </div>
              <ProgressMeter ready={readyProbes} total={3} />
            </div>

            <div className="mrc-probes">
              <ProbeCard
                idx="01"
                title="Видимость в Яндексе"
                probe={sem?.status}
                tone={sem?.status === "done" ? semTone(sem.visibleCount ?? 0) : undefined}
                render={() => sem?.status === "done" ? <SemanticsVerdict s={sem} /> : <ProbeFail what="видимость" />}
              />
              <ProbeCard
                idx="02"
                title="Скорость на телефоне"
                probe={spd?.status}
                tone={spd?.status === "done" ? spdTone(spd.performance ?? 0) : undefined}
                pendingNote="Google Lighthouse меряет реальную загрузку — до минуты"
                render={() => spd?.status === "done" ? <SpeedVerdict s={spd} /> : <ProbeFail what="скорость" />}
              />
              <ProbeCard
                idx="03"
                title="Читаемость для нейросетей"
                probe={rd?.status}
                tone={rd?.status === "done" ? rdTone(rd.checksPassed ?? 0) : undefined}
                render={() => rd?.status === "done" ? <ReadabilityVerdict s={rd} /> : <ProbeFail what="читаемость" />}
              />
            </div>

            {/* ─── CTA: полный разбор за email ─── */}
            {readyProbes >= 2 && (
              <div className="mrc-lead-card">
                <span className="mrc-tick mrc-tick-primary" aria-hidden="true" />
                {kpState === "idle" && (
                  <>
                    <div className="mrc-mono mrc-kicker">следующий шаг</div>
                    <div className="mrc-h3">Это экспресс-диагноз. Полный разбор — тоже бесплатно</div>
                    <p className="mrc-body mrc-lead-card-text">
                      Внутри: находки с доказательствами по вашему сайту, конкуренты поимённо — с запросами,
                      по которым они забирают ваших клиентов, прогноз заявок по каналам и план работ с ценами.
                      Разбор собирается 2–3{" "}минуты и открывается по ссылке.
                    </p>
                    <div className="mrc-form-row">
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Ваш email"
                        inputMode="email"
                        aria-label="Ваш email"
                        className="mrc-input"
                      />
                      <button
                        onClick={() => void submitLead()}
                        disabled={!consent}
                        className="mrc-btn mrc-btn-primary"
                      >
                        Получить полный разбор
                      </button>
                    </div>
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
                    {leadErr && <div className="mrc-err">{leadErr}</div>}
                  </>
                )}
                {kpState === "queued" && (
                  <>
                    <div className="mrc-mono mrc-kicker">сборка разбора</div>
                    <div className="mrc-h3">Собираем полный разбор — 2–3{" "}минуты</div>
                    <p className="mrc-body mrc-lead-card-text">
                      Анализируем сайт, конкурентов и видимость в нейросетях. Страницу можно не закрывать —
                      ссылка появится здесь.
                    </p>
                    <div className="mrc-scan" aria-hidden="true"><span /></div>
                  </>
                )}
                {kpState === "done" && kpUrl && (
                  <>
                    <div className="mrc-mono mrc-kicker">готово</div>
                    <div className="mrc-done-row">
                      <div className="mrc-h3" style={{ margin: 0 }}>Полный разбор готов</div>
                      <a href={kpUrl} target="_blank" rel="noopener noreferrer" className="mrc-btn mrc-btn-primary">
                        Открыть разбор
                      </a>
                    </div>
                  </>
                )}
                {kpState === "error" && (
                  <>
                    <div className="mrc-mono mrc-kicker">ручная сборка</div>
                    <div className="mrc-h3">Разбор готовим вручную</div>
                    <p className="mrc-body mrc-lead-card-text">
                      Автоматическая сборка не прошла — специалист соберёт разбор и пришлёт
                      на {email || "вашу почту"} в течение рабочего дня.
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ─── 01 · Куда уходят заявки ─── */}
        <section className="mrc-sec" data-reveal>
          <SecHead
            idx="01"
            title="Куда уходят заявки"
            sub="Заявка редко теряется на сайте. Чаще она вообще до него не доходит — человек принимает решение раньше."
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
          <p className="mrc-note">
            Сайт при этом может быть отличным. Его просто не показали.
          </p>
        </section>

        {/* ─── 02 · SEO и GEO ─── */}
        <section className="mrc-sec" data-reveal>
          <SecHead
            idx="02"
            title="Два пути к одному клиенту"
            sub="Коротко о разнице между обычным поиском и ответом нейросети — без аббревиатур и лекций."
          />
          <div className="mrc-cmp">
            <div className="mrc-cmp-head" aria-hidden="true">
              <span />
              <span className="mrc-mono">классический поиск</span>
              <span className="mrc-mono">ответ нейросети</span>
            </div>
            {COMPARE.map(row => (
              <div key={row.k} className="mrc-cmp-row">
                <span className="mrc-mono mrc-cmp-k">{row.k}</span>
                <span className="mrc-cmp-cell" data-tag="поиск">{row.a}</span>
                <span className="mrc-cmp-cell mrc-cmp-cell-b" data-tag="нейросеть">{row.b}</span>
              </div>
            ))}
          </div>
          <div className="mrc-conclusion">
            <span className="mrc-tick mrc-tick-primary" aria-hidden="true" />
            <p className="mrc-body" style={{ margin: 0 }}>
              <b>SEO даёт право быть найденным. GEO — право быть рекомендованным.</b>{" "}
              Второе надстраивается над первым, а не заменяет его: если сайт плохо читается поиском,
              нейросеть его тоже не увидит — она берёт данные оттуда же.
            </p>
          </div>
        </section>

        {/* ─── 03 · Что мы делаем ─── */}
        <section className="mrc-sec" data-reveal>
          <SecHead
            idx="03"
            title="Что мы делаем"
            sub="Четыре слоя работы. Каждый следующий имеет смысл, только когда сделан предыдущий."
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
        </section>

        {/* ─── 04 · Что получает клиент ─── */}
        <section className="mrc-sec" data-reveal>
          <SecHead
            idx="04"
            title="Что получает клиент"
            sub="Полный разбор — это документ, по которому можно работать: со ссылками, замерами и ценами."
          />
          <div className="mrc-deliver">
            {DELIVER.map(d => (
              <article key={d.t} className="mrc-deliver-item">
                <span className="mrc-tick" aria-hidden="true" />
                <h3 className="mrc-h3">{d.t}</h3>
                <p className="mrc-body">{d.d}</p>
                <ul className="mrc-ul">
                  {d.points.map(p => <li key={p}>{p}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* ─── 05 · Чего мы не обещаем ─── */}
        <section className="mrc-sec" data-reveal>
          <SecHead
            idx="05"
            title="Чего мы не обещаем"
            sub="Тут принято обещать «топ-1 в ChatGPT». Мы так не умеем и объясняем почему."
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

        {/* ─── Финальный CTA ─── */}
        <section className="mrc-final" data-reveal>
          <span className="mrc-tick mrc-tick-primary" aria-hidden="true" />
          <div className="mrc-mono mrc-kicker">проверка сайта</div>
          <h2 className="mrc-h2">Начните с замера, а не с договора</h2>
          <p className="mrc-lead">
            Введите адрес — и через минуту увидите, что именно мешает сайту приносить обращения.
            Дальше решите сами, нужны мы вам или нет.
          </p>
          <UrlForm
            id="final"
            url={url} setUrl={setUrl} starting={starting} onStart={start}
            error={startErr}
            note="Бесплатно, без регистрации и без звонка менеджера."
          />
        </section>
        </div>
      </main>

      <footer className="mrc-footer">
        <div className="mrc-wrap mrc-footer-inner">
          <span className="mrc-mono">MarketRadar · диагностика сайта</span>
          <nav className="mrc-footer-nav">
            <a href="/legal/privacy">Политика обработки персональных данных</a>
            <a href="/legal/consent-pd">Согласие на обработку данных</a>
            <a href="/">О платформе</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ─── Контент разделов ─────────────────────────────────────────────────── */

const CHAIN: { n: string; icon: IconName; t: string; d: string }[] = [
  { n: "01", icon: "search", t: "Человек ищет", d: "Открывает поиск или спрашивает у ассистента: кто делает то, что нужно, и сколько это стоит." },
  { n: "02", icon: "answer", t: "Ему дают ответ", d: "Поиск отдаёт список ссылок, нейросеть — готовую рекомендацию с парой названий внутри." },
  { n: "03", icon: "absent", t: "Вас в ответе нет", d: "Если сайт плохо читается роботами и о вас нигде не пишут, попасть в этот ответ просто нечем." },
  { n: "04", icon: "rival", t: "Называют конкурента", d: "Человек видит чужие цены, отзывы и условия. Сравнить вас не с чем — вас в ответе не было." },
  { n: "05", icon: "out", t: "Заявка ушла", d: "Она не потерялась — её получил тот, кого назвали. Вы об этой заявке даже не узнаете." },
];

const COMPARE: { k: string; a: string; b: string }[] = [
  { k: "что видит человек", a: "Список примерно из десяти ссылок", b: "Готовую рекомендацию обычным текстом" },
  { k: "что он делает дальше", a: "Открывает вкладки и сравнивает сам", b: "Читает ответ и идёт к тому, кого назвали" },
  { k: "сколько это занимает", a: "15–45 минут на изучение и сравнение", b: "2–5 минут до решения, к кому обращаться" },
  { k: "сколько компаний в игре", a: "Столько, сколько человек успел открыть", b: "Один-три бренда, которые попали в ответ" },
  { k: "за что идёт борьба", a: "За место в первой тройке ссылок", b: "За то, чтобы вас назвали в самом ответе" },
];

const LAYERS: { n: string; icon: IconName; t: string; d: string }[] = [
  { n: "01", icon: "gear", t: "Техника сайта", d: "Скорость, структура, заголовки, разметка данных, карта сайта, доступ для поисковых и нейросетевых роботов. Чтобы машина могла прочитать, чем вы занимаетесь, для кого и на каких условиях." },
  { n: "02", icon: "text", t: "Контент", d: "Страницы услуг, ответы на реальные вопросы клиентов, цены и условия словами, а не картинкой. Нейросети пересказывают текст — если текста нет, пересказывать нечего." },
  { n: "03", icon: "link", t: "Внешние упоминания и Digital PR", d: "Публикации на отраслевых площадках, каталоги, профили на картах, экспертные материалы. Робот больше доверяет тому, о ком пишут не только на его собственном сайте." },
  { n: "04", icon: "star", t: "Репутация", d: "Отзывы там, где их читают, и ответы на них. Оценки и формулировки из отзывов попадают в ответ ассистента почти дословно — вместе с претензиями." },
];

const DELIVER: { t: string; d: string; points: string[] }[] = [
  {
    t: "Находки с доказательствами",
    d: "По каждой проблеме показано, где мы её увидели, а не абстрактное «нужно улучшить SEO».",
    points: ["адрес конкретной страницы", "замер или выдержка из выдачи", "что именно это стоит вам в заявках"],
  },
  {
    t: "Конкуренты поимённо",
    d: "Не «лидеры рынка», а конкретные домены, которые забирают ваш спрос прямо сейчас.",
    points: ["запросы, по которым они выше вас", "частотность этих запросов", "чего у них есть, а у вас нет"],
  },
  {
    t: "Прогноз заявок",
    d: "Сколько обращений способен дать канал при текущем спросе — с показанным расчётом.",
    points: ["исходные данные расчёта", "допущения, на которых он держится", "честная пометка: это оценка, не гарантия"],
  },
  {
    t: "План работ с ценами",
    d: "Что делаем, в каком порядке, сколько это стоит и что вы получаете на выходе каждого этапа.",
    points: ["этапы и их последовательность", "стоимость по каждому этапу", "результат, который можно проверить"],
  },
];

const HONEST: { claim: string; truth: string }[] = [
  {
    claim: "Топ-1 в ChatGPT за месяц",
    truth: "Позиций в ответах нейросети не существует — ответ собирается заново под каждую формулировку вопроса и меняется от запроса к запросу. Гарантировать место в нём нельзя. Можно повысить шансы туда попасть, и это измеримая работа.",
  },
  {
    claim: "Результат с первой недели",
    truth: "Первые изменения обычно видны через 1–3 месяца. Роботам нужно заново обойти сайт, публикациям — разойтись по площадкам, отзывам — накопиться. Если вам обещают неделю, вам продают ожидание, а не работу.",
  },
  {
    claim: "Всё останется у подрядчика",
    truth: "Тексты, статьи, разметка, доступы и аккаунты — ваши с первого дня. Если мы расстанемся, всё сделанное остаётся работать на вас, а не выключается вместе с договором.",
  },
];

/* ─── Общие блоки страницы ─────────────────────────────────────────────── */

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

function UrlForm({ id, url, setUrl, starting, onStart, error, note }: {
  id: string;
  url: string; setUrl: (v: string) => void;
  starting: boolean; onStart: () => Promise<void> | void;
  error: string | null; note: string;
}) {
  return (
    <div className="mrc-urlform">
      <div className="mrc-form-row">
        <input
          id={`mrc-url-${id}`}
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void onStart(); }}
          placeholder="Адрес сайта, например mysite.ru"
          inputMode="url"
          aria-label="Адрес сайта"
          className="mrc-input"
        />
        <button onClick={() => void onStart()} disabled={starting} className="mrc-btn mrc-btn-primary">
          {starting ? "Запускаем…" : "Проверить сайт"}
        </button>
      </div>
      {error && <div className="mrc-err">{error}</div>}
      <div className="mrc-mono mrc-formnote">{note}</div>
    </div>
  );
}

function ProgressMeter({ ready, total }: { ready: number; total: number }) {
  return (
    <div className="mrc-meter" aria-label={`Готово замеров: ${ready} из ${total}`}>
      <span className="mrc-mono mrc-meter-label">готово {ready}/{total}</span>
      <span className="mrc-meter-bars" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`mrc-meter-bar${i < ready ? " is-on" : ""}`} />
        ))}
      </span>
    </div>
  );
}

/* ─── Карточки результата ──────────────────────────────────────────────── */

function ProbeCard({ idx, title, probe, tone, pendingNote, render }: {
  idx: string; title: string; probe?: "pending" | "done" | "failed"; tone?: Tone; pendingNote?: string;
  render: () => React.ReactNode;
}) {
  const pending = !probe || probe === "pending";
  const status = pending ? "замер…" : probe === "done" ? "готово" : "нет данных";
  // Пробы без результата не красим в бренд: серый = «данных нет», а не «всё хорошо».
  const accent = pending ? "var(--border)" : probe === "failed" ? "var(--muted-foreground)" : toneColor(tone);
  return (
    <article className="mrc-probe">
      <span className="mrc-tick" style={{ background: accent }} aria-hidden="true" />
      <div className="mrc-probe-head">
        <span className="mrc-mono mrc-probe-n">{idx}</span>
        <h3 className="mrc-probe-t">{title}</h3>
        <span className={`mrc-mono mrc-status${pending ? " is-pending" : ""}`}>
          <span className="mrc-status-dot" style={{ background: pending ? "var(--muted-foreground)" : accent }} aria-hidden="true" />
          {status}
        </span>
      </div>
      {pending ? (
        <div className="mrc-probe-pending">
          <div className="mrc-scan" aria-hidden="true"><span /></div>
          {pendingNote && <div className="mrc-note" style={{ marginTop: 10 }}>{pendingNote}</div>}
        </div>
      ) : (
        <div className="mrc-probe-body">{render()}</div>
      )}
    </article>
  );
}

function ProbeFail({ what }: { what: string }) {
  return <div className="mrc-note">Не удалось замерить {what} автоматически — войдёт в полный разбор.</div>;
}

function Verdict({ tone, headline, details }: { tone: Tone; headline: string; details?: React.ReactNode }) {
  return (
    <div>
      <div className="mrc-verdict-head" style={{ color: toneColor(tone) }}>{headline}</div>
      {details}
    </div>
  );
}

function SemanticsVerdict({ s }: { s: NonNullable<MiniCheckResult["semantics"]> }) {
  const n = s.visibleCount ?? 0;
  const cap = n >= 1000 ? "1000+" : String(n);
  const tone = semTone(n);
  const headline =
    n < 50 ? `Вас почти не видно: всего ${cap} запросов в Яндексе` :
    n < 300 ? `Видимость слабая: ${cap} запросов — у лидеров ниш сотни и тысячи` :
    `База есть: вас видно по ${cap} запросам`;
  return (
    <Verdict tone={tone} headline={headline} details={
      <div className="mrc-verdict-body">
        {s.top && s.top.length > 0 ? (
          <>
            Главные запросы, по которым вас находят:{" "}
            {s.top.slice(0, 3).map(t => `«${t.keyword}» (${t.freq.toLocaleString("ru-RU")} показов/мес, позиция #${t.position})`).join(", ")}.
            {" "}Кто забирает остальной спрос ниши — покажет полный разбор.
          </>
        ) : (
          <>По данным Букварикса заметных запросов у домена не нашлось — спрос ниши целиком достаётся конкурентам. Полный разбор покажет, кому именно.</>
        )}
      </div>
    } />
  );
}

function SpeedVerdict({ s }: { s: NonNullable<MiniCheckResult["speed"]> }) {
  const p = s.performance ?? 0;
  const tone = spdTone(p);
  const headline =
    p < 50 ? `Сайт медленный: ${p}/100 на телефоне` :
    p < 90 ? `Скорость средняя: ${p}/100 — конкуренты с быстрым сайтом впереди` :
    `Скорость в порядке: ${p}/100`;
  return (
    <Verdict tone={tone} headline={headline} details={
      <div className="mrc-verdict-body">
        {s.lcpDisplay && <>Главный контент появляется за {s.lcpDisplay} (норма Google — до 2,5{" "}с). </>}
        {p < 90 && <>Пока страница грузится, мобильный посетитель уходит к тем, у кого уже открылось.</>}
      </div>
    } />
  );
}

function ReadabilityVerdict({ s }: { s: NonNullable<MiniCheckResult["readability"]> }) {
  const passed = s.checksPassed ?? 0;
  const total = s.checksTotal ?? 7;
  const tone = rdTone(passed);
  const fails: string[] = [];
  if (!s.hasSchema) fails.push("нет разметки Schema.org — ассистенты не могут прочитать ваши услуги и рекомендуют тех, кого могут");
  if (!s.hasDescription) fails.push("нет описания страницы — поисковик сам сочиняет, что показать в выдаче");
  if (!s.hasSitemap) fails.push("нет sitemap.xml — часть страниц невидима для поисковиков");
  if ((s.h1Count ?? 0) === 0) fails.push("нет главного заголовка h1 — непонятно, о чём страница");
  if ((s.textChars ?? 0) <= 1500) fails.push("слишком мало текста — нейросетям нечего цитировать");
  return (
    <Verdict
      tone={tone}
      headline={`${passed} из ${total} проверок пройдено`}
      details={fails.length > 0 ? (
        <ul className="mrc-ul mrc-verdict-body">
          {fails.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      ) : (
        <div className="mrc-verdict-body">Базовая структура в порядке — вопрос в контенте и внешних сигналах.</div>
      )}
    />
  );
}

/* ─── Иконки: один набор, 20×20, обводка currentColor ──────────────────── */

type IconName = "search" | "answer" | "absent" | "rival" | "out" | "gear" | "text" | "link" | "star";

function Icon({ name }: { name: IconName }) {
  const P: Record<IconName, React.ReactNode> = {
    search: <><circle cx="9" cy="9" r="6" /><path d="M13.5 13.5 17 17" /></>,
    answer: <><path d="M3 4h14M3 9h14M3 14h9" /></>,
    absent: <><path d="M3 10s2.8-5 7-5c1.2 0 2.3.4 3.2 1" /><path d="M17 10s-2.8 5-7 5c-1.2 0-2.3-.4-3.2-1" /><path d="m3 17 14-14" /></>,
    rival: <><path d="M4 17V3" /><path d="M4 4h10l-2 3 2 3H4" /></>,
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
   Только токены дизайн-системы; оттенки — через color-mix от токенов, чтобы
   светлая и тёмная темы жили без правок. Своя таблица нужна из-за медиа-
   запросов, hover/focus и анимаций, которых inline-стили не умеют. */

const CSS = `
.mrc-root {
  --mrc-rule: color-mix(in oklch, var(--border) 100%, transparent);
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
  font-size: clamp(28px, 6.2vw, 56px);
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
.mrc-ul { margin: 10px 0 0; padding-left: 0; list-style: none; }
.mrc-ul li {
  position: relative; padding-left: 16px; font-size: 13.5px; line-height: 1.55;
  color: var(--muted-foreground); margin-bottom: 5px;
}
.mrc-ul li::before {
  content: ''; position: absolute; left: 0; top: 0.62em;
  width: 7px; height: 1px; background: var(--muted-foreground); opacity: 0.7;
}

/* Засечка на рейке — signature-приём страницы */
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
.mrc-hero-lead { font-size: 16px; margin-bottom: 24px; max-width: 56ch; }

/* ── Форма ── */
.mrc-urlform { max-width: 560px; }
.mrc-form-row { display: flex; gap: 8px; flex-wrap: wrap; }
.mrc-input {
  flex: 1 1 240px; min-width: 0; height: 48px; padding: 0 14px;
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
  transition: filter var(--motion-fast) var(--ease), opacity var(--motion-fast) var(--ease);
}
.mrc-btn-primary { background: var(--primary); color: var(--primary-foreground); }
.mrc-btn-primary:hover:not(:disabled) { filter: brightness(0.92); }
.mrc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mrc-btn:focus-visible, .mrc-input:focus-visible, .mrc-root a:focus-visible, .mrc-checkbox:focus-visible {
  outline: 2px solid var(--ring); outline-offset: 2px;
}
.mrc-formnote { color: var(--muted-foreground); margin-top: 12px; line-height: 1.5; text-transform: none; letter-spacing: 0.02em; font-size: 11.5px; }

/* ── Секции ── */
.mrc-sec { position: relative; border-top: 1px solid var(--border); padding: 34px 0 42px; }
.mrc-sec::before { content: ''; position: absolute; top: -1px; left: 0; width: 26px; height: 3px; background: var(--primary); }
.mrc-sec-head {
  display: grid; grid-template-columns: 56px minmax(0, 1fr); align-items: start;
  margin-bottom: 24px;
}
.mrc-sec-idx { color: var(--muted-foreground); padding-top: 6px; font-size: 12px; }
.mrc-sec-text { min-width: 0; }

/* ── Список замеров ── */
.mrc-instr-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
.mrc-instr-row {
  display: grid; grid-template-columns: 56px minmax(0, 260px) minmax(0, 1fr);
  gap: 0 16px; align-items: baseline;
  padding: 16px 0; border-bottom: 1px solid var(--border);
}
.mrc-instr-n { color: var(--muted-foreground); }
.mrc-instr-t { font-size: 15px; font-weight: 650; letter-spacing: -0.01em; }
.mrc-instr-d { font-size: 13.5px; line-height: 1.55; color: var(--muted-foreground); }

/* ── Лист замеров ── */
.mrc-readout-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  flex-wrap: wrap; margin-bottom: 18px;
}
.mrc-readout-label { color: var(--muted-foreground); margin-bottom: 4px; }
.mrc-readout-domain { margin: 0; overflow-wrap: anywhere; }
.mrc-meter { display: flex; align-items: center; gap: 10px; }
.mrc-meter-label { color: var(--muted-foreground); }
.mrc-meter-bars { display: inline-flex; gap: 4px; }
.mrc-meter-bar {
  width: 22px; height: 4px; background: var(--border);
  transition: background-color 220ms var(--ease);
}
.mrc-meter-bar.is-on { background: var(--primary); }

.mrc-probes { display: grid; gap: 12px; }
.mrc-probe {
  position: relative; background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px 20px;
}
.mrc-probe-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.mrc-probe-n { color: var(--muted-foreground); }
.mrc-probe-t { flex: 1 1 auto; font-size: 15.5px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
.mrc-status { display: inline-flex; align-items: center; gap: 6px; color: var(--muted-foreground); }
.mrc-status-dot { width: 6px; height: 6px; border-radius: 50%; }
.mrc-status.is-pending .mrc-status-dot { animation: mrc-blink 1.1s var(--ease) infinite; }
.mrc-probe-pending { margin-top: 14px; }
.mrc-probe-body { margin-top: 12px; }
.mrc-verdict-head { font-size: 15px; font-weight: 700; line-height: 1.35; margin-bottom: 6px; letter-spacing: -0.01em; }
.mrc-verdict-body { font-size: 13.5px; line-height: 1.6; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }

/* Индикатор замера — бегущая полоса вместо спиннера */
.mrc-scan { position: relative; height: 3px; background: var(--border); overflow: hidden; border-radius: 2px; }
.mrc-scan > span {
  position: absolute; inset: 0 auto 0 0; width: 34%;
  background: var(--primary); animation: mrc-scan 1.5s var(--ease) infinite;
}
@keyframes mrc-scan { 0% { transform: translateX(-110%); } 100% { transform: translateX(400%); } }
@keyframes mrc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

/* ── Карточка захвата email ── */
.mrc-lead-card {
  position: relative; margin-top: 20px; background: var(--card);
  border: 1px solid var(--primary);
  border-radius: var(--radius); padding: 22px 22px 20px;
  box-shadow: 0 1px 2px color-mix(in oklch, var(--primary) 8%, transparent);
}
.mrc-lead-card-text { margin-bottom: 16px; max-width: 62ch; }
.mrc-done-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.mrc-consent {
  display: flex; gap: 10px; align-items: flex-start; margin-top: 14px;
  cursor: pointer; font-size: 12.5px; line-height: 1.55; color: var(--muted-foreground);
}
.mrc-consent a { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
.mrc-checkbox {
  margin: 1px 0 0; width: 16px; height: 16px; min-height: 16px;
  accent-color: var(--primary); flex-shrink: 0; cursor: pointer;
}

/* ── Схема: куда уходят заявки ── */
.mrc-chain {
  list-style: none; margin: 0; padding: 0;
  position: relative;
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0 12px;
}
.mrc-chain::before {
  content: ''; position: absolute; left: 0; right: 0; top: 5px; height: 1px;
  background: var(--border);
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
.mrc-sec .mrc-note { margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--border); }

/* ── Сравнение путей ── */
.mrc-cmp { border-top: 1px solid var(--border); }
.mrc-cmp-head, .mrc-cmp-row {
  display: grid; grid-template-columns: minmax(0, 180px) minmax(0, 1fr) minmax(0, 1fr);
  gap: 0 18px;
}
.mrc-cmp-head { padding: 10px 0; border-bottom: 1px solid var(--border); color: var(--muted-foreground); }
.mrc-cmp-head span:nth-child(3) { color: var(--primary); }
.mrc-cmp-row { padding: 14px 0; border-bottom: 1px solid var(--border); align-items: baseline; }
.mrc-cmp-k { color: var(--muted-foreground); }
.mrc-cmp-cell { font-size: 14px; line-height: 1.5; }
.mrc-cmp-cell-b { color: var(--foreground); font-weight: 600; }
.mrc-conclusion {
  position: relative; margin-top: 22px; padding: 18px 20px;
  background: var(--mrc-tint); border: 1px solid color-mix(in srgb, var(--primary) 30%, var(--border));
  border-radius: var(--radius);
}
.mrc-conclusion .mrc-body { color: var(--foreground); font-size: 14.5px; }

/* ── Слои работы ── */
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

/* ── Что получает клиент ── */
.mrc-deliver { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.mrc-deliver-item {
  position: relative; background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
}

/* ── Чего мы не обещаем ── */
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

/* ── Финальный CTA ── */
.mrc-final {
  position: relative; margin: 8px 0 48px; padding: 34px 26px 30px;
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
}
.mrc-final .mrc-h2 { margin-bottom: 10px; }
.mrc-final .mrc-lead { margin-bottom: 22px; }

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

  .mrc-sec { padding: 26px 0 32px; }
  .mrc-sec-head { grid-template-columns: minmax(0, 1fr); gap: 10px; margin-bottom: 18px; }
  .mrc-sec-idx { padding-top: 0; }

  .mrc-instr-row { grid-template-columns: 40px minmax(0, 1fr); gap: 4px 12px; }
  .mrc-instr-n { grid-row: span 2; }

  .mrc-chain { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .mrc-chain-ico { margin-bottom: 8px; }

  .mrc-cmp-head { display: none; }
  .mrc-cmp-row { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 16px 0; }
  .mrc-cmp-cell { position: relative; padding-left: 92px; font-size: 13.5px; }
  .mrc-cmp-cell::before {
    content: attr(data-tag); position: absolute; left: 0; top: 2px; width: 84px;
    font-family: var(--font-geist-mono), ui-monospace, monospace;
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .mrc-cmp-cell-b::before { color: var(--primary); }

  .mrc-layers, .mrc-deliver { grid-template-columns: minmax(0, 1fr); }
  .mrc-honest-row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .mrc-final { padding: 26px 18px 24px; margin-bottom: 36px; }
  .mrc-lead-card { padding: 18px 16px 16px; }
  .mrc-probe { padding: 16px; }
  /* Тап-таргеты подвала до 44px — ссылки стоят отдельно, не внутри текста */
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
  .mrc-scan > span { width: 100%; }
}
`;
