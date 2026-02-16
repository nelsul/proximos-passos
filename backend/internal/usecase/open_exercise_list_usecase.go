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

type OpenExerciseListUseCase struct {
	oelRepo    repository.OpenExerciseListRepository
	topicRepo  repository.TopicRepository
	userRepo   repository.UserRepository
	storageSvc service.StorageService
}

func NewOpenExerciseListUseCase(
	oelRepo repository.OpenExerciseListRepository,
	topicRepo repository.TopicRepository,
	userRepo repository.UserRepository,
	storageSvc service.StorageService,
) *OpenExerciseListUseCase {
	return &OpenExerciseListUseCase{
		oelRepo:    oelRepo,
		topicRepo:  topicRepo,
		userRepo:   userRepo,
		storageSvc: storageSvc,
	}
}

const maxExerciseListFileSize = 50 << 20 // 50MB

var allowedExerciseListTypes = map[string]bool{
	"application/pdf": true,
}

type UpdateOpenExerciseListInput struct {
	Title       *string
	Description *string
	FileURL     *string
	TopicIDs    []string // topic public IDs
}

func (uc *OpenExerciseListUseCase) Create(
	ctx context.Context,
	createdByPublicID string,
	title string,
	description *string,
	fileURL *string,
	topicPublicIDs []string,
	filename string,
	contentType string,
	size int64,
	body io.Reader,
	hasFile bool,
) (*entity.OpenExerciseList, error) {
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

	var fURL *string
	if fileURL != nil {
		u := strings.TrimSpace(*fileURL)
		if u != "" {
			fURL = &u
		}
	}

	// Must have either a file or a URL
	if !hasFile && fURL == nil {
		return nil, apperror.ErrInvalidInput
	}

	// Resolve topic IDs
	topicIDs, err := uc.resolveTopicIDs(ctx, topicPublicIDs)
	if err != nil {
		return nil, err
	}

	oel := &entity.OpenExerciseList{
		Title:       title,
		Description: desc,
		FileURL:     fURL,
		CreatedByID: user.ID,
	}

	if hasFile {
		if !allowedExerciseListTypes[contentType] {
			return nil, apperror.ErrInvalidFileType
		}
		if size > maxExerciseListFileSize {
			return nil, apperror.ErrFileTooLarge
		}

		ext := filepath.Ext(filename)
		key := fmt.Sprintf("exercise-lists/%d%s", time.Now().UnixNano(), ext)

		_, err = uc.storageSvc.Upload(ctx, key, contentType, body)
		if err != nil {
			return nil, apperror.ErrUploadFailed
		}

		oel.FileKey = key
		oel.Filename = filename
		oel.ContentType = contentType
		oel.SizeBytes = size
	}

	if err := uc.oelRepo.Create(ctx, oel, topicIDs); err != nil {
		if oel.FileKey != "" {
			_ = uc.storageSvc.Delete(ctx, oel.FileKey)
		}
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrOpenExerciseListTitleTaken
		}
		return nil, err
	}

	// Reload to get full data
	created, err := uc.oelRepo.GetByPublicID(ctx, oel.PublicID)
	if err != nil {
		return nil, err
	}

	uc.resolveURL(created)
	return created, nil
}

func (uc *OpenExerciseListUseCase) GetByPublicID(ctx context.Context, publicID string) (*entity.OpenExerciseList, error) {
	oel, err := uc.oelRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if oel == nil {
		return nil, apperror.ErrOpenExerciseListNotFound
	}

	uc.resolveURL(oel)
	return oel, nil
}

