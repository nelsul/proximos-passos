package usecase

import (
	"context"
	"fmt"
	"io"
	"math"
	"path/filepath"
	"strings"
	"time"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/domain/service"
)

type VideoLessonUseCase struct {
	vlRepo     repository.VideoLessonRepository
	topicRepo  repository.TopicRepository
	userRepo   repository.UserRepository
	storageSvc service.StorageService
}

func NewVideoLessonUseCase(
	vlRepo repository.VideoLessonRepository,
	topicRepo repository.TopicRepository,
	userRepo repository.UserRepository,
	storageSvc service.StorageService,
) *VideoLessonUseCase {
	return &VideoLessonUseCase{
		vlRepo:     vlRepo,
		topicRepo:  topicRepo,
		userRepo:   userRepo,
		storageSvc: storageSvc,
	}
}

const maxVideoFileSize = 500 << 20 // 500MB

var allowedVideoTypes = map[string]bool{
	"video/mp4":       true,
	"video/webm":      true,
	"video/ogg":       true,
	"video/quicktime": true,
}

type UpdateVideoLessonInput struct {
	Title           *string
	Description     *string
	VideoURL        *string
	DurationMinutes *int
	TopicIDs        []string // topic public IDs
}

func (uc *VideoLessonUseCase) Create(
	ctx context.Context,
	createdByPublicID string,
	title string,
	description *string,
	videoURL *string,
	durationMinutes int,
	topicPublicIDs []string,
	filename string,
	contentType string,
	size int64,
	body io.Reader,
	hasFile bool,
) (*entity.VideoLesson, error) {
	user, err := uc.userRepo.GetByPublicID(ctx, createdByPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	title = strings.TrimSpace(title)
	if title == "" || len(title) > 255 {
		return nil, apperror.ErrInvalidInput
	}

	if durationMinutes <= 0 {
		return nil, apperror.ErrInvalidInput
	}

	var desc *string
	if description != nil {
		d := strings.TrimSpace(*description)
		if d != "" {
			desc = &d
		}
	}

	var vidURL *string
	if videoURL != nil {
		u := strings.TrimSpace(*videoURL)
		if u != "" {
			vidURL = &u
		}
	}

	// Must have either a file or a URL
	if !hasFile && vidURL == nil {
		return nil, apperror.ErrInvalidInput
	}

	// Resolve topic IDs
	topicIDs, err := uc.resolveTopicIDs(ctx, topicPublicIDs)
	if err != nil {
		return nil, err
	}

	vl := &entity.VideoLesson{
		Title:           title,
		Description:     desc,
		FileURL:         vidURL,
		DurationMinutes: durationMinutes,
		CreatedByID:     user.ID,
	}

	if hasFile {
		if !allowedVideoTypes[contentType] {
			return nil, apperror.ErrInvalidFileType
		}
		if size > maxVideoFileSize {
			return nil, apperror.ErrFileTooLarge
		}

		ext := filepath.Ext(filename)
		key := fmt.Sprintf("video-lessons/%d%s", time.Now().UnixNano(), ext)

		_, err = uc.storageSvc.Upload(ctx, key, contentType, body)
		if err != nil {
			return nil, apperror.ErrUploadFailed
		}

		vl.FileKey = key
		vl.Filename = filename
		vl.ContentType = contentType
		vl.SizeBytes = size
	}

	if err := uc.vlRepo.Create(ctx, vl, topicIDs); err != nil {
		if vl.FileKey != "" {
			_ = uc.storageSvc.Delete(ctx, vl.FileKey)
		}
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrVideoLessonTitleTaken
		}
		return nil, err
	}

	// Reload to get full data
	created, err := uc.vlRepo.GetByPublicID(ctx, vl.PublicID)
	if err != nil {
		return nil, err
	}

	uc.resolveURL(created)
	return created, nil
}

func (uc *VideoLessonUseCase) GetByPublicID(ctx context.Context, publicID string) (*entity.VideoLesson, error) {
	vl, err := uc.vlRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if vl == nil {
		return nil, apperror.ErrVideoLessonNotFound
	}

	uc.resolveURL(vl)
	return vl, nil
}

