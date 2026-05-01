/**
 * M-03 AI 客服命中率评测脚本
 *
 * 用法：
 *   pnpm tsx docs/eval-sets/M-03-customer-support/run-eval.ts \
 *     --tenant homtone \
 *     --locale en \
 *     --output docs/eval-sets/M-03-customer-support/results/$(date +%Y%m%d).json
 *
 * 通过标准：hitRate >= 0.65（65%）= M-03 基线
 */

import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── 类型 ──────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  brand: string;
  locale: string;
  category: string;
  question: string;
  expected_topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface EvalResult {
  questionId: string;
  question: string;
  aiResponse: string;
  hit: boolean; // AI 是否给出有用回答（无需人工介入）
  escalated: boolean; // AI 是否建议转人工
  latencyMs: number;
  evaluatorNote?: string;
}

interface EvalSummary {
  runAt: string;
  tenant: string;
  locale: string;
  totalQuestions: number;
  hitCount: number;
  hitRate: number; // 目标 >= 0.65
  escalationRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  passed: boolean;
  byCategory: Record<string, { total: number; hits: number; hitRate: number }>;
  byDifficulty: Record<string, { total: number; hits: number; hitRate: number }>;
  results: EvalResult[];
}

// ─── 配置 ──────────────────────────────────────────────────────────────────

const BASELINE_HIT_RATE = 0.65; // M-03 基线
const CHAT_API_ENDPOINT = process.env.CHAT_API_ENDPOINT ?? 'http://localhost:3001/api/chat';
const CHAT_API_TOKEN = process.env.EVAL_API_TOKEN ?? '';

// ─── 评测逻辑 ─────────────────────────────────────────────────────────────

async function callChatApi(
  tenant: string,
  locale: string,
  question: string,
): Promise<{ response: string; escalated: boolean; latencyMs: number }> {
  const start = Date.now();

  const res = await fetch(CHAT_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHAT_API_TOKEN}`,
      'X-Tenant': tenant,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: question }],
      locale,
      evalMode: true, // 不计入真实会话统计
    }),
  });

  const data = (await res.json()) as { text: string; escalated: boolean };
  return {
    response: data.text,
    escalated: data.escalated ?? false,
    latencyMs: Date.now() - start,
  };
}

/**
 * 判断 AI 回答是否"命中"（有用，无需转人工）
 *
 * 规则：
 *   1. 回答长度 >= 50 字（非空洞回复）
 *   2. 不含"I don't know" / "I'm not sure" / "please contact" 等放弃句
 *   3. escalated = false（AI 自己认为已解答）
 *
 * 注意：这是自动判断，每月人工抽检 10% 验证准确率
 */
function isHit(response: string, escalated: boolean): boolean {
  if (escalated) {
    return false;
  }
  if (response.length < 50) {
    return false;
  }

  const giveUpPatterns = [
    /i don'?t know/i,
    /i'?m not sure/i,
    /i cannot help/i,
    /please contact (our )?support/i,
    /i don'?t have (that |this )?information/i,
    /i'?m unable to (find|answer|help)/i,
  ];

  return !giveUpPatterns.some((p) => p.test(response));
}

// ─── 主程序 ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const tenant = args[args.indexOf('--tenant') + 1] ?? 'homtone';
  const locale = args[args.indexOf('--locale') + 1] ?? 'en';
  const output = args[args.indexOf('--output') + 1] ?? 'results/latest.json';

  // 加载题集
  const csvPath = join(__dirname, 'questions.csv');
  const allQuestions: Question[] = parse(readFileSync(csvPath, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  });

  // 过滤：按 tenant（brand）+ locale
  const questions = allQuestions.filter((q) => q.brand === tenant && q.locale === locale);

  if (questions.length === 0) {
    console.error(`No questions found for tenant=${tenant} locale=${locale}`);
    process.exit(1);
  }

  console.log(
    `Running M-03 eval: ${questions.length} questions (tenant=${tenant} locale=${locale})`,
  );

  // 逐题评测
  const results: EvalResult[] = [];
  for (const q of questions) {
    process.stdout.write(`  [${q.id}] ${q.question.slice(0, 60)}... `);
    try {
      const { response, escalated, latencyMs } = await callChatApi(tenant, locale, q.question);
      const hit = isHit(response, escalated);
      results.push({
        questionId: q.id,
        question: q.question,
        aiResponse: response,
        hit,
        escalated,
        latencyMs,
      });
      console.log(hit ? '✓ HIT' : '✗ MISS');
    } catch (err) {
      results.push({
        questionId: q.id,
        question: q.question,
        aiResponse: '',
        hit: false,
        escalated: true,
        latencyMs: 0,
        evaluatorNote: String(err),
      });
      console.log('✗ ERROR');
    }

    // 防止过快请求（rate limit）
    await new Promise((r) => setTimeout(r, 300));
  }

  // 汇总统计
  const hits = results.filter((r) => r.hit);
  const hitRate = hits.length / results.length;
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  const byCategory: Record<string, { total: number; hits: number; hitRate: number }> = {};
  const byDifficulty: Record<string, { total: number; hits: number; hitRate: number }> = {};

  for (const q of questions) {
    const r = results.find((r) => r.questionId === q.id)!;
    for (const [key, val] of [
      [q.category, byCategory],
      [q.difficulty, byDifficulty],
    ] as const) {
      if (!val[key]) {
        val[key] = { total: 0, hits: 0, hitRate: 0 };
      }
      val[key].total++;
      if (r.hit) {
        val[key].hits++;
      }
      val[key].hitRate = val[key].hits / val[key].total;
    }
  }

  const summary: EvalSummary = {
    runAt: new Date().toISOString(),
    tenant,
    locale,
    totalQuestions: results.length,
    hitCount: hits.length,
    hitRate: Math.round(hitRate * 1000) / 1000,
    escalationRate:
      Math.round((results.filter((r) => r.escalated).length / results.length) * 1000) / 1000,
    avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p95LatencyMs: p95,
    passed: hitRate >= BASELINE_HIT_RATE,
    byCategory,
    byDifficulty,
    results,
  };

  // 输出
  writeFileSync(output, JSON.stringify(summary, null, 2));

  console.log('\n─────────────────────────────────────');
  console.log(
    `Hit Rate:      ${(hitRate * 100).toFixed(1)}% (baseline: ${BASELINE_HIT_RATE * 100}%)`,
  );
  console.log(`Escalation:    ${(summary.escalationRate * 100).toFixed(1)}%`);
  console.log(`Avg Latency:   ${summary.avgLatencyMs}ms`);
  console.log(`P95 Latency:   ${summary.p95LatencyMs}ms`);
  console.log(`Result:        ${summary.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Output:        ${output}`);
  console.log('─────────────────────────────────────');

  if (!summary.passed) {
    console.error('\n⚠️  M-03 基线未达标，请分析 results 中 hit=false 的条目并提 issue。');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
