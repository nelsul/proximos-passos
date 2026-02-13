package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type GroupRepository interface {
	// Groups
	Create(ctx context.Context, group *entity.Group) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.Group, error)
	List(ctx context.Context, limit, offset int) ([]entity.Group, error)
	Count(ctx context.Context) (int, error)
	ListPublic(ctx context.Context, limit, offset int) ([]entity.Group, error)
	CountPublic(ctx context.Context) (int, error)
	ListByUser(ctx context.Context, userID int, limit, offset int) ([]entity.Group, error)
	CountByUser(ctx context.Context, userID int) (int, error)
	Update(ctx context.Context, group *entity.Group) error
	UpdateThumbnail(ctx context.Context, publicID string, thumbnailURL *string) error
	Delete(ctx context.Context, publicID string) error

	// Members
	AddMember(ctx context.Context, member *entity.GroupMember) error
	GetMember(ctx context.Context, groupID, userID int) (*entity.GroupMember, error)
	ListMembers(ctx context.Context, groupID int, limit, offset int) ([]entity.GroupMember, error)
	CountMembers(ctx context.Context, groupID int) (int, error)
	UpdateMemberRole(ctx context.Context, groupID, userID int, role entity.MemberRole) error
	RemoveMember(ctx context.Context, groupID, userID int) error
}
