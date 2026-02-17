package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

type CreateExamRequest struct {
	InstitutionID string  `json:"institution_id"`
	Title         string  `json:"title"`
	Description   *string `json:"description,omitempty"`
	Year          int     `json:"year"`
}

type UpdateExamRequest struct {
	InstitutionID *string `json:"institution_id,omitempty"`
	Title         *string `json:"title,omitempty"`
	Description   *string `json:"description,omitempty"`
	Year          *int    `json:"year,omitempty"`
}

type ExamInstitutionResponse struct {
	PublicID string `json:"id"`
	Name     string `json:"name"`
	Acronym  string `json:"acronym"`
}

type ExamResponse struct {
	PublicID    string                  `json:"id"`
	Institution ExamInstitutionResponse `json:"institution"`
	Title       string                  `json:"title"`
	Description *string                 `json:"description,omitempty"`
	Year        int                     `json:"year"`
	IsActive    bool                    `json:"is_active"`
	CreatedAt   time.Time               `json:"created_at"`
	UpdatedAt   time.Time               `json:"updated_at"`
}

type ExamListResponse struct {
	Data       []ExamResponse `json:"data"`
	PageNumber int            `json:"page_number"`
	PageSize   int            `json:"page_size"`
	TotalItems int            `json:"total_items"`
	TotalPages int            `json:"total_pages"`
}

type ExamDetailResponse struct {
	Exam          ExamResponse `json:"exam"`
	QuestionCount int          `json:"question_count"`
	TopicIDs      []string     `json:"topic_ids"`
}

func ExamToResponse(e *entity.Exam) ExamResponse {
	return ExamResponse{
		PublicID: e.PublicID,
		Institution: ExamInstitutionResponse{
			PublicID: e.InstitutionPublicID,
			Name:     e.InstitutionName,
			Acronym:  e.InstitutionAcronym,
		},
		Title:       e.Title,
		Description: e.Description,
		Year:        e.Year,
		IsActive:    e.IsActive,
		CreatedAt:   e.CreatedAt,
		UpdatedAt:   e.UpdatedAt,
	}
}

func ExamsToResponse(exams []entity.Exam) []ExamResponse {
	result := make([]ExamResponse, len(exams))
	for i := range exams {
		result[i] = ExamToResponse(&exams[i])
	}
	return result
}
