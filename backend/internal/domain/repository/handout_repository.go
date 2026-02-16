package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type HandoutFilter struct {
	Title   string
	TopicID *int
}

type HandoutRepository interface {
	Create(ctx context.Context, handout *entity.Handout, topicIDs []int) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.Handout, error)
	Update(ctx context.Context, handout *entity.Handout) error
	ReplaceFile(ctx context.Context, handoutID int, newFileID int) error
	CreateFileAndReplace(ctx context.Context, handoutID int, handout *entity.Handout, uploadedByID int) error
	SetTopics(ctx context.Context, handoutID int, topicIDs []int) error
	Delete(ctx context.Context, publicID string) error
	List(ctx context.Context, limit, offset int, filter HandoutFilter) ([]entity.Handout, error)
	Count(ctx context.Context, filter HandoutFilter) (int, error)
}
