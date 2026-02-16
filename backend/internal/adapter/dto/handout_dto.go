package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

// ==========================================
// Handout DTOs
// ==========================================

type UpdateHandoutRequest struct {
	Title       *string  `json:"title,omitempty"`
	Description *string  `json:"description,omitempty"`
	TopicIDs    []string `json:"topic_ids,omitempty"`
}

type HandoutTopicResponse struct {
	PublicID string `json:"id"`
	Name     string `json:"name"`
}

type HandoutFileResponse struct {
	PublicID    string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	URL         string `json:"url"`
}

type HandoutResponse struct {
	PublicID    string                 `json:"id"`
	Title       string                 `json:"title"`
	Description *string                `json:"description,omitempty"`
	File        HandoutFileResponse    `json:"file"`
	Topics      []HandoutTopicResponse `json:"topics"`
	IsActive    bool                   `json:"is_active"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

type HandoutListResponse struct {
	Data       []HandoutResponse `json:"data"`
	PageNumber int               `json:"page_number"`
	PageSize   int               `json:"page_size"`
	TotalItems int               `json:"total_items"`
	TotalPages int               `json:"total_pages"`
}

// ==========================================
// Mapping functions
// ==========================================

func HandoutToResponse(h *entity.Handout) HandoutResponse {
	topics := make([]HandoutTopicResponse, len(h.Topics))
	for i, t := range h.Topics {
		topics[i] = HandoutTopicResponse{
			PublicID: t.PublicID,
			Name:     t.Name,
		}
	}

	return HandoutResponse{
		PublicID:    h.PublicID,
		Title:       h.Title,
		Description: h.Description,
		File: HandoutFileResponse{
			PublicID:    h.FilePublicID,
			Filename:    h.Filename,
			ContentType: h.ContentType,
			SizeBytes:   h.SizeBytes,
			URL:         h.FileURL,
		},
		Topics:    topics,
		IsActive:  h.IsActive,
		CreatedAt: h.CreatedAt,
		UpdatedAt: h.UpdatedAt,
	}
}

func HandoutsToResponse(handouts []entity.Handout) []HandoutResponse {
	result := make([]HandoutResponse, len(handouts))
	for i := range handouts {
		result[i] = HandoutToResponse(&handouts[i])
	}
	return result
}
