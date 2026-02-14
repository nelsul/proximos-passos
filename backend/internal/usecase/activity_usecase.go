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

type ActivityUseCase struct {
	activityRepo repository.ActivityRepository
	groupRepo    repository.GroupRepository
	userRepo     repository.UserRepository
	storageSvc   service.StorageService
}

func NewActivityUseCase(
	activityRepo repository.ActivityRepository,
	groupRepo repository.GroupRepository,
	userRepo repository.UserRepository,
	storageSvc service.StorageService,
) *ActivityUseCase {
	return &ActivityUseCase{
		activityRepo: activityRepo,
		groupRepo:    groupRepo,
		userRepo:     userRepo,
		storageSvc:   storageSvc,
	}
}

type CreateActivityInput struct {
	Title       string
	Description *string
	DueDate     time.Time
}

type UpdateActivityInput struct {
	Title       *string
	Description *string
	DueDate     *time.Time
}

func (uc *ActivityUseCase) isGroupAdmin(ctx context.Context, groupID int, userPublicID string) (bool, *entity.User, error) {
	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return false, nil, err
	}
	if user == nil {
		return false, nil, apperror.ErrUserNotFound
	}

	member, err := uc.groupRepo.GetMember(ctx, groupID, user.ID)
	if err != nil {
		return false, user, err
	}
	if member == nil || !member.IsActive || member.AcceptedByID == nil {
		return false, user, nil
	}

	return member.Role == entity.MemberRoleAdmin, user, nil
}

func (uc *ActivityUseCase) isMember(ctx context.Context, groupID int, userPublicID string) (bool, *entity.User, error) {
	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return false, nil, err
	}
	if user == nil {
		return false, nil, apperror.ErrUserNotFound
	}

	member, err := uc.groupRepo.GetMember(ctx, groupID, user.ID)
	if err != nil {
		return false, user, err
	}
	if member == nil || !member.IsActive || member.AcceptedByID == nil {
		return false, user, nil
	}

	return true, user, nil
}

func (uc *ActivityUseCase) Create(ctx context.Context, groupPublicID string, requesterPublicID string, input CreateActivityInput) (*entity.Activity, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	isAdmin, user, err := uc.isGroupAdmin(ctx, group.ID, requesterPublicID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, apperror.ErrForbidden
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, apperror.ErrInvalidInput
	}

	var desc *string
	if input.Description != nil {
		d := strings.TrimSpace(*input.Description)
		if d != "" {
			desc = &d
		}
	}

	activity := &entity.Activity{
		GroupID:       group.ID,
		GroupPublicID: group.PublicID,
		Title:         title,
		Description:   desc,
		DueDate:       input.DueDate,
		CreatedByID:   user.ID,
	}

	if err := uc.activityRepo.Create(ctx, activity); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrActivityTitleTaken
		}
		return nil, err
	}

	return activity, nil
}

func (uc *ActivityUseCase) GetByPublicID(ctx context.Context, activityPublicID string, requesterPublicID string, requesterRole entity.UserRole) (*entity.Activity, []entity.ActivityAttachment, error) {
	activity, err := uc.activityRepo.GetByPublicID(ctx, activityPublicID)
	if err != nil {
		return nil, nil, err
	}
	if activity == nil {
		return nil, nil, apperror.ErrActivityNotFound
	}

	if requesterRole != entity.UserRoleAdmin {
		isMember, _, err := uc.isMember(ctx, activity.GroupID, requesterPublicID)
		if err != nil {
			return nil, nil, err
		}
		if !isMember {
			return nil, nil, apperror.ErrForbidden
		}
	}

	attachments, err := uc.activityRepo.ListAttachments(ctx, activity.ID)
	if err != nil {
		return nil, nil, err
	}

	for i := range attachments {
		attachments[i].URL = uc.storageSvc.GetPublicURL(attachments[i].Key)
	}

	return activity, attachments, nil
}

func (uc *ActivityUseCase) Update(ctx context.Context, activityPublicID string, requesterPublicID string, input UpdateActivityInput) (*entity.Activity, error) {
	activity, err := uc.activityRepo.GetByPublicID(ctx, activityPublicID)
	if err != nil {
		return nil, err
	}
	if activity == nil {
		return nil, apperror.ErrActivityNotFound
	}

	isAdmin, _, err := uc.isGroupAdmin(ctx, activity.GroupID, requesterPublicID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, apperror.ErrForbidden
	}

	if input.Title != nil {
		t := strings.TrimSpace(*input.Title)
		if t == "" {
			return nil, apperror.ErrInvalidInput
		}
		activity.Title = t
	}

	if input.Description != nil {
		d := strings.TrimSpace(*input.Description)
		if d == "" {
			activity.Description = nil
		} else {
			activity.Description = &d
		}
	}

	if input.DueDate != nil {
		activity.DueDate = *input.DueDate
	}

	if err := uc.activityRepo.Update(ctx, activity); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrActivityTitleTaken
		}
		return nil, err
	}

	updated, err := uc.activityRepo.GetByPublicID(ctx, activityPublicID)
	if err != nil {
		return nil, err
	}

	return updated, nil
}

