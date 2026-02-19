import { api } from "./api";

export interface QuestionSubmissionQuestionRef {
  id: string;
  type: string;
  statement: string;
}

export interface QuestionSubmissionOptionRef {
  id: string;
  text?: string;
  is_correct: boolean;
}

export interface QuestionSubmissionResponse {
  id: string;
  question: QuestionSubmissionQuestionRef;
  option_selected?: QuestionSubmissionOptionRef;
  answer_text?: string;
  score: number | null;
  answer_feedback?: string;
  passed: boolean;
  submitted_at: string;
}

export interface QuestionSubmissionListResponse {
  data: QuestionSubmissionResponse[];
  page_number: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface SubmitAnswerInput {
  question_option_id?: string;
  answer_text?: string;
  activity_id?: string;
}

export async function submitAnswer(
  questionId: string,
  input: SubmitAnswerInput,
): Promise<QuestionSubmissionResponse> {
  return api<QuestionSubmissionResponse>(
    `/questions/${questionId}/submissions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function listMySubmissions(
  page = 1,
  size = 20,
  statement?: string,
): Promise<QuestionSubmissionListResponse> {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  if (statement) params.set("statement", statement);
  return api<QuestionSubmissionListResponse>(
    `/me/submissions?${params.toString()}`,
  );
}

export async function getSubmission(
  id: string,
): Promise<QuestionSubmissionResponse> {
  return api<QuestionSubmissionResponse>(`/me/submissions/${id}`);
}

export async function listQuestionSubmissions(
  questionId: string,
  page = 1,
  size = 20,
): Promise<QuestionSubmissionListResponse> {
  const params = new URLSearchParams();
  params.set("page_number", String(page));
  params.set("page_size", String(size));
  return api<QuestionSubmissionListResponse>(
    `/questions/${questionId}/submissions?${params.toString()}`,
  );
}
