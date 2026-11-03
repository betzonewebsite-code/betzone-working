import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: { colors: { brand: { 950: '#10271f', 900: '#15382b', 700: '#236247', 500: '#2f8a5e', 100: '#e5f5ec' } } } },
  plugins: [],
};
export default config;
