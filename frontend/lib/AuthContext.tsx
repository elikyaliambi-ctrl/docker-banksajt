"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Håller access-token bara i React state, aldrig i localStorage eller
// sessionStorage. Det gör att JavaScript på sidan har det enda stället där
// token finns, och att en omladdning loggar ut användaren, precis som
// uppgiften kräver.
type AuthContextValue = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  function logout() {
    setAccessToken(null);
  }

  return (
    <AuthContext.Provider value={{ accessToken, setAccessToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth måste användas inom en AuthProvider");
  }

  return context;
}
