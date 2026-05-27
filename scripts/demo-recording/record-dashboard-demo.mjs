#!/usr/bin/env node
/**
 * Запись скринкаста главного дашборда MarketRadar24.
 *
 * Использование:
 *   1. Установить зависимости (один раз):
 *      npm install -D playwright
 *      npx playwright install chromium
 *
 *   2. Задать env (или экспортнуть):
 *      export STAGING_URL=https://staging.marketradar24.ru
 *      export TEST_EMAIL=demo@marketradar24.ru
 *      export TEST_PASSWORD=<пароль>
 *      export TEST_COMPANY_URL=gk-orlink.ru
 *
 *   3. Запуск:
 *      node scripts/demo-recording/record-dashboard-demo.mjs
 *
 *   4. Результат:
 *      output/dashboard-demo-<timestamp>.webm   (video)
 *      output/dashboard-demo-<timestamp>.srt    (subtitles, synced)
 *
 *   5. (опционально) Конвертировать webm → mp4 через ffmpeg:
 *      ffmpeg -i output/dashboard-demo-*.webm -c:v libx264 -crf 18 -preset slow output/dashboard-demo.mp4
 *
 * Дальше: подложить ElevenLabs голос по таймкодам из .srt в DaVinci/CapCut.
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

const config = {
  stagingUrl: process.env.STAGING_URL || 'https://staging.marketradar24.ru',
  email: process.env.TEST_EMAIL || 'demo@marketradar24.ru',
  password: process.env.TEST_PASSWORD || '',
  companyUrl: process.env.TEST_COMPANY_URL || 'gk-orlink.ru',
  viewport: { width: 1920, height: 1080 },
  slowMo: 250,           // мс между действиями — имитация человеческого темпа
  cursorPaceMs: 150,     // задержка после кликов до движения курсора
};

if (!config.password) {
  console.error('⚠️  Нужно задать TEST_PASSWORD env var');
  process.exit(1);
}

// ============================================================
// Storyboard scenes — каждая сцена имеет:
//   id: имя файла (01-landing.webm) и индекс в srt
//   duration: сколько секунд показывать (примерное, для срт)
//   voiceover: текст озвучки (для srt-генерации)
//   action(page): что делать на экране
// ============================================================

const scenes = [
  {
    id: 'landing',
    duration: 25,
    voiceover: 'Привет! За следующие пять минут я покажу, как MarketRadar24 заменяет вам целый маркетинговый отдел. Всего за два-три клика вы получите дашборд с глубокой аналитикой компании, конкурентов, целевой аудитории и SEO. Поехали — начинаем с регистрации.',
    async action(page) {
      await page.goto(config.stagingUrl, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(3000);
      // Плавный скролл вниз до блока "Что вы получите"
      await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'smooth' }));
      await page.waitForTimeout(5000);
      await page.evaluate(() => window.scrollTo({ top: 2400, behavior: 'smooth' }));
      await page.waitForTimeout(5000);
      // Возврат наверх
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await page.waitForTimeout(4000);
    },
  },
  {
    id: 'registration',
    duration: 30,
    voiceover: 'Регистрация занимает буквально минуту. Нужны только email, пароль и адрес сайта вашей компании. Никаких карт, паспортных данных или долгих анкет. Сразу после регистрации платформа автоматически запускает первый анализ.',
    async action(page) {
      // Клик «Попробовать» / «Войти» / «Регистрация»
      // НА staging тестовый аккаунт — заходим через login, не register
      const loginCandidates = ['text=Войти', 'text=Попробовать', 'text=Регистрация', 'a[href*="login"]'];
      for (const sel of loginCandidates) {
        const el = await page.$(sel);
        if (el) { await el.click(); break; }
      }
      await page.waitForTimeout(2500);
      await page.waitForSelector('input[type=email], input[name=email]', { timeout: 15_000 });
      await page.fill('input[type=email], input[name=email]', config.email);
      await page.waitForTimeout(800);
      await page.fill('input[type=password]', config.password);
      await page.waitForTimeout(1500);
      // Submit
      const submitCandidates = ['button[type=submit]', 'text=Войти', 'text=Зарегистрироваться'];
      for (const sel of submitCandidates) {
        const btn = await page.$(sel);
        if (btn && await btn.isVisible()) { await btn.click(); break; }
      }
      await page.waitForTimeout(5000);
    },
  },
  {
    id: 'wizard',
    duration: 25,
    voiceover: 'На старте можно выбрать, какие модули запустить параллельно. Я возьму все: основной анализ компании, конкурентов, портрет аудитории и SMM-стратегию. Платформа собирает данные из двенадцати источников: ФНС, HH-ру, Яндекс-Карт, 2-ГИС, Keys-точка-so и других.',
    async action(page) {
      // На staging после логина — либо новая компания, либо dashboard готов
      // Пытаемся открыть wizard через сайдбар
      const wizardBtn = await page.$('text=Новый анализ').catch(() => null);
      if (wizardBtn) {
        await wizardBtn.click();
        await page.waitForTimeout(3000);
        // Заполняем URL если поле есть
        const urlInput = await page.$('input[type=url], input[placeholder*="сайт"], input[placeholder*="URL"]');
        if (urlInput) {
          await urlInput.fill(config.companyUrl);
          await page.waitForTimeout(2000);
        }
      } else {
        // Если wizard не открылся — просто ждём, показывая текущий экран
        await page.waitForTimeout(10000);
      }
      await page.waitForTimeout(8000);
    },
  },
  {
    id: 'dashboard-overview',
    duration: 35,
    voiceover: 'Вот и сам дашборд. Сверху — карточка компании с реквизитами из ФНС, ниже — ключевые метрики: возраст домена, скорость сайта на мобильных и десктопе, Core Web Vitals. Обратите внимание — мы чётко разделяем, где данные из реальных API, а где гипотезы AI. Видите эти бейджи «факт» и «AI»? Так вы всегда знаете, чему доверять.',
    async action(page) {
      // Нав на дашборд
      const dashboardLink = await page.$('text=Дашборд');
      if (dashboardLink) {
        await dashboardLink.click();
        await page.waitForTimeout(3000);
      }
      // Показ шапки → плавно к KPI
      await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
      await page.waitForTimeout(6000);
      await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
      await page.waitForTimeout(6000);
      // Подсветка PageSpeed Mobile/Desktop переключателя
      const desktopTab = await page.$('text=ПК').catch(() => null);
      if (desktopTab) {
        await desktopTab.hover();
        await page.waitForTimeout(2000);
        await desktopTab.click();
        await page.waitForTimeout(3000);
      } else {
        await page.waitForTimeout(5000);
      }
      await page.waitForTimeout(5000);
    },
  },
  {
    id: 'finances-team',
    duration: 30,
    voiceover: 'Финансовый блок — это данные из Русспрофиля и ФНС: выручка, прибыль, ИНН, юридический адрес, наличие судебных дел. Соседний блок — команда и найм через HH-ру: сколько открытых вакансий сейчас, какая средняя зарплата, по каким специальностям ищут.',
    async action(page) {
      // Скролл к финансам
      await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'smooth' }));
      await page.waitForTimeout(7000);
      await page.evaluate(() => window.scrollTo({ top: 1900, behavior: 'smooth' }));
      await page.waitForTimeout(7000);
      // Hover на блок Hiring
      const hiringSection = await page.$('text=Команда').catch(() => null);
      if (hiringSection) {
        await hiringSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(5000);
      }
      await page.waitForTimeout(8000);
    },
  },
  {
    id: 'social-reputation',
    duration: 30,
    voiceover: 'Соцсети — реальные цифры подписчиков из VK и Telegram, никаких выдумок. Если данные не нашлись — стоит прочерк, не AI-фантазия. Рядом — рейтинги на Яндекс-Картах, 2-ГИС и Google: количество звёзд, число отзывов, динамика.',
    async action(page) {
      await page.evaluate(() => window.scrollTo({ top: 2400, behavior: 'smooth' }));
      await page.waitForTimeout(8000);
      await page.evaluate(() => window.scrollTo({ top: 3000, behavior: 'smooth' }));
      await page.waitForTimeout(10000);
      await page.evaluate(() => window.scrollTo({ top: 3600, behavior: 'smooth' }));
      await page.waitForTimeout(8000);
    },
  },
  {
    id: 'sidebar-tour',
    duration: 50,
    voiceover: 'Слева в сайдбаре — все модули платформы. Конкуренты — таблица сравнения с битл-кардами для отдела продаж. Аудитория — портрет целевого клиента с болями, страхами, возражениями. SMM — стратегия по платформам и архетип бренда. Контент-завод — генератор постов, рилсов, сторис и каруселей с автокартинками. Презентации — слайды собираются автоматически. И агенты — фоновые задачи, которые работают за вас круглосуточно.',
    async action(page) {
      const sidebarTargets = [
        { selector: 'text=Конкуренты', wait: 5000 },
        { selector: 'text=Аудитория', wait: 5000 },
        { selector: 'text=СММ', wait: 5000 },
        { selector: 'text=Контент-завод', wait: 6000 },
        { selector: 'text=Презентации', wait: 6000 },
        { selector: 'text=Агенты', wait: 6000 },
      ];
      for (const { selector, wait } of sidebarTargets) {
        const link = await page.$(selector).catch(() => null);
        if (link) {
          try {
            await link.click({ timeout: 3000 });
            await page.waitForTimeout(wait);
          } catch { /* skip if not clickable */ }
        } else {
          await page.waitForTimeout(2000);
        }
      }
      // Возврат на главный дашборд
      const back = await page.$('text=Дашборд').catch(() => null);
      if (back) {
        await back.click().catch(() => {});
        await page.waitForTimeout(4000);
      }
    },
  },
  {
    id: 'owner-dashboard',
    duration: 25,
    voiceover: 'Отдельный режим — дашборд руководителя. Минимум интерфейса, максимум сути: ключевые метрики крупно, по каждому направлению — отдельный таб со сводкой. Это можно открыть на телевизоре в переговорке или показать собственнику бизнеса.',
    async action(page) {
      const ownerLink = await page.$('text=Дашборд руководителя').catch(() => null);
      if (ownerLink) {
        // Может открыться в новой вкладке — обработаем
        const [popup] = await Promise.all([
          page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null),
          ownerLink.click(),
        ]);
        if (popup) {
          await popup.waitForLoadState('networkidle');
          await popup.waitForTimeout(5000);
          await popup.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
          await popup.waitForTimeout(8000);
          await popup.evaluate(() => window.scrollTo({ top: 1400, behavior: 'smooth' }));
          await popup.waitForTimeout(8000);
          await popup.close();
        } else {
          await page.waitForTimeout(15000);
        }
      } else {
        await page.waitForTimeout(15000);
      }
    },
  },
  {
    id: 'outro',
    duration: 15,
    voiceover: 'Это был обзор главного дашборда. В следующих видео разберём подробно: как работает контент-завод, как настроить агентов и что показывает анализ конкурентов. До встречи в MarketRadar24!',
    async action(page) {
      // Возврат на главный дашборд для финального кадра
      const back = await page.$('text=Дашборд').catch(() => null);
      if (back) {
        await back.click().catch(() => {});
      }
      await page.waitForTimeout(3000);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await page.waitForTimeout(12000);
    },
  },
];

