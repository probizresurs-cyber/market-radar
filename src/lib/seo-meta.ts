/**
 * SEO meta-tag generator для лендингов.
 *
 * После генерации Stitch'ем HTML — мы вызываем `generateLandingMeta(...)`
 * чтобы получить готовый `<title>`, `<meta description>`, OpenGraph,
 * Twitter Card и JSON-LD Schema.org блок. Юзер потом вставляет блок
 * в `<head>` своего лендинга вручную или мы инжектим через API при
 * экспорте.
 *
 * Почему отдельный модуль:
 * - Stitch генерирует HTML без SEO-тегов вообще — лендинг плохо ранжируется
 *   и некрасиво шарится в соцсетях.
 * - Без JSON-LD Schema.org Google не понимает что это бизнес-страница.
 * - Дешевле сгенерить локально из данных компании, чем дёргать AI повторно.
 */

export interface LandingMetaInput {
  companyName?: string;
  /** Краткое описание компании — для og:description / meta description (150-160 chars). */
  description?: string;
  /** URL лендинга если уже задеплоен. Используется в og:url, json-ld @id. */
  pageUrl?: string;
  /** URL hero-картинки (скриншот от Stitch) — og:image, twitter:image. */
  imageUrl?: string;
  /** Тип лендинга — влияет на schema.org @type. */
  landingType?: "main" | "product" | "promo" | "lead-gen" | string;
  /** Бренд-цвет для theme-color мета-тега. */
  brandColor?: string;
  /** Город/локация — пихаем в LocalBusiness schema если есть. */
  city?: string;
  /** Телефон — для LocalBusiness contactPoint. */
  phone?: string;
  /** Email — для LocalBusiness contactPoint. */
  email?: string;
}

/** Возвращает HTML-блок с meta-тегами, готовый к инжекту перед `</head>`. */
export function generateLandingMeta(input: LandingMetaInput): string {
  const esc = (s: unknown): string => {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const name = input.companyName?.trim() || "Компания";
  const desc = (input.description?.trim() || `${name} — добро пожаловать на наш сайт.`).slice(0, 160);
  const url = input.pageUrl?.trim() || "";
  const img = input.imageUrl?.trim() || "";
  const color = input.brandColor?.trim() || "#0ea5e9";

  // Title по типу лендинга — лучше ранжируется чем «Главная».
  const titleByType: Record<string, string> = {
    main: name,
    product: `${name} — продукт и услуги`,
    promo: `${name} — специальное предложение`,
    "lead-gen": `${name} — оставить заявку`,
  };
  const title = titleByType[input.landingType || "main"] || name;

  // Schema.org type — LocalBusiness если есть город/телефон, иначе Organization.
  const hasLocal = !!(input.city || input.phone || input.email);
  const schemaType = hasLocal ? "LocalBusiness" : "Organization";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name,
    description: desc,
    ...(url && { url }),
    ...(img && { image: img }),
    ...(input.city && { address: { "@type": "PostalAddress", addressLocality: input.city } }),
    ...((input.phone || input.email) && {
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        ...(input.phone && { telephone: input.phone }),
        ...(input.email && { email: input.email }),
      },
    }),
  };

  const tags: string[] = [
    // Basic
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta name="theme-color" content="${esc(color)}">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<meta charset="utf-8">`,
    // OpenGraph (Facebook, VK, Telegram preview)
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:site_name" content="${esc(name)}">`,
    `<meta property="og:locale" content="ru_RU">`,
  ];
  if (url) tags.push(`<meta property="og:url" content="${esc(url)}">`);
  if (img) {
    tags.push(`<meta property="og:image" content="${esc(img)}">`);
    tags.push(`<meta property="og:image:width" content="1200">`);
    tags.push(`<meta property="og:image:height" content="630">`);
  }
  // Twitter Card
  tags.push(`<meta name="twitter:card" content="summary_large_image">`);
  tags.push(`<meta name="twitter:title" content="${esc(title)}">`);
  tags.push(`<meta name="twitter:description" content="${esc(desc)}">`);
  if (img) tags.push(`<meta name="twitter:image" content="${esc(img)}">`);

  // JSON-LD — Google понимает что это компания, ставит rich-snippet в выдаче.
  tags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);

  return tags.join("\n");
}

/** Вставляет SEO-meta блок в HTML перед `</head>`. Если head нет —
 *  возвращает HTML как есть. */
export function injectSeoMeta(html: string, metaBlock: string): string {
  if (!metaBlock) return html;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${metaBlock}\n</head>`);
  }
  // Нет head — оборачиваем (worst case, лучше чем ничего).
  return `<head>${metaBlock}</head>${html}`;
}
