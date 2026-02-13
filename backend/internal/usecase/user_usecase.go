package usecase

import (
	"context"
	"strings"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"

	"golang.org/x/crypto/bcrypt"
)

type UserUseCase struct {
	repo repository.UserRepository
}

func NewUserUseCase(repo repository.UserRepository) *UserUseCase {
	return &UserUseCase{repo: repo}
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

	return user, nil
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
