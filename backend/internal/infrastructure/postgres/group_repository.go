package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type GroupRepository struct {
	pool *pgxpool.Pool
}

func NewGroupRepository(pool *pgxpool.Pool) *GroupRepository {
	return &GroupRepository{pool: pool}
}

// ==========================================
// Groups
// ==========================================

func (r *GroupRepository) Create(ctx context.Context, group *entity.Group) error {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO groups (name, description, access_type, visibility_type, thumbnail_url, created_by_id)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, public_id, is_active, created_at, updated_at`,
		group.Name, group.Description, group.AccessType, group.VisibilityType, group.ThumbnailURL, group.CreatedByID,
	).Scan(&group.ID, &group.PublicID, &group.IsActive, &group.CreatedAt, &group.UpdatedAt)

	if err != nil {
		return err
	}

	return nil
}

func (r *GroupRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.Group, error) {
	var group entity.Group
	err := r.pool.QueryRow(ctx,
		`SELECT id, public_id, name, description, access_type, visibility_type,
		        thumbnail_url, is_active, created_by_id, created_at, updated_at
		 FROM groups
		 WHERE public_id = $1 AND is_active = true`,
		publicID,
	).Scan(
		&group.ID, &group.PublicID, &group.Name, &group.Description,
		&group.AccessType, &group.VisibilityType, &group.ThumbnailURL,
		&group.IsActive, &group.CreatedByID, &group.CreatedAt, &group.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
			return nil, nil
		}
		return nil, err
	}

	return &group, nil
}

func buildGroupFilterClause(filter repository.GroupFilter, startParam int) (string, []any) {
	var conditions []string
	var args []any
	paramIdx := startParam

	if filter.Name != "" {
		conditions = append(conditions, fmt.Sprintf("g.name ILIKE $%d", paramIdx))
		args = append(args, "%"+filter.Name+"%")
		paramIdx++
	}
	if filter.AccessType != "" {
		conditions = append(conditions, fmt.Sprintf("g.access_type = $%d", paramIdx))
		args = append(args, filter.AccessType)
		paramIdx++
	}
	if filter.VisibilityType != "" {
		conditions = append(conditions, fmt.Sprintf("g.visibility_type = $%d", paramIdx))
		args = append(args, filter.VisibilityType)
		paramIdx++
	}

	if len(conditions) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(conditions, " AND "), args
}

func (r *GroupRepository) List(ctx context.Context, limit, offset int, filter repository.GroupFilter) ([]entity.Group, error) {
	filterClause, filterArgs := buildGroupFilterClause(filter, 3)
	query := fmt.Sprintf(
		`SELECT id, public_id, name, description, access_type, visibility_type,
		        thumbnail_url, is_active, created_by_id, created_at, updated_at
		 FROM groups g
		 WHERE g.is_active = true%s
		 ORDER BY g.created_at DESC
		 LIMIT $1 OFFSET $2`, filterClause)

	args := append([]any{limit, offset}, filterArgs...)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []entity.Group
	for rows.Next() {
		var g entity.Group
		if err := rows.Scan(
			&g.ID, &g.PublicID, &g.Name, &g.Description,
			&g.AccessType, &g.VisibilityType, &g.ThumbnailURL,
			&g.IsActive, &g.CreatedByID, &g.CreatedAt, &g.UpdatedAt,
		); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}

	return groups, rows.Err()
}

func (r *GroupRepository) Count(ctx context.Context, filter repository.GroupFilter) (int, error) {
	filterClause, filterArgs := buildGroupFilterClause(filter, 1)
	query := fmt.Sprintf(`SELECT COUNT(*) FROM groups g WHERE g.is_active = true%s`, filterClause)

	var count int
	err := r.pool.QueryRow(ctx, query, filterArgs...).Scan(&count)
	return count, err
}

func (r *GroupRepository) ListPublic(ctx context.Context, limit, offset int, filter repository.GroupFilter) ([]entity.Group, error) {
	filterClause, filterArgs := buildGroupFilterClause(filter, 3)
	query := fmt.Sprintf(
		`SELECT id, public_id, name, description, access_type, visibility_type,
		        thumbnail_url, is_active, created_by_id, created_at, updated_at
		 FROM groups g
		 WHERE g.is_active = true AND g.visibility_type = 'public'%s
		 ORDER BY g.created_at DESC
		 LIMIT $1 OFFSET $2`, filterClause)

	args := append([]any{limit, offset}, filterArgs...)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []entity.Group
	for rows.Next() {
		var g entity.Group
		if err := rows.Scan(
			&g.ID, &g.PublicID, &g.Name, &g.Description,
			&g.AccessType, &g.VisibilityType, &g.ThumbnailURL,
			&g.IsActive, &g.CreatedByID, &g.CreatedAt, &g.UpdatedAt,
		); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}

	return groups, rows.Err()
}

func (r *GroupRepository) CountPublic(ctx context.Context, filter repository.GroupFilter) (int, error) {
	filterClause, filterArgs := buildGroupFilterClause(filter, 1)
	query := fmt.Sprintf(`SELECT COUNT(*) FROM groups g WHERE g.is_active = true AND g.visibility_type = 'public'%s`, filterClause)

	var count int
	err := r.pool.QueryRow(ctx, query, filterArgs...).Scan(&count)
	return count, err
}

func (r *GroupRepository) ListByUser(ctx context.Context, userID int, limit, offset int, filter repository.GroupFilter) ([]entity.Group, error) {
	filterClause, filterArgs := buildGroupFilterClause(filter, 4)
	query := fmt.Sprintf(
		`SELECT g.id, g.public_id, g.name, g.description, g.access_type, g.visibility_type,
		        g.thumbnail_url, g.is_active, g.created_by_id, g.created_at, g.updated_at
		 FROM groups g
		 JOIN group_members gm ON gm.group_id = g.id
		 WHERE g.is_active = true AND gm.user_id = $1 AND gm.is_active = true AND gm.accepted_by_id IS NOT NULL%s
		 ORDER BY g.created_at DESC
		 LIMIT $2 OFFSET $3`, filterClause)

	args := append([]any{userID, limit, offset}, filterArgs...)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []entity.Group
	for rows.Next() {
		var g entity.Group
		if err := rows.Scan(
			&g.ID, &g.PublicID, &g.Name, &g.Description,
			&g.AccessType, &g.VisibilityType, &g.ThumbnailURL,
			&g.IsActive, &g.CreatedByID, &g.CreatedAt, &g.UpdatedAt,
		); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}

	return groups, rows.Err()
}

func (r *GroupRepository) CountByUser(ctx context.Context, userID int, filter repository.GroupFilter) (int, error) {
	filterClause, filterArgs := buildGroupFilterClause(filter, 2)
	query := fmt.Sprintf(
		`SELECT COUNT(*) FROM groups g
		 JOIN group_members gm ON gm.group_id = g.id
		 WHERE g.is_active = true AND gm.user_id = $1 AND gm.is_active = true AND gm.accepted_by_id IS NOT NULL%s`, filterClause)

	args := append([]any{userID}, filterArgs...)
	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}

func (r *GroupRepository) Update(ctx context.Context, group *entity.Group) error {
	result, err := r.pool.Exec(ctx,
		`UPDATE groups
		 SET name = $1, description = $2, access_type = $3, visibility_type = $4
		 WHERE public_id = $5 AND is_active = true`,
		group.Name, group.Description, group.AccessType, group.VisibilityType, group.PublicID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return apperror.ErrGroupNotFound
	}

	return nil
}

func (r *GroupRepository) UpdateThumbnail(ctx context.Context, publicID string, thumbnailURL *string) error {
	result, err := r.pool.Exec(ctx,
		`UPDATE groups SET thumbnail_url = $1 WHERE public_id = $2 AND is_active = true`,
		thumbnailURL, publicID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return apperror.ErrGroupNotFound
	}

	return nil
}

func (r *GroupRepository) Delete(ctx context.Context, publicID string) error {
	result, err := r.pool.Exec(ctx,
		`UPDATE groups SET is_active = false WHERE public_id = $1 AND is_active = true`,
		publicID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return apperror.ErrGroupNotFound
	}

	return nil
}

// ==========================================
// Members
// ==========================================

func (r *GroupRepository) AddMember(ctx context.Context, member *entity.GroupMember) error {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO group_members (group_id, user_id, role, accepted_by_id, created_by_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING joined_at, updated_at`,
		member.GroupID, member.UserID, member.Role, member.AcceptedByID, member.CreatedByID,
	).Scan(&member.JoinedAt, &member.UpdatedAt)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return apperror.ErrMemberAlreadyExists
		}
		return err
	}

	return nil
}

