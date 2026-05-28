/**
 * Сценарии для mobile-скринкаста MarketRadar.
 *
 * Каждый сценарий — последовательность действий, которые Playwright выполнит
 * на платформе. Длительность подбирается под центральную сцену рилса
 * (ProductDemoScene = 5..25 сек = 20 сек). Сценарии должны укладываться
 * в 18-22 сек с естественными паузами.
 *
 * v1 — только публичные страницы (без auth):
 *  - marketing-tour: лендинг → pricing → блог → выход
 *
 * v2 (когда дадут демо-креды) добавим:
 *  - dashboard-tour: логин → главный анализ → вкладки конкурентов/ЦА/СММ
 *  - wizard-tour: запуск wizard → ввод компании → результат
 *  - content-tour: открыть контент-завод → план → генерация поста
 *
 * Каждый сценарий — pure async function, принимает {page, baseUrl, wait}
 * и ничего не возвращает. Все запоздалые ошибки кидаются вверх.
 */
import type { ScreencastScenario } from "./screencast-recorder";

const SCENARIOS: Record<string, ScreencastScenario> = {
  /**
   * Tour по публичной маркетинг-части сайта.
   * ~20 сек: home (4) → scroll-down (4) → pricing (5) → blog (4) → tap blog item (3)
   * Не требует логина, работает на любом окружении (staging/prod).
   */
  "marketing-tour": async ({ page, baseUrl, wait }) => {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await wait(2500);

    // Плавный скролл на середину главной — показать ключевые блоки
    await page.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 1.5, behavior: "smooth" });
    });
    await wait(3000);

    // Перейти на /pricing
    await page.goto(`${baseUrl}/pricing`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await wait(2000);
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: "smooth" }));
    await wait(2500);

    // Блог
    await page.goto(`${baseUrl}/blog`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await wait(2500);

    // Скролл по блогу для динамики
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: "smooth" }));
    await wait(2500);
  },

  /**
   * Tour по express-report — публичный лид-магнит с формой ввода URL.
   * Показывает «введи сайт → получи отчёт» — это центральная промо-фишка.
   * Не заполняем форму до конца (отчёт генерится 30-60 сек, не уложимся),
   * а демонстрируем хук-секцию и форму.
   */
  "express-report-demo": async ({ page, baseUrl, wait }) => {
    await page.goto(`${baseUrl}/express-report`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await wait(3000);

    await page.evaluate(() => window.scrollTo({ top: 200, behavior: "smooth" }));
    await wait(2500);

    // Попытаемся найти input под URL и сфокусироваться (анимация фокуса = живой кадр)
    const inputSel = 'input[type="url"], input[placeholder*="ваш"], input[placeholder*="URL" i]';
    const input = await page.$(inputSel);
    if (input) {
      await input.click();
      await wait(500);
      await input.type("https://me-dent.ru", { delay: 80 });
      await wait(2000);
    } else {
      await wait(3000);
    }

    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "smooth" }));
    await wait(3000);
    await page.evaluate(() => window.scrollTo({ top: 1000, behavior: "smooth" }));
    await wait(3000);
  },
};

export function getScenario(id: string): ScreencastScenario | null {
  return SCENARIOS[id] ?? null;
}

export function listScenarios(): string[] {
  return Object.keys(SCENARIOS);
}
