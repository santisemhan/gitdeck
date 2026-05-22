# AGENTS

This document defines collaboration rules for human contributors and coding agents working in this repository.

## Purpose

- Keep contributions safe, reviewable, and consistent.
- Preserve architecture boundaries between Electron main/preload/renderer.
- Make automated contributions predictable for maintainers.

## Repository Context

- Platform: Electron desktop app (Windows and macOS).
- Frontend: React + TypeScript in `src/renderer`.
- Backend/runtime logic: Electron main process in `src/main`.
- Secure bridge: preload script in `src/preload`.
- Shared contracts: `src/shared`.

## Core Engineering Rules

1. Security first:
   - Do not enable `nodeIntegration` in renderer contexts.
   - Keep `contextIsolation` enabled.
   - Expose only explicit, minimal APIs through preload.
2. Respect process boundaries:
   - Git/OS command execution belongs in main-process services.
   - Renderer must communicate through typed IPC channels only.
3. Keep changes focused:
   - Prefer small, scoped pull requests.
   - Avoid unrelated refactors in feature or bug-fix PRs.
4. Maintain type safety:
   - Avoid `any` unless clearly justified.
   - Update shared types when API contracts change.

## Coding Standards

- Language: TypeScript.
- Prefer clear function names and single-responsibility modules.
- Handle errors explicitly and return actionable messages.
- Avoid introducing hidden global state.
- Keep imports and dependencies minimal.

## Testing and Validation

Before submitting changes, run:

```bash
npm run test
npm run build
```

If you change packaging or platform behavior, also validate relevant package command(s):

```bash
npm run package:mac
npm run package:win
```

## Pull Request Guidelines

- Include a concise summary of what changed and why.
- List any security-sensitive or IPC contract changes.
- Mention testing performed and outcomes.
- Include screenshots/GIFs for UI behavior changes when applicable.

## Agent-Specific Expectations

When an AI agent contributes:

- Read existing conventions before editing.
- Do not perform destructive Git operations.
- Do not modify unrelated files.
- Prefer deterministic, reproducible edits.
- Document assumptions in the PR description.

## Out of Scope for Agents

- Publishing releases without explicit maintainer instruction.
- Rotating credentials/secrets or changing signing infrastructure.
- Force-pushing shared branches.
