import { api } from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface VideoLessonTopicResponse {
  id: string;
  name: string;
}

export interface VideoLessonFileResponse {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
}

export interface VideoLessonResponse {
  id: string;
  title: string;
  description?: string;
  file?: VideoLessonFileResponse;
  video_url?: string;
  duration_minutes: number;
  topics: VideoLessonTopicResponse[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VideoLessonListResponse {
  data: VideoLessonResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface UpdateVideoLessonInput {
  title?: string;
  description?: string;
  video_url?: string;
  duration_minutes?: number;
  topic_ids?: string[];
}

export interface VideoLessonFilter {
  title?: string;
  topic_id?: string;
}

function buildQuery(
  page: number,
  size: number,
  filter?: VideoLessonFilter,
): string {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (filter?.title) params.set("title", filter.title);
  if (filter?.topic_id) params.set("topic_id", filter.topic_id);
  return params.toString();
}

export async function listVideoLessons(
  page = 1,
  size = 10,
  filter?: VideoLessonFilter,
): Promise<VideoLessonListResponse> {
  return api<VideoLessonListResponse>(
    `/video-lessons?${buildQuery(page, size, filter)}`,
  );
}

export async function getVideoLesson(id: string): Promise<VideoLessonResponse> {
  return api<VideoLessonResponse>(`/video-lessons/${id}`);
}

export async function createVideoLesson(
  formData: FormData,
): Promise<VideoLessonResponse> {
  const res = await fetch(`${API_BASE_URL}/video-lessons`, {
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

export async function updateVideoLesson(
  id: string,
  input: UpdateVideoLessonInput,
): Promise<VideoLessonResponse> {
  return api<VideoLessonResponse>(`/video-lessons/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function replaceVideoLessonFile(
  id: string,
  file: File,
): Promise<VideoLessonResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/video-lessons/${id}/file`, {
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

export async function deleteVideoLesson(id: string): Promise<void> {
  return api<void>(`/video-lessons/${id}`, { method: "DELETE" });
}
