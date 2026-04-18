# Frontend - React + TypeScript Analytics Dashboard

Modern React application for data visualization and analytics.

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

## Build

```bash
npm run build    # Production build → dist/
npm run preview  # Preview production build
```

## Available Scripts

- `npm run dev` - Development server with HMR
- `npm run build` - Production build
- `npm run preview` - Preview production build locally
- `npm run lint` - Lint TypeScript

## Project Structure

```
src/
├── pages/           # Page components (12+ pages)
├── components/      # Reusable React components
├── api/             # API client (axios)
├── store/           # Zustand state management
├── lib/             # Utility functions
└── assets/          # Images, icons, etc.
```

## Key Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **Axios** - HTTP client

## Features

- 12+ analytics pages
- Interactive charts & visualizations
- Real-time data filtering
- Export functionality
- Responsive design (mobile, tablet, desktop)
- Session-based data management

## Configuration

Edit `.env.local` for API settings:
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

---

**Version**: 2.6.0 | **Status**: Production Ready
