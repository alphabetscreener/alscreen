const colors = require('tailwindcss/colors')

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                tech: ['Rajdhani', 'sans-serif'],
            },
            colors: {
                slate: colors.slate,
                cyan: colors.cyan,
                orange: colors.orange,
                red: colors.red,
                'slate-850': '#151f32',
            },
            backgroundImage: {
                'grid-pattern': "linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)",
            },
            backgroundSize: {
                'grid': '40px 40px',
            }
        },
    },
    plugins: [],
}
