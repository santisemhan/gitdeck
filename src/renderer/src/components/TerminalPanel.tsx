import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { gitClient } from "../services/gitClient";
import { IconTerminal, IconX } from "./icons";

interface TerminalPanelProps {
  repoPath: string;
  height: number;
  onResize: (height: number) => void;
  onClose: () => void;
}

const MIN_HEIGHT = 140;
const MAX_HEIGHT = 520;

export function TerminalPanel({ repoPath, height, onResize, onClose }: TerminalPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "Consolas, Cascadia Mono, Courier New, monospace",
      fontSize: 13,
      lineHeight: 1.3,
      theme: {
        background: "#060b17",
        foreground: "#d5dffe",
        cursor: "#d5dffe"
      }
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    xtermRef.current = term;
    fitRef.current = fit;

    const onDataDispose = term.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      void gitClient.terminalInput(sessionId, data);
    });

    const offTerminalData = gitClient.onTerminalData(({ sessionId, data }) => {
      if (sessionId !== sessionIdRef.current) return;
      term.write(data);
    });

    const offTerminalExit = gitClient.onTerminalExit(({ sessionId, exitCode }) => {
      if (sessionId !== sessionIdRef.current) return;
      term.write(`\r\n[process exited with code ${exitCode}]\r\n`);
      sessionIdRef.current = null;
    });

    void gitClient.terminalCreate(repoPath, Math.max(40, term.cols), Math.max(10, term.rows)).then((result) => {
      if (!result.ok || !result.sessionId) {
        term.write(`Failed to create terminal session: ${result.message || "unknown error"}`);
        return;
      }
      sessionIdRef.current = result.sessionId;
    });

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void gitClient.terminalResize(sessionId, Math.max(40, term.cols), Math.max(10, term.rows));
      }
    });
    resizeObserver.observe(host);

    return () => {
      onDataDispose.dispose();
      offTerminalData();
      offTerminalExit();
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void gitClient.terminalClose(sessionId);
      }
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, [repoPath]);

  useEffect(() => {
    fitRef.current?.fit();
    const sessionId = sessionIdRef.current;
    const term = xtermRef.current;
    if (sessionId && term) {
      void gitClient.terminalResize(sessionId, Math.max(40, term.cols), Math.max(10, term.rows));
    }
  }, [height]);

  const handleStartResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const nextHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + delta));
      onResize(nextHeight);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <section className="terminal-panel" style={{ height }} aria-label="Terminal">
      <div className="terminal-resize-handle" onMouseDown={handleStartResize} />
      <div className="terminal-panel-header">
        <div className="terminal-panel-title">
          <IconTerminal size={14} />
          <span>Terminal</span>
        </div>
        <button type="button" className="terminal-icon-btn" title="Close" onClick={onClose}>
          <IconX size={14} />
        </button>
      </div>
      <div className="terminal-host" ref={hostRef} />
    </section>
  );
}
