package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

// ==========================================
// Activity Submission DTOs
// ==========================================

type SubmitActivityRequest struct {
	Notes *string `json:"notes,omitempty"`
}

type ReviewActivitySubmissionRequest struct {
	Status        string  `json:"status"`
	FeedbackNotes *string `json:"feedback_notes,omitempty"`
}

type ActivitySubmissionResponse struct {
	PublicID      string                        `json:"id"`
	Activity      ActivitySubmissionActivityRef `json:"activity"`
	User          ActivitySubmissionUserRef     `json:"user"`
	Status        string                        `json:"status"`
	Notes         *string                       `json:"notes,omitempty"`
	FeedbackNotes *string                       `json:"feedback_notes,omitempty"`
	ReviewedAt    *time.Time                    `json:"reviewed_at,omitempty"`
	ReviewedBy    *ActivitySubmissionUserRef    `json:"reviewed_by,omitempty"`
	SubmittedAt   time.Time                     `json:"submitted_at"`
}

type ActivitySubmissionActivityRef struct {
	PublicID string `json:"id"`
	Title    string `json:"title"`
}

type ActivitySubmissionUserRef struct {
	PublicID  string  `json:"id"`
	Name      string  `json:"name"`
	AvatarURL *string `json:"avatar_url,omitempty"`
}

type ActivitySubmissionListResponse struct {
	Data       []ActivitySubmissionResponse `json:"data"`
	PageNumber int                          `json:"page_number"`
	PageSize   int                          `json:"page_size"`
	TotalItems int                          `json:"total_items"`
	TotalPages int                          `json:"total_pages"`
}

func ActivitySubmissionToResponse(s *entity.ActivitySubmission) ActivitySubmissionResponse {
	resp := ActivitySubmissionResponse{
		PublicID: s.PublicID,
		Activity: ActivitySubmissionActivityRef{
			PublicID: s.ActivityPublicID,
			Title:    s.ActivityTitle,
		},
		User: ActivitySubmissionUserRef{
			PublicID:  s.UserPublicID,
			Name:      s.UserName,
			AvatarURL: s.UserAvatarURL,
		},
		Status:        string(s.Status),
		Notes:         s.Notes,
		FeedbackNotes: s.FeedbackNotes,
		ReviewedAt:    s.ReviewedAt,
		SubmittedAt:   s.SubmittedAt,
	}
	if s.ReviewerPublicID != nil && s.ReviewerName != nil {
		resp.ReviewedBy = &ActivitySubmissionUserRef{
			PublicID: *s.ReviewerPublicID,
			Name:     *s.ReviewerName,
		}
	}
	return resp
}

func ActivitySubmissionsToResponse(submissions []entity.ActivitySubmission) []ActivitySubmissionResponse {
	result := make([]ActivitySubmissionResponse, len(submissions))
	for i := range submissions {
		result[i] = ActivitySubmissionToResponse(&submissions[i])
	}
	return result
}

// ==========================================
// Update Notes
// ==========================================

type UpdateActivitySubmissionNotesRequest struct {
	Notes *string `json:"notes"`
}

// ==========================================
// Question Status
// ==========================================

type QuestionStatusResponse struct {
	QuestionID string `json:"question_id"`
	Passed     bool   `json:"passed"`
	Attempts   int    `json:"attempts"`
	LastScore  *int   `json:"last_score,omitempty"`
}

// ==========================================
// Submission Attachment
// ==========================================

type SubmissionAttachmentResponse struct {
	FileID      string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	URL         string `json:"url"`
}

func SubmissionAttachmentToResponse(a *entity.ActivitySubmissionAttachment) SubmissionAttachmentResponse {
	return SubmissionAttachmentResponse{
		FileID:      a.FilePublicID,
		Filename:    a.Filename,
		ContentType: a.ContentType,
		SizeBytes:   a.SizeBytes,
		URL:         a.URL,
	}
}

func SubmissionAttachmentsToResponse(attachments []entity.ActivitySubmissionAttachment) []SubmissionAttachmentResponse {
	result := make([]SubmissionAttachmentResponse, len(attachments))
	for i := range attachments {
		result[i] = SubmissionAttachmentToResponse(&attachments[i])
	}
	return result
}
