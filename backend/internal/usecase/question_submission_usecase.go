package usecase

import (
	"context"
	"math"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
)

type QuestionSubmissionUseCase struct {
	subRepo  repository.QuestionSubmissionRepository
	qRepo    repository.QuestionRepository
	userRepo repository.UserRepository
}

func NewQuestionSubmissionUseCase(
	subRepo repository.QuestionSubmissionRepository,
	qRepo repository.QuestionRepository,
	userRepo repository.UserRepository,
) *QuestionSubmissionUseCase {
	return &QuestionSubmissionUseCase{
		subRepo:  subRepo,
		qRepo:    qRepo,
		userRepo: userRepo,
	}
}

type SubmitAnswerInput struct {
	QuestionPublicID string
	UserPublicID     string
	OptionPublicID   *string
	AnswerText       *string
}

func (uc *QuestionSubmissionUseCase) Submit(ctx context.Context, input SubmitAnswerInput) (*entity.QuestionSubmission, error) {
	question, err := uc.qRepo.GetByPublicID(ctx, input.QuestionPublicID)
	if err != nil {
		return nil, err
	}
	if question == nil {
		return nil, apperror.ErrQuestionNotFound
	}

	user, err := uc.userRepo.GetByPublicID(ctx, input.UserPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	sub := &entity.QuestionSubmission{
		QuestionID: question.ID,
		UserID:     user.ID,
	}

	if question.Type == "closed_ended" {
		if input.OptionPublicID == nil || *input.OptionPublicID == "" {
			return nil, apperror.ErrInvalidInput
		}

		// Find the selected option
		var selectedOption *entity.QuestionOption
		for i := range question.Options {
			if question.Options[i].PublicID == *input.OptionPublicID {
				selectedOption = &question.Options[i]
				break
			}
		}
		if selectedOption == nil {
			return nil, apperror.ErrInvalidInput
		}

		sub.QuestionOptionID = &selectedOption.ID
		if selectedOption.IsCorrect {
			score := 100
			sub.Score = &score
			sub.Passed = true
		} else {
			score := 0
			sub.Score = &score
			sub.Passed = false
		}
	} else {
		// open_ended
		if input.AnswerText == nil || *input.AnswerText == "" {
			return nil, apperror.ErrInvalidInput
		}
		sub.AnswerText = input.AnswerText
		// Open-ended questions are not auto-graded — score stays nil
	}

	if err := uc.subRepo.Create(ctx, sub); err != nil {
		return nil, err
	}

	// Re-fetch with joined fields
	full, err := uc.subRepo.GetByPublicID(ctx, sub.PublicID)
	if err != nil {
		return nil, err
	}
	return full, nil
}

func (uc *QuestionSubmissionUseCase) GetByPublicID(ctx context.Context, publicID string) (*entity.QuestionSubmission, error) {
	s, err := uc.subRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if s == nil {
		return nil, apperror.ErrQuestionSubmissionNotFound
	}
	return s, nil
}

func (uc *QuestionSubmissionUseCase) ListMySubmissions(ctx context.Context, userPublicID string, page, size int, statement string) ([]entity.QuestionSubmission, int, error) {
	user, err := uc.userRepo.GetByPublicID(ctx, userPublicID)
	if err != nil {
		return nil, 0, err
	}
	if user == nil {
		return nil, 0, apperror.ErrUserNotFound
	}

	total, err := uc.subRepo.CountByUser(ctx, user.ID, statement)
	if err != nil {
		return nil, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(size)))
	if page > totalPages && totalPages > 0 {
		page = totalPages
	}
	offset := (page - 1) * size

	subs, err := uc.subRepo.ListByUser(ctx, user.ID, size, offset, statement)
	if err != nil {
		return nil, 0, err
	}

	return subs, total, nil
}

func (uc *QuestionSubmissionUseCase) ListByQuestion(ctx context.Context, questionPublicID string, page, size int) ([]entity.QuestionSubmission, int, error) {
	question, err := uc.qRepo.GetByPublicID(ctx, questionPublicID)
	if err != nil {
		return nil, 0, err
	}
	if question == nil {
		return nil, 0, apperror.ErrQuestionNotFound
	}

	total, err := uc.subRepo.CountByQuestion(ctx, question.ID)
	if err != nil {
		return nil, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(size)))
	if page > totalPages && totalPages > 0 {
		page = totalPages
	}
	offset := (page - 1) * size

	subs, err := uc.subRepo.ListByQuestion(ctx, question.ID, size, offset)
	if err != nil {
		return nil, 0, err
	}

	return subs, total, nil
}
