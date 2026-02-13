import { api } from "./api";

interface LoginResponse {
  token: string;
  expires_at: number;
}

interface UserResponse {
  id: string;
  role: string;
  name: string;
  email: string;
  email_verified_at?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<UserResponse> {
  return api<UserResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return api<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  return api<void>("/auth/logout", { method: "POST" });
}

export async function verifyEmail(token: string): Promise<void> {
  return api<void>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
