# GitDeck MVP

Cross-platform desktop Git GUI (macOS + Windows) built with Electron, React, TypeScript, and Node.js.

## Stack

- Electron (main + preload)
- React + TypeScript (renderer)
- Vite (renderer bundling)
- electron-builder (packaging)
- Vitest (unit/integration tests)

## MVP Features

- Open local repository and persist recent repositories
- Repository overview (branch, clean/dirty, ahead/behind, detached HEAD, merge/rebase/cherry-pick/conflicts)
- Changed files with filters (staged/unstaged/untracked/conflicted)
- File diff viewer (staged/unstaged)
- Stage/unstage file, stage all, unstage all
- Commit staged changes
- Branch listing/checkout/create
- Pull/push with explicit error states
- Commit history + commit detail diff
- Cherry-pick + continue/abort workflow
- Open conflicted files/repo in VS Code using `code` CLI

## Security Model

- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer has no direct Node.js access
- All backend operations go through `contextBridge` + IPC
- Git and editor execution is isolated in services on main process

## Project Structure

```text
.
├─ package.json
├─ tsconfig.json
├─ tsconfig.main.json
├─ tsconfig.renderer.json
├─ vite.renderer.config.ts
├─ src
│  ├─ shared
│  │  ├─ channels.ts
│  │  └─ types.ts
│  ├─ main
│  │  ├─ main.ts
│  │  ├─ ipc.ts
│  │  ├─ services
│  │  │  ├─ commandRunner.ts
│  │  │  ├─ gitService.ts
│  │  │  ├─ editorService.ts
│  │  │  └─ recentRepoStore.ts
│  │  └─ parsers
│  │     ├─ statusParser.ts
│  │     └─ historyParser.ts
│  ├─ preload
│  │  └─ preload.ts
│  └─ renderer
│     ├─ index.html
│     └─ src
│        ├─ main.tsx
│        ├─ App.tsx
│        ├─ styles.css
│        └─ env.d.ts
└─ tests
   ├─ statusParser.test.ts
   └─ gitService.integration.test.ts
```

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

## Known Limitations (MVP)

- No visual 3-way merge editor
- No stash/rebase UI flows (rebase state detection only)
- No remote host integrations (GitHub/GitLab)
- Pull uses default merge strategy from local Git config

## Next Steps

1. Add diff syntax highlighting and side-by-side mode
2. Add background fetch/auto-refresh
3. Add stash UI and rebase actions
4. Add operation queue + cancellation controls
5. Add signed commits support
