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
 * ── Арт-дирекшн: «редакционный разбор на графите» ─────────────────────────
 * Палитра, шрифт и логотип взяты с продакшена marketradar24.ru — страница
 * обязана читаться как часть того же продукта, а не как отдельный лендинг:
 * графит #111318 с еле заметной сеткой, индиго #6366F1 как основное действие,
 * циан #00D4FF как служебный акцент и цвет логотипа-радара, зелёный — статус
 * «готово», красный — потеря. Заголовки на Inter 800 (как на проде), градиент
 * маджента → фиолет → циан на ключевой строке первого экрана.
 *
 * От «редакционного разбора» осталась структура, а не бумага: номера секций
 * крупной обводкой, волосяные линейки, Geist Mono на служебных подписях,
 * Merriweather в теле «ответа ассистента» — чтобы ответ читался документом,
 * а не элементом интерфейса. Ритм страницы задаётся сменой плотности графита
 * (полотно → плита), а не сменой бумаги и чернил.
 *
 * Signature-приём — ОТВЕТ С ПРОПУСКОМ: блок ответа нейросети, где чужие бренды
 * подчёркнуты цианом, а на месте посетителя — пустая красная пунктирная рамка.
 * Он открывает страницу, повторяется в цепочке потери заявки и закрывает
 * страницу, подставляя туда уже введённый посетителем домен.
 *
 * Визуальные объекты в теле (чтобы текст не шёл сплошняком): мокап выдачи
 * поиска, приборная панель четырёх слоёв и превью документа-разбора. Все
 * нарисованы CSS/SVG — переживают смену темы, масштабируются и не тянут вес.
 * Названия компаний в мокапах условные: чужие бренды в свою рекламу не ставим.
 */
import { AiRow, AI_ROW_CSS, type AiKey } from "@/components/landing/AiMarks";
import { RadarField, RADAR_FIELD_CSS } from "@/components/landing/RadarField";
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
/* Цвета вердикта — из локальной палитры страницы, а не из токенов кабинета:
   платформенные --destructive/--warning/--success рассчитаны на светлый фон
   и на графите теряют контраст. */
