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

type ActivitySubmissionUseCase struct {
	subRepo      repository.ActivitySubmissionRepository
	activityRepo repository.ActivityRepository
	groupRepo    repository.GroupRepository
	userRepo     repository.UserRepository
	qSubRepo     repository.QuestionSubmissionRepository
	storageSvc   service.StorageService
}

func NewActivitySubmissionUseCase(
	subRepo repository.ActivitySubmissionRepository,
	activityRepo repository.ActivityRepository,
	groupRepo repository.GroupRepository,
	userRepo repository.UserRepository,
	qSubRepo repository.QuestionSubmissionRepository,
	storageSvc service.StorageService,
) *ActivitySubmissionUseCase {
	return &ActivitySubmissionUseCase{
		subRepo:      subRepo,
		activityRepo: activityRepo,
		groupRepo:    groupRepo,
		userRepo:     userRepo,
		qSubRepo:     qSubRepo,
		storageSvc:   storageSvc,
	}
}

func (uc *ActivitySubmissionUseCase) isMember(ctx context.Context, groupID int, userID int) (bool, error) {
	member, err := uc.groupRepo.GetMember(ctx, groupID, userID)
	if err != nil {
		return false, err
	}
	if member == nil || !member.IsActive || member.AcceptedByID == nil {
		return false, nil
	}
	return true, nil
}

func (uc *ActivitySubmissionUseCase) isGroupAdmin(ctx context.Context, groupID int, userID int) (bool, error) {
	member, err := uc.groupRepo.GetMember(ctx, groupID, userID)
	if err != nil {
		return false, err
	}
	if member == nil || !member.IsActive || member.AcceptedByID == nil {
		return false, nil
	}
	return member.Role == entity.MemberRoleAdmin, nil
}

func (uc *ActivitySubmissionUseCase) isGroupAdminOrSupervisor(ctx context.Context, groupID int, userID int) (bool, error) {
	member, err := uc.groupRepo.GetMember(ctx, groupID, userID)
	if err != nil {
		return false, err
	}
	if member == nil || !member.IsActive || member.AcceptedByID == nil {
		return false, nil
	}
	return member.Role == entity.MemberRoleAdmin || member.Role == entity.MemberRoleSupervisor, nil
}

type SubmitActivityInput struct {
	ActivityPublicID string
	UserPublicID     string
	Notes            *string
}

func (uc *ActivitySubmissionUseCase) Submit(ctx context.Context, input SubmitActivityInput) (*entity.ActivitySubmission, error) {
	activity, err := uc.activityRepo.GetByPublicID(ctx, input.ActivityPublicID)
	if err != nil {
		return nil, err
	}
	if activity == nil {
		return nil, apperror.ErrActivityNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, input.UserPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	isMember, err := uc.isMember(ctx, activity.GroupID, user.ID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, apperror.ErrForbidden
	}

	// Check if user already submitted
	existing, err := uc.subRepo.GetByActivityAndUser(ctx, activity.ID, user.ID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, apperror.ErrActivityAlreadySubmitted
	}

	var notes *string
	if input.Notes != nil {
		n := strings.TrimSpace(*input.Notes)
		if n != "" {
			notes = &n
		}
	}

	sub := &entity.ActivitySubmission{
		ActivityID: activity.ID,
		UserID:     user.ID,
		Notes:      notes,
		Status:     entity.ActivitySubmissionStatusCreated,
	}

	if err := uc.subRepo.Create(ctx, sub); err != nil {
		return nil, err
	}

	full, err := uc.subRepo.GetByPublicID(ctx, sub.PublicID)
	if err != nil {
		return nil, err
	}
	return full, nil
}

func (uc *ActivitySubmissionUseCase) GetByPublicID(ctx context.Context, publicID string, requesterPublicID string) (*entity.ActivitySubmission, error) {
	sub, err := uc.subRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, apperror.ErrActivitySubmissionNotFound
	}
	return sub, nil
}

