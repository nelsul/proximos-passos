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

type ActivityItemType string

const (
	ActivityItemTypeQuestion         ActivityItemType = "question"
	ActivityItemTypeVideoLesson      ActivityItemType = "video_lesson"
	ActivityItemTypeHandout          ActivityItemType = "handout"
	ActivityItemTypeOpenExerciseList ActivityItemType = "open_exercise_list"
	ActivityItemTypeSimulatedExam    ActivityItemType = "simulated_exam"
)

type ActivityItem struct {
	ID                       int
	PublicID                 string
	ActivityID               int
	OrderIndex               int
	Title                    string
	Description              *string
	Type                     ActivityItemType
	QuestionID               *int
	VideoLessonID            *int
	HandoutID                *int
	OpenExerciseListID       *int
	SimulatedExamID          *int
	QuestionPublicID         *string
	VideoLessonPublicID      *string
	HandoutPublicID          *string
	OpenExerciseListPublicID *string
	SimulatedExamPublicID    *string
}
