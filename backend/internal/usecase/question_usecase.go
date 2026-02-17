package usecase

import (
	"context"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/domain/service"
)

type QuestionUseCase struct {
	qRepo      repository.QuestionRepository
	topicRepo  repository.TopicRepository
	userRepo   repository.UserRepository
	storageSvc service.StorageService
}

func NewQuestionUseCase(
	qRepo repository.QuestionRepository,
	topicRepo repository.TopicRepository,
	userRepo repository.UserRepository,
	storageSvc service.StorageService,
) *QuestionUseCase {
	return &QuestionUseCase{
		qRepo:      qRepo,
		topicRepo:  topicRepo,
		userRepo:   userRepo,
		storageSvc: storageSvc,
	}
}

const maxQuestionImageSize = 10 << 20 // 10MB

var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
}

var validQuestionTypes = map[string]bool{
	"open_ended":   true,
	"closed_ended": true,
}

type UpdateQuestionInput struct {
	Type               *string
	Statement          *string
	ExpectedAnswerText *string
	PassingScore       *int
	TopicIDs           []string // topic public IDs
	Options            []OptionInput
}

type OptionInput struct {
	Text       *string
	IsCorrect  bool
	ImageFiles []*multipart.FileHeader // multiple images for this option
	ImageIDs   []string                // existing image file public IDs to preserve (for update)
}

type ImageUpload struct {
	Filename    string
	ContentType string
	Size        int64
	Body        io.Reader
}

