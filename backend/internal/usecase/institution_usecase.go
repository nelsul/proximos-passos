package usecase

import (
	"context"
	"math"
	"strings"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
)

type InstitutionUseCase struct {
	institutionRepo repository.InstitutionRepository
	userRepo        repository.UserRepository
}

func NewInstitutionUseCase(institutionRepo repository.InstitutionRepository, userRepo repository.UserRepository) *InstitutionUseCase {
	return &InstitutionUseCase{institutionRepo: institutionRepo, userRepo: userRepo}
}

type CreateInstitutionInput struct {
	Name    string
	Acronym string
}

type UpdateInstitutionInput struct {
	Name    *string
	Acronym *string
}

func (uc *InstitutionUseCase) Create(ctx context.Context, createdByPublicID string, input CreateInstitutionInput) (*entity.Institution, error) {
	user, err := uc.userRepo.GetByPublicID(ctx, createdByPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	name := strings.TrimSpace(input.Name)
	if name == "" || len(name) > 255 {
		return nil, apperror.ErrInvalidInput
	}

	acronym := strings.TrimSpace(input.Acronym)
	if acronym == "" || len(acronym) > 255 {
		return nil, apperror.ErrInvalidInput
	}

	institution := &entity.Institution{
		Name:        name,
		Acronym:     acronym,
		CreatedByID: user.ID,
	}

	if err := uc.institutionRepo.Create(ctx, institution); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrInstitutionNameTaken
		}
		return nil, err
	}

	return institution, nil
}

func (uc *InstitutionUseCase) GetByPublicID(ctx context.Context, publicID string) (*entity.Institution, error) {
	institution, err := uc.institutionRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if institution == nil {
		return nil, apperror.ErrInstitutionNotFound
	}
	return institution, nil
}

func (uc *InstitutionUseCase) Update(ctx context.Context, publicID string, input UpdateInstitutionInput) (*entity.Institution, error) {
	institution, err := uc.institutionRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if institution == nil {
		return nil, apperror.ErrInstitutionNotFound
	}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" || len(name) > 255 {
			return nil, apperror.ErrInvalidInput
		}
		institution.Name = name
	}

	if input.Acronym != nil {
		acronym := strings.TrimSpace(*input.Acronym)
		if acronym == "" || len(acronym) > 255 {
			return nil, apperror.ErrInvalidInput
		}
		institution.Acronym = acronym
	}

	if err := uc.institutionRepo.Update(ctx, institution); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrInstitutionNameTaken
		}
		return nil, err
	}

	updated, err := uc.institutionRepo.GetByPublicID(ctx, institution.PublicID)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (uc *InstitutionUseCase) Delete(ctx context.Context, publicID string) error {
	institution, err := uc.institutionRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return err
	}
	if institution == nil {
		return apperror.ErrInstitutionNotFound
	}
	return uc.institutionRepo.Delete(ctx, publicID)
}

func (uc *InstitutionUseCase) List(ctx context.Context, page, pageSize int, filter repository.InstitutionFilter) ([]entity.Institution, int, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	institutions, err := uc.institutionRepo.List(ctx, pageSize, offset, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	total, err := uc.institutionRepo.Count(ctx, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))

	return institutions, total, totalPages, nil
}
