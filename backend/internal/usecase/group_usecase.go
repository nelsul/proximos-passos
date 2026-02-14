package usecase

import (
	"context"
	"errors"
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

func (uc *GroupUseCase) GetByPublicID(ctx context.Context, publicID string, userPublicID string, userRole entity.UserRole) (*entity.Group, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	if userRole != entity.UserRoleAdmin && group.VisibilityType == entity.GroupVisibilityPrivate {
		// Allow access if the user is a member of the group
		user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
		if err != nil {
			return nil, err
		}
		if user == nil {
			return nil, apperror.ErrGroupNotFound
		}
		member, err := uc.groupRepo.GetMember(ctx, group.ID, user.ID)
		if err != nil {
			return nil, err
		}
		if member == nil || member.AcceptedByID == nil {
			return nil, apperror.ErrGroupNotFound
		}
	}

	return group, nil
}

func (uc *GroupUseCase) GetPreview(ctx context.Context, publicID string) (*entity.Group, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	return group, nil
}

func (uc *GroupUseCase) List(ctx context.Context, pageNumber, pageSize int, userRole entity.UserRole, filter repository.GroupFilter) ([]entity.Group, int, error) {
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
		groups, err = uc.groupRepo.List(ctx, pageSize, offset, filter)
		if err != nil {
			return nil, 0, err
		}
		total, err = uc.groupRepo.Count(ctx, filter)
	} else {
		groups, err = uc.groupRepo.ListPublic(ctx, pageSize, offset, filter)
		if err != nil {
			return nil, 0, err
		}
		total, err = uc.groupRepo.CountPublic(ctx, filter)
	}
	if err != nil {
		return nil, 0, err
	}

	return groups, total, nil
}

