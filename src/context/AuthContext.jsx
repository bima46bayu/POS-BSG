// src/context/AuthContext.jsx
import React, { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile } from "../api/users";

const AuthContext = createContext({ user: null, isLoading: false, error: null });

export function AuthProvider({ children }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <AuthContext.Provider value={{ user: data || null, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() { return useContext(AuthContext); }
