"use client";

/**
 * /astro-rebuild — ТЕСТОВАЯ страница пересборки сайта в Astro-проект.
 * Ввод URL → /api/rebuild-astro (скрейп + Claude) → дерево файлов Astro-проекта,
 * превью каждого файла и скачивание готового .zip (jszip, на клиенте).
 *
 * Пока не на проде/не в КП — отдельная страница для тестов. Требует логина
 * (роут за checkAiAccess). Гейт на «пробную» подписку добавим при выкатке.
 */

import { useMemo, useState } from "react";
import type { AstroFile, RebuildAstroResult } from "@/app/api/rebuild-astro/route";

type FileNode = {
  name: string;
  path: string;
  children: Record<string, FileNode>;
  file?: AstroFile;
};

function buildTree(files: AstroFile[]): FileNode {
  const root: FileNode = { name: "", path: "", children: {} };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1;
      if (!node.children[part]) {
        node.children[part] = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          children: {},
        };
      }
      node = node.children[part];
      if (isLeaf) node.file = f;
    });
  }
  return root;
}

function TreeView({ node, depth, selected, onSelect }: {
  node: FileNode; depth: number; selected: string; onSelect: (f: AstroFile) => void;
}) {
  const entries = Object.values(node.children).sort((a, b) => {
    const aDir = Object.keys(a.children).length > 0 && !a.file;
    const bDir = Object.keys(b.children).length > 0 && !b.file;
    if (aDir !== bDir) return aDir ? -1 : 1; // папки выше
    return a.name.localeCompare(b.name);
  });
  return (
    <>
      {entries.map((child) => {
        const isDir = !child.file;
        const isSel = child.file?.path === selected;
        return (
          <div key={child.path}>
            <div
              onClick={() => child.file && onSelect(child.file)}
              style={{
                padding: "4px 8px", paddingLeft: 8 + depth * 16, cursor: child.file ? "pointer" : "default",
                fontSize: 13, borderRadius: 6, display: "flex", alignItems: "center", gap: 6,
                background: isSel ? "color-mix(in srgb, var(--primary, #2a78d6) 14%, transparent)" : "transparent",
                color: isSel ? "var(--primary, #2a78d6)" : "inherit", fontWeight: isSel ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              <span style={{ opacity: 0.7 }}>{isDir ? "📁" : "📄"}</span>
              {child.name}
            </div>
            {isDir && <TreeView node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />}
          </div>
        );
      })}
    </>
  );
}

export default function AstroRebuildPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RebuildAstroResult | null>(null);
  const [active, setActive] = useState<AstroFile | null>(null);
  const [zipping, setZipping] = useState(false);

  const tree = useMemo(() => (result ? buildTree(result.files) : null), [result]);

  const [view, setView] = useState<"preview" | "code">("preview");

  const run = async () => {
    const u = url.trim();
    if (!u) { setError("Введите URL сайта"); return; }
    setLoading(true); setError(null); setResult(null); setActive(null); setView("preview");
    try {
      const res = await fetch("/api/rebuild-astro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ url: u }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Ошибка пересборки");
      const r = json as RebuildAstroResult;
      setResult(r);
      // Открываем главную страницу проекта по умолчанию
      setActive(r.files.find(f => /index\.astro$/.test(f.path)) ?? r.files[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const downloadZip = async () => {
    if (!result) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const f of result.files) zip.file(f.path, f.content);
      const blob = await zip.generateAsync({ type: "blob" });
      const host = (() => { try { return new URL(result.source.url).hostname.replace(/^www\./, ""); } catch { return "site"; } })();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${host}-astro.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось собрать zip");
    } finally {
      setZipping(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 850, margin: "0 0 6px" }}>Пересборка сайта в Astro</h1>
      <p style={{ fontSize: 14, color: "var(--muted-foreground, #6b7280)", margin: "0 0 20px", lineHeight: 1.5 }}>
        Тестовая страница. Вставьте адрес сайта — соберём его заново как чистый Astro-проект,
        исправив найденные SEO- и структурные дыры. На выходе — готовый проект для{" "}
        <code>npm install &amp;&amp; npm run build</code>.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !loading) run(); }}
          placeholder="https://example.com"
          disabled={loading}
          style={{
            flex: 1, minWidth: 260, height: 44, padding: "0 14px", fontSize: 15,
            border: "1px solid var(--border, #d1d5db)", borderRadius: 10, background: "var(--background, #fff)",
            color: "inherit",
          }}
        />
        <button
          onClick={run}
          disabled={loading}
          style={{
            height: 44, padding: "0 22px", fontSize: 15, fontWeight: 700, borderRadius: 10, border: "none",
            background: loading ? "var(--muted, #9ca3af)" : "var(--primary, #2a78d6)", color: "#fff",
            cursor: loading ? "default" : "pointer", whiteSpace: "nowrap",
          }}
        >
          {loading ? "Пересобираем…" : "Пересобрать"}
        </button>
      </div>

      {loading && (
        <div style={{ padding: 20, fontSize: 14, color: "var(--muted-foreground, #6b7280)" }}>
          Скрейпим сайт и генерируем Astro-проект — это может занять до минуты…
        </div>
      )}

      {error && (
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "color-mix(in srgb, #dc2626 10%, transparent)", color: "#dc2626", fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground, #6b7280)", marginBottom: 4 }}>Что собрали</div>
                <div style={{ fontSize: 15, lineHeight: 1.5 }}>{result.summary || result.source.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted-foreground, #6b7280)", marginTop: 6 }}>
                  Источник: {result.source.url} · файлов: {result.files.length} · модель: {result.modelUsed}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {result.previewUrl && (
                  <a
                    href={result.previewUrl} target="_blank" rel="noopener noreferrer"
                    style={{
                      height: 42, padding: "0 20px", fontSize: 14, fontWeight: 700, borderRadius: 10,
                      background: "var(--primary, #2a78d6)", color: "#fff", cursor: "pointer", whiteSpace: "nowrap",
                      display: "inline-flex", alignItems: "center", textDecoration: "none",
                    }}
                  >
                    Открыть сайт ↗
                  </a>
                )}
                <button
                  onClick={downloadZip}
                  disabled={zipping}
                  style={{
                    height: 42, padding: "0 20px", fontSize: 14, fontWeight: 700, borderRadius: 10, border: "none",
                    background: "var(--success, #059669)", color: "#fff", cursor: zipping ? "default" : "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {zipping ? "Пакуем…" : "Скачать .zip"}
                </button>
              </div>
            </div>

            {result.source.issues.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Найдено на исходном сайте ({result.source.issues.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                  {result.source.issues.map((i, n) => <li key={n}>{i}</li>)}
                </ul>
              </div>
            )}
            {result.fixes.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success, #059669)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Исправлено в новом проекте ({result.fixes.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                  {result.fixes.map((i, n) => <li key={n}>{i}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Переключатель: живой сайт / исходники */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {(["preview", "code"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  height: 34, padding: "0 16px", fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: "1px solid var(--border, #e5e7eb)", cursor: "pointer",
                  background: view === v ? "var(--primary, #2a78d6)" : "transparent",
                  color: view === v ? "#fff" : "inherit",
                }}
              >
                {v === "preview" ? "Живой сайт" : "Исходники"}
              </button>
            ))}
          </div>

          {view === "preview" ? (
            <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
              {result.previewUrl ? (
                <iframe
                  src={result.previewUrl}
                  title="Превью пересобранного сайта"
                  style={{ width: "100%", height: 640, border: "none", display: "block" }}
                />
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "var(--muted-foreground, #6b7280)" }}>
                  Живое превью недоступно (не удалось сохранить). Скачайте .zip и запустите локально.
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 280px) 1fr", gap: 16, alignItems: "start" }}>
              <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, padding: 8, maxHeight: 560, overflow: "auto" }}>
                {tree && <TreeView node={tree} depth={0} selected={active?.path ?? ""} onSelect={setActive} />}
              </div>
              <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border, #e5e7eb)", fontSize: 13, fontFamily: "ui-monospace, monospace", color: "var(--muted-foreground, #6b7280)" }}>
                  {active?.path ?? "выберите файл"}
                </div>
                <pre style={{
                  margin: 0, padding: 16, fontSize: 12.5, lineHeight: 1.55, overflow: "auto", maxHeight: 520,
                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", whiteSpace: "pre",
                }}>
                  {active?.content ?? ""}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
