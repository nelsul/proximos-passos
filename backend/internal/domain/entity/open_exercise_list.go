package entity

import "time"

type OpenExerciseList struct {
	ID          int
	PublicID    string
	Title       string
	Description *string
	FileID      *int
	FileURL     *string
	IsActive    bool
	CreatedByID int
	CreatedAt   time.Time
	UpdatedAt   time.Time

	// Joined fields (populated when file_id is set)
	FilePublicID string
	FileKey      string
	Filename     string
	ContentType  string
	SizeBytes    int64
	ResolvedURL  string // final URL: either from storage or file_url

	Topics []TopicRef
}