// ============================================================
// SRT generator — конвертирует voiceover-текст в субтитры
// синхронные с таймингами сцен
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
  const videoName = `dashboard-demo-${timestamp}`;

  console.log(`▶  Запуск записи: ${videoName}`);
  console.log(`▶  Staging: ${config.stagingUrl}`);
  console.log(`▶  Сцен: ${scenes.length}, общая длительность ~${scenes.reduce((a, s) => a + s.duration, 0)}s`);

  const browser = await chromium.launch({
    headless: true,
    slowMo: config.slowMo,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: config.viewport,
    recordVideo: {
      dir: OUTPUT_DIR,
      size: config.viewport,
    },
    deviceScaleFactor: 1,
    locale: 'ru-RU',
  });

  const page = await context.newPage();

  // Hover-эффект курсора — рисуем кружок чтобы было видно куда клик
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
        console.error(`    ⚠  Ошибка в сцене ${scene.id}:`, err.message);
        // Не падаем — продолжаем запись чтобы пользователь хоть что-то получил
        await page.waitForTimeout(2000);
      }
    }

    console.log('\n✓  Сценарий пройден, закрываю context…');
  } finally {
    await context.close();
    await browser.close();
  }

  // Playwright сохраняет webm с авто-именем, нужно найти и переименовать
  const { readdir, rename } = await import('node:fs/promises');
  const files = await readdir(OUTPUT_DIR);
  const webm = files.find(f => f.endsWith('.webm') && !f.startsWith('dashboard-demo'));
  if (webm) {
    const finalName = `${videoName}.webm`;
    await rename(join(OUTPUT_DIR, webm), join(OUTPUT_DIR, finalName));
    console.log(`\n✓  Видео: ${join(OUTPUT_DIR, finalName)}`);
  }

  // Генерим SRT
  const srt = generateSrt(scenes);
  const srtPath = join(OUTPUT_DIR, `${videoName}.srt`);
  await writeFile(srtPath, srt, 'utf-8');
  console.log(`✓  Субтитры: ${srtPath}`);

  console.log('\n────────────────────────────────────────');
  console.log('Дальше:');
  console.log('  1. Загрузи .srt текст в ElevenLabs — получишь mp3 голоса');
  console.log('  2. (опц.) ffmpeg -i <webm> -c:v libx264 -crf 18 <mp4>');
  console.log('  3. В DaVinci/CapCut: видео + mp3 + опц. burn-in субтитров');
  console.log('────────────────────────────────────────');
}

main().catch(err => {
  console.error('💥 Критическая ошибка:', err);
  process.exit(1);
});
