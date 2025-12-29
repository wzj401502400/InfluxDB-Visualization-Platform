// tailwind.config.js
/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主色：天蓝（可随时换一套，不用全局替换类名）
        brand: colors.sky,
        // 次强调：深一点，防止全界面“同一蓝”
        accent: colors.indigo,
        // 中性色：冷一点的灰，配蓝更和谐
        neutral: colors.zinc,
        // 语义色
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

