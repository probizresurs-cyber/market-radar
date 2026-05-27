#!/usr/bin/env node
/**
 * Запись скринкаста главного дашборда MarketRadar24.
 *
 * Версия 2: акцент на Keys.so и SpyWords. Wizard выпилен (после логина
 * сразу дашборд). Селекторы owner-dashboard и PageSpeed подкручены.
 *
 * Использование:
 *   1. Установить зависимости (один раз):
 *      npm install playwright
 *      npx playwright install chromium
 *
 *   2. Задать env:
 *      export STAGING_URL=https://staging.marketradar24.ru
 *      export TEST_EMAIL=admin@company24.pro
 *      export TEST_PASSWORD=...
 *      export TEST_COMPANY_URL=me-dent.ru
 *
 *   3. Запуск:
 *      node scripts/demo-recording/record-dashboard-demo.mjs
 *
 *   4. Результат:
 *      output/dashboard-demo-<timestamp>.webm
 *      output/dashboard-demo-<timestamp>.srt
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
  email: process.env.TEST_EMAIL || 'admin@company24.pro',
  password: process.env.TEST_PASSWORD || '',
  companyUrl: process.env.TEST_COMPANY_URL || 'me-dent.ru',
  viewport: { width: 1920, height: 1080 },
  slowMo: 220,
};

if (!config.password) {
  console.error('⚠️  Нужно задать TEST_PASSWORD env var');
  process.exit(1);
}

// ============================================================
// Helpers
// ============================================================

/** Плавный scroll до якоря — для синематичных переходов между блоками */
async function smoothScrollTo(page, y, settle = 1500) {
  await page.evaluate((target) => window.scrollTo({ top: target, behavior: 'smooth' }), y);
  await page.waitForTimeout(settle);
}

/** Scroll к элементу по тексту/селектору с центрированием */
async function scrollToText(page, text, settle = 2500) {
  try {
    const loc = page.locator(`text=${text}`).first();
    await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(settle);
    return true;
  } catch {
    return false;
  }
}

/** Безопасный клик — если элемент не найден за 5 секунд, пропускаем без падения */
async function safeClick(page, selector, fallbackTimeout = 5000) {
  try {
    const loc = page.locator(selector).first();
    await loc.scrollIntoViewIfNeeded({ timeout: fallbackTimeout });
    await loc.click({ timeout: fallbackTimeout, force: true });
    return true;
  } catch (err) {
    console.log(`    · safeClick: «${selector}» не найден/недоступен (${err.message.slice(0, 50)})`);
    return false;
  }
}

// ============================================================
// Сцены: focus на Keys.so + SpyWords + остальных блоках
// ============================================================

