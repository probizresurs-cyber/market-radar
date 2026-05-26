/**
 * Tracking-pixel генератор для лендингов.
 *
 * После генерации лендинга юзер указывает свои ID счётчиков и мы возвращаем
 * готовый блок snippet'ов для вставки в `<head>` (для Metrika/GA — нужна
 * максимально ранняя загрузка) и `<body>` (для noscript fallback).
 *
 * Поддерживаем 4 самых востребованных счётчика на российском рынке:
 *   - Yandex.Metrika (yandex_metrika_id, цифры)
 *   - Google Analytics 4 (G-XXXXXXXXXX)
 *   - VK Pixel (VK-RTRG-XXXXXX-XXXXX)
 *   - Facebook Pixel (16-значный цифровой ID)
 *
 * Никаких внешних запросов, никаких AI — pure string templates.
 */

export interface PixelConfig {
  /** Yandex.Metrika counter ID (только цифры, например 12345678). */
  yandexMetrika?: string;
  /** Google Analytics 4 measurement ID (формат G-XXXXXXXXXX). */
  googleAnalytics?: string;
  /** VK Pixel ID (формат VK-RTRG-XXXXXX-XXXXX). */
  vkPixel?: string;
  /** Facebook/Meta Pixel ID (15-16 цифр). */
  facebookPixel?: string;
}

const RX = {
  // Yandex Metrika — счётчик это уникальное цифровое число.
  yandex: /^\d{6,9}$/,
  // GA4 — формат G-XXXXXXXXXX.
  ga4: /^G-[A-Z0-9]{6,12}$/,
  // VK — стандартный паттерн RTRG.
  vk: /^VK-RTRG-\d{4,8}-[A-Z0-9]{3,6}$/i,
  // Facebook — 15-16 цифр.
  fb: /^\d{15,16}$/,
};

export interface PixelValidation {
  valid: boolean;
  warnings: string[];
}

export function validatePixels(cfg: PixelConfig): PixelValidation {
  const warnings: string[] = [];
  if (cfg.yandexMetrika && !RX.yandex.test(cfg.yandexMetrika.trim())) {
    warnings.push("Yandex.Metrika ID — это только цифры (6-9 знаков). Проверьте.");
  }
  if (cfg.googleAnalytics && !RX.ga4.test(cfg.googleAnalytics.trim())) {
    warnings.push("Google Analytics — нужен формат G-XXXXXXXXXX (UA-* устарел).");
  }
  if (cfg.vkPixel && !RX.vk.test(cfg.vkPixel.trim())) {
    warnings.push("VK Pixel — нужен формат VK-RTRG-XXXXXX-XXXXX.");
  }
  if (cfg.facebookPixel && !RX.fb.test(cfg.facebookPixel.trim())) {
    warnings.push("Facebook Pixel ID — обычно 15-16 цифр.");
  }
  return { valid: warnings.length === 0, warnings };
}

/** Снипет Яндекс.Метрики (с webvisor, clickmap, accurate bounce rate). */
function yandexMetrikaSnippet(id: string): string {
  return `
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();
   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
   k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

   ym(${id}, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true
   });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/${id}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->`;
}

/** Снипет Google Analytics 4 (gtag.js). */
function googleAnalyticsSnippet(id: string): string {
  return `
<!-- Google Analytics (GA4) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${id}');
</script>
<!-- /Google Analytics -->`;
}

/** Снипет VK Pixel (для рекламных кабинетов VK Ads). */
function vkPixelSnippet(id: string): string {
  return `
<!-- VK Pixel -->
<script type="text/javascript">
!function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="https://vk.com/js/api/openapi.js?169",t.onload=function(){VK.Retargeting.Init("${id}"),VK.Retargeting.Hit()},document.head.appendChild(t)}();
</script>
<noscript><img src="https://vk.com/rtrg?p=${id}" style="position:fixed; left:-999px;" alt=""/></noscript>
<!-- /VK Pixel -->`;
}

/** Снипет Facebook/Meta Pixel. */
function facebookPixelSnippet(id: string): string {
  return `
<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"/></noscript>
<!-- /Meta Pixel -->`;
}

/**
 * Возвращает готовый <head>-ready блок со всеми сконфигурированными счётчиками.
 * Невалидные ID пропускаются молча — валидацию запускайте отдельно через
 * `validatePixels()` чтобы показать предупреждения пользователю.
 */
export function generatePixelsBlock(cfg: PixelConfig): string {
  const parts: string[] = [];
  const yam = cfg.yandexMetrika?.trim();
  const ga = cfg.googleAnalytics?.trim();
  const vk = cfg.vkPixel?.trim();
  const fb = cfg.facebookPixel?.trim();

  if (yam && RX.yandex.test(yam)) parts.push(yandexMetrikaSnippet(yam));
  if (ga && RX.ga4.test(ga)) parts.push(googleAnalyticsSnippet(ga));
  if (vk && RX.vk.test(vk)) parts.push(vkPixelSnippet(vk));
  if (fb && RX.fb.test(fb)) parts.push(facebookPixelSnippet(fb));

  return parts.join("\n");
}

/** Вставляет pixel-block перед `</head>`. Если head нет — оборачивает. */
export function injectPixels(html: string, pixelsBlock: string): string {
  if (!pixelsBlock) return html;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${pixelsBlock}\n</head>`);
  }
  return `<head>${pixelsBlock}</head>${html}`;
}
