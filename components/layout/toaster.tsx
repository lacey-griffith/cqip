'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  toast: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, durationMs = 3500) => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, durationMs }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 space-y-2"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDone={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, toast.durationMs);
    return () => window.clearTimeout(id);
  }, [toast.durationMs, onDone]);

  return (
    <div className="pointer-events-auto rounded-full border border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] px-4 py-2 text-sm font-medium text-[color:var(--f92-dark)] shadow-lg cqip-fade-in">
      {toast.message}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback when used outside the provider — keeps eggs from
    // crashing when something fires before ToasterProvider mounts.
    return { toast: (_msg: string) => {} };
  }
  return ctx;
}
