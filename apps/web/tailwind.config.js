/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: Object.fromEntries([50,100,200,300,400,500,600,700,800,900].map(shade => [shade, `rgb(var(--primary-${shade}) / <alpha-value>)`])),
        ink: 'rgb(var(--ink) / <alpha-value>)', muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)', paper: 'rgb(var(--paper) / <alpha-value>)',
        lime: 'rgb(var(--accent) / <alpha-value>)', sand: '#f3f0e8', accent: 'rgb(var(--accent) / <alpha-value>)',
        danger: '#EF4444',
        warning: '#F59E0B',
      },
      boxShadow: { panel: '0 16px 50px -20px rgba(23,46,37,.18)' },
      container: {
        center: true,
        padding: '1rem',
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1200px',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
