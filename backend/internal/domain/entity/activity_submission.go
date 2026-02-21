package entity

import "time"

type ActivitySubmissionStatus string

const (
	ActivitySubmissionStatusPending  ActivitySubmissionStatus = "pending"
	ActivitySubmissionStatusApproved ActivitySubmissionStatus = "approved"
	ActivitySubmissionStatusReproved ActivitySubmissionStatus = "reproved"
)

type ActivitySubmission struct {
	ID            int
	PublicID      string
	ActivityID    int
	UserID        int
	Status        ActivitySubmissionStatus
	Notes         *string
	FeedbackNotes *string
	ReviewedAt    *time.Time
	ReviewedByID  *int
	IsActive      bool
	SubmittedAt   time.Time
	UpdatedAt     time.Time

	// Joined fields
	ActivityPublicID string
	ActivityTitle    string
	UserPublicID     string
	UserName         string
	UserAvatarURL    *string
	ReviewerPublicID *string
	ReviewerName     *string
}

type ActivitySubmissionAttachment struct {
	SubmissionID int
	FileID       int
	FilePublicID string
	Key          string
	Filename     string
	ContentType  string
	SizeBytes    int64
	URL          string
	CreatedAt    time.Time
}
