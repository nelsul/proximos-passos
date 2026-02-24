-- 2026/02/23 20:01

ALTER TYPE activity_submission_status ADD VALUE 'created' BEFORE 'pending';

ALTER TYPE member_role ADD VALUE 'supervisor' BEFORE 'member';
