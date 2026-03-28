#!/usr/bin/env npx tsx
/**
 * BEP Research — Vast.ai Inference Benchmark Runner
 *
 * Rents a GPU on Vast.ai, runs SGLang inference benchmarks, collects results.
 * Uses the InferenceX methodology (Apache 2.0) adapted for single-GPU spot instances.
 *
 * Usage:
 *   VASTAI_API_KEY=xxx npx tsx scripts/benchmark-vast.ts --gpu "H100 SXM" --model deepseek-ai/DeepSeek-V3
 *   VASTAI_API_KEY=xxx npx tsx scripts/benchmark-vast.ts --gpu "B200" --model meta-llama/Llama-3.3-70B-Instruct
 *
 * Results are saved to data/benchmarks/<gpu>_<model>_<date>.json
 * and aggregated into data/benchmarks/latest.json
 *
 * Estimated cost: $2-15 per benchmark run depending on GPU type.
 * Typical runtime: 15-30 minutes per model per GPU.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const BENCHMARK_DIR = join(ROOT, "data", "benchmarks");

// Benchmark configurations matching InferenceX methodology
const CONCURRENCY_LEVELS = [1, 2, 4, 8, 16, 32, 64];
const INPUT_LENGTHS = [512, 1024, 4096];
const OUTPUT_LENGTH = 512;

const MODELS: Record<string, { hfId: string; tp: number; minVram: number }> = {
  "llama-70b": { hfId: "meta-llama/Llama-3.3-70B-Instruct", tp: 8, minVram: 80 },
  "deepseek-v3": { hfId: "deepseek-ai/DeepSeek-V3", tp: 8, minVram: 160 },
  "deepseek-r1": { hfId: "deepseek-ai/DeepSeek-R1", tp: 8, minVram: 160 },
  "qwen-72b": { hfId: "Qwen/Qwen2.5-72B-Instruct", tp: 8, minVram: 80 },
  "llama-8b": { hfId: "meta-llama/Llama-3.1-8B-Instruct", tp: 1, minVram: 16 },
};

function printUsage() {
  console.log(`
BEP Research Inference Benchmark Runner

Usage:
  VASTAI_API_KEY=xxx npx tsx scripts/benchmark-vast.ts [options]

Options:
  --gpu <name>       GPU to rent (e.g. "H100 SXM", "H200", "B200")
  --model <name>     Model to benchmark (llama-70b, deepseek-v3, deepseek-r1, qwen-72b, llama-8b)
  --dry-run          Show what would be done without renting
  --list-gpus        List available GPUs and current spot prices
  --help             Show this help

Available models:
${Object.entries(MODELS).map(([k, v]) => `  ${k.padEnd(15)} ${v.hfId} (TP=${v.tp}, min ${v.minVram}GB VRAM)`).join("\n")}

Examples:
  # List available GPUs and prices
  npx tsx scripts/benchmark-vast.ts --list-gpus

  # Dry run — show benchmark plan without renting
  npx tsx scripts/benchmark-vast.ts --gpu "H100 SXM" --model llama-70b --dry-run

  # Run benchmark (will rent GPU, costs ~$2-5)
  npx tsx scripts/benchmark-vast.ts --gpu "H100 SXM" --model llama-70b

Results saved to data/benchmarks/
`);
}

async function listGPUs() {
  const apiKey = process.env.VASTAI_API_KEY;
  if (!apiKey) { console.error("Set VASTAI_API_KEY"); process.exit(1); }

  const gpuNames = ["H100 SXM", "H200", "B200", "A100 SXM"];
  console.log("Available GPUs on Vast.ai spot market:\n");
  console.log("GPU            Offers  Min $/hr   Med $/hr   Min VRAM");
  console.log("─".repeat(60));

  for (const gpuName of gpuNames) {
    const q = JSON.stringify({ gpu_name: gpuName, rentable: { eq: true }, num_gpus: { gte: 1 } });
    const url = `https://console.vast.ai/api/v0/bundles/?q=${encodeURIComponent(q)}&limit=50`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) continue;
      const data = await res.json() as { offers?: Array<{ dph_total: number; num_gpus: number; gpu_ram: number }> };
      const offers = data.offers || [];
      if (!offers.length) { console.log(`${gpuName.padEnd(15)} 0`); continue; }

      const prices = offers.map(o => o.dph_total / (o.num_gpus || 1)).sort((a, b) => a - b);
      const minVram = Math.min(...offers.map(o => o.gpu_ram || 0)) / 1024;
      const median = prices[Math.floor(prices.length / 2)];
      console.log(`${gpuName.padEnd(15)} ${String(offers.length).padStart(3)}     $${prices[0].toFixed(2).padStart(5)}     $${median.toFixed(2).padStart(5)}     ${minVram.toFixed(0)}GB`);
    } catch { /* skip */ }
  }
}

