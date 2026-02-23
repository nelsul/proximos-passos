import { api } from "./api";

export interface ExamInstitutionResponse {
  id: string;
  name: string;
  acronym: string;
}

export interface ExamResponse {
  id: string;
  institution: ExamInstitutionResponse;
  title: string;
  description?: string;
  year: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExamListResponse {
  data: ExamResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface CreateExamInput {
  institution_id: string;
  title: string;
  description?: string;
  year: number;
}

export interface UpdateExamInput {
  institution_id?: string;
  title?: string;
  description?: string;
  year?: number;
}

export interface ExamFilter {
  institution_id?: string;
  year?: number;
  search?: string;
}

function buildQuery(page: number, size: number, filter?: ExamFilter): string {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (filter?.institution_id)
    params.set("institution_id", filter.institution_id);
  if (filter?.year) params.set("year", String(filter.year));
  if (filter?.search) params.set("search", filter.search);
  return params.toString();
}

export async function listExams(
  page = 1,
  size = 10,
  filter?: ExamFilter,
): Promise<ExamListResponse> {
  return api<ExamListResponse>(`/exams?${buildQuery(page, size, filter)}`);
}

export async function getExam(id: string): Promise<ExamResponse> {
  return api<ExamResponse>(`/exams/${id}`);
}

export async function createExam(
  input: CreateExamInput,
): Promise<ExamResponse> {
  return api<ExamResponse>("/exams", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateExam(
  id: string,
  input: UpdateExamInput,
): Promise<ExamResponse> {
  return api<ExamResponse>(`/exams/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteExam(id: string): Promise<void> {
  return api<void>(`/exams/${id}`, { method: "DELETE" });
}

export interface ExamDetailResponse {
  exam: ExamResponse;
  question_count: number;
  topic_ids: string[];
}

export async function getExamDetails(id: string): Promise<ExamDetailResponse> {
  return api<ExamDetailResponse>(`/exams/${id}/details`);
}