func (uc *VideoLessonUseCase) Update(ctx context.Context, publicID string, input UpdateVideoLessonInput) (*entity.VideoLesson, error) {
	vl, err := uc.vlRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if vl == nil {
		return nil, apperror.ErrVideoLessonNotFound
	}

	if input.Title != nil {
		t := strings.TrimSpace(*input.Title)
		if t == "" || len(t) > 255 {
			return nil, apperror.ErrInvalidInput
		}
		vl.Title = t
	}

	if input.Description != nil {
		d := strings.TrimSpace(*input.Description)
		if d == "" {
			vl.Description = nil
		} else {
			vl.Description = &d
		}
	}

	if input.VideoURL != nil {
		u := strings.TrimSpace(*input.VideoURL)
		if u == "" {
			vl.FileURL = nil
		} else {
			vl.FileURL = &u
		}
	}

	if input.DurationMinutes != nil {
		if *input.DurationMinutes <= 0 {
			return nil, apperror.ErrInvalidInput
		}
		vl.DurationMinutes = *input.DurationMinutes
	}

	if err := uc.vlRepo.Update(ctx, vl); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrVideoLessonTitleTaken
		}
		return nil, err
	}

	if input.TopicIDs != nil {
		topicIDs, err := uc.resolveTopicIDs(ctx, input.TopicIDs)
		if err != nil {
			return nil, err
		}
		if err := uc.vlRepo.SetTopics(ctx, vl.ID, topicIDs); err != nil {
			return nil, err
		}
	}

	updated, err := uc.vlRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}

	uc.resolveURL(updated)
	return updated, nil
}

func (uc *VideoLessonUseCase) ReplaceFile(
	ctx context.Context,
	publicID string,
	uploaderPublicID string,
	filename string,
	contentType string,
	size int64,
	body io.Reader,
) (*entity.VideoLesson, error) {
	vl, err := uc.vlRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if vl == nil {
		return nil, apperror.ErrVideoLessonNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, uploaderPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	if !allowedVideoTypes[contentType] {
		return nil, apperror.ErrInvalidFileType
	}
	if size > maxVideoFileSize {
		return nil, apperror.ErrFileTooLarge
	}

	ext := filepath.Ext(filename)
	key := fmt.Sprintf("video-lessons/%d%s", time.Now().UnixNano(), ext)

	_, err = uc.storageSvc.Upload(ctx, key, contentType, body)
	if err != nil {
		return nil, apperror.ErrUploadFailed
	}

	newFile := &entity.VideoLesson{
		FileKey:     key,
		Filename:    filename,
		ContentType: contentType,
		SizeBytes:   size,
		CreatedByID: user.ID,
	}

	if err := uc.vlRepo.CreateFileAndReplace(ctx, vl.ID, newFile, user.ID); err != nil {
		_ = uc.storageSvc.Delete(ctx, key)
		return nil, err
	}

	// Delete old file from storage (best-effort)
	if vl.FileKey != "" {
		_ = uc.storageSvc.Delete(ctx, vl.FileKey)
	}

	updated, err := uc.vlRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	uc.resolveURL(updated)
	return updated, nil
}

func (uc *VideoLessonUseCase) Delete(ctx context.Context, publicID string) error {
	vl, err := uc.vlRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return err
	}
	if vl == nil {
		return apperror.ErrVideoLessonNotFound
	}

	return uc.vlRepo.Delete(ctx, publicID)
}

func (uc *VideoLessonUseCase) List(ctx context.Context, pageNumber, pageSize int, filter repository.VideoLessonFilter) ([]entity.VideoLesson, int, int, error) {
	if pageNumber < 1 {
		pageNumber = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (pageNumber - 1) * pageSize

	lessons, err := uc.vlRepo.List(ctx, pageSize, offset, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	total, err := uc.vlRepo.Count(ctx, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))

	// Set file URLs
	for i := range lessons {
		uc.resolveURL(&lessons[i])
	}

	return lessons, total, totalPages, nil
}

func (uc *VideoLessonUseCase) ResolveTopicID(ctx context.Context, publicID string) (int, error) {
	topic, err := uc.topicRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return 0, err
	}
	if topic == nil {
		return 0, apperror.ErrTopicNotFound
	}
	return topic.ID, nil
}

func (uc *VideoLessonUseCase) resolveTopicIDs(ctx context.Context, publicIDs []string) ([]int, error) {
	ids := make([]int, 0, len(publicIDs))
	for _, pid := range publicIDs {
		pid = strings.TrimSpace(pid)
		if pid == "" {
			continue
		}
		topic, err := uc.topicRepo.GetByPublicID(ctx, pid)
		if err != nil {
			return nil, err
		}
		if topic == nil {
			return nil, apperror.ErrTopicNotFound
		}
		ids = append(ids, topic.ID)
	}
	return ids, nil
}

func (uc *VideoLessonUseCase) resolveURL(vl *entity.VideoLesson) {
	if vl.FileID != nil && vl.FileKey != "" {
		vl.ResolvedURL = uc.storageSvc.GetPublicURL(vl.FileKey)
	} else if vl.FileURL != nil {
		vl.ResolvedURL = *vl.FileURL
	}
}
