import { createContext, useContext, useState } from "react";
import { SESSION_KEY } from "../config/demoAuth";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return saved?.role === "admin" ||
        (saved?.role === "customer" && saved.customer?.id)
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  const login = (value) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    setSession(value);
  };
  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  };
  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
