/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pulled from the mega.edu wordmark: navy "mega", gold "e", blue "d", green "u"
        mega: {
          navy: "#1E3A8A",
          blue: "#2563EB",
          gold: "#EAB308",
          green: "#16A34A",
          red: "#DC2626",
          purple: "#7C3AED",
          paper: "#F8FAFC",
        },
      },
    },
  },
  plugins: [],
};
