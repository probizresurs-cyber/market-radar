"use client";

import React, { useState } from "react";
import type { Colors } from "@/lib/colors";
import type { AnalysisResult } from "@/lib/types";
import type { TAResult, TAAudienceType } from "@/lib/ta-types";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DataBadge } from "@/components/ui/DataBadge";
import {
  Brain, Rocket, User, Globe, Zap, AlertTriangle, Flame, Ban,
  RefreshCw, Sparkles, Target, Loader2, ThumbsUp, ThumbsDown,
} from "lucide-react";

export function NewTAView({ c, myCompany, isAnalyzing, existingTypes = [], onAnalyze }: {
  c: Colors; myCompany: AnalysisResult | null;
  isAnalyzing: boolean;
  /** Какие типы анализа уже сохранены — показываем подсказку, что добавится параллельно. */
  existingTypes?: TAAudienceType[];
  onAnalyze: (niche: string, extra: string, audienceType: TAAudienceType) => Promise<void>;
}) {
  const [niche, setNiche] = useState(myCompany?.company.description?.split("\n")[0]?.slice(0, 200) ?? "");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<string | null>(null);
  // По умолчанию выбираем тип, которого ещё нет (если один уже есть) — чтобы упростить "второй анализ".
  const [audienceType, setAudienceType] = useState<TAAudienceType>(() => {
    if (existingTypes.includes("b2c") && !existingTypes.includes("b2b")) return "b2b";
    if (existingTypes.includes("b2b") && !existingTypes.includes("b2c")) return "b2c";
    return "b2c";
  });

  const handleSubmit = async () => {
    if (!niche.trim()) { setError("Опишите нишу и продукт"); return; }
    setError(null);
    try { await onAnalyze(niche.trim(), extra.trim(), audienceType); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
  };

  const willOverwrite = existingTypes.includes(audienceType);
  const willAddSecond = existingTypes.length > 0 && !willOverwrite;

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>Анализ целевой аудитории</h1>
      <p style={{ fontSize: 13, color: "var(--foreground-secondary)", margin: "0 0 28px" }}>
        Мы проведём глубокий психологический анализ ЦА: сегменты, боли, страхи, мотивы, возражения и триггеры покупки.
      </p>

      {/* Выбор типа аудитории */}
      <div style={{ background: "var(--card)", borderRadius: 16, border: `1px solid var(--border)`, padding: 20, boxShadow: "var(--shadow)", marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
          Тип аудитории <span style={{ color: "var(--destructive)" }}>*</span>
        </label>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
          B2C — продаём физ. лицам. B2B — продаём компаниям (юр. лицам), анализируем ЛПР и DMU.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {(["b2c", "b2b"] as const).map(t => {
            const active = audienceType === t;
            const has = existingTypes.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setAudienceType(t)}
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 10,
                  border: active ? `2px solid var(--primary)` : `1px solid var(--border)`,
                  background: active ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "var(--background)",
                  color: active ? "var(--primary)" : "var(--foreground)",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{t === "b2c" ? "B2C" : "B2B"}</span>
                  {has && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--success)", background: "color-mix(in oklch, var(--success) 10%, transparent)", padding: "1px 6px", borderRadius: 4 }}>есть</span>}
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, color: active ? "var(--primary)" : "var(--muted-foreground)", textAlign: "left" }}>
                  {t === "b2c" ? "Физ. лица, частные покупатели" : "Юр. лица, ЛПР, DMU, циклы сделок"}
                </div>
              </button>
            );
          })}
        </div>
        {willAddSecond && (
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--primary)", background: "color-mix(in oklch, var(--primary) 6%, transparent)", padding: "6px 10px", borderRadius: 6 }}>
            У вас уже есть анализ {existingTypes.includes("b2c") ? "B2C" : "B2B"}. Новый анализ {audienceType.toUpperCase()} будет сохранён отдельно — сможете переключаться между ними в дашборде ЦА.
          </div>
        )}
        {willOverwrite && existingTypes.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--warning)", background: "color-mix(in oklch, var(--warning) 8%, transparent)", padding: "6px 10px", borderRadius: 6 }}>
            Анализ {audienceType.toUpperCase()} уже существует — запуск перезапишет предыдущий. Чтобы добавить второй — выберите другой тип.
          </div>
        )}
      </div>

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

export function TADashboardView({ c, data, altData, onSwitchType, onRunNew }: {
  c: Colors;
  data: TAResult;
  altData?: TAResult | null;
  onSwitchType?: (t: TAAudienceType) => void;
  onRunNew?: () => void;
}) {
  const [activeSegment, setActiveSegment] = useState(0);

  // Reset segment index when switching between B2C / B2B
  const activeType = data.audienceType ?? "b2c";
  const prevTypeRef = React.useRef(activeType);
  if (prevTypeRef.current !== activeType) {
    prevTypeRef.current = activeType;
    setActiveSegment(0);
  }

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
      {/* B2C / B2B type switcher */}
      {(altData || onRunNew) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {(["b2c", "b2b"] as TAAudienceType[]).map((t) => {
            const isActive = activeType === t;
            const hasAlt = altData && (altData.audienceType ?? "b2c") === t;
            const hasCurrent = isActive;
            const exists = hasCurrent || hasAlt;
            return (
              <button
                key={t}
                onClick={() => {
                  if (isActive) return;
                  if (hasAlt && onSwitchType) onSwitchType(t);
                  else if (!exists && onRunNew) onRunNew();
                }}
                style={{
                  padding: "7px 20px",
                  borderRadius: 10,
                  border: `2px solid ${isActive ? "var(--primary)" : exists ? "var(--border)" : "var(--muted)"}`,
                  background: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "#fff" : exists ? "var(--foreground-secondary)" : "var(--muted-foreground)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: isActive ? "default" : "pointer",
                  opacity: !exists && !onRunNew ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.15s",
                }}
              >
                {t.toUpperCase()}
                {isActive && <span style={{ fontSize: 10, background: "rgba(255,255,255,0.25)", borderRadius: 6, padding: "1px 6px" }}>активен</span>}
                {!isActive && exists && <span style={{ fontSize: 10, background: "var(--primary)20", color: "var(--primary)", borderRadius: 6, padding: "1px 6px" }}>есть</span>}
                {!isActive && !exists && <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>+ запустить</span>}
              </button>
            );
          })}
          <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 4 }}>
            Переключайтесь между B2C и B2B анализами
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "var(--foreground)" }}>
            Анализ ЦА — {data.companyName}
            {activeType === "b2b" && <span style={{ marginLeft: 8, fontSize: 14, background: "var(--primary)20", color: "var(--primary)", borderRadius: 8, padding: "2px 10px", fontWeight: 700 }}>B2B</span>}
          </h1>
          <DataBadge variant="ai" source="Claude" title="Портрет ЦА полностью сгенерирован AI на основе данных о компании и нише." />
        </div>
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
