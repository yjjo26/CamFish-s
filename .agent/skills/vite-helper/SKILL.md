---
name: vite-helper
description: Assists with Vite specific tasks like running the dev server, building, and troubleshooting. Use when the user wants to run or build the app.
---

# Vite Helper

## Common Commands

- **Start Dev Server**: `npm run dev`
  - URL is usually `http://localhost:5173`.
  - Check terminal output for exact port.
- **Build**: `npm run build`
  - Outputs to `dist/`.
- **Preview**: `npm run preview`
  - Tests the build locally.

## Troubleshooting

- **Port in use**: If 5173 is busy, Vite will try 5174, etc. Look at the output.
- **Env Variables**: Must start with `VITE_` to be exposed to client. Access via `import.meta.env.VITE_VAR`.
