
# Dumbbell Tracker PWA

Three-day dumbbell programme tracker built with Next.js (App Router), TypeScript, Tailwind, Recharts, and Framer Motion.
Offline-capable via a simple service worker. Data saved to localStorage.

## Quick start
```bash
npm install
npm run dev
# visit http://localhost:3000
```

## Build
```bash
npm run build
npm start
```

## PWA
- Manifest at `public/manifest.webmanifest`
- Service worker at `public/sw.js` (registered in `app/layout.tsx`)
- Add to Home Screen from Safari on iOS once deployed over HTTPS.
