package entity

import "time"

type Activity struct {
	ID            int
	PublicID      string
	GroupID       int
	GroupPublicID string
	Title         string
	Description   *string
	DueDate       time.Time
	IsActive      bool
	CreatedByID   int
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type ActivityAttachment struct {
	ActivityID   int
	FileID       int
	FilePublicID string
	Key          string
	Filename     string
	ContentType  string
	SizeBytes    int64
	URL          string
	CreatedAt    time.Time
}
