import type { IpcMainInvokeEvent, WebContents } from "electron";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { spawn, type IPty } from "node-pty";
import { Channels } from "../../shared/channels";
import type { TerminalCreateResult } from "../../shared/types";

interface TerminalSession {
  id: string;
  windowId: number;
  pty: IPty;
  sender: WebContents;
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>();
  private sessionsByWindow = new Map<number, Set<string>>();

  createSession(event: IpcMainInvokeEvent, repoPath: string, cols: number, rows: number): TerminalCreateResult {
    try {
      const isWindows = os.platform() === "win32";
      const shell = isWindows ? "cmd.exe" : process.env.SHELL || "/bin/bash";
      const sessionId = randomUUID();
      const term = spawn(shell, [], {
        name: "xterm-256color",
        cols: Math.max(40, cols),
        rows: Math.max(10, rows),
        cwd: repoPath,
        env: process.env as Record<string, string>
      });

      const session: TerminalSession = {
        id: sessionId,
        windowId: event.sender.id,
        pty: term,
        sender: event.sender
      };

      term.onData((data) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(Channels.terminalData, { sessionId, data });
        }
      });

      term.onExit(({ exitCode }) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(Channels.terminalExit, { sessionId, exitCode });
        }
        this.dropSession(sessionId);
      });

      this.sessions.set(sessionId, session);
      const existing = this.sessionsByWindow.get(event.sender.id) ?? new Set<string>();
      existing.add(sessionId);
      this.sessionsByWindow.set(event.sender.id, existing);

      return { ok: true, sessionId };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create terminal session";
      return { ok: false, message };
    }
  }

  input(sessionId: string, data: string): { ok: boolean } {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false };
    session.pty.write(data);
    return { ok: true };
  }

  resize(sessionId: string, cols: number, rows: number): { ok: boolean } {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false };
    session.pty.resize(Math.max(40, cols), Math.max(10, rows));
    return { ok: true };
  }

  close(sessionId: string): { ok: boolean } {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false };
    session.pty.kill();
    this.dropSession(sessionId);
    return { ok: true };
  }

  closeByWindow(windowId: number) {
    const ids = this.sessionsByWindow.get(windowId);
    if (!ids) return;
    for (const id of ids) {
      const session = this.sessions.get(id);
      if (session) session.pty.kill();
      this.sessions.delete(id);
    }
    this.sessionsByWindow.delete(windowId);
  }

  private dropSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    const ids = this.sessionsByWindow.get(session.windowId);
    if (!ids) return;
    ids.delete(sessionId);
    if (ids.size === 0) this.sessionsByWindow.delete(session.windowId);
  }
}
