package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

// ==========================================
// Question DTOs
// ==========================================

type UpdateQuestionRequest struct {
	Type               *string               `json:"type,omitempty"`
	Statement          *string               `json:"statement,omitempty"`
	ExpectedAnswerText *string               `json:"expected_answer_text,omitempty"`
	PassingScore       *int                  `json:"passing_score,omitempty"`
	TopicIDs           []string              `json:"topic_ids,omitempty"`
	Options            []QuestionOptionInput `json:"options,omitempty"`
}

type QuestionOptionInput struct {
	Text      *string  `json:"text"`
	ImageIDs  []string `json:"image_ids,omitempty"`
	IsCorrect bool     `json:"is_correct"`
}

type QuestionTopicResponse struct {
	PublicID string `json:"id"`
	Name     string `json:"name"`
}

type QuestionImageResponse struct {
	PublicID    string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	URL         string `json:"url"`
}

type QuestionOptionResponse struct {
	PublicID      string                  `json:"id"`
	OriginalOrder int                     `json:"original_order"`
	Text          *string                 `json:"text,omitempty"`
	Images        []QuestionImageResponse `json:"images"`
	IsCorrect     bool                    `json:"is_correct"`
}

type QuestionResponse struct {
	PublicID           string                   `json:"id"`
	Type               string                   `json:"type"`
	Statement          string                   `json:"statement"`
	ExpectedAnswerText *string                  `json:"expected_answer_text,omitempty"`
	PassingScore       *int                     `json:"passing_score,omitempty"`
	Images             []QuestionImageResponse  `json:"images"`
	Options            []QuestionOptionResponse `json:"options"`
	Topics             []QuestionTopicResponse  `json:"topics"`
	IsActive           bool                     `json:"is_active"`
	CreatedAt          time.Time                `json:"created_at"`
	UpdatedAt          time.Time                `json:"updated_at"`
}

type QuestionListResponse struct {
	Data       []QuestionResponse `json:"data"`
	PageNumber int                `json:"page_number"`
	PageSize   int                `json:"page_size"`
	TotalItems int                `json:"total_items"`
	TotalPages int                `json:"total_pages"`
}

// ==========================================
// Mapping functions
// ==========================================

func QuestionToResponse(q *entity.Question) QuestionResponse {
	topics := make([]QuestionTopicResponse, len(q.Topics))
	for i, t := range q.Topics {
		topics[i] = QuestionTopicResponse{
			PublicID: t.PublicID,
			Name:     t.Name,
		}
	}

	images := make([]QuestionImageResponse, len(q.Images))
	for i, img := range q.Images {
		images[i] = QuestionImageResponse{
			PublicID:    img.FilePublicID,
			Filename:    img.Filename,
			ContentType: img.ContentType,
			SizeBytes:   img.SizeBytes,
			URL:         img.URL,
		}
	}

	options := make([]QuestionOptionResponse, len(q.Options))
	for i, opt := range q.Options {
		optImages := make([]QuestionImageResponse, len(opt.Images))
		for j, img := range opt.Images {
			optImages[j] = QuestionImageResponse{
				PublicID:    img.FilePublicID,
				Filename:    img.Filename,
				ContentType: img.ContentType,
				SizeBytes:   img.SizeBytes,
				URL:         img.URL,
			}
		}
		options[i] = QuestionOptionResponse{
			PublicID:      opt.PublicID,
			OriginalOrder: opt.OriginalOrder,
			Text:          opt.Text,
			Images:        optImages,
			IsCorrect:     opt.IsCorrect,
		}
	}

	return QuestionResponse{
		PublicID:           q.PublicID,
		Type:               q.Type,
		Statement:          q.Statement,
		ExpectedAnswerText: q.ExpectedAnswerText,
		PassingScore:       q.PassingScore,
		Images:             images,
		Options:            options,
		Topics:             topics,
		IsActive:           q.IsActive,
		CreatedAt:          q.CreatedAt,
		UpdatedAt:          q.UpdatedAt,
	}
}

func QuestionsToResponse(questions []entity.Question) []QuestionResponse {
	result := make([]QuestionResponse, len(questions))
	for i := range questions {
		result[i] = QuestionToResponse(&questions[i])
	}
	return result
}
