# Frontend - Next.js ERP Analytics

Frontend migrado de Vite para Next.js (App Router), mantendo os dashboards e integrações com o backend FastAPI atual.

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Build

```bash
npm run build
npm run start
```

## Available Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run start` - Run production server
- `npm run lint` - Lint using Next.js rules

## Environment

Create `.env.local` in `frontend/`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
```

If omitted, frontend defaults to `http://localhost:8001`.

## Project Structure

```
src/
├── app/             # Next.js app router entrypoints
├── pages/           # Internal dashboard page composition
├── components/      # Dashboard/template components
├── api/             # Backend client wrappers
├── store/           # Zustand state
└── lib/             # Utilities and theme helpers
```

## Notes

- Existing template dashboards (`custos`, `efetivo`, `orcamento`) were preserved.
- Upload/session flow remains compatible with `/api/upload` from backend.
- Visual shell updated to follow the latest ERP style direction.
