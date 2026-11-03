# BetZone

Demo sports-betting UI (Next.js 14, Tailwind, Zustand, Socket.io). Simulated odds and money only.

## Run
```bash
npm install
npm run dev:all      # web on :3000 + odds feed on :4000
```
Separate terminals: `npm run dev` and `npm run feed`.

## Layout
- `src/app` pages and API routes (`/api/booking`)
- `src/components` betslip, match table
- `src/store` Zustand (slip, live odds)
- `src/lib` bet math, booking codes, socket client
- `src/data/fixtures.ts` mock matches
- `server/` odds engine + Socket.io feed + booking store
- `docs/PROJECT_TREE.md` planned full structure