func (uc *ActivitySubmissionUseCase) GetMySubmission(ctx context.Context, activityPublicID, userPublicID string) (*entity.ActivitySubmission, error) {
	activity, err := uc.activityRepo.GetByPublicID(ctx, activityPublicID)
	if err != nil {
		return nil, err
	}
	if activity == nil {
		return nil, apperror.ErrActivityNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	sub, err := uc.subRepo.GetByActivityAndUser(ctx, activity.ID, user.ID)
	if err != nil {
		return nil, err
	}
	// sub can be nil — that's fine, means not submitted yet
	return sub, nil
}

// GetOrCreateSubmission returns the existing submission for the user on the activity,
// or creates a new one if none exists. Used when linking question submissions to an activity.
func (uc *ActivitySubmissionUseCase) GetOrCreateSubmission(ctx context.Context, activityPublicID, userPublicID string) (*entity.ActivitySubmission, error) {
	activity, err := uc.activityRepo.GetByPublicID(ctx, activityPublicID)
	if err != nil {
		return nil, err
	}
	if activity == nil {
		return nil, apperror.ErrActivityNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	isMember, err := uc.isMember(ctx, activity.GroupID, user.ID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, apperror.ErrForbidden
	}

	existing, err := uc.subRepo.GetByActivityAndUser(ctx, activity.ID, user.ID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	sub := &entity.ActivitySubmission{
		ActivityID: activity.ID,
		UserID:     user.ID,
		Status:     entity.ActivitySubmissionStatusCreated,
	}
	if err := uc.subRepo.Create(ctx, sub); err != nil {
		return nil, err
	}

	full, err := uc.subRepo.GetByPublicID(ctx, sub.PublicID)
	if err != nil {
		return nil, err
	}
	return full, nil
}

func (uc *ActivitySubmissionUseCase) ListByActivity(ctx context.Context, activityPublicID, requesterPublicID string, requesterRole entity.UserRole, page, size int) ([]entity.ActivitySubmission, int, error) {
	activity, err := uc.activityRepo.GetByPublicID(ctx, activityPublicID)
	if err != nil {
		return nil, 0, err
	}
	if activity == nil {
		return nil, 0, apperror.ErrActivityNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, requesterPublicID)
	if err != nil {
		return nil, 0, err
	}
	if user == nil {
		return nil, 0, apperror.ErrUserNotFound
	}

	// Only group admins/supervisors or platform admins can list all submissions
	if requesterRole != entity.UserRoleAdmin {
		isAuth, err := uc.isGroupAdminOrSupervisor(ctx, activity.GroupID, user.ID)
		if err != nil {
			return nil, 0, err
		}
		if !isAuth {
			return nil, 0, apperror.ErrForbidden
		}
	}

	total, err := uc.subRepo.CountByActivity(ctx, activity.ID)
	if err != nil {
		return nil, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(size)))
	if page > totalPages && totalPages > 0 {
		page = totalPages
	}
	offset := (page - 1) * size

	subs, err := uc.subRepo.ListByActivity(ctx, activity.ID, size, offset)
	if err != nil {
		return nil, 0, err
	}

	return subs, total, nil
}

type ReviewActivitySubmissionInput struct {
	SubmissionPublicID string
	ReviewerPublicID   string
	ReviewerRole       entity.UserRole
	Status             entity.ActivitySubmissionStatus
	FeedbackNotes      *string
}

func (uc *ActivitySubmissionUseCase) Review(ctx context.Context, input ReviewActivitySubmissionInput) (*entity.ActivitySubmission, error) {
	if input.Status != entity.ActivitySubmissionStatusApproved && input.Status != entity.ActivitySubmissionStatusReproved {
		return nil, apperror.ErrInvalidInput
	}

	sub, err := uc.subRepo.GetByPublicID(ctx, input.SubmissionPublicID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, apperror.ErrActivitySubmissionNotFound
	}

	reviewer, err := uc.userRepo.GetByPublicID(ctx, input.ReviewerPublicID)
	if err != nil {
		return nil, err
	}
	if reviewer == nil {
		return nil, apperror.ErrUserNotFound
	}

	// Get the activity to check group admin
	activity, err := uc.activityRepo.GetByID(ctx, sub.ActivityID)
	if err != nil {
		return nil, err
	}
	if activity == nil {
		return nil, apperror.ErrActivityNotFound
	}

	if input.ReviewerRole != entity.UserRoleAdmin {
		isAdmin, err := uc.isGroupAdmin(ctx, activity.GroupID, reviewer.ID)
		if err != nil {
			return nil, err
		}
		if !isAdmin {
			return nil, apperror.ErrForbidden
		}
	}

	var feedback *string
	if input.FeedbackNotes != nil {
		f := strings.TrimSpace(*input.FeedbackNotes)
		if f != "" {
			feedback = &f
		}
	}

	sub.Status = input.Status
	sub.FeedbackNotes = feedback
	sub.ReviewedByID = &reviewer.ID

	if err := uc.subRepo.UpdateStatus(ctx, sub); err != nil {
		return nil, err
	}

	full, err := uc.subRepo.GetByPublicID(ctx, sub.PublicID)
	if err != nil {
		return nil, err
	}
	return full, nil
}

func (uc *ActivitySubmissionUseCase) ListMySubmissions(ctx context.Context, userPublicID string, page, size int) ([]entity.ActivitySubmission, int, error) {
	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, 0, err
	}
	if user == nil {
		return nil, 0, apperror.ErrUserNotFound
	}

	total, err := uc.subRepo.CountByUser(ctx, user.ID)
	if err != nil {
		return nil, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(size)))
	if page > totalPages && totalPages > 0 {
		page = totalPages
	}
	offset := (page - 1) * size

	subs, err := uc.subRepo.ListByUser(ctx, user.ID, size, offset)
	if err != nil {
		return nil, 0, err
	}

	return subs, total, nil
}

