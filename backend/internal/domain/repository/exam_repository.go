package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type ExamFilter struct {
	InstitutionID string
	Year          *int
}

type ExamRepository interface {
	Create(ctx context.Context, exam *entity.Exam) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.Exam, error)
	Update(ctx context.Context, exam *entity.Exam) error
	Delete(ctx context.Context, publicID string) error
	List(ctx context.Context, limit, offset int, filter ExamFilter) ([]entity.Exam, error)
	Count(ctx context.Context, filter ExamFilter) (int, error)
}
