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
import { SerpCollage, SERP_COLLAGE_CSS } from "@/components/landing/SerpCollage";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniCheckResult } from "@/lib/mini-check";
import { readAttribution } from "@/lib/attribution";
import { VENDOR_PUBLIC, DEMO_REPORTS } from "@/lib/vendor-public";

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

/**
 * Воронка проверки сайта — одна реализация на два адреса.
 *
 * compact=false (/check, /new2) — полная страница с маркетинговыми
 * разделами 01-04 и 06.
 * compact=true (/new) — мини-лендинг под рекламу: первый экран, форма,
 * результаты проверок и захват почты, затем только то, без чего нельзя, —
 * разбор частых обещаний, цена и пример разбора. Второй реализации
 * воронки не заводим: расхождение между «коротким» и «длинным» входом
 * означало бы, что правку надо вносить дважды, и однажды её внесут один раз.
 */
export default function CheckPage() {
  return <CheckFunnel />;
}

export function CheckFunnel({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState("");
  const [checkId, setCheckId] = useState<string | null>(null);
  const [result, setResult] = useState<MiniCheckResult>({});
  const [checkDomain, setCheckDomain] = useState("");
  const [startErr, setStartErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  // Состав галочек — строго по инструкции юриста: обязательное согласие на
  // обработку ПД и ОТДЕЛЬНОЕ необязательное на рекламные рассылки. Оферты
  // в инструкции нет, и добавлять её сюда не нужно: договор принимается на
  // этапе оплаты, а не при выдаче бесплатного разбора.
  // Контакт, уже оставленный на /geo: показываем его маской и не просим
  // вводить второй раз.
  const [knownEmail, setKnownEmail] = useState<string | null>(null);
  const [tgSubmitting, setTgSubmitting] = useState(false);
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
        body: JSON.stringify({ url: u, utm: readAttribution() }),
      });
      const j = await readJson(r);
      if (!j.ok) throw new Error(j.error || "Не удалось запустить проверку");
      // Новая проверка — новая воронка. Без этого сброса состояние прошлого
      // разбора переживало смену адреса: человек вводил другой сайт, видел
      // корректные проверки и рядом «Полный разбор готов» с кнопкой на ЧУЖОЙ
      // документ, хотя почту в этот раз не оставлял.
      setKpState("idle");
      setKpUrl(null);
      setKnownEmail(null);
      setLeadErr(null);
      setResult({});
      setCheckId(String(j.id));
      reach("mini_check_start");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e) {
      setStartErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setStarting(false);
    }
  }, [url]);

  // Адрес из ?url= — /geo уводит сюда уже введённым доменом. Без этого
  // человек, набравший сайт на предыдущей странице, попадал на пустое поле
  // и вводил его второй раз: потерянный шаг ровно там, где он уже согласился.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    const raw = new URLSearchParams(window.location.search).get("url");
    if (!raw) return;
    autoStarted.current = true;
    setUrl(raw);
  }, []);
  // Замер запускаем отдельным эффектом — после того, как url реально попал
  // в состояние: start() читает именно его.
  useEffect(() => {
    if (!autoStarted.current || checkId || starting || !url.trim()) return;
    void start();
    // start пересоздаётся вместе с url; повторный запуск отсекается checkId.
  }, [url, checkId, starting, start]);

  // Поллинг мини-проверки: пробы дорисовываются по мере готовности.
  useEffect(() => {
    if (!checkId) return;
    let stop = false;
    const tick = async () => {
      const j = await fetch(`/api/mini-check?id=${checkId}`).then(r => r.json()).catch(() => null);
      if (stop || !j?.ok) return;
      setResult(j.result ?? {});
      setCheckDomain(j.domain ?? "");
      if (j.emailMasked) setKnownEmail(j.emailMasked);
      if (j.status === "done") return;
      setTimeout(tick, 3000);
    };
    void tick();
    return () => { stop = true; };
  }, [checkId]);

  // Вторая дверь: разбор в Telegram. Часть аудитории охотнее нажмёт её,
  // чем оставит почту, — механика бота уже была, входа с лендинга не было.
  const submitTg = useCallback(async () => {
    if (!checkId) return;
    setLeadErr(null); setTgSubmitting(true);
    try {
      const r = await fetch("/api/mini-check/lead-tg", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: checkId, consent }),
      });
      const j = await readJson(r);
      if (!j.ok) throw new Error(j.error || "Не получилось — попробуйте ещё раз");
      reach("mini_check_lead_tg");
      window.open(j.tgConnectUrl, "_blank", "noopener,noreferrer");
      setKpState("queued");
    } catch (e) {
      setLeadErr(e instanceof Error ? e.message : "Ошибка");
    } finally { setTgSubmitting(false); }
  }, [checkId, consent]);

  const submitLead = useCallback(async () => {
    if (!checkId) return;
    setLeadErr(null);
    try {
      const r = await fetch("/api/mini-check/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: checkId, email: email.trim(), consent, marketing }),
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
  }, [checkId, email, consent, marketing]);

  useReveal();

  const sem = result.semantics;
  const spd = result.speed;
  const rd = result.readability;
  const readyProbes = [sem, spd, rd].filter(p => p && p.status !== "pending").length;

  // Заголовок CTA из собственной цифры посетителя. Порядок веток — по силе
  // аргумента: сначала перехваченный конкурентами спрос, потом закрытость от
  // ассистентов, потом скорость. Если ни одна цифра не посчиталась —
  // возвращаем null, и остаётся нейтральный текст: выдумывать число нельзя.
  const demandHeadline: string | null = (() => {
    const demand = sem?.status === "done" && !sem.empty ? sem.demandNearby ?? 0 : 0;
    if (demand >= 10_000) {
      return `Рядом с вами ${fmtFreq(demand).replace(" запросов/мес", " запросов в месяц")} — покажем, как забрать эту часть себе`;
    }
    // Малый сайт: спрос рядом невелик, зато собственная видимость почти
    // нулевая — и это аргумент сильнее любой абстракции. Без этой ветки
    // большинство посетителей (сайты с единичными запросами) видели
    // нейтральный текст, то есть персонализация не срабатывала там, где
    // она нужнее всего.
    const visible = sem?.status === "done" && !sem.empty ? sem.visibleCount ?? 0 : -1;
    if (visible >= 0 && visible < 50) {
      return `Вас находят всего по ${visible} ${visible === 1 ? "запросу" : "запросам"} — покажем, по каким должны и как туда попасть`;
    }
    if (rd?.status === "done" && rd.access === "blocked") {
      return "Ваш сайт закрыт от ассистентов — покажем, что чинить в первый месяц";
    }
    if (spd?.status === "done" && (spd.performance ?? 100) < 50) {
      return `Скорость ${spd.performance}/100 — покажем, сколько заявок это стоит и как исправить`;
    }
    return null;
  })();

  return (
    <div className="mrc-root">
      <style>{CSS}</style>

      {/* ─── Первый экран: чернильная плита, вопрос-боль и живой пример ─── */}
      <section className="mrc-slab mrc-hero">
        <div className="mrc-wrap">
          <header className="mrc-topbar">
            <a href="/" className="mrc-wordmark" aria-label="MarketRadar24">
              <RadarMark />
              <span aria-hidden="true">Market<b>Radar24</b></span>
            </a>
            <span className="mrc-mono mrc-topbar-tag">проверка сайта · 0 ₽</span>
          </header>

          <div className="mrc-hero-grid">
            <div className="mrc-hero-head">
              {/* Прежний заголовок «Почему ваш сайт не приносит заявки?» был
                  слишком широким: он собирал клики со всей темы «мало заявок»,
                  включая тех, кому нужна реклама, отдел продаж или новый сайт,
                  — и лид из этого не получался. Боль осталась, но ушла в
                  надзаголовок, а H1 сразу называет услугу и тем отсекает не
                  нашу аудиторию до клика. */}
              <div className="mrc-mono mrc-eyebrow">
                <span className="mrc-dot" aria-hidden="true" />
                сайт есть, а заявок из поиска нет
              </div>
              <h1 className="mrc-h1">
                Продвижение<br />
                <span className="mrc-grad">в нейросетях и поисковиках</span>
              </h1>
              <p className="mrc-lead mrc-hero-lead">
                Клиент спрашивает «кого посоветуете» — у Яндекса или у нейросети — и получает
                два-три имени. Если вас там нет, заявок не будет, каким бы хорошим ни был сайт.
                Начинаем с бесплатной проверки: покажем, находят ли вас в Яндексе, называют ли
                нейросети — и что этому мешает.
              </p>
            </div>

            <div className="mrc-hero-scene">
              <SerpCollage slot="ваш сайт" kinds={["alice","ya","chatgpt"]} />
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
        {/* ─── Зачем это вообще: боль до объяснения услуги ──────────────────
             Человек с рекламы знает, что заявок нет, но не знает, при чём тут
             нейросети: «видимость в нейросетях» для него пустой звук. Поэтому
             до разговора о работе объясняем, что изменилось в поведении его
             же клиента. Без этого блока следующая секция читается как продажа
             непонятно чего. */}
        {compact && !checkId && (
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="01"
              title="Что изменилось у ваших клиентов"
              sub="Раньше человек листал десять ссылок и выбирал сам. Теперь чаще спрашивает и получает готовый короткий ответ."
            />
            <div className="mrcn-pain">
              {[
                {
                  t: "Ответ один, имён — два-три",
                  d: "Ассистент не показывает список из десяти сайтов. Он отвечает абзацем и называет одну-три компании. Всё, что не попало в этот абзац, клиент не увидит вовсе.",
                },
                {
                  t: "Вас не сравнили — вас не было",
                  d: "Это не проигрыш в сравнении цен или условий. Если сайт нечитаем для ассистента, вы просто не попадаете в список кандидатов, и хороший сайт тут не спасает.",
                },
                {
                  t: "Поиск никуда не делся",
                  d: "Часть клиентов по-прежнему идёт в Яндекс. Поэтому работать надо и там, и там: это одни и те же страницы, но требования к ним разные.",
                },
                {
                  t: "Берут то, что можно процитировать",
                  d: "В ответ попадают сайты, где услуги и цены написаны словами, а не картинкой, и подтверждены отзывами и упоминаниями снаружи. Это и есть то, что чинится в первый месяц.",
                },
              ].map(x => (
                <article key={x.t} className="mrcn-pain-item">
                  <h3 className="mrcn-pain-t">{x.t}</h3>
                  <p className="mrcn-pain-d">{x.d}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ─── Маршрут: что будет после проверки ───────────────────────────
            Человек с рекламы не знает, чем всё закончится, и это тормозит
            ввод адреса. Показываем три шага сразу: бесплатная проверка →
            разбор на этой же странице → полное предложение по email.
            Текущий шаг подсвечивается, пройденный гаснет. */}
        {!checkId && (
          <ol className="mrc-route" aria-label="Как это работает">
            {/* Маршрут — не «что мы умеем», а порядок работы. Человек пришёл
                за продвижением, и ему надо сразу видеть, зачем начинать
                с проверки: без неё неизвестно, на каком уровне сайт и что
                чинить в первую очередь. Поэтому шаги названы как ступени
                одной услуги, а не как отдельные продукты. */}
            {[
              ["Проверка", "Вводите адрес — считаем три показателя и показываем, видно ли вас в поиске и в ответах нейросетей. Бесплатно, без регистрации."],
              ["Оптимизация", "Первый месяц: чиним то, из-за чего вас не берут в выдачу и в ответы ассистентов. 25 000 ₽."],
              ["Продвижение", "Дальше ежемесячно: наращиваем видимость в поиске и в нейросетях. От 25 000 ₽ в месяц."],
            ].map(([t, d], i) => (
              <li key={t} className={`mrc-route-step${i === 0 ? " is-now" : ""}`}>
                <span className="mrc-route-dot" aria-hidden="true" />
                <span className="mrc-route-t">{t}</span>
                <span className="mrc-route-d">{d}</span>
              </li>
            ))}
          </ol>
        )}

        {/* ─── Что проверяем — лист приборов, пока проверка не запущена ─── */}
        {!checkId && (
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx={compact ? "02" : "00"}
              title="С чего начинается продвижение"
              sub="Три проверки: по ним видно, где вас теряют и что чинить в первую очередь."
            />
            <ol className="mrc-instr-list">
              {[
                ["01", "Видимость в поиске", "По скольким запросам вас находят в Яндексе и Google — и какой спрос ниши достаётся конкурентам."],
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
                <div className="mrc-mono mrc-readout-label">экспресс-аудит сайта</div>
                <h2 className="mrc-h2 mrc-readout-domain">{checkDomain || "ваш сайт"}</h2>
              </div>
              <ProgressMeter ready={readyProbes} total={3} />
            </div>

            <div className="mrc-probes">
              <ProbeCard
                idx="01"
                title="Видимость в поиске"
                icon="eye"
                probe={sem?.status}
                tone={sem?.status === "done" ? (sem.empty ? "warn" : semTone(sem.visibleCount ?? 0)) : undefined}
                render={() => sem?.status === "done" ? <SemanticsVerdict s={sem} /> : <ProbeFail what="видимость" />}
              />
              <ProbeCard
                idx="02"
                title="Скорость на телефоне"
                icon="speed"
                probe={spd?.status}
                tone={spd?.status === "done" ? (spd.performance == null ? "warn" : spdTone(spd.performance)) : undefined}
                pendingNote="Google Lighthouse грузит ваш сайт по-настоящему: обычно до минуты, на тяжёлых сайтах дольше"
                render={() => spd?.status === "done" ? <SpeedVerdict s={spd} /> : <ProbeFail what="скорость" />}
              />
              <ProbeCard
                idx="03"
                title="Читаемость для нейросетей"
                icon="bot"
                probe={rd?.status}
                tone={rd?.status === "done" ? (rd.access && rd.access !== "ok" ? (rd.access === "blocked" ? "bad" : "warn") : rdTone(rd.checksPassed ?? 0)) : undefined}
                render={() => rd?.status === "done" ? <ReadabilityVerdict s={rd} /> : <ProbeFail what="читаемость" />}
              />
            </div>

            {/* ─── CTA: полный разбор за email ─── */}
            {readyProbes >= 2 && (
              <div className="mrc-lead-card">
                {kpState === "idle" && (
                  <>
                    <div className="mrc-mono mrc-kicker">следующий шаг</div>
                    {/* Заголовок берёт цифру из ЭТОЙ проверки. Абстрактное
                        «получите полный разбор» под карточкой, где только что
                        назван спрос ниши, слабее собственного числа человека:
                        сумма уже посчитана, осталось сказать, кому она уходит. */}
                    <div className="mrc-h3 mrc-h3-lg">
                      {demandHeadline ?? "Это только проверка. Дальше — план продвижения, тоже бесплатно"}
                    </div>
                    <p className="mrc-body mrc-lead-card-text">
                      Три проверки выше показали <b>симптомы</b>. Разбор — это уже план работ:
                      <b> кто забирает ваш спрос, по каким запросам и что нужно сделать в первый
                      месяц</b>, чтобы вас начали находить и называть. С него начинается
                      продвижение — по нему видно, за что вы платите и в каком порядке.
                    </p>
                    {/* Раньше здесь был абзац перечислением через запятую: он
                        читался как «ещё немного текста» и не давал понять, за
                        что человек отдаёт почту. Разложено по пунктам — с
                        иконкой и конкретикой, что именно он получит. */}
                    <ul className="mrc-gets">
                      {[
                        ["rival", "Конкуренты поимённо", "Кто стоит выше вас и по каким запросам — списком, с адресами страниц, а не «ваши конкуренты сильнее»."],
                        ["search", "Запросы, которых у вас нет", "Спрос ниши, который сейчас целиком достаётся другим: что искать и куда это ставить на сайте."],
                        ["bot", "Видимость в нейросетях", "Что отвечают Алиса, ChatGPT и Google AI на вопросы ваших клиентов — и почему вас там нет."],
                        ["gear", "Технические находки", "Каждая — с доказательством: адрес страницы, что не так и что это стоит в обращениях."],
                        ["money", "Прогноз по каналам", "Сколько обращений реально добавляет каждый канал и через какой срок. Без обещаний «топ-1 за месяц»."],
                        ["doc", "План работ с ценами", "Что делаем в первый месяц, что дальше, сколько стоит. Цифры, а не «рассчитывается индивидуально»."],
                      ].map(([ic, t, d]) => (
                        <li key={t}>
                          <span className="mrc-gets-ico" aria-hidden="true"><Icon name={ic as IconName} /></span>
                          <span className="mrc-gets-t">{t}</span>
                          <span className="mrc-gets-d">{d}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mrc-gets-foot">
                      <span className="mrc-gets-price">0 ₽</span>
                      <span>
                        Собирается 2–3 минуты, приходит на почту, открывается по ссылке.
                        Без звонка менеджера и без карты — платить не за что.
                      </span>
                    </div>
                    <div className="mrc-form-row">
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={knownEmail ? `${knownEmail} — можно изменить` : "Ваш email"}
                        inputMode="email"
                        aria-label="Ваш email"
                        className="mrc-input"
                      />
                      <button
                        onClick={() => void submitLead()}
                        disabled={!consent}
                        className="mrc-btn mrc-btn-primary"
                      >
                        {knownEmail && !email.trim() ? "Прислать разбор" : "Получить полный разбор"}
                      </button>
                    </div>
                    {/* Вторая дверь. Ставим её равноправно, а не мелкой
                        ссылкой: для части аудитории Telegram — не «запасной
                        вариант», а единственный, на который они согласны. */}
                    <div className="mrc-alt-door">
                      <span className="mrc-note">или без почты:</span>
                      <button
                        type="button"
                        onClick={() => void submitTg()}
                        disabled={!consent || tgSubmitting}
                        className="mrc-btn mrc-btn-ghost"
                      >
                        {tgSubmitting ? "Открываем…" : "Получить разбор в Telegram"}
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
                    {/* Рекламное согласие — ОТДЕЛЬНОЕ и необязательное.
                        По инструкции у человека должна остаться возможность
                        не ставить эту галочку и всё равно получить услугу,
                        поэтому кнопку она не блокирует. Без неё дожим шлёт
                        только сервисное письмо про заказанный разбор. */}
                    <label className="mrc-consent">
                      <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)}
                        className="mrc-checkbox" />
                      <span>
                        Даю{" "}
                        <a href="/legal/consent-marketing" target="_blank" rel="noopener noreferrer">согласие</a>{" "}
                        на получение рекламных и маркетинговых рассылок — необязательно
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

        {/* ─── 01 · Где чаще всего теряются заявки ─── */}
        {!compact && (
        <section className="mrc-sec" data-reveal>
          <SecHead
            idx="01"
            title="Где чаще всего теряются заявки"
            sub="Заявка редко теряется на сайте. Чаще она вообще до него не доходит — человек принимает решение раньше."
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

          {/* Мокап выдачи: та же цепочка, но показанная глазами клиента */}
          <SerpMock
            query="сколько стоит и где заказать — москва"
            note="Первую страницу занимают те, у кого описаны услуги и цены. Вас на ней нет — сравнивать не с чем."
          />

          <p className="mrc-note">
            Сайт при этом может быть отличным. Его просто не показали.
          </p>

          {/* Точка действия в середине страницы: до нижнего CTA долистывают
              не все, а решение часто созревает именно здесь — после того,
              как человек увидел, куда уходят его заявки. */}
          <div className="mrc-midcta">
            <div>
              <div className="mrc-midcta-t">Проверим, где теряются ваши заявки</div>
              <div className="mrc-midcta-d">Три проверки по вашему сайту — бесплатно, без звонка, результат на этой же странице.</div>
            </div>
            <button
              type="button"
              className="mrc-btn mrc-btn-primary"
              onClick={() => document.querySelector<HTMLInputElement>("input[inputmode=url]")?.focus()}
            >
              Проверить сайт
            </button>
          </div>
        </section>
        )}
      </div>

      {/* ─── 02 · SEO и GEO — чернильный разворот ─── */}
      {!compact && (
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
      )}

      <div className="mrc-wrap">
        {/* ─── 03 · Что мы делаем ─── */}
        {!compact && (
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
        )}

        {/* ─── 04 · Что получает клиент ─── */}
        {!compact && (
        <section className="mrc-sec" data-reveal>
          <SecHead
            idx="04"
            title="Что получает клиент"
            sub="Полный разбор — это документ, по которому можно работать: со ссылками, цифрами и ценами."
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

          {/* Ценовой якорь. До него на странице не было ни одной цифры денег:
              человек шёл до самого КП, не понимая порядка сумм, и часть
              отваливалась уже внутри документа — там, где это стоило нам
              генерации. Названная заранее вилка отсеивает не тех раньше и
              снимает главный молчаливый вопрос «сколько это стоит». */}
          <div className="mrc-anchor">
            <div>
              <div className="mrc-mono mrc-who-label">сколько это стоит</div>
              <p className="mrc-body" style={{ margin: "8px 0 0" }}>
                Диагностика и разбор — <b>0 ₽</b>. Работа по устранению найденного —
                <b> от 25 000 ₽ в месяц</b>: техника сайта, контент, внешние упоминания и
                репутация ведутся вместе, по одному счёту. Точная сумма — в разборе, после
                того как понятно, что именно чинить.
              </p>
            </div>
            <div className="mrc-anchor-fig">
              <div className="mrc-anchor-num">0 ₽</div>
              <div className="mrc-note">разбор</div>
            </div>
          </div>
        </section>
        )}

        {/* ─── 05 · Разбираем частые обещания ───
             На короткой посадочной блока нет: он длинный, а место на одном-двух
             экранах дороже. Остаётся на /new2, где есть развёрнутая аргументация. */}
        {!compact && (
        <section className="mrc-sec" data-reveal>
          {/* В компактном режиме разделов 01-04 нет, и «05» читался бы как
              пропуск четырёх глав. Нумерация идёт по тому, что видно. */}
          <SecHead
            idx="05"
            title="Разбираем частые обещания"
            sub="Три фразы, которые чаще всего слышат от подрядчиков. Ни одна из них невыполнима — показываем, почему и что стоит за ней на самом деле."
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
        )}
        {/* ─── Компактный режим: то, без чего мини-лендинг терять нельзя ───
             Цена — единственная цифра денег на странице: без неё человек идёт
             до самого разбора, не понимая порядка сумм. Пример разбора —
             единственное доказательство, что документ существует. Оба блока
             взяты из полных разделов 04 и 06 без изменений, чтобы короткий и
             длинный вход говорили одно и то же. */}
        {compact && (
          <section className="mrc-sec" data-reveal>
            <SecHead
              idx="03"
              title="Сколько это стоит"
              sub="Три ступени одной услуги. Платить со второй — и только если после первой вы решите продолжать."
            />
            {/* Раньше здесь стоял абзац сплошного текста: три суммы вперемешку
                со словами не читались вовсе. Стадии разнесены по плашкам —
                сразу видно, что бесплатно, что разово и что ежемесячно. */}
            <div className="mrcn-tiers">
              {TIERS.map(t => (
                <article key={t.name} className={t.accent ? "mrcn-tier is-accent" : "mrcn-tier"}>
                  <div className="mrc-mono mrcn-tier-stage">{t.stage}</div>
                  <h3 className="mrcn-tier-name">{t.name}</h3>
                  <div className="mrcn-tier-price">{t.price}</div>
                  <div className="mrc-mono mrcn-tier-unit">{t.unit}</div>
                  <ul className="mrcn-tier-list">
                    {t.items.map(i => <li key={i}>{i}</li>)}
                  </ul>
                </article>
              ))}
            </div>
            <p className="mrc-note" style={{ marginTop: 16 }}>
              Точная сумма по шагам 2 и 3 — в разборе, после того как понятно, что именно чинить.
            </p>
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
        )}

        {/* ─── 06 · Кто исполнитель ───
             Блок появился после разбора лендинга: единственным контактом был
             адрес почты, реквизитов не было вовсе. Человек с рекламы не должен
             гадать, кому он собирается платить. */}
        {!compact && (
        <section className="mrc-sec" data-reveal>
          <SecHead
            idx="06"
            title="Кто это делает"
            sub="Договор — публичная оферта, оплата по счёту, документы закрывающие."
          />
          <div className="mrc-who">
            {/* Здесь — бренд и суть работы. Юр.реквизиты (ИП, ИНН, ОГРНИП,
                адрес) ушли в футер: в середине страницы они холодят и читаются
                как бухгалтерия, а внизу выполняют ровно свою задачу —
                показать, что за сайтом стоит зарегистрированное лицо. */}
            <article className="mrc-who-card">
              <div className="mrc-mono mrc-who-label">исполнитель</div>
              <div className="mrc-who-name">MarketRadar</div>
              <p className="mrc-who-about">
                Команда, которая делает и саму платформу анализа, и работы по её находкам.
                Не перепродаём подряд: техника сайта, контент, внешние упоминания и репутация —
                внутри одной команды, один счёт и один ответственный.
              </p>
              <p className="mrc-who-about">
                Работаем по договору, оплата по счёту, документы закрывающие. Реквизиты — в подвале страницы.
              </p>
            </article>
            <article className="mrc-who-card">
              <div className="mrc-mono mrc-who-label">связь</div>
              <ul className="mrc-who-links">
                <li><a href={`mailto:${VENDOR_PUBLIC.email}`}>{VENDOR_PUBLIC.email}</a></li>
                <li><a href={VENDOR_PUBLIC.telegram} target="_blank" rel="noopener noreferrer">Telegram — {VENDOR_PUBLIC.telegramLabel}</a></li>
                {VENDOR_PUBLIC.phone && <li><a href={`tel:${VENDOR_PUBLIC.phone.replace(/[^+d]/g, "")}`}>{VENDOR_PUBLIC.phone}</a></li>}
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
        )}
      </div>

      {/* ─── Финальный CTA: тот же ответ, но пропуск подписан вашим доменом ─── */}
      <section className="mrc-slab mrc-final" data-reveal>
        <div className="mrc-wrap mrc-final-grid">
          <div>
            <div className="mrc-mono mrc-kicker">проверка сайта</div>
            <h2 className="mrc-h2">Продвижение начинается<br />с одной проверки</h2>
            <p className="mrc-lead">
              Введите адрес — и через минуту увидите, находят ли вас в поиске и называют ли
              нейросети. Дальше покажем, что чинить в первый месяц и как двигаться потом.
            </p>
            <UrlForm
              id="final"
              url={url} setUrl={setUrl} starting={starting} onStart={start}
              error={startErr}
              note="Бесплатно, без регистрации и без звонка менеджера."
            />
          </div>
          <div className="mrc-final-scene">
            <AnswerScene compact />
          </div>
        </div>
      </section>
      </main>

      <footer className="mrc-footer">
        <div className="mrc-wrap mrc-footer-inner">
          {/* Полные реквизиты живут здесь — их место в подвале, а не в
              середине страницы, где они сбивают темп чтения. */}
          <span className="mrc-foot-legal">
            {VENDOR_PUBLIC.legalName} · ИНН {VENDOR_PUBLIC.inn} · ОГРНИП {VENDOR_PUBLIC.ogrn}
            <br />{VENDOR_PUBLIC.address}
          </span>
          <nav className="mrc-footer-nav">
            <a href={`mailto:${VENDOR_PUBLIC.email}`}>{VENDOR_PUBLIC.email}</a>
            <a href="/legal/offer">Оферта</a>
            <a href="/legal/privacy">Политика обработки персональных данных</a>
            <a href="/legal/consent-pd">Согласие на обработку данных</a>
            <a href="/competitors">Анализ конкурентов</a>
            <a href="/">О платформе</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ─── Signature-приём: та же проверка, прогнанная на себе ─────────────────
   Раньше здесь стояла иллюстрация с вымышленными «Конкурентом А/Б» и любым
   доменом, который человек успел набрать в поле, — то есть сцена делала
   утверждение про конкретный настоящий сайт, ничего о нём на самом деле не
   проверив. Заменено на честный вариант: прогнали ровно тот же замер на
   marketradar24.ru и показываем реальный результат — вопрос и ответ взяты
   из настоящего разбора нашего сайта (ссылка на него — в блоке «как выглядит
   разбор» выше), значения не меняли. */

/**
 * Ассистенты со знаком-меткой и своим цветом.
 *
 * Глифы НАРОЧНО абстрактные, а не копии настоящих логотипов: чужие
 * товарные знаки в своей рекламе не размещаем. Каждому — узнаваемая
 * геометрия и цвет из палитры продакшена, чтобы ряд читался визуально,
 * а не как пять одинаковых серых пилюль.
 */
const DEMO_ASKERS: AiKey[] = ["alice", "chatgpt", "claude", "perplexity", "gigachat"];

function AnswerScene({ compact }: { compact?: boolean }) {
  return (
    <figure className={`mrc-ans${compact ? " is-compact" : ""}`}>
      <figcaption className="mrc-mono mrc-ans-cap">
        <span className="mrc-ans-live" aria-hidden="true" />
        не пример — наша собственная проверка, marketradar24.ru
      </figcaption>

      <div className="mrc-ans-q">
        <span className="mrc-mono mrc-ans-qlabel">спросили у ассистента</span>
        <p className="mrc-ans-qtext">
          «Что такое MarketRadar24 и чем он занимается?»
        </p>
      </div>

      <div className="mrc-ans-body">
        <p className="mrc-ans-text">
          Ответ был верным по фактам, но общим: сервис для{" "}
          <mark className="mrc-name">анализа бизнеса и конкурентов</mark>, без единой
          конкретной детали — ни того, что реально отличает нас от других инструментов
          в нише, ни примера работы.
        </p>
        <div className="mrc-slot">
          <span className="mrc-slot-box" title="узнаваемость в базах знаний ассистентов">
            присутствие в знаниях ассистента: минимальное
          </span>
          <span className="mrc-mono mrc-slot-note">такой же замер — и для вашего сайта</span>
        </div>
      </div>

      {!compact && (
        <div className="mrc-ans-foot">
          <span className="mrc-mono mrc-ans-footlabel">проверяем видимость у</span>
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
            <span className="mrc-serp-empty-t">Вашего сайта по данному запросу нет</span>
            <span className="mrc-serp-empty-d">{note}</span>
          </div>
        </li>
      </ol>
    </figure>
  );
}

/* Приборная панель слоёв. Значения условные и подписаны как схема: они
   иллюстрируют правило «итог равен самому слабому слою», а не проверку сайта. */
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
    points: ["адрес конкретной страницы", "цифра или выдержка из выдачи", "что именно это стоит вам в заявках"],
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
    truth: "Позиций в ответах нейросети не существует в принципе: ответ собирается заново под каждую формулировку вопроса и меняется от запроса к запросу. Гарантировать место в нём не может никто — ни мы, ни те, кто это обещает. Повысить шансы попасть в ответ можно, и это измеримая работа.",
  },
  {
    claim: "Результат с первой недели",
    truth: "Первые изменения видны через 1–3 месяца — и это не наша осторожность, а сроки самих площадок: роботам нужно заново обойти сайт, публикациям разойтись, отзывам накопиться. Обещание недели означает, что подрядчик рассчитывает на ваше терпение до первой отчётной встречи.",
  },
  {
    claim: "Уйдёте — всё останется у нас",
    truth: "Так бывает, когда работы ведут на своих аккаунтах и площадках: при расставании всё выключается вместе с договором. Спрашивайте об этом до старта. У нас тексты, статьи, разметка, доступы и аккаунты — ваши с первого дня.",
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
    <div className="mrc-meter" aria-label={`Готово проверок: ${ready} из ${total}`}>
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

function ProbeCard({ idx, title, icon, probe, tone, pendingNote, render }: {
  idx: string; title: string; icon: IconName; probe?: "pending" | "done" | "failed"; tone?: Tone; pendingNote?: string;
  render: () => React.ReactNode;
}) {
  const pending = !probe || probe === "pending";
  const status = pending ? "проверяем…" : probe === "done" ? "готово" : "нет данных";
  // Пробы без результата не красим в бренд: серый = «данных нет», а не «всё хорошо».
  const accent = pending ? "var(--rule)" : probe === "failed" ? "var(--soft)" : toneColor(tone);
  return (
    <article className="mrc-probe">
      <span className="mrc-probe-rail" style={{ background: accent }} aria-hidden="true" />
      <div className="mrc-probe-head">
        {/* Иконка вместо голого номера: карточка должна читаться с одного
            взгляда, а «01/02/03» не говорит, о чём проверка. Номер остаётся
            рядом — по нему удобно ссылаться в разговоре с менеджером. */}
        <span className="mrc-probe-ico" style={{ color: accent }} aria-hidden="true"><Icon name={icon} /></span>
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
  return <div className="mrc-note">Не удалось проверить {what} автоматически — войдёт в полный разбор.</div>;
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

  // Пусто по разным причинам — и вердикты разные. Выдать «вас почти не видно»
  // домену, которого нет в базе или который не отвечает, — прямая ложь.
  if (n === 0 && s.empty === "unreachable") {
    return <Verdict tone="warn" headline="Домен не отвечает" details={
      <div className="mrc-verdict-body">
        Мы не смогли достучаться до сайта — он не резолвится или лежит. Проверьте адрес:
        видимость в поиске меряется только у работающего домена.
      </div>
    } />;
  }
  if (n === 0 && s.empty === "no-data") {
    return <Verdict tone="warn" headline="Домена нет в базе видимости" details={
      <div className="mrc-verdict-body">
        Это не приговор: база видимости собирает домены, попавшие в топ-50 Яндекса хотя бы по одному
        запросу, и молодые или узкие сайты в неё не входят. Но означает это одно — заметных
        позиций у вас пока нет. Полный разбор считает видимость по другим источникам.
      </div>
    } />;
  }

  const tone = semTone(n);
  const headline =
    n < 50 ? `Вас почти не видно: всего ${cap} запросов в Яндексе` :
    n < 300 ? `Видимость слабая: ${cap} запросов — у лидеров ниш сотни и тысячи` :
    `База есть: вас видно по ${cap} запросам`;
  return (
    <Verdict tone={tone} headline={headline} details={
      <>
      <div className="mrc-verdict-body">
        {s.top && s.top.length > 0 ? (
          <>
            Главные запросы, по которым вас находят:{" "}
            {s.top.slice(0, 3).map(t => `«${t.keyword}» (позиция #${t.position}, спрос ${fmtFreq(t.freq)})`).join(", ")}.
            {" "}
            {/* Широкая частотность Wordstat: все словоформы и
                все фразы со словом, а не показы одной этой фразы. Подать их как
                «показов/мес» значит завысить в разы — специалист это заметит
                первым, и вместе с доверием уйдут остальные цифры. */}
            {/* Источник данных подписан прямо здесь. Позиция — не наш живой
                съём выдачи: это состояние базы видимости на момент её
                последнего обхода. Подать её как «сейчас» — та же ошибка, что
                выдать широкую частотность за показы. */}
            <span className="mrc-note">
              Спрос — широкая частотность Wordstat: сумма всех фраз со словом, а не показы
              одной этой фразы. Позиции — по базе видимости (топ-50 Яндекса, Москва) на момент
              её последнего обхода, а не живой съём выдачи. Точную частотность, актуальные
              позиции и разбивку по интенту считаем в полном разборе.
            </span>
            {" "}Кто забирает остальной спрос ниши — покажет полный разбор.
          </>
        ) : (
          <>Заметных запросов у домена не нашлось — спрос ниши целиком достаётся конкурентам. Полный разбор покажет, кому именно.</>
        )}
      </div>
      <Cost
        loss="По запросам, где вас нет, выбирают из тех, кто есть. Спрос никуда не девается — его просто делят без вас, каждый день."
        fix="Собираем семантику ниши и закрываем пробелы страницами и контентом под конкретные запросы."
      />
      </>
    } />
  );
}

/** Частотность словами: 6 716 684 → «6,7 млн запросов/мес». */
function fmtFreq(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} млн запросов/мес`;
  if (n >= 10_000) return `${Math.round(n / 1000)} тыс. запросов/мес`;
  return `${n.toLocaleString("ru-RU")} запросов/мес`;
}

/** Полоса 0–100 с зоной нормы: показывает не только балл, но и разрыв до неё. */
function SpeedScale({ value }: { value: number }) {
  const pct = Math.max(2, Math.min(100, value));
  // Двухшаговый рендер: сперва 0%, потом реальное значение — заполнение
  // и пин выезжают на месте вместо того, чтобы появиться сразу готовыми.
  // rAF, а не эффект без задержки: браузер должен успеть отрисовать нулевой
  // кадр, иначе CSS-transition нечего анимировать.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    // setTimeout, а не requestAnimationFrame: rAF не выполняется вовсе,
    // пока вкладка в фоне (открыли проверку и переключились в другую
    // вкладку, пока считается скорость) — анимация застряла бы на 0%
    // до возврата на вкладку. setTimeout тикает и в фоне.
    const id = setTimeout(() => setShown(pct), 20);
    return () => clearTimeout(id);
  }, [pct]);
  return (
    <div className="mrc-scale" role="img" aria-label={`${value} из 100, норма — от 90`}>
      <div className="mrc-scale-track">
        <span className="mrc-scale-zone is-bad" />
        <span className="mrc-scale-zone is-warn" />
        <span className="mrc-scale-zone is-ok" />
        <span className="mrc-scale-fill" style={{ width: `${shown}%` }} />
        <span className="mrc-scale-pin" style={{ left: `${shown}%` }}>
          <b>{value}</b>
        </span>
      </div>
      <div className="mrc-scale-legend">
        <span>0 · критично</span><span>50</span><span>90 · норма Google</span>
      </div>
    </div>
  );
}

function SpeedVerdict({ s }: { s: NonNullable<MiniCheckResult["speed"]> }) {
  if (s.unreachable) {
    return <Verdict tone="warn" headline="Сайт не ответил — мерить нечего" details={
      <div className="mrc-verdict-body">
        Домен не открылся, поэтому скорость проверить не удалось. Проверьте адрес.
      </div>
    } />;
  }
  // Lighthouse не ответил — показываем свою проверку и называем её своей.
  if (s.performance == null && s.fallback) {
    const sec = (s.fallback.ttfbMs / 1000).toFixed(1).replace(".", ",");
    const slow = s.fallback.ttfbMs > 1500;
    return <Verdict tone={slow ? "warn" : "ok"} headline={`Ответ сервера — ${sec} с`} details={
      <div className="mrc-verdict-body">
        Google Lighthouse сейчас не ответил, поэтому это наша собственная проверка: столько
        занял ответ сервера на первый запрос{s.fallback.htmlKb ? `, страница весит ${s.fallback.htmlKb} КБ` : ""}.
        Полная оценка скорости на телефоне войдёт в разбор.
      </div>
    } />;
  }

  const p = s.performance ?? 0;
  const tone = spdTone(p);
  const headline =
    p < 50 ? `Сайт медленный: ${p}/100 на телефоне` :
    p < 90 ? `Скорость средняя: ${p}/100 — конкуренты с быстрым сайтом впереди` :
    `Скорость в порядке: ${p}/100`;
  return (
    <Verdict tone={tone} headline={headline} details={
      <>
        <SpeedScale value={p} />
        <div className="mrc-verdict-body">
          {s.lcpDisplay && <>Главный контент появляется за {s.lcpDisplay} (норма Google — до 2,5{" "}с). </>}
          {p < 90 && <>Пока страница грузится, мобильный посетитель уходит к тем, у кого уже открылось.</>}
        </div>
        {/* «Что не так» без «и что теперь» — просто плохая новость. Каждая
            карточка обязана заканчиваться следствием: что это стоит в
            заявках и что с этим делают. */}
        {p < 90 && (
          <Cost
            loss="Каждая лишняя секунда загрузки на телефоне срезает часть обращений: человек закрывает вкладку до того, как увидел цены."
            fix="Ускорение — разовая работа с фиксированной ценой, результат виден сразу после выкатки."
          />
        )}
      </>
    } />
  );
}

/**
 * Строка следствия под вердиктом: чем находка оборачивается и что с ней
 * делают. Без неё экспресс-аудит читается как список претензий к сайту, а
 * не как повод что-то изменить.
 */
function Cost({ loss, fix }: { loss: string; fix: string }) {
  return (
    <div className="mrc-cost">
      <div className="mrc-cost-row is-loss">
        <span className="mrc-cost-ico" aria-hidden="true"><Icon name="absent" /></span>
        <span><b>Чем это стоит:</b> {loss}</span>
      </div>
      <div className="mrc-cost-row is-fix">
        <span className="mrc-cost-ico" aria-hidden="true"><Icon name="check" /></span>
        <span><b>Что делают:</b> {fix}</span>
      </div>
    </div>
  );
}

/** Строка «кого пускает robots.txt» — общая для обоих исходов пробы. */
function AiBotsLine({ bots }: { bots?: { name: string; rule: string }[] }) {
  if (!bots || bots.length === 0) return null;
  const blocked = bots.filter(b => b.rule === "blocked").map(b => b.name);
  const noRule = bots.filter(b => b.rule === "no-rule").length;
  return (
    <div className="mrc-verdict-body">
      {blocked.length > 0
        ? <>В robots.txt закрыт доступ для: {blocked.join(", ")}. Эти ассистенты не прочитают сайт вообще.</>
        : noRule === bots.length
          ? <>В robots.txt нет ни одного правила для краулеров ассистентов — ни разрешающего, ни запрещающего. По умолчанию это доступ, но управления попаданием в ответы у вас нет.</>
          : <>Краулеры ассистентов в robots.txt не заблокированы — доступ открыт.</>}
    </div>
  );
}

function ReadabilityVerdict({ s }: { s: NonNullable<MiniCheckResult["readability"]> }) {
  // Сайт не пустил нас — это не «нет данных», а находка: краулер ассистента
  // ходит таким же ботом и упрётся в ту же стену.
  if (s.access === "blocked") {
    return <Verdict tone="bad" headline={s.botStub ? "Сайт отдаёт ботам заглушку" : `Сайт закрыт от обходчиков (${s.httpStatus ?? "403"})`} details={
      <>
        <div className="mrc-verdict-body">
          {s.botStub
            ? <>Вместо страницы пришёл почти пустой ответ — так работает защита от ботов с JS-проверкой. Человек её проходит, краулер ассистента — нет: читать ему нечего.</>
            : <>Сервер ответил кодом {s.httpStatus} на обычный запрос. Краулеры ChatGPT, Claude и Яндекса ходят такими же ботами: если фильтр не разбирает, кого пускать, для них вашего сайта не существует.</>}
        </div>
        <AiBotsLine bots={s.aiBots} />
        <Cost
          loss="Пока сервер отдаёт краулерам отказ, вас не существует ни для одного ассистента — независимо от того, насколько хорош сайт."
          fix="Настраиваем фильтр так, чтобы он пускал краулеры ассистентов и продолжал резать вредных ботов."
        />
      </>
    } />;
  }
  if (s.access === "unreachable") {
    return <Verdict tone="warn" headline="Сайт не ответил" details={
      <div className="mrc-verdict-body">
        Страница не открылась за 15 секунд{s.httpStatus ? ` (код ${s.httpStatus})` : ""}. Проверьте адрес —
        либо сайт сейчас недоступен, и тогда его не видят ни люди, ни ассистенты.
      </div>
    } />;
  }

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
      details={<>
        {fails.length > 0 ? (
          <ul className="mrc-ul mrc-verdict-body">
            {fails.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        ) : (
          <div className="mrc-verdict-body">Базовая структура в порядке — вопрос в контенте и внешних сигналах.</div>
        )}
        <AiBotsLine bots={s.aiBots} />
        <Cost
          loss="Ассистент не может пересказать то, чего не прочитал: в ответе окажется конкурент, у которого услуги и цены размечены."
          fix="Размечаем услуги и цены по Schema.org, переписываем страницы так, чтобы ответ извлекался целиком."
        />
      </>}
    />
  );
}

/* ─── Иконки: один набор, 20×20, обводка currentColor ──────────────────── */

type IconName = "search" | "answer" | "absent" | "rival" | "out" | "gear" | "text" | "link" | "star"
  | "speed" | "bot" | "eye" | "clock" | "doc" | "money" | "shield" | "check";

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
    speed: <><path d="M10 17a7 7 0 1 1 7-7" /><path d="M10 10l4-3" /><circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" /></>,
    bot: <><rect x="3.5" y="6.5" width="13" height="9" rx="2.5" /><path d="M10 3.5v3" /><circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" /><circle cx="12.5" cy="11" r="1" fill="currentColor" stroke="none" /></>,
    eye: <><path d="M1.5 10S5 4.5 10 4.5 18.5 10 18.5 10 15 15.5 10 15.5 1.5 10 1.5 10Z" /><circle cx="10" cy="10" r="2.4" /></>,
    clock: <><circle cx="10" cy="10" r="7.5" /><path d="M10 5.5V10l3 2" /></>,
    doc: <><path d="M5 2.5h6.5L16 7v10.5H5z" /><path d="M11 2.5V7h5" /><path d="M7.5 11h6M7.5 14h4" /></>,
    money: <><rect x="2.5" y="5" width="15" height="10" rx="2" /><circle cx="10" cy="10" r="2.4" /></>,
    shield: <><path d="M10 2.5 16 5v5.2c0 3.4-2.4 6.1-6 7.3-3.6-1.2-6-3.9-6-7.3V5z" /><path d="m7.5 10 1.8 1.8L13 8" /></>,
    check: <><path d="m4 10.5 4 4L16 6" /></>,
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

/** Ступени услуги для блока «Сколько это стоит». Цены обязаны совпадать с
    PRICE_POLICY в src/lib/kp-generate.ts: расхождение между посадочной и
    разбором обнуляет доверие ко всем остальным числам в воронке. */
const TIERS: { stage: string; name: string; price: string; unit: string; accent?: boolean; items: string[] }[] = [
  {
    stage: "шаг 1", name: "Проверка и разбор", price: "0 ₽", unit: "бесплатно",
    items: [
      "Три показателя по вашему сайту",
      "Разбор с находками и планом работ",
      "Без звонка и без карты",
    ],
  },
  {
    stage: "шаг 2", name: "Оптимизация", price: "25 000 ₽", unit: "первый месяц, разово", accent: true,
    items: [
      "Чиним то, из-за чего вас не берут в выдачу и в ответы",
      "Услуги и цены — словами, которые ассистент может процитировать",
      "Техническая база под дальнейшее продвижение",
    ],
  },
  {
    stage: "шаг 3", name: "Продвижение", price: "от 25 000 ₽", unit: "в месяц",
    items: [
      "Наращиваем видимость в поиске и в нейросетях",
      "Контент, внешние упоминания и репутация",
      "Один счёт и один ответственный",
    ],
  },
];

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
/* Тёмная тема платформы — тот же графит на полтона глубже: страница остаётся
   собой, но не спорит с окружением кабинета. */
:root.dark .mrc-root { --mrc-ink: #f4f6f9; } /* лендинг светлый в любой теме приложения */

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
.mrc-lead { font-size: 20px; line-height: 1.6; color: var(--mrc-fg-mid); margin: 0; max-width: 58ch; }
.mrc-body { font-size: 16px; line-height: 1.6; color: var(--mrc-fg-mid); margin: 0; }
.mrc-note { font-size: 15px; line-height: 1.55; color: var(--soft); }
.mrc-err { color: var(--loss); font-size: 15px; margin-top: 10px; }
.mrc-kicker { color: var(--flare-use); margin-bottom: 10px; }
.mrc-ul { margin: 12px 0 0; padding-left: 0; list-style: none; }
.mrc-ul li {
  position: relative; padding-left: 17px; font-size: 15.5px; line-height: 1.6;
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
  font-family: var(--f-text); font-size: 14px; font-weight: 600;
  letter-spacing: 0.005em; text-transform: none;
  color: var(--mrc-green);
  border: 1px solid color-mix(in srgb, var(--mrc-green) 32%, transparent);
  background: color-mix(in srgb, var(--mrc-green) 8%, transparent);
}
.mrc-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--mrc-green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mrc-green) 22%, transparent);
}
.mrc-hero-lead { font-size: 19.5px; margin-bottom: 0; max-width: 46ch; }

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
  font-family: var(--f-mono); font-size: 14px; letter-spacing: 0.06em;
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
  border: 1px solid var(--rule); border-radius: 999px; padding: 6px 13px; font-size: 13px;
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
/* Вторая дверь (Telegram): контурная, чтобы не спорить с основной кнопкой,
   но полноразмерная — это равноправный путь, а не сноска. */
.mrc-btn-ghost {
  background: transparent; color: var(--mrc-fg);
  border-color: color-mix(in srgb, var(--flare-use) 45%, var(--rule));
  height: 46px; min-height: 46px; font-size: 14.5px;
}
.mrc-btn-ghost:hover:not(:disabled) {
  border-color: var(--flare-use);
  background: color-mix(in srgb, var(--flare-use) 7%, transparent);
}
.mrc-alt-door {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 14px;
}
.mrc-alt-door .mrc-note { margin: 0; }
@media (max-width: 700px) {
  .mrc-alt-door { flex-direction: column; align-items: stretch; gap: 8px; }
  .mrc-alt-door .mrc-btn { width: 100%; }
}
.mrc-btn:focus-visible, .mrc-input:focus-visible, .mrc-root a:focus-visible, .mrc-checkbox:focus-visible {
  outline: 2px solid var(--flare-use); outline-offset: 2px;
}
.mrc-formnote {
  color: var(--soft); margin-top: 14px; line-height: 1.5;
  text-transform: none; letter-spacing: 0.02em; font-size: 14px; max-width: 52ch;
}

/* ── Секции на бумаге ── */
.mrc-sec { position: relative; border-top: 1px solid var(--rule); padding: 44px 0 52px; }
.mrc-sec-head {
  display: grid; grid-template-columns: 128px minmax(0, 1fr); align-items: start;
  margin-bottom: 30px;
}
/* Номера разделов были контурными и полупрозрачными — «блёклыми».
   Теперь залиты фирменным градиентом первого экрана: маджента →
   фиолетовый → циан. Тот же приём, что у акцента в заголовке, поэтому
   страница читается одной системой, а не набором разных подсветок. */
.mrc-num {
  font-family: var(--f-display); font-size: clamp(48px, 5vw, 76px); font-weight: 800;
  line-height: 0.78; letter-spacing: -0.05em;
  background: linear-gradient(140deg, var(--mrc-magenta) 6%, var(--mrc-violet) 48%, var(--mrc-cyan) 96%);
  -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
}
/* Без background-clip: text — сплошной фиолетовый, а не прозрачная дыра. */
@supports not ((-webkit-background-clip: text) or (background-clip: text)) {
  .mrc-num { color: var(--mrc-violet); -webkit-text-fill-color: var(--mrc-violet); }
}
.mrc-sec-text { min-width: 0; }
.mrc-slab-sec .mrc-sec-head { margin-bottom: 30px; }


/* ── Иконка в шапке карточки аудита ── */
.mrc-probe-ico {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  border: 1px solid currentColor;
  background: color-mix(in srgb, currentColor 9%, transparent);
}

/* ── Шкала скорости: балл на фоне зон, а не голая цифра ──
   «66/100» ничего не сообщает человеку, который не работает с Lighthouse.
   Полоса показывает, где проходит норма и насколько он от неё далеко. */
.mrc-scale { margin: 4px 0 14px; }
.mrc-scale-track {
  position: relative; height: 12px; border-radius: 999px; overflow: visible;
  display: flex; isolation: isolate;
}
.mrc-scale-zone { height: 12px; }
.mrc-scale-zone:first-child { border-radius: 999px 0 0 999px; }
.mrc-scale-zone:nth-child(3) { border-radius: 0 999px 999px 0; }
.mrc-scale-zone.is-bad  { width: 50%; background: color-mix(in srgb, var(--loss) 22%, transparent); }
.mrc-scale-zone.is-warn { width: 40%; background: color-mix(in srgb, var(--mrc-amber) 24%, transparent); }
.mrc-scale-zone.is-ok   { width: 10%; background: color-mix(in srgb, var(--mrc-green) 26%, transparent); }
.mrc-scale-fill {
  position: absolute; left: 0; top: 0; height: 12px; border-radius: 999px;
  background: linear-gradient(90deg, var(--mrc-indigo-fg), var(--mrc-magenta));
  opacity: .92;
  transition: width 900ms cubic-bezier(.16,.84,.32,1);
}
.mrc-scale-pin {
  position: absolute; top: -8px; transform: translateX(-50%);
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 34px; height: 28px; padding: 0 8px; border-radius: 8px;
  background: var(--mrc-fg);
  /* Раньше здесь стоял var(--mrc-bg) — переменная нигде не определена, и
     число становилось невалидным computed-value: браузер откатывал color на
     initial (чёрный), то есть чёрные цифры на чёрной плашке. Белый — то,
     что и подразумевалось: тёмный чип с крупным светлым числом. */
  color: #fff;
  font-family: var(--f-mono); font-size: 13px; font-variant-numeric: tabular-nums;
  transition: left 900ms cubic-bezier(.16,.84,.32,1);
}
.mrc-scale-legend {
  display: flex; justify-content: space-between; margin-top: 14px;
  font-family: var(--f-mono); font-size: 12.5px; color: var(--soft);
}

/* ── Следствие находки: чем это стоит и что с этим делают ── */
.mrc-cost {
  margin-top: 14px; padding-top: 13px; border-top: 1px dashed var(--rule);
  display: grid; gap: 9px;
}
.mrc-cost-row {
  display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px;
  font-size: 15px; line-height: 1.55;
}
.mrc-cost-row.is-loss { color: var(--mrc-fg-mid); }
.mrc-cost-row.is-loss b { color: var(--loss); }
.mrc-cost-row.is-fix { color: var(--mrc-fg-mid); }
.mrc-cost-row.is-fix b { color: var(--mrc-green); }
.mrc-cost-ico { display: inline-flex; padding-top: 1px; }
.mrc-cost-ico svg { width: 18px; height: 18px; }
.mrc-cost-row.is-loss .mrc-cost-ico { color: var(--loss); }
.mrc-cost-row.is-fix .mrc-cost-ico { color: var(--mrc-green); }

/* ── Что даёт полный разбор ──
   Перечисление через запятую не отвечало на вопрос «за что я отдаю почту».
   Шесть карточек с иконкой и конкретикой отвечают. */
.mrc-gets {
  list-style: none; margin: 18px 0 0; padding: 0;
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
}
.mrc-gets li {
  display: grid; grid-template-columns: 34px minmax(0, 1fr); grid-template-rows: auto auto;
  column-gap: 12px; row-gap: 4px; align-items: start;
  padding: 15px 16px; border: 1px solid var(--rule); border-radius: 12px;
  background: var(--surface);
}
.mrc-gets-ico {
  grid-row: span 2; display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 9px; color: var(--flare-use);
  border: 1px solid color-mix(in srgb, var(--flare-use) 30%, transparent);
  background: color-mix(in srgb, var(--flare-use) 8%, transparent);
}
.mrc-gets-t { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
.mrc-gets-d { font-size: 14.5px; line-height: 1.5; color: var(--soft); }
.mrc-gets-foot {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  margin: 20px 0 26px; padding: 16px 18px; border-radius: 12px;
  border: 1.5px solid color-mix(in srgb, var(--mrc-green) 52%, transparent);
  background: color-mix(in srgb, var(--mrc-green) 13%, transparent);
  font-size: 15.5px; line-height: 1.5; color: var(--mrc-fg);
}
.mrc-gets-price {
  font-size: 30px; font-weight: 850; letter-spacing: -0.025em; color: var(--mrc-green);
  font-variant-numeric: tabular-nums; line-height: 1;
}
@media (max-width: 720px) {
  .mrc-gets { grid-template-columns: minmax(0, 1fr); }
}

/* ── Список проверок ── */
.mrc-anim [data-reveal] .mrc-instr-row { opacity: 0; transform: translateY(10px); transition: opacity 480ms var(--ease), transform 480ms var(--ease); }
.mrc-anim [data-reveal].is-in .mrc-instr-row { opacity: 1; transform: none; }
.mrc-anim [data-reveal].is-in .mrc-instr-row:nth-child(1) { transition-delay: 0ms; }
.mrc-anim [data-reveal].is-in .mrc-instr-row:nth-child(2) { transition-delay: 90ms; }
.mrc-anim [data-reveal].is-in .mrc-instr-row:nth-child(3) { transition-delay: 180ms; }
.mrc-instr-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule); }
.mrc-instr-row {
  display: grid; grid-template-columns: 128px minmax(0, 280px) minmax(0, 1fr);
  gap: 0 20px; align-items: baseline;
  padding: 20px 0; border-bottom: 1px solid var(--rule);
  transition: background-color var(--motion-fast) var(--ease);
}
.mrc-instr-row:hover { background: color-mix(in srgb, var(--mrc-fg) 4%, transparent); }
.mrc-instr-n { color: var(--flare-use); }
.mrc-instr-t { font-size: 19px; font-weight: 700; letter-spacing: -0.015em; }
.mrc-instr-d { font-size: 16px; line-height: 1.55; color: var(--soft); }

/* ── Шапка экспресс-аудита ── */
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
.mrc-probe-body { margin-top: 14px; animation: mrc-body-in 480ms var(--ease) both; }
@keyframes mrc-body-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.mrc-verdict-head {
  font-family: var(--f-display); font-size: 21px; font-weight: 800; line-height: 1.2;
  margin-bottom: 8px; letter-spacing: -0.025em;
}
.mrc-verdict-body { font-size: 15.5px; line-height: 1.62; color: var(--soft); font-variant-numeric: tabular-nums; }

/* Индикатор проверки — бегущая полоса вместо спиннера */
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
/* Поле и кнопка отделены от плашки с ценой и подняты по контрасту: это
   точка действия, она не должна быть тише пояснения над собой. */
.mrc-lead-card .mrc-input {
  border-color: color-mix(in srgb, var(--mrc-indigo) 42%, transparent);
  background: var(--mrc-ink-soft);
  font-size: 15.5px;
}
.mrc-lead-card .mrc-input::placeholder { color: var(--mrc-fg-soft); }
.mrc-lead-card .mrc-input:hover { border-color: color-mix(in srgb, var(--mrc-indigo) 62%, transparent); }
/* Неактивная кнопка остаётся контурной (заливка читалась бы как «можно
   нажать»), но её рамка и текст подняты: сейчас она выглядела выключенной
   настолько, что терялась рядом с полем. */
.mrc-lead-card .mrc-btn-primary:disabled {
  color: var(--mrc-fg-mid);
  border-color: color-mix(in srgb, var(--mrc-indigo) 38%, transparent);
  border-width: 1.5px;
}
.mrc-done-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.mrc-consent {
  display: flex; gap: 11px; align-items: flex-start; margin-top: 16px;
  cursor: pointer; font-size: 14.5px; line-height: 1.55; color: var(--mrc-fg-mid);
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
.mrc-chain-d { display: block; font-size: 15px; line-height: 1.55; color: var(--soft); }
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

/* Ценовой якорь под составом разбора: вилка названа до КП, а не внутри него. */
.mrc-anchor {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: center;
  margin-top: 26px; padding: 22px 24px;
  border: 1px solid var(--rule); border-radius: 14px; background: var(--surface);
}
.mrc-anchor-fig { text-align: center; }
.mrc-anchor-num {
  font-size: 40px; font-weight: 800; letter-spacing: -0.03em; color: var(--flare-use);
  line-height: 1;
}
@media (max-width: 720px) {
  .mrc-anchor { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .mrc-anchor-fig { text-align: left; }
}

/* Блок «кто исполнитель»: реквизиты и контакты — доказательство, что за
   лендингом есть юрлицо, а не только форма ввода адреса. */
.mrc-who { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.mrc-who-card {
  border: 1px solid var(--rule); border-radius: 14px; padding: 20px 22px;
  background: var(--surface);
}
.mrc-who-label { color: var(--soft); letter-spacing: .08em; text-transform: uppercase; font-size: 13px; }
.mrc-who-name { font-weight: 700; font-size: 22px; margin: 8px 0 14px; }
.mrc-who-about { font-size: 15.5px; line-height: 1.6; color: var(--mrc-fg-mid); margin: 0 0 12px; }
.mrc-who-about:last-child { margin-bottom: 0; }
.mrc-who-dl { margin: 0; display: grid; gap: 9px; }
.mrc-who-dl > div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 10px; }
.mrc-who-dl dt { color: var(--soft); font-size: 14px; }
.mrc-who-dl dd { margin: 0; font-size: 15px; }
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
  .mrc-who-dl > div { grid-template-columns: minmax(0, 1fr); gap: 2px; }
}
.mrc-footer { border-top: 1px solid var(--rule); padding: 26px 0 38px; }
.mrc-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.mrc-footer-inner > .mrc-mono { color: var(--soft); }
.mrc-foot-legal { font-size: 13.5px; line-height: 1.6; color: var(--soft); max-width: 46ch; }
.mrc-footer-nav { display: flex; gap: 20px; flex-wrap: wrap; }
.mrc-footer-nav a {
  font-size: 15px; color: var(--soft); text-decoration: none;
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
  font-size: 13.5px; padding: 7px 14px; border-radius: 999px; color: var(--soft); white-space: nowrap;
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
.mrc-serp-snip { margin: 0 0 9px; font-size: 14.5px; line-height: 1.5; color: var(--soft); }
.mrc-serp-snip b { color: var(--mrc-fg-mid); font-weight: 700; }
.mrc-serp-rate {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13.5px; color: var(--soft); font-variant-numeric: tabular-nums;
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
.mrc-serp-empty-d { font-size: 15px; line-height: 1.5; color: var(--soft); min-width: 0; }

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
.mrc-chan-t { font-size: 14.5px; font-weight: 600; color: var(--mrc-fg-mid); line-height: 1.3; }
.mrc-signal-out {
  display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 18px; align-items: start;
  padding-left: 24px; border-left: 1px solid var(--rule);
}
.mrc-signal-note { font-size: 15px; }

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
  font-style: normal; font-family: var(--f-mono); font-size: 13px;
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
  .mrc-eyebrow { margin-bottom: 16px; font-size: 13px; letter-spacing: 0.04em; }
  .mrc-hero-lead { font-size: 17.5px; margin-bottom: 22px; }

  .mrc-form-row { flex-direction: column; }
  .mrc-input, .mrc-btn { width: 100%; flex: 1 1 auto; }
  .mrc-input { font-size: 16px; }

  .mrc-ans { padding: 18px 16px 16px; }
  .mrc-ans-qtext { font-size: 15.5px; }
  .mrc-ans-text { font-size: 15.5px; }
  .mrc-slot-box { font-size: 13.5px; padding: 0 12px; }

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
  .mrc-cmp-cell { position: relative; padding-left: 96px; font-size: 15px; }
  .mrc-cmp-cell::before {
    content: attr(data-tag); position: absolute; left: 0; top: 2px; width: 88px;
    font-family: var(--f-mono);
    font-size: 12.5px; letter-spacing: 0.05em; text-transform: uppercase;
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

/* Строки проверок: тоже были сноской — поднимаем до карточек с номером */
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

/* ── Маршрут воронки: проверка → разбор → предложение ── */
.mrc-route {
  list-style: none; margin: 40px 0 8px; padding: 0;
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px;
}
.mrc-route-step {
  position: relative; padding-top: 22px; opacity: .62;
  animation: mrc-route-in 520ms var(--ease) both;
}
.mrc-route-step:nth-child(1) { animation-delay: 60ms; }
.mrc-route-step:nth-child(2) { animation-delay: 160ms; }
.mrc-route-step:nth-child(3) { animation-delay: 260ms; }
@keyframes mrc-route-in { from { opacity: 0; transform: translateY(8px); } to { opacity: var(--mrc-route-o, .62); transform: none; } }
.mrc-route-step.is-now { opacity: 1; --mrc-route-o: 1; }
.mrc-route-step::before {
  content: ''; position: absolute; top: 6px; left: 0; right: -20px; height: 2px;
  background: color-mix(in srgb, var(--mrc-fg-soft) 30%, transparent);
}
.mrc-route-step:last-child::before { right: 0; }
.mrc-route-step.is-now::before { background: linear-gradient(90deg, var(--mrc-indigo), var(--mrc-cyan)); }
.mrc-route-dot {
  position: absolute; top: 0; left: 0; width: 14px; height: 14px; border-radius: 50%;
  background: var(--mrc-ink); border: 2.5px solid color-mix(in srgb, var(--mrc-fg-soft) 55%, transparent);
}
.mrc-route-step.is-now .mrc-route-dot { border-color: var(--mrc-indigo); background: var(--mrc-indigo); }
.mrc-route-t { display: block; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 7px; }
.mrc-route-d { display: block; font-size: 15px; line-height: 1.55; color: var(--mrc-fg-mid); }
@media (max-width: 820px) {
  .mrc-route { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .mrc-route-step { padding: 0 0 24px 34px; }
  .mrc-route-step::before { top: 8px; left: 6px; right: auto; bottom: 0; width: 2px; height: auto; }
  .mrc-route-step:last-child::before { display: none; }
  .mrc-route-dot { top: 2px; }
}

/* ── Что изменилось у клиентов: четыре карточки боли ──────────────────────
   Стоят до объяснения услуги: без них «видимость в нейросетях» читается как
   пустой термин. Сетка 2×2 на десктопе, в столбик на телефоне. */
.mrcn-pain { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.mrcn-pain-item {
  background: var(--surface); border: 1px solid var(--rule);
  border-left: 3px solid var(--flare-use);
  border-radius: var(--mrc-r-lg); padding: 20px 22px;
  transition: border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease), box-shadow var(--motion-fast) var(--ease);
}
.mrcn-pain-item:hover { border-color: color-mix(in srgb, var(--flare-use) 45%, transparent); transform: translateY(-2px); box-shadow: 0 10px 24px -16px rgba(15,23,42,.28); }
/* Стагер входа: каждая карточка своя задержка, срабатывает вместе со
   скролл-ревилом секции — родителю не нужно ничего знать про детей. */
.mrc-anim [data-reveal] .mrcn-pain-item { opacity: 0; transform: translateY(10px); transition: opacity 480ms var(--ease), transform 480ms var(--ease); }
.mrc-anim [data-reveal].is-in .mrcn-pain-item { opacity: 1; transform: none; }
.mrc-anim [data-reveal].is-in .mrcn-pain-item:nth-child(1) { transition-delay: 0ms; }
.mrc-anim [data-reveal].is-in .mrcn-pain-item:nth-child(2) { transition-delay: 90ms; }
.mrc-anim [data-reveal].is-in .mrcn-pain-item:nth-child(3) { transition-delay: 180ms; }
.mrc-anim [data-reveal].is-in .mrcn-pain-item:nth-child(4) { transition-delay: 270ms; }
.mrcn-pain-t { font-size: 17px; font-weight: 750; letter-spacing: -0.01em; margin: 0 0 8px; }
.mrcn-pain-d { font-size: 14.5px; line-height: 1.6; color: var(--soft); margin: 0; }

/* ── Ступени услуги: плашки вместо абзаца ────────────────────────────────
   Три суммы в сплошном тексте не читались. Каждая ступень — своя карточка
   с ценой крупно и единицей измерения рядом, чтобы «25 000 разово» и
   «25 000 в месяц» не путались. */
.mrcn-tiers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: stretch; }
.mrcn-tier {
  display: flex; flex-direction: column;
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--mrc-r-lg); padding: 22px 22px 24px;
  transition: border-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease), box-shadow var(--motion-fast) var(--ease);
}
.mrcn-tier:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -18px rgba(15,23,42,.32); }
.mrc-anim [data-reveal] .mrcn-tier { opacity: 0; transform: translateY(10px); transition: opacity 480ms var(--ease), transform 480ms var(--ease); }
.mrc-anim [data-reveal].is-in .mrcn-tier { opacity: 1; transform: none; }
.mrc-anim [data-reveal].is-in .mrcn-tier:nth-child(1) { transition-delay: 0ms; }
.mrc-anim [data-reveal].is-in .mrcn-tier:nth-child(2) { transition-delay: 110ms; }
.mrc-anim [data-reveal].is-in .mrcn-tier:nth-child(3) { transition-delay: 220ms; }
/* Средняя ступень выделена: это первый платный шаг и точка решения. */
.mrcn-tier.is-accent {
  border-color: color-mix(in srgb, var(--flare-use) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--flare-use) 12%, transparent);
}
.mrcn-tier-stage { font-size: 12.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--soft); }
.mrcn-tier-name { font-size: 17px; font-weight: 750; margin: 8px 0 12px; letter-spacing: -0.01em; }
.mrcn-tier-price { font-size: 30px; font-weight: 850; line-height: 1.05; letter-spacing: -0.03em; }
.mrcn-tier.is-accent .mrcn-tier-price { color: var(--flare-use); }
.mrcn-tier-unit { font-size: 12.5px; color: var(--soft); margin-top: 5px; }
.mrcn-tier-list { list-style: none; margin: 16px 0 0; padding: 14px 0 0; border-top: 1px solid var(--rule); display: grid; gap: 9px; }
.mrcn-tier-list li { font-size: 14px; line-height: 1.5; color: var(--mrc-fg-mid); padding-left: 16px; position: relative; }
.mrcn-tier-list li::before {
  content: ""; position: absolute; left: 0; top: 8px;
  width: 6px; height: 6px; border-radius: 50%; background: var(--flare-use); opacity: 0.55;
}

@media (max-width: 860px) {
  .mrcn-tiers { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 720px) {
  .mrcn-pain { grid-template-columns: minmax(0, 1fr); }
}

` + SERP_COLLAGE_CSS;
