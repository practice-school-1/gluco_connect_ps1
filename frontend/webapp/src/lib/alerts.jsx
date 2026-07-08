import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AlertsContext = createContext(null);

export function AlertsProvider({ children }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const d = await api("GET", "/alerts/unresolved");
      setCount((d || []).length);
    } catch {
      // leave count as-is on failure
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return <AlertsContext.Provider value={{ count, refresh }}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertsProvider");
  return ctx;
}
