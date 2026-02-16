package entity

import "time"

type Handout struct {
	ID          int
	PublicID    string
	Title       string
	Description *string
	FileID      int
	IsActive    bool
	CreatedByID int
	CreatedAt   time.Time
	UpdatedAt   time.Time

	// Joined fields
	FilePublicID string
	FileKey      string
	Filename     string
	ContentType  string
	SizeBytes    int64
	FileURL      string

	Topics []TopicRef
}

type TopicRef struct {
	ID       int
	PublicID string
	Name     string
}
