"use client";

/**
 * /kp-gen/<id> — просмотр сгенерированного КП менеджером (за гейтом /kp-ru,
 * /kp-de). Тянет полную генерацию (bundle + company) и рендерит KpProposal
 * так же, как /kp-sozdavaya, но с динамическим бандлом.
 */

import { use, useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import type { PilotBundle } from "@/components/kp/pilot-sozdavay-data";
import { KpProposal } from "@/components/kp/KpProposal";

interface Gen {
  id: string; url: string; company_name: string | null; status: string;
  bundle: PilotBundle | null; company: AnalysisResult | null;
  share_token: string | null; share_password: string | null;
}

export default function KpGenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<{ status: "loading" | "ok" | "error"; error?: string; gen?: Gen }>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/kp-generate/${id}`, { credentials: "include" });
        const json = await res.json();
        if (!json.ok) { setState({ status: "error", error: json.error }); return; }
        setState({ status: "ok", gen: json.generation });
      } catch (e) {
        setState({ status: "error", error: e instanceof Error ? e.message : "Ошибка" });
      }
    })();
  }, [id]);

  if (state.status === "loading") {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui", color: "#6b7280" }}>Загружаем КП…</div>;
  }
  if (state.status === "error" || !state.gen) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui", color: "#dc2626" }}>{state.error || "КП не найдено"}</div>;
  }
  const g = state.gen;
  if (g.status !== "done" || !g.bundle || !g.company) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "#6b7280", padding: 40, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            {g.status === "error" ? "Генерация не удалась" : "КП ещё генерируется…"}
          </div>
          <div style={{ fontSize: 14 }}>{g.status === "error" ? "Запустите заново из истории." : "Обновите страницу через минуту."}</div>
        </div>
      </div>
    );
  }

  return (
    <KpProposal
      company={g.company}
      competitors={[]}
      generatedBundle={g.bundle}
    />
  );
}