func (uc *GroupUseCase) ListMyGroups(ctx context.Context, userPublicID string, pageNumber, pageSize int, filter repository.GroupFilter) ([]entity.Group, int, error) {
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

	groups, err := uc.groupRepo.ListByUser(ctx, user.ID, pageSize, offset, filter)
	if err != nil {
		return nil, 0, err
	}

	total, err := uc.groupRepo.CountByUser(ctx, user.ID, filter)
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

func (uc *GroupUseCase) JoinGroup(ctx context.Context, groupPublicID string, userPublicID string) (*entity.GroupMember, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	var acceptedByID *int
	if group.AccessType == entity.GroupAccessOpen {
		// Auto-accept: find the first admin of the group
		admin, err := uc.groupRepo.GetFirstAdminMember(ctx, group.ID)
		if err != nil {
			return nil, err
		}
		if admin != nil {
			acceptedByID = &admin.UserID
		} else {
			// Fallback: accept by self if no admin exists
			acceptedByID = &user.ID
		}
	}
	// For closed groups, acceptedByID stays nil → pending request

	member := &entity.GroupMember{
		GroupID:      group.ID,
		UserID:       user.ID,
		Role:         entity.MemberRoleMember,
		AcceptedByID: acceptedByID,
		IsActive:     true,
		CreatedByID:  user.ID,
	}

	if err := uc.groupRepo.AddMember(ctx, member); err != nil {
		// If member record exists (was previously rejected/removed), reactivate it
		if errors.Is(err, apperror.ErrMemberAlreadyExists) {
			if reactivateErr := uc.groupRepo.ReactivateMember(ctx, group.ID, user.ID, acceptedByID); reactivateErr != nil {
				return nil, reactivateErr
			}
			return member, nil
		}
		return nil, err
	}

	return member, nil
}

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

func (uc *GroupUseCase) ListMembers(ctx context.Context, groupPublicID string, requesterPublicID string, requesterRole entity.UserRole, pageNumber, pageSize int, role string) ([]entity.GroupMember, int, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return nil, 0, err
	}
	if group == nil {
		return nil, 0, apperror.ErrGroupNotFound
	}

	// System admins can list any group's members.
	// For publicly visible groups, any authenticated user can view members.
	// When requesting only admins, allow access (for join page preview).
	// For private groups, the requester must be an active member to see all members.
	if requesterRole != entity.UserRoleAdmin && group.VisibilityType != entity.GroupVisibilityPublic && role != string(entity.MemberRoleAdmin) {
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

	members, err := uc.groupRepo.ListMembers(ctx, group.ID, pageSize, offset, role)
	if err != nil {
		return nil, 0, err
	}

	total, err := uc.groupRepo.CountMembers(ctx, group.ID, role)
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

func (uc *GroupUseCase) CheckMembership(ctx context.Context, groupPublicID string, userPublicID string) (string, string, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return "", "", err
	}
	if group == nil {
		return "", "", apperror.ErrGroupNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return "", "", err
	}
	if user == nil {
		return "", "", apperror.ErrUserNotFound
	}

	member, err := uc.groupRepo.GetMember(ctx, group.ID, user.ID)
	if err != nil {
		return "", "", err
	}
	if member == nil {
		return "none", "", nil
	}
	if member.AcceptedByID == nil {
		return "pending", string(member.Role), nil
	}
	return "member", string(member.Role), nil
}

// isGroupAdmin checks whether the given user is an active admin member of the group.
func (uc *GroupUseCase) isGroupAdmin(ctx context.Context, groupID int, userPublicID string) (bool, *entity.User, error) {
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

func (uc *GroupUseCase) UpdateAsGroupAdmin(ctx context.Context, publicID string, requesterPublicID string, input UpdateGroupInput) (*entity.Group, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	isAdmin, _, err := uc.isGroupAdmin(ctx, group.ID, requesterPublicID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, apperror.ErrForbidden
	}

	return uc.Update(ctx, publicID, input)
}

func (uc *GroupUseCase) UploadThumbnailAsGroupAdmin(ctx context.Context, publicID string, requesterPublicID string, filename string, contentType string, size int64, body io.Reader) (*entity.Group, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	isAdmin, _, err := uc.isGroupAdmin(ctx, group.ID, requesterPublicID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, apperror.ErrForbidden
	}

	return uc.UploadThumbnail(ctx, publicID, filename, contentType, size, body)
}

func (uc *GroupUseCase) DeleteThumbnailAsGroupAdmin(ctx context.Context, publicID string, requesterPublicID string) (*entity.Group, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if group == nil {
		return nil, apperror.ErrGroupNotFound
	}

	isAdmin, _, err := uc.isGroupAdmin(ctx, group.ID, requesterPublicID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, apperror.ErrForbidden
	}

	return uc.DeleteThumbnail(ctx, publicID)
}

func (uc *GroupUseCase) ListPendingMembers(ctx context.Context, groupPublicID string, requesterPublicID string, pageNumber, pageSize int) ([]entity.GroupMember, int, error) {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return nil, 0, err
	}
	if group == nil {
		return nil, 0, apperror.ErrGroupNotFound
	}

	isAdmin, _, err := uc.isGroupAdmin(ctx, group.ID, requesterPublicID)
	if err != nil {
		return nil, 0, err
	}
	if !isAdmin {
		return nil, 0, apperror.ErrForbidden
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

	members, err := uc.groupRepo.ListPendingMembers(ctx, group.ID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}

	total, err := uc.groupRepo.CountPendingMembers(ctx, group.ID)
	if err != nil {
		return nil, 0, err
	}

	return members, total, nil
}

func (uc *GroupUseCase) ApproveMember(ctx context.Context, groupPublicID, userPublicID, approverPublicID string) error {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return err
	}
	if group == nil {
		return apperror.ErrGroupNotFound
	}

	isAdmin, approver, err := uc.isGroupAdmin(ctx, group.ID, approverPublicID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return apperror.ErrForbidden
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return err
	}
	if user == nil {
		return apperror.ErrUserNotFound
	}

	return uc.groupRepo.ApproveMember(ctx, group.ID, user.ID, approver.ID)
}

func (uc *GroupUseCase) RejectMember(ctx context.Context, groupPublicID, userPublicID, requesterPublicID string) error {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return err
	}
	if group == nil {
		return apperror.ErrGroupNotFound
	}

	isAdmin, _, err := uc.isGroupAdmin(ctx, group.ID, requesterPublicID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return apperror.ErrForbidden
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

func (uc *GroupUseCase) RemoveMemberAsGroupAdmin(ctx context.Context, groupPublicID, userPublicID, requesterPublicID string) error {
	group, err := uc.groupRepo.GetByPublicID(ctx, groupPublicID)
	if err != nil {
		return err
	}
	if group == nil {
		return apperror.ErrGroupNotFound
	}

	isAdmin, _, err := uc.isGroupAdmin(ctx, group.ID, requesterPublicID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return apperror.ErrForbidden
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
