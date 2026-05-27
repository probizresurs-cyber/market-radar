#!/usr/bin/env node
/**
 * Короткий скринкаст (~1:45): регистрация на лендинге → wizard → запуск анализа.
 *
 * 8 сцен по 8-22 сек. Правильные wizard-селекторы:
 *   - URL: input[placeholder*="example.ru"]
 *   - Чекбоксы модулей: text=Целевая аудитория | СММ-стратегия | Конкуренты
 *     (кликаем по label, реальный input type=checkbox скрыт display:none)
 *   - Переход между шагами: text=Далее
 *   - Финальный submit: text=Запустить анализ
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

// ============================================================
// Config
// ============================================================

const ts = Date.now().toString().slice(-6);
const config = {
  landingUrl: process.env.LANDING_URL || 'https://marketradar24.ru',
  stagingUrl: process.env.STAGING_URL || 'https://staging.marketradar24.ru',
  demoEmail: process.env.DEMO_EMAIL || `demo${ts}@marketradar24.test`,
  demoPassword: process.env.DEMO_PASSWORD || 'DemoVideo2026!',
  demoName: process.env.DEMO_NAME || 'Иван Иванов',
  companyUrl: process.env.TEST_COMPANY_URL || 'me-dent.ru',
  viewport: { width: 1920, height: 1080 },
  slowMo: 200,
};

// ============================================================
// Helpers
// ============================================================

async function safeClick(page, selector, timeout = 5000) {
  try {
    const loc = page.locator(selector).first();
    await loc.scrollIntoViewIfNeeded({ timeout });
    await loc.click({ timeout, force: true });
    return true;
  } catch (err) {
    console.log(`    · safeClick «${selector}» не найден (${err.message.slice(0, 50)})`);
    return false;
  }
}

async function safeFill(page, selector, value, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    await page.fill(selector, value);
    return true;
  } catch (err) {
    console.log(`    · safeFill «${selector}» не найден (${err.message.slice(0, 50)})`);
    return false;
  }
}

// ============================================================
// 8 коротких сцен — total ~1:45
// ============================================================

const scenes = [
  {
    id: '01-landing',
    duration: 10,
    voiceover: 'MarketRadar24 — платформа для конкурентного анализа. За пару минут покажу как зарегистрироваться и запустить первый анализ.',
    async action(page) {
      await page.goto(config.landingUrl, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(8000);
    },
  },
  {
    id: '02-click-register',
    duration: 8,
    voiceover: 'Жму кнопку регистрации на лендинге.',
    async action(page) {
      const candidates = [
        'a[href*="register"]',
        'text=Зарегистрироваться',
        'text=Попробовать',
        'text=Начать бесплатно',
      ];
      let clicked = false;
      for (const sel of candidates) {
        if (await safeClick(page, sel, 2500)) { clicked = true; break; }
      }
      if (!clicked) {
        await page.goto(`${config.landingUrl}/register`, { waitUntil: 'networkidle' }).catch(() => {});
      }
      await page.waitForTimeout(4500);
    },
  },
  {
    id: '03-fill-form',
    duration: 22,
    voiceover: 'Заполняю форму: имя Иван Иванов, почта, пароль, сайт компании me-dent.ru. Ставлю галочку согласия — и аккаунт готов.',
    async action(page) {
      await safeFill(page, 'input[placeholder="Иван Иванов"]', config.demoName);
      await page.waitForTimeout(900);
      await safeFill(page, 'input[type=email]', config.demoEmail);
      await page.waitForTimeout(900);
      await safeFill(page, 'input[type=password]', config.demoPassword);
      await page.waitForTimeout(900);
      await safeFill(page, 'input[placeholder="example.ru"]', config.companyUrl);
      await page.waitForTimeout(1500);
      // Чекбокс согласия — по тексту-метке
      await safeClick(page, 'text=согласен', 2500);
      await page.waitForTimeout(2000);
    },
  },
  {
    id: '04-submit',
    duration: 10,
    voiceover: 'Создаю аккаунт. Платформа автоматически переводит в личный кабинет.',
    async action(page) {
      const submitCandidates = ['text=Создать аккаунт', 'button[type=submit]', 'text=Зарегистрироваться'];
      for (const sel of submitCandidates) {
        if (await safeClick(page, sel, 2500)) break;
      }
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(6500);
    },
  },
  {
    id: '05-wizard-url',
    duration: 14,
    voiceover: 'Открывается мастер первого анализа. Первый шаг — ввожу сайт компании. Мы возьмём стоматологию me-dent.ru.',
    async action(page) {
      // Wizard может уже быть открыт, ищем поле URL (placeholder содержит example.ru)
      const urlFilled = await safeFill(page, 'input[placeholder*="example.ru"]', config.companyUrl, 4000);
      if (!urlFilled) {
        // Возможно wizard ещё не открыт — открываем
        await safeClick(page, 'text=Новый анализ', 3000);
        await page.waitForTimeout(2000);
        await safeFill(page, 'input[placeholder*="example.ru"]', config.companyUrl, 3000);
      }
      await page.waitForTimeout(2500);
      // Жмём «Далее»
      await safeClick(page, 'text=Далее', 3000);
      await page.waitForTimeout(5000);
    },
  },
  {
    id: '06-wizard-modules',
    duration: 18,
    voiceover: 'Второй шаг — выбираю модули. Целевая аудитория, СММ-стратегия, конкуренты. Каждый — это отдельный детальный анализ. Основной анализ компании запустится в любом случае.',
    async action(page) {
      const moduleLabels = ['Целевая аудитория', 'СММ-стратегия', 'Конкуренты'];
      for (const label of moduleLabels) {
        await safeClick(page, `text=${label}`, 2500);
        await page.waitForTimeout(1500);
      }
      await page.waitForTimeout(4500);
      // Идём дальше через wizard-шаги
      await safeClick(page, 'text=Далее', 3000);
      await page.waitForTimeout(2000);
    },
  },
  {
    id: '07-launch',
    duration: 13,
    voiceover: 'Прохожу оставшиеся шаги мастера и жму запустить. Платформа стартует все модули параллельно — через 3-5 минут дашборд готов.',
    async action(page) {
      // Пропускаем оставшиеся «Далее»-шаги (соцсети, конкуренты-URLs, summary)
      for (let i = 0; i < 4; i++) {
        const clicked = await safeClick(page, 'text=Далее', 2500);
        if (!clicked) break;
        await page.waitForTimeout(1500);
      }
      // Финальный submit
      await safeClick(page, 'text=Запустить анализ', 4000);
      await page.waitForTimeout(6000);
    },
  },
  {
    id: '08-progress',
    duration: 10,
    voiceover: 'Готово — анализ запущен. Можно идти пить кофе или продолжать настройку других модулей. До встречи в MarketRadar24.',
    async action(page) {
      await page.waitForTimeout(9000);
    },
  },
];

// ============================================================
// SRT generator
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
  const videoName = `registration-demo-${timestamp}`;
  const totalDur = scenes.reduce((a, s) => a + s.duration, 0);

  console.log(`▶  Запуск записи: ${videoName}`);
  console.log(`▶  Demo-email: ${config.demoEmail}`);
  console.log(`▶  Компания: ${config.companyUrl}`);
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
        console.error(`    ⚠  Ошибка в сцене ${scene.id}: ${err.message.slice(0, 100)}`);
        await page.waitForTimeout(2000);
      }
    }
    console.log('\n✓  Сценарий пройден, закрываю context…');
  } finally {
    await context.close();
    await browser.close();
  }

  const { readdir, rename } = await import('node:fs/promises');
  const files = await readdir(OUTPUT_DIR);
  const webm = files.find(f => f.endsWith('.webm') && !f.startsWith('registration-demo') && !f.startsWith('dashboard-demo'));
  if (webm) {
    const finalName = `${videoName}.webm`;
    await rename(join(OUTPUT_DIR, webm), join(OUTPUT_DIR, finalName));
    console.log(`\n✓  Видео: ${join(OUTPUT_DIR, finalName)}`);
  }

  const srt = generateSrt(scenes);
  const srtPath = join(OUTPUT_DIR, `${videoName}.srt`);
  await writeFile(srtPath, srt, 'utf-8');
  console.log(`✓  Субтитры: ${srtPath}`);

  console.log('\n────────────────────────────────────────');
  console.log(`Хронометраж: ~${Math.floor(totalDur/60)}:${String(totalDur%60).padStart(2,'0')}`);
  console.log('────────────────────────────────────────');
}

main().catch(err => {
  console.error('💥 Критическая ошибка:', err);
  process.exit(1);
});
