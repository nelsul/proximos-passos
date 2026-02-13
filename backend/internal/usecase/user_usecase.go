package usecase

import (
	"context"
	"fmt"
	"io"
	"log"
	"path"
	"strings"
	"time"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/domain/service"
	"proximos-passos/backend/internal/infrastructure/jwt"

	"golang.org/x/crypto/bcrypt"
)

const maxAvatarSize = 5 << 20 // 5MB

var allowedAvatarTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

type UserUseCase struct {
	repo        repository.UserRepository
	emailSvc    service.EmailService
	storageSvc  service.StorageService
	jwtService  *jwt.Service
	frontendURL string
}

func NewUserUseCase(repo repository.UserRepository, emailSvc service.EmailService, storageSvc service.StorageService, jwtService *jwt.Service, frontendURL string) *UserUseCase {
	return &UserUseCase{
		repo:        repo,
		emailSvc:    emailSvc,
		storageSvc:  storageSvc,
		jwtService:  jwtService,
		frontendURL: frontendURL,
	}
}

type SetupAdminInput struct {
	Name     string
	Email    string
	Password string
}

type CreateUserInput struct {
	Name     string
	Email    string
	Password string
	Role     entity.UserRole
}

type UpdateUserInput struct {
	Name      *string
	Email     *string
	AvatarURL *string
	Role      *entity.UserRole
}

func (uc *UserUseCase) SetupAdmin(ctx context.Context, input SetupAdminInput) (*entity.User, error) {
	count, err := uc.repo.Count(ctx)
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, apperror.ErrSetupUnavailable
	}

	return uc.Create(ctx, CreateUserInput{
		Name:     input.Name,
		Email:    input.Email,
		Password: input.Password,
		Role:     entity.UserRoleAdmin,
	})
}

func (uc *UserUseCase) Create(ctx context.Context, input CreateUserInput) (*entity.User, error) {
	name := strings.TrimSpace(input.Name)
	email := strings.TrimSpace(input.Email)
	password := strings.TrimSpace(input.Password)

	if name == "" || email == "" || password == "" {
		return nil, apperror.ErrInvalidInput
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	role := input.Role
	if role == "" {
		role = entity.UserRoleRegular
	}

	user := &entity.User{
		Name:         name,
		Email:        email,
		PasswordHash: string(hash),
		Role:         role,
		IsActive:     true,
	}

	if err := uc.repo.Create(ctx, user); err != nil {
		return nil, err
	}

	go uc.sendVerificationEmail(user)

	return user, nil
}

func (uc *UserUseCase) sendVerificationEmail(user *entity.User) {
	token, err := uc.jwtService.GenerateVerificationToken(user.PublicID, 24*time.Hour)
	if err != nil {
		log.Printf("failed to generate verification token for user %s: %v", user.PublicID, err)
		return
	}

	verificationURL := fmt.Sprintf("%s/pt-BR/verify-email?token=%s", uc.frontendURL, token)

	if err := uc.emailSvc.SendVerificationEmail(context.Background(), user.Email, user.Name, verificationURL); err != nil {
		log.Printf("failed to send verification email to %s: %v", user.Email, err)
	}
}

func (uc *UserUseCase) VerifyEmail(ctx context.Context, token string) error {
	claims, err := uc.jwtService.ParseVerificationToken(token)
	if err != nil {
		return apperror.ErrInvalidToken
	}

	return uc.repo.VerifyEmail(ctx, claims.UserPublicID)
}

func (uc *UserUseCase) ResendVerificationEmail(ctx context.Context, publicID string) error {
	user, err := uc.repo.GetByPublicID(ctx, publicID)
	if err != nil {
		return err
	}
	if user == nil {
		return apperror.ErrUserNotFound
	}
	if user.EmailVerifiedAt != nil {
		return apperror.ErrEmailAlreadyVerified
	}

	token, err := uc.jwtService.GenerateVerificationToken(user.PublicID, 24*time.Hour)
	if err != nil {
		return err
	}

	verificationURL := fmt.Sprintf("%s/pt-BR/verify-email?token=%s", uc.frontendURL, token)

	if err := uc.emailSvc.SendVerificationEmail(ctx, user.Email, user.Name, verificationURL); err != nil {
		return apperror.ErrEmailSendFailed
	}

	return nil
}

func (uc *UserUseCase) GetByPublicID(ctx context.Context, publicID string) (*entity.User, error) {
	user, err := uc.repo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}
	return user, nil
}

func (uc *UserUseCase) List(ctx context.Context, pageNumber, pageSize int) ([]entity.User, int, error) {
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

	users, err := uc.repo.List(ctx, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}

	total, err := uc.repo.Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

func (uc *UserUseCase) Update(ctx context.Context, publicID string, input UpdateUserInput) (*entity.User, error) {
	user, err := uc.repo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, apperror.ErrInvalidInput
		}
		user.Name = name
	}

	if input.Email != nil {
		email := strings.TrimSpace(*input.Email)
		if email == "" {
			return nil, apperror.ErrInvalidInput
		}
		user.Email = email
	}

	if input.AvatarURL != nil {
		trimmed := strings.TrimSpace(*input.AvatarURL)
		if trimmed == "" {
			user.AvatarURL = nil
		} else {
			user.AvatarURL = &trimmed
		}
	}

	if input.Role != nil {
		user.Role = *input.Role
	}

	if err := uc.repo.Update(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (uc *UserUseCase) Delete(ctx context.Context, publicID string) error {
	user, err := uc.repo.GetByPublicID(ctx, publicID)
	if err != nil {
		return err
	}
	if user == nil {
		return apperror.ErrUserNotFound
	}

	return uc.repo.Delete(ctx, publicID)
}

func (uc *UserUseCase) UploadAvatar(ctx context.Context, publicID string, filename string, contentType string, size int64, body io.Reader) (*entity.User, error) {
	if size > maxAvatarSize {
		return nil, apperror.ErrFileTooLarge
	}

	if !allowedAvatarTypes[contentType] {
		return nil, apperror.ErrInvalidFileType
	}

	user, err := uc.repo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	if user.AvatarURL != nil {
		oldKey := extractKeyFromURL(*user.AvatarURL)
		if oldKey != "" {
			_ = uc.storageSvc.Delete(ctx, oldKey)
		}
	}

	ext := path.Ext(filename)
	key := fmt.Sprintf("avatars/%s%s", publicID, ext)

	url, err := uc.storageSvc.Upload(ctx, key, contentType, body)
	if err != nil {
		return nil, apperror.ErrUploadFailed
	}

	if err := uc.repo.UpdateAvatar(ctx, publicID, &url); err != nil {
		return nil, err
	}

	user.AvatarURL = &url
	return user, nil
}

func (uc *UserUseCase) DeleteAvatar(ctx context.Context, publicID string) (*entity.User, error) {
	user, err := uc.repo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	if user.AvatarURL != nil {
		oldKey := extractKeyFromURL(*user.AvatarURL)
		if oldKey != "" {
			_ = uc.storageSvc.Delete(ctx, oldKey)
		}
	}

	if err := uc.repo.UpdateAvatar(ctx, publicID, nil); err != nil {
		return nil, err
	}

	user.AvatarURL = nil
	return user, nil
}

func extractKeyFromURL(url string) string {
	parts := strings.SplitN(url, "/", 4)
	if len(parts) >= 4 {
		return parts[3]
	}
	return ""
}
