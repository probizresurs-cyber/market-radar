#!/usr/bin/env node
/**
 * Скринкаст блока «Аналитика» (~3:10).
 * Проход по всем табам сайдбара: Новый анализ → Дашборд → Предыдущие
 * анализы → AI-инсайты → AI Видимость → SWOT → Конкуренты → ЦА → СММ.
 *
 * Основной дашборд упоминается кратко (есть отдельное видео).
 * Каждый таб открывается через прямой ?nav=X URL для надёжности.
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

const config = {
  stagingUrl: process.env.STAGING_URL || 'https://staging.marketradar24.ru',
  email: process.env.TEST_EMAIL || 'admin@company24.pro',
  password: process.env.TEST_PASSWORD || '',
  viewport: { width: 1920, height: 1080 },
  slowMo: 200,
};

if (!config.password) {
  console.error('⚠️  Нужно задать TEST_PASSWORD env var');
  process.exit(1);
}

async function safeClick(page, selector, timeout = 5000) {
  try {
    const loc = page.locator(selector).first();
    await loc.scrollIntoViewIfNeeded({ timeout });
    await loc.click({ timeout, force: true });
    return true;
  } catch { return false; }
}

async function safeFill(page, selector, value, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    await page.fill(selector, value);
    return true;
  } catch { return false; }
}

async function smoothScrollTo(page, y, settle = 1500) {
  await page.evaluate((target) => window.scrollTo({ top: target, behavior: 'smooth' }), y);
  await page.waitForTimeout(settle);
}

async function navTo(page, navId, settle = 3000) {
  await page.goto(`${config.stagingUrl}/?nav=${navId}`, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(settle);
}

// ============================================================
// 11 сцен — ~3:10
// ============================================================

const scenes = [
  {
    id: '01-login',
    duration: 12,
    voiceover: 'Покажу блок «Аналитика» в платформе MarketRadar24. Захожу под тестовым аккаунтом — внутри уже готовые анализы.',
    async action(page) {
      await page.goto(`${config.stagingUrl}/login`, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await safeFill(page, 'input[type=email]', config.email);
      await page.waitForTimeout(800);
      await safeFill(page, 'input[type=password]', config.password);
      await page.waitForTimeout(800);
      await safeClick(page, 'button[type=submit]', 3000);
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(3500);
    },
  },
  {
    id: '02-new-analysis',
    duration: 16,
    voiceover: 'Первый таб — «Новый анализ». Здесь запускается пошаговый мастер: вводите сайт, выбираете нужные модули. Подробнее показано в отдельном видео про регистрацию.',
    async action(page) {
      await navTo(page, 'new-analysis', 12000);
    },
  },
  {
    id: '03-dashboard',
    duration: 14,
    voiceover: 'Главный дашборд компании — с общим маркетинговым скором, SEO, финансами, репутацией, видимостью на рынке. Подробный обзор — в отдельном видео про главный дашборд.',
    async action(page) {
      await navTo(page, 'dashboard', 3000);
      await smoothScrollTo(page, 400, 4000);
      await smoothScrollTo(page, 800, 4000);
    },
  },
  {
    id: '04-prev-analyses',
    duration: 18,
    voiceover: 'Дальше — предыдущие анализы. Платформа сохраняет каждый запуск с датой и ключевыми показателями. Можно открыть старый отчёт, сравнить дельту с новым — увидеть как изменился ваш бизнес за неделю, месяц или квартал.',
    async action(page) {
      await navTo(page, 'prev-analyses', 4000);
      await smoothScrollTo(page, 200, 6000);
      await smoothScrollTo(page, 600, 5000);
    },
  },
  {
    id: '05-ai-insights',
    duration: 22,
    voiceover: 'AI-инсайты — самый важный раздел. Платформа анализирует все собранные данные о вас и нише, и формирует персональный план действий. Что улучшить в SEO в первую очередь, какие соцсети раскачать, где у конкурентов слабее и куда зайти. Каждая рекомендация — это конкретный шаг с приоритетом и ожидаемым эффектом.',
    async action(page) {
      await navTo(page, 'insights', 4000);
      await smoothScrollTo(page, 300, 6000);
      await smoothScrollTo(page, 800, 6000);
      await smoothScrollTo(page, 1300, 4000);
    },
  },
  {
    id: '06-ai-visibility',
    duration: 22,
    voiceover: 'AI Видимость — отдельный модуль про то, как ваша компания упоминается в ответах ChatGPT, Claude, Gemini, Яндекс Нейро и Алисы. Это новая ниша поисковой оптимизации — GEO. Платформа показывает, где конкретно вас цитируют, и даёт конкретные правки, чтобы попасть в ответы AI-поисковиков.',
    async action(page) {
      await navTo(page, 'ai-visibility', 4000);
      await smoothScrollTo(page, 300, 6000);
      await smoothScrollTo(page, 900, 6000);
      await smoothScrollTo(page, 1500, 4000);
    },
  },
  {
    id: '07-swot',
    duration: 18,
    voiceover: 'SWOT-анализ — классическая матрица сильных и слабых сторон, возможностей и угроз. Платформа собирает её автоматически на основе всех данных — финансов, SEO, ниши и конкурентов. Раскрываете любой квадрант и видите детальные пункты.',
    async action(page) {
      await navTo(page, 'swot', 4000);
      await smoothScrollTo(page, 300, 6000);
      await smoothScrollTo(page, 900, 4000);
    },
  },
  {
    id: '08-competitors',
    duration: 22,
    voiceover: 'Раздел «Конкуренты». Список с автоматически подобранными конкурентами по пересечению ключевых слов. Можно открыть профиль каждого, сравнить в таблице по 20+ параметрам, или сгенерировать Battle Cards — короткие карточки для отдела продаж с возражениями и преимуществами.',
    async action(page) {
      await navTo(page, 'competitors', 4000);
      await smoothScrollTo(page, 300, 6000);
      await smoothScrollTo(page, 800, 6000);
      await navTo(page, 'compare', 3000);
    },
  },
  {
    id: '09-audience',
    duration: 22,
    voiceover: 'Раздел «Аудитория» — портрет вашего целевого клиента. AI разбирает сегменты ЦА: их боли, страхи, мотивы, возражения, типичные цитаты. Customer Journey Map показывает путь клиента от первого контакта до покупки. Отраслевые бенчмарки — конверсии и метрики в вашей нише.',
    async action(page) {
      await navTo(page, 'ta-dashboard', 4000);
      await smoothScrollTo(page, 300, 5000);
      await smoothScrollTo(page, 900, 5000);
      await navTo(page, 'ta-cjm', 4000);
    },
  },
  {
    id: '10-smm',
    duration: 18,
    voiceover: 'Раздел СММ — стратегия в социальных сетях. Архетип бренда, рекомендуемые платформы, тон голоса, контент-столпы. Анализ ваших соцсетей если они подключены — подписчики, частота, вовлечение. Готовая основа для контент-плана.',
    async action(page) {
      await navTo(page, 'smm-dashboard', 4000);
      await smoothScrollTo(page, 300, 5000);
      await smoothScrollTo(page, 900, 5000);
    },
  },
  {
    id: '11-outro',
    duration: 12,
    voiceover: 'Это весь блок «Аналитика». Дальше — производство контента, лендинги, презентации и фоновые агенты. Разберу в следующих видео. До встречи в MarketRadar24!',
    async action(page) {
      await navTo(page, 'dashboard', 4000);
      await smoothScrollTo(page, 0, 5000);
    },
  },
];

// ============================================================
// SRT
// ============================================================

function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function generateSrt(scenes) {
  let cursor = 0;
  return scenes.map((scene, i) => {
    const start = cursor;
    const end = cursor + scene.duration;
    cursor = end;
    return [
      String(i + 1),
      `${formatSrtTime(start)} --> ${formatSrtTime(end)}`,
      scene.voiceover,
      '',
    ].join('\n');
  }).join('\n');
}

// ============================================================
// Main
// ============================================================

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const videoName = `analytics-demo-${timestamp}`;
  const totalDur = scenes.reduce((a, s) => a + s.duration, 0);

  console.log(`▶  Запуск: ${videoName}`);
  console.log(`▶  Сцен: ${scenes.length}, длительность ~${totalDur}s (${Math.floor(totalDur/60)}:${String(totalDur%60).padStart(2,'0')})`);

  const browser = await chromium.launch({
    headless: true,
    slowMo: config.slowMo,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: config.viewport,
    recordVideo: { dir: OUTPUT_DIR, size: config.viewport },
    deviceScaleFactor: 1,
    locale: 'ru-RU',
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const cursor = document.createElement('div');
      cursor.id = 'demo-cursor';
      cursor.style.cssText = `
        position: fixed; width: 24px; height: 24px;
        background: rgba(236, 72, 153, 0.6);
        border: 2px solid #ec4899;
        border-radius: 50%; pointer-events: none;
        z-index: 999999; transition: all 0.15s ease;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 12px rgba(236, 72, 153, 0.8);
      `;
      document.body.appendChild(cursor);
      document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });
    });
  });

  try {
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      console.log(`\n[${i + 1}/${scenes.length}] ${scene.id} (~${scene.duration}s)`);
      console.log(`    🎙  «${scene.voiceover.slice(0, 80)}…»`);
      try {
        await scene.action(page);
      } catch (err) {
        console.error(`    ⚠  ${scene.id}: ${err.message.slice(0, 100)}`);
        await page.waitForTimeout(2000);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const { readdir, rename } = await import('node:fs/promises');
  const files = await readdir(OUTPUT_DIR);
  const webm = files.find(f => f.endsWith('.webm') && !f.startsWith('analytics-demo') && !f.startsWith('dashboard-demo') && !f.startsWith('registration-demo'));
  if (webm) {
    const finalName = `${videoName}.webm`;
    await rename(join(OUTPUT_DIR, webm), join(OUTPUT_DIR, finalName));
    console.log(`\n✓  Видео: ${join(OUTPUT_DIR, finalName)}`);
  }

  const srt = generateSrt(scenes);
  await writeFile(join(OUTPUT_DIR, `${videoName}.srt`), srt, 'utf-8');
  console.log(`✓  Субтитры: ${join(OUTPUT_DIR, videoName + '.srt')}`);
  console.log(`\nХронометраж: ~${Math.floor(totalDur/60)}:${String(totalDur%60).padStart(2,'0')}`);
}

main().catch(err => {
  console.error('💥 Ошибка:', err);
  process.exit(1);
});
