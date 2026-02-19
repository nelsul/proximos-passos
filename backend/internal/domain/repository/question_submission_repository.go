package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type QuestionSubmissionRepository interface {
	Create(ctx context.Context, s *entity.QuestionSubmission) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.QuestionSubmission, error)
	ListByUser(ctx context.Context, userID int, limit, offset int, statement string) ([]entity.QuestionSubmission, error)
	CountByUser(ctx context.Context, userID int, statement string) (int, error)
	ListByQuestion(ctx context.Context, questionID int, limit, offset int) ([]entity.QuestionSubmission, error)
	CountByQuestion(ctx context.Context, questionID int) (int, error)
	ListByActivitySubmission(ctx context.Context, activitySubmissionID int) ([]entity.QuestionSubmission, error)
}
