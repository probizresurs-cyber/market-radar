import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Map our preset style IDs to Slidev themes
const THEME_MAP: Record<string, { theme: string; colorSchema?: string }> = {
  minimalist: { theme: "apple-basic" },
  corporate:  { theme: "seriph" },
  bright:     { theme: "purplin" },
  warm:       { theme: "academic" },
  dark:       { theme: "seriph", colorSchema: "dark" },
  fresh:      { theme: "default" },
};

interface Stat { value: string; label: string }
interface Slide {
  title: string;
  subtitle?: string;
  type: "cover" | "bullets" | "stats" | "quote" | "two-column" | "cta";
  content?: string;
  bullets?: string[];
  stats?: Stat[];
  quote?: string;
  note?: string;
  leftTitle?: string;
  leftContent?: string;
  rightTitle?: string;
  rightContent?: string;
  isEdited?: boolean;
}

function generateMermaidChart(stats: Stat[]): string {
  if (!stats || stats.length === 0) return "";

  // Check if values look like percentages or are all numeric
  const allNumeric = stats.every(s => {
    const num = parseFloat(s.value.replace(/[^0-9.]/g, ""));
    return !isNaN(num);
  });

  if (!allNumeric) return "";

  // Use pie chart when values look like shares/percentages
  const hasPercent = stats.some(s => s.value.includes("%"));
  if (hasPercent) {
    const entries = stats
      .map(s => {
        const num = parseFloat(s.value.replace(/[^0-9.]/g, "")) || 10;
        return `    "${s.label}" : ${num}`;
      })
      .join("\n");
    return `\`\`\`mermaid\npie\n${entries}\n\`\`\``;
  }

  // Bar chart via xychart-beta
  const labels = stats.map(s => `"${s.label.replace(/"/g, "'").slice(0, 20)}"`).join(", ");
  const values = stats.map(s => parseFloat(s.value.replace(/[^0-9.]/g, "")) || 0).join(", ");
  return `\`\`\`mermaid\nxychart-beta\n    x-axis [${labels}]\n    bar [${values}]\n\`\`\``;
}

function slideToMarkdown(slide: Slide, idx: number): string {
  const lines: string[] = [];

  // Separator (first slide is the cover, no leading ---)
  if (idx > 0) lines.push("---");

  switch (slide.type) {
    case "cover":
      lines.push("layout: cover");
      lines.push("class: text-center");
      lines.push("---");
      lines.push("");
      lines.push(`# ${slide.title}`);
      if (slide.subtitle) {
        lines.push("");
        lines.push(slide.subtitle);
      }
      if (slide.content) {
        lines.push("");
        lines.push(`<p class="op-70 mt-2">${slide.content}</p>`);
      }
      break;

    case "bullets":
      lines.push("---");
      lines.push("");
      lines.push(`# ${slide.title}`);
      if (slide.subtitle) {
        lines.push("");
        lines.push(`> ${slide.subtitle}`);
      }
      if (slide.content) {
        lines.push("");
        lines.push(slide.content);
      }
      if (slide.bullets && slide.bullets.length > 0) {
        lines.push("");
        slide.bullets.forEach(b => lines.push(`- ${b}`));
      }
      break;

    case "stats": {
      lines.push("---");
      lines.push("");
      lines.push(`# ${slide.title}`);
      if (slide.subtitle) {
        lines.push("");
        lines.push(`*${slide.subtitle}*`);
      }
      if (slide.stats && slide.stats.length > 0) {
        const chart = generateMermaidChart(slide.stats);
        if (chart) {
          lines.push("");
          lines.push(chart);
        }
        // Also add raw stats as a table
        lines.push("");
        lines.push("| Показатель | Значение |");
        lines.push("|---|---|");
        slide.stats.forEach(s => lines.push(`| ${s.label} | **${s.value}** |`));
      }
      break;
    }

    case "quote":
      lines.push("layout: statement");
      lines.push("---");
      lines.push("");
      lines.push(`# ${slide.title}`);
      if (slide.quote) {
        lines.push("");
        lines.push(`> ${slide.quote}`);
      }
      if (slide.content) {
        lines.push("");
        lines.push(`— *${slide.content}*`);
      }
      break;

    case "two-column":
      lines.push("layout: two-cols");
      lines.push("---");
      lines.push("");
      lines.push(`# ${slide.title}`);
      lines.push("");
      lines.push(slide.leftContent || slide.content || "");
      lines.push("");
      lines.push("::right::");
      lines.push("");
      lines.push(slide.rightContent || "");
      if (slide.bullets && slide.bullets.length > 0) {
        lines.push("");
        slide.bullets.forEach(b => lines.push(`- ${b}`));
      }
      break;

    case "cta":
      lines.push("layout: end");
      lines.push("class: text-center");
      lines.push("---");
      lines.push("");
      lines.push(`# ${slide.title}`);
      if (slide.subtitle) {
        lines.push("");
        lines.push(slide.subtitle);
      }
      if (slide.content) {
        lines.push("");
        lines.push(slide.content);
      }
      if (slide.bullets && slide.bullets.length > 0) {
        lines.push("");
        slide.bullets.forEach(b => lines.push(`- ${b}`));
      }
      break;

    default:
      lines.push("---");
      lines.push("");
      lines.push(`# ${slide.title}`);
      if (slide.content) {
        lines.push("");
        lines.push(slide.content);
      }
  }

  // Speaker notes
  if (slide.note) {
    lines.push("");
    lines.push("<!--");
    lines.push(slide.note);
    lines.push("-->");
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  try {
    const { slides, style, title } = await req.json() as {
      slides: Slide[];
      style?: { id?: string; name?: string; colors?: string[]; fontHeader?: string; fontBody?: string; mood?: string };
      title?: string;
    };

    if (!slides || slides.length === 0) {
      return NextResponse.json({ ok: false, error: "No slides" }, { status: 400 });
    }

    const themeInfo = THEME_MAP[style?.id ?? ""] ?? { theme: "seriph" };
    const primary = style?.colors?.[0] ?? "#1a1a2e";
    const accent  = style?.colors?.[2] ?? "#6366f1";

    // Build frontmatter
    const frontmatter = [
      "---",
      `theme: ${themeInfo.theme}`,
      ...(themeInfo.colorSchema ? [`colorSchema: '${themeInfo.colorSchema}'`] : []),
      `title: '${(title || "Презентация").replace(/'/g, "''")}'`,
      "highlighter: shiki",
      "transition: slide-left",
      "mdc: true",
      `themeConfig:`,
      `  primary: '${primary}'`,
      style?.fontHeader ? `fonts:` : "",
      style?.fontHeader ? `  sans: '${style.fontHeader}'` : "",
      style?.fontBody ? `  mono: '${style.fontBody}'` : "",
    ].filter(l => l !== "").join("\n");

    // Build slide sections
    const slideSections = slides.map((slide, idx) => slideToMarkdown(slide, idx)).join("\n\n");

    const markdown = `${frontmatter}\n\n${slideSections}\n`;

    return new Response(markdown, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="presentation.md"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
