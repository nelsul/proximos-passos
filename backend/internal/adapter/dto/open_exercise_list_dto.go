package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

// ==========================================
// Open Exercise List DTOs
// ==========================================

type UpdateOpenExerciseListRequest struct {
	Title       *string  `json:"title,omitempty"`
	Description *string  `json:"description,omitempty"`
	FileURL     *string  `json:"file_url,omitempty"`
	TopicIDs    []string `json:"topic_ids,omitempty"`
}

type OpenExerciseListTopicResponse struct {
	PublicID string `json:"id"`
	Name     string `json:"name"`
}

type OpenExerciseListFileResponse struct {
	PublicID    string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	URL         string `json:"url"`
}

type OpenExerciseListResponse struct {
	PublicID    string                          `json:"id"`
	Title       string                          `json:"title"`
	Description *string                         `json:"description,omitempty"`
	File        *OpenExerciseListFileResponse   `json:"file,omitempty"`
	FileURL     *string                         `json:"file_url,omitempty"`
	Topics      []OpenExerciseListTopicResponse `json:"topics"`
	IsActive    bool                            `json:"is_active"`
	CreatedAt   time.Time                       `json:"created_at"`
	UpdatedAt   time.Time                       `json:"updated_at"`
}

type OpenExerciseListListResponse struct {
	Data       []OpenExerciseListResponse `json:"data"`
	PageNumber int                        `json:"page_number"`
	PageSize   int                        `json:"page_size"`
	TotalItems int                        `json:"total_items"`
	TotalPages int                        `json:"total_pages"`
}

// ==========================================
// Mapping functions
// ==========================================

func OpenExerciseListToResponse(oel *entity.OpenExerciseList) OpenExerciseListResponse {
	topics := make([]OpenExerciseListTopicResponse, len(oel.Topics))
	for i, t := range oel.Topics {
		topics[i] = OpenExerciseListTopicResponse{
			PublicID: t.PublicID,
			Name:     t.Name,
		}
	}

	resp := OpenExerciseListResponse{
		PublicID:    oel.PublicID,
		Title:       oel.Title,
		Description: oel.Description,
		FileURL:     oel.FileURL,
		Topics:      topics,
		IsActive:    oel.IsActive,
		CreatedAt:   oel.CreatedAt,
		UpdatedAt:   oel.UpdatedAt,
	}

	if oel.FileID != nil {
		resp.File = &OpenExerciseListFileResponse{
			PublicID:    oel.FilePublicID,
			Filename:    oel.Filename,
			ContentType: oel.ContentType,
			SizeBytes:   oel.SizeBytes,
			URL:         oel.ResolvedURL,
		}
	}

	if oel.FileURL != nil {
		resp.FileURL = oel.FileURL
	} else if oel.FileID != nil {
		url := oel.ResolvedURL
		resp.FileURL = &url
	}

	return resp
}

func OpenExerciseListsToResponse(lists []entity.OpenExerciseList) []OpenExerciseListResponse {
	result := make([]OpenExerciseListResponse, len(lists))
	for i := range lists {
		result[i] = OpenExerciseListToResponse(&lists[i])
	}
	return result
}
