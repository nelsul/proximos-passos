package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

type CreateInstitutionRequest struct {
	Name    string `json:"name"`
	Acronym string `json:"acronym"`
}

type UpdateInstitutionRequest struct {
	Name    *string `json:"name,omitempty"`
	Acronym *string `json:"acronym,omitempty"`
}

type InstitutionResponse struct {
	PublicID  string    `json:"id"`
	Name      string    `json:"name"`
	Acronym   string    `json:"acronym"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type InstitutionListResponse struct {
	Data       []InstitutionResponse `json:"data"`
	PageNumber int                   `json:"page_number"`
	PageSize   int                   `json:"page_size"`
	TotalItems int                   `json:"total_items"`
	TotalPages int                   `json:"total_pages"`
}

func InstitutionToResponse(i *entity.Institution) InstitutionResponse {
	return InstitutionResponse{
		PublicID:  i.PublicID,
		Name:      i.Name,
		Acronym:   i.Acronym,
		IsActive:  i.IsActive,
		CreatedAt: i.CreatedAt,
		UpdatedAt: i.UpdatedAt,
	}
}

func InstitutionsToResponse(institutions []entity.Institution) []InstitutionResponse {
	result := make([]InstitutionResponse, len(institutions))
	for i := range institutions {
		result[i] = InstitutionToResponse(&institutions[i])
	}
	return result
}

type InstitutionDetailResponse struct {
	Institution   InstitutionResponse `json:"institution"`
	QuestionCount int                 `json:"question_count"`
	TopicIDs      []string            `json:"topic_ids"`
}
