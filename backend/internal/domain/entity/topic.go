package entity

import "time"

type Topic struct {
	ID          int
	PublicID    string
	ParentID    *int
	Name        string
	Description *string
	IsActive    bool
	CreatedByID int
	CreatedAt   time.Time
	UpdatedAt   time.Time

	ParentPublicID *string

	// Aggregated quantities
	QuestionsCount     int
	VideoLessonsCount  int
	HandoutsCount      int
	ExerciseListsCount int
}
