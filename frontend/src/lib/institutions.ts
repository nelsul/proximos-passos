import { api } from "./api";

export interface InstitutionResponse {
  id: string;
  name: string;
  acronym: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstitutionListResponse {
  data: InstitutionResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface CreateInstitutionInput {
  name: string;
  acronym: string;
}

export interface UpdateInstitutionInput {
  name?: string;
  acronym?: string;
}

export interface InstitutionFilter {
  name?: string;
}

function buildQuery(
  page: number,
  size: number,
  filter?: InstitutionFilter,
): string {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (filter?.name) params.set("name", filter.name);
  return params.toString();
}

export async function listInstitutions(
  page = 1,
  size = 20,
  filter?: InstitutionFilter,
): Promise<InstitutionListResponse> {
  return api<InstitutionListResponse>(
    `/institutions?${buildQuery(page, size, filter)}`,
  );
}

export async function getInstitution(id: string): Promise<InstitutionResponse> {
  return api<InstitutionResponse>(`/institutions/${id}`);
}

export async function createInstitution(
  input: CreateInstitutionInput,
): Promise<InstitutionResponse> {
  return api<InstitutionResponse>("/institutions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateInstitution(
  id: string,
  input: UpdateInstitutionInput,
): Promise<InstitutionResponse> {
  return api<InstitutionResponse>(`/institutions/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteInstitution(id: string): Promise<void> {
  return api<void>(`/institutions/${id}`, { method: "DELETE" });
}

export interface InstitutionDetailResponse {
  institution: InstitutionResponse;
  question_count: number;
  topic_ids: string[];
}

export async function getInstitutionDetails(
  id: string,
): Promise<InstitutionDetailResponse> {
  return api<InstitutionDetailResponse>(`/institutions/${id}/details`);
}