func (uc *QuestionUseCase) Create(
	ctx context.Context,
	createdByPublicID string,
	qType string,
	statement string,
	expectedAnswerText *string,
	passingScore *int,
	topicPublicIDs []string,
	files []*multipart.FileHeader,
	optionInputs []OptionInput,
) (*entity.Question, error) {
	user, err := uc.userRepo.GetByPublicID(ctx, createdByPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	statement = strings.TrimSpace(statement)
	if statement == "" {
		return nil, apperror.ErrInvalidInput
	}

	if !validQuestionTypes[qType] {
		return nil, apperror.ErrInvalidInput
	}

	var expAnswer *string
	if expectedAnswerText != nil {
		a := strings.TrimSpace(*expectedAnswerText)
		if a != "" {
			expAnswer = &a
		}
	}

	if passingScore != nil {
		if *passingScore < 0 || *passingScore > 100 {
			return nil, apperror.ErrInvalidInput
		}
	}

	// Resolve topic IDs
	topicIDs, err := uc.resolveTopicIDs(ctx, topicPublicIDs)
	if err != nil {
		return nil, err
	}

	q := &entity.Question{
		Type:               qType,
		Statement:          statement,
		ExpectedAnswerText: expAnswer,
		PassingScore:       passingScore,
		CreatedByID:        user.ID,
	}

	uploadedKeys := []string{}

	// Type-specific validation
	if qType == "open_ended" {
		if q.ExpectedAnswerText == nil || *q.ExpectedAnswerText == "" {
			return nil, apperror.ErrInvalidInput
		}
		if q.PassingScore == nil {
			return nil, apperror.ErrInvalidInput
		}
	}

	if qType == "closed_ended" {
		if len(optionInputs) < 2 {
			return nil, apperror.ErrInvalidInput
		}
		hasCorrect := false
		for i, oi := range optionInputs {
			hasText := oi.Text != nil && strings.TrimSpace(*oi.Text) != ""
			hasImages := len(oi.ImageFiles) > 0
			if !hasText && !hasImages {
				return nil, apperror.ErrInvalidInput
			}
			var trimmed *string
			if hasText {
				t := strings.TrimSpace(*oi.Text)
				trimmed = &t
			}
			opt := entity.QuestionOption{
				OriginalOrder: i,
				Text:          trimmed,
				IsCorrect:     oi.IsCorrect,
			}
			// Upload option images
			for _, imgFile := range oi.ImageFiles {
				ct := imgFile.Header.Get("Content-Type")
				if !allowedImageTypes[ct] {
					uc.cleanupFiles(ctx, uploadedKeys)
					return nil, apperror.ErrInvalidFileType
				}
				if imgFile.Size > maxQuestionImageSize {
					uc.cleanupFiles(ctx, uploadedKeys)
					return nil, apperror.ErrFileTooLarge
				}
				f, ferr := imgFile.Open()
				if ferr != nil {
					uc.cleanupFiles(ctx, uploadedKeys)
					return nil, apperror.ErrInvalidInput
				}
				ext := filepath.Ext(imgFile.Filename)
				key := fmt.Sprintf("question-options/%d%s", time.Now().UnixNano(), ext)
				_, ferr = uc.storageSvc.Upload(ctx, key, ct, f)
				f.Close()
				if ferr != nil {
					uc.cleanupFiles(ctx, uploadedKeys)
					return nil, apperror.ErrUploadFailed
				}
				uploadedKeys = append(uploadedKeys, key)
				opt.Images = append(opt.Images, entity.QuestionImage{
					FileKey:     key,
					Filename:    imgFile.Filename,
					ContentType: ct,
					SizeBytes:   imgFile.Size,
				})
			}
			q.Options = append(q.Options, opt)
			if oi.IsCorrect {
				hasCorrect = true
			}
		}
		if !hasCorrect {
			uc.cleanupFiles(ctx, uploadedKeys)
			return nil, apperror.ErrInvalidInput
		}
	}

	// Upload images
	for _, fh := range files {
		ct := fh.Header.Get("Content-Type")
		if !allowedImageTypes[ct] {
			uc.cleanupFiles(ctx, uploadedKeys)
			return nil, apperror.ErrInvalidFileType
		}
		if fh.Size > maxQuestionImageSize {
			uc.cleanupFiles(ctx, uploadedKeys)
			return nil, apperror.ErrFileTooLarge
		}

		f, err := fh.Open()
		if err != nil {
			uc.cleanupFiles(ctx, uploadedKeys)
			return nil, apperror.ErrInvalidInput
		}

		ext := filepath.Ext(fh.Filename)
		key := fmt.Sprintf("questions/%d%s", time.Now().UnixNano(), ext)

		_, err = uc.storageSvc.Upload(ctx, key, ct, f)
		f.Close()
		if err != nil {
			uc.cleanupFiles(ctx, uploadedKeys)
			return nil, apperror.ErrUploadFailed
		}
		uploadedKeys = append(uploadedKeys, key)

		q.Images = append(q.Images, entity.QuestionImage{
			FileKey:     key,
			Filename:    fh.Filename,
			ContentType: ct,
			SizeBytes:   fh.Size,
		})
	}

	if err := uc.qRepo.Create(ctx, q, topicIDs); err != nil {
		uc.cleanupFiles(ctx, uploadedKeys)
		return nil, err
	}

	// Reload to get full data
	created, err := uc.qRepo.GetByPublicID(ctx, q.PublicID)
	if err != nil {
		return nil, err
	}

	uc.resolveImageURLs(created)
	return created, nil
}

func (uc *QuestionUseCase) GetByPublicID(ctx context.Context, publicID string) (*entity.Question, error) {
	q, err := uc.qRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if q == nil {
		return nil, apperror.ErrQuestionNotFound
	}

	uc.resolveImageURLs(q)
	return q, nil
}

func (uc *QuestionUseCase) Update(ctx context.Context, publicID string, input UpdateQuestionInput) (*entity.Question, error) {
	q, err := uc.qRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if q == nil {
		return nil, apperror.ErrQuestionNotFound
	}

	if input.Type != nil {
		if !validQuestionTypes[*input.Type] {
			return nil, apperror.ErrInvalidInput
		}
		q.Type = *input.Type
	}

	if input.Statement != nil {
		s := strings.TrimSpace(*input.Statement)
		if s == "" {
			return nil, apperror.ErrInvalidInput
		}
		q.Statement = s
	}

	if input.ExpectedAnswerText != nil {
		a := strings.TrimSpace(*input.ExpectedAnswerText)
		if a == "" {
			q.ExpectedAnswerText = nil
		} else {
			q.ExpectedAnswerText = &a
		}
	}

	if input.PassingScore != nil {
		if *input.PassingScore < 0 || *input.PassingScore > 100 {
			return nil, apperror.ErrInvalidInput
		}
		q.PassingScore = input.PassingScore
	}

	if err := uc.qRepo.Update(ctx, q); err != nil {
		return nil, err
	}

	if input.TopicIDs != nil {
		topicIDs, err := uc.resolveTopicIDs(ctx, input.TopicIDs)
		if err != nil {
			return nil, err
		}
		if err := uc.qRepo.SetTopics(ctx, q.ID, topicIDs); err != nil {
			return nil, err
		}
	}

	if input.Options != nil {
		var options []entity.QuestionOption
		uploadedOptKeys := []string{}
		for i, oi := range input.Options {
			var text *string
			if oi.Text != nil {
				trimmed := strings.TrimSpace(*oi.Text)
				if trimmed != "" {
					text = &trimmed
				}
			}
			opt := entity.QuestionOption{
				OriginalOrder: i,
				Text:          text,
				IsCorrect:     oi.IsCorrect,
			}

			// Upload new images
			for _, imgFile := range oi.ImageFiles {
				ct := imgFile.Header.Get("Content-Type")
				if !allowedImageTypes[ct] {
					uc.cleanupFiles(ctx, uploadedOptKeys)
					return nil, apperror.ErrInvalidFileType
				}
				if imgFile.Size > maxQuestionImageSize {
					uc.cleanupFiles(ctx, uploadedOptKeys)
					return nil, apperror.ErrFileTooLarge
				}
				f, ferr := imgFile.Open()
				if ferr != nil {
					uc.cleanupFiles(ctx, uploadedOptKeys)
					return nil, apperror.ErrInvalidInput
				}
				ext := filepath.Ext(imgFile.Filename)
				key := fmt.Sprintf("question-options/%d%s", time.Now().UnixNano(), ext)
				_, ferr = uc.storageSvc.Upload(ctx, key, ct, f)
				f.Close()
				if ferr != nil {
					uc.cleanupFiles(ctx, uploadedOptKeys)
					return nil, apperror.ErrUploadFailed
				}
				uploadedOptKeys = append(uploadedOptKeys, key)
				opt.Images = append(opt.Images, entity.QuestionImage{
					FileKey:     key,
					Filename:    imgFile.Filename,
					ContentType: ct,
					SizeBytes:   imgFile.Size,
				})
			}

			// Preserve existing images by public ID
			for _, imgPubID := range oi.ImageIDs {
				for _, existingOpt := range q.Options {
					for _, existingImg := range existingOpt.Images {
						if existingImg.FilePublicID == imgPubID {
							opt.Images = append(opt.Images, entity.QuestionImage{
								FileID: existingImg.FileID,
							})
							break
						}
					}
				}
			}

			options = append(options, opt)
		}
		if err := uc.qRepo.SetOptions(ctx, q.ID, options, q.CreatedByID); err != nil {
			uc.cleanupFiles(ctx, uploadedOptKeys)
			return nil, err
		}
	}

	// Re-load to validate final state
	updated, err := uc.qRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}

	// Post-update type validation
	if updated.Type == "open_ended" {
		if updated.ExpectedAnswerText == nil || *updated.ExpectedAnswerText == "" {
			return nil, apperror.ErrInvalidInput
		}
		if updated.PassingScore == nil {
			return nil, apperror.ErrInvalidInput
		}
	}
	if updated.Type == "closed_ended" {
		if len(updated.Options) < 2 {
			return nil, apperror.ErrInvalidInput
		}
		hasCorrect := false
		for _, opt := range updated.Options {
			if opt.IsCorrect {
				hasCorrect = true
				break
			}
		}
		if !hasCorrect {
			return nil, apperror.ErrInvalidInput
		}
	}

	uc.resolveImageURLs(updated)
	return updated, nil
}

