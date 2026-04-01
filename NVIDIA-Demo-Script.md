# BEP Research — NVIDIA Demo Script

## The Stack: AI Infrastructure Intelligence Platform

**Presenter:** Ben Pouladian, BEP Research
**Duration:** 15 minutes + Q&A
**Audience:** NVIDIA enterprise / developer relations / data center team

---

## Opening (2 min)

> "I run BEP Research — an independent research platform covering AI infrastructure economics from silicon to API. I've published 46 deep-dive articles on Substack covering everything from optical interconnects to HBM economics. What I'm showing you today is **The Stack** — a live, interactive dashboard that tracks the unit economics of AI inference in real time."

> "The reason I'm here: your hardware is the foundation of every number on this dashboard. I want to make sure the data is accurate, and I think there's an opportunity for NVIDIA to use this as a tool to help your customers understand the economics of deploying on your silicon."

---

## Tab 1: Overview (3 min)

**Click: Overview tab**

> "Every morning at 6AM UTC, our pipeline scrapes GPU pricing across 3 markets, pulls live API token pricing from 18 frontier models, and generates this market brief."

**Point to the COMPUTE / MARGINS / ACTION cards:**

> "This is structured like a trading desk morning note. COMPUTE tells you supply — right now H100 availability is at 19%, which is severe shortage territory. MARGINS shows who's profitable and who's burning cash selling tokens below cost. ACTION gives the investment call — where's the value, where's the overpricing."

**Point to the stat cards (19%, 33%, $1.47/hr, etc.):**

> "These six numbers tell you the state of the AI compute market in 10 seconds. The $1.47/hr H100 spot price means someone can produce tokens for about $5.36 per million on your hardware — and sell them for $45/M at premium tier. That's a 88% gross margin story. That's the story NVIDIA should be telling enterprise customers."

---

## Tab 2: Margin Calculator (3 min)

**Click: Margin Calculator tab**

> "This is the crown jewel. Pick a GPU, pick a model, pick a pricing tier — and see the full margin picture instantly."

**Demo: Select H100, Llama 3.3 70B, Premium tier**

> "An H100 at $1.47/hr spot, running Llama 70B, selling at Premium tier — that's a 93% inference margin. Break-even utilization is just 7%. This is the kind of tool your enterprise sales team could use to show customers why NVIDIA silicon pays for itself."

**Toggle to GPU+LPX mode:**

> "When you add LPX decode acceleration — Groq-style language processing — throughput jumps 3.7x and cost drops 27% despite the added hardware cost. This is where the next generation of inference economics goes."

**Key ask:** "Are these throughput numbers — 95 tok/s GPU-only, 350 tok/s with LPX for Llama 70B on H100 — in the right ballpark? We're sourcing from InferenceX benchmarks but would love validated numbers from NVIDIA."

---

## Tab 3: Cluster TCO (2 min)

**Click: Cluster TCO tab**

> "This models the true total cost of ownership across 8 components — not just sticker price. Select the Inference preset: 512 H200s, 36-month contract."

**Point to the key numbers:**

> "The cheapest effective rate is $1.98/hr from Silver-Tier NeoCloud — but Oracle is 2.26x more expensive for the same GPU. That hidden premium is what enterprises don't see when they sign cloud contracts. We break it down to TCO per million tokens: $0.13 at the cheapest provider."

**Key ask:** "For the B300/GB300 generation, can we get early guidance on pricing tiers and NVLink bandwidth specs to model forward TCO?"

---

## Tab 4: Waterfall (2 min)

**Click: Waterfall tab**

> "This is my favorite chart to show investors. Follow $1 of GPU compute through the stack: $1.84 GPU cost becomes $5.36 at token production, becomes $15 at API pricing, becomes $2 at platform level — a 50 to 180x markup from silicon to end user."

> "The insight: NVIDIA's hardware is a tiny fraction of the end cost. The value capture happens at the distribution layer — Zendesk at 99% margin. This is bullish for NVIDIA because it means customers can afford a LOT more GPU."

---

## Tab 5: Hardware (1 min)

**Click: Hardware tab**

> "Full spec comparison across current-gen NVIDIA and AMD accelerators. The headline: GB300 NVL72 with 288 GB VRAM, 8 TB/s bandwidth, and a 72-GPU coherent domain. That's 20.7 TB of memory in a single rack — enough to serve a trillion-parameter model without cross-rack communication."

**Key ask:** "We'd love to include Blackwell Ultra specs as they become available."

---

## Tab 6: Deep Dive (1 min)

**Click: Deep Dive tab**

> "Our proprietary LLMflation Index tracks token price deflation since GPT-4 launch. We're at 21.4 — meaning tokens are 79% cheaper than March 2023. But the spread between cheapest and premium is 211x and widening. The market is bifurcating, not converging. That bifurcation is the investment thesis."

---

## The Ask (1 min)

> "Three things I'd love from this conversation:"

1. **Data validation** — Are our throughput benchmarks and hardware specs accurate? We want institutional credibility.
2. **Early access** — B300/GB300 specs, NVLink 6.0 bandwidth numbers, and Blackwell Ultra pricing guidance for forward modeling.
3. **Distribution** — Would NVIDIA consider linking to The Stack as a resource for enterprise customers evaluating inference economics? We make your value proposition quantifiable.

> "Every number on this dashboard makes NVIDIA look good — because the economics of inference on your hardware are genuinely excellent. We just want to make sure we're telling that story accurately."

---

## Anticipated Questions

**Q: How do you source GPU pricing?**
A: Live scraping from NeoCloud marketplaces (InferenceX API) covering spot and on-demand across H100, H200, B200, plus GCP TPU and AWS Trainium. Updated daily.

**Q: Who's your audience?**
A: Institutional investors (hedge funds, VCs), AI infrastructure procurement teams, and cloud architects. 46 Substack articles, growing subscriber base.

**Q: How is this different from SemiAnalysis?**
A: SemiAnalysis publishes research reports. We build live, interactive tools with real-time data. Different product — reports vs. decision-support platform.

**Q: Is the data behind a paywall?**
A: The dashboard is currently open. We're building toward a premium tier with API access, alerts, and data export for institutional subscribers.
