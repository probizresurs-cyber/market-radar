/**
 * Scheduled Score refresh.
 *
 * Вызывается внешним планировщиком (Railway Cron, cron-job.org, VPS crontab):
 *
 *   curl -H "x-cron-secret: $CRON_SECRET" \
 *        https://<host>/api/cron/refresh-scores
 *
 * Для каждого пользователя с сохранённой компанией, у которого последний анализ
 * старше MAX_AGE_DAYS, пересчитывает Score и пишет новый snapshot в `user_data`.
 *
 * Не трогает пользователей без активной подписки / без сохранённой компании.
 * Внутренне работает через `scrapeWebsite → analyzeWithClaude → enrich`,
 * в обход `checkAiAccess` (нет пользовательского запроса).
 *
 * ENV:
 *   CRON_SECRET       — обязателен, иначе 401
 *   CRON_BATCH_LIMIT  — максимальное число пользователей за один запуск (default 10)
 */

import { NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { scrapeWebsite } from "@/lib/scraper";
import { analyzeWithClaude } from "@/lib/analyzer";
import { enrichDomainData, enrichCompanyData } from "@/lib/enricher";
import type { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_AGE_DAYS = 30;

interface UserRow {
  user_id: string;
  value: AnalysisResult;
  updated_at: string;
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}

async function handler(req: Request) {
  // 1. Auth via CRON_SECRET header
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await initDb();

  const batchLimit = Math.min(50, Math.max(1, Number(process.env.CRON_BATCH_LIMIT) || 10));

  // 2. Find candidates: users with stored company older than MAX_AGE_DAYS AND active subscription
  const candidates = await query<UserRow>(
    `SELECT ud.user_id, ud.value, ud.updated_at
       FROM user_data ud
       JOIN users u ON u.id = ud.user_id
      WHERE ud.key = 'company'
        AND ud.updated_at < NOW() - ($1 || ' days')::INTERVAL
        AND (u.plan_expires_at IS NULL OR u.plan_expires_at > NOW())
        AND COALESCE(u.tokens_used, 0) < COALESCE(u.tokens_limit, 0)
      ORDER BY ud.updated_at ASC
      LIMIT $2`,
    [String(MAX_AGE_DAYS), batchLimit]
  );

  const results: Array<{ userId: string; ok: boolean; error?: string }> = [];

  for (const row of candidates) {
    try {
      const url = row.value?.company?.url;
      if (!url) {
        results.push({ userId: row.user_id, ok: false, error: "no url" });
        continue;
      }

      const scraped = await scrapeWebsite(url);
      const cleanDomain = scraped.url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
      const domainDataPromise = enrichDomainData(cleanDomain, scraped.socialLinks);
      const result = await analyzeWithClaude(scraped);
      const [domainData, companyData] = await Promise.all([
        domainDataPromise,
        enrichCompanyData(result.company.name, cleanDomain),
      ]);
      const merged: AnalysisResult = {
        ...result,
        ...domainData,
        ...companyData,
        analyzedAt: new Date().toISOString(),
      };

      await query(
        `UPDATE user_data
            SET value = $1::jsonb, updated_at = NOW()
          WHERE user_id = $2 AND key = 'company'`,
        [JSON.stringify(merged), row.user_id]
      );

      results.push({ userId: row.user_id, ok: true });
    } catch (e) {
      results.push({
        userId: row.user_id,
        ok: false,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    batchLimit,
    results,
  });
}