func (uc *ActivityUseCase) Delete(ctx context.Context, activityPublicID string, requesterPublicID string) error {
	activity, err := uc.activityRepo.GetByPublicID(ctx, activityPublicID)
	if err != nil {
		return err
	}
	if activity == nil {
		return apperror.ErrActivityNotFound
	}

	isAdmin, _, err := uc.isGroupAdmin(ctx, activity.GroupID, requesterPublicID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return apperror.ErrForbidden
	}

	return uc.activityRepo.Delete(ctx, activityPublicID)
}

func (uc *ActivityUseCase) ListUpcoming(ctx context.Context, groupPublicID string, requesterPublicID string, requesterRole entity.UserRole, pageNumber, pageSize int, filter repository.ActivityFilter) ([]entity.Activity, int, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return nil, 0, err
	}
	if group == nil {
		return nil, 0, apperror.ErrGroupNotFound
	}

	if requesterRole != entity.UserRoleAdmin {
		isMember, _, err := uc.isMember(ctx, group.ID, requesterPublicID)
		if err != nil {
			return nil, 0, err
		}
		if !isMember {
			return nil, 0, apperror.ErrForbidden
		}
	}

	if pageNumber < 1 {
		pageNumber = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (pageNumber - 1) * pageSize

	activities, err := uc.activityRepo.ListUpcoming(ctx, group.ID, pageSize, offset, filter)
	if err != nil {
		return nil, 0, err
	}

	total, err := uc.activityRepo.CountUpcoming(ctx, group.ID, filter)
	if err != nil {
		return nil, 0, err
	}

	return activities, total, nil
}

func (uc *ActivityUseCase) ListPast(ctx context.Context, groupPublicID string, requesterPublicID string, requesterRole entity.UserRole, pageNumber, pageSize int, filter repository.ActivityFilter) ([]entity.Activity, int, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return nil, 0, err
	}
	if group == nil {
		return nil, 0, apperror.ErrGroupNotFound
	}

	if requesterRole != entity.UserRoleAdmin {
		isMember, _, err := uc.isMember(ctx, group.ID, requesterPublicID)
		if err != nil {
			return nil, 0, err
		}
		if !isMember {
			return nil, 0, apperror.ErrForbidden
		}
	}

	if pageNumber < 1 {
		pageNumber = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (pageNumber - 1) * pageSize

	activities, err := uc.activityRepo.ListPast(ctx, group.ID, pageSize, offset, filter)
	if err != nil {
		return nil, 0, err
	}

	total, err := uc.activityRepo.CountPast(ctx, group.ID, filter)
	if err != nil {
		return nil, 0, err
	}

	return activities, total, nil
}

func (uc *ActivityUseCase) TotalPages(total, pageSize int) int {
	return int(math.Ceil(float64(total) / float64(pageSize)))
}

// ==========================================
// Attachments
// ==========================================

var allowedAttachmentTypes = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/webp":      true,
	"image/gif":       true,
	"application/pdf": true,
}

const maxAttachmentSize = 10 << 20 // 10MB

func (uc *ActivityUseCase) UploadAttachment(ctx context.Context, activityPublicID string, requesterPublicID string, filename string, contentType string, size int64, body io.Reader) (*entity.ActivityAttachment, error) {
	activity, err := uc.activityRepo.GetByPublicID(ctx, activityPublicID)
	if err != nil {
		return nil, err
	}
	if activity == nil {
		return nil, apperror.ErrActivityNotFound
	}

	isAdmin, user, err := uc.isGroupAdmin(ctx, activity.GroupID, requesterPublicID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, apperror.ErrForbidden
	}

	if !allowedAttachmentTypes[contentType] {
		return nil, apperror.ErrInvalidFileType
	}
	if size > maxAttachmentSize {
		return nil, apperror.ErrFileTooLarge
	}

	ext := filepath.Ext(filename)
	key := fmt.Sprintf("activities/%s/%d%s", activityPublicID, time.Now().UnixNano(), ext)

	url, err := uc.storageSvc.Upload(ctx, key, contentType, body)
	if err != nil {
		return nil, apperror.ErrUploadFailed
	}

	attachment := &entity.ActivityAttachment{
		ActivityID:  activity.ID,
		Key:         key,
		Filename:    filename,
		ContentType: contentType,
		SizeBytes:   size,
		URL:         url,
	}

	if err := uc.activityRepo.CreateFile(ctx, attachment, user.ID); err != nil {
		_ = uc.storageSvc.Delete(ctx, key)
		return nil, err
	}

	return attachment, nil
}

func (uc *ActivityUseCase) DeleteAttachment(ctx context.Context, activityPublicID string, filePublicID string, requesterPublicID string) error {
	activity, err := uc.activityRepo.GetByPublicID(ctx, activityPublicID)
	if err != nil {
		return err
	}
	if activity == nil {
		return apperror.ErrActivityNotFound
	}

	isAdmin, _, err := uc.isGroupAdmin(ctx, activity.GroupID, requesterPublicID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return apperror.ErrForbidden
	}

	attachment, err := uc.activityRepo.GetAttachment(ctx, activity.ID, filePublicID)
	if err != nil {
		return err
	}
	if attachment == nil {
		return apperror.ErrAttachmentNotFound
	}

	_ = uc.storageSvc.Delete(ctx, attachment.Key)

	return uc.activityRepo.DeleteFile(ctx, attachment.FileID)
}
