#!/bin/bash
set -e

echo "=== BEP Research Inference Benchmark ==="
echo "GPU: H100 SXM"
echo "Model: meta-llama/Llama-3.1-8B-Instruct"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Install dependencies
pip install sglang[all] --quiet 2>/dev/null || pip install "sglang[all]" --quiet
pip install flashinfer -i https://flashinfer.ai/whl/cu124/torch2.4/ --quiet 2>/dev/null || true

# Download model
python3 -c "from huggingface_hub import snapshot_download; snapshot_download('meta-llama/Llama-3.1-8B-Instruct')" 2>/dev/null

# Start SGLang server
echo "Starting SGLang server with TP=1..."
python3 -m sglang.launch_server \
  --model-path meta-llama/Llama-3.1-8B-Instruct \
  --tp 1 \
  --port 30000 \
  --mem-fraction-static 0.88 \
  &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server..."
for attempt in $(seq 1 120); do
  if curl -s http://localhost:30000/health > /dev/null 2>&1; then
    echo "Server ready after ${attempt}s"
    break
  fi
  sleep 1
done

# Run benchmarks at different concurrency levels
RESULTS="[]"

echo "--- Concurrency=1, ISL=512, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 512 --random-output-len 512 \
  --num-prompts 10 \
  --request-rate 1 \
  --output-file /tmp/bench_c1_i512.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=1, ISL=1024, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 1024 --random-output-len 512 \
  --num-prompts 10 \
  --request-rate 1 \
  --output-file /tmp/bench_c1_i1024.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=1, ISL=4096, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 4096 --random-output-len 512 \
  --num-prompts 10 \
  --request-rate 1 \
  --output-file /tmp/bench_c1_i4096.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=2, ISL=512, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 512 --random-output-len 512 \
  --num-prompts 20 \
  --request-rate 2 \
  --output-file /tmp/bench_c2_i512.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=2, ISL=1024, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 1024 --random-output-len 512 \
  --num-prompts 20 \
  --request-rate 2 \
  --output-file /tmp/bench_c2_i1024.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=2, ISL=4096, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 4096 --random-output-len 512 \
  --num-prompts 20 \
  --request-rate 2 \
  --output-file /tmp/bench_c2_i4096.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=4, ISL=512, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 512 --random-output-len 512 \
  --num-prompts 40 \
  --request-rate 4 \
  --output-file /tmp/bench_c4_i512.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=4, ISL=1024, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 1024 --random-output-len 512 \
  --num-prompts 40 \
  --request-rate 4 \
  --output-file /tmp/bench_c4_i1024.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=4, ISL=4096, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 4096 --random-output-len 512 \
  --num-prompts 40 \
  --request-rate 4 \
  --output-file /tmp/bench_c4_i4096.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=8, ISL=512, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 512 --random-output-len 512 \
  --num-prompts 80 \
  --request-rate 8 \
  --output-file /tmp/bench_c8_i512.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=8, ISL=1024, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 1024 --random-output-len 512 \
  --num-prompts 80 \
  --request-rate 8 \
  --output-file /tmp/bench_c8_i1024.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=8, ISL=4096, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 4096 --random-output-len 512 \
  --num-prompts 80 \
  --request-rate 8 \
  --output-file /tmp/bench_c8_i4096.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=16, ISL=512, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 512 --random-output-len 512 \
  --num-prompts 160 \
  --request-rate 16 \
  --output-file /tmp/bench_c16_i512.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=16, ISL=1024, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 1024 --random-output-len 512 \
  --num-prompts 160 \
  --request-rate 16 \
  --output-file /tmp/bench_c16_i1024.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=16, ISL=4096, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 4096 --random-output-len 512 \
  --num-prompts 160 \
  --request-rate 16 \
  --output-file /tmp/bench_c16_i4096.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=32, ISL=512, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 512 --random-output-len 512 \
  --num-prompts 200 \
  --request-rate 32 \
  --output-file /tmp/bench_c32_i512.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=32, ISL=1024, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 1024 --random-output-len 512 \
  --num-prompts 200 \
  --request-rate 32 \
  --output-file /tmp/bench_c32_i1024.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=32, ISL=4096, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 4096 --random-output-len 512 \
  --num-prompts 200 \
  --request-rate 32 \
  --output-file /tmp/bench_c32_i4096.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=64, ISL=512, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 512 --random-output-len 512 \
  --num-prompts 200 \
  --request-rate 64 \
  --output-file /tmp/bench_c64_i512.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=64, ISL=1024, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 1024 --random-output-len 512 \
  --num-prompts 200 \
  --request-rate 64 \
  --output-file /tmp/bench_c64_i1024.json \
  2>&1 || echo "FAILED")
echo "$RESULT"

echo "--- Concurrency=64, ISL=4096, OSL=512 ---"
RESULT=$(python3 -m sglang.bench_serving \
  --backend sglang \
  --host localhost --port 30000 \
  --dataset-name random \
  --random-input-len 4096 --random-output-len 512 \
  --num-prompts 200 \
  --request-rate 64 \
  --output-file /tmp/bench_c64_i4096.json \
  2>&1 || echo "FAILED")
echo "$RESULT"


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
    "gpu": "H100 SXM",
    "model": "meta-llama/Llama-3.1-8B-Instruct",
    "modelKey": "llama-8b",
    "tp": 1,
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
