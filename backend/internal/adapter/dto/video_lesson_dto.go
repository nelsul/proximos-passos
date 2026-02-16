package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

// ==========================================
// Video Lesson DTOs
// ==========================================

type UpdateVideoLessonRequest struct {
	Title           *string  `json:"title,omitempty"`
	Description     *string  `json:"description,omitempty"`
	VideoURL        *string  `json:"video_url,omitempty"`
	DurationMinutes *int     `json:"duration_minutes,omitempty"`
	TopicIDs        []string `json:"topic_ids,omitempty"`
}

type VideoLessonTopicResponse struct {
	PublicID string `json:"id"`
	Name     string `json:"name"`
}

type VideoLessonFileResponse struct {
	PublicID    string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	URL         string `json:"url"`
}

type VideoLessonResponse struct {
	PublicID        string                     `json:"id"`
	Title           string                     `json:"title"`
	Description     *string                    `json:"description,omitempty"`
	File            *VideoLessonFileResponse   `json:"file,omitempty"`
	VideoURL        *string                    `json:"video_url,omitempty"`
	DurationMinutes int                        `json:"duration_minutes"`
	Topics          []VideoLessonTopicResponse `json:"topics"`
	IsActive        bool                       `json:"is_active"`
	CreatedAt       time.Time                  `json:"created_at"`
	UpdatedAt       time.Time                  `json:"updated_at"`
}

type VideoLessonListResponse struct {
	Data       []VideoLessonResponse `json:"data"`
	PageNumber int                   `json:"page_number"`
	PageSize   int                   `json:"page_size"`
	TotalItems int                   `json:"total_items"`
	TotalPages int                   `json:"total_pages"`
}

// ==========================================
// Mapping functions
// ==========================================

func VideoLessonToResponse(vl *entity.VideoLesson) VideoLessonResponse {
	topics := make([]VideoLessonTopicResponse, len(vl.Topics))
	for i, t := range vl.Topics {
		topics[i] = VideoLessonTopicResponse{
			PublicID: t.PublicID,
			Name:     t.Name,
		}
	}

	resp := VideoLessonResponse{
		PublicID:        vl.PublicID,
		Title:           vl.Title,
		Description:     vl.Description,
		VideoURL:        vl.FileURL,
		DurationMinutes: vl.DurationMinutes,
		Topics:          topics,
		IsActive:        vl.IsActive,
		CreatedAt:       vl.CreatedAt,
		UpdatedAt:       vl.UpdatedAt,
	}

	if vl.FileID != nil {
		resp.File = &VideoLessonFileResponse{
			PublicID:    vl.FilePublicID,
			Filename:    vl.Filename,
			ContentType: vl.ContentType,
			SizeBytes:   vl.SizeBytes,
			URL:         vl.ResolvedURL,
		}
	}

	if vl.FileURL != nil {
		resp.VideoURL = vl.FileURL
	} else if vl.FileID != nil {
		url := vl.ResolvedURL
		resp.VideoURL = &url
	}

	return resp
}

func VideoLessonsToResponse(lessons []entity.VideoLesson) []VideoLessonResponse {
	result := make([]VideoLessonResponse, len(lessons))
	for i := range lessons {
		result[i] = VideoLessonToResponse(&lessons[i])
	}
	return result
}
