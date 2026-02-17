package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
)

type QuestionRepository struct {
	pool *pgxpool.Pool
}

func NewQuestionRepository(pool *pgxpool.Pool) *QuestionRepository {
	return &QuestionRepository{pool: pool}
}

func (r *QuestionRepository) Create(ctx context.Context, q *entity.Question, topicIDs []int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Insert images first (if any)
	imageFileIDs := make([]int, 0)
	for i := range q.Images {
		img := &q.Images[i]
		if img.FileKey == "" {
			continue
		}
		var fileID int
		var filePublicID string
		err = tx.QueryRow(ctx,
			`INSERT INTO files (key, filename, content_type, size_bytes, uploaded_by_id)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, public_id`,
			img.FileKey, img.Filename, img.ContentType, img.SizeBytes, q.CreatedByID,
		).Scan(&fileID, &filePublicID)
		if err != nil {
			return err
		}
		img.FileID = fileID
		img.FilePublicID = filePublicID
		imageFileIDs = append(imageFileIDs, fileID)
	}

	// Insert the question record
	err = tx.QueryRow(ctx,
		`INSERT INTO questions (type, statement, expected_answer_text, passing_score, exam_id, created_by_id)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, public_id, is_active, created_at, updated_at`,
		q.Type, q.Statement, q.ExpectedAnswerText, q.PassingScore, q.ExamID, q.CreatedByID,
	).Scan(&q.ID, &q.PublicID, &q.IsActive, &q.CreatedAt, &q.UpdatedAt)
	if err != nil {
		return err
	}

	// Link images
	for _, fileID := range imageFileIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO question_images (question_id, image_file_id) VALUES ($1, $2)`,
			q.ID, fileID,
		)
		if err != nil {
			return err
		}
	}

	// Insert topic associations
	for _, topicID := range topicIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO question_topics (question_id, topic_id) VALUES ($1, $2)`,
			q.ID, topicID,
		)
		if err != nil {
			return err
		}
	}

	// Insert options
	for i := range q.Options {
		opt := &q.Options[i]

		err = tx.QueryRow(ctx,
			`INSERT INTO question_options (question_id, original_order, text, is_correct, created_by_id)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, public_id, created_at, updated_at`,
			q.ID, opt.OriginalOrder, opt.Text, opt.IsCorrect, q.CreatedByID,
		).Scan(&opt.ID, &opt.PublicID, &opt.CreatedAt, &opt.UpdatedAt)
		if err != nil {
			return err
		}

		// Insert option images
		for j := range opt.Images {
			img := &opt.Images[j]
			if img.FileKey == "" {
				continue
			}
			var fid int
			var fpid string
			err = tx.QueryRow(ctx,
				`INSERT INTO files (key, filename, content_type, size_bytes, uploaded_by_id)
				 VALUES ($1, $2, $3, $4, $5)
				 RETURNING id, public_id`,
				img.FileKey, img.Filename, img.ContentType, img.SizeBytes, q.CreatedByID,
			).Scan(&fid, &fpid)
			if err != nil {
				return err
			}
			img.FileID = fid
			img.FilePublicID = fpid

			_, err = tx.Exec(ctx,
				`INSERT INTO question_option_images (question_option_id, image_file_id) VALUES ($1, $2)`,
				opt.ID, fid,
			)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func (r *QuestionRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.Question, error) {
	var q entity.Question
	err := r.pool.QueryRow(ctx,
		`SELECT q.id, q.public_id, q.type, q.statement,
		        q.expected_answer_text, q.passing_score, q.exam_id,
		        q.is_active, q.created_by_id, q.created_at, q.updated_at
		 FROM questions q
		 WHERE q.public_id = $1 AND q.is_active = true`,
		publicID,
	).Scan(&q.ID, &q.PublicID, &q.Type, &q.Statement,
		&q.ExpectedAnswerText, &q.PassingScore, &q.ExamID,
		&q.IsActive, &q.CreatedByID, &q.CreatedAt, &q.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	images, err := r.loadImages(ctx, q.ID)
	if err != nil {
		return nil, err
	}
	q.Images = images

	topics, err := r.loadTopics(ctx, q.ID)
	if err != nil {
		return nil, err
	}
	q.Topics = topics

	options, err := r.loadOptions(ctx, q.ID)
	if err != nil {
		return nil, err
	}
	q.Options = options

	return &q, nil
}

func (r *QuestionRepository) Update(ctx context.Context, q *entity.Question) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE questions
		 SET type = $1, statement = $2, expected_answer_text = $3, passing_score = $4, updated_at = NOW()
		 WHERE public_id = $5 AND is_active = true`,
		q.Type, q.Statement, q.ExpectedAnswerText, q.PassingScore, q.PublicID,
	)
	return err
}

func (r *QuestionRepository) AddImages(ctx context.Context, questionID int, q *entity.Question, uploadedByID int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for i := range q.Images {
		img := &q.Images[i]
		if img.FileKey == "" {
			continue
		}
		var fileID int
		err = tx.QueryRow(ctx,
			`INSERT INTO files (key, filename, content_type, size_bytes, uploaded_by_id)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id`,
			img.FileKey, img.Filename, img.ContentType, img.SizeBytes, uploadedByID,
		).Scan(&fileID)
		if err != nil {
			return err
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO question_images (question_id, image_file_id) VALUES ($1, $2)`,
			questionID, fileID,
		)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(ctx,
		`UPDATE questions SET updated_at = NOW() WHERE id = $1`,
		questionID,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *QuestionRepository) RemoveImage(ctx context.Context, questionID int, filePublicID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM question_images
		 WHERE question_id = $1
		   AND image_file_id = (SELECT id FROM files WHERE public_id = $2)`,
		questionID, filePublicID,
	)
	return err
}

func (r *QuestionRepository) SetTopics(ctx context.Context, questionID int, topicIDs []int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM question_topics WHERE question_id = $1`, questionID)
	if err != nil {
		return err
	}

	for _, topicID := range topicIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO question_topics (question_id, topic_id) VALUES ($1, $2)`,
			questionID, topicID,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *QuestionRepository) Delete(ctx context.Context, publicID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE questions SET is_active = false, updated_at = NOW()
		 WHERE public_id = $1 AND is_active = true`,
		publicID,
	)
	return err
}

