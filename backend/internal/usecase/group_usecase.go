package usecase

import (
	"context"
	"fmt"
	"io"
	"path"
	"strings"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/domain/service"
)

const maxThumbnailSize = 5 << 20 // 5MB

var allowedThumbnailTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

type GroupUseCase struct {
	groupRepo  repository.GroupRepository
	userRepo   repository.UserRepository
	storageSvc service.StorageService
}

func NewGroupUseCase(groupRepo repository.GroupRepository, userRepo repository.UserRepository, storageSvc service.StorageService) *GroupUseCase {
	return &GroupUseCase{
		groupRepo:  groupRepo,
		userRepo:   userRepo,
		storageSvc: storageSvc,
	}
}

// ==========================================
// Group Inputs
// ==========================================

type CreateGroupInput struct {
	Name            string
	Description     *string
	AccessType      entity.GroupAccessType
	VisibilityType  entity.GroupVisibilityType
	CreatorPublicID string
}

type UpdateGroupInput struct {
	Name           *string
	Description    *string
	AccessType     *entity.GroupAccessType
	VisibilityType *entity.GroupVisibilityType
}

// ==========================================
// Member Inputs
// ==========================================

type AddMemberInput struct {
	UserPublicID    string
	Role            entity.MemberRole
	CreatorPublicID string
}

type UpdateMemberRoleInput struct {
	Role entity.MemberRole
}

// ==========================================
// Group Operations
// ==========================================

func (uc *GroupUseCase) Create(ctx context.Context, input CreateGroupInput) (*entity.Group, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, apperror.ErrInvalidInput
	}

	creator, err := uc.userRepo.GetByPublicID(ctx, input.CreatorPublicID)
	if err != nil {
		return nil, err
	}
	if creator == nil {
		return nil, apperror.ErrUserNotFound
	}

	accessType := input.AccessType
	if accessType == "" {
		accessType = entity.GroupAccessClosed
	}

	visibilityType := input.VisibilityType
	if visibilityType == "" {
		visibilityType = entity.GroupVisibilityPrivate
	}

	var description *string
	if input.Description != nil {
		trimmed := strings.TrimSpace(*input.Description)
		if trimmed != "" {
			description = &trimmed
		}
	}

	group := &entity.Group{
		Name:           name,
		Description:    description,
		AccessType:     accessType,
		VisibilityType: visibilityType,
		CreatedByID:    creator.ID,
	}

	if err := uc.groupRepo.Create(ctx, group); err != nil {
		return nil, err
	}

	acceptedByID := creator.ID
	member := &entity.GroupMember{
		GroupID:      group.ID,
		UserID:       creator.ID,
		Role:         entity.MemberRoleAdmin,
		AcceptedByID: &acceptedByID,
		IsActive:     true,
		CreatedByID:  creator.ID,
	}

	if err := uc.groupRepo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	return group, nil
}

func (uc *GroupUseCase) GetByPublicID(ctx context.Context, publicID string, userRole entity.UserRole) (*entity.Group, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	if userRole != entity.UserRoleAdmin && group.VisibilityType == entity.GroupVisibilityPrivate {
		return nil, apperror.ErrGroupNotFound
	}

	return group, nil
}

func (uc *GroupUseCase) List(ctx context.Context, pageNumber, pageSize int, userRole entity.UserRole) ([]entity.Group, int, error) {
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	if pageNumber < 1 {
		pageNumber = 1
	}

	offset := (pageNumber - 1) * pageSize

	var groups []entity.Group
	var total int
	var err error

	if userRole == entity.UserRoleAdmin {
		groups, err = uc.groupRepo.List(ctx, pageSize, offset)
		if err != nil {
			return nil, 0, err
		}
		total, err = uc.groupRepo.Count(ctx)
	} else {
		groups, err = uc.groupRepo.ListPublic(ctx, pageSize, offset)
		if err != nil {
			return nil, 0, err
		}
		total, err = uc.groupRepo.CountPublic(ctx)
	}
	if err != nil {
		return nil, 0, err
	}

	return groups, total, nil
}

func (uc *GroupUseCase) ListMyGroups(ctx context.Context, userPublicID string, pageNumber, pageSize int) ([]entity.Group, int, error) {
	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, 0, err
	}
	if user == nil {
		return nil, 0, apperror.ErrUserNotFound
	}

	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	if pageNumber < 1 {
		pageNumber = 1
	}

	offset := (pageNumber - 1) * pageSize

	groups, err := uc.groupRepo.ListByUser(ctx, user.ID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}

	total, err := uc.groupRepo.CountByUser(ctx, user.ID)
	if err != nil {
		return nil, 0, err
	}

	return groups, total, nil
}

func (uc *GroupUseCase) Update(ctx context.Context, publicID string, input UpdateGroupInput) (*entity.Group, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, apperror.ErrInvalidInput
		}
		group.Name = name
	}

	if input.Description != nil {
		trimmed := strings.TrimSpace(*input.Description)
		if trimmed == "" {
			group.Description = nil
		} else {
			group.Description = &trimmed
		}
	}

	if input.AccessType != nil {
		group.AccessType = *input.AccessType
	}

	if input.VisibilityType != nil {
		group.VisibilityType = *input.VisibilityType
	}

	if err := uc.groupRepo.Update(ctx, group); err != nil {
		return nil, err
	}

	return group, nil
}

