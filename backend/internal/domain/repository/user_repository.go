package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type UserRepository interface {
	Create(ctx context.Context, user *entity.User) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.User, error)
	GetByEmail(ctx context.Context, email string) (*entity.User, error)
	List(ctx context.Context, limit, offset int) ([]entity.User, error)
	Count(ctx context.Context) (int, error)
	Update(ctx context.Context, user *entity.User) error
	UpdateAvatar(ctx context.Context, publicID string, avatarURL *string) error
	Delete(ctx context.Context, publicID string) error
	VerifyEmail(ctx context.Context, publicID string) error
}