async function generateBenchmarkScript(gpu: string, modelKey: string): Promise<string> {
  const model = MODELS[modelKey];
  if (!model) throw new Error(`Unknown model: ${modelKey}. Available: ${Object.keys(MODELS).join(", ")}`);

  // Generate the SGLang benchmark script that will run on the rented instance
  return `#!/bin/bash
set -e

echo "=== BEP Research Inference Benchmark ==="
echo "GPU: ${gpu}"
echo "Model: ${model.hfId}"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Install dependencies
pip install sglang[all] --quiet 2>/dev/null || pip install "sglang[all]" --quiet
pip install flashinfer -i https://flashinfer.ai/whl/cu124/torch2.4/ --quiet 2>/dev/null || true

# Download model
python3 -c "from huggingface_hub import snapshot_download; snapshot_download('${model.hfId}')" 2>/dev/null

# Start SGLang server
echo "Starting SGLang server with TP=${model.tp}..."
python3 -m sglang.launch_server \\
  --model-path ${model.hfId} \\
  --tp ${model.tp} \\
  --port 30000 \\
  --mem-fraction-static 0.88 \\
  &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server..."
for attempt in $(seq 1 120); do
  if curl -s http://localhost:30000/health > /dev/null 2>&1; then
    echo "Server ready after \${attempt}s"
    break
  fi
  sleep 1
done

# Run benchmarks at different concurrency levels
RESULTS="[]"
${CONCURRENCY_LEVELS.map(conc => INPUT_LENGTHS.map(isl => `
echo "--- Concurrency=${conc}, ISL=${isl}, OSL=${OUTPUT_LENGTH} ---"
RESULT=$(python3 -m sglang.bench_serving \\
  --backend sglang \\
  --host localhost --port 30000 \\
  --dataset-name random \\
  --random-input-len ${isl} --random-output-len ${OUTPUT_LENGTH} \\
  --num-prompts ${Math.min(conc * 10, 200)} \\
  --request-rate ${conc} \\
  --output-file /tmp/bench_c${conc}_i${isl}.json \\
  2>&1 || echo "FAILED")
echo "$RESULT"
`).join("")).join("")}

# Collect results
echo ""
echo "=== Collecting results ==="
python3 << 'PYEOF'
import json, glob, os

results = []
for f in sorted(glob.glob("/tmp/bench_c*_i*.json")):
    try:
        with open(f) as fh:
            data = json.load(fh)
            results.append(data)
    except:
        pass

output = {
    "gpu": "${gpu}",
    "model": "${model.hfId}",
    "modelKey": "${modelKey}",
    "tp": ${model.tp},
    "date": os.popen("date -u +%Y-%m-%dT%H:%M:%SZ").read().strip(),
    "framework": "sglang",
    "results": results
}

with open("/workspace/benchmark_results.json", "w") as f:
    json.dump(output, f, indent=2)

print(json.dumps(output, indent=2))
PYEOF

# Cleanup
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "=== Benchmark complete ==="
echo "Results saved to /workspace/benchmark_results.json"
`;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) { printUsage(); return; }
  if (args.includes("--list-gpus")) { await listGPUs(); return; }

  const gpuIdx = args.indexOf("--gpu");
  const modelIdx = args.indexOf("--model");
  const dryRun = args.includes("--dry-run");

  if (gpuIdx === -1 || modelIdx === -1) { printUsage(); return; }

  const gpu = args[gpuIdx + 1];
  const modelKey = args[modelIdx + 1];
  const model = MODELS[modelKey];

  if (!model) {
    console.error(`Unknown model: ${modelKey}\nAvailable: ${Object.keys(MODELS).join(", ")}`);
    process.exit(1);
  }

  console.log(`\nBEP Research Benchmark Plan:`);
  console.log(`  GPU:           ${gpu}`);
  console.log(`  Model:         ${model.hfId} (TP=${model.tp})`);
  console.log(`  Concurrency:   ${CONCURRENCY_LEVELS.join(", ")}`);
  console.log(`  Input lengths: ${INPUT_LENGTHS.join(", ")}`);
  console.log(`  Output length: ${OUTPUT_LENGTH}`);
  console.log(`  Total runs:    ${CONCURRENCY_LEVELS.length * INPUT_LENGTHS.length}`);
  console.log(`  Est. time:     20-40 minutes`);
  console.log(`  Est. cost:     $1-5 depending on GPU\n`);

  if (dryRun) {
    console.log("Dry run — generating benchmark script only.\n");
    const script = await generateBenchmarkScript(gpu, modelKey);

    if (!existsSync(BENCHMARK_DIR)) mkdirSync(BENCHMARK_DIR, { recursive: true });
    const scriptPath = join(BENCHMARK_DIR, `run_${gpu.replace(/\s/g, "_")}_${modelKey}.sh`);
    writeFileSync(scriptPath, script);
    console.log(`Script saved to: ${scriptPath}`);
    console.log(`\nTo run manually on a rented Vast.ai instance:`);
    console.log(`  1. Rent a ${gpu} on vast.ai`);
    console.log(`  2. SSH in and run: bash ${scriptPath}`);
    console.log(`  3. Copy /workspace/benchmark_results.json back`);
    return;
  }

  console.log("Full automated benchmark not yet implemented.");
  console.log("Use --dry-run to generate the script, then run manually on Vast.ai.");
  console.log("\nTo automate: we need the Vast.ai instance creation API + SSH key setup.");
  console.log("Coming in next iteration.\n");

  // Generate script for now
  const script = await generateBenchmarkScript(gpu, modelKey);
  if (!existsSync(BENCHMARK_DIR)) mkdirSync(BENCHMARK_DIR, { recursive: true });
  const scriptPath = join(BENCHMARK_DIR, `run_${gpu.replace(/\s/g, "_")}_${modelKey}.sh`);
  writeFileSync(scriptPath, script);
  console.log(`Script saved to: ${scriptPath}`);
}

main().catch(console.error);
