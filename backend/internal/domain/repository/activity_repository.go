package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type ActivityFilter struct {
	Title string
}

type ActivityRepository interface {
	Create(ctx context.Context, activity *entity.Activity) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.Activity, error)
	GetByID(ctx context.Context, id int) (*entity.Activity, error)
	Update(ctx context.Context, activity *entity.Activity) error
	Delete(ctx context.Context, publicID string) error

	ListUpcoming(ctx context.Context, groupID int, limit, offset int, filter ActivityFilter) ([]entity.Activity, error)
	CountUpcoming(ctx context.Context, groupID int, filter ActivityFilter) (int, error)
	ListPast(ctx context.Context, groupID int, limit, offset int, filter ActivityFilter) ([]entity.Activity, error)
	CountPast(ctx context.Context, groupID int, filter ActivityFilter) (int, error)

	// Attachments
	CreateFile(ctx context.Context, file *entity.ActivityAttachment, uploadedByID int) error
	DeleteFile(ctx context.Context, fileID int) error
	ListAttachments(ctx context.Context, activityID int) ([]entity.ActivityAttachment, error)
	GetAttachment(ctx context.Context, activityID int, filePublicID string) (*entity.ActivityAttachment, error)

	// Activity Items
	CreateItem(ctx context.Context, item *entity.ActivityItem) error
	GetItemByPublicID(ctx context.Context, publicID string) (*entity.ActivityItem, error)
	UpdateItem(ctx context.Context, item *entity.ActivityItem) error
	DeleteItem(ctx context.Context, publicID string) error
	ListItems(ctx context.Context, activityID int) ([]entity.ActivityItem, error)
	ReorderItems(ctx context.Context, activityID int, orderedIDs []string) error
}
