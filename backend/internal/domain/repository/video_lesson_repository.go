package repository

import (
	"context"

	"proximos-passos/backend/internal/domain/entity"
)

type VideoLessonFilter struct {
	Title    string
	TopicIDs []int
}

type VideoLessonRepository interface {
	Create(ctx context.Context, vl *entity.VideoLesson, topicIDs []int) error
	GetByPublicID(ctx context.Context, publicID string) (*entity.VideoLesson, error)
	Update(ctx context.Context, vl *entity.VideoLesson) error
	ReplaceFile(ctx context.Context, vlID int, newFileID int) error
	CreateFileAndReplace(ctx context.Context, vlID int, vl *entity.VideoLesson, uploadedByID int) error
	SetTopics(ctx context.Context, vlID int, topicIDs []int) error
	Delete(ctx context.Context, publicID string) error
	List(ctx context.Context, limit, offset int, filter VideoLessonFilter) ([]entity.VideoLesson, error)
	Count(ctx context.Context, filter VideoLessonFilter) (int, error)
}
