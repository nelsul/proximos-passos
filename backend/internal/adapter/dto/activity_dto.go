package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

// ==========================================
// Activity DTOs
// ==========================================

type CreateActivityRequest struct {
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	DueDate     string  `json:"due_date"`
}

type UpdateActivityRequest struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	DueDate     *string `json:"due_date,omitempty"`
}

type ActivityResponse struct {
	PublicID    string    `json:"id"`
	GroupID     string    `json:"group_id"`
	Title       string    `json:"title"`
	Description *string   `json:"description,omitempty"`
	DueDate     time.Time `json:"due_date"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ActivityDetailResponse struct {
	PublicID    string               `json:"id"`
	GroupID     string               `json:"group_id"`
	Title       string               `json:"title"`
	Description *string              `json:"description,omitempty"`
	DueDate     time.Time            `json:"due_date"`
	IsActive    bool                 `json:"is_active"`
	Attachments []AttachmentResponse `json:"attachments"`
	CreatedAt   time.Time            `json:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at"`
}

type ActivityListResponse struct {
	Data       []ActivityResponse `json:"data"`
	PageNumber int                `json:"page_number"`
	PageSize   int                `json:"page_size"`
	TotalItems int                `json:"total_items"`
	TotalPages int                `json:"total_pages"`
}

// ==========================================
// Attachment DTOs
// ==========================================

type AttachmentResponse struct {
	PublicID    string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	URL         string `json:"url"`
}

// ==========================================
// Mapping functions
// ==========================================

func ActivityToResponse(a *entity.Activity) ActivityResponse {
	return ActivityResponse{
		PublicID:    a.PublicID,
		GroupID:     a.GroupPublicID,
		Title:       a.Title,
		Description: a.Description,
		DueDate:     a.DueDate,
		IsActive:    a.IsActive,
		CreatedAt:   a.CreatedAt,
		UpdatedAt:   a.UpdatedAt,
	}
}

func ActivitiesToResponse(activities []entity.Activity) []ActivityResponse {
	result := make([]ActivityResponse, len(activities))
	for i := range activities {
		result[i] = ActivityToResponse(&activities[i])
	}
	return result
}

func ActivityDetailToResponse(a *entity.Activity, attachments []entity.ActivityAttachment) ActivityDetailResponse {
	attResp := make([]AttachmentResponse, len(attachments))
	for i := range attachments {
		attResp[i] = AttachmentToResponse(&attachments[i])
	}
	return ActivityDetailResponse{
		PublicID:    a.PublicID,
		GroupID:     a.GroupPublicID,
		Title:       a.Title,
		Description: a.Description,
		DueDate:     a.DueDate,
		IsActive:    a.IsActive,
		Attachments: attResp,
		CreatedAt:   a.CreatedAt,
		UpdatedAt:   a.UpdatedAt,
	}
}

func AttachmentToResponse(a *entity.ActivityAttachment) AttachmentResponse {
	return AttachmentResponse{
		PublicID:    a.FilePublicID,
		Filename:    a.Filename,
		ContentType: a.ContentType,
		SizeBytes:   a.SizeBytes,
		URL:         a.URL,
	}
}

// ==========================================
// Activity Item DTOs
// ==========================================

type CreateActivityItemRequest struct {
	Title              string  `json:"title"`
	Description        *string `json:"description,omitempty"`
	QuestionID         *string `json:"question_id,omitempty"`
	VideoLessonID      *string `json:"video_lesson_id,omitempty"`
	HandoutID          *string `json:"handout_id,omitempty"`
	OpenExerciseListID *string `json:"open_exercise_list_id,omitempty"`
	SimulatedExamID    *string `json:"simulated_exam_id,omitempty"`
}

type UpdateActivityItemRequest struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

type ReorderActivityItemsRequest struct {
	OrderedIDs []string `json:"ordered_ids"`
}

type ActivityItemResponse struct {
	PublicID           string  `json:"id"`
	OrderIndex         int     `json:"order_index"`
	Title              string  `json:"title"`
	Description        *string `json:"description,omitempty"`
	Type               string  `json:"type"`
	ContentSubtitle    *string `json:"content_subtitle,omitempty"`
	QuestionID         *string `json:"question_id,omitempty"`
	VideoLessonID      *string `json:"video_lesson_id,omitempty"`
	HandoutID          *string `json:"handout_id,omitempty"`
	OpenExerciseListID *string `json:"open_exercise_list_id,omitempty"`
	SimulatedExamID    *string  `json:"simulated_exam_id,omitempty"`
	MedianDifficulty   *float64 `json:"median_difficulty,omitempty"`
	MedianLogic        *float64 `json:"median_logic,omitempty"`
	MedianLabor        *float64 `json:"median_labor,omitempty"`
	MedianTheory       *float64 `json:"median_theory,omitempty"`
}

func ActivityItemToResponse(item *entity.ActivityItem) ActivityItemResponse {
	var subtitle *string
	switch item.Type {
	case entity.ActivityItemTypeQuestion:
		subtitle = item.QuestionStatement
	case entity.ActivityItemTypeVideoLesson:
		subtitle = item.VideoLessonTitle
	case entity.ActivityItemTypeHandout:
		subtitle = item.HandoutTitle
	case entity.ActivityItemTypeOpenExerciseList:
		subtitle = item.OpenExerciseListTitle
	case entity.ActivityItemTypeSimulatedExam:
		subtitle = item.SimulatedExamTitle
	}

	return ActivityItemResponse{
		PublicID:           item.PublicID,
		OrderIndex:         item.OrderIndex,
		Title:              item.Title,
		Description:        item.Description,
		Type:               string(item.Type),
		ContentSubtitle:    subtitle,
		QuestionID:         item.QuestionPublicID,
		VideoLessonID:      item.VideoLessonPublicID,
		HandoutID:          item.HandoutPublicID,
		OpenExerciseListID: item.OpenExerciseListPublicID,
		SimulatedExamID:    item.SimulatedExamPublicID,
		MedianDifficulty:   item.MedianDifficulty,
		MedianLogic:        item.MedianLogic,
		MedianLabor:        item.MedianLabor,
		MedianTheory:       item.MedianTheory,
	}
}

func ActivityItemsToResponse(items []entity.ActivityItem) []ActivityItemResponse {
	result := make([]ActivityItemResponse, len(items))
	for i := range items {
		result[i] = ActivityItemToResponse(&items[i])
	}
	return result
}
