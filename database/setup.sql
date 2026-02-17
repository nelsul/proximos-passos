-- ==========================================
-- 1. BASE SYSTEM (Users & Files)
-- ==========================================

CREATE TYPE user_role AS ENUM ('admin', 'regular');

CREATE TABLE users (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    role user_role NOT NULL DEFAULT 'regular',
    name TEXT NOT NULL CHECK (
        length(name) <= 255 
        AND length(name) > 0 
        AND name = trim(name)
    ),
    email TEXT UNIQUE NOT NULL CHECK (
        length(email) <= 255 
        AND length(email) > 0 
        AND email = trim(email)
    ),
    email_verified_at TIMESTAMPTZ,
    last_verification_token_sent_at TIMESTAMPTZ,
    password_hash TEXT NOT NULL CHECK (
        length(password_hash) <= 255 
        AND length(password_hash) > 0 
        AND password_hash = trim(password_hash)
    ),
    avatar_url TEXT CHECK (
        length(avatar_url) <= 2048 
        AND (
            avatar_url IS NULL 
            OR (length(avatar_url) > 0 AND avatar_url = trim(avatar_url))
        )
    ),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE file_category AS ENUM ('image', 'pdf', 'video', 'other');

CREATE TABLE files (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    key TEXT UNIQUE NOT NULL CHECK (
        length(key) <= 1024
        AND length(key) > 0
        AND key = trim(key)
    ),
    filename TEXT NOT NULL CHECK (
        length(filename) <= 255
        AND length(filename) > 0
        AND filename = trim(filename)
    ),
    content_type TEXT NOT NULL CHECK (
        length(content_type) <= 255
        AND length(content_type) > 0
        AND content_type = trim(content_type)
    ),
    size_bytes BIGINT NOT NULL,
    category file_category NOT NULL GENERATED ALWAYS AS (
        CASE 
            WHEN content_type ILIKE 'image/%' THEN 'image'::file_category
            WHEN content_type ILIKE 'application/pdf' THEN 'pdf'::file_category
            WHEN content_type ILIKE 'video/%' THEN 'video'::file_category
            ELSE 'other'::file_category
        END
    ) STORED,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (id, category)
);

-- ==========================================
-- 2. ACADEMIC CONTEXT
-- ==========================================

CREATE TABLE institutions (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    name TEXT UNIQUE NOT NULL CHECK (
        length(name) <= 255
        AND length(name) > 0
        AND name = trim(name)
    ),
    acronym TEXT UNIQUE NOT NULL CHECK (
        length(acronym) <= 255
        AND length(acronym) > 0
        AND acronym = trim(acronym)
    ),
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exams (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    institution_id INT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    stage TEXT CHECK (
        length(stage) <= 255
        AND (
            stage IS NULL 
            OR (length(stage) > 0 AND stage = trim(stage))
        )
    ),
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE NULLS NOT DISTINCT (institution_id, year, stage)
);

CREATE TABLE topics (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    parent_id INT REFERENCES topics(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (
        length(name) <= 255
        AND length(name) > 0
        AND name = trim(name)
    ),
    description TEXT CHECK (
        length(description) <= 512 
        AND (
            description IS NULL 
            OR (length(description) > 0 AND description = trim(description))
        )
    ),
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE NULLS NOT DISTINCT (parent_id, name)
);

-- ==========================================
-- 3. CONTENT LIBRARIES
-- ==========================================

CREATE TYPE question_type AS ENUM ('open_ended', 'closed_ended');

CREATE TABLE questions (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    type question_type NOT NULL DEFAULT 'closed_ended',
    exam_id INT REFERENCES exams(id) ON DELETE SET NULL,
    statement TEXT NOT NULL CHECK (
        length(statement) > 0
        AND statement = trim(statement)
    ),
    expected_answer_text TEXT CHECK (
        expected_answer_text IS NULL
        OR (length(expected_answer_text) > 0 AND expected_answer_text = trim(expected_answer_text))
    ),
    passing_score INT CHECK (passing_score BETWEEN 0 AND 100),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE question_images (
    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    image_file_id INT NOT NULL,
    image_file_type_check file_category DEFAULT 'image' CHECK (image_file_type_check = 'image'),

    FOREIGN KEY (image_file_id, image_file_type_check) REFERENCES files(id, category) ON DELETE RESTRICT,
    PRIMARY KEY (question_id, image_file_id)
);

CREATE TABLE question_topics (
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    topic_id INT REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, topic_id)
);

CREATE TABLE question_options (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),

    original_order INT NOT NULL DEFAULT 0,
    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text TEXT CHECK (
        text IS NULL
        OR (length(text) > 0 AND text = trim(text))
    ),
    is_correct BOOLEAN NOT NULL DEFAULT false,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (question_id, original_order)
);

CREATE TABLE question_option_images (
    question_option_id INT NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
    image_file_id INT NOT NULL,
    image_file_type_check file_category DEFAULT 'image' CHECK (image_file_type_check = 'image'),

    FOREIGN KEY (image_file_id, image_file_type_check) REFERENCES files(id, category) ON DELETE RESTRICT,
    PRIMARY KEY (question_option_id, image_file_id)
);

CREATE TABLE question_feedbacks (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    difficulty_logic SMALLINT NOT NULL CHECK (difficulty_logic BETWEEN 1 AND 3),
    difficulty_labor SMALLINT NOT NULL CHECK (difficulty_labor BETWEEN 1 AND 3),
    difficulty_theory SMALLINT NOT NULL CHECK (difficulty_theory BETWEEN 1 AND 3),
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(question_id, user_id)
);

CREATE TABLE open_exercise_lists (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    title TEXT UNIQUE NOT NULL CHECK (
        length(title) <= 255
        AND length(title) > 0
        AND title = trim(title)
    ),
    description TEXT CHECK (
        description IS NULL
        OR (length(description) > 0 AND description = trim(description))
    ),  
    file_id INT,
    file_url TEXT CHECK (
        file_url IS NULL
        OR (length(file_url) > 0 AND file_url = trim(file_url))
    ),
    file_type_check file_category DEFAULT 'pdf' CHECK (file_type_check = 'pdf'),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (file_id, file_type_check) REFERENCES files(id, category) ON DELETE RESTRICT,
    CONSTRAINT open_exercise_lists_content_check CHECK (
        file_id IS NOT NULL OR file_url IS NOT NULL
    )
);

CREATE TABLE open_exercise_list_topics (
    open_exercise_list_id INT NOT NULL REFERENCES open_exercise_lists(id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (open_exercise_list_id, topic_id)
);

CREATE TABLE video_lessons (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    title TEXT UNIQUE NOT NULL CHECK (
        length(title) <= 255
        AND length(title) > 0
        AND title = trim(title)
    ),
    description TEXT CHECK (
        description IS NULL
        OR (length(description) > 0 AND description = trim(description))
    ), 
    file_id INT,
    file_url TEXT CHECK (
        file_url IS NULL
        OR (length(file_url) > 0 AND file_url = trim(file_url))
    ),
    file_type_check file_category DEFAULT 'video' CHECK (file_type_check = 'video'),
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (file_id, file_type_check) REFERENCES files(id, category) ON DELETE RESTRICT,
    CONSTRAINT video_lessons_content_check CHECK (
        file_id IS NOT NULL OR file_url IS NOT NULL
    )
);

CREATE TABLE video_lesson_topics (
    video_lesson_id INT NOT NULL REFERENCES video_lessons(id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (video_lesson_id, topic_id)
);

CREATE TABLE handouts (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    title TEXT UNIQUE NOT NULL CHECK (
        length(title) <= 255
        AND length(title) > 0
        AND title = trim(title)
    ),
    description TEXT CHECK (
        description IS NULL
        OR (length(description) > 0 AND description = trim(description))
    ),
    file_id INT NOT NULL,
    file_type_check file_category DEFAULT 'pdf' CHECK (file_type_check = 'pdf'),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (file_id, file_type_check) REFERENCES files(id, category) ON DELETE RESTRICT
);

CREATE TABLE handout_topics (
    handout_id INT NOT NULL REFERENCES handouts(id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (handout_id, topic_id)
);

CREATE TABLE simulated_exams (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    title TEXT UNIQUE NOT NULL CHECK (
        length(title) <= 255
        AND length(title) > 0
        AND title = trim(title)
    ),
    description TEXT CHECK (
        description IS NULL
        OR (length(description) > 0 AND description = trim(description))
    ),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE simulated_exam_questions (
    simulated_exam_id INT NOT NULL REFERENCES simulated_exams(id) ON DELETE CASCADE,
    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    PRIMARY KEY (simulated_exam_id, question_id)
);

-- ==========================================
-- 4. LMS / CLASSROOM
-- ==========================================

CREATE TYPE group_access_type AS ENUM ('open', 'closed');
CREATE TYPE group_visibility_type AS ENUM ('public', 'private');

CREATE TABLE groups (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (
        length(name) <= 255 
        AND length(name) > 0 
        AND name = trim(name)
    ),
    description TEXT CHECK (
        description IS NULL
        OR (length(description) > 0 AND description = trim(description))
    ),
    access_type group_access_type NOT NULL DEFAULT 'closed',
    visibility_type group_visibility_type NOT NULL DEFAULT 'private',
    thumbnail_url TEXT CHECK (
        thumbnail_url IS NULL
        OR (length(thumbnail_url) > 0 AND thumbnail_url = trim(thumbnail_url))
    ),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE member_role AS ENUM ('admin', 'member');

CREATE TABLE group_members (
    group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role member_role DEFAULT 'member',
    accepted_by_id INT REFERENCES users(id) ON DELETE RESTRICT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE activities (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (
        length(title) <= 255
        AND length(title) > 0
        AND title = trim(title)
    ),
    description TEXT CHECK (
        description IS NULL
        OR (length(description) > 0 AND description = trim(description))
    ),
    due_date TIMESTAMPTZ NOT NULL,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(group_id, title)
);

CREATE TABLE activity_attachments (
    activity_id INT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    file_id INT NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
    PRIMARY KEY (activity_id, file_id)
);

CREATE TYPE activity_item_type AS ENUM (
    'question', 
    'video_lesson', 
    'handout', 
    'open_exercise_list', 
    'simulated_exam'
);

CREATE TABLE activity_items (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),

    order_index INT NOT NULL DEFAULT 0,
    title TEXT NOT NULL CHECK (
        length(title) <= 255
        AND length(title) > 0
        AND title = trim(title)
    ),
    description TEXT CHECK (
        description IS NULL
        OR (length(description) > 0 AND description = trim(description))
    ),
    activity_id INT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    question_id INT REFERENCES questions(id) ON DELETE RESTRICT,
    video_lesson_id INT REFERENCES video_lessons(id) ON DELETE RESTRICT,
    handout_id INT REFERENCES handouts(id) ON DELETE RESTRICT,
    open_exercise_list_id INT REFERENCES open_exercise_lists(id) ON DELETE RESTRICT,
    simulated_exam_id INT REFERENCES simulated_exams(id) ON DELETE RESTRICT,

    type activity_item_type GENERATED ALWAYS AS (
        CASE 
            WHEN question_id IS NOT NULL THEN 'question'::activity_item_type
            WHEN video_lesson_id IS NOT NULL THEN 'video_lesson'::activity_item_type
            WHEN handout_id IS NOT NULL THEN 'handout'::activity_item_type
            WHEN open_exercise_list_id IS NOT NULL THEN 'open_exercise_list'::activity_item_type
            WHEN simulated_exam_id IS NOT NULL THEN 'simulated_exam'::activity_item_type
        END
    ) STORED,

    UNIQUE(activity_id, order_index),
    CONSTRAINT activity_item_content_exclusive_check CHECK (
        num_nonnulls(
            question_id, 
            video_lesson_id, 
            handout_id, 
            open_exercise_list_id, 
            simulated_exam_id
        ) = 1
    )
);

-- ==========================================
-- 5. SUBMISSIONS
-- ==========================================

CREATE TYPE activity_submission_status AS ENUM ('pending', 'approved', 'reproved');

CREATE TABLE activity_submissions (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),

    activity_id INT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status activity_submission_status DEFAULT 'pending',
    notes TEXT CHECK (
        notes IS NULL
        OR (length(notes) > 0 AND notes = trim(notes))
    ),
    feedback_notes TEXT CHECK (
        feedback_notes IS NULL
        OR (length(feedback_notes) > 0 AND feedback_notes = trim(feedback_notes))
    ),
    reviewed_at TIMESTAMPTZ,
    reviewed_by_id INT REFERENCES users(id) ON DELETE RESTRICT,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(activity_id, user_id)
);

CREATE TABLE activity_submission_attachments (
    activity_submission_id INT NOT NULL REFERENCES activity_submissions(id) ON DELETE CASCADE,
    file_id INT NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
    PRIMARY KEY (activity_submission_id, file_id)
);

CREATE TABLE question_submissions (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),

    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_submission_id INT REFERENCES activity_submissions(id) ON DELETE SET NULL,
    simulated_exam_id INT REFERENCES simulated_exams(id) ON DELETE SET NULL,
    question_option_id INT REFERENCES question_options(id) ON DELETE SET NULL,
    answer_text TEXT CHECK (
        answer_text IS NULL
        OR (length(answer_text) > 0 AND answer_text = trim(answer_text))
    ),
    score INT CHECK (score IS NULL OR score BETWEEN 0 AND 100),
    answer_feedback TEXT CHECK (
        answer_feedback IS NULL
        OR (length(answer_feedback) > 0 AND answer_feedback = trim(answer_feedback))
    ),
    passed BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 6. TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema = 'public'
          AND table_name != 'schema_migrations'
    LOOP
        EXECUTE format('
            CREATE OR REPLACE TRIGGER set_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();',
            t);
    END LOOP;
END;
$$;