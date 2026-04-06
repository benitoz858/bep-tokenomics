"use client";

import SubPageShell from "@/components/SubPageShell";

const SOURCES = [
  {
    category: "Live Data Feeds",
    confidence: "high",
    items: [
      { name: "OpenRouter API", url: "https://openrouter.ai/api/v1/models", what: "Token pricing for 18 frontier models. Fetched daily.", frequency: "Daily (6AM UTC)" },
      { name: "Vast.ai API", url: "https://docs.vast.ai/", what: "GPU spot pricing, availability, reliability scores for H100/H200/B200. Includes rented vs available counts.", frequency: "Daily (6AM UTC)" },
      { name: "Ornn AI (OCPI)", url: "https://www.ornn.com", what: "GPU compute utilization data from the Ornn Compute Price Index. Transaction-based availability metrics derived from real GPU compute trades across the market.", frequency: "Daily (6AM UTC)" },
    ]
  },
  {
    category: "GPU Hardware Specs",
    confidence: "high",
    items: [
      { name: "InferenceX (Apache 2.0)", url: "https://github.com/SemiAnalysisAI/InferenceX-app", what: "GPU specifications: TFLOPS, memory bandwidth, interconnect details for 9 GPU/accelerator models.", frequency: "Updated per hardware launch" },
      { name: "NVIDIA Product Pages", url: "https://www.nvidia.com/en-us/data-center/", what: "Official specs for H100, H200, B200, B300, GB200, GB300.", frequency: "Per product launch" },
      { name: "AMD Instinct Product Pages", url: "https://www.amd.com/en/products/accelerators/instinct.html", what: "Official specs for MI300X, MI325X, MI355X.", frequency: "Per product launch" },
    ]
  },
  {
    category: "Token Pricing History",
    confidence: "high",
    items: [
      { name: "OpenAI Pricing Announcements", url: "https://openai.com/api/pricing/", what: "GPT-4 launch ($60/M), GPT-4 Turbo, GPT-4o, o1, GPT-5 pricing.", frequency: "Per model launch" },
      { name: "Anthropic Pricing", url: "https://docs.anthropic.com/en/docs/about-claude/models", what: "Claude 2 through Opus 4.6 pricing history.", frequency: "Per model launch" },
      { name: "Google AI Pricing", url: "https://ai.google.dev/gemini-api/docs/pricing", what: "Gemini Pro, Flash, Flash-Lite pricing.", frequency: "Per model launch" },
      { name: "DeepSeek Pricing", url: "https://platform.deepseek.com/api-docs/pricing/", what: "V3, R1 pricing.", frequency: "Per model launch" },
    ]
  },
  {
    category: "Enterprise Platform Pricing",
    confidence: "medium",
    items: [
      { name: "Salesforce Agentforce Pricing", url: "https://www.salesforce.com/agentforce/pricing/", what: "$2/conversation, Flex Credits at $0.10/action. $1.8B ARR disclosed Q3 FY26.", frequency: "Quarterly (earnings)" },
      { name: "Salesforce Q3 FY2026 Earnings", url: "https://investor.salesforce.com/news/news-details/2025/Salesforce-Delivers-Record-Third-Quarter-Fiscal-2026-Results/", what: "Revenue, margin, Agentforce deal count, token volume (3.2T tokens).", frequency: "Quarterly" },
      { name: "Zendesk AI Pricing", url: "https://www.zendesk.com/pricing/", what: "$1.50-2.00/resolution. Outcome-based pricing model.", frequency: "Ongoing" },
      { name: "IDC: Zendesk Outcome-Based Pricing", url: "https://my.idc.com/getdoc.jsp?containerId=US53414425", what: "Analyst coverage of Zendesk dynamic pricing plan.", frequency: "One-time" },
      { name: "Intercom Fin Pricing", url: "https://www.intercom.com/pricing", what: "$0.99/resolution. Fin Apex 1.0 proprietary model details.", frequency: "Ongoing" },
      { name: "VentureBeat: Fin Apex 1.0", url: "https://venturebeat.com/technology/intercoms-new-post-trained-fin-apex-1-0-beats-gpt-5-4-and-claude-sonnet-4-6", what: "Intercom's proprietary model benchmarks vs GPT-5.4 and Sonnet 4.6.", frequency: "One-time" },
      { name: "Microsoft 365 Copilot Pricing", url: "https://www.microsoft.com/en-us/microsoft-365-copilot/pricing", what: "$30/user/month. Base price increase to $39 July 2026.", frequency: "Ongoing" },
      { name: "GitHub Copilot Plans", url: "https://github.com/features/copilot/plans", what: "$10-39/user/month tiers. Premium request caps.", frequency: "Ongoing" },
      { name: "Azure OpenAI Pricing", url: "https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/", what: "Per-token and PTU pricing for Azure-hosted OpenAI models.", frequency: "Ongoing" },
      { name: "ServiceNow AI Pricing (eesel)", url: "https://www.eesel.ai/blog/servicenow-ai-pricing", what: "Now Assist pricing analysis: $50-100/user/month estimates.", frequency: "Analyst estimate" },
      { name: "ServiceNow Q4 FY2025 Earnings", url: "https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-Reports-Fourth-Quarter-and-Full-Year-2025-Financial-Results/", what: "Now Assist $600M+ ACV, 31% operating margin, 35% FCF margin.", frequency: "Quarterly" },
      { name: "SAP Business AI Pricing", url: "https://www.sap.com/products/artificial-intelligence/pricing.html", what: "EUR 7/AI Unit. Joule Base free, Premium consumption-based.", frequency: "Ongoing" },
      { name: "Google Workspace Pricing", url: "https://workspace.google.com/pricing", what: "$14-25/user/month. Gemini folded into base plans.", frequency: "Ongoing" },
    ]
  },
  {
    category: "GPU Cloud / TCO",
    confidence: "medium",
    items: [
      { name: "Google Cloud TPU Pricing", url: "https://cloud.google.com/tpu/pricing", what: "TPU v5e, v6e (Trillium) on-demand, spot, and CUD pricing.", frequency: "Ongoing" },
      { name: "AWS EC2 Trainium Pricing", url: "https://aws.amazon.com/ec2/instance-types/trn2/", what: "Trainium 1 (trn1) and Trainium 2 (trn2) instance pricing.", frequency: "Ongoing" },
      { name: "AWS Capacity Blocks Pricing", url: "https://aws.amazon.com/ec2/capacityblocks/pricing/", what: "Reserved GPU capacity pricing on AWS.", frequency: "Ongoing" },
      { name: "Nebius-SemiAnalysis TCO Report", url: "https://nebius.com/blog/posts/gpu-cluster-tco", what: "8-component TCO framework. Nebius vs AWS vs silver-tier neocloud comparison.", frequency: "One-time (March 2026)" },
    ]
  },
  {
    category: "Lab Margins & Provider Economics",
    confidence: "medium",
    items: [
      { name: "The Information: Anthropic Financials", url: "https://www.theinformation.com/", what: "Anthropic -94% gross margin (2024), 40% revised (2025), 77% target (2027).", frequency: "Per report" },
      { name: "MiniMax IPO Prospectus", url: null, what: "MiniMax -24.7% gross margin (2024). Street estimates for 2025-2028.", frequency: "One-time (IPO filing)" },
      { name: "Zhipu IPO Prospectus", url: null, what: "Zhipu -0.4% gross margin (2024). 30% price hike Feb 2026, sold out instantly.", frequency: "One-time (IPO filing)" },
    ]
  },
  {
    category: "BEP Research Computed Metrics",
    confidence: "methodology",
    items: [
      { name: "LLMflation Index", url: null, what: "Weighted basket of frontier model output prices. Base 100 = GPT-4 launch ($60/M, March 2023). Weights: OpenAI 30%, Anthropic 25%, Google 20%, DeepSeek 15%, open-source 10%.", frequency: "Daily" },
      { name: "TCO Multiplier (1.25x)", url: null, what: "Applied to raw GPU spot pricing to account for storage, reliability, goodput losses, support, setup, debugging overhead. Derived from Nebius-SemiAnalysis TCO framework.", frequency: "Static assumption" },
      { name: "Inference Margin Calculator", url: null, what: "GPU throughput estimates (BEP Research) × TCO-adjusted GPU cost ÷ tokens/sec = production cost/M tokens. Compared to API sell price for margin.", frequency: "Daily" },
      { name: "Token Cost Waterfall", url: null, what: "Margin stack estimated from public pricing (high confidence) + estimated tokens-per-interaction (low-medium confidence) + assumed volume discounts (low confidence).", frequency: "Updated per earnings cycle" },
      { name: "Daily Market Brief", url: null, what: "Generated by Claude Opus 4.6 analyzing all live data. Unbiased prompt — grades all providers including Anthropic.", frequency: "Daily" },
    ]
  },
];

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#76B900",
  medium: "#FFB800",
  "medium-low": "#FF6B6B",
  low: "#FF4444",
  methodology: "#A855F7",
};

