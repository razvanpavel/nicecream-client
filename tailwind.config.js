/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Nicecream brand colors
        brand: {
          green: '#5AB055',
          red: '#EF3F36',
          blue: '#2972FF',
        },
      },
      fontFamily: {
        heading: ['AlteHaasGrotesk-Bold'],
        body: ['AlteHaasGrotesk-Regular'],
      },
      fontSize: {
        '10xl': ['8.75rem', { lineHeight: '1.1' }],
        '12xl': ['10.625rem', { lineHeight: '1.1' }],
        '14xl': ['12.8125rem', { lineHeight: '1.1' }],
        '16xl': ['15.3125rem', { lineHeight: '1.1' }],
      },
    },
  },
  plugins: [],
};
