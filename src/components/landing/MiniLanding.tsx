"use client";

/**
 * Мини-лендинг под рекламу: один экран с формой плюс самое необходимое.
 *
 * Зачем отдельный компонент. Коротких посадочных сразу две (/geo и
 * /competitors), и обе состоят из одних и тех же частей — меняется только
 * текст. Две копии вёрстки разъехались бы на первой же правке контраста или
 * согласия; здесь один скелет и разное наполнение.
 *
 * Что входит и почему именно это. Всё лишнее убрано, но четыре вещи остаются
 * на любой посадочной:
 *   — разбор частых обещаний: единственный блок, отличающий нас от соседей
 *     по выдаче, и снимающий возражение «все обещают одно и то же»;
 *   — цена: единственная цифра денег, без неё человек идёт до самого разбора,
 *     не понимая порядка сумм, и отваливается там, где это стоило нам
 *     генерации документа;
 *   — пример настоящего разбора: доказательство, что документ существует;
 *   — реквизиты в подвале: по 152-ФЗ и для модерации Директа.
 * Блока «Кто это делает» здесь нет намеренно — на одном экране он вытесняет
 * форму, а его юридическая часть и так стоит в подвале.
 *
 * Воронка общая: форма ставит ту же бесплатную проверку и уводит на /new,
 * где результат показывается на месте. Своей механики проверки здесь нет.
 */
import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SERP_COLLAGE_CSS } from "./SerpCollage";
import { AI_ROW_CSS } from "./AiMarks";
import { LANDING_CSS } from "./landing-css";
import { RadarMark, SecHead } from "./LandingBits";
import { VENDOR_PUBLIC, DEMO_REPORTS } from "@/lib/vendor-public";
import { readAttribution } from "@/lib/attribution";

const YM_ID = 108999924;
const reach = (goal: string) => {
  try {
    (window as unknown as { ym?: (id: number, m: string, g: string) => void }).ym?.(YM_ID, "reachGoal", goal);
  } catch { /* нет Метрики — не мешаем отправке */ }
};

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

const CSS = AI_ROW_CSS + LANDING_CSS + SERP_COLLAGE_CSS + `
.mrcc-grad {
  background: linear-gradient(92deg, var(--mrc-cyan), var(--mrc-violet));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
/* Мини-лендинг живёт на одном-двух экранах: воздух между блоками режем,
   чтобы форма и первый смысловой блок помещались без прокрутки на ноутбуке. */
.mrcc-mini .mrc-sec { padding: 34px 0; }
.mrcc-mini .mrc-hero { padding-bottom: 26px; }
`;

export interface MiniLandingProps {
  /** Подпись в шапке справа. */
  topbarTag: string;
  /** Строка над заголовком. */
  eyebrow: string;
  /** Заголовок первого экрана. */
  title: ReactNode;
  /** Абзац под заголовком. */
  lead: ReactNode;
  /** Картинка первого экрана — коллаж выдачи или ответа ассистента. */
  scene: ReactNode;
  /** Надпись на кнопке. */
  buttonLabel: string;
  /** Подпись под формой на первом экране. */
  formNote: string;
  /** Заголовок и подзаголовок блока про обещания. */
  honestTitle: string;
  honestSub: string;
  /** Три фразы рынка и почему они невыполнимы. */
  honest: { claim: string; truth: string }[];
  /** Цель Метрики, своя у каждой посадочной (для отчётности по источнику). */
  goal: string;
  /** Дополнительные ссылки в подвале — например, на длинную версию. */
  footerLinks?: { href: string; label: string }[];
}

export function MiniLanding(props: MiniLandingProps) {
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
      // Общая цель воронки кормит стратегии всех кампаний, своя — отчётность
      // по источнику. Обе до навигации: после router.push страница уже уходит.
      reach("mini_check_start");
      reach(props.goal);
      router.push(`/neyroseti?url=${encodeURIComponent(u)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }, [url, router, props.goal]);

  const form = (
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
          {busy ? "Запускаем…" : props.buttonLabel}
        </button>
      </div>
      {err && <div className="mrc-err">{err}</div>}
      <div className="mrc-mono mrc-formnote">{props.formNote}</div>
    </div>
  );

  return (
    <div className="mrc-root mrcc-mini">
      <style>{CSS}</style>

      <section className="mrc-slab mrc-hero">
        <div className="mrc-wrap">
          <header className="mrc-topbar">
            <a href="/" className="mrc-wordmark" aria-label="MarketRadar24">
              <RadarMark />
              <span aria-hidden="true">Market<b>Radar24</b></span>
            </a>
            <span className="mrc-mono mrc-topbar-tag">{props.topbarTag}</span>
          </header>

          <div className="mrc-hero-grid">
            <div className="mrc-hero-head">
              <div className="mrc-mono mrc-eyebrow">
                <span className="mrc-dot" aria-hidden="true" />
                {props.eyebrow}
              </div>
              <h1 className="mrc-h1">{props.title}</h1>
              <p className="mrc-lead mrc-hero-lead">{props.lead}</p>
            </div>

            <div className="mrc-hero-scene">{props.scene}</div>
            <div className="mrc-hero-form">{form}</div>
          </div>
        </div>
      </section>

      <main>
        <div className="mrc-wrap">
          <section className="mrc-sec" data-reveal>
            <SecHead idx="01" title={props.honestTitle} sub={props.honestSub} />
            <div className="mrc-honest">
              {props.honest.map(h => (
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

          <section className="mrc-sec" data-reveal>
            {/* Цена и пример разбора — те же формулировки, что на /new.
                Расхождение между посадочными по деньгам обнуляет доверие
                ко всем остальным числам в воронке. */}
            <div className="mrc-anchor">
              <div>
                <div className="mrc-mono mrc-who-label">сколько это стоит</div>
                <p className="mrc-body" style={{ margin: "8px 0 0" }}>
                  Замер и разбор — <b>0 ₽</b>. Оптимизация — <b>25 000 ₽ за первый месяц</b>:
                  чиним то, из-за чего вас не находят. Дальше продвижение —
                  <b> от 25 000 ₽ в месяц</b>: техника сайта, контент, внешние упоминания
                  и репутация ведутся вместе, по одному счёту. Точная сумма — в разборе,
                  после того как понятно, что именно чинить.
                </p>
              </div>
              <div className="mrc-anchor-fig">
                <div className="mrc-anchor-num">0 ₽</div>
                <div className="mrc-note">разбор</div>
              </div>
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
      </main>

      <footer className="mrc-footer">
        <div className="mrc-wrap mrc-footer-inner">
          {/* Реквизиты: посетитель с рекламы должен видеть, кому он платит. */}
          <span className="mrc-mono">
            {VENDOR_PUBLIC.legalName} · ИНН {VENDOR_PUBLIC.inn} · ОГРНИП {VENDOR_PUBLIC.ogrn}
            <br />{VENDOR_PUBLIC.address}
          </span>
          <nav className="mrc-footer-nav">
            <a href={"mailto:" + VENDOR_PUBLIC.email}>{VENDOR_PUBLIC.email}</a>
            <a href={VENDOR_PUBLIC.telegram} target="_blank" rel="noopener noreferrer">{VENDOR_PUBLIC.telegramLabel}</a>
            <a href="/legal/offer">Оферта</a>
            <a href="/legal/privacy">Политика обработки персональных данных</a>
            <a href="/legal/consent-pd">Согласие на обработку данных</a>
            {(props.footerLinks ?? []).map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
          </nav>
        </div>
      </footer>
    </div>
  );
}
