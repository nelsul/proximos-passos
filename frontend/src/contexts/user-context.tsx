"use client";

import { createContext, useContext } from "react";

interface UserContextValue {
  role: string;
}

const UserContext = createContext<UserContextValue>({ role: "regular" });

export function UserProvider({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return (
    <UserContext.Provider value={{ role }}>{children}</UserContext.Provider>
  );
}

export function useUserRole(): string {
  return useContext(UserContext).role;
}

export function useIsAdmin(): boolean {
  return useContext(UserContext).role === "admin";
}
