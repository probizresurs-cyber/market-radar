"use client";

import React, { useRef, useState } from "react";
import {
  BookOpen,
  Upload,
  FileText,
  Sparkles,
  Trash2,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wand2,
} from "lucide-react";
import type { Colors } from "@/lib/colors";
import type {
  CompanyStyleDoc,
  CompanyStyleProfile,
  CompanyStyleState,
} from "@/lib/company-style-types";

interface Props {
  c: Colors;
  state: CompanyStyleState;
  onChange: (next: CompanyStyleState) => void;
  companyName: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Не удалось прочитать файл"));
    fr.readAsDataURL(file);
  });
}

export function CompanyStyleView({ c, state, onChange, companyName }: Props) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [pasteName, setPasteName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState<"idle" | "extract" | "analyze">("idle");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const docs = state.docs;
  const profile = state.profile;

  const addDoc = (doc: CompanyStyleDoc) => {
    const next: CompanyStyleState = { ...state, docs: [doc, ...state.docs] };
    onChange(next);
  };

  const removeDoc = (id: string) => {
    onChange({ ...state, docs: state.docs.filter(d => d.id !== id) });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setError(null);
    setOk(null);
    setBusy("extract");
    try {
      for (const file of Array.from(files)) {
        const b64 = await fileToBase64(file);
        const res = await fetch("/api/content/extract-doc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64: b64,
            fileName: file.name,
            mimeType: file.type,
          }),
        });
        const json = await res.json() as { ok: boolean; text?: string; wordCount?: number; error?: string };
        if (!json.ok || !json.text) {
          setError(json.error ?? `Не удалось обработать ${file.name}`);
          continue;
        }
        const doc: CompanyStyleDoc = {
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          source: "upload",
          mimeType: file.type,
          addedAt: new Date().toISOString(),
          wordCount: json.wordCount ?? json.text.split(/\s+/).filter(Boolean).length,
          preview: json.text.slice(0, 400),
          fullText: json.text,
        };
        addDoc(doc);
      }
      setOk("Документы загружены. Теперь запустите анализ стиля.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    }
    setBusy("idle");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) {
      setError("Вставьте текст перед добавлением");
      return;
    }
    setError(null);
    setOk(null);
    setBusy("extract");
    try {
      const res = await fetch("/api/content/extract-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const json = await res.json() as { ok: boolean; text?: string; wordCount?: number; error?: string };
      if (!json.ok || !json.text) {
        setError(json.error ?? "Не удалось обработать текст");
        setBusy("idle");
        return;
      }
      const doc: CompanyStyleDoc = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: pasteName.trim() || `Вставка от ${new Date().toLocaleDateString("ru-RU")}`,
        source: "paste",
        addedAt: new Date().toISOString(),
        wordCount: json.wordCount ?? 0,
        preview: json.text.slice(0, 400),
        fullText: json.text,
      };
      addDoc(doc);
      setPasteText("");
      setPasteName("");
      setOk("Текст добавлен. Запустите анализ стиля.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
    setBusy("idle");
  };

  const runAnalysis = async () => {
    if (!docs.length) {
      setError("Нужен хотя бы один документ для анализа");
      return;
    }
    setError(null);
    setOk(null);
    setBusy("analyze");
    try {
      const res = await fetch("/api/content/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docs: docs.map(d => ({ id: d.id, name: d.name, fullText: d.fullText })),
          companyName,
        }),
      });
      const json = await res.json() as { ok: boolean; profile?: CompanyStyleProfile; error?: string };
      if (!json.ok || !json.profile) {
        setError(json.error ?? "Ошибка анализа стиля");
        setBusy("idle");
        return;
      }
      onChange({ ...state, profile: json.profile, applyToGeneration: true });
      setOk("Стиль компании сохранён. Все новые посты и статьи будут генерироваться в этом стиле.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
    setBusy("idle");
  };

  const toggleApply = () => {
    onChange({ ...state, applyToGeneration: !state.applyToGeneration });
  };

  const clearProfile = () => {
    if (!confirm("Удалить сохранённый профиль стиля?")) return;
    onChange({ ...state, profile: null });
  };

  // ── UI ──────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 8px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", boxShadow: c.shadow,
          }}
        >
          <BookOpen size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: c.textPrimary, margin: 0, letterSpacing: -0.5 }}>
            Стиль компании
          </h1>
          <p style={{ fontSize: 14, color: c.textMuted, margin: "4px 0 0" }}>
            Загрузите свои статьи или тексты — AI изучит вашу манеру письма и будет генерировать весь контент в ней
          </p>
        </div>
      </div>

      {/* Status strip — three explicit states */}
      {(() => {
        const hasDocs = docs.length > 0;
        const hasProfile = !!profile;
        let icon: React.ReactNode;
        let message: React.ReactNode;
        let bgCol: string, borderCol: string;
        if (hasProfile) {
          icon = <CheckCircle2 size={20} color={c.accentGreen} />;
          bgCol = `${c.accentGreen}14`;
          borderCol = c.accentGreen;
          message = (
            <>
              <b>Шаг 3 из 3:</b> стиль извлечён из {profile!.basedOnDocIds.length}{" "}
              {profile!.basedOnDocIds.length === 1 ? "документа" : "документов"}.{" "}
              {state.applyToGeneration ? (
                <span style={{ color: c.accentGreen, fontWeight: 600 }}>Применяется к новым постам и статьям.</span>
              ) : (
                <span style={{ color: c.accentRed }}>Сейчас НЕ применяется — включите тумблер справа.</span>
              )}
            </>
          );
        } else if (hasDocs) {
          icon = <Sparkles size={20} color={c.accentWarm} />;
          bgCol = `${c.accentWarm}14`;
          borderCol = c.accentWarm;
          message = (
            <>
              <b>Шаг 2 из 3:</b> загружено {docs.length}{" "}
              {docs.length === 1 ? "документ" : docs.length < 5 ? "документа" : "документов"}.
              {" "}Нажмите «Проанализировать стиль» ниже, чтобы AI извлёк из них тон, словарь и приёмы.
            </>
          );
        } else {
          icon = <AlertCircle size={20} color={c.textMuted} />;
          bgCol = c.bgCard;
          borderCol = c.borderLight;
          message = <><b>Шаг 1 из 3:</b> загрузите 2-5 своих статей, постов или КП — AI изучит вашу манеру письма.</>;
        }
        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
            background: bgCol, border: `1px solid ${borderCol}`,
            borderRadius: 12, marginBottom: 24,
          }}>
            {icon}
            <div style={{ flex: 1, fontSize: 13, color: c.textSecondary, lineHeight: 1.5 }}>{message}</div>
            {hasProfile && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: c.textPrimary, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={state.applyToGeneration}
                  onChange={toggleApply}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                Применять
              </label>
            )}
          </div>
        );
      })()}

      {/* Error / ok */}
      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: `${c.accentRed}18`, color: c.accentRed, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}
      {ok && (
        <div style={{ padding: 12, borderRadius: 10, background: `${c.accentGreen}18`, color: c.accentGreen, marginBottom: 16, fontSize: 13 }}>
          {ok}
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        {/* Left: input */}
        <div
          style={{
            background: c.bgCard, border: `1px solid ${c.borderLight}`,
            borderRadius: 16, padding: 22, boxShadow: c.shadow,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: "0 0 14px" }}>
            Добавить материал
          </h3>

          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setMode("upload")}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                border: `1px solid ${mode === "upload" ? c.accent : c.borderLight}`,
                background: mode === "upload" ? `${c.accent}18` : "transparent",
                color: mode === "upload" ? c.accent : c.textSecondary,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Upload size={14} /> Файл
            </button>
            <button
              onClick={() => setMode("paste")}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                border: `1px solid ${mode === "paste" ? c.accent : c.borderLight}`,
                background: mode === "paste" ? `${c.accent}18` : "transparent",
                color: mode === "paste" ? c.accent : c.textSecondary,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <ClipboardPaste size={14} /> Вставить текст
            </button>
          </div>

          {mode === "upload" ? (
            <div>
              <label
                htmlFor="company-style-file"
                style={{
                  display: "block", padding: 24, border: `2px dashed ${c.borderLight}`,
                  borderRadius: 12, textAlign: "center", cursor: "pointer", color: c.textMuted,
                  fontSize: 13, lineHeight: 1.5,
                }}
              >
                <Upload size={24} style={{ margin: "0 auto 8px", display: "block", color: c.accent }} />
                <b style={{ color: c.textPrimary }}>Перетащите файл</b> или нажмите, чтобы выбрать<br/>
                Поддерживается: .docx, .txt, .md, .html<br/>
                <span style={{ fontSize: 11 }}>PDF — скопируйте текст и используйте «Вставить текст»</span>
                <input
                  ref={fileRef}
                  id="company-style-file"
                  type="file"
                  accept=".docx,.txt,.md,.markdown,.html,.htm,.csv,text/plain,text/html,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  onChange={e => handleUpload(e.target.files)}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={pasteName}
                onChange={e => setPasteName(e.target.value)}
                placeholder="Название материала (необязательно)"
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  border: `1px solid ${c.borderLight}`, background: c.bg,
                  color: c.textPrimary, fontSize: 13, marginBottom: 10, boxSizing: "border-box",
                }}
              />
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Вставьте сюда текст статьи, поста или коммерческого предложения…"
                rows={8}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  border: `1px solid ${c.borderLight}`, background: c.bg,
                  color: c.textPrimary, fontSize: 13, lineHeight: 1.5,
                  fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
                }}
              />
              <button
                onClick={handlePaste}
                disabled={busy !== "idle"}
                style={{
                  marginTop: 10, padding: "10px 18px", borderRadius: 8,
                  background: c.accent, color: "#fff", border: "none",
                  fontSize: 13, fontWeight: 600, cursor: busy !== "idle" ? "wait" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                {busy === "extract" ? <Loader2 size={14} className="spin" /> : <ClipboardPaste size={14} />}
                Добавить текст
              </button>
            </div>
          )}

        </div>

        {/* Right: docs list */}
        <div
          style={{
            background: c.bgCard, border: `1px solid ${c.borderLight}`,
            borderRadius: 16, padding: 22, boxShadow: c.shadow,
            maxHeight: 520, overflowY: "auto",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: "0 0 14px" }}>
            Загруженные материалы {docs.length > 0 && <span style={{ color: c.textMuted, fontWeight: 500 }}>· {docs.length}</span>}
          </h3>

          {docs.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: c.textMuted, fontSize: 13 }}>
              <FileText size={36} style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }} />
              Пока нет материалов.<br />Загрузите 2-5 статей или постов вашей компании.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {docs.map(doc => (
                <div
                  key={doc.id}
                  style={{
                    padding: 12, border: `1px solid ${c.borderLight}`, borderRadius: 10,
                    background: c.bg,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                    <FileText size={16} color={c.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, wordBreak: "break-word" }}>
                        {doc.name}
                      </div>
                      <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>
                        {doc.wordCount} слов · {doc.source === "upload" ? "файл" : "вставка"}
                      </div>
                    </div>
                    <button
                      onClick={() => removeDoc(doc.id)}
                      style={{
                        background: "transparent", border: "none", color: c.textMuted,
                        cursor: "pointer", padding: 4, borderRadius: 6,
                      }}
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{
                    fontSize: 12, color: c.textSecondary, lineHeight: 1.45,
                    maxHeight: 60, overflow: "hidden", position: "relative",
                  }}>
                    {doc.preview}{doc.preview.length >= 400 ? "…" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analyze action — separate step, so upload and analyze don't blur together */}
      <div
        style={{
          background: c.bgCard,
          border: `2px solid ${docs.length > 0 && !profile ? c.accentWarm : c.borderLight}`,
          borderRadius: 16, padding: 22, marginBottom: 28,
          display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
          boxShadow: c.shadow,
        }}
      >
        <div
          style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: `${c.accent}15`, color: c.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Wand2 size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 4 }}>
            {profile ? "Пересобрать стиль" : "Проанализировать стиль"}
          </div>
          <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.5 }}>
            {docs.length === 0
              ? "Сначала загрузите хотя бы 1 материал слева. Рекомендуем 2-5 для точного профиля."
              : profile
                ? `AI заново пройдёт по ${docs.length} документам и обновит профиль стиля.`
                : `AI пройдёт по ${docs.length} ${docs.length === 1 ? "документу" : "документам"} и извлечёт тон, словарь, структуру и приёмы.`}
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={!docs.length || busy !== "idle"}
          style={{
            padding: "12px 22px", borderRadius: 10,
            background: !docs.length ? c.borderLight : `linear-gradient(135deg, ${c.accent}, ${c.accentWarm})`,
            color: !docs.length ? c.textMuted : "#fff",
            border: "none", fontSize: 14, fontWeight: 700,
            cursor: !docs.length || busy !== "idle" ? "not-allowed" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
            boxShadow: !docs.length ? "none" : c.shadow,
            whiteSpace: "nowrap",
          }}
        >
          {busy === "analyze" ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
          {busy === "analyze" ? "Анализирую…" : profile ? "Пересобрать" : "Запустить анализ"}
        </button>
      </div>

      {/* Profile card */}
      {profile && (
        <div
          style={{
            background: c.bgCard, border: `1px solid ${c.borderLight}`,
            borderRadius: 16, padding: 24, boxShadow: c.shadow, marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: c.textPrimary, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={20} color={c.accent} />
              Профиль стиля
            </h3>
            <button
              onClick={clearProfile}
              style={{
                padding: "6px 12px", borderRadius: 8, background: "transparent",
                border: `1px solid ${c.borderLight}`, color: c.textMuted,
                fontSize: 12, cursor: "pointer",
              }}
            >
              Очистить
            </button>
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.6, color: c.textSecondary, marginTop: 0 }}>
            {profile.summary}
          </p>

          {/* Top 3 summary cards: Tone of Voice / Content specifics / Style */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginTop: 16, marginBottom: 20 }}>
            <SummaryCard
              c={c}
              label="Tone of Voice"
              emoji="🗣"
              value={profile.toneDescriptors.slice(0, 4).join(", ") || "—"}
              sub={`Длина предложений: ${profile.sentenceLength}`}
            />
            <SummaryCard
              c={c}
              label="Специфика контента"
              emoji="📌"
              value={profile.vocabulary.terminology.slice(0, 4).join(", ") || profile.structurePatterns[0] || "—"}
              sub={profile.structurePatterns.slice(0, 1).join(" ")}
            />
            <SummaryCard
              c={c}
              label="Стиль"
              emoji="✍"
              value={profile.rhetoricalDevices.slice(0, 3).join(", ") || profile.punctuationQuirks[0] || "—"}
              sub={profile.punctuationQuirks.slice(0, 1).join(" ")}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 18 }}>
            <StyleBlock c={c} title="Тон" items={profile.toneDescriptors} accent />
            <StyleBlock c={c} title={`Длина предложений: ${profile.sentenceLength}`} items={[]} />
            <StyleBlock c={c} title="Любимые слова" items={profile.vocabulary.favoriteWords} />
            <StyleBlock c={c} title="Избегает" items={profile.vocabulary.avoidWords} />
            <StyleBlock c={c} title="Терминология" items={profile.vocabulary.terminology} />
            <StyleBlock c={c} title="Структурные приёмы" items={profile.structurePatterns} />
            <StyleBlock c={c} title="Риторика" items={profile.rhetoricalDevices} />
            <StyleBlock c={c} title="Пунктуация" items={profile.punctuationQuirks} />
          </div>

          {profile.examplePhrases.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                Цитаты-образцы
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {profile.examplePhrases.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 14px", borderLeft: `3px solid ${c.accent}`,
                      background: `${c.accent}08`, borderRadius: "0 8px 8px 0",
                      fontSize: 13, color: c.textSecondary, fontStyle: "italic", lineHeight: 1.5,
                    }}
                  >
                    «{q}»
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
            <div style={{ padding: 14, borderRadius: 10, background: `${c.accentGreen}10`, border: `1px solid ${c.accentGreen}40` }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: c.accentGreen, textTransform: "uppercase", margin: "0 0 8px" }}>
                Так — пиши
              </h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: c.textSecondary, lineHeight: 1.6 }}>
                {profile.dosAndDonts.dos.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
            <div style={{ padding: 14, borderRadius: 10, background: `${c.accentRed}10`, border: `1px solid ${c.accentRed}40` }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: c.accentRed, textTransform: "uppercase", margin: "0 0 8px" }}>
                Так — не пиши
              </h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: c.textSecondary, lineHeight: 1.6 }}>
                {profile.dosAndDonts.donts.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function SummaryCard({ c, label, emoji, value, sub }: { c: Colors; label: string; emoji: string; value: string; sub?: string }) {
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: `linear-gradient(135deg, ${c.accent}0C, ${c.accentWarm}0A)`,
      border: `1px solid ${c.borderLight}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, lineHeight: 1.4, wordBreak: "break-word" }}>
        {value}
      </div>
      {sub && sub.trim() && (
        <div style={{ fontSize: 11, color: c.textMuted, marginTop: 6, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function StyleBlock({ c, title, items, accent }: { c: Colors; title: string; items: string[]; accent?: boolean }) {
  return (
    <div>
      <h4 style={{
        fontSize: 12, fontWeight: 700, color: accent ? c.accent : c.textMuted,
        textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px",
      }}>
        {title}
      </h4>
      {items.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {items.map((it, i) => (
            <span
              key={i}
              style={{
                padding: "4px 10px", borderRadius: 999,
                background: `${c.accent}12`, color: c.textPrimary,
                fontSize: 12, fontWeight: 500,
              }}
            >
              {it}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
