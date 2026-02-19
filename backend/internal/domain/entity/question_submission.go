package entity

import "time"

type QuestionSubmission struct {
	ID                   int
	PublicID             string
	QuestionID           int
	UserID               int
	ActivitySubmissionID *int
	SimulatedExamID      *int
	QuestionOptionID     *int
	AnswerText           *string
	Score                *int
	AnswerFeedback       *string
	Passed               bool
	IsActive             bool
	SubmittedAt          time.Time
	UpdatedAt            time.Time

	// Joined fields
	QuestionPublicID  string
	QuestionType      string
	QuestionStatement string
	UserPublicID      string
	UserName          string
	OptionPublicID    string
	OptionText        *string
	OptionIsCorrect   bool
}
