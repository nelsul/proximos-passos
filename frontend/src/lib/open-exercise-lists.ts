import { api } from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface ExerciseListTopicResponse {
  id: string;
  name: string;
}

export interface ExerciseListFileResponse {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
}

export interface ExerciseListResponse {
  id: string;
  title: string;
  description?: string;
  file?: ExerciseListFileResponse;
  file_url?: string;
  topics: ExerciseListTopicResponse[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExerciseListListResponse {
  data: ExerciseListResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface UpdateExerciseListInput {
  title?: string;
  description?: string;
  file_url?: string;
  topic_ids?: string[];
}

export interface ExerciseListFilter {
  title?: string;
  topic_id?: string | string[];
}

function buildQuery(
  page: number,
  size: number,
  filter?: ExerciseListFilter,
): string {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (filter?.title) params.set("title", filter.title);
  if (filter?.topic_id) {
    if (Array.isArray(filter.topic_id)) {
      filter.topic_id.forEach((id) => params.append("topic_id", id));
    } else {
      params.append("topic_id", filter.topic_id);
    }
  }
  return params.toString();
}

export async function listExerciseLists(
  page = 1,
  size = 10,
  filter?: ExerciseListFilter,
): Promise<ExerciseListListResponse> {
  return api<ExerciseListListResponse>(
    `/exercise-lists?${buildQuery(page, size, filter)}`,
  );
}

export async function getExerciseList(
  id: string,
): Promise<ExerciseListResponse> {
  return api<ExerciseListResponse>(`/exercise-lists/${id}`);
}

export async function createExerciseList(
  formData: FormData,
): Promise<ExerciseListResponse> {
  const res = await fetch(`${API_BASE_URL}/exercise-lists`, {
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

export async function updateExerciseList(
  id: string,
  input: UpdateExerciseListInput,
): Promise<ExerciseListResponse> {
  return api<ExerciseListResponse>(`/exercise-lists/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function replaceExerciseListFile(
  id: string,
  file: File,
): Promise<ExerciseListResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/exercise-lists/${id}/file`, {
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

export async function deleteExerciseList(id: string): Promise<void> {
  return api<void>(`/exercise-lists/${id}`, { method: "DELETE" });
}
