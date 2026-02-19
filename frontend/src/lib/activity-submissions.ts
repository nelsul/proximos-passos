import { api } from "./api";

export interface ActivitySubmissionActivityRef {
  id: string;
  title: string;
}

export interface ActivitySubmissionUserRef {
  id: string;
  name: string;
}

export interface ActivitySubmissionResponse {
  id: string;
  activity: ActivitySubmissionActivityRef;
  user: ActivitySubmissionUserRef;
  status: "pending" | "approved" | "reproved";
  notes?: string;
  feedback_notes?: string;
  reviewed_at?: string;
  reviewed_by?: ActivitySubmissionUserRef;
  submitted_at: string;
}

export interface ActivitySubmissionListResponse {
  data: ActivitySubmissionResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface SubmitActivityInput {
  notes?: string;
}

export interface ReviewActivitySubmissionInput {
  status: "approved" | "reproved";
  feedback_notes?: string;
}

export async function submitActivity(
  activityId: string,
  input?: SubmitActivityInput,
): Promise<ActivitySubmissionResponse> {
  return api<ActivitySubmissionResponse>(
    `/activities/${activityId}/submissions`,
    {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    },
  );
}

export async function getMyActivitySubmission(
  activityId: string,
): Promise<ActivitySubmissionResponse | null> {
  return api<ActivitySubmissionResponse | null>(
    `/activities/${activityId}/submissions/mine`,
  );
}

export async function listActivitySubmissions(
  activityId: string,
  page = 1,
  size = 20,
): Promise<ActivitySubmissionListResponse> {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  return api<ActivitySubmissionListResponse>(
    `/activities/${activityId}/submissions?${params.toString()}`,
  );
}

export async function getActivitySubmission(
  id: string,
): Promise<ActivitySubmissionResponse> {
  return api<ActivitySubmissionResponse>(`/activity-submissions/${id}`);
}

export async function reviewActivitySubmission(
  id: string,
  input: ReviewActivitySubmissionInput,
): Promise<ActivitySubmissionResponse> {
  return api<ActivitySubmissionResponse>(`/activity-submissions/${id}/review`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function resubmitActivitySubmission(
  id: string,
): Promise<ActivitySubmissionResponse> {
  return api<ActivitySubmissionResponse>(
    `/activity-submissions/${id}/resubmit`,
    { method: "POST" },
  );
}

export async function listMyActivitySubmissions(
  page = 1,
  size = 20,
): Promise<ActivitySubmissionListResponse> {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  return api<ActivitySubmissionListResponse>(
    `/me/activity-submissions?${params.toString()}`,
  );
}

// ==========================================
// Update Notes
// ==========================================

export interface UpdateActivitySubmissionNotesInput {
  notes?: string | null;
}

export async function updateActivitySubmissionNotes(
  id: string,
  input: UpdateActivitySubmissionNotesInput,
): Promise<ActivitySubmissionResponse> {
  return api<ActivitySubmissionResponse>(`/activity-submissions/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

// ==========================================
// Question Status
// ==========================================

export interface QuestionStatusResponse {
  question_id: string;
  passed: boolean;
  attempts: number;
  last_score?: number;
}

export async function getQuestionStatuses(
  activityId: string,
): Promise<QuestionStatusResponse[]> {
  return api<QuestionStatusResponse[]>(
    `/activities/${activityId}/question-status`,
  );
}

// ==========================================
// Submission Attachments
// ==========================================

export interface SubmissionAttachmentResponse {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
}

export async function listSubmissionAttachments(
  submissionId: string,
): Promise<SubmissionAttachmentResponse[]> {
  return api<SubmissionAttachmentResponse[]>(
    `/activity-submissions/${submissionId}/attachments`,
  );
}

export async function uploadSubmissionAttachment(
  submissionId: string,
  file: File,
): Promise<SubmissionAttachmentResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const res = await fetch(
    `${API_BASE_URL}/activity-submissions/${submissionId}/attachments`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    },
  );

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

export async function deleteSubmissionAttachment(
  submissionId: string,
  fileId: string,
): Promise<void> {
  await api<void>(
    `/activity-submissions/${submissionId}/attachments/${fileId}`,
    { method: "DELETE" },
  );
}

// ==========================================
// Submission Question Attempts (admin)
// ==========================================

export interface QuestionSubmissionOptionRef {
  id: string;
  text?: string;
  is_correct: boolean;
}

export interface QuestionSubmissionQuestionRef {
  id: string;
  type: string;
  statement: string;
}

export interface QuestionSubmissionAttempt {
  id: string;
  question: QuestionSubmissionQuestionRef;
  option_selected?: QuestionSubmissionOptionRef;
  answer_text?: string;
  score?: number;
  answer_feedback?: string;
  passed: boolean;
  submitted_at: string;
}

export async function getSubmissionQuestionAttempts(
  submissionId: string,
): Promise<QuestionSubmissionAttempt[]> {
  return api<QuestionSubmissionAttempt[]>(
    `/activity-submissions/${submissionId}/question-attempts`,
  );
}
