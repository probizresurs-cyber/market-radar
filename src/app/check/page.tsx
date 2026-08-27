"use client";

/**
 * /check — мини-лендинг «Почему ваш сайт не приносит заявки?».
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
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniCheckResult } from "@/lib/mini-check";

const YM_ID = 108999924;
const reach = (goal: string) => {
  try { (window as unknown as { ym?: (id: number, m: string, g: string) => void }).ym?.(YM_ID, "reachGoal", goal); } catch { /* нет Метрики — не мешаем */ }
};

type KpState = "idle" | "queued" | "done" | "error";

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
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Не удалось запустить проверку");
      setCheckId(j.id);
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
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Не получилось");
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

  const sem = result.semantics;
  const spd = result.speed;
  const rd = result.readability;
  const readyProbes = [sem, spd, rd].filter(p => p && p.status !== "pending").length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "0 20px 80px" }}>

        {/* ─── Первый экран: вопрос-боль + одно поле ─── */}
        <section style={{ padding: "72px 0 40px", textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
            MarketRadar · бесплатная проверка
          </div>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 850, lineHeight: 1.15, margin: "0 0 14px", letterSpacing: "-0.01em" }}>
            Почему ваш сайт не приносит заявки?
          </h1>
          <p style={{ fontSize: 17, color: "var(--muted-foreground)", maxWidth: 560, margin: "0 auto 28px", lineHeight: 1.55 }}>
            Проверим за минуту три причины, по которым клиенты уходят к конкурентам.
            Бесплатно и без звонков — результат сразу на экране, а не «менеджер свяжется с вами».
          </p>
          <div style={{ display: "flex", gap: 10, maxWidth: 520, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void start(); }}
              placeholder="Адрес сайта, например mysite.ru"
              inputMode="url"
              style={{
                flex: "1 1 280px", height: 50, padding: "0 16px", fontSize: 15.5,
                borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--card)",
                color: "var(--foreground)", outline: "none",
              }}
            />
            <button
              onClick={() => void start()}
              disabled={starting}
              style={{
                height: 50, padding: "0 26px", fontSize: 15.5, fontWeight: 700, borderRadius: 12,
                border: "none", cursor: "pointer", background: "var(--primary)", color: "var(--primary-foreground)",
                opacity: starting ? 0.7 : 1,
              }}
            >
              {starting ? "Запускаем…" : "Проверить сайт"}
            </button>
          </div>
          {startErr && <div style={{ color: "var(--destructive)", fontSize: 13.5, marginTop: 10 }}>{startErr}</div>}
          <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 12 }}>
            Нужен только адрес сайта — ни почты, ни телефона на этом шаге.
          </div>
        </section>

        {/* ─── Что проверим ─── */}
        {!checkId && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginBottom: 48 }}>
            {[
              ["Видимость в Яндексе", "По скольким запросам вас вообще находят — и какой спрос достаётся конкурентам."],
              ["Скорость на телефоне", "Медленный сайт теряет мобильные заявки до того, как человек увидел цены."],
              ["Читаемость для нейросетей", "Могут ли Алиса и ChatGPT прочитать ваши услуги — или рекомендуют других."],
            ].map(([t, d]) => (
              <div key={t} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ fontSize: 15.5, fontWeight: 750, marginBottom: 6 }}>{t}</div>
                <div style={{ fontSize: 13.5, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </section>
        )}

        {/* ─── Результаты: дорисовываются по мере готовности проб ─── */}
        {checkId && (
          <section ref={resultsRef} style={{ scrollMarginTop: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 18px" }}>
              Диагноз {checkDomain && <span style={{ color: "var(--primary)" }}>{checkDomain}</span>}
            </h2>
            <div style={{ display: "grid", gap: 14 }}>
              <ProbeCard
                title="Видимость в Яндексе"
                probe={sem?.status}
                render={() => sem?.status === "done" ? <SemanticsVerdict s={sem} /> : <ProbeFail what="видимость" />}
              />
              <ProbeCard
                title="Скорость на телефоне"
                probe={spd?.status}
                pendingNote="Google Lighthouse меряет реальную загрузку — до минуты"
                render={() => spd?.status === "done" ? <SpeedVerdict s={spd} /> : <ProbeFail what="скорость" />}
              />
              <ProbeCard
                title="Читаемость для нейросетей"
                probe={rd?.status}
                render={() => rd?.status === "done" ? <ReadabilityVerdict s={rd} /> : <ProbeFail what="читаемость" />}
              />
            </div>

            {/* ─── CTA: полный разбор за email ─── */}
            {readyProbes >= 2 && (
              <div style={{ marginTop: 28, background: "var(--card)", border: "2px solid var(--primary)", borderRadius: 16, padding: "24px 26px" }}>
                {kpState === "idle" && (
                  <>
                    <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>Это экспресс-диагноз. Полный разбор — тоже бесплатно</div>
                    <div style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: 16 }}>
                      Внутри: находки с доказательствами по вашему сайту, конкуренты поимённо — с запросами,
                      по которым они забирают ваших клиентов, прогноз заявок по каналам и план работ с ценами.
                      Разбор собирается 2–3 минуты и открывается по ссылке.
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Ваш email"
                        inputMode="email"
                        style={{
                          flex: "1 1 240px", height: 46, padding: "0 14px", fontSize: 14.5,
                          borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--background)",
                          color: "var(--foreground)", outline: "none",
                        }}
                      />
                      <button
                        onClick={() => void submitLead()}
                        disabled={!consent}
                        style={{
                          height: 46, padding: "0 22px", fontSize: 14.5, fontWeight: 700, borderRadius: 10,
                          border: "none", cursor: consent ? "pointer" : "not-allowed",
                          background: "var(--primary)", color: "var(--primary-foreground)", opacity: consent ? 1 : 0.55,
                        }}
                      >
                        Получить полный разбор
                      </button>
                    </div>
                    {/* Согласие по инструкции: обе ссылки, чекбокс не проставлен заранее */}
                    <label style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 12, cursor: "pointer", fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                      <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                        style={{ marginTop: 2, width: 15, height: 15, accentColor: "var(--primary)", flexShrink: 0 }} />
                      <span>
                        Даю{" "}
                        <a href="/legal/consent-pd" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>согласие</a>{" "}
                        на обработку персональных данных в соответствии с{" "}
                        <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>Политикой обработки персональных данных</a>
                      </span>
                    </label>
                    {leadErr && <div style={{ color: "var(--destructive)", fontSize: 13, marginTop: 8 }}>{leadErr}</div>}
                  </>
                )}
                {kpState === "queued" && (
                  <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                    <b>Собираем полный разбор — 2–3 минуты.</b><br />
                    <span style={{ color: "var(--muted-foreground)", fontSize: 13.5 }}>
                      Анализируем сайт, конкурентов и видимость в нейросетях. Страницу можно не закрывать — ссылка появится здесь.
                    </span>
                  </div>
                )}
                {kpState === "done" && kpUrl && (
                  <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 220, fontSize: 15.5, fontWeight: 750 }}>Полный разбор готов</div>
                    <a href={kpUrl} target="_blank" rel="noopener noreferrer"
                      style={{ padding: "12px 24px", borderRadius: 10, background: "var(--primary)", color: "var(--primary-foreground)", textDecoration: "none", fontWeight: 700, fontSize: 14.5 }}>
                      Открыть разбор
                    </a>
                  </div>
                )}
                {kpState === "error" && (
                  <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>
                    <b>Разбор готовим вручную.</b>{" "}
                    <span style={{ color: "var(--muted-foreground)" }}>
                      Автоматическая сборка не прошла — специалист соберёт разбор и пришлёт на {email || "вашу почту"} в течение рабочего дня.
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ─── MarketRadar кратко ─── */}
        <section style={{ marginTop: 56, borderTop: "1px solid var(--border)", paddingTop: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
            Что умеет MarketRadar
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: "var(--muted-foreground)" }}>
            <div><b style={{ color: "var(--foreground)" }}>Анализ конкурентов</b> — кто и по каким запросам забирает ваших клиентов</div>
            <div><b style={{ color: "var(--foreground)" }}>GEO-видимость</b> — попадание в ответы Алисы, ChatGPT и других ассистентов</div>
            <div><b style={{ color: "var(--foreground)" }}>Контент-завод</b> — статьи, посты и видео с аватаром под ваш бренд</div>
            <div><b style={{ color: "var(--foreground)" }}>Портрет аудитории</b> — сегменты, страхи и мотивы ваших покупателей</div>
            <div><b style={{ color: "var(--foreground)" }}>Ускорение сайта</b> — скорость 90+ по PageSpeed, дизайн не меняется</div>
          </div>
        </section>

        <footer style={{ marginTop: 40, fontSize: 12.5, color: "var(--muted-foreground)" }}>
          <a href="/legal/privacy" style={{ color: "inherit" }}>Политика обработки персональных данных</a>
          {" · "}
          <a href="/" style={{ color: "inherit" }}>MarketRadar</a>
        </footer>
      </main>
    </div>
  );
}

/* ─── Карточки результата ──────────────────────────────────────────────── */

function ProbeCard({ title, probe, pendingNote, render }: {
  title: string; probe?: "pending" | "done" | "failed"; pendingNote?: string;
  render: () => React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontSize: 15.5, fontWeight: 750, marginBottom: 8 }}>{title}</div>
      {(!probe || probe === "pending") ? (
        <div style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>
          <span className="mr-check-spin" style={{ display: "inline-block", width: 13, height: 13, border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", marginRight: 8, verticalAlign: -2 }} />
          Проверяем… {pendingNote && <span style={{ opacity: 0.8 }}>{pendingNote}</span>}
          <style>{`.mr-check-spin { animation: mrspin 0.9s linear infinite; } @keyframes mrspin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : render()}
    </div>
  );
}

function ProbeFail({ what }: { what: string }) {
  return <div style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>Не удалось замерить {what} автоматически — войдёт в полный разбор.</div>;
}

function Verdict({ tone, headline, details }: { tone: "bad" | "warn" | "ok"; headline: string; details?: React.ReactNode }) {
  const color = tone === "bad" ? "var(--destructive)" : tone === "warn" ? "var(--warning)" : "var(--success)";
  return (
    <div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color, marginBottom: 6 }}>{headline}</div>
      {details}
    </div>
  );
}

function SemanticsVerdict({ s }: { s: NonNullable<MiniCheckResult["semantics"]> }) {
  const n = s.visibleCount ?? 0;
  const cap = n >= 1000 ? "1000+" : String(n);
  const tone = n < 50 ? "bad" as const : n < 300 ? "warn" as const : "ok" as const;
  const headline =
    n < 50 ? `Вас почти не видно: всего ${cap} запросов в Яндексе` :
    n < 300 ? `Видимость слабая: ${cap} запросов — у лидеров ниш сотни и тысячи` :
    `База есть: вас видно по ${cap} запросам`;
  return (
    <Verdict tone={tone} headline={headline} details={
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
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
  const tone = p < 50 ? "bad" as const : p < 90 ? "warn" as const : "ok" as const;
  const headline =
    p < 50 ? `Сайт медленный: ${p}/100 на телефоне` :
    p < 90 ? `Скорость средняя: ${p}/100 — конкуренты с быстрым сайтом впереди` :
    `Скорость в порядке: ${p}/100`;
  return (
    <Verdict tone={tone} headline={headline} details={
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
        {s.lcpDisplay && <>Главный контент появляется за {s.lcpDisplay} (норма Google — до 2,5 с). </>}
        {p < 90 && <>Пока страница грузится, мобильный посетитель уходит к тем, у кого уже открылось.</>}
      </div>
    } />
  );
}

function ReadabilityVerdict({ s }: { s: NonNullable<MiniCheckResult["readability"]> }) {
  const passed = s.checksPassed ?? 0;
  const total = s.checksTotal ?? 7;
  const tone = passed <= 3 ? "bad" as const : passed <= 5 ? "warn" as const : "ok" as const;
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
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
          {fails.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      ) : (
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Базовая структура в порядке — вопрос в контенте и внешних сигналах.</div>
      )}
    />
  );
}
