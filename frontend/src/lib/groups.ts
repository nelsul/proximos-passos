import { api } from "./api";

export interface GroupResponse {
  id: string;
  name: string;
  description?: string;
  access_type: "open" | "closed";
  visibility_type: "public" | "private";
  thumbnail_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupListResponse {
  data: GroupResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  access_type?: "open" | "closed";
  visibility_type?: "public" | "private";
}

export interface GroupFilter {
  name?: string;
  access_type?: string;
  visibility_type?: string;
}

function buildQuery(page: number, size: number, filter?: GroupFilter): string {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (filter?.name) params.set("name", filter.name);
  if (filter?.access_type) params.set("access_type", filter.access_type);
  if (filter?.visibility_type)
    params.set("visibility_type", filter.visibility_type);
  return params.toString();
}

export async function listGroups(
  page = 1,
  size = 20,
  filter?: GroupFilter,
): Promise<GroupListResponse> {
  return api<GroupListResponse>(`/groups?${buildQuery(page, size, filter)}`);
}

export async function listMyGroups(
  page = 1,
  size = 20,
  filter?: GroupFilter,
): Promise<GroupListResponse> {
  return api<GroupListResponse>(`/me/groups?${buildQuery(page, size, filter)}`);
}

export async function createGroup(
  input: CreateGroupInput,
): Promise<GroupResponse> {
  return api<GroupResponse>("/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
