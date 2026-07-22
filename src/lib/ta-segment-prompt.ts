import type { TASegment } from "@/lib/ta-types";

/**
 * Промпт-блок «пиши для конкретного аватара ЦА» — общий для всех генераторов
 * контента (посты, сторис, карусели, рилсы, хуки, план).
 *
 * До этого сегменты ЦА использовал только auto-ideas-batch, остальные
 * генераторы писали «для всех сразу» — обещание «рубрики, хуки и темы для
 * разных аватаров» не выполнялось. Теперь фронт передаёт выбранный сегмент
 * (taSegment) в любой generate-* роут, и текст пишется под его боли,
 * возражения и язык.
 *
 * Блок компактный (не весь TASegment): только то, что напрямую влияет на
 * текст. Полный сегмент раздувал бы промпт в несколько тысяч токенов.
 */
export function buildSegmentBlock(seg: TASegment | null | undefined): string {
  if (!seg?.segmentName) return "";
  const lines: string[] = [
    `\nЦЕЛЕВОЙ АВАТАР (пиши именно для этого человека, его словами и про его боли):`,
    `- Сегмент: ${seg.segmentName}${seg.isGolden ? " (приоритетный)" : ""}`,
  ];
  const d = seg.demographics;
  if (d?.personaName) lines.push(`- Персона: ${d.personaName}${d.age ? `, ${d.age}` : ""}${d.lifestyle ? ` — ${d.lifestyle}` : ""}`);
  if (seg.mainProblems?.length) lines.push(`- Главные боли: ${seg.mainProblems.slice(0, 4).join("; ")}`);
  if (seg.topFears?.length) lines.push(`- Страхи: ${seg.topFears.slice(0, 3).join("; ")}`);
  if (seg.topObjections?.length) lines.push(`- Возражения (закрывай их, не споря в лоб): ${seg.topObjections.slice(0, 3).join("; ")}`);
  if (seg.painfulPhrases?.length) {
    lines.push(`- Как говорит сам: ${seg.painfulPhrases.slice(0, 2).map(q => `«${q.text}»`).join(", ")}`);
  }
  if (seg.magicTransformation) lines.push(`- Желаемая трансформация: ${seg.magicTransformation}`);
  lines.push(`Не упоминай слово «сегмент» и не пересказывай этот блок — просто пиши так, чтобы этот человек узнал себя.`);
  return lines.join("\n") + "\n";
}

/**
 * Короткая сводка по нескольким сегментам — для контент-плана (там нужен не
 * один аватар, а раскладка рубрик/тем по всем).
 */
export function buildSegmentsSummary(segments: TASegment[] | null | undefined, max = 3): string {
  if (!segments?.length) return "";
  const rows = segments.slice(0, max).map((s) => {
    const pains = s.mainProblems?.slice(0, 3).join("; ") || "—";
    return `- «${s.segmentName}»${s.isGolden ? " (золотой)" : ""}: боли — ${pains}${s.magicTransformation ? `; хочет — ${s.magicTransformation}` : ""}`;
  });
  return `\nСЕГМЕНТЫ ЦЕЛЕВОЙ АУДИТОРИИ (у каждой рубрики/темы указывай, для какого сегмента она в первую очередь):\n${rows.join("\n")}\n`;
}
