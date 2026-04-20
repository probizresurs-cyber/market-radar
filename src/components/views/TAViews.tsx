"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult } from "@/lib/ta-types";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import {
  Brain, Rocket, User, Globe, Zap, AlertTriangle, Flame, Ban,
  RefreshCw, Sparkles, Target, Loader2, ThumbsUp, ThumbsDown,
} from "lucide-react";

export function NewTAView({ c, myCompany, isAnalyzing, onAnalyze }: {
  c: Colors; myCompany: AnalysisResult | null;
  isAnalyzing: boolean; onAnalyze: (niche: string, extra: string) => Promise<void>;
}) {
  const [niche, setNiche] = useState(myCompany?.company.description?.split("\n")[0]?.slice(0, 200) ?? "");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!niche.trim()) { setError("Опишите нишу и продукт"); return; }
    setError(null);
    try { await onAnalyze(niche.trim(), extra.trim()); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>Анализ целевой аудитории</h1>
      <p style={{ fontSize: 13, color: "var(--foreground-secondary)", margin: "0 0 28px" }}>
        Мы проведём глубокий психологический анализ ЦА: сегменты, боли, страхи, мотивы, возражения и триггеры покупки.
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
          Ниша, продукт / услуга <span style={{ color: "var(--destructive)" }}>*</span>
        </label>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
          Опишите чем занимается компания, что продаёт, для кого, какая проблема решается
        </p>
        <textarea
          value={niche}
          onChange={e => setNiche(e.target.value)}
          placeholder="Например: интернет-магазин спортивного питания для любителей фитнеса 25–40 лет. Продаём протеин, витамины, аминокислоты. Основная аудитория — люди которые хотят похудеть и набрать мышечную массу, но не знают с чего начать."
          rows={5}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 24, boxShadow: "var(--shadow)", marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
          Дополнительный контекст (необязательно)
        </label>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
          Уникальные особенности продукта, уже известные сегменты, конкуренты, ценовой сегмент
        </p>
        <textarea
          value={extra}
          onChange={e => setExtra(e.target.value)}
          placeholder="Средний чек 3000–8000 ₽. Конкуренты: Protein.ru, iHerb. Основной канал — Instagram. Клиенты часто не верят в эффект без тренера..."
          rows={3}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid var(--border)`, background: "var(--background)", color: "var(--foreground)", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {error && (
        <div style={{ background: "color-mix(in oklch, var(--destructive) 7%, transparent)", border: `1px solid var(--destructive)30`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "var(--destructive)", marginBottom: 16 }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isAnalyzing || !niche.trim()}
        style={{ padding: "13px 32px", borderRadius: 12, border: "none", background: isAnalyzing || !niche.trim() ? "var(--muted)" : "linear-gradient(135deg, #6366f1, #818cf8)", color: isAnalyzing || !niche.trim() ? "var(--muted-foreground)" : "#fff", fontWeight: 700, fontSize: 15, cursor: isAnalyzing || !niche.trim() ? "not-allowed" : "pointer", boxShadow: "0 4px 14px #6366f140" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {isAnalyzing ? <Loader2 size={16} className="mr-spin" /> : <Brain size={16} />}
          {isAnalyzing ? "Анализируем ЦА… (60–90 сек)" : "Провести анализ ЦА"}
        </span>
      </button>
      {isAnalyzing && (
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 12 }}>Проводим глубокий анализ. Не закрывайте страницу.</p>
      )}
    </div>
  );
}

// ============================================================
// TA Empty Dashboard (no data yet)
// ============================================================

export function TAEmptyDashboard({ c, onRunAnalysis }: { c: Colors; onRunAnalysis: () => void }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>Дашборд ЦА</h1>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 28px" }}>Анализ целевой аудитории ещё не проводился</p>
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 48, textAlign: "center", boxShadow: "var(--shadow)" }}>
        <div style={{ marginBottom: 16, color: "var(--muted-foreground)", display: "flex", justifyContent: "center" }}><Brain size={48} /></div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Тут пока нет данных</div>
        <div style={{ fontSize: 13, color: "var(--foreground-secondary)", marginBottom: 24, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 24px" }}>
          Запустите анализ целевой аудитории, чтобы увидеть сегменты, боли, страхи и мотивы ваших клиентов
        </div>
        <button
          onClick={onRunAnalysis}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px #6366f140" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Rocket size={16} /> Запустить анализ ЦА</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TA Dashboard View
// ============================================================

export function TADashboardView({ c, data }: { c: Colors; data: TAResult }) {
  const [activeSegment, setActiveSegment] = useState(0);

  const seg = data.segments[activeSegment];
  if (!seg) return null;

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)", ...style }}>{children}</div>
  );

  const Tag = ({ text, color }: { text: string; color?: string }) => (
    <span style={{ display: "inline-block", background: (color ?? "var(--primary)") + "15", color: color ?? "var(--primary)", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, marginRight: 6, marginBottom: 6 }}>{text}</span>
  );

  const QuoteBlock = ({ text, from }: { text: string; from: string }) => (
    <div style={{ borderLeft: `3px solid var(--primary)`, paddingLeft: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 13, color: "var(--foreground)", fontStyle: "italic", lineHeight: 1.55 }}>«{text}»</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, fontWeight: 600 }}>— {from}</div>
    </div>
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
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "var(--foreground)" }}>Анализ ЦА — {data.companyName}</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{data.niche} · {generatedDate}</p>
      </div>

      {/* Summary */}
      <Card style={{ marginBottom: 20, background: `linear-gradient(135deg, var(--card) 60%, var(--primary)06 100%)` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 8 }}>ОБЩИЙ ВЫВОД</div>
        <p style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.65, margin: 0 }}>{data.summary}</p>
      </Card>

      {/* Segment tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {data.segments.map((s, i) => (
          <button key={i} onClick={() => setActiveSegment(i)} style={{
            padding: "8px 18px", borderRadius: 10, border: `2px solid ${activeSegment === i ? "var(--primary)" : "var(--border)"}`,
            background: activeSegment === i ? "var(--primary)" : "transparent",
            color: activeSegment === i ? "#fff" : "var(--foreground-secondary)",
            fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}>
            {s.isGolden && <span>⭐</span>}
            {s.segmentName}
          </button>
        ))}
      </div>

      {seg.isGolden && seg.goldenReason && (
        <div style={{ background: "#f59e0b15", border: "1px solid #f59e0b30", borderRadius: 12, padding: "10px 16px", fontSize: 13, color: "#92400e", marginBottom: 16 }}>
          ⭐ <strong>Золотой сегмент</strong> — {seg.goldenReason}
        </div>
      )}

      {/* Demographics */}
      <CollapsibleSection c={c} title="Демография и образ жизни" icon={<User size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>ПЕРСОНА</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", marginBottom: 12 }}>{seg.demographics.personaName}</div>
            {[
              { label: "Возраст", value: seg.demographics.age },
              { label: "Пол", value: seg.demographics.genderRatio },
              { label: "Доход", value: seg.demographics.income },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid var(--muted)`, fontSize: 13 }}>
                <span style={{ color: "var(--foreground-secondary)" }}>{r.label}</span>
                <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{r.value}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.05em" }}>ОБРАЗ ЖИЗНИ</div>
            <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: "0 0 14px" }}>{seg.demographics.lifestyle}</p>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>ЦЕННОСТИ</div>
            <div>{seg.worldview.values.map((v, i) => <Tag key={i} text={v} />)}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>ИДЕНТИЧНОСТЬ</div>
            <p style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>{seg.worldview.identity}</p>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>ЧТО ГОВОРИТ О СЕБЕ</div>
            <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>{seg.worldview.shortDescription}</p>
          </Card>
        </div>
      </CollapsibleSection>

      {/* Worldview */}
      <CollapsibleSection c={c} title="Мировоззрение и убеждения" icon={<Globe size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {[
            { title: "Надежды и мечты", text: seg.worldview.hopesAndDreams },
            { title: "Победы и неудачи", text: seg.worldview.winsAndLosses },
            { title: "Ключевые убеждения", text: seg.worldview.coreBeliefs },
          ].map(item => (
            <Card key={item.title}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 10, letterSpacing: "0.05em" }}>{item.title.toUpperCase()}</div>
              <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.65, margin: 0 }}>{item.text}</p>
            </Card>
          ))}
        </div>
      </CollapsibleSection>

      {/* Problems & Emotions */}
      <CollapsibleSection c={c} title="Основные проблемы и эмоции" icon={<Zap size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--destructive)", marginBottom: 12, letterSpacing: "0.05em" }}>ГЛАВНЫЕ ПРОБЛЕМЫ</div>
            {seg.mainProblems.map((p, i) => <ListItem key={i} text={p} color={"var(--destructive)"} icon="⚡" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warning)", marginBottom: 12, letterSpacing: "0.05em" }}>ДОМИНИРУЮЩИЕ ЭМОЦИИ</div>
            {seg.topEmotions.map((e, i) => <Tag key={i} text={e} color={"var(--warning)"} />)}
          </Card>
        </div>
      </CollapsibleSection>

      {/* Fears */}
      <CollapsibleSection c={c} title="Страхи (те, что не признают вслух)" icon={<AlertTriangle size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--destructive)", marginBottom: 12, letterSpacing: "0.05em" }}>ТОП-5 СТРАХОВ</div>
            {seg.topFears.map((f, i) => <ListItem key={i} text={f} color={"var(--destructive)"} icon={`${i + 1}.`} />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>КАК СТРАХИ ВЛИЯЮТ НА ОТНОШЕНИЯ</div>
            {seg.fearRelationshipEffects.map((e, i) => <ListItem key={i} text={e} icon="→" />)}
          </Card>
        </div>
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>БОЛЕЗНЕННЫЕ ФРАЗЫ КОТОРЫЕ СЛЫШИТ КЛИЕНТ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {seg.painfulPhrases.map((p, i) => <QuoteBlock key={i} text={p.text} from={p.from} />)}
          </div>
        </Card>
      </CollapsibleSection>

      {/* Pain situations */}
      <CollapsibleSection c={c} title="Болевые ситуации" icon={<Flame size={16} />}>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 4, letterSpacing: "0.05em" }}>КОНКРЕТНЫЕ МОМЕНТЫ КОГДА КЛИЕНТ ОСОЗНАЁТ ПРОБЛЕМУ</div>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Ситуации которые вызывают желание немедленно решить проблему</p>
          {seg.painSituations.map((s, i) => <ListItem key={i} text={s} color={"var(--destructive)"} icon="→" />)}
        </Card>
      </CollapsibleSection>

      {/* Obstacles & Myths */}
      <CollapsibleSection c={c} title="Препятствия и мифы" icon={<Ban size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--destructive)", marginBottom: 12, letterSpacing: "0.05em" }}>ПРЕПЯТСТВИЯ НА ПУТИ К РЕШЕНИЮ</div>
            {seg.obstacles.map((o, i) => <ListItem key={i} text={o} color={"var(--destructive)"} icon="✗" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warning)", marginBottom: 12, letterSpacing: "0.05em" }}>МИФЫ И ЛОЖНЫЕ УБЕЖДЕНИЯ</div>
            {seg.myths.map((m, i) => <ListItem key={i} text={m} color={"var(--warning)"} icon="💭" />)}
          </Card>
        </div>
      </CollapsibleSection>

      {/* Past solutions */}
      <CollapsibleSection c={c} title="Прошлый опыт решения проблемы" icon={<RefreshCw size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {seg.pastSolutions.map((ps, i) => (
            <Card key={i}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 10 }}>{ps.name}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6 }}><ThumbsUp size={12} /> НРАВИЛОСЬ</div>
              <p style={{ fontSize: 12, color: "var(--foreground-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>{ps.liked}</p>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--destructive)", marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6 }}><ThumbsDown size={12} /> НЕ НРАВИЛОСЬ</div>
              <p style={{ fontSize: 12, color: "var(--foreground-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>{ps.disliked}</p>
              <div style={{ borderLeft: `3px solid var(--destructive)`, paddingLeft: 10 }}>
                <p style={{ fontSize: 12, color: "var(--foreground-secondary)", fontStyle: "italic", margin: 0 }}>«{ps.quote}»</p>
              </div>
            </Card>
          ))}
        </div>
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>ЧЕГО НЕ ХОЧЕТ ДЕЛАТЬ (ВНУТРЕННИЙ МОНОЛОГ)</div>
          {seg.dontWantToDo.map((d, i) => (
            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < seg.dontWantToDo.length - 1 ? `1px solid var(--muted)` : "none" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>{d.text}</div>
              <div style={{ fontSize: 12, color: "var(--foreground-secondary)", fontStyle: "italic" }}>«{d.quote}»</div>
            </div>
          ))}
        </Card>
      </CollapsibleSection>

      {/* Magic transformation */}
      <CollapsibleSection c={c} title="Волшебная трансформация" icon={<Sparkles size={16} />}>
        <Card style={{ marginBottom: 16, background: `linear-gradient(135deg, var(--card) 60%, var(--success)08 100%)` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 12, letterSpacing: "0.05em" }}>ИДЕАЛЬНЫЙ РЕЗУЛЬТАТ</div>
          <p style={{ fontSize: 14, color: "var(--foreground-secondary)", lineHeight: 1.7, margin: "0 0 16px" }}>{seg.magicTransformation}</p>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>КАК ТРАНСФОРМАЦИЯ ПОВЛИЯЕТ НА ЖИЗНЬ</div>
          {seg.transformationImpact.map((t, i) => <ListItem key={i} text={t} color={"var(--success)"} icon="✓" />)}
        </Card>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>ЧТО СКАЖУТ ДРУГИЕ ПОСЛЕ ТРАНСФОРМАЦИИ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {seg.postTransformationQuotes.map((q, i) => <QuoteBlock key={i} text={q.text} from={q.from} />)}
          </div>
        </Card>
      </CollapsibleSection>

      {/* Market & Objections */}
      <CollapsibleSection c={c} title="Рынок и возражения" icon={<Target size={16} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>ЧТО ДОЛЖЕН УВИДЕТЬ РЫНОК</div>
            {seg.marketSuccessConditions.map((m, i) => <ListItem key={i} text={m} icon="→" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 12, letterSpacing: "0.05em" }}>КОГО ВИНЯТ В ПРОБЛЕМЕ</div>
            {seg.whoBlamedForProblem.map((w, i) => <ListItem key={i} text={w} color={"var(--warning)"} icon="⚡" />)}
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--destructive)", marginBottom: 12, letterSpacing: "0.05em" }}>ТОП-5 ВОЗРАЖЕНИЙ</div>
            {seg.topObjections.map((o, i) => <ListItem key={i} text={o} color={"var(--destructive)"} icon={`${i + 1}.`} />)}
          </Card>
        </div>
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>ЧТО РЫНОК ДОЛЖЕН ОТПУСТИТЬ</div>
          <p style={{ fontSize: 13, color: "var(--foreground-secondary)", lineHeight: 1.65, margin: 0 }}>{seg.mustLetGo}</p>
        </Card>
      </CollapsibleSection>

    </div>
  );
}