func (uc *ActivitySubmissionUseCase) SendSubmission(ctx context.Context, submissionPublicID, userPublicID string) (*entity.ActivitySubmission, error) {
	sub, err := uc.subRepo.GetByPublicID(ctx, submissionPublicID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, apperror.ErrActivitySubmissionNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	if sub.UserID != user.ID {
		return nil, apperror.ErrForbidden
	}

	// Allow sending/resending from any status.
	sub.Status = entity.ActivitySubmissionStatusPending

	if err := uc.subRepo.UpdateStatus(ctx, sub); err != nil {
		return nil, err
	}

	full, err := uc.subRepo.GetByPublicID(ctx, sub.PublicID)
	if err != nil {
		return nil, err
	}
	return full, nil
}

// ==========================================
// Update Notes (owner only, while pending)
// ==========================================

func (uc *ActivitySubmissionUseCase) UpdateNotes(ctx context.Context, submissionPublicID, userPublicID string, notes *string) (*entity.ActivitySubmission, error) {
	sub, err := uc.subRepo.GetByPublicID(ctx, submissionPublicID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, apperror.ErrActivitySubmissionNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	if sub.UserID != user.ID {
		return nil, apperror.ErrForbidden
	}

	// No status restrictions.

	var trimmed *string
	if notes != nil {
		n := strings.TrimSpace(*notes)
		if n != "" {
			trimmed = &n
		}
	}

	if err := uc.subRepo.UpdateNotes(ctx, sub.ID, trimmed); err != nil {
		return nil, err
	}

	full, err := uc.subRepo.GetByPublicID(ctx, sub.PublicID)
	if err != nil {
		return nil, err
	}
	return full, nil
}

// ==========================================
// Resubmit (owner, while reproved)
// ==========================================

func (uc *ActivitySubmissionUseCase) Resubmit(ctx context.Context, submissionPublicID, userPublicID string) (*entity.ActivitySubmission, error) {
	sub, err := uc.subRepo.GetByPublicID(ctx, submissionPublicID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, apperror.ErrActivitySubmissionNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	if sub.UserID != user.ID {
		return nil, apperror.ErrForbidden
	}

	// No status restrictions for resubmitting.

	sub.Status = entity.ActivitySubmissionStatusPending
	sub.FeedbackNotes = nil
	sub.ReviewedByID = nil

	if err := uc.subRepo.UpdateStatus(ctx, sub); err != nil {
		return nil, err
	}

	full, err := uc.subRepo.GetByPublicID(ctx, sub.PublicID)
	if err != nil {
		return nil, err
	}
	return full, nil
}

// ==========================================
// Question Status per Activity
// ==========================================

type QuestionStatus struct {
	QuestionPublicID string
	Passed           bool
	Attempts         int
	LastScore        *int
}

func (uc *ActivitySubmissionUseCase) GetQuestionStatuses(ctx context.Context, activityPublicID, userPublicID string) ([]QuestionStatus, error) {
	activity, err := uc.activityRepo.GetByPublicID(ctx, activityPublicID)
	if err != nil {
		return nil, err
	}
	if activity == nil {
		return nil, apperror.ErrActivityNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	sub, err := uc.subRepo.GetByActivityAndUser(ctx, activity.ID, user.ID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, nil
	}

	qSubs, err := uc.qSubRepo.ListByActivitySubmission(ctx, sub.ID)
	if err != nil {
		return nil, err
	}

	type info struct {
		questionPublicID string
		passed           bool
		attempts         int
		lastScore        *int
	}
	byQuestion := make(map[int]*info)
	for _, qs := range qSubs {
		i, ok := byQuestion[qs.QuestionID]
		if !ok {
			i = &info{questionPublicID: qs.QuestionPublicID}
			byQuestion[qs.QuestionID] = i
		}
		i.attempts++
		if qs.Passed {
			i.passed = true
		}
		if i.lastScore == nil && qs.Score != nil {
			i.lastScore = qs.Score
		}
	}

	result := make([]QuestionStatus, 0, len(byQuestion))
	for _, i := range byQuestion {
		result = append(result, QuestionStatus{
			QuestionPublicID: i.questionPublicID,
			Passed:           i.passed,
			Attempts:         i.attempts,
			LastScore:        i.lastScore,
		})
	}
	return result, nil
}

// ==========================================
// Submission Attachments
// ==========================================

var allowedSubmissionAttachmentTypes = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/webp":      true,
	"image/gif":       true,
	"application/pdf": true,
}

const maxSubmissionAttachmentSize = 10 * 1024 * 1024 // 10 MB

func (uc *ActivitySubmissionUseCase) UploadAttachment(ctx context.Context, submissionPublicID, userPublicID, filename, contentType string, size int64, body io.Reader) (*entity.ActivitySubmissionAttachment, error) {
	sub, err := uc.subRepo.GetByPublicID(ctx, submissionPublicID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, apperror.ErrActivitySubmissionNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	if sub.UserID != user.ID {
		return nil, apperror.ErrForbidden
	}
	// No status restrictions for attachments.

	if !allowedSubmissionAttachmentTypes[contentType] {
		return nil, apperror.ErrInvalidFileType
	}
	if size > maxSubmissionAttachmentSize {
		return nil, apperror.ErrFileTooLarge
	}

	ext := filepath.Ext(filename)
	key := fmt.Sprintf("activity-submissions/%s%s", newUUID(), ext)

	url, err := uc.storageSvc.Upload(ctx, key, contentType, body)
	if err != nil {
		return nil, apperror.ErrUploadFailed
	}

	attachment := &entity.ActivitySubmissionAttachment{
		SubmissionID: sub.ID,
		Key:          key,
		Filename:     filename,
		ContentType:  contentType,
		SizeBytes:    size,
		URL:          url,
	}

	if err := uc.subRepo.CreateFile(ctx, attachment, user.ID); err != nil {
		_ = uc.storageSvc.Delete(ctx, key)
		return nil, err
	}

	return attachment, nil
}

func (uc *ActivitySubmissionUseCase) DeleteAttachment(ctx context.Context, submissionPublicID, filePublicID, userPublicID string) error {
	sub, err := uc.subRepo.GetByPublicID(ctx, submissionPublicID)
	if err != nil {
		return err
	}
	if sub == nil {
		return apperror.ErrActivitySubmissionNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return err
	}
	if user == nil {
		return apperror.ErrUserNotFound
	}

	if sub.UserID != user.ID {
		return apperror.ErrForbidden
	}
	// No status restrictions for attachments.

	attachment, err := uc.subRepo.GetAttachment(ctx, sub.ID, filePublicID)
	if err != nil {
		return err
	}
	if attachment == nil {
		return apperror.ErrAttachmentNotFound
	}

	_ = uc.storageSvc.Delete(ctx, attachment.Key)
	return uc.subRepo.DeleteFile(ctx, attachment.FileID)
}

// ==========================================
// Question Attempts for a Submission (admin)
// ==========================================

func (uc *ActivitySubmissionUseCase) GetSubmissionQuestionAttempts(ctx context.Context, submissionPublicID, requesterPublicID string, requesterRole entity.UserRole) ([]entity.QuestionSubmission, error) {
	sub, err := uc.subRepo.GetByPublicID(ctx, submissionPublicID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, apperror.ErrActivitySubmissionNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, requesterPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	// Allow if platform admin, group admin, or supervisor
	if requesterRole != entity.UserRoleAdmin {
		activity, err := uc.activityRepo.GetByID(ctx, sub.ActivityID)
		if err != nil {
			return nil, err
		}
		if activity == nil {
			return nil, apperror.ErrActivityNotFound
		}
		isAuth, err := uc.isGroupAdminOrSupervisor(ctx, activity.GroupID, user.ID)
		if err != nil {
			return nil, err
		}
		if !isAuth {
			return nil, apperror.ErrForbidden
		}
	}

	return uc.qSubRepo.ListByActivitySubmission(ctx, sub.ID)
}

func (uc *ActivitySubmissionUseCase) ListAttachments(ctx context.Context, submissionPublicID, userPublicID string) ([]entity.ActivitySubmissionAttachment, error) {
	sub, err := uc.subRepo.GetByPublicID(ctx, submissionPublicID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, apperror.ErrActivitySubmissionNotFound
	}

	attachments, err := uc.subRepo.ListAttachments(ctx, sub.ID)
	if err != nil {
		return nil, err
	}

	for i := range attachments {
		attachments[i].URL = uc.storageSvc.GetPublicURL(attachments[i].Key)
	}

	return attachments, nil
}
