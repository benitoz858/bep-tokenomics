import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bep: {
          bg: "#050505",
          card: "#0a0a0a",
          border: "#1a1a1a",
          border2: "#252525",
          green: "#76B900",
          cyan: "#00D4FF",
          amber: "#FFB800",
          red: "#FF4444",
          purple: "#A855F7",
          pink: "#EC4899",
          white: "#f0f0f0",
          muted: "#666666",
          dim: "#999999",
          text: "#cccccc",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        mono: ["JetBrains Mono", "SF Mono", "Consolas", "monospace"],
        sans: ["Inter", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