export default function SourcesPage() {
  return (
    <SubPageShell title="Sources & Methodology">
      <div className="mb-6">
        <p className="text-[13px] text-bep-text leading-[1.7] mb-3">
          BEP Research is committed to transparency. Every data point, estimate, and computed metric on this platform is sourced below. Where we estimate or infer, we say so.
        </p>
        <div className="flex gap-3 text-[10px] font-mono">
          {Object.entries(CONFIDENCE_COLORS).map(([level, color]) => (
            <span key={level} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-bep-dim">{level}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {SOURCES.map((section) => (
          <div key={section.category}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: CONFIDENCE_COLORS[section.confidence] || "#666" }} />
              <h2 className="text-[15px] font-semibold text-bep-white">{section.category}</h2>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
                background: (CONFIDENCE_COLORS[section.confidence] || "#666") + "15",
                color: CONFIDENCE_COLORS[section.confidence] || "#666",
                border: `1px solid ${(CONFIDENCE_COLORS[section.confidence] || "#666")}30`,
              }}>
                {section.confidence}
              </span>
            </div>
            <div className="space-y-1.5">
              {section.items.map((item, i) => (
                <div key={i} className="bg-bep-card border border-bep-border rounded px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-bep-cyan hover:underline">
                            {item.name}
                          </a>
                        ) : (
                          <span className="text-xs font-semibold text-bep-white">{item.name}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-bep-dim leading-relaxed">{item.what}</div>
                    </div>
                    <span className="text-[9px] font-mono text-bep-muted whitespace-nowrap flex-shrink-0">{item.frequency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-bep-card border border-bep-border rounded-md p-4">
        <div className="text-[11px] font-mono text-bep-green uppercase tracking-wider mb-2">Methodology Note</div>
        <div className="text-[12px] text-bep-dim leading-[1.7]">
          BEP Research distinguishes between observed data (API prices, public pricing pages), disclosed data (earnings calls, SEC filings), and estimated data (tokens per interaction, volume discounts, margin calculations). Observed and disclosed data is high confidence. Estimated data carries assumptions that are flagged inline. Our TCO multiplier of 1.25x on spot GPU pricing is derived from the 8-component framework and represents a conservative estimate — actual TCO varies by provider tier. All margin calculations should be treated as directional, not precise. We update estimates as new data becomes available and welcome corrections at ben@bepresearch.com.
        </div>
      </div>
    </SubPageShell>
  );
}