const scenes = [
  {
    id: '01-intro-landing',
    duration: 18,
    voiceover: 'Привет! За пять минут покажу, что вы получаете в главном дашборде MarketRadar24 сразу после анализа. Главный фокус — на блоках Keys.so и SpyWords, где живёт вся SEO-аналитика и видимость конкурентов.',
    async action(page) {
      await page.goto(config.stagingUrl, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(3000);
      await smoothScrollTo(page, 800, 4000);
      await smoothScrollTo(page, 0, 3000);
      await page.waitForTimeout(2000);
    },
  },
  {
    id: '02-login',
    duration: 18,
    voiceover: 'Захожу в платформу. Тестовый аккаунт с уже готовым анализом, чтобы сразу попасть на дашборд и показать все блоки.',
    async action(page) {
      // Ищем кнопку логина по разным вариантам
      const loginCandidates = ['text=Войти', 'a[href*="login"]', 'text=Личный кабинет'];
      for (const sel of loginCandidates) {
        if (await safeClick(page, sel, 3000)) break;
      }
      await page.waitForTimeout(2500);
      try {
        await page.waitForSelector('input[type=email], input[name=email]', { timeout: 10_000 });
        await page.fill('input[type=email], input[name=email]', config.email);
        await page.waitForTimeout(800);
        await page.fill('input[type=password]', config.password);
        await page.waitForTimeout(1500);
        await safeClick(page, 'button[type=submit]', 5000);
        await page.waitForTimeout(5000);
      } catch (err) {
        console.log(`    · login form skip: ${err.message.slice(0, 60)}`);
        await page.waitForTimeout(4000);
      }
    },
  },
  {
    id: '03-dashboard-hero',
    duration: 22,
    voiceover: 'Шапка дашборда — название компании, домен, общий маркетинговый score. Это краткая сводка состояния. Ниже идут детальные блоки: возраст домена, скорость сайта, SEO-данные и реальная аналитика по поисковым системам.',
    async action(page) {
      // Уже на дашборде после логина
      await page.waitForTimeout(3000);
      await smoothScrollTo(page, 0, 3000);
      await page.waitForTimeout(5000);
      await smoothScrollTo(page, 300, 3000);
      await page.waitForTimeout(5000);
      await smoothScrollTo(page, 600, 2500);
    },
  },
  {
    id: '04-pagespeed',
    duration: 28,
    voiceover: 'Блок PageSpeed Insights — реальные Core Web Vitals от Google. LCP, FCP, CLS, TBT — всё что критично для SEO и пользовательского опыта. Метрики снимаются отдельно для мобильных и десктопа, потому что Google ранжирует их по-разному.',
    async action(page) {
      await scrollToText(page, 'PageSpeed', 4000);
      await page.waitForTimeout(5000);
      // Hover на Core Web Vitals если есть
      await scrollToText(page, 'Core Web Vitals', 4000).catch(() => {});
      await page.waitForTimeout(5000);
      // Попытка переключения Mobile / ПК — без падения
      const desktopCandidates = ['button:has-text("ПК")', 'button:has-text("Desktop")', 'text=Десктоп'];
      for (const sel of desktopCandidates) {
        if (await safeClick(page, sel, 3000)) {
          await page.waitForTimeout(4000);
          break;
        }
      }
      await page.waitForTimeout(3000);
    },
  },
  {
    id: '05-keyso-overview',
    duration: 45,
    voiceover: 'Главный SEO-блок — Keys.so. Здесь живая статистика по позициям сайта в Яндексе и Google. Сколько ключей в топ-1, топ-3, топ-5, топ-10 и топ-50. Видимость, оценка органического трафика, страниц в выдаче. Всё это собирается напрямую из Keys.so и обновляется по запросу.',
    async action(page) {
      // Раскрываем секцию Keys.so если свернута
      const keysoCandidates = ['text=Данные Key.so', 'text=Данные Keys.so', 'text=Keys.so', 'text=Key.so'];
      for (const sel of keysoCandidates) {
        if (await scrollToText(page, sel.replace('text=', ''), 3000)) break;
      }
      await page.waitForTimeout(4000);
      // Long dwell на цифрах ТОПов
      await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }));
      await page.waitForTimeout(7000);
      await page.evaluate(() => window.scrollBy({ top: 250, behavior: 'smooth' }));
      await page.waitForTimeout(7000);
      // Конкуренты Keys.so
      await scrollToText(page, 'Конкуренты', 3000).catch(() => {});
      await page.waitForTimeout(8000);
      // Ссылочный профиль
      await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
      await page.waitForTimeout(8000);
    },
  },
  {
    id: '06-keyso-charts',
    duration: 30,
    voiceover: 'Графики динамики — позиции, ссылочная масса, доля рынка в нише. Видно как меняется ваша видимость в Яндексе по месяцам и как растёт или падает количество ссылающихся доменов. Эти данные нужны для оценки эффективности SEO-работ.',
    async action(page) {
      // Графики Keys.so — динамика
      await scrollToText(page, 'Динамика', 3000).catch(() => {});
      await page.waitForTimeout(6000);
      await scrollToText(page, 'Ссылочн', 3000).catch(() => {});
      await page.waitForTimeout(8000);
      await scrollToText(page, 'Доля рынка', 3000).catch(() => {});
      await page.waitForTimeout(8000);
      await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }));
      await page.waitForTimeout(5000);
    },
  },
  {
    id: '07-spywords',
    duration: 45,
    voiceover: 'Дополнительный слой — SpyWords. Это вторая база данных поверх Keys.so, которая ловит то, что первая пропускает. Здесь обзор по Яндексу и Google: ключи в топ-10, в топ-50, трафик из органики, ключи в контексте. Можно переключаться между поисковиками и видеть полную картину.',
    async action(page) {
      // Скролл к блоку SpyWords
      const spywordsCandidates = ['text=Данные SpyWords', 'text=SpyWords', 'text=Spywords'];
      for (const sel of spywordsCandidates) {
        if (await scrollToText(page, sel.replace('text=', ''), 4000)) break;
      }
      await page.waitForTimeout(5000);
      // Обзор в Яндексе
      await scrollToText(page, 'ОБЗОР В ЯНДЕКС', 3000).catch(() => {});
      await page.waitForTimeout(8000);
      // Hover на карточки метрик
      await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
      await page.waitForTimeout(7000);
      // Переключение Google
      const googleCandidates = ['button:has-text("Google")', 'text=Google'];
      for (const sel of googleCandidates) {
        if (await safeClick(page, sel, 3000)) {
          await page.waitForTimeout(5000);
          break;
        }
      }
      await page.waitForTimeout(8000);
      await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }));
      await page.waitForTimeout(5000);
    },
  },
  {
    id: '08-business-profile',
    duration: 28,
    voiceover: 'Дальше — бизнес-профиль. Реквизиты компании из ФНС через DaData, финансовые показатели из Русспрофиля: выручка, прибыль, ИНН, юридический адрес, наличие судебных дел. Никаких AI-выдумок — только данные из официальных реестров.',
    async action(page) {
      await scrollToText(page, 'Бизнес-профиль', 3000)
        || await scrollToText(page, 'О компании', 3000)
        || await scrollToText(page, 'ИНН', 3000).catch(() => {});
      await page.waitForTimeout(7000);
      // Финансы
      await scrollToText(page, 'Финансы', 3000)
        || await scrollToText(page, 'Выручка', 3000).catch(() => {});
      await page.waitForTimeout(8000);
      // Rusprofile линк
      await scrollToText(page, 'Rusprofile', 3000).catch(() => {});
      await page.waitForTimeout(6000);
    },
  },
  {
    id: '09-hiring-social',
    duration: 28,
    voiceover: 'Команда и найм — данные с HH.ru: количество открытых вакансий, средняя зарплата, топ-роли. Помогает оценить, насколько компания живая и куда движется. Соцсети — реальные подписчики ВКонтакте и Telegram. Если данных нет — стоит прочерк, а не AI-фантазия.',
    async action(page) {
      // HH.ru
      await scrollToText(page, 'Команда', 3000)
        || await scrollToText(page, 'Найм', 3000)
        || await scrollToText(page, 'HH.ru', 3000)
        || await scrollToText(page, 'Вакансии', 3000).catch(() => {});
      await page.waitForTimeout(7000);
      // Соцсети
      await scrollToText(page, 'Соцсети', 3000)
        || await scrollToText(page, 'ВКонтакте', 3000)
        || await scrollToText(page, 'Telegram', 3000).catch(() => {});
      await page.waitForTimeout(7000);
      await page.evaluate(() => window.scrollBy({ top: 250, behavior: 'smooth' }));
      await page.waitForTimeout(7000);
    },
  },
  {
    id: '10-reviews-maps',
    duration: 24,
    voiceover: 'Репутация на картах — рейтинги в Яндекс-Картах, 2-ГИС и Google: количество звёзд, число отзывов, динамика. Эта информация критична для онлайн-репутации и локального SEO. Дальше — раздел с конкретными отзывами, но это уже отдельный модуль анализа репутации.',
    async action(page) {
      await scrollToText(page, 'Яндекс', 3000)
        || await scrollToText(page, '2GIS', 3000)
        || await scrollToText(page, 'Google', 3000)
        || await scrollToText(page, 'Карты', 3000).catch(() => {});
      await page.waitForTimeout(8000);
      await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
      await page.waitForTimeout(8000);
      // Госконтракты если есть
      await scrollToText(page, 'Госконтракты', 3000).catch(() => {});
      await page.waitForTimeout(5000);
    },
  },
  {
    id: '11-sidebar-modules',
    duration: 35,
    voiceover: 'Это далеко не всё. В сайдбаре слева — все остальные модули платформы. Конкуренты с битл-картами, портрет аудитории, SMM-стратегия, контент-завод с генератором постов и рилсов, презентации, фоновые агенты. Каждый — отдельное видео. Всё это синхронизировано — данные текут между модулями.',
    async action(page) {
      // Возврат наверх для красивого перехода
      await smoothScrollTo(page, 0, 2000);
      const sidebarTargets = [
        { selector: 'text=Конкуренты', wait: 4000 },
        { selector: 'text=Аудитория', wait: 4000 },
        { selector: 'text=СММ', wait: 4000 },
        { selector: 'text=Контент-завод', wait: 5000 },
      ];
      for (const { selector, wait } of sidebarTargets) {
        const clicked = await safeClick(page, selector, 4000);
        if (clicked) await page.waitForTimeout(wait);
        else await page.waitForTimeout(1500);
      }
      // Возврат на дашборд
      await safeClick(page, 'text=Дашборд', 4000);
      await page.waitForTimeout(3000);
    },
  },
  {
    id: '12-outro',
    duration: 15,
    voiceover: 'Главный дашборд — точка входа в платформу. Отсюда вы видите общее состояние и переходите в детальные модули. В следующих видео разберу контент-завод, агентов и анализ конкурентов. До встречи в MarketRadar24!',
    async action(page) {
      await smoothScrollTo(page, 0, 2000);
      await page.waitForTimeout(12000);
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
  const videoName = `dashboard-demo-${timestamp}`;
  const totalDur = scenes.reduce((a, s) => a + s.duration, 0);

  console.log(`▶  Запуск записи: ${videoName}`);
  console.log(`▶  Staging: ${config.stagingUrl}`);
  console.log(`▶  Компания: ${config.companyUrl}`);
  console.log(`▶  Сцен: ${scenes.length}, общая длительность ~${totalDur}s (${Math.floor(totalDur/60)}:${String(totalDur%60).padStart(2,'0')})`);

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

  // Pink cursor для visibility в headless
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

  // Rename auto-generated webm
  const { readdir, rename } = await import('node:fs/promises');
  const files = await readdir(OUTPUT_DIR);
  const webm = files.find(f => f.endsWith('.webm') && !f.startsWith('dashboard-demo'));
  if (webm) {
    const finalName = `${videoName}.webm`;
    await rename(join(OUTPUT_DIR, webm), join(OUTPUT_DIR, finalName));
    console.log(`\n✓  Видео: ${join(OUTPUT_DIR, finalName)}`);
  }

  // Write SRT
  const srt = generateSrt(scenes);
  const srtPath = join(OUTPUT_DIR, `${videoName}.srt`);
  await writeFile(srtPath, srt, 'utf-8');
  console.log(`✓  Субтитры: ${srtPath}`);

  console.log('\n────────────────────────────────────────');
  console.log(`Общий хронометраж: ~${Math.floor(totalDur/60)}:${String(totalDur%60).padStart(2,'0')}`);
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
