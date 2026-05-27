#!/usr/bin/env node
/**
 * Запись скринкаста: регистрация на лендинге → wizard → первый анализ.
 *
 * Хронометраж ~4:30. Демо-аккаунт создаётся каждый раз новый
 * (timestamp в email), чтобы не упираться в "email already exists".
 *
 * Использование:
 *   STAGING_URL=https://staging.marketradar24.ru \
 *   LANDING_URL=https://marketradar24.ru \
 *   node scripts/demo-recording/record-registration-demo.mjs
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
  // Уникальный demo-аккаунт каждый запуск
  demoEmail: process.env.DEMO_EMAIL || `demo${ts}@marketradar24.test`,
  demoPassword: process.env.DEMO_PASSWORD || 'DemoVideo2026!',
  demoName: process.env.DEMO_NAME || 'Иван Демидов',
  companyUrl: process.env.TEST_COMPANY_URL || 'me-dent.ru',
  viewport: { width: 1920, height: 1080 },
  slowMo: 220,
};

// ============================================================
// Helpers
// ============================================================

async function smoothScrollTo(page, y, settle = 1500) {
  await page.evaluate((target) => window.scrollTo({ top: target, behavior: 'smooth' }), y);
  await page.waitForTimeout(settle);
}

async function scrollToText(page, text, settle = 2500) {
  try {
    const loc = page.locator(`text=${text}`).first();
    await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(settle);
    return true;
  } catch { return false; }
}

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
// Сцены
// ============================================================

const scenes = [
  {
    id: '01-landing-intro',
    duration: 22,
    voiceover: 'Привет! Покажу как за 2 минуты зарегистрироваться в MarketRadar24 и запустить первый анализ компании. Никаких длинных анкет, паспортов или карт — нужны только email, пароль и адрес сайта. Поехали.',
    async action(page) {
      await page.goto(config.landingUrl, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(3000);
      // Показ hero-секции
      await page.waitForTimeout(4000);
      // Плавный скролл до блока «Что вы получите»
      await smoothScrollTo(page, 700, 3500);
      await smoothScrollTo(page, 1400, 3500);
      // Возврат наверх к CTA
      await smoothScrollTo(page, 0, 4000);
    },
  },
  {
    id: '02-click-register',
    duration: 14,
    voiceover: 'Жму кнопку регистрации. Она есть и в шапке, и в hero-блоке, и в любом призывном баннере на странице — куда удобнее.',
    async action(page) {
      // Пробуем разные варианты CTA на лендинге
      const candidates = [
        'a[href*="register"]',
        'text=Зарегистрироваться',
        'text=Попробовать',
        'text=Начать бесплатно',
        'text=Регистрация',
        'text=Войти',
      ];
      let clicked = false;
      for (const sel of candidates) {
        if (await safeClick(page, sel, 3000)) {
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        // Fallback — прямой переход
        await page.goto(`${config.landingUrl}/register`, { waitUntil: 'networkidle' }).catch(() => {});
      }
      await page.waitForTimeout(6000);
    },
  },
  {
    id: '03-fill-registration',
    duration: 30,
    voiceover: 'Форма регистрации. Ввожу почту, придумываю пароль, добавляю имя и адрес своего сайта. Здесь я возьму сайт стоматологической клиники me-dent.ru — на нём и покажу анализ. Никаких подтверждений по SMS — это staging-окружение для демо.',
    async action(page) {
      // Заполняем форму регистрации
      await safeFill(page, 'input[type=email], input[name=email]', config.demoEmail);
      await page.waitForTimeout(1500);
      await safeFill(page, 'input[type=password], input[name=password]', config.demoPassword);
      await page.waitForTimeout(1500);
      // Имя (если есть поле)
      const nameSelectors = ['input[name=name]', 'input[name=fullName]', 'input[placeholder*="Имя"]'];
      for (const sel of nameSelectors) {
        if (await safeFill(page, sel, config.demoName, 2000)) break;
      }
      await page.waitForTimeout(1500);
      // URL компании (если в форме есть поле)
      const urlSelectors = ['input[name=companyUrl]', 'input[name=url]', 'input[placeholder*="сайт"]', 'input[type=url]'];
      for (const sel of urlSelectors) {
        if (await safeFill(page, sel, config.companyUrl, 2000)) break;
      }
      await page.waitForTimeout(5000);
    },
  },
  {
    id: '04-submit-registration',
    duration: 18,
    voiceover: 'Жму «Зарегистрироваться». Платформа создаёт аккаунт и автоматически переводит в личный кабинет. Никакой почтовой подтверждения для тестового окружения — сразу в работу.',
    async action(page) {
      // Submit
      const submitCandidates = [
        'button[type=submit]',
        'text=Зарегистрироваться',
        'text=Создать аккаунт',
        'text=Начать',
      ];
      for (const sel of submitCandidates) {
        if (await safeClick(page, sel, 3000)) break;
      }
      // Ждём редирект на платформу
      await page.waitForTimeout(8000);
      // Если есть какой-то wizard onboarding — ждём ещё
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(4000);
    },
  },
  {
    id: '05-wizard-intro',
    duration: 22,
    voiceover: 'Открывается мастер первого анализа. Это пошаговый wizard где можно выбрать что именно анализировать. Я хочу всё разом — анализ самой компании, конкурентов, целевую аудиторию и SMM-стратегию. Все четыре модуля будут собираться параллельно.',
    async action(page) {
      // Скриним wizard. Возможные локации: /, /?nav=new-analysis, /onboarding
      // Пробуем разные варианты найти wizard
      const wizardSelectors = [
        'text=Новый анализ',
        'text=Запустить анализ',
        'text=Анализ компании',
        'text=Wizard',
      ];
      for (const sel of wizardSelectors) {
        if (await scrollToText(page, sel.replace('text=', ''), 3000)) break;
      }
      await page.waitForTimeout(5000);
      // Если URL не заполнен в форме регистрации — подскажем здесь
      const urlFieldSelectors = ['input[type=url]', 'input[placeholder*="сайт"]', 'input[placeholder*="URL"]'];
      for (const sel of urlFieldSelectors) {
        const exists = await page.$(sel);
        if (exists) {
          const value = await exists.inputValue().catch(() => '');
          if (!value) {
            await exists.fill(config.companyUrl);
            await page.waitForTimeout(2000);
          }
          break;
        }
      }
      await page.waitForTimeout(8000);
    },
  },
  {
    id: '06-select-modules',
    duration: 25,
    voiceover: 'В мастере отмечаю чекбоксами все 4 модуля. Можно запустить только основной анализ — это будет быстрее. Но я возьму максимум — за 3-5 минут платформа соберёт картину по всем 12 источникам сразу: ФНС, HH.ru, карты, ВКонтакте, Telegram, Keys.so, SpyWords.',
    async action(page) {
      // Кликаем чекбоксы модулей
      const moduleCheckboxes = [
        'text=Конкуренты',
        'text=Аудитория',
        'text=СММ',
        'text=Целевая аудитория',
        'text=SMM',
      ];
      for (const sel of moduleCheckboxes) {
        await safeClick(page, sel, 2000);
        await page.waitForTimeout(1500);
      }
      await page.waitForTimeout(8000);
    },
  },
  {
    id: '07-launch-analysis',
    duration: 25,
    voiceover: 'Жму «Запустить анализ». Платформа стартует все четыре модуля параллельно. Появляется тост-сообщение «Запустили 3 модуля в фоне». Прогресс виден в шапке — можно пойти поработать или дождаться, обычно занимает 3-5 минут.',
    async action(page) {
      // Кнопка запуска
      const launchCandidates = [
        'text=Запустить анализ',
        'text=Запустить',
        'text=Начать анализ',
        'button[type=submit]',
      ];
      for (const sel of launchCandidates) {
        if (await safeClick(page, sel, 3000)) break;
      }
      // Ждём появление toast / progress
      await page.waitForTimeout(8000);
      await page.waitForTimeout(8000);
    },
  },
  {
    id: '08-progress-view',
    duration: 28,
    voiceover: 'Пока модули собираются, по экрану видно как наполняется дашборд. Сначала появляется шапка с реквизитами компании из ФНС. Дальше PageSpeed-метрики Core Web Vitals для мобильных и десктопа. Постепенно прорисовываются Keys.so данные — позиции в Яндексе и Google, видимость, конкуренты.',
    async action(page) {
      // Если есть прогресс/спиннер — ждём
      await page.waitForTimeout(8000);
      await smoothScrollTo(page, 400, 5000);
      await smoothScrollTo(page, 1000, 5000);
      await smoothScrollTo(page, 1800, 5000);
      // Возврат наверх
      await smoothScrollTo(page, 0, 3000);
    },
  },
  {
    id: '09-final-result',
    duration: 22,
    voiceover: 'Готово! Дашборд заполнен. Видно общую оценку, SEO-метрики, финансовые показатели, соцсети с реальными подписчиками, рейтинги на картах. Слева в сайдбаре — все остальные модули: конкуренты, ЦА, SMM-стратегия. Каждый — это отдельный детальный экран.',
    async action(page) {
      // Финальный показ полного дашборда
      await smoothScrollTo(page, 0, 3000);
      await page.waitForTimeout(6000);
      await smoothScrollTo(page, 600, 4000);
      await smoothScrollTo(page, 1200, 4000);
      await page.waitForTimeout(5000);
    },
  },
  {
    id: '10-outro',
    duration: 14,
    voiceover: 'Всё — это была регистрация и первый анализ. Дальше можно углубляться в любой модуль или сразу идти в Контент-завод. В следующих видео разберу всё подробно. До встречи в MarketRadar24!',
    async action(page) {
      await smoothScrollTo(page, 0, 2000);
      await page.waitForTimeout(11000);
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
  console.log(`▶  Landing: ${config.landingUrl}`);
  console.log(`▶  Staging: ${config.stagingUrl}`);
  console.log(`▶  Demo-email: ${config.demoEmail}`);
  console.log(`▶  Компания для анализа: ${config.companyUrl}`);
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
  console.log(`Demo-email: ${config.demoEmail}`);
  console.log('Дальше:');
  console.log('  1. Загрузи .srt текст в ElevenLabs → 10 mp3 голоса');
  console.log('  2. (опц.) ffmpeg -i <webm> -c:v libx264 -crf 18 <mp4>');
  console.log('  3. В DaVinci/CapCut: видео + mp3 + опц. burn-in субтитров');
  console.log('────────────────────────────────────────');
}

main().catch(err => {
  console.error('💥 Критическая ошибка:', err);
  process.exit(1);
});
