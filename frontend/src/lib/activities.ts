import { api } from "./api";

export interface ActivityResponse {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  due_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttachmentResponse {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
}

export interface ActivityDetailResponse {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  due_date: string;
  is_active: boolean;
  attachments: AttachmentResponse[];
  created_at: string;
  updated_at: string;
}

export interface ActivityListResponse {
  data: ActivityResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface CreateActivityInput {
  title: string;
  description?: string;
  due_date: string;
}

export interface UpdateActivityInput {
  title?: string;
  description?: string;
  due_date?: string;
}

export interface ActivityFilter {
  title?: string;
}

function buildQuery(
  page: number,
  size: number,
  filter?: ActivityFilter,
): string {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (filter?.title) params.set("title", filter.title);
  return params.toString();
}

export async function createActivity(
  groupId: string,
  input: CreateActivityInput,
): Promise<ActivityResponse> {
  return api<ActivityResponse>(`/groups/${groupId}/activities`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getActivity(
  activityId: string,
): Promise<ActivityDetailResponse> {
  return api<ActivityDetailResponse>(`/activities/${activityId}`);
}

export async function updateActivity(
  activityId: string,
  input: UpdateActivityInput,
): Promise<ActivityResponse> {
  return api<ActivityResponse>(`/activities/${activityId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteActivity(activityId: string): Promise<void> {
  return api<void>(`/activities/${activityId}`, {
    method: "DELETE",
  });
}

export async function listUpcomingActivities(
  groupId: string,
  page = 1,
  size = 20,
  filter?: ActivityFilter,
): Promise<ActivityListResponse> {
  return api<ActivityListResponse>(
    `/groups/${groupId}/activities/upcoming?${buildQuery(page, size, filter)}`,
  );
}

export async function listPastActivities(
  groupId: string,
  page = 1,
  size = 20,
  filter?: ActivityFilter,
): Promise<ActivityListResponse> {
  return api<ActivityListResponse>(
    `/groups/${groupId}/activities/past?${buildQuery(page, size, filter)}`,
  );
}

export async function uploadAttachment(
  activityId: string,
  file: File,
): Promise<AttachmentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return api<AttachmentResponse>(`/activities/${activityId}/attachments`, {
    method: "POST",
    body: formData,
    headers: {},
  });
}

export async function deleteAttachment(
  activityId: string,
  fileId: string,
): Promise<void> {
  return api<void>(`/activities/${activityId}/attachments/${fileId}`, {
    method: "DELETE",
  });
}

// ==========================================
// Activity Items
// ==========================================

export interface ActivityItemResponse {
  id: string;
  order_index: number;
  title: string;
  description?: string;
  type: string;
  content_subtitle?: string;
  median_difficulty?: number;
  median_logic?: number;
  median_labor?: number;
  median_theory?: number;
  question_id?: string;
  video_lesson_id?: string;
  handout_id?: string;
  open_exercise_list_id?: string;
  simulated_exam_id?: string;
}

export interface CreateActivityItemInput {
  title: string;
  description?: string;
  question_id?: string;
  video_lesson_id?: string;
  handout_id?: string;
  open_exercise_list_id?: string;
  simulated_exam_id?: string;
}

export interface UpdateActivityItemInput {
  title?: string;
  description?: string;
}

export async function listActivityItems(
  activityId: string,
): Promise<ActivityItemResponse[]> {
  return api<ActivityItemResponse[]>(`/activities/${activityId}/items`);
}

export async function createActivityItem(
  activityId: string,
  input: CreateActivityItemInput,
): Promise<ActivityItemResponse> {
  return api<ActivityItemResponse>(`/activities/${activityId}/items`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateActivityItem(
  itemId: string,
  input: UpdateActivityItemInput,
): Promise<ActivityItemResponse> {
  return api<ActivityItemResponse>(`/activity-items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteActivityItem(itemId: string): Promise<void> {
  return api<void>(`/activity-items/${itemId}`, {
    method: "DELETE",
  });
}

export async function reorderActivityItems(
  activityId: string,
  orderedIds: string[],
): Promise<void> {
  return api<void>(`/activities/${activityId}/items/reorder`, {
    method: "PUT",
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}