const toneColor = (t?: Tone) =>
  t === "bad" ? "var(--loss)" : t === "warn" ? "var(--mrc-amber)" : t === "ok" ? "var(--mrc-green)" : "var(--flare-use)";

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

      {/* ─── Первый экран: чернильная плита, вопрос-боль и живой пример ─── */}
      <section className="mrc-slab mrc-hero">
        <RadarField className="mrc-radar" />
        <div className="mrc-wrap">
          <header className="mrc-topbar">
            <a href="/" className="mrc-wordmark" aria-label="MarketRadar24">
              <RadarMark />
              <span aria-hidden="true">Market<b>Radar24</b></span>
            </a>
            <span className="mrc-mono mrc-topbar-tag">диагностика сайта · 0 ₽</span>
          </header>

          <div className="mrc-hero-grid">
            <div className="mrc-hero-head">
              <div className="mrc-mono mrc-eyebrow">
                <span className="mrc-dot" aria-hidden="true" />
                бесплатно · без звонков · результат на экране
              </div>
              <h1 className="mrc-h1">
                Почему ваш сайт<br />
                <span className="mrc-grad">не приносит заявки?</span>
              </h1>
              <p className="mrc-lead mrc-hero-lead">
                Клиент спрашивает совета у нейросети и получает два-три имени. Снимем три замера
                и покажем, почему в этот ответ не попадаете вы — без регистрации и разговора
                с менеджером.
              </p>
            </div>

            <div className="mrc-hero-scene">
              <AnswerScene slot="ваш сайт" />
            </div>

            <div className="mrc-hero-form">
              <UrlForm
                id="hero"
                url={url} setUrl={setUrl} starting={starting} onStart={start}
                error={startErr}
                note="Нужен только адрес сайта — ни почты, ни телефона на этом шаге."
              />
            </div>
          </div>
        </div>
      </section>

      <main>
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
                {kpState === "idle" && (
                  <>
                    <div className="mrc-mono mrc-kicker">следующий шаг</div>
                    <div className="mrc-h3 mrc-h3-lg">Это экспресс-диагноз. Полный разбор — тоже бесплатно</div>
                    <p className="mrc-body mrc-lead-card-text">
                      Внутри: находки с доказательствами по вашему сайту, конкуренты поимённо — с запросами,
                      по которым они забирают ваших клиентов, прогноз заявок по каналам и план работ с ценами.
                      Разбор собирается 2–3{" "}минуты и открывается по ссылке.
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
                    <div className="mrc-h3 mrc-h3-lg">Собираем полный разбор — 2–3{" "}минуты</div>
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
                      <div className="mrc-h3 mrc-h3-lg" style={{ margin: 0 }}>Полный разбор готов</div>
                      <a href={kpUrl} target="_blank" rel="noopener noreferrer" className="mrc-btn mrc-btn-primary">
                        Открыть разбор
                      </a>
                    </div>
                  </>
                )}
                {kpState === "error" && (
                  <>
                    <div className="mrc-mono mrc-kicker">ручная сборка</div>
                    <div className="mrc-h3 mrc-h3-lg">Разбор готовим вручную</div>
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

          {/* Мокап выдачи: та же цепочка, но показанная глазами клиента */}
          <SerpMock
            query="сколько стоит и где заказать — москва"
            note="Первую страницу занимают те, у кого описаны услуги и цены. Вас на ней нет — сравнивать не с чем."
          />

          <p className="mrc-note">
            Сайт при этом может быть отличным. Его просто не показали.
          </p>
        </section>
      </div>

      {/* ─── 02 · SEO и GEO — чернильный разворот ─── */}
      <section className="mrc-slab mrc-slab-sec" data-reveal>
        <div className="mrc-wrap">
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
            <p className="mrc-body" style={{ margin: 0 }}>
              <b>SEO даёт право быть найденным. GEO — право быть рекомендованным.</b>{" "}
              Второе надстраивается над первым, а не заменяет его: если сайт плохо читается поиском,
              нейросеть его тоже не увидит — она берёт данные оттуда же.
            </p>
          </div>
        </div>
      </section>

      <div className="mrc-wrap">
        {/* ─── 03 · Что мы делаем ─── */}
        <section className="mrc-sec" data-reveal>
          <SecHead
            idx="03"
            title="Что мы делаем"
            sub="Четыре слоя работы. Каждый следующий имеет смысл, только когда сделан предыдущий."
          />
          {/* Приборная панель: четыре слоя как четыре канала сигнала */}
          <SignalPanel />

          <div className="mrc-layers">
            {LAYERS.map(l => (
              <article key={l.n} className="mrc-layer" data-accent={l.acc}>
                <div className="mrc-layer-top">
                  <span className="mrc-layer-ico" aria-hidden="true"><Icon name={l.icon} /></span>
                  <span className="mrc-mono mrc-layer-n">{l.n}</span>
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
          {/* Асимметричная секция: слева превью документа, справа его содержание */}
          <div className="mrc-deliver-wrap">
            <ReportMock />
            <div className="mrc-deliver">
              {DELIVER.map(d => (
                <article key={d.t} className="mrc-deliver-item" data-accent={d.acc}>
                  <h3 className="mrc-h3">{d.t}</h3>
                  <p className="mrc-body">{d.d}</p>
                  <ul className="mrc-ul">
                    {d.points.map(p => <li key={p}>{p}</li>)}
                  </ul>
                </article>
              ))}
            </div>
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
      </div>

      {/* ─── Финальный CTA: тот же ответ, но пропуск подписан вашим доменом ─── */}
      <section className="mrc-slab mrc-final" data-reveal>
        <div className="mrc-wrap mrc-final-grid">
          <div>
            <div className="mrc-mono mrc-kicker">проверка сайта</div>
            <h2 className="mrc-h2">Начните с замера,<br />а не с договора</h2>
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
          </div>
          <div className="mrc-final-scene">
            <AnswerScene slot={url.trim() || "ваш сайт"} compact />
          </div>
        </div>
      </section>
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

/* ─── Signature-приём: ответ ассистента с пропуском ─────────────────────────
   Пример, а не реальные данные, — это подписано в самой сцене. Названия
   условные: выдумывать конкурентов посетителя мы не имеем права, а механику
   показать надо. Реальные имена и запросы приходят в полном разборе. */

const DEMO_QUESTIONS = [
  "посоветуй, к кому обратиться — и сколько это стоит",
  "какие компании делают это в Москве — назови несколько",
  "подбери подрядчика: кому из них можно доверять",
];

/**
 * Ассистенты со знаком-меткой и своим цветом.
 *
 * Глифы НАРОЧНО абстрактные, а не копии настоящих логотипов: чужие
 * товарные знаки в своей рекламе не размещаем. Каждому — узнаваемая
 * геометрия и цвет из палитры продакшена, чтобы ряд читался визуально,
 * а не как пять одинаковых серых пилюль.
 */
const DEMO_ASKERS: AiKey[] = ["alice", "chatgpt", "claude", "perplexity", "gigachat"];

function AnswerScene({ slot, compact }: { slot: string; compact?: boolean }) {
  const [qi, setQi] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setQi(i => (i + 1) % DEMO_QUESTIONS.length), 4200);
    return () => clearInterval(t);
  }, []);

  return (
    <figure className={`mrc-ans${compact ? " is-compact" : ""}`}>
      <figcaption className="mrc-mono mrc-ans-cap">
        <span className="mrc-ans-live" aria-hidden="true" />
        пример ответа ассистента · названия условные
      </figcaption>

      <div className="mrc-ans-q">
        <span className="mrc-mono mrc-ans-qlabel">вопрос клиента</span>
        <p className="mrc-ans-qtext" key={qi}>
          «{DEMO_QUESTIONS[qi]}»<i className="mrc-caret" aria-hidden="true" />
        </p>
      </div>

      <div className="mrc-ans-body">
        <p className="mrc-ans-text">
          Из подрядчиков в этой нише чаще всего упоминают{" "}
          <mark className="mrc-name">Конкурента&nbsp;А</mark> и{" "}
          <mark className="mrc-name mrc-name-2">Конкурента&nbsp;Б</mark>. У них описаны услуги,
          указаны цены и есть отзывы на картах — ассистенту есть на что сослаться.
        </p>
        <div className="mrc-slot">
          <span className="mrc-slot-box" title={slot}>{slot}</span>
          <span className="mrc-mono mrc-slot-note">в ответе не назван</span>
        </div>
      </div>

      {!compact && (
        <div className="mrc-ans-foot">
          <span className="mrc-mono mrc-ans-footlabel">спрашивают у</span>
          <AiRow items={DEMO_ASKERS} />
        </div>
      )}
    </figure>
  );
}

/* ─── Логотип продакшена ───────────────────────────────────────────────────
   Радар-марка marketradar24.ru: свечение, три кольца, узлы-связи и бегущий
   луч. Цвета — через переменные страницы, чтобы не держать hex в компоненте. */

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

/* ─── Визуальные объекты в теле страницы ───────────────────────────────────
   Все три нарисованы CSS/SVG, а не вставлены картинкой: растр не переживает
   смену темы, не масштабируется на мобильном и тянет вес. Данные внутри —
   условные и так подписаны; чужие бренды в свою рекламу не ставим. */

type Accent = "cyan" | "indigo" | "amber" | "green" | "pink" | "violet" | "red";

/** Строки органической выдачи: структура узнаваема, названия условные. */
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

/** Мокап поисковой выдачи: конкуренты в топе, места клиента нет. */
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

/* Приборная панель слоёв. Значения условные и подписаны как схема: они
   иллюстрируют правило «итог равен самому слабому слою», а не замер сайта. */
const CHANNELS: { t: string; acc: Accent; on: number }[] = [
  { t: "Техника", acc: "cyan", on: 6 },
  { t: "Контент", acc: "amber", on: 7 },
  { t: "Упоминания", acc: "green", on: 2 },
  { t: "Репутация", acc: "pink", on: 5 },
];
const CH_STEPS = 8;

function SignalPanel() {
  const weakest = Math.min(...CHANNELS.map(c => c.on));
  return (
    <figure className="mrc-signal">
      <figcaption className="mrc-signal-head">
        <span className="mrc-mono">сигналы, из которых собирается ответ</span>
        <span className="mrc-mono mrc-signal-legend">схема · значения условные</span>
      </figcaption>

      <div className="mrc-signal-grid">
        <div className="mrc-chans">
          {CHANNELS.map(c => (
            <div key={c.t} className="mrc-chan" data-accent={c.acc}>
              <div className="mrc-chan-bars" aria-hidden="true">
                {Array.from({ length: CH_STEPS }, (_, i) => (
                  <span key={i} className={`mrc-chan-seg${i < c.on ? " is-on" : ""}`} />
                ))}
              </div>
              <span className="mrc-mono mrc-chan-val">{c.on}/{CH_STEPS}</span>
              <span className="mrc-chan-t">{c.t}</span>
            </div>
          ))}
        </div>

        <div className="mrc-signal-out">
          <div className="mrc-chan is-out" data-accent="indigo">
            <div className="mrc-chan-bars" aria-hidden="true">
              {Array.from({ length: CH_STEPS }, (_, i) => (
                <span key={i} className={`mrc-chan-seg${i < weakest ? " is-on" : ""}`} />
              ))}
            </div>
            <span className="mrc-mono mrc-chan-val">{weakest}/{CH_STEPS}</span>
            <span className="mrc-chan-t">Итог</span>
          </div>
          <p className="mrc-body mrc-signal-note">
            Итог равен самому слабому каналу, а не их сумме. Отличная техника при пустых
            внешних упоминаниях даёт ровно столько же, сколько сами упоминания.
          </p>
        </div>
      </div>
    </figure>
  );
}

/** Превью документа-разбора: что именно приходит по ссылке. */
function ReportMock() {
  return (
    <figure className="mrc-doc">
      <div className="mrc-doc-bar" aria-hidden="true">
        <span className="mrc-doc-dots"><i /><i /><i /></span>
        <span className="mrc-mono mrc-doc-addr">разбор · страница по ссылке</span>
      </div>
      <div className="mrc-doc-body">
        <div className="mrc-doc-title" aria-hidden="true">
          <span className="mrc-doc-h" />
          <span className="mrc-doc-sub" />
        </div>

        <div className="mrc-doc-sec">
          <span className="mrc-mono mrc-doc-lab" data-accent="cyan">находки</span>
          <span className="mrc-doc-line" style={{ width: "94%" }} />
          <span className="mrc-doc-line" style={{ width: "78%" }} />
        </div>

        <div className="mrc-doc-sec">
          <span className="mrc-mono mrc-doc-lab" data-accent="pink">конкуренты</span>
          <div className="mrc-doc-rows" aria-hidden="true">
            {["konkurent-a.ru", "konkurent-b.ru", "konkurent-v.ru"].map((d, i) => (
              <span key={d} className="mrc-doc-row">
                <em>{d}</em>
                <i style={{ width: `${72 - i * 22}%` }} />
              </span>
            ))}
          </div>
        </div>

        <div className="mrc-doc-sec">
          <span className="mrc-mono mrc-doc-lab" data-accent="indigo">прогноз</span>
          <div className="mrc-doc-chart" aria-hidden="true">
            {[34, 46, 40, 58, 70, 64, 82].map((h, i) => (
              <i key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        <div className="mrc-doc-sec">
          <span className="mrc-mono mrc-doc-lab" data-accent="green">план работ и цены</span>
          <span className="mrc-doc-line" style={{ width: "88%" }} />
          <span className="mrc-doc-line" style={{ width: "62%" }} />
        </div>
      </div>
      <figcaption className="mrc-mono mrc-doc-cap">схема страницы разбора · содержимое собирается по вашему сайту</figcaption>
    </figure>
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

/* Свой акцент на карточку — приём с дашборда продакшена, где у каждой
   возможности своя кромка и свой цвет иконки. */
const LAYERS: { n: string; icon: IconName; acc: Accent; t: string; d: string }[] = [
  { n: "01", icon: "gear", acc: "cyan", t: "Техника сайта", d: "Скорость, структура, заголовки, разметка данных, карта сайта, доступ для поисковых и нейросетевых роботов. Чтобы машина могла прочитать, чем вы занимаетесь, для кого и на каких условиях." },
  { n: "02", icon: "text", acc: "amber", t: "Контент", d: "Страницы услуг, ответы на реальные вопросы клиентов, цены и условия словами, а не картинкой. Нейросети пересказывают текст — если текста нет, пересказывать нечего." },
  { n: "03", icon: "link", acc: "green", t: "Внешние упоминания и Digital PR", d: "Публикации на отраслевых площадках, каталоги, профили на картах, экспертные материалы. Робот больше доверяет тому, о ком пишут не только на его собственном сайте." },
  { n: "04", icon: "star", acc: "pink", t: "Репутация", d: "Отзывы там, где их читают, и ответы на них. Оценки и формулировки из отзывов попадают в ответ ассистента почти дословно — вместе с претензиями." },
];

const DELIVER: { t: string; acc: Accent; d: string; points: string[] }[] = [
  {
    t: "Находки с доказательствами", acc: "cyan",
    d: "По каждой проблеме показано, где мы её увидели, а не абстрактное «нужно улучшить SEO».",
    points: ["адрес конкретной страницы", "замер или выдержка из выдачи", "что именно это стоит вам в заявках"],
  },
  {
    t: "Конкуренты поимённо", acc: "pink",
    d: "Не «лидеры рынка», а конкретные домены, которые забирают ваш спрос прямо сейчас.",
    points: ["запросы, по которым они выше вас", "частотность этих запросов", "чего у них есть, а у вас нет"],
  },
  {
    t: "Прогноз заявок", acc: "indigo",
    d: "Сколько обращений способен дать канал при текущем спросе — с показанным расчётом.",
    points: ["исходные данные расчёта", "допущения, на которых он держится", "честная пометка: это оценка, не гарантия"],
  },
  {
    t: "План работ с ценами", acc: "green",
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
      <span className="mrc-num" aria-hidden="true">{idx}</span>
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
  const accent = pending ? "var(--rule)" : probe === "failed" ? "var(--soft)" : toneColor(tone);
  return (
    <article className="mrc-probe">
      <span className="mrc-probe-rail" style={{ background: accent }} aria-hidden="true" />
      <div className="mrc-probe-head">
        <span className="mrc-mono mrc-probe-n">{idx}</span>
        <h3 className="mrc-probe-t">{title}</h3>
        <span className={`mrc-mono mrc-status${pending ? " is-pending" : ""}`}>
          <span className="mrc-status-dot" style={{ background: pending ? "var(--soft)" : accent }} aria-hidden="true" />
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
        {s.lcpDisplay && <>Главный контент появляется за {s.lcpDisplay} (норма Google — до 2,5{" "}с). </>}
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
   Палитра взята с продакшена marketradar24.ru и заведена локальными
   переменными: графит вместо бумаги, индиго вместо терракоты. Роли цвета
   собраны в четырёх переменных — --rule, --soft, --surface, --flare-use, —
   которые уплотняются внутри плиты (.mrc-slab), поэтому один и тот же
   компонент живёт на полотне и на плите без дублей стилей.
   Полотно тёмное при любой теме платформы: это осознанное арт-решение —
   лендинг обязан выглядеть тем же продуктом, что и marketradar24.ru.
   Глобальный globals.css душит h1/h2 на мобильном через !important — поэтому
   размеры заголовков здесь тоже помечены !important. */

const CSS = AI_ROW_CSS + `
/* Акцент дублируем на :root: куки-баннер живёт в layout, СНАРУЖИ .mrc-root,
   и без этого красился бы синим примари платформы. Механика прежняя,
   изменилось только значение: индиго продакшена вместо терракоты.
   Правило действует только пока страница смонтирована. */
:root { --mrc-flare-ink: #4f46e5; }
:root.dark { --mrc-flare-ink: #4f46e5; } /* белый текст 5.6:1 в обеих темах */

.mrc-root {
  /* Продакшен набран Inter — на нём же набраны и заголовки лендинга.
     Merriweather оставлен только в теле «ответа ассистента»: там он работает
     как голос документа внутри карточки, а не как шрифт интерфейса. */
  --f-display: var(--font-inter), Inter, system-ui, sans-serif;
  --f-text: var(--font-inter), Inter, system-ui, sans-serif;
  --f-doc: var(--font-merriweather), Georgia, 'Times New Roman', serif;
  --f-mono: var(--font-geist-mono), ui-monospace, 'SFMono-Regular', Menlo, monospace;

  /* ── Палитра marketradar24.ru ──────────────────────────────────────────
     indigo — основное действие; cyan — служебный акцент и логотип;
     green — статус «готово»; red/pink — потеря и предупреждение;
     magenta→violet→cyan — градиент заголовка первого экрана. */
  --mrc-ink: #111318;
  --mrc-ink-deep: #0c0e13;
  --mrc-ink-soft: #171a21;
  --mrc-fg: #f1f5f9;
  --mrc-fg-mid: #cbd5e1;
  --mrc-fg-soft: #94a3b8;

  --mrc-indigo: #4f46e5; /* indigo-600: с белым текстом 5.6:1, у #6366f1 было 4.47 — ниже AA */
  --mrc-indigo-lift: #818cf8;
  --mrc-indigo-fg: #a5b4fc;
  --mrc-cyan: #00d4ff;
  --mrc-green: #69ff47;
  --mrc-amber: #ffb547;
  --mrc-pink: #ff5ea8;
  --mrc-violet: #b06bff;
  --mrc-magenta: #d500f9;
  --mrc-red: #ff5252;
  --mrc-logo-ring: #1a3f5c;
  /* Выдача поиска: синий тайтл и зелёный путь, поднятые до читаемых на графите */
  --mrc-serp-link: #8ab4ff;
  --mrc-serp-url: #7bd88f;

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
/* Тёмная тема платформы — тот же графит на полтона глубже: страница остаётся
   собой, но не спорит с окружением кабинета. */
:root.dark .mrc-root { --mrc-ink: #0e1015; --mrc-ink-deep: #090b0f; --mrc-ink-soft: #14171d; }

/* Акценты карточек — приём с дашборда продакшена, где у каждой возможности
   своя кромка и свой цвет иконки. */
.mrc-root [data-accent] { --acc: var(--mrc-indigo-fg); }
.mrc-root [data-accent="cyan"] { --acc: var(--mrc-cyan); }
.mrc-root [data-accent="indigo"] { --acc: var(--mrc-indigo-fg); }
.mrc-root [data-accent="amber"] { --acc: var(--mrc-amber); }
.mrc-root [data-accent="green"] { --acc: var(--mrc-green); }
.mrc-root [data-accent="pink"] { --acc: var(--mrc-pink); }
.mrc-root [data-accent="violet"] { --acc: var(--mrc-violet); }
.mrc-root [data-accent="red"] { --acc: var(--mrc-red); }

.mrc-wrap { max-width: 1180px; margin: 0 auto; padding: 0 28px; }

/* Плита: графит плотнее полотна. Ритм страницы держится на смене плотности,
   а не на смене бумаги и чернил. */
.mrc-slab {
  position: relative;
  background: var(--mrc-ink-deep);
  --rule: color-mix(in srgb, var(--mrc-fg) 14%, transparent);
  --surface: color-mix(in srgb, var(--mrc-fg) 4%, transparent);
  --field-bg: color-mix(in srgb, var(--mrc-fg) 7%, transparent);
}
.mrc-slab::before {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    repeating-linear-gradient(90deg, color-mix(in srgb, var(--mrc-fg) 4%, transparent) 0 1px, transparent 1px 116px),
    repeating-linear-gradient(0deg, color-mix(in srgb, var(--mrc-fg) 3%, transparent) 0 1px, transparent 1px 116px);
  -webkit-mask-image: linear-gradient(to bottom, #000, transparent 82%);
  mask-image: linear-gradient(to bottom, #000, transparent 82%);
}
.mrc-slab > * { position: relative; z-index: 1; }
.mrc-slab-sec { padding: 54px 0 60px; }
/* Свечение первого экрана — как на проде: маджента слева, индиго справа */
.mrc-hero::after, .mrc-final::after {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(64% 52% at 14% -6%, color-mix(in srgb, var(--mrc-magenta) 13%, transparent), transparent 68%),
    radial-gradient(58% 48% at 88% 8%, color-mix(in srgb, var(--mrc-indigo) 16%, transparent), transparent 70%);
}

.mrc-mono {
  font-family: var(--f-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}

/* ── Верхняя планка ── */
.mrc-topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 20px 0 34px;
}
/* Словесный знак как на проде: Market обычным весом, Radar24 жирным */
.mrc-wordmark {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--f-text); font-size: 19px; font-weight: 400; letter-spacing: -0.012em;
  color: var(--mrc-fg); text-decoration: none;
}
.mrc-wordmark b { font-weight: 800; }
.mrc-logo { flex-shrink: 0; display: block; }
.mrc-logo-sweep { transform-origin: 32px 32px; animation: mrc-sweep 4s linear infinite; }
@keyframes mrc-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.mrc-topbar-tag { color: var(--soft); }

/* ── Типографика ── */
.mrc-h1 {
  font-family: var(--f-display);
  font-size: clamp(38px, 4.6vw, 58px) !important;
  font-weight: 800; line-height: 1.04; letter-spacing: -0.032em;
  margin: 0 0 20px;
}
/* Градиент по строке заголовка — фирменный ход первого экрана продакшена */
.mrc-grad {
  background: linear-gradient(96deg, var(--mrc-magenta) 4%, var(--mrc-violet) 46%, var(--mrc-cyan) 96%);
  -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
}
.mrc-h2 {
  font-family: var(--f-display);
  font-size: clamp(26px, 3.4vw, 40px) !important;
  font-weight: 800; line-height: 1.08; letter-spacing: -0.028em; margin: 0 0 12px;
}
.mrc-h3 { font-size: 16.5px; font-weight: 700; line-height: 1.3; letter-spacing: -0.015em; margin: 0 0 8px; }
.mrc-h3-lg { font-family: var(--f-display); font-size: 24px; font-weight: 800; line-height: 1.15; letter-spacing: -0.025em; margin: 0 0 10px; }
.mrc-lead { font-size: 15.5px; line-height: 1.62; color: var(--soft); margin: 0; max-width: 60ch; }
.mrc-body { font-size: 14px; line-height: 1.62; color: var(--soft); margin: 0; }
.mrc-note { font-size: 13px; line-height: 1.55; color: var(--soft); }
.mrc-err { color: var(--loss); font-size: 13.5px; margin-top: 10px; }
.mrc-kicker { color: var(--flare-use); margin-bottom: 10px; }
.mrc-ul { margin: 12px 0 0; padding-left: 0; list-style: none; }
.mrc-ul li {
  position: relative; padding-left: 17px; font-size: 13.5px; line-height: 1.55;
  color: var(--soft); margin-bottom: 6px;
}
.mrc-ul li::before {
  content: ''; position: absolute; left: 0; top: 0.62em;
  width: 8px; height: 1px; background: var(--flare-use);
}

/* ── Первый экран ── */
.mrc-hero { padding-bottom: 62px; }
/* Сцена занимает правую колонку целиком, текст и форма — левую сверху вниз.
   На мобильном порядок меняется: сначала обещание, потом доказательство,
   потом поле — чтобы «показывает» попало в первый экран раньше формы. */
.mrc-hero-grid {
  display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  grid-template-areas: "head scene" "form scene";
  grid-template-rows: auto 1fr;
  gap: 30px 46px; align-items: start;
}
.mrc-hero-head { grid-area: head; padding-top: 6px; }
.mrc-hero-form { grid-area: form; }
.mrc-hero-scene { grid-area: scene; }
/* Бейдж-статус продакшена: зелёная точка, зелёный текст, скруглённая капсула */
.mrc-eyebrow {
  display: inline-flex; align-items: center; gap: 9px;
  margin-bottom: 22px; padding: 8px 15px; border-radius: 999px;
  font-family: var(--f-text); font-size: 12.5px; font-weight: 600;
  letter-spacing: 0.005em; text-transform: none;
  color: var(--mrc-green);
  border: 1px solid color-mix(in srgb, var(--mrc-green) 32%, transparent);
  background: color-mix(in srgb, var(--mrc-green) 8%, transparent);
}
.mrc-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--mrc-green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mrc-green) 22%, transparent);
}
.mrc-hero-lead { font-size: 17px; margin-bottom: 0; max-width: 46ch; }

/* ── Сцена «ответ с пропуском» — signature ── */
.mrc-ans {
  position: relative; margin: 0; padding: 22px 24px 20px;
  background: var(--surface);
  border: 1px solid var(--rule); border-radius: var(--mrc-r-lg);
  overflow: hidden;
}
/* Цветная кромка панели — как у карточек возможностей на проде */
.mrc-ans::before {
  content: ''; position: absolute; left: 0; right: 0; top: 0; height: 2px;
  background: linear-gradient(90deg, var(--mrc-cyan), color-mix(in srgb, var(--mrc-cyan) 8%, transparent));
}
.mrc-ans-cap {
  display: flex; align-items: center; gap: 8px;
  color: var(--soft); margin-bottom: 18px;
}
.mrc-ans-live {
  width: 7px; height: 7px; border-radius: 50%; background: var(--mrc-cyan);
  flex-shrink: 0; animation: mrc-blink 2.2s var(--ease) infinite;
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
}
/* Маркер: подсветка ведётся background-size, поэтому лежит под глиссадой
   текста и не требует отдельного слоя со z-index. Цвет — циан: он же
   служебный акцент бренда и цвет логотипа, на графите читается лучше всего. */
.mrc-name {
  background-color: transparent; color: var(--mrc-fg); font-weight: 700;
  padding: 0 2px 4px; white-space: nowrap;
  background-image: linear-gradient(color-mix(in srgb, var(--mrc-cyan) 50%, transparent),
                                    color-mix(in srgb, var(--mrc-cyan) 50%, transparent));
  background-repeat: no-repeat; background-position: 0 100%;
  background-size: 0% 7px;
  animation: mrc-mark 640ms var(--ease) 420ms both;
}
.mrc-name-2 { animation-delay: 940ms; }
/* Пропуск — это потеря, поэтому он красный, а не акцентный: рамка на месте
   посетителя обязана читаться как «здесь вас нет», а не как подсветка. */
.mrc-slot { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.mrc-slot-box {
  display: inline-flex; align-items: center; min-height: 42px; padding: 0 18px;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border: 2px dashed color-mix(in srgb, var(--loss) 65%, transparent);
  border-radius: var(--mrc-r);
  background: color-mix(in srgb, var(--loss) 7%, transparent);
  color: var(--loss);
  font-family: var(--f-mono); font-size: 12.5px; letter-spacing: 0.06em;
  animation: mrc-slotpulse 2.8s var(--ease) infinite;
}
.mrc-slot-note { color: var(--soft); }
.mrc-ans-foot {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--rule);
}
.mrc-ans-footlabel { color: var(--soft); }
.mrc-chips { display: flex; gap: 6px; flex-wrap: wrap; list-style: none; margin: 0; padding: 0; }
.mrc-chips li {
  border: 1px solid var(--rule); border-radius: 999px; padding: 5px 11px; font-size: 10.5px;
  letter-spacing: 0.06em; color: var(--soft); text-transform: none;
}
/* Ассистенты — со знаком-меткой своего цвета: ряд из пяти одинаковых серых
   пилюль не читался как «покрытие», это была просто строка текста. */
.mrc-asker { display: inline-flex; align-items: center; gap: 7px; padding-left: 9px; }
.mrc-asker svg { opacity: 0.95; }
.mrc-ans.is-compact { padding: 18px 20px 16px; }
.mrc-ans.is-compact .mrc-ans-qtext { font-size: 15.5px; margin-bottom: 16px; }
.mrc-ans.is-compact .mrc-ans-text { font-size: 14.5px; margin-bottom: 16px; }

@keyframes mrc-mark { from { background-size: 0% 7px; } to { background-size: 100% 7px; } }
@keyframes mrc-qin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mrc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
@keyframes mrc-slotpulse {
  0%, 100% { border-color: color-mix(in srgb, var(--loss) 38%, transparent); }
  50% { border-color: color-mix(in srgb, var(--loss) 92%, transparent); }
}

/* ── Форма ── */
.mrc-urlform { max-width: 560px; }
.mrc-form-row { display: flex; gap: 10px; flex-wrap: wrap; }
.mrc-input {
  flex: 1 1 240px; min-width: 0; height: 52px; padding: 0 16px;
  font-family: inherit; font-size: 15px;
  border-radius: var(--mrc-r); border: 1px solid var(--rule);
  background: var(--field-bg);
  color: var(--mrc-fg); outline: none;
  transition: border-color var(--motion-fast) var(--ease), box-shadow var(--motion-fast) var(--ease);
}
.mrc-input::placeholder { color: var(--soft); }
.mrc-input:focus {
  border-color: var(--mrc-indigo);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mrc-indigo) 28%, transparent);
}
.mrc-btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 52px; min-height: 52px; padding: 0 26px;
  font-family: inherit; font-size: 15px; font-weight: 700; letter-spacing: -0.005em;
  border: 1px solid transparent; border-radius: var(--mrc-r);
  cursor: pointer; white-space: nowrap; text-decoration: none;
  transition: background-color var(--motion-fast) var(--ease), opacity var(--motion-fast) var(--ease),
              border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease);
}
/* Индиго продакшена + мягкое свечение под кнопкой */
.mrc-btn-primary {
  background: var(--mrc-indigo); color: #fff;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--mrc-indigo) 34%, transparent);
}
.mrc-btn-primary:hover:not(:disabled) { background: var(--mrc-indigo-lift); }
.mrc-btn-primary:active:not(:disabled) { transform: translateY(1px); }
.mrc-btn:disabled { opacity: 0.55; cursor: not-allowed; }
/* Заливка акцентом в неактивном состоянии выглядит рабочей кнопкой —
   поэтому неактивная становится контурной, а не полупрозрачной. */
.mrc-btn-primary:disabled {
  opacity: 1; background: transparent; color: var(--soft);
  border-color: var(--rule); box-shadow: none;
}
.mrc-btn:focus-visible, .mrc-input:focus-visible, .mrc-root a:focus-visible, .mrc-checkbox:focus-visible {
  outline: 2px solid var(--flare-use); outline-offset: 2px;
}
.mrc-formnote {
  color: var(--soft); margin-top: 14px; line-height: 1.5;
  text-transform: none; letter-spacing: 0.02em; font-size: 11.5px; max-width: 46ch;
}

/* ── Секции на бумаге ── */
.mrc-sec { position: relative; border-top: 1px solid var(--rule); padding: 44px 0 52px; }
.mrc-sec-head {
  display: grid; grid-template-columns: 128px minmax(0, 1fr); align-items: start;
  margin-bottom: 30px;
}
.mrc-num {
  font-family: var(--f-display); font-size: clamp(48px, 5vw, 76px); font-weight: 800;
  line-height: 0.78; letter-spacing: -0.05em;
  color: transparent;
  -webkit-text-stroke: 1px color-mix(in srgb, var(--flare-use) 55%, transparent);
}
@supports not ((-webkit-text-stroke: 1px red)) {
  .mrc-num { color: color-mix(in srgb, var(--flare-use) 34%, transparent); }
}
.mrc-sec-text { min-width: 0; }
.mrc-slab-sec .mrc-sec-head { margin-bottom: 30px; }

/* ── Список замеров ── */
.mrc-instr-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule); }
.mrc-instr-row {
  display: grid; grid-template-columns: 128px minmax(0, 280px) minmax(0, 1fr);
  gap: 0 20px; align-items: baseline;
  padding: 20px 0; border-bottom: 1px solid var(--rule);
  transition: background-color var(--motion-fast) var(--ease);
}
.mrc-instr-row:hover { background: color-mix(in srgb, var(--mrc-fg) 4%, transparent); }
.mrc-instr-n { color: var(--flare-use); }
.mrc-instr-t { font-size: 17px; font-weight: 700; letter-spacing: -0.015em; }
.mrc-instr-d { font-size: 13.5px; line-height: 1.55; color: var(--soft); }

/* ── Лист замеров ── */
.mrc-readout-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  flex-wrap: wrap; margin-bottom: 20px;
}
.mrc-readout-label { color: var(--flare-use); margin-bottom: 6px; }
.mrc-readout-domain { margin: 0; overflow-wrap: anywhere; }
.mrc-meter { display: flex; align-items: center; gap: 10px; }
.mrc-meter-label { color: var(--soft); }
.mrc-meter-bars { display: inline-flex; gap: 4px; }
.mrc-meter-bar {
  width: 26px; height: 5px; background: var(--rule);
  transition: background-color 220ms var(--ease);
}
.mrc-meter-bar.is-on { background: var(--mrc-green); }

.mrc-probes { display: grid; gap: 14px; }
.mrc-probe {
  position: relative; background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--mrc-r-lg); overflow: hidden;
  padding: 20px 22px 20px 26px;
}
.mrc-probe-rail { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
.mrc-probe-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.mrc-probe-n { color: var(--soft); }
.mrc-probe-t { flex: 1 1 auto; font-size: 17px; font-weight: 700; letter-spacing: -0.015em; margin: 0; }
.mrc-status { display: inline-flex; align-items: center; gap: 6px; color: var(--soft); }
.mrc-status-dot { width: 6px; height: 6px; border-radius: 50%; }
.mrc-status.is-pending .mrc-status-dot { animation: mrc-blink 1.1s var(--ease) infinite; }
.mrc-probe-pending { margin-top: 16px; }
.mrc-probe-body { margin-top: 14px; }
.mrc-verdict-head {
  font-family: var(--f-display); font-size: 21px; font-weight: 800; line-height: 1.2;
  margin-bottom: 8px; letter-spacing: -0.025em;
}
.mrc-verdict-body { font-size: 13.5px; line-height: 1.6; color: var(--soft); font-variant-numeric: tabular-nums; }

/* Индикатор замера — бегущая полоса вместо спиннера */
.mrc-scan { position: relative; height: 3px; border-radius: 2px; background: var(--rule); overflow: hidden; }
.mrc-scan > span {
  position: absolute; inset: 0 auto 0 0; width: 34%; border-radius: 2px;
  background: var(--mrc-indigo); animation: mrc-scan 1.5s var(--ease) infinite;
}
@keyframes mrc-scan { 0% { transform: translateX(-110%); } 100% { transform: translateX(400%); } }

/* ── Карточка захвата email ── */
.mrc-lead-card {
  position: relative; margin-top: 24px; background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--mrc-indigo) 34%, transparent);
  border-radius: var(--mrc-r-lg); overflow: hidden;
  padding: 26px 26px 22px;
}
.mrc-lead-card::before {
  content: ''; position: absolute; left: 0; right: 0; top: 0; height: 2px;
  background: linear-gradient(90deg, var(--mrc-indigo), color-mix(in srgb, var(--mrc-cyan) 70%, transparent));
}
.mrc-lead-card-text { margin-bottom: 18px; max-width: 84ch; }
.mrc-done-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.mrc-consent {
  display: flex; gap: 11px; align-items: flex-start; margin-top: 16px;
  cursor: pointer; font-size: 12.5px; line-height: 1.55; color: var(--soft);
}
.mrc-consent a { color: var(--flare-use); text-decoration: underline; text-underline-offset: 2px; }
.mrc-checkbox {
  margin: 1px 0 0; width: 17px; height: 17px; min-height: 17px;
  accent-color: var(--mrc-indigo); flex-shrink: 0; cursor: pointer;
}

/* ── Схема: куда уходят заявки ── */
.mrc-chain {
  list-style: none; margin: 0; padding: 0;
  position: relative;
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0 14px;
}
.mrc-chain::before {
  content: ''; position: absolute; left: 0; right: 0; top: 6px; height: 1px;
  background: var(--rule);
}
.mrc-chain-node { position: relative; padding-top: 26px; }
.mrc-chain-tick {
  position: absolute; top: 0; left: 0; width: 13px; height: 13px; border-radius: 50%;
  background: var(--mrc-ink); border: 3px solid var(--mrc-indigo);
}
.mrc-chain-node.is-loss .mrc-chain-tick { border-color: var(--loss); }
.mrc-chain-n { color: var(--soft); display: block; margin-bottom: 12px; }
.mrc-chain-ico { display: block; color: var(--mrc-cyan); margin-bottom: 12px; }
.mrc-chain-node.is-loss .mrc-chain-ico { color: var(--loss); }
.mrc-chain-t { display: block; font-size: 15.5px; font-weight: 700; letter-spacing: -0.015em; margin-bottom: 7px; }
.mrc-chain-d { display: block; font-size: 13px; line-height: 1.55; color: var(--soft); }
.mrc-sec > .mrc-note { display: block; margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--rule); }

/* ── Сравнение путей ── */
.mrc-cmp { border-top: 1px solid var(--rule); }
.mrc-cmp-head, .mrc-cmp-row {
  display: grid; grid-template-columns: minmax(0, 200px) minmax(0, 1fr) minmax(0, 1fr);
  gap: 0 22px;
}
.mrc-cmp-head { padding: 12px 0; border-bottom: 1px solid var(--rule); color: var(--soft); }
.mrc-cmp-head span:nth-child(3) { color: var(--flare-use); }
.mrc-cmp-row { padding: 17px 0; border-bottom: 1px solid var(--rule); align-items: baseline; }
.mrc-cmp-k { color: var(--soft); }
.mrc-cmp-cell { font-size: 14.5px; line-height: 1.5; color: var(--soft); }
.mrc-cmp-cell-b { color: inherit; font-weight: 600; }
.mrc-conclusion {
  margin-top: 26px; padding: 22px 24px; border-radius: var(--mrc-r-lg);
  border: 1px solid var(--rule); border-left: 3px solid var(--mrc-indigo);
  background: var(--surface);
}
.mrc-conclusion .mrc-body { color: var(--mrc-fg-mid); font-size: 15px; font-family: var(--f-doc); line-height: 1.7; }
.mrc-conclusion .mrc-body b { color: var(--mrc-fg); }

/* ── Карточки: у каждой свой акцент по кромке и иконке (приём с продакшена) ── */
.mrc-layers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.mrc-layer, .mrc-deliver-item {
  position: relative; overflow: hidden;
  background: var(--surface); border: 1px solid var(--rule); border-radius: var(--mrc-r-lg);
  padding: 24px;
  transition: border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease);
}
.mrc-layer::before, .mrc-deliver-item::before {
  content: ''; position: absolute; left: 0; right: 0; top: 0; height: 2px;
  background: linear-gradient(90deg, var(--acc), color-mix(in srgb, var(--acc) 6%, transparent));
}
.mrc-layer:hover { border-color: color-mix(in srgb, var(--acc) 45%, transparent); transform: translateY(-2px); }
.mrc-layer-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.mrc-layer-n { color: var(--soft); }
/* Иконка в скруглённом квадрате с цветной рамкой — как на дашборде прода */
.mrc-layer-ico {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: var(--mrc-r);
  color: var(--acc);
  border: 1px solid color-mix(in srgb, var(--acc) 38%, transparent);
  background: color-mix(in srgb, var(--acc) 12%, transparent);
}

/* ── Что получает клиент: слева документ, справа его содержание ── */
.mrc-deliver-wrap {
  display: grid; grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  gap: 20px; align-items: start;
}
.mrc-deliver { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }

/* ── Чего мы не обещаем ── */
.mrc-honest { border-top: 1px solid var(--rule); }
.mrc-honest-row {
  display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr); gap: 16px 28px;
  padding: 22px 0; border-bottom: 1px solid var(--rule); align-items: start;
}
.mrc-honest-tag { display: block; color: var(--soft); margin-bottom: 10px; }
.mrc-honest-tag-ok { color: var(--mrc-green); }
.mrc-honest-claim s {
  font-family: var(--f-display); font-size: 21px; font-weight: 700; letter-spacing: -0.025em;
  line-height: 1.2; display: inline-block;
  color: var(--soft); text-decoration-thickness: 1.5px;
  text-decoration-color: var(--loss);
}
.mrc-honest-truth .mrc-body { color: var(--mrc-fg-mid); font-size: 14.5px; }

/* ── Финальный CTA ── */
.mrc-final { padding: 62px 0 68px; }
.mrc-final-grid {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 0.86fr);
  gap: 46px; align-items: center;
}
.mrc-final .mrc-lead { margin-bottom: 26px; }

/* ── Подвал ── */
.mrc-footer { border-top: 1px solid var(--rule); padding: 26px 0 38px; }
.mrc-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.mrc-footer-inner > .mrc-mono { color: var(--soft); }
.mrc-footer-nav { display: flex; gap: 20px; flex-wrap: wrap; }
.mrc-footer-nav a {
  font-size: 12.5px; color: var(--soft); text-decoration: none;
  border-bottom: 1px solid transparent;
}
.mrc-footer-nav a:hover { color: var(--mrc-fg); border-bottom-color: var(--flare-use); }

/* ── Мокап выдачи ────────────────────────────────────────────────────────
   Рисуем сами, а не вставляем скриншот: растр не переживает смену темы,
   не масштабируется на мобильном и тянет вес. Структура узнаваема
   (строка запроса, вкладки, синий тайтл, зелёный путь, сниппет с жирными
   вхождениями, рейтинг), но без чужих логотипов и марок. */
.mrc-serp {
  margin: 28px 0 0; padding: 0 0 8px; overflow: hidden;
  background: var(--surface); border: 1px solid var(--rule); border-radius: var(--mrc-r-lg);
}
.mrc-serp-cap {
  display: flex; align-items: center; gap: 9px; padding: 13px 18px;
  color: var(--soft); border-bottom: 1px solid var(--rule);
}
.mrc-serp-bar {
  display: flex; align-items: center; gap: 11px; margin: 18px 18px 0;
  height: 46px; padding: 0 16px; border-radius: 999px;
  border: 1px solid var(--rule);
  background: color-mix(in srgb, var(--mrc-fg) 4%, transparent);
}
.mrc-serp-bar svg { color: var(--soft); flex-shrink: 0; }
.mrc-serp-q {
  font-size: 14.5px; color: var(--mrc-fg); min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mrc-serp-tabs { display: flex; gap: 4px; margin: 12px 18px 0; overflow: hidden; }
.mrc-serp-tabs span {
  font-size: 12px; padding: 6px 12px; border-radius: 999px; color: var(--soft); white-space: nowrap;
}
.mrc-serp-tabs span.is-on {
  background: color-mix(in srgb, var(--mrc-fg) 11%, transparent); color: var(--mrc-fg); font-weight: 600;
}
.mrc-serp-list { list-style: none; margin: 0; padding: 6px 18px 10px; }
.mrc-serp-item {
  display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 0 12px;
  padding: 15px 0; border-bottom: 1px solid color-mix(in srgb, var(--mrc-fg-soft) 12%, transparent);
}
.mrc-serp-item.is-you { border-bottom: none; }
.mrc-serp-pos { color: var(--soft); padding-top: 3px; }
.mrc-serp-body { min-width: 0; }
.mrc-serp-title {
  display: block; font-size: 15px; font-weight: 500; line-height: 1.35;
  color: var(--mrc-serp-link); margin-bottom: 4px;
}
.mrc-serp-title b { font-weight: 700; }
.mrc-serp-url {
  display: block; color: var(--mrc-serp-url); text-transform: none;
  letter-spacing: 0.01em; margin-bottom: 7px; overflow-wrap: anywhere;
}
.mrc-serp-snip { margin: 0 0 9px; font-size: 13px; line-height: 1.5; color: var(--soft); }
.mrc-serp-snip b { color: var(--mrc-fg-mid); font-weight: 700; }
.mrc-serp-rate {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--soft); font-variant-numeric: tabular-nums;
}
.mrc-serp-rate svg { color: var(--mrc-amber); }
.mrc-serp-rate b { color: var(--mrc-fg-mid); font-weight: 700; }
/* Строка посетителя — пустая красная рамка, тот же приём, что и в сцене ответа */
.mrc-serp-empty {
  display: flex; align-items: center; gap: 8px 16px; flex-wrap: wrap;
  padding: 14px 16px; border-radius: var(--mrc-r);
  border: 2px dashed color-mix(in srgb, var(--loss) 55%, transparent);
  background: color-mix(in srgb, var(--loss) 7%, transparent);
}
.mrc-serp-empty-t { color: var(--loss); flex-shrink: 0; }
.mrc-serp-empty-d { font-size: 13px; line-height: 1.5; color: var(--soft); min-width: 0; }

/* ── Приборная панель слоёв ─────────────────────────────────────────────── */
.mrc-signal {
  margin: 0 0 20px; padding: 22px 24px;
  background: var(--surface); border: 1px solid var(--rule); border-radius: var(--mrc-r-lg);
}
.mrc-signal-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 12px; flex-wrap: wrap; margin-bottom: 22px; color: var(--soft);
}
/* Было color-mix с transparent 70% — контраст падал до 1.2 при норме 4.5.
   Полупрозрачный текст на графите нечитаем; берём сплошной приглушённый. */
.mrc-signal-legend { color: var(--mrc-fg-soft); }
.mrc-signal-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 24px; }
.mrc-chans { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.mrc-chan { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.mrc-chan-bars { display: flex; flex-direction: column-reverse; gap: 4px; height: 116px; }
.mrc-chan-seg {
  flex: 1; border-radius: 3px;
  background: color-mix(in srgb, var(--mrc-fg) 7%, transparent);
}
.mrc-chan-seg.is-on {
  background: var(--acc);
  box-shadow: 0 0 10px color-mix(in srgb, var(--acc) 30%, transparent);
}
.mrc-chan-val { color: var(--acc); }
.mrc-chan-t { font-size: 13px; font-weight: 600; color: var(--mrc-fg-mid); line-height: 1.3; }
.mrc-signal-out {
  display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 18px; align-items: start;
  padding-left: 24px; border-left: 1px solid var(--rule);
}
.mrc-signal-note { font-size: 13.5px; }

/* ── Превью документа-разбора ───────────────────────────────────────────── */
.mrc-doc {
  margin: 0; overflow: hidden; position: sticky; top: 20px;
  background: var(--surface); border: 1px solid var(--rule); border-radius: var(--mrc-r-lg);
}
.mrc-doc-bar {
  display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 14px;
  border-bottom: 1px solid var(--rule);
  background: color-mix(in srgb, var(--mrc-fg) 3%, transparent);
}
.mrc-doc-dots { display: inline-flex; gap: 6px; }
.mrc-doc-dots i {
  width: 9px; height: 9px; border-radius: 50%;
  background: color-mix(in srgb, var(--mrc-fg-soft) 32%, transparent);
}
.mrc-doc-addr { color: var(--soft); }
.mrc-doc-body { padding: 20px 22px; display: grid; gap: 20px; }
.mrc-doc-title { display: grid; gap: 8px; }
.mrc-doc-h {
  height: 15px; width: 62%; border-radius: 4px;
  background: color-mix(in srgb, var(--mrc-fg) 40%, transparent);
}
.mrc-doc-sub {
  height: 8px; width: 40%; border-radius: 4px;
  background: color-mix(in srgb, var(--mrc-fg-soft) 24%, transparent);
}
.mrc-doc-sec { display: grid; gap: 8px; }
.mrc-doc-lab { color: var(--acc); }
.mrc-doc-line {
  height: 8px; border-radius: 4px;
  background: color-mix(in srgb, var(--mrc-fg-soft) 20%, transparent);
}
.mrc-doc-rows { display: grid; gap: 7px; }
.mrc-doc-row { display: grid; grid-template-columns: 108px minmax(0, 1fr); gap: 10px; align-items: center; }
.mrc-doc-row em {
  font-style: normal; font-family: var(--f-mono); font-size: 10.5px;
  color: var(--soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mrc-doc-row i {
  display: block; height: 8px; border-radius: 4px;
  background: color-mix(in srgb, var(--mrc-pink) 45%, transparent);
}
.mrc-doc-chart { display: flex; align-items: flex-end; gap: 6px; height: 66px; }
.mrc-doc-chart i {
  flex: 1; border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, var(--mrc-indigo), color-mix(in srgb, var(--mrc-indigo) 30%, transparent));
}
.mrc-doc-cap {
  display: block; padding: 0 22px 18px; color: var(--soft);
  text-transform: none; letter-spacing: 0.02em; line-height: 1.5;
}

/* ── Ревилы ── */
.mrc-anim [data-reveal] { opacity: 0; transform: translateY(16px); }
.mrc-anim [data-reveal].is-in {
  opacity: 1; transform: none;
  transition: opacity 560ms var(--ease), transform 560ms var(--ease);
}

/* ── Планшет ── */
@media (max-width: 1000px) {
  /* Форма ВЫШЕ сцены: сцена высокая, и с порядком head→scene→form поле
     ввода уезжало на 987px при экране 812 — главное действие оказывалось
     ниже сгиба. Для страницы под платный трафик это прямая потеря: на
     мобильном человек должен видеть, что делать, без скролла. Сцена
     раскрывается первым же движением — доказательство не теряется. */
  .mrc-hero-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "head" "form" "scene";
    grid-template-rows: auto; gap: 28px;
  }
  .mrc-final-grid { grid-template-columns: minmax(0, 1fr); gap: 34px; }
  .mrc-hero-lead { max-width: 60ch; }
  .mrc-chain { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 18px; }
  .mrc-chain::before { display: none; }
  .mrc-chain-node { padding-top: 22px; border-top: 1px solid var(--rule); }
  .mrc-sec-head { grid-template-columns: 96px minmax(0, 1fr); }
  .mrc-instr-row { grid-template-columns: 96px minmax(0, 240px) minmax(0, 1fr); }
}

/* ── Мобильный ── */
@media (max-width: 767px) {
  .mrc-wrap { padding: 0 18px; }
  .mrc-h1 { font-size: clamp(32px, 9.2vw, 44px) !important; }
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

  .mrc-ans { padding: 18px 16px 16px; }
  .mrc-ans-qtext { font-size: 15.5px; }
  .mrc-ans-text { font-size: 14.5px; }
  .mrc-slot-box { font-size: 11.5px; padding: 0 12px; }

  .mrc-sec { padding: 32px 0 38px; }
  .mrc-slab-sec { padding: 40px 0 44px; }
  .mrc-final { padding: 44px 0 48px; }
  .mrc-sec-head { grid-template-columns: minmax(0, 1fr); gap: 6px; margin-bottom: 22px; }
  .mrc-num { font-size: 40px; line-height: 1; }

  .mrc-instr-row { grid-template-columns: 44px minmax(0, 1fr); gap: 4px 12px; }
  .mrc-instr-n { grid-row: span 2; }

  .mrc-chain { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .mrc-chain-ico { margin-bottom: 8px; }

  .mrc-cmp-head { display: none; }
  .mrc-cmp-row { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 18px 0; }
  .mrc-cmp-cell { position: relative; padding-left: 96px; font-size: 13.5px; }
  .mrc-cmp-cell::before {
    content: attr(data-tag); position: absolute; left: 0; top: 2px; width: 88px;
    font-family: var(--f-mono);
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--soft);
  }
  .mrc-cmp-cell-b::before { color: var(--flare-use); }

  .mrc-layers, .mrc-deliver { grid-template-columns: minmax(0, 1fr); }
  .mrc-honest-row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .mrc-lead-card { padding: 20px 16px 18px; }
  .mrc-probe { padding: 18px 16px 18px 20px; }
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
  .mrc-caret { opacity: 1; }
}
` + RADAR_FIELD_CSS;
