package usecase

import (
	"context"
	"fmt"
	"io"
	"math"
	"path/filepath"
	"strings"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/domain/service"
)

type HandoutUseCase struct {
	handoutRepo repository.HandoutRepository
	topicRepo   repository.TopicRepository
	userRepo    repository.UserRepository
	storageSvc  service.StorageService
}

func NewHandoutUseCase(
	handoutRepo repository.HandoutRepository,
	topicRepo repository.TopicRepository,
	userRepo repository.UserRepository,
	storageSvc service.StorageService,
) *HandoutUseCase {
	return &HandoutUseCase{
		handoutRepo: handoutRepo,
		topicRepo:   topicRepo,
		userRepo:    userRepo,
		storageSvc:  storageSvc,
	}
}

const maxHandoutFileSize = 50 << 20 // 50MB

type UpdateHandoutInput struct {
	Title       *string
	Description *string
	TopicIDs    []string // topic public IDs
}

func (uc *HandoutUseCase) Create(
	ctx context.Context,
	createdByPublicID string,
	title string,
	description *string,
	topicPublicIDs []string,
	filename string,
	contentType string,
	size int64,
	body io.Reader,
) (*entity.Handout, error) {
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

	var desc *string
	if description != nil {
		d := strings.TrimSpace(*description)
		if d != "" {
			desc = &d
		}
	}

	if contentType != "application/pdf" {
		return nil, apperror.ErrInvalidFileType
	}
	if size > maxHandoutFileSize {
		return nil, apperror.ErrFileTooLarge
	}

	// Resolve topic IDs
	topicIDs, err := uc.resolveTopicIDs(ctx, topicPublicIDs)
	if err != nil {
		return nil, err
	}

	ext := filepath.Ext(filename)
	key := fmt.Sprintf("handouts/%s%s", newUUID(), ext)

	_, err = uc.storageSvc.Upload(ctx, key, contentType, body)
	if err != nil {
		return nil, apperror.ErrUploadFailed
	}

	handout := &entity.Handout{
		Title:       title,
		Description: desc,
		FileKey:     key,
		Filename:    filename,
		ContentType: contentType,
		SizeBytes:   size,
		CreatedByID: user.ID,
	}

	if err := uc.handoutRepo.Create(ctx, handout, topicIDs); err != nil {
		_ = uc.storageSvc.Delete(ctx, key)
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrHandoutTitleTaken
		}
		return nil, err
	}

	// Reload to get full data
	created, err := uc.handoutRepo.GetByPublicID(ctx, handout.PublicID)
	if err != nil {
		return nil, err
	}

	created.FileURL = uc.storageSvc.GetPublicURL(created.FileKey)
	return created, nil
}

func (uc *HandoutUseCase) GetByPublicID(ctx context.Context, publicID string) (*entity.Handout, error) {
	handout, err := uc.handoutRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if handout == nil {
		return nil, apperror.ErrHandoutNotFound
	}

	handout.FileURL = uc.storageSvc.GetPublicURL(handout.FileKey)
	return handout, nil
}

func (uc *HandoutUseCase) Update(ctx context.Context, publicID string, input UpdateHandoutInput) (*entity.Handout, error) {
	handout, err := uc.handoutRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if handout == nil {
		return nil, apperror.ErrHandoutNotFound
	}

	if input.Title != nil {
		t := strings.TrimSpace(*input.Title)
		if t == "" || len(t) > 255 {
			return nil, apperror.ErrInvalidInput
		}
		handout.Title = t
	}

	if input.Description != nil {
		d := strings.TrimSpace(*input.Description)
		if d == "" {
			handout.Description = nil
		} else {
			handout.Description = &d
		}
	}

	if err := uc.handoutRepo.Update(ctx, handout); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrHandoutTitleTaken
		}
		return nil, err
	}

	if input.TopicIDs != nil {
		topicIDs, err := uc.resolveTopicIDs(ctx, input.TopicIDs)
		if err != nil {
			return nil, err
		}
		if err := uc.handoutRepo.SetTopics(ctx, handout.ID, topicIDs); err != nil {
			return nil, err
		}
	}

	updated, err := uc.handoutRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}

	updated.FileURL = uc.storageSvc.GetPublicURL(updated.FileKey)
	return updated, nil
}

func (uc *HandoutUseCase) ReplaceFile(
	ctx context.Context,
	publicID string,
	uploaderPublicID string,
	filename string,
	contentType string,
	size int64,
	body io.Reader,
) (*entity.Handout, error) {
	handout, err := uc.handoutRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if handout == nil {
		return nil, apperror.ErrHandoutNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, uploaderPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	if contentType != "application/pdf" {
		return nil, apperror.ErrInvalidFileType
	}
	if size > maxHandoutFileSize {
		return nil, apperror.ErrFileTooLarge
	}

	ext := filepath.Ext(filename)
	key := fmt.Sprintf("handouts/%s%s", newUUID(), ext)

	_, err = uc.storageSvc.Upload(ctx, key, contentType, body)
	if err != nil {
		return nil, apperror.ErrUploadFailed
	}

	// Create new file record
	newFile := &entity.Handout{
		FileKey:     key,
		Filename:    filename,
		ContentType: contentType,
		SizeBytes:   size,
		CreatedByID: user.ID,
	}

	if err := uc.handoutRepo.CreateFileAndReplace(ctx, handout.ID, newFile, user.ID); err != nil {
		_ = uc.storageSvc.Delete(ctx, key)
		return nil, err
	}

	// Delete old file from storage (best-effort)
	_ = uc.storageSvc.Delete(ctx, handout.FileKey)

	updated, err := uc.handoutRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	updated.FileURL = uc.storageSvc.GetPublicURL(updated.FileKey)
	return updated, nil
}

func (uc *HandoutUseCase) Delete(ctx context.Context, publicID string) error {
	handout, err := uc.handoutRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return err
	}
	if handout == nil {
		return apperror.ErrHandoutNotFound
	}

	return uc.handoutRepo.Delete(ctx, publicID)
}

func (uc *HandoutUseCase) List(ctx context.Context, pageNumber, pageSize int, filter repository.HandoutFilter) ([]entity.Handout, int, int, error) {
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

	handouts, err := uc.handoutRepo.List(ctx, pageSize, offset, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	total, err := uc.handoutRepo.Count(ctx, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))

	// Set file URLs
	for i := range handouts {
		handouts[i].FileURL = uc.storageSvc.GetPublicURL(handouts[i].FileKey)
	}

	return handouts, total, totalPages, nil
}

func (uc *HandoutUseCase) ResolveTopicID(ctx context.Context, publicID string) (int, error) {
	topic, err := uc.topicRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return 0, err
	}
	if topic == nil {
		return 0, apperror.ErrTopicNotFound
	}
	return topic.ID, nil
}

func (uc *HandoutUseCase) resolveTopicIDs(ctx context.Context, publicIDs []string) ([]int, error) {
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
