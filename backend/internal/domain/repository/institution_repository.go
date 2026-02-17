package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type InstitutionFilter struct {
	Name string
}

type InstitutionRepository interface {
	Create(ctx context.Context, institution *entity.Institution) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.Institution, error)
	GetByID(ctx context.Context, id int) (*entity.Institution, error)
	Update(ctx context.Context, institution *entity.Institution) error
	Delete(ctx context.Context, publicID string) error
	List(ctx context.Context, limit, offset int, filter InstitutionFilter) ([]entity.Institution, error)
	Count(ctx context.Context, filter InstitutionFilter) (int, error)
}
