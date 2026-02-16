package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

// ==========================================
// Topic DTOs
// ==========================================

type CreateTopicRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	ParentID    *string `json:"parent_id,omitempty"`
}

type UpdateTopicRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	ParentID    *string `json:"parent_id,omitempty"`
}

type TopicResponse struct {
	PublicID    string    `json:"id"`
	ParentID    *string   `json:"parent_id,omitempty"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TopicListResponse struct {
	Data       []TopicResponse `json:"data"`
	PageNumber int             `json:"page_number"`
	PageSize   int             `json:"page_size"`
	TotalItems int             `json:"total_items"`
	TotalPages int             `json:"total_pages"`
}

// ==========================================
// Mapping functions
// ==========================================

func TopicToResponse(t *entity.Topic) TopicResponse {
	return TopicResponse{
		PublicID:    t.PublicID,
		ParentID:    t.ParentPublicID,
		Name:        t.Name,
		Description: t.Description,
		IsActive:    t.IsActive,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}
}

func TopicsToResponse(topics []entity.Topic) []TopicResponse {
	result := make([]TopicResponse, len(topics))
	for i := range topics {
		result[i] = TopicToResponse(&topics[i])
	}
	return result
}