func (r *QuestionRepository) List(ctx context.Context, limit, offset int, filter repository.QuestionFilter) ([]entity.Question, error) {
	filterClause, filterArgs := buildQuestionFilterClause(filter)

	query := fmt.Sprintf(
		`SELECT q.id, q.public_id, q.type, q.statement,
		        q.expected_answer_text, q.passing_score, q.exam_id,
		        q.is_active, q.created_by_id, q.created_at, q.updated_at
		 FROM questions q
		 WHERE q.is_active = true%s
		 ORDER BY q.created_at DESC
		 LIMIT $%d OFFSET $%d`,
		filterClause, len(filterArgs)+1, len(filterArgs)+2,
	)

	args := append(filterArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var questions []entity.Question
	for rows.Next() {
		var q entity.Question
		if err := rows.Scan(&q.ID, &q.PublicID, &q.Type, &q.Statement,
			&q.ExpectedAnswerText, &q.PassingScore, &q.ExamID,
			&q.IsActive, &q.CreatedByID, &q.CreatedAt, &q.UpdatedAt); err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load topics, images, and options for each question
	for i := range questions {
		topics, err := r.loadTopics(ctx, questions[i].ID)
		if err != nil {
			return nil, err
		}
		questions[i].Topics = topics

		images, err := r.loadImages(ctx, questions[i].ID)
		if err != nil {
			return nil, err
		}
		questions[i].Images = images

		options, err := r.loadOptions(ctx, questions[i].ID)
		if err != nil {
			return nil, err
		}
		questions[i].Options = options
	}

	return questions, nil
}

func (r *QuestionRepository) Count(ctx context.Context, filter repository.QuestionFilter) (int, error) {
	filterClause, filterArgs := buildQuestionFilterClause(filter)

	query := fmt.Sprintf(
		`SELECT COUNT(*)
		 FROM questions q
		 WHERE q.is_active = true%s`,
		filterClause,
	)

	var count int
	err := r.pool.QueryRow(ctx, query, filterArgs...).Scan(&count)
	return count, err
}

func buildQuestionFilterClause(filter repository.QuestionFilter) (string, []any) {
	clause := ""
	args := []any{}
	argIdx := 1

	if filter.Statement != "" {
		clause += fmt.Sprintf(" AND q.statement ILIKE $%d", argIdx)
		args = append(args, "%"+filter.Statement+"%")
		argIdx++
	}

	if filter.Type != "" {
		clause += fmt.Sprintf(" AND q.type = $%d", argIdx)
		args = append(args, filter.Type)
		argIdx++
	}

	if filter.TopicID != nil {
		clause += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM question_topics qt2 WHERE qt2.question_id = q.id AND qt2.topic_id IN (WITH RECURSIVE topic_tree AS (SELECT id FROM topics WHERE id = $%d UNION ALL SELECT t.id FROM topics t JOIN topic_tree tt ON t.parent_id = tt.id) SELECT id FROM topic_tree))", argIdx)
		args = append(args, *filter.TopicID)
		argIdx++
	}

	return clause, args
}

func (r *QuestionRepository) loadTopics(ctx context.Context, questionID int) ([]entity.TopicRef, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT t.id, t.public_id, t.name
		 FROM question_topics qt
		 JOIN topics t ON t.id = qt.topic_id
		 WHERE qt.question_id = $1 AND t.is_active = true
		 ORDER BY t.name ASC`,
		questionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var topics []entity.TopicRef
	for rows.Next() {
		var t entity.TopicRef
		if err := rows.Scan(&t.ID, &t.PublicID, &t.Name); err != nil {
			return nil, err
		}
		topics = append(topics, t)
	}
	return topics, rows.Err()
}

func (r *QuestionRepository) SetOptions(ctx context.Context, questionID int, options []entity.QuestionOption, createdByID int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM question_options WHERE question_id = $1`, questionID)
	if err != nil {
		return err
	}

	for i := range options {
		opt := &options[i]

		var optID int
		err = tx.QueryRow(ctx,
			`INSERT INTO question_options (question_id, original_order, text, is_correct, created_by_id)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id`,
			questionID, opt.OriginalOrder, opt.Text, opt.IsCorrect, createdByID,
		).Scan(&optID)
		if err != nil {
			return err
		}
		opt.ID = optID

		// Insert option images
		for j := range opt.Images {
			img := &opt.Images[j]

			var fileID int
			if img.FileKey != "" {
				// New upload — create file record
				err = tx.QueryRow(ctx,
					`INSERT INTO files (key, filename, content_type, size_bytes, uploaded_by_id)
					 VALUES ($1, $2, $3, $4, $5)
					 RETURNING id`,
					img.FileKey, img.Filename, img.ContentType, img.SizeBytes, createdByID,
				).Scan(&fileID)
				if err != nil {
					return err
				}
			} else if img.FileID > 0 {
				// Existing image — re-link
				fileID = img.FileID
			} else {
				continue
			}

			_, err = tx.Exec(ctx,
				`INSERT INTO question_option_images (question_option_id, image_file_id) VALUES ($1, $2)`,
				optID, fileID,
			)
			if err != nil {
				return err
			}
		}
	}

	_, err = tx.Exec(ctx,
		`UPDATE questions SET updated_at = NOW() WHERE id = $1`,
		questionID,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *QuestionRepository) loadOptions(ctx context.Context, questionID int) ([]entity.QuestionOption, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT qo.id, qo.public_id, qo.original_order, qo.text, qo.is_correct,
		        qo.created_by_id, qo.created_at, qo.updated_at
		 FROM question_options qo
		 WHERE qo.question_id = $1 AND qo.is_active = true
		 ORDER BY qo.original_order ASC`,
		questionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var options []entity.QuestionOption
	for rows.Next() {
		var opt entity.QuestionOption
		if err := rows.Scan(&opt.ID, &opt.PublicID, &opt.OriginalOrder, &opt.Text, &opt.IsCorrect,
			&opt.CreatedByID, &opt.CreatedAt, &opt.UpdatedAt); err != nil {
			return nil, err
		}
		options = append(options, opt)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load images for each option
	for i := range options {
		images, err := r.loadOptionImages(ctx, options[i].ID)
		if err != nil {
			return nil, err
		}
		options[i].Images = images
	}

	return options, nil
}

func (r *QuestionRepository) loadOptionImages(ctx context.Context, optionID int) ([]entity.QuestionImage, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT f.id, f.public_id, f.key, f.filename, f.content_type, f.size_bytes
		 FROM question_option_images qoi
		 JOIN files f ON f.id = qoi.image_file_id
		 WHERE qoi.question_option_id = $1 AND f.is_active = true
		 ORDER BY f.created_at ASC`,
		optionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var images []entity.QuestionImage
	for rows.Next() {
		var img entity.QuestionImage
		if err := rows.Scan(&img.FileID, &img.FilePublicID, &img.FileKey, &img.Filename, &img.ContentType, &img.SizeBytes); err != nil {
			return nil, err
		}
		images = append(images, img)
	}
	return images, rows.Err()
}

func (r *QuestionRepository) loadImages(ctx context.Context, questionID int) ([]entity.QuestionImage, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT f.id, f.public_id, f.key, f.filename, f.content_type, f.size_bytes
		 FROM question_images qi
		 JOIN files f ON f.id = qi.image_file_id
		 WHERE qi.question_id = $1 AND f.is_active = true
		 ORDER BY f.created_at ASC`,
		questionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var images []entity.QuestionImage
	for rows.Next() {
		var img entity.QuestionImage
		if err := rows.Scan(&img.FileID, &img.FilePublicID, &img.FileKey, &img.Filename, &img.ContentType, &img.SizeBytes); err != nil {
			return nil, err
		}
		images = append(images, img)
	}
	return images, rows.Err()
}
