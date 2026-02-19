package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type ActivitySubmissionRepository interface {
	Create(ctx context.Context, s *entity.ActivitySubmission) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.ActivitySubmission, error)
	GetByActivityAndUser(ctx context.Context, activityID, userID int) (*entity.ActivitySubmission, error)
	ListByActivity(ctx context.Context, activityID int, limit, offset int) ([]entity.ActivitySubmission, error)
	CountByActivity(ctx context.Context, activityID int) (int, error)
	ListByUser(ctx context.Context, userID int, limit, offset int) ([]entity.ActivitySubmission, error)
	CountByUser(ctx context.Context, userID int) (int, error)
	UpdateStatus(ctx context.Context, s *entity.ActivitySubmission) error
	UpdateNotes(ctx context.Context, id int, notes *string) error
	CreateFile(ctx context.Context, file *entity.ActivitySubmissionAttachment, uploadedByID int) error
	DeleteFile(ctx context.Context, fileID int) error
	ListAttachments(ctx context.Context, submissionID int) ([]entity.ActivitySubmissionAttachment, error)
	GetAttachment(ctx context.Context, submissionID int, filePublicID string) (*entity.ActivitySubmissionAttachment, error)
}