func (uc *GroupUseCase) Delete(ctx context.Context, publicID string) error {
	group, err := uc.groupRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return err
	}
	if group == nil {
		return apperror.ErrGroupNotFound
	}

	return uc.groupRepo.Delete(ctx, publicID)
}

func (uc *GroupUseCase) UploadThumbnail(ctx context.Context, publicID string, filename string, contentType string, size int64, body io.Reader) (*entity.Group, error) {
	if size > maxThumbnailSize {
		return nil, apperror.ErrFileTooLarge
	}

	if !allowedThumbnailTypes[contentType] {
		return nil, apperror.ErrInvalidFileType
	}

	group, err := uc.groupRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	if group.ThumbnailURL != nil {
		oldKey := extractThumbnailKeyFromURL(*group.ThumbnailURL)
		if oldKey != "" {
			_ = uc.storageSvc.Delete(ctx, oldKey)
		}
	}

	ext := path.Ext(filename)
	key := fmt.Sprintf("thumbnails/groups/%s%s", publicID, ext)

	url, err := uc.storageSvc.Upload(ctx, key, contentType, body)
	if err != nil {
		return nil, apperror.ErrUploadFailed
	}

	if err := uc.groupRepo.UpdateThumbnail(ctx, publicID, &url); err != nil {
		return nil, err
	}

	group.ThumbnailURL = &url
	return group, nil
}

func (uc *GroupUseCase) DeleteThumbnail(ctx context.Context, publicID string) (*entity.Group, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	if group.ThumbnailURL != nil {
		oldKey := extractThumbnailKeyFromURL(*group.ThumbnailURL)
		if oldKey != "" {
			_ = uc.storageSvc.Delete(ctx, oldKey)
		}
	}

	if err := uc.groupRepo.UpdateThumbnail(ctx, publicID, nil); err != nil {
		return nil, err
	}

	group.ThumbnailURL = nil
	return group, nil
}

func extractThumbnailKeyFromURL(url string) string {
	parts := strings.SplitN(url, "/", 4)
	if len(parts) >= 4 {
		return parts[3]
	}
	return ""
}

// ==========================================
// Member Operations
// ==========================================

func (uc *GroupUseCase) AddMember(ctx context.Context, groupPublicID string, input AddMemberInput) (*entity.GroupMember, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, input.UserPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	creator, err := uc.userRepo.GetByPublicID(ctx, input.CreatorPublicID)
	if err != nil {
		return nil, err
	}
	if creator == nil {
		return nil, apperror.ErrUserNotFound
	}

	role := input.Role
	if role == "" {
		role = entity.MemberRoleMember
	}

	var acceptedByID *int
	if group.AccessType == entity.GroupAccessOpen {
		acceptedByID = &creator.ID
	} else if creator.Role == entity.UserRoleAdmin {
		acceptedByID = &creator.ID
	}

	member := &entity.GroupMember{
		GroupID:      group.ID,
		UserID:       user.ID,
		Role:         role,
		AcceptedByID: acceptedByID,
		IsActive:     true,
		CreatedByID:  creator.ID,
	}

	if err := uc.groupRepo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	return member, nil
}

func (uc *GroupUseCase) ListMembers(ctx context.Context, groupPublicID string, requesterPublicID string, requesterRole entity.UserRole, pageNumber, pageSize int) ([]entity.GroupMember, int, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return nil, 0, err
	}
	if group == nil {
		return nil, 0, apperror.ErrGroupNotFound
	}

	// System admins can list any group's members; regular users must be active members
	if requesterRole != entity.UserRoleAdmin {
		requester, err := uc.userRepo.GetByPublicID(ctx, requesterPublicID)
		if err != nil {
			return nil, 0, err
		}
		if requester == nil {
			return nil, 0, apperror.ErrUnauthorized
		}

		member, err := uc.groupRepo.GetMember(ctx, group.ID, requester.ID)
		if err != nil {
			return nil, 0, err
		}
		if member == nil {
			return nil, 0, apperror.ErrForbidden
		}
	}

	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	if pageNumber < 1 {
		pageNumber = 1
	}

	offset := (pageNumber - 1) * pageSize

	members, err := uc.groupRepo.ListMembers(ctx, group.ID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}

	total, err := uc.groupRepo.CountMembers(ctx, group.ID)
	if err != nil {
		return nil, 0, err
	}

	return members, total, nil
}

func (uc *GroupUseCase) UpdateMemberRole(ctx context.Context, groupPublicID, userPublicID string, input UpdateMemberRoleInput) error {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return err
	}
	if group == nil {
		return apperror.ErrGroupNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return err
	}
	if user == nil {
		return apperror.ErrUserNotFound
	}

	return uc.groupRepo.UpdateMemberRole(ctx, group.ID, user.ID, input.Role)
}

func (uc *GroupUseCase) RemoveMember(ctx context.Context, groupPublicID, userPublicID string) error {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return err
	}
	if group == nil {
		return apperror.ErrGroupNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return err
	}
	if user == nil {
		return apperror.ErrUserNotFound
	}

	return uc.groupRepo.RemoveMember(ctx, group.ID, user.ID)
}

func (uc *GroupUseCase) GetUserByPublicID(ctx context.Context, publicID string) (*entity.User, error) {
	return uc.userRepo.GetByPublicID(ctx, publicID)
}
