package usecase

import (
	"context"
	"math"
	"strings"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
)

type TopicUseCase struct {
	topicRepo repository.TopicRepository
	userRepo  repository.UserRepository
}

func NewTopicUseCase(topicRepo repository.TopicRepository, userRepo repository.UserRepository) *TopicUseCase {
	return &TopicUseCase{topicRepo: topicRepo, userRepo: userRepo}
}

type CreateTopicInput struct {
	Name        string
	Description *string
	ParentID    *string // parent public_id
}

type UpdateTopicInput struct {
	Name        *string
	Description *string
	ParentID    *string // parent public_id
}

func (uc *TopicUseCase) resolveParentID(ctx context.Context, parentPublicID *string) (*int, error) {
	if parentPublicID == nil || *parentPublicID == "" {
		return nil, nil
	}

	parent, err := uc.topicRepo.GetByPublicID(ctx, *parentPublicID)
	if err != nil {
		return nil, err
	}
	if parent == nil {
		return nil, apperror.ErrTopicNotFound
	}
	return &parent.ID, nil
}

func (uc *TopicUseCase) Create(ctx context.Context, createdByPublicID string, input CreateTopicInput) (*entity.Topic, error) {
	user, err := uc.userRepo.GetByPublicID(ctx, createdByPublicID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.ErrUserNotFound
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, apperror.ErrInvalidInput
	}
	if len(name) > 255 {
		return nil, apperror.ErrInvalidInput
	}

	var desc *string
	if input.Description != nil {
		d := strings.TrimSpace(*input.Description)
		if d != "" {
			if len(d) > 512 {
				return nil, apperror.ErrInvalidInput
			}
			desc = &d
		}
	}

	parentID, err := uc.resolveParentID(ctx, input.ParentID)
	if err != nil {
		return nil, err
	}

	topic := &entity.Topic{
		Name:        name,
		Description: desc,
		ParentID:    parentID,
		CreatedByID: user.ID,
	}

	if err := uc.topicRepo.Create(ctx, topic); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrTopicNameTaken
		}
		return nil, err
	}

	// Reload to get parent public ID
	created, err := uc.topicRepo.GetByPublicID(ctx, topic.PublicID)
	if err != nil {
		return nil, err
	}
	return created, nil
}

func (uc *TopicUseCase) GetByPublicID(ctx context.Context, publicID string) (*entity.Topic, error) {
	topic, err := uc.topicRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if topic == nil {
		return nil, apperror.ErrTopicNotFound
	}
	return topic, nil
}

func (uc *TopicUseCase) Update(ctx context.Context, publicID string, input UpdateTopicInput) (*entity.Topic, error) {
	topic, err := uc.topicRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	if topic == nil {
		return nil, apperror.ErrTopicNotFound
	}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, apperror.ErrInvalidInput
		}
		if len(name) > 255 {
			return nil, apperror.ErrInvalidInput
		}
		topic.Name = name
	}

	if input.Description != nil {
		d := strings.TrimSpace(*input.Description)
		if d == "" {
			topic.Description = nil
		} else {
			if len(d) > 512 {
				return nil, apperror.ErrInvalidInput
			}
			topic.Description = &d
		}
	}

	if input.ParentID != nil {
		parentID, err := uc.resolveParentID(ctx, input.ParentID)
		if err != nil {
			return nil, err
		}
		topic.ParentID = parentID
	}

	if err := uc.topicRepo.Update(ctx, topic); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return nil, apperror.ErrTopicNameTaken
		}
		return nil, err
	}

	// Reload to get updated parent public ID
	updated, err := uc.topicRepo.GetByPublicID(ctx, topic.PublicID)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// Delete removes a topic. The mode parameter controls how children are handled:
//   - "" (empty): only deletes leaf topics; returns ErrTopicHasChildren if the topic has children
//   - "cascade": soft-deletes the topic and all its descendants
//   - "reparent": moves children to the topic's parent, then deletes the topic
func (uc *TopicUseCase) Delete(ctx context.Context, publicID string, mode string) error {
	topic, err := uc.topicRepo.GetByPublicID(ctx, publicID)
	if err != nil {
		return err
	}
	if topic == nil {
		return apperror.ErrTopicNotFound
	}

	// Check if topic has children
	emptyParentID := publicID
	count, err := uc.topicRepo.Count(ctx, repository.TopicFilter{ParentID: &emptyParentID})
	if err != nil {
		return err
	}

	if count > 0 {
		switch mode {
		case "cascade":
			return uc.topicRepo.DeleteCascade(ctx, topic.ID)
		case "reparent":
			if err := uc.topicRepo.ReparentChildren(ctx, topic.ID, topic.ParentID); err != nil {
				return err
			}
			return uc.topicRepo.Delete(ctx, publicID)
		default:
			return apperror.ErrTopicHasChildren
		}
	}

	return uc.topicRepo.Delete(ctx, publicID)
}

func (uc *TopicUseCase) List(ctx context.Context, page, pageSize int, filter repository.TopicFilter) ([]entity.Topic, int, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	topics, err := uc.topicRepo.List(ctx, pageSize, offset, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	total, err := uc.topicRepo.Count(ctx, filter)
	if err != nil {
		return nil, 0, 0, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))

	return topics, total, totalPages, nil
}
