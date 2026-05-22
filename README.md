# GitDeck

GitDeck is a cross-platform desktop Git GUI for macOS and Windows, built with Electron, React, and TypeScript.

## Overview

GitDeck provides a local-first desktop interface to inspect repositories, history, branches, status, and diffs while keeping Git operations in the secure Electron main process.

## Features

- Repository launcher for opening local Git repositories
- Commit graph and history visualization
- Branch navigation and repository status views
- Diff preview workspace for changed files
- Main-process Git service with IPC bridge to the renderer

## Tech Stack

- Electron (main process + preload)
- React + TypeScript (renderer)
- Vite (renderer build and dev server)
- electron-builder (packaging)
- Vitest (unit and integration tests)

## Security Model

- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer has no direct Node.js access
- Backend actions are exposed only through `contextBridge` + IPC
- Git and editor command execution is isolated in main-process services

## Getting Started

### Requirements

- Node.js 18+
- npm 9+
- Git CLI installed and available in `PATH`
- Optional: VS Code CLI (`code`) for editor integration

### Installation

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

This starts:
- Vite dev server for the renderer
- TypeScript watcher for main/preload
- Electron process connected to the renderer dev server

## Scripts

- `npm run dev`: run Electron + Vite in development
- `npm run build`: build main/preload and renderer bundles
- `npm run test`: run Vitest test suite
- `npm run package:mac`: build and package `.dmg`/`.zip` for macOS
- `npm run package:win`: build and package installer for Windows

## Build and Package

```bash
npm run build
npm run package:mac
npm run package:win
```

## Project Structure

```text
src/
  main/       Electron main process and backend services
  preload/    Secure preload bridge
  renderer/   React UI (application frontend)
  shared/     Shared types and IPC channels
tests/        Unit and integration tests
dist/         Build output
```

## Contributing

Contributions are welcome. Please open an issue for bug reports, feature proposals, or discussions before large changes.

Recommended local checks before opening a pull request:

```bash
npm run test
npm run build
```

## License

This project is licensed under the MIT License. See `LICENSE`.
