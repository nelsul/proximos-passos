package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type OpenExerciseListFilter struct {
	Title    string
	TopicIDs []int
}

type OpenExerciseListRepository interface {
	Create(ctx context.Context, oel *entity.OpenExerciseList, topicIDs []int) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.OpenExerciseList, error)
	Update(ctx context.Context, oel *entity.OpenExerciseList) error
	ReplaceFile(ctx context.Context, oelID int, newFileID int) error
	CreateFileAndReplace(ctx context.Context, oelID int, oel *entity.OpenExerciseList, uploadedByID int) error
	SetTopics(ctx context.Context, oelID int, topicIDs []int) error
	Delete(ctx context.Context, publicID string) error
	List(ctx context.Context, limit, offset int, filter OpenExerciseListFilter) ([]entity.OpenExerciseList, error)
	Count(ctx context.Context, filter OpenExerciseListFilter) (int, error)
}
