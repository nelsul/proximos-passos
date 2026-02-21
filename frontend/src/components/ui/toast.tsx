"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-green-700 bg-green-950 text-green-300",
  error: "border-red-700 bg-red-950 text-red-300",
  info: "border-amber-700 bg-amber-950 text-amber-300",
};

const DURATION = 4000;

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const Icon = ICONS[toast.variant];
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss]);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all duration-200 ${VARIANT_STYLES[toast.variant]
        } ${exiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={dismiss}
        className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-0 right-0 z-100 flex flex-col gap-2 p-4">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={() => removeToast(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
