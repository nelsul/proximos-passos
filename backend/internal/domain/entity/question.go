package entity

import "time"

type Question struct {
	ID                 int
	PublicID           string
	Type               string // "open_ended" or "closed_ended"
	Statement          string
	ExpectedAnswerText *string
	PassingScore       *int
	ExamID             *int
	IsActive           bool
	CreatedByID        int
	CreatedAt          time.Time
	UpdatedAt          time.Time

	// Joined exam fields
	ExamPublicID           string
	ExamTitle              string
	ExamYear               int
	ExamInstitution        string
	ExamInstitutionAcronym string

	Topics           []TopicRef
	Images           []QuestionImage
	Options          []QuestionOption
	MedianDifficulty *float64
	MedianLogic      *float64
	MedianLabor      *float64
	MedianTheory     *float64
}

type QuestionImage struct {
	FileID       int
	FilePublicID string
	FileKey      string
	Filename     string
	ContentType  string
	SizeBytes    int64
	URL          string
}

type QuestionOption struct {
	ID            int
	PublicID      string
	OriginalOrder int
	Text          *string
	IsCorrect     bool
	CreatedByID   int
	CreatedAt     time.Time
	UpdatedAt     time.Time

	// Option images (loaded from question_option_images)
	Images []QuestionImage
}
