// tailwind.config.js
/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary: sky blue (swap palette anytime without renaming classes)
        brand: colors.sky,
        // Accent: slightly deeper to avoid a monotone blue UI
        accent: colors.indigo,
        // Neutral: cool-toned gray that pairs well with blue
        neutral: colors.zinc,
        // Semantic colors
        success: colors.emerald,
        warning: colors.amber,
        danger: colors.rose,
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 10px 20px -10px rgb(0 0 0 / 0.12)',
      },
    },
  },
  plugins: [],
};