func (r *GroupRepository) GetMember(ctx context.Context, groupID, userID int) (*entity.GroupMember, error) {
	var m entity.GroupMember
	err := r.pool.QueryRow(ctx,
		`SELECT group_id, user_id, role, accepted_by_id, is_active, created_by_id, joined_at, updated_at
		 FROM group_members
		 WHERE group_id = $1 AND user_id = $2 AND is_active = true`,
		groupID, userID,
	).Scan(
		&m.GroupID, &m.UserID, &m.Role, &m.AcceptedByID,
		&m.IsActive, &m.CreatedByID, &m.JoinedAt, &m.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &m, nil
}

func (r *GroupRepository) GetFirstAdminMember(ctx context.Context, groupID int) (*entity.GroupMember, error) {
	var m entity.GroupMember
	err := r.pool.QueryRow(ctx,
		`SELECT group_id, user_id, role, accepted_by_id, is_active, created_by_id, joined_at, updated_at
		 FROM group_members
		 WHERE group_id = $1 AND role = 'admin' AND is_active = true AND accepted_by_id IS NOT NULL
		 ORDER BY joined_at ASC
		 LIMIT 1`,
		groupID,
	).Scan(
		&m.GroupID, &m.UserID, &m.Role, &m.AcceptedByID,
		&m.IsActive, &m.CreatedByID, &m.JoinedAt, &m.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &m, nil
}

func (r *GroupRepository) ListMembers(ctx context.Context, groupID int, limit, offset int, role string) ([]entity.GroupMember, error) {
	query := `SELECT gm.group_id, gm.user_id, u.public_id, gm.role, gm.accepted_by_id,
		        gm.is_active, gm.created_by_id, gm.joined_at, gm.updated_at,
		        u.name, u.email, u.avatar_url
		 FROM group_members gm
		 JOIN users u ON u.id = gm.user_id
		 WHERE gm.group_id = $1 AND gm.is_active = true AND gm.accepted_by_id IS NOT NULL`
	args := []any{groupID}

	if role != "" {
		args = append(args, role)
		query += fmt.Sprintf(" AND gm.role = $%d", len(args))
	}

	args = append(args, limit, offset)
	query += fmt.Sprintf(" ORDER BY gm.joined_at DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []entity.GroupMember
	for rows.Next() {
		var m entity.GroupMember
		if err := rows.Scan(
			&m.GroupID, &m.UserID, &m.UserPublicID, &m.Role, &m.AcceptedByID,
			&m.IsActive, &m.CreatedByID, &m.JoinedAt, &m.UpdatedAt,
			&m.UserName, &m.UserEmail, &m.UserAvatarURL,
		); err != nil {
			return nil, err
		}
		members = append(members, m)
	}

	return members, rows.Err()
}

func (r *GroupRepository) CountMembers(ctx context.Context, groupID int, role string) (int, error) {
	query := `SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND is_active = true AND accepted_by_id IS NOT NULL`
	args := []any{groupID}

	if role != "" {
		args = append(args, role)
		query += fmt.Sprintf(" AND role = $%d", len(args))
	}

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}

func (r *GroupRepository) UpdateMemberRole(ctx context.Context, groupID, userID int, role entity.MemberRole) error {
	result, err := r.pool.Exec(ctx,
		`UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3 AND is_active = true`,
		role, groupID, userID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return apperror.ErrMemberNotFound
	}

	return nil
}

func (r *GroupRepository) RemoveMember(ctx context.Context, groupID, userID int) error {
	result, err := r.pool.Exec(ctx,
		`UPDATE group_members SET is_active = false WHERE group_id = $1 AND user_id = $2 AND is_active = true`,
		groupID, userID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return apperror.ErrMemberNotFound
	}

	return nil
}
