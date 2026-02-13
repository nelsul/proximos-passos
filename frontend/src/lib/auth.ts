import { api } from "./api";

interface LoginResponse {
  token: string;
  expires_at: number;
}

export interface UserResponse {
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

export async function requestVerification(email: string): Promise<void> {
  return api<void>("/auth/request-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function getMe(): Promise<UserResponse> {
  return api<UserResponse>("/me", { method: "GET" });
}

export async function updateMe(name: string): Promise<UserResponse> {
  return api<UserResponse>("/me", {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function uploadAvatar(file: File): Promise<UserResponse> {
  const formData = new FormData();
  formData.append("avatar", file);

  const res = await fetch(`${API_BASE_URL}/me/avatar`, {
    method: "PUT",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    }));
    const { ApiRequestError } = await import("./api");
    throw new ApiRequestError(body);
  }

  return res.json();
}

export async function deleteAvatar(): Promise<UserResponse> {
  return api<UserResponse>("/me/avatar", { method: "DELETE" });
}
