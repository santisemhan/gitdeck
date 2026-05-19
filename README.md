# GitDeck MVP

Cross-platform desktop Git GUI (macOS + Windows) built with Electron, React, TypeScript, and Node.js.

## Stack

- Electron (main + preload)
- React + TypeScript (renderer)
- Vite (renderer bundling)
- electron-builder (packaging)
- Vitest (unit/integration tests)

## Security Model

- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer has no direct Node.js access
- All backend operations go through `contextBridge` + IPC
- Git and editor execution is isolated in services on main process

## Setup

1. Install dependencies:

```bash
npm install
```

2. Requirements:

- Git CLI installed and available in PATH
- VS Code CLI (`code`) optional, needed for conflict-open actions

3. Start dev mode:

```bash
npm run dev
```

This runs:
- Vite dev server for renderer
- TypeScript watcher for main/preload
- Electron pointed to Vite URL

## Scripts

- `npm run dev` - run Electron + Vite in development
- `npm run build` - build main/preload and renderer
- `npm run test` - run Vitest tests
- `npm run package:mac` - package `.dmg`/`.zip` for macOS
- `npm run package:win` - package installer for Windows

## Packaging

Use electron-builder:

```bash
npm run build
npm run package:mac
npm run package:win
```
