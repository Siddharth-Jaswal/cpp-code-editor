import { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

function OutputView({ output }) {
  return (
    <pre className="min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-sm leading-6 text-slate-200">
      {output || 'Run the program to see stdout or compilation errors.'}
    </pre>
  );
}

function TerminalView({ activeTerminal, sessionId, onReady }) {
  const hostRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current || !activeTerminal || !sessionId) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#020617',
        foreground: '#e2e8f0',
        cursor: '#22c55e',
        selectionBackground: 'rgba(148, 163, 184, 0.3)',
      },
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const sendSize = () => {
      fitAddon.fit();
      window.electronAPI.resizeTerminal({
        sessionId,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    };

    const disposeData = terminal.onData((data) => {
      window.electronAPI.sendTerminalInput({
        sessionId,
        input: data,
      });
    });

    const unsubscribe = window.electronAPI.onTerminalEvent((payload) => {
      if (payload?.sessionId !== sessionId) {
        return;
      }

      if (payload.type === 'terminal-opened') {
        terminal.clear();
        terminal.writeln(`${payload.terminal.label} ready.`);
        onReady?.(payload.terminal);
        sendSize();
        return;
      }

      if (payload.type === 'terminal-data') {
        terminal.write(payload.data);
        return;
      }

      if (payload.type === 'terminal-error') {
        terminal.writeln(payload.error);
        return;
      }

      if (payload.type === 'terminal-exit') {
        terminal.writeln(`\r\n[process exited with code ${payload.code ?? 0}]`);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      sendSize();
    });
    resizeObserver.observe(hostRef.current);
    sendSize();

    return () => {
      resizeObserver.disconnect();
      unsubscribe();
      disposeData.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [activeTerminal, onReady, sessionId]);

  if (!activeTerminal || !sessionId) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-sm text-slate-500">
        Open a terminal from the + menu.
      </div>
    );
  }

  return <div ref={hostRef} className="h-full w-full px-2 py-2" />;
}

function OutputPanel({
  output,
  bottomMode,
  onModeChange,
  terminalOptions,
  onRefreshTerminals,
  onOpenTerminal,
  activeTerminal,
  terminalSessionId,
  onTerminalReady,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const terminalLabel = useMemo(() => activeTerminal?.label || 'Terminal', [activeTerminal]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    onRefreshTerminals();
  }, [pickerOpen, onRefreshTerminals]);

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-slate-900/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onModeChange('output')}
            className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              bottomMode === 'output'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-500 hover:text-slate-200'
            }`}
          >
            Output
          </button>
          <button
            type="button"
            onClick={() => onModeChange('terminal')}
            className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              bottomMode === 'terminal'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-500 hover:text-slate-200'
            }`}
          >
            {terminalLabel}
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((current) => !current)}
            className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-1 text-sm text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
          >
            +
          </button>

          {pickerOpen ? (
            <div className="absolute right-0 top-9 z-10 w-56 rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
              <div className="border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Open Terminal
              </div>
              <div className="max-h-56 overflow-auto py-1">
                {terminalOptions.length > 0 ? (
                  terminalOptions.map((terminal) => (
                    <button
                      key={terminal.id}
                      type="button"
                      onClick={() => {
                        onOpenTerminal(terminal);
                        setPickerOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-900"
                    >
                      <span>{terminal.label}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-slate-500">No supported terminals detected.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {bottomMode === 'terminal' ? (
          <TerminalView
            activeTerminal={activeTerminal}
            sessionId={terminalSessionId}
            onReady={onTerminalReady}
          />
        ) : (
          <OutputView output={output} />
        )}
      </div>
    </section>
  );
}

export default OutputPanel;
