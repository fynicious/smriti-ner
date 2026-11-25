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
        background: "#FDFBF7",
        foreground: "#2D3748",
        mint: {
          50: '#f2fcf5',
          100: '#e1f8e8',
          200: '#c5eed4',
          300: '#9bdeba',
          400: '#69c595',
          500: '#42a775',
          600: '#2f865b',
        },
        peach: {
          50: '#fff7f5',
          100: '#ffede8',
          200: '#ffdad1',
          300: '#ffbea9',
          400: '#ff9473',
          500: '#ff6639',
        },
        lavender: {
          50: '#f6f5fa',
          100: '#ebeaf4',
          200: '#d9d6e9',
          300: '#bdb7d8',
          400: '#9b91c3',
          500: '#7e70ad',
        },
        flo: {
          bg: '#FDFBF7',
          surface: '#FFFFFF',
          text: '#2D3748',
        }
      },

      boxShadow: {
        'soft': '0 4px 20px rgba(0, 0, 0, 0.04)',
        'plush': '0 8px 30px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0,0,0,0.02)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.03)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #e1f8e8 0%, #ffede8 100%)',
        'bubble-mint': 'linear-gradient(135deg, #c5eed4 0%, #9bdeba 100%)',
        'bubble-peach': 'linear-gradient(135deg, #ffdad1 0%, #ffbea9 100%)',
        'bubble-lavender': 'linear-gradient(135deg, #d9d6e9 0%, #bdb7d8 100%)',
        'card-orange': 'linear-gradient(135deg, #ffdad1 0%, #ffbea9 100%)',
        'card-pink': 'linear-gradient(135deg, #ffede8 0%, #ffdad1 100%)',
        'card-teal': 'linear-gradient(135deg, #e1f8e8 0%, #c5eed4 100%)',
      }
    },
  },
  plugins: [],
};
export default config;
