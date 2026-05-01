/**
 * M-08 ES 语义搜索召回率评测脚本
 *
 * 用法：
 *   pnpm tsx docs/eval-sets/M-08-es-recall/run-eval.ts \
 *     --locale en \
 *     --output docs/eval-sets/M-08-es-recall/results/$(date +%Y%m%d).json
 *
 * 通过标准：Top-3 覆盖率 >= 0.70（70%）= M-08 基线
 */

import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── 类型 ──────────────────────────────────────────────────────────────────

interface Query {
  query_id: string;
  locale: string;
  query_text: string;
  expected_top3_topics: string; // pipe-separated: "cleaning_tips|ceramic_care|dishwasher_safe"
  index: string;
  min_relevant_in_top3: string; // 最低命中数
  difficulty: 'easy' | 'medium' | 'hard';
}

interface SearchResult {
  id: string;
  score: number;
  topics: string[]; // 文档的 topic tags
  title: string;
}

interface QueryResult {
  queryId: string;
  queryText: string;
  top3Results: SearchResult[];
  expectedTopics: string[];
  relevantHitsInTop3: number;
  minRequired: number;
  hit: boolean; // relevantHitsInTop3 >= minRequired
  latencyMs: number;
}

interface EvalSummary {
  runAt: string;
  locale: string;
  totalQueries: number;
  hitCount: number;
  hitRate: number; // 目标 >= 0.70
  avgLatencyMs: number;
  p95LatencyMs: number;
  passed: boolean;
  byDifficulty: Record<string, { total: number; hits: number; hitRate: number }>;
  results: QueryResult[];
}

// ─── 配置 ──────────────────────────────────────────────────────────────────

const BASELINE_RECALL_RATE = 0.7;
const ES_SEARCH_ENDPOINT =
  process.env.ES_SEARCH_ENDPOINT ?? 'http://localhost:3001/api/internal/es-search';
const EVAL_API_TOKEN = process.env.EVAL_API_TOKEN ?? '';

// ─── ES 查询 ──────────────────────────────────────────────────────────────

async function searchEs(
  index: string,
  query: string,
  locale: string,
): Promise<{ results: SearchResult[]; latencyMs: number }> {
  const start = Date.now();

  const res = await fetch(ES_SEARCH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EVAL_API_TOKEN}`,
    },
    body: JSON.stringify({ index, query, locale, size: 3, evalMode: true }),
  });

  const data = (await res.json()) as { hits: SearchResult[] };
  return { results: data.hits.slice(0, 3), latencyMs: Date.now() - start };
}

// ─── 命中判断 ─────────────────────────────────────────────────────────────

function countRelevantHits(top3: SearchResult[], expectedTopics: string[]): number {
  return top3.filter((result) => result.topics.some((t) => expectedTopics.includes(t))).length;
}

// ─── 主程序 ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const locale = args[args.indexOf('--locale') + 1] ?? 'en';
  const output = args[args.indexOf('--output') + 1] ?? 'results/latest.json';

  const csvPath = join(__dirname, 'queries.csv');
  const allQueries: Query[] = parse(readFileSync(csvPath, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  });

  const queries = allQueries.filter((q) => q.locale === locale);
  console.log(`Running M-08 eval: ${queries.length} queries (locale=${locale})`);

  const results: QueryResult[] = [];

  for (const q of queries) {
    process.stdout.write(`  [${q.query_id}] "${q.query_text.slice(0, 50)}"... `);
    try {
      const { results: top3, latencyMs } = await searchEs(q.index, q.query_text, locale);
      const expectedTopics = q.expected_top3_topics.split('|');
      const minRequired = parseInt(q.min_relevant_in_top3, 10);
      const relevantHits = countRelevantHits(top3, expectedTopics);
      const hit = relevantHits >= minRequired;

      results.push({
        queryId: q.query_id,
        queryText: q.query_text,
        top3Results: top3,
        expectedTopics,
        relevantHitsInTop3: relevantHits,
        minRequired,
        hit,
        latencyMs,
      });

      console.log(
        hit
          ? `✓ HIT (${relevantHits}/${minRequired} relevant in top3)`
          : `✗ MISS (${relevantHits}/${minRequired} relevant in top3)`,
      );
    } catch (err) {
      results.push({
        queryId: q.query_id,
        queryText: q.query_text,
        top3Results: [],
        expectedTopics: [],
        relevantHitsInTop3: 0,
        minRequired: parseInt(q.min_relevant_in_top3, 10),
        hit: false,
        latencyMs: 0,
      });
      console.log(`✗ ERROR: ${err}`);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  // 汇总
  const hits = results.filter((r) => r.hit);
  const hitRate = hits.length / results.length;
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  const byDifficulty: Record<string, { total: number; hits: number; hitRate: number }> = {};
  for (const q of queries) {
    const r = results.find((r) => r.queryId === q.query_id)!;
    const d = q.difficulty;
    if (!byDifficulty[d]) {
      byDifficulty[d] = { total: 0, hits: 0, hitRate: 0 };
    }
    byDifficulty[d].total++;
    if (r.hit) {
      byDifficulty[d].hits++;
    }
    byDifficulty[d].hitRate = byDifficulty[d].hits / byDifficulty[d].total;
  }

  const summary: EvalSummary = {
    runAt: new Date().toISOString(),
    locale,
    totalQueries: results.length,
    hitCount: hits.length,
    hitRate: Math.round(hitRate * 1000) / 1000,
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p95LatencyMs: p95,
    passed: hitRate >= BASELINE_RECALL_RATE,
    byDifficulty,
    results,
  };

  writeFileSync(output, JSON.stringify(summary, null, 2));

  console.log('\n─────────────────────────────────────');
  console.log(
    `Recall Rate:   ${(hitRate * 100).toFixed(1)}% (baseline: ${BASELINE_RECALL_RATE * 100}%)`,
  );
  console.log(`Avg Latency:   ${summary.avgLatencyMs}ms`);
  console.log(`P95 Latency:   ${summary.p95LatencyMs}ms`);
  console.log(`Result:        ${summary.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('─────────────────────────────────────');
  if (!summary.passed) {
    console.error(
      '\n⚠️  M-08 基线未达标，检查 ES index 数据量、embedding 质量、Hybrid Search 权重。',
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
