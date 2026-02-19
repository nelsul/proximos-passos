import { api } from "./api";

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

export interface UserListResponse {
  data: UserResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  avatar_url?: string;
  role?: string;
  is_active?: boolean;
}

export async function listUsers(
  page = 1,
  size = 20,
): Promise<UserListResponse> {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  return api<UserListResponse>(`/users?${params.toString()}`);
}

export async function getUser(id: string): Promise<UserResponse> {
  return api<UserResponse>(`/users/${id}`);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<UserResponse> {
  return api<UserResponse>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
