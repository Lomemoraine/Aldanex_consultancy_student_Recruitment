import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Aldanex Navy — primary brand color
        brand: {
          50:  '#eef1f8',
          100: '#d5dcee',
          200: '#aab8dd',
          300: '#7f95cc',
          400: '#5471bb',
          500: '#2a4ea8',
          600: '#1e3d8f',   // main brand blue (from logo)
          700: '#172f6e',
          800: '#11234f',
          900: '#0b1630',
          950: '#060c1c',
        },
        // Aldanex Orange — accent color
        accent: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',   // main orange accent
          600: '#ea6c0a',
          700: '#c2570a',
          800: '#9a4209',
          900: '#7c3508',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}
export default config
