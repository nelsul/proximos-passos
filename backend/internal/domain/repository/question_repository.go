package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type QuestionFilter struct {
	Statement     string
	TopicID       *int
	Type          string // "open_ended", "closed_ended", or "" for any
	ExamID        *int
	InstitutionID *int
}

type QuestionRepository interface {
	Create(ctx context.Context, q *entity.Question, topicIDs []int) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.Question, error)
	Update(ctx context.Context, q *entity.Question) error
	AddImages(ctx context.Context, questionID int, q *entity.Question, uploadedByID int) error
	RemoveImage(ctx context.Context, questionID int, filePublicID string) error
	SetTopics(ctx context.Context, questionID int, topicIDs []int) error
	SetOptions(ctx context.Context, questionID int, options []entity.QuestionOption, createdByID int) error
	Delete(ctx context.Context, publicID string) error
	List(ctx context.Context, limit, offset int, filter QuestionFilter) ([]entity.Question, error)
	Count(ctx context.Context, filter QuestionFilter) (int, error)
	CountByExamID(ctx context.Context, examID int) (int, error)
	TopicPublicIDsByExamID(ctx context.Context, examID int) ([]string, error)
	CountByInstitutionID(ctx context.Context, institutionID int) (int, error)
	TopicPublicIDsByInstitutionID(ctx context.Context, institutionID int) ([]string, error)
}
