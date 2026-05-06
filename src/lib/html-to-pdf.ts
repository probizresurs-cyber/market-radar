/**
 * HTML → PDF через puppeteer-core + @sparticuz/chromium.
 * Используется для генерации счетов и актов в формате A4.
 *
 * NOTE: dynamic import — чтобы не ломать edge-runtime на этапе билда.
 */

export async function htmlToPdfA4(html: string, options: { landscape?: boolean } = {}): Promise<Buffer> {
  const chromium = (await import("@sparticuz/chromium")).default;
  const puppeteer = (await import("puppeteer-core")).default;

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1240, height: 1754 }, // ~A4 portrait at ~150dpi
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    const pdf = await page.pdf({
      format: "A4",
      landscape: options.landscape ?? false,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
