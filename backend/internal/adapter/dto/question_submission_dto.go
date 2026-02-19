package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

type SubmitAnswerRequest struct {
	QuestionOptionID *string `json:"question_option_id,omitempty"`
	AnswerText       *string `json:"answer_text,omitempty"`
}

type QuestionSubmissionResponse struct {
	PublicID       string                        `json:"id"`
	Question       QuestionSubmissionQuestionRef `json:"question"`
	OptionSelected *QuestionSubmissionOptionRef  `json:"option_selected,omitempty"`
	AnswerText     *string                       `json:"answer_text,omitempty"`
	Score          *int                          `json:"score"`
	AnswerFeedback *string                       `json:"answer_feedback,omitempty"`
	Passed         bool                          `json:"passed"`
	SubmittedAt    time.Time                     `json:"submitted_at"`
}

type QuestionSubmissionQuestionRef struct {
	PublicID  string `json:"id"`
	Type      string `json:"type"`
	Statement string `json:"statement"`
}

type QuestionSubmissionOptionRef struct {
	PublicID  string  `json:"id"`
	Text      *string `json:"text,omitempty"`
	IsCorrect bool    `json:"is_correct"`
}

type QuestionSubmissionListResponse struct {
	Data       []QuestionSubmissionResponse `json:"data"`
	PageNumber int                          `json:"page_number"`
	PageSize   int                          `json:"page_size"`
	TotalItems int                          `json:"total_items"`
	TotalPages int                          `json:"total_pages"`
}

func QuestionSubmissionToResponse(s *entity.QuestionSubmission) QuestionSubmissionResponse {
	resp := QuestionSubmissionResponse{
		PublicID: s.PublicID,
		Question: QuestionSubmissionQuestionRef{
			PublicID:  s.QuestionPublicID,
			Type:      s.QuestionType,
			Statement: s.QuestionStatement,
		},
		AnswerText:     s.AnswerText,
		Score:          s.Score,
		AnswerFeedback: s.AnswerFeedback,
		Passed:         s.Passed,
		SubmittedAt:    s.SubmittedAt,
	}
	if s.OptionPublicID != "" {
		resp.OptionSelected = &QuestionSubmissionOptionRef{
			PublicID:  s.OptionPublicID,
			Text:      s.OptionText,
			IsCorrect: s.OptionIsCorrect,
		}
	}
	return resp
}

func QuestionSubmissionsToResponse(submissions []entity.QuestionSubmission) []QuestionSubmissionResponse {
	result := make([]QuestionSubmissionResponse, len(submissions))
	for i := range submissions {
		result[i] = QuestionSubmissionToResponse(&submissions[i])
	}
	return result
}
