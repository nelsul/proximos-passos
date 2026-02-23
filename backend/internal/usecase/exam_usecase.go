package usecase

import (
	"context"
	"math"
	"strings"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
)

type ExamUseCase struct {
	examRepo        repository.ExamRepository
	institutionRepo repository.InstitutionRepository
	userRepo        repository.UserRepository
}

func NewExamUseCase(examRepo repository.ExamRepository, institutionRepo repository.InstitutionRepository, userRepo repository.UserRepository) *ExamUseCase {
	return &ExamUseCase{examRepo: examRepo, institutionRepo: institutionRepo, userRepo: userRepo}
}

type CreateExamInput struct {
	InstitutionID string
	Title         string
	Description   *string
	Year          int
}

type UpdateExamInput struct {
	InstitutionID *string
	Title         *string
	Description   *string
	Year          *int
}

func (uc *ExamUseCase) Create(ctx context.Context, createdByPublicID string, input CreateExamInput) (*entity.Exam, error) {
	user, err := uc.userRepo.GetByPublicID(ctx, createdByPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	institution, err := uc.institutionRepo.GetByPublicID(ctx, input.InstitutionID)
	if err != nil {
		return nil, err
	}
	if institution == nil {
		return nil, apperror.ErrInstitutionNotFound
	}

	title := strings.TrimSpace(input.Title)
	if title == "" || len(title) > 255 {
		return nil, apperror.ErrInvalidInput
	}

	var description *string
	if input.Description != nil {
		d := strings.TrimSpace(*input.Description)
		if d != "" {
			description = &d
		}
	}

	if input.Year < 1900 || input.Year > 2100 {
		return nil, apperror.ErrInvalidInput
	}

	exam := &entity.Exam{
		InstitutionID: institution.ID,
		Title:         title,
		Description:   description,
		Year:          input.Year,
		CreatedByID:   user.ID,
	}

	if err := uc.examRepo.Create(ctx, exam); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrExamDuplicate
		}
		return nil, err
	}

	created, err := uc.examRepo.GetByPublicID(ctx, exam.PublicID)
	if err != nil {
		return nil, err
	}
	return created, nil
}

func (uc *ExamUseCase) GetByPublicID(ctx context.Context, publicID string) (*entity.Exam, error) {
	exam, err := uc.examRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if exam == nil {
		return nil, apperror.ErrExamNotFound
	}
	return exam, nil
}

func (uc *ExamUseCase) Update(ctx context.Context, publicID string, input UpdateExamInput) (*entity.Exam, error) {
	exam, err := uc.examRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if exam == nil {
		return nil, apperror.ErrExamNotFound
	}

	if input.InstitutionID != nil {
		institution, err := uc.institutionRepo.GetByPublicID(ctx, *input.InstitutionID)
		if err != nil {
			return nil, err
		}
		if institution == nil {
			return nil, apperror.ErrInstitutionNotFound
		}
		exam.InstitutionID = institution.ID
	}

	if input.Title != nil {
		t := strings.TrimSpace(*input.Title)
		if t == "" || len(t) > 255 {
			return nil, apperror.ErrInvalidInput
		}
		exam.Title = t
	}

	if input.Description != nil {
		d := strings.TrimSpace(*input.Description)
		if d == "" {
			exam.Description = nil
		} else {
			exam.Description = &d
		}
	}

	if input.Year != nil {
		if *input.Year < 1900 || *input.Year > 2100 {
			return nil, apperror.ErrInvalidInput
		}
		exam.Year = *input.Year
	}

	if err := uc.examRepo.Update(ctx, exam); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrExamDuplicate
		}
		return nil, err
	}

	updated, err := uc.examRepo.GetByPublicID(ctx, exam.PublicID)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (uc *ExamUseCase) Delete(ctx context.Context, publicID string) error {
	exam, err := uc.examRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return err
	}
	if exam == nil {
		return apperror.ErrExamNotFound
	}
	return uc.examRepo.Delete(ctx, publicID)
}

func (uc *ExamUseCase) List(ctx context.Context, page, pageSize int, filter repository.ExamFilter) ([]entity.Exam, int, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	offset := (page - 1) * pageSize

	exams, err := uc.examRepo.List(ctx, pageSize, offset, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	total, err := uc.examRepo.Count(ctx, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))

	return exams, total, totalPages, nil
}
