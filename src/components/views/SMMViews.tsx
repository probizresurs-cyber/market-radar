"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { SMMResult, SMMSocialLinks, SMMRealStats } from "@/lib/smm-types";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import {
  Smartphone, Rocket, Drama, FileText, Loader2,
  AlertTriangle,
} from "lucide-react";

const SMM_PLATFORMS: Array<{ key: keyof SMMSocialLinks; label: string; icon: string; placeholder: string }> = [
  { key: "vk", label: "ВКонтакте", icon: "🟦", placeholder: "https://vk.com/your_page" },
  { key: "instagram", label: "Instagram", icon: "📸", placeholder: "https://instagram.com/your_account" },
  { key: "telegram", label: "Telegram", icon: "✈️", placeholder: "https://t.me/your_channel" },
  { key: "facebook", label: "Facebook", icon: "📘", placeholder: "https://facebook.com/your_page" },
  { key: "tiktok", label: "TikTok", icon: "🎵", placeholder: "https://tiktok.com/@your_account" },
  { key: "youtube", label: "YouTube", icon: "▶️", placeholder: "https://youtube.com/@your_channel" },
];

export function NewSMMView({ c, myCompany, isAnalyzing, onAnalyze }: {
  c: Colors;
  myCompany: AnalysisResult | null;
  isAnalyzing: boolean;
  onAnalyze: (niche: string, links: SMMSocialLinks) => Promise<void>;
}) {
  const [niche, setNiche] = useState(myCompany?.company.description?.split("\n")[0]?.slice(0, 200) ?? "");
  const [links, setLinks] = useState<SMMSocialLinks>(() => {
    const initial: SMMSocialLinks = {};
    const social = myCompany?.social;
    // Pre-fill telegram/vk if available from existing analysis (only urls)
    if (social) {
      // social.vk and social.telegram are objects in AnalysisResult, not URLs — skip auto-fill
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: keyof SMMSocialLinks, value: string) => {
    setLinks(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const hasAny = Object.values(links).some(v => v && v.trim());
    if (!hasAny && !niche.trim()) {
      setError("Укажите хотя бы одну ссылку на соцсеть или опишите нишу");
      return;
    }
    setError(null);
    try {
      await onAnalyze(niche.trim(), links);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>Анализ СММ и брендинг</h1>
      <p style={{ fontSize: 13, color: "var(--foreground-secondary)", margin: "0 0 28px" }}>
        Мы проанализируем ваши соцсети и сайт, определим архетип бренда и разработаем стратегию для каждой платформы: форматы, тон, контент-столпы и готовые примеры постов.
      </p>

      {myCompany && (
        <div style={{ background: "color-mix(in oklch, var(--primary) 6%, transparent)", border: `1px solid var(--primary)30`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          <span style={{ color: "var(--muted-foreground)" }}>Компания: </span>
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{myCompany.company.name}</span>
          <span style={{ color: "var(--muted-foreground)" }}> · {myCompany.company.url}</span>
        </div>
      )}

      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, boxShadow: "var(--shadow)", marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
          Ниша / о компании
        </label>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
          Опишите чем занимается компания, для кого продукт, в чём ценность
        </p>
        <textarea
          value={niche}
          onChange={e => setNiche(e.target.value)}
          placeholder="Например: студия онлайн-йоги для женщин 30+. Помогаем вернуть гибкость, снять стресс и найти баланс через короткие практики дома."
          rows={4}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, boxShadow: "var(--shadow)", marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
          Ссылки на соцсети
        </label>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 14px" }}>
          Заполните те, которые есть. Можно оставить пустыми — тогда дадим рекомендации с нуля.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {SMM_PLATFORMS.map(p => (
            <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{p.icon}</span>
              <span style={{ fontSize: 12, color: "var(--foreground-secondary)", width: 90, fontWeight: 600 }}>{p.label}</span>
              <input
                type="text"
                value={links[p.key] ?? ""}
                onChange={e => handleChange(p.key, e.target.value)}
                placeholder={p.placeholder}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 12, outline: "none" }}
              />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "color-mix(in oklch, var(--destructive) 7%, transparent)", border: `1px solid var(--destructive)30`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "var(--destructive)", marginBottom: 16 }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isAnalyzing}
        style={{ padding: "13px 32px", borderRadius: 12, border: "none", background: isAnalyzing ? "var(--muted)" : "linear-gradient(135deg, #ec4899, #f472b6)", color: isAnalyzing ? "var(--muted-foreground)" : "#fff", fontWeight: 700, fontSize: 15, cursor: isAnalyzing ? "not-allowed" : "pointer", boxShadow: "0 4px 14px #ec489940" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {isAnalyzing ? <Loader2 size={16} className="mr-spin" /> : <Smartphone size={16} />}
          {isAnalyzing ? "Анализируем СММ… (60–90 сек)" : "Провести анализ СММ"}
        </span>
      </button>
      {isAnalyzing && (
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 12 }}>Разрабатываем стратегию брендинга. Не закрывайте страницу.</p>
      )}
    </div>
  );
}

export function RealStatsBar({ c, stats }: { c: Colors; stats: SMMRealStats }) {
  const items: Array<{ label: string; value: string; sub?: string }> = [];

  if (stats.vk) {
    items.push({
      label: "🟦 ВКонтакте",
      value: stats.vk.subscribers.toLocaleString("ru-RU") + " подп.",
      sub: stats.vk.posts30d > 0 ? `${stats.vk.posts30d} постов` : undefined,
    });
  }
  if (stats.telegram) {
    items.push({
      label: "✈️ Telegram",
      value: stats.telegram.subscribers.toLocaleString("ru-RU") + " подп.",
      sub: stats.telegram.posts30d > 0 ? `${stats.telegram.posts30d} постов` : undefined,
    });
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: "var(--card)", border: `1px solid var(--border)`, borderRadius: 12,
          padding: "10px 18px", display: "flex", alignItems: "center", gap: 12, boxShadow: "var(--shadow)",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>{item.value}</div>
            {item.sub && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{item.sub}</div>}
          </div>
          <div style={{ fontSize: 10, background: "#10b98115", color: "#10b981", borderRadius: 6, padding: "2px 7px", fontWeight: 700 }}>
            РЕАЛЬНЫЕ ДАННЫЕ
          </div>
        </div>
      ))}
    </div>
  );
}

export function SMMEmptyDashboard({ c, onRunAnalysis }: { c: Colors; onRunAnalysis: () => void }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>Дашборд СММ</h1>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 28px" }}>Анализ соцсетей ещё не проводился</p>
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 48, textAlign: "center", boxShadow: "var(--shadow)" }}>
        <div style={{ marginBottom: 16, color: "var(--muted-foreground)", display: "flex", justifyContent: "center" }}><Smartphone size={48} /></div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Тут пока нет данных</div>
        <div style={{ fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 24, lineHeight: 1.6, maxWidth: 380, margin: "0 auto 24px" }}>
          Запустите анализ СММ, чтобы получить стратегию брендинга, контент-план и рекомендации для каждой соцсети
        </div>
        <button
          onClick={onRunAnalysis}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #ec4899, #f472b6)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px #ec489940" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Rocket size={16} /> Запустить анализ СММ</span>
        </button>
      </div>
    </div>
  );
}

