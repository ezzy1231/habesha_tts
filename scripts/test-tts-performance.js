/**
 * TTS Performance Benchmark
 * 
 * Measures latency of TTS generation directly (bypasses the queue) so you
 * can isolate Google API + GCS upload time from queueing/waiting time.
 *
 * Usage:
 *   node scripts/test-tts-performance.js [--concurrency=5] [--requests=20] [--engine=cloud]
 *
 * Options:
 *   --concurrency   How many TTS requests to run at the same time (default: 5)
 *   --requests      Total number of TTS requests to run (default: 20)
 *   --engine        'cloud' or 'gemini' (default: cloud)
 *   --voice         Voice name (default: am-ET-Wavenet-A)
 */

import 'dotenv/config';
import { generateTTS } from '../bot/utils/tts.js';

// --- Parse CLI args ---
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.slice(2).split('=');
      return [k, v ?? true];
    })
);

const CONCURRENCY = parseInt(args.concurrency ?? '5');
const TOTAL       = parseInt(args.requests    ?? '20');
const ENGINE      = args.engine ?? 'cloud';
const VOICE       = args.voice  ?? 'am-ET-Wavenet-A';

// Sample Amharic text (short, realistic donation message)
const SAMPLE_TEXTS = [
  '<speak>ሰላም ዮሴፍ! ከሁሉም ዘነበ ቤተሰቦቻቸው ጋር ሰላምታ ይላካሉ።</speak>',
  '<speak>ሀሴት ለማድረግ ትንሽ ስለሆንኩ ይቅርታ።</speak>',
  '<speak>ወንድሜ ሰላም! ሁሌም ትጉ።</speak>',
  '<speak>ከሁሉም ጋር ሰላምታ!</speak>',
  '<speak>ጤና ይስጥልን ሁሉም።</speak>',
];

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runOne(id) {
  const text = SAMPLE_TEXTS[id % SAMPLE_TEXTS.length];
  const fakeId = `perf_test_${Date.now()}_${id}`;
  const t0 = Date.now();
  try {
    await generateTTS(fakeId, text, ENGINE, VOICE, '');
    const ms = Date.now() - t0;
    return { ok: true, ms };
  } catch (err) {
    const ms = Date.now() - t0;
    return { ok: false, ms, err: err.message };
  }
}

async function runBatch(ids) {
  return Promise.all(ids.map(runOne));
}

async function main() {
  console.log('='.repeat(60));
  console.log(`TTS Performance Benchmark`);
  console.log(`  Engine      : ${ENGINE}`);
  console.log(`  Voice       : ${VOICE}`);
  console.log(`  Total reqs  : ${TOTAL}`);
  console.log(`  Concurrency : ${CONCURRENCY}`);
  console.log('='.repeat(60));

  const all = [];
  const wallStart = Date.now();
  let completed = 0;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < TOTAL; i += CONCURRENCY) {
    const batch = Array.from({ length: Math.min(CONCURRENCY, TOTAL - i) }, (_, j) => i + j);
    const batchStart = Date.now();
    const results = await runBatch(batch);
    const batchMs = Date.now() - batchStart;
    completed += results.length;

    const batchOk    = results.filter(r => r.ok).map(r => r.ms);
    const batchFail  = results.filter(r => !r.ok);
    const batchAvg   = batchOk.length ? (batchOk.reduce((a,b)=>a+b,0)/batchOk.length).toFixed(0) : '-';

    console.log(`\nBatch ${Math.floor(i/CONCURRENCY)+1}: ${results.length} requests finished in ${batchMs}ms`);
    console.log(`  Success: ${batchOk.length}  Failed: ${batchFail.length}  Avg latency: ${batchAvg}ms`);
    if (batchFail.length) {
      batchFail.forEach(f => console.log(`  ❌ ${f.err}`));
    }

    all.push(...results);
  }

  const wallMs = Date.now() - wallStart;
  const ok  = all.filter(r => r.ok).map(r => r.ms).sort((a,b)=>a-b);
  const err = all.filter(r => !r.ok);

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total requests  : ${TOTAL}`);
  console.log(`  Success         : ${ok.length}`);
  console.log(`  Failed          : ${err.length}`);
  console.log(`  Wall-clock time : ${wallMs}ms (${(wallMs/1000).toFixed(1)}s)`);
  console.log(`  Throughput      : ${(ok.length / (wallMs/1000)).toFixed(2)} req/s`);

  if (ok.length) {
    const avg = (ok.reduce((a,b)=>a+b,0)/ok.length).toFixed(0);
    console.log(`\n  Latency (successful requests):`);
    console.log(`    Min  : ${ok[0]}ms`);
    console.log(`    p50  : ${percentile(ok, 50)}ms`);
    console.log(`    p75  : ${percentile(ok, 75)}ms`);
    console.log(`    p95  : ${percentile(ok, 95)}ms`);
    console.log(`    p99  : ${percentile(ok, 99)}ms`);
    console.log(`    Max  : ${ok[ok.length-1]}ms`);
    console.log(`    Avg  : ${avg}ms`);
  }
  console.log('='.repeat(60));

  process.exit(err.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
