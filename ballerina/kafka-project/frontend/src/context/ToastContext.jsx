import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const notify = useCallback((message, kind = "success") => {
    clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && (
        <div
          className={`toast ${toast.kind}`}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
