package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type TopicFilter struct {
	Name     string
	ParentID *string
}

type TopicRepository interface {
	Create(ctx context.Context, topic *entity.Topic) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.Topic, error)
	GetByID(ctx context.Context, id int) (*entity.Topic, error)
	Update(ctx context.Context, topic *entity.Topic) error
	Delete(ctx context.Context, publicID string) error
	DeleteCascade(ctx context.Context, id int) error
	ReparentChildren(ctx context.Context, parentID int, newParentID *int) error
	List(ctx context.Context, limit, offset int, filter TopicFilter) ([]entity.Topic, error)
	Count(ctx context.Context, filter TopicFilter) (int, error)
}