export function SMMDashboardView({ c, data }: { c: Colors; data: SMMResult }) {
  const [activePlatform, setActivePlatform] = useState(0);
  const platform = data.platformStrategies[activePlatform];

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)", ...style }}>{children}</div>
  );

  const Tag = ({ text, color }: { text: string; color?: string }) => (
    <span style={{ display: "inline-block", background: (color ?? "var(--primary)") + "15", color: color ?? "var(--primary)", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, marginRight: 6, marginBottom: 6 }}>{text}</span>
  );

  const ListItem = ({ text, color, icon }: { text: string; color?: string; icon?: string }) => (
    <div style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: `1px solid var(--muted)`, fontSize: 13 }}>
      <span style={{ flexShrink: 0, color: color ?? "var(--primary)" }}>{icon ?? "•"}</span>
      <span style={{ color: "var(--foreground-secondary)", lineHeight: 1.5 }}>{text}</span>
    </div>
  );

  const generatedDate = new Date(data.generatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "var(--foreground)" }}>СММ-стратегия — {data.companyName}</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{data.companyUrl} · {generatedDate}</p>
      </div>

      {/* Real stats badge */}
      {data.realStats && (data.realStats.vk || data.realStats.telegram) && (
        <RealStatsBar c={c} stats={data.realStats} />
      )}

      {/* Brand Identity */}
      <CollapsibleSection c={c} title="Идентичность бренда" icon={<Drama size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>АРХЕТИП</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)", marginBottom: 14 }}>{data.brandIdentity.archetype}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>ПОЗИЦИОНИРОВАНИЕ</div>
            <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: 0 }}>{data.brandIdentity.positioning}</p>
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>УТП</div>
            <p style={{ fontSize: 14, color: "var(--foreground)", fontWeight: 600, lineHeight: 1.55, marginBottom: 14 }}>{data.brandIdentity.uniqueValue}</p>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>ВИЗУАЛЬНЫЙ СТИЛЬ</div>
            <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: 0 }}>{data.brandIdentity.visualStyle}</p>
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.05em" }}>ТОН ГОЛОСА</div>
            <div style={{ marginBottom: 14 }}>{data.brandIdentity.toneOfVoice.map((t, i) => <Tag key={i} text={t} />)}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.05em" }}>КЛЮЧЕВЫЕ СЛОВА БРЕНДА</div>
            <div>{data.brandIdentity.brandKeywords.map((k, i) => <Tag key={i} text={k} color={"var(--warning)"} />)}</div>
          </Card>
        </div>
      </CollapsibleSection>

      {/* Content Strategy */}
      <CollapsibleSection c={c} title="Контент-стратегия" icon={<FileText size={16} />}>
        <Card style={{ marginBottom: 16, background: `linear-gradient(135deg, var(--card) 60%, var(--primary)06 100%)` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>БОЛЬШАЯ ИДЕЯ</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.5, margin: "0 0 14px" }}>{data.contentStrategy.bigIdea}</p>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, letterSpacing: "0.05em" }}>МИССИЯ КОНТЕНТА</div>
          <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.65, margin: 0 }}>{data.contentStrategy.contentMission}</p>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--destructive)", marginBottom: 12, letterSpacing: "0.05em" }}>БОЛИ АУДИТОРИИ</div>
            {data.contentStrategy.audienceProblems.map((p, i) => <ListItem key={i} text={p} color={"var(--destructive)"} icon="⚡" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>СТОРИТЕЛЛИНГ-УГЛЫ</div>
            {data.contentStrategy.storytellingAngles.map((s, i) => <ListItem key={i} text={s} icon="→" />)}
          </Card>
        </div>
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>МАТРИЦА КОНТЕНТА</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["Тип контента", "Цель", "Доля"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `2px solid var(--border)`, fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.contentStrategy.contentMatrix.map((m, i) => (
                <tr key={i} style={{ borderBottom: `1px solid var(--muted)` }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{m.type}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--foreground-secondary)" }}>{m.goal}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{m.share}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </CollapsibleSection>

      {/* Platform tabs + strategy */}
      {data.platformStrategies.length > 0 && (
        <CollapsibleSection c={c} title="Стратегия по платформам" icon={<Smartphone size={16} />}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {data.platformStrategies.map((p, i) => (
              <button key={i} onClick={() => setActivePlatform(i)} style={{
                padding: "8px 18px", borderRadius: 10, border: `2px solid ${activePlatform === i ? "var(--primary)" : "var(--border)"}`,
                background: activePlatform === i ? "var(--primary)" : "transparent",
                color: activePlatform === i ? "#fff" : "var(--foreground-secondary)",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}>
                {p.platformLabel}
              </button>
            ))}
          </div>
          {platform && (
            <div>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6 }}>СООТВЕТСТВИЕ ЦА</div>
                    <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.55, margin: 0 }}>{platform.audienceFit}</p>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6 }}>ФОРМАТЫ</div>
                    <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.55, margin: 0 }}>{platform.contentFormat}</p>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6 }}>ЧАСТОТА</div>
                    <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.55, margin: 0 }}>{platform.postingFrequency}</p>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.05em", marginBottom: 6 }}>ТОН</div>
                    <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.55, margin: 0 }}>{platform.toneOfVoice}</p>
                  </div>
                </div>
              </Card>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 16 }}>
                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>КОНТЕНТ-СТОЛПЫ</div>
                  {platform.contentPillars.map((p, i) => <ListItem key={i} text={p} icon="🏛" />)}
                </Card>
                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 12, letterSpacing: "0.05em" }}>ТАКТИКИ РОСТА</div>
                  {platform.growthTactics.map((g, i) => <ListItem key={i} text={g} color={"var(--success)"} icon="📈" />)}
                </Card>
                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>KPI</div>
                  {platform.metricsToTrack.map((m, i) => <ListItem key={i} text={m} icon="📊" />)}
                </Card>
              </div>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", marginBottom: 12, letterSpacing: "0.05em" }}>ПРИМЕРЫ ПОСТОВ — ГОТОВЫ К ПУБЛИКАЦИИ</div>
                {platform.examplePosts.map((post, i) => (
                  <div key={i} style={{ padding: 14, background: "var(--background)", borderRadius: 10, marginBottom: 10, border: `1px solid var(--muted)` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6 }}>ПОСТ #{i + 1}</div>
                    <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{post}</p>
                  </div>
                ))}
              </Card>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>СТРАТЕГИЯ ХЭШТЕГОВ / SEO</div>
                <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: 0 }}>{platform.hashtagStrategy}</p>
              </Card>
              {platform.warnings && platform.warnings.length > 0 && (
                <Card style={{ background: "color-mix(in oklch, var(--destructive) 3%, transparent)", border: `1px solid var(--destructive)25` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--destructive)", marginBottom: 12, letterSpacing: "0.05em" }}>ЧЕГО НЕ ДЕЛАТЬ</div>
                  {platform.warnings.map((w, i) => <ListItem key={i} text={w} color={"var(--destructive)"} icon="✗" />)}
                </Card>
              )}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Quick wins + 30 day plan */}
      <CollapsibleSection c={c} title="Quick wins и план на 30 дней" icon={<Rocket size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 12, letterSpacing: "0.05em" }}>QUICK WINS — ПЕРВАЯ НЕДЕЛЯ</div>
            {data.quickWins.map((q, i) => <ListItem key={i} text={q} color={"var(--success)"} icon={`${i + 1}.`} />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", marginBottom: 12, letterSpacing: "0.05em" }}>ПЛАН НА 30 ДНЕЙ</div>
            {data.thirtyDayPlan.map((w, i) => <ListItem key={i} text={w} icon="📅" />)}
          </Card>
        </div>
      </CollapsibleSection>

      {/* Red flags + Inspiration */}
      <CollapsibleSection c={c} title="Ошибки и вдохновение" icon={<AlertTriangle size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card style={{ background: "color-mix(in oklch, var(--destructive) 3%, transparent)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--destructive)", marginBottom: 12, letterSpacing: "0.05em" }}>RED FLAGS</div>
            {data.redFlags.map((r, i) => <ListItem key={i} text={r} color={"var(--destructive)"} icon="⚠️" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>АККАУНТЫ ДЛЯ ВДОХНОВЕНИЯ</div>
            {data.inspirationAccounts.map((a, i) => <ListItem key={i} text={a} icon="✨" />)}
          </Card>
        </div>
      </CollapsibleSection>
    </div>
  );
}
