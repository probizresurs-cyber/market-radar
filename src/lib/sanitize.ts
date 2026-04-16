/**
 * Input sanitization — удаление опасных HTML-тегов и атрибутов.
 * Используй sanitizeHtml() перед сохранением любого пользовательского текста,
 * который потенциально может содержать HTML.
 */

// Теги, которые удаляются вместе с содержимым
const DANGEROUS_TAGS_WITH_CONTENT = [
  "script",
  "iframe",
  "object",
  "embed",
  "applet",
  "frame",
  "frameset",
];

// Теги, которые удаляются (тег убирается, контент остаётся)
const DANGEROUS_TAGS_STRIP = [
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "style",
];

// Опасные паттерны в атрибутах
const DANGEROUS_ATTR_PATTERNS = [
  /\bon\w+\s*=/gi,          // onclick=, onload=, onerror=, etc.
  /javascript\s*:/gi,        // javascript: href
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi, // data:text/html XSS
  /expression\s*\(/gi,       // CSS expression()
];

/**
 * Полная очистка HTML от XSS-векторов.
 * Удаляет опасные теги и атрибуты, оставляя чистый текст/безопасный HTML.
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== "string") return "";

  let result = input;

  // 1. Удалить dangerous теги вместе с содержимым
  for (const tag of DANGEROUS_TAGS_WITH_CONTENT) {
    result = result.replace(
      new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi"),
      ""
    );
    // Самозакрывающиеся
    result = result.replace(new RegExp(`<${tag}[^>]*\\/?>`, "gi"), "");
  }

  // 2. Удалить dangerous теги (strip tag, keep content)
  for (const tag of DANGEROUS_TAGS_STRIP) {
    result = result.replace(new RegExp(`<\\/?${tag}[^>]*>`, "gi"), "");
  }

  // 3. Удалить опасные атрибуты
  for (const pattern of DANGEROUS_ATTR_PATTERNS) {
    result = result.replace(pattern, "");
  }

  return result;
}

/**
 * Жёсткая очистка — удаляет весь HTML, оставляет только текст.
 * Используй для полей, где HTML вообще не нужен (имена, названия компаний и т.п.)
 */
export function stripHtml(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<[^>]+>/g, "")      // убрать все теги
    .replace(/&[a-z#0-9]+;/gi, " ") // убрать HTML entities
    .trim();
}

/**
 * Санитизация объекта — рекурсивно очищает все строковые поля.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === "string") {
      result[key] = sanitizeHtml(val);
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      result[key] = sanitizeObject(val as Record<string, unknown>);
    } else if (Array.isArray(val)) {
      result[key] = val.map((item) =>
        typeof item === "string"
          ? sanitizeHtml(item)
          : typeof item === "object"
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    }
  }
  return result as T;
}

/**
 * Проверка на SQL injection паттерны (базовая эвристика, не замена параметризованным запросам).
 */
export function hasSqlInjection(input: string): boolean {
  const patterns = [
    /('\s*(OR|AND)\s*'?\d)/i,
    /(UNION\s+SELECT)/i,
    /(DROP\s+TABLE)/i,
    /(INSERT\s+INTO)/i,
    /(DELETE\s+FROM)/i,
    /(--\s*$)/m,
    /(\/\*[\s\S]*?\*\/)/,
    /;\s*(SELECT|DROP|INSERT|UPDATE|DELETE)/i,
  ];
  return patterns.some((p) => p.test(input));
}
