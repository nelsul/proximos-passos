import { api } from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface HandoutTopicResponse {
  id: string;
  name: string;
}

export interface HandoutFileResponse {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
}

export interface HandoutResponse {
  id: string;
  title: string;
  description?: string;
  file: HandoutFileResponse;
  topics: HandoutTopicResponse[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HandoutListResponse {
  data: HandoutResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface UpdateHandoutInput {
  title?: string;
  description?: string;
  topic_ids?: string[];
}

export interface HandoutFilter {
  title?: string;
  topic_id?: string;
}

function buildQuery(
  page: number,
  size: number,
  filter?: HandoutFilter,
): string {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (filter?.title) params.set("title", filter.title);
  if (filter?.topic_id) params.set("topic_id", filter.topic_id);
  return params.toString();
}

export async function listHandouts(
  page = 1,
  size = 10,
  filter?: HandoutFilter,
): Promise<HandoutListResponse> {
  return api<HandoutListResponse>(
    `/handouts?${buildQuery(page, size, filter)}`,
  );
}

export async function getHandout(id: string): Promise<HandoutResponse> {
  return api<HandoutResponse>(`/handouts/${id}`);
}

export async function createHandout(
  formData: FormData,
): Promise<HandoutResponse> {
  const res = await fetch(`${API_BASE_URL}/handouts`, {
    method: "POST",
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

export async function updateHandout(
  id: string,
  input: UpdateHandoutInput,
): Promise<HandoutResponse> {
  return api<HandoutResponse>(`/handouts/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function replaceHandoutFile(
  id: string,
  file: File,
): Promise<HandoutResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/handouts/${id}/file`, {
    method: "POST",
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

export async function deleteHandout(id: string): Promise<void> {
  return api<void>(`/handouts/${id}`, { method: "DELETE" });
}
