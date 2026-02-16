import { api } from "./api";

export interface TopicResponse {
  id: string;
  parent_id?: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TopicListResponse {
  data: TopicResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface CreateTopicInput {
  name: string;
  description?: string;
  parent_id?: string;
}

export interface UpdateTopicInput {
  name?: string;
  description?: string;
  parent_id?: string;
}

export interface TopicFilter {
  name?: string;
  parent_id?: string;
}

function buildQuery(page: number, size: number, filter?: TopicFilter): string {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (filter?.name) params.set("name", filter.name);
  if (filter?.parent_id !== undefined)
    params.set("parent_id", filter.parent_id);
  return params.toString();
}

export async function listTopics(
  page = 1,
  size = 100,
  filter?: TopicFilter,
): Promise<TopicListResponse> {
  return api<TopicListResponse>(`/topics?${buildQuery(page, size, filter)}`);
}

export async function getTopic(id: string): Promise<TopicResponse> {
  return api<TopicResponse>(`/topics/${id}`);
}

export async function createTopic(
  input: CreateTopicInput,
): Promise<TopicResponse> {
  return api<TopicResponse>("/topics", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTopic(
  id: string,
  input: UpdateTopicInput,
): Promise<TopicResponse> {
  return api<TopicResponse>(`/topics/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteTopic(
  id: string,
  mode?: "cascade" | "reparent",
): Promise<void> {
  const qs = mode ? `?mode=${mode}` : "";
  return api<void>(`/topics/${id}${qs}`, { method: "DELETE" });
}
