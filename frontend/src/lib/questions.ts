import { api } from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface QuestionTopicResponse {
  id: string;
  name: string;
}

export interface QuestionImageResponse {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
}

export interface QuestionOptionResponse {
  id: string;
  original_order: number;
  text?: string;
  images: QuestionImageResponse[];
  is_correct: boolean;
}

export interface QuestionExamResponse {
  id: string;
  title: string;
  year: number;
  institution: string;
}

export interface QuestionResponse {
  id: string;
  type: string;
  statement: string;
  expected_answer_text?: string;
  passing_score?: number;
  exam?: QuestionExamResponse | null;
  images: QuestionImageResponse[];
  options: QuestionOptionResponse[];
  topics: QuestionTopicResponse[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionListResponse {
  data: QuestionResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface QuestionOptionInput {
  text?: string;
  image_ids?: string[];
  is_correct: boolean;
}

export interface UpdateQuestionInput {
  type?: string;
  statement?: string;
  expected_answer_text?: string;
  passing_score?: number;
  exam_id?: string;
  topic_ids?: string[];
  options?: QuestionOptionInput[];
}

export interface QuestionFilter {
  statement?: string;
  type?: string;
  topic_id?: string;
  exam_id?: string;
  institution_id?: string;
}

function buildQuery(
  page: number,
  size: number,
  filter?: QuestionFilter,
): string {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (filter?.statement) params.set("statement", filter.statement);
  if (filter?.type) params.set("type", filter.type);
  if (filter?.topic_id) params.set("topic_id", filter.topic_id);
  if (filter?.exam_id) params.set("exam_id", filter.exam_id);
  if (filter?.institution_id)
    params.set("institution_id", filter.institution_id);
  return params.toString();
}

export async function listQuestions(
  page = 1,
  size = 20,
  filter?: QuestionFilter,
): Promise<QuestionListResponse> {
  return api<QuestionListResponse>(
    `/questions?${buildQuery(page, size, filter)}`,
  );
}

export async function getQuestion(id: string): Promise<QuestionResponse> {
  return api<QuestionResponse>(`/questions/${id}`);
}

export async function createQuestion(
  formData: FormData,
): Promise<QuestionResponse> {
  const res = await fetch(`${API_BASE_URL}/questions`, {
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

export async function updateQuestion(
  id: string,
  input: UpdateQuestionInput,
  optionImages?: Map<number, File[]>,
): Promise<QuestionResponse> {
  // If there are option images, use multipart/form-data
  const hasOptionImages =
    optionImages &&
    Array.from(optionImages.values()).some((files) => files.length > 0);
  if (hasOptionImages) {
    const formData = new FormData();
    if (input.type) formData.append("type", input.type);
    if (input.statement) formData.append("statement", input.statement);
    if (input.expected_answer_text !== undefined)
      formData.append("expected_answer_text", input.expected_answer_text);
    if (input.passing_score !== undefined)
      formData.append("passing_score", String(input.passing_score));
    if (input.topic_ids)
      input.topic_ids.forEach((id) => formData.append("topic_ids", id));
    if (input.options)
      formData.append("options", JSON.stringify(input.options));
    optionImages!.forEach((files, idx) =>
      files.forEach((file) => formData.append(`option_images[${idx}]`, file)),
    );

    const res = await fetch(`${API_BASE_URL}/questions/${id}`, {
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

  // Otherwise use JSON
  return api<QuestionResponse>(`/questions/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function addQuestionImages(
  id: string,
  files: File[],
): Promise<QuestionResponse> {
  const formData = new FormData();
  files.forEach((f) => formData.append("images", f));

  const res = await fetch(`${API_BASE_URL}/questions/${id}/images`, {
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

export async function removeQuestionImage(
  questionId: string,
  imageId: string,
): Promise<QuestionResponse> {
  return api<QuestionResponse>(`/questions/${questionId}/images/${imageId}`, {
    method: "DELETE",
  });
}

export async function deleteQuestion(id: string): Promise<void> {
  return api<void>(`/questions/${id}`, { method: "DELETE" });
}