func (uc *QuestionUseCase) AddImages(
	ctx context.Context,
	publicID string,
	uploaderPublicID string,
	files []*multipart.FileHeader,
) (*entity.Question, error) {
	q, err := uc.qRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if q == nil {
		return nil, apperror.ErrQuestionNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, uploaderPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	newImages := &entity.Question{}
	uploadedKeys := []string{}

	for _, fh := range files {
		ct := fh.Header.Get("Content-Type")
		if !allowedImageTypes[ct] {
			uc.cleanupFiles(ctx, uploadedKeys)
			return nil, apperror.ErrInvalidFileType
		}
		if fh.Size > maxQuestionImageSize {
			uc.cleanupFiles(ctx, uploadedKeys)
			return nil, apperror.ErrFileTooLarge
		}

		f, err := fh.Open()
		if err != nil {
			uc.cleanupFiles(ctx, uploadedKeys)
			return nil, apperror.ErrInvalidInput
		}

		ext := filepath.Ext(fh.Filename)
		key := fmt.Sprintf("questions/%d%s", time.Now().UnixNano(), ext)

		_, err = uc.storageSvc.Upload(ctx, key, ct, f)
		f.Close()
		if err != nil {
			uc.cleanupFiles(ctx, uploadedKeys)
			return nil, apperror.ErrUploadFailed
		}
		uploadedKeys = append(uploadedKeys, key)

		newImages.Images = append(newImages.Images, entity.QuestionImage{
			FileKey:     key,
			Filename:    fh.Filename,
			ContentType: ct,
			SizeBytes:   fh.Size,
		})
	}

	if err := uc.qRepo.AddImages(ctx, q.ID, newImages, user.ID); err != nil {
		uc.cleanupFiles(ctx, uploadedKeys)
		return nil, err
	}

	updated, err := uc.qRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	uc.resolveImageURLs(updated)
	return updated, nil
}

func (uc *QuestionUseCase) RemoveImage(ctx context.Context, publicID string, imagePublicID string) (*entity.Question, error) {
	q, err := uc.qRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if q == nil {
		return nil, apperror.ErrQuestionNotFound
	}

	// Find the image to delete from storage
	var keyToDelete string
	for _, img := range q.Images {
		if img.FilePublicID == imagePublicID {
			keyToDelete = img.FileKey
			break
		}
	}

	if err := uc.qRepo.RemoveImage(ctx, q.ID, imagePublicID); err != nil {
		return nil, err
	}

	if keyToDelete != "" {
		_ = uc.storageSvc.Delete(ctx, keyToDelete)
	}

	updated, err := uc.qRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	uc.resolveImageURLs(updated)
	return updated, nil
}

func (uc *QuestionUseCase) Delete(ctx context.Context, publicID string) error {
	q, err := uc.qRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return err
	}
	if q == nil {
		return apperror.ErrQuestionNotFound
	}

	return uc.qRepo.Delete(ctx, publicID)
}

