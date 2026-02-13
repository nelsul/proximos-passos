package usecase

import (
	"context"
	"strings"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/infrastructure/jwt"

	"golang.org/x/crypto/bcrypt"
)

type AuthUseCase struct {
	repo       repository.UserRepository
	jwtService *jwt.Service
}

func NewAuthUseCase(repo repository.UserRepository, jwtService *jwt.Service) *AuthUseCase {
	return &AuthUseCase{repo: repo, jwtService: jwtService}
}

type LoginInput struct {
	Email    string
	Password string
}

type LoginOutput struct {
	Token     string
	ExpiresAt int64
}

func (uc *AuthUseCase) Login(ctx context.Context, input LoginInput) (*LoginOutput, error) {
	email := strings.TrimSpace(input.Email)
	password := strings.TrimSpace(input.Password)

	if email == "" || password == "" {
		return nil, apperror.ErrInvalidInput
	}

	user, err := uc.repo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, apperror.ErrInvalidCredentials
	}

	token, expiresAt, err := uc.jwtService.Generate(user)
	if err != nil {
		return nil, err
	}

	return &LoginOutput{
		Token:     token,
		ExpiresAt: expiresAt.Unix(),
	}, nil
}