func (uc *OpenExerciseListUseCase) Update(ctx context.Context, publicID string, input UpdateOpenExerciseListInput) (*entity.OpenExerciseList, error) {
	oel, err := uc.oelRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if oel == nil {
		return nil, apperror.ErrOpenExerciseListNotFound
	}

	if input.Title != nil {
		t := strings.TrimSpace(*input.Title)
		if t == "" || len(t) > 255 {
			return nil, apperror.ErrInvalidInput
		}
		oel.Title = t
	}

	if input.Description != nil {
		d := strings.TrimSpace(*input.Description)
		if d == "" {
			oel.Description = nil
		} else {
			oel.Description = &d
		}
	}

	if input.FileURL != nil {
		u := strings.TrimSpace(*input.FileURL)
		if u == "" {
			oel.FileURL = nil
		} else {
			oel.FileURL = &u
		}
	}

	if err := uc.oelRepo.Update(ctx, oel); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrOpenExerciseListTitleTaken
		}
		return nil, err
	}

	if input.TopicIDs != nil {
		topicIDs, err := uc.resolveTopicIDs(ctx, input.TopicIDs)
		if err != nil {
			return nil, err
		}
		if err := uc.oelRepo.SetTopics(ctx, oel.ID, topicIDs); err != nil {
			return nil, err
		}
	}

	updated, err := uc.oelRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}

	uc.resolveURL(updated)
	return updated, nil
}

func (uc *OpenExerciseListUseCase) ReplaceFile(
	ctx context.Context,
	publicID string,
	uploaderPublicID string,
	filename string,
	contentType string,
	size int64,
	body io.Reader,
) (*entity.OpenExerciseList, error) {
	oel, err := uc.oelRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if oel == nil {
		return nil, apperror.ErrOpenExerciseListNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, uploaderPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	if !allowedExerciseListTypes[contentType] {
		return nil, apperror.ErrInvalidFileType
	}
	if size > maxExerciseListFileSize {
		return nil, apperror.ErrFileTooLarge
	}

	ext := filepath.Ext(filename)
	key := fmt.Sprintf("exercise-lists/%d%s", time.Now().UnixNano(), ext)

	_, err = uc.storageSvc.Upload(ctx, key, contentType, body)
	if err != nil {
		return nil, apperror.ErrUploadFailed
	}

	newFile := &entity.OpenExerciseList{
		FileKey:     key,
		Filename:    filename,
		ContentType: contentType,
		SizeBytes:   size,
		CreatedByID: user.ID,
	}

	if err := uc.oelRepo.CreateFileAndReplace(ctx, oel.ID, newFile, user.ID); err != nil {
		_ = uc.storageSvc.Delete(ctx, key)
		return nil, err
	}

	// Delete old file from storage (best-effort)
	if oel.FileKey != "" {
		_ = uc.storageSvc.Delete(ctx, oel.FileKey)
	}

	updated, err := uc.oelRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	uc.resolveURL(updated)
	return updated, nil
}

func (uc *OpenExerciseListUseCase) Delete(ctx context.Context, publicID string) error {
	oel, err := uc.oelRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return err
	}
	if oel == nil {
		return apperror.ErrOpenExerciseListNotFound
	}

	return uc.oelRepo.Delete(ctx, publicID)
}

func (uc *OpenExerciseListUseCase) List(ctx context.Context, pageNumber, pageSize int, filter repository.OpenExerciseListFilter) ([]entity.OpenExerciseList, int, int, error) {
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

	lists, err := uc.oelRepo.List(ctx, pageSize, offset, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	total, err := uc.oelRepo.Count(ctx, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))

	// Set file URLs
	for i := range lists {
		uc.resolveURL(&lists[i])
	}

	return lists, total, totalPages, nil
}

func (uc *OpenExerciseListUseCase) ResolveTopicID(ctx context.Context, publicID string) (int, error) {
	topic, err := uc.topicRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return 0, err
	}
	if topic == nil {
		return 0, apperror.ErrTopicNotFound
	}
	return topic.ID, nil
}

func (uc *OpenExerciseListUseCase) resolveTopicIDs(ctx context.Context, publicIDs []string) ([]int, error) {
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

func (uc *OpenExerciseListUseCase) resolveURL(oel *entity.OpenExerciseList) {
	if oel.FileID != nil && oel.FileKey != "" {
		oel.ResolvedURL = uc.storageSvc.GetPublicURL(oel.FileKey)
	} else if oel.FileURL != nil {
		oel.ResolvedURL = *oel.FileURL
	}
}