func (uc *QuestionUseCase) List(ctx context.Context, pageNumber, pageSize int, filter repository.QuestionFilter) ([]entity.Question, int, int, error) {
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

	questions, err := uc.qRepo.List(ctx, pageSize, offset, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	total, err := uc.qRepo.Count(ctx, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))

	for i := range questions {
		uc.resolveImageURLs(&questions[i])
	}

	return questions, total, totalPages, nil
}

func (uc *QuestionUseCase) ResolveTopicID(ctx context.Context, publicID string) (int, error) {
	topic, err := uc.topicRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return 0, err
	}
	if topic == nil {
		return 0, apperror.ErrTopicNotFound
	}
	return topic.ID, nil
}

func (uc *QuestionUseCase) resolveTopicIDs(ctx context.Context, publicIDs []string) ([]int, error) {
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

func (uc *QuestionUseCase) resolveImageURLs(q *entity.Question) {
	for i := range q.Images {
		if q.Images[i].FileKey != "" {
			q.Images[i].URL = uc.storageSvc.GetPublicURL(q.Images[i].FileKey)
		}
	}
	for i := range q.Options {
		for j := range q.Options[i].Images {
			if q.Options[i].Images[j].FileKey != "" {
				q.Options[i].Images[j].URL = uc.storageSvc.GetPublicURL(q.Options[i].Images[j].FileKey)
			}
		}
	}
}

func (uc *QuestionUseCase) cleanupFiles(ctx context.Context, keys []string) {
	for _, k := range keys {
		_ = uc.storageSvc.Delete(ctx, k)
	}
}
