CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(200) NOT NULL,
    role VARCHAR(50) NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    price DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL
);

CREATE TABLE lessons (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    status VARCHAR(50) DEFAULT 'active',
    is_deleted BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, course_id)
);

CREATE TABLE lesson_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    is_completed BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, lesson_id)
);

CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    title VARCHAR(255) NOT NULL,
    max_score INTEGER DEFAULT 100
);

CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT,
    score INTEGER NULL
);

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE certificates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    code VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending'
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE
);

CREATE TABLE materials (
    id SERIAL PRIMARY KEY,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    title VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE discussions (
    id SERIAL PRIMARY KEY,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_courses_teacher ON courses(teacher_id);
CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_lessons_module ON lessons(module_id);

CREATE INDEX idx_courses_active ON courses(id) WHERE is_deleted = FALSE;

CREATE INDEX idx_enrollments_user_course ON enrollments(user_id, course_id);

CREATE INDEX idx_users_email_hash ON users USING HASH (email);

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_courses_timestamp
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_lessons_timestamp
    BEFORE UPDATE ON lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_discussions_timestamp
    BEFORE UPDATE ON discussions
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE PROCEDURE sp_enroll_user(
    p_user_id INTEGER,
    p_course_id INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO enrollments (user_id, course_id, status)
    VALUES (p_user_id, p_course_id, 'active')
    ON CONFLICT (user_id, course_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_delete_course(
    p_course_id INTEGER,
    p_user_id INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE courses
    SET is_deleted = TRUE,
        updated_by = p_user_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_course_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_complete_lesson(
    p_user_id INTEGER,
    p_lesson_id INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO lesson_progress (user_id, lesson_id, is_completed)
    VALUES (p_user_id, p_lesson_id, TRUE)
    ON CONFLICT (user_id, lesson_id)
    DO UPDATE SET is_completed = TRUE;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_submit_assignment(
    p_assignment_id INTEGER,
    p_user_id INTEGER,
    p_content TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO submissions (assignment_id, user_id, content)
    VALUES (p_assignment_id, p_user_id, p_content);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_grade_submission(
    p_submission_id INTEGER,
    p_score INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE submissions
    SET score = p_score
    WHERE id = p_submission_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_add_review(
    p_course_id INTEGER,
    p_user_id INTEGER,
    p_rating INTEGER,
    p_comment TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO reviews (course_id, user_id, rating, comment)
    VALUES (p_course_id, p_user_id, p_rating, p_comment);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_issue_certificate(
    p_user_id INTEGER,
    p_course_id INTEGER,
    OUT p_code VARCHAR(100)
)
LANGUAGE plpgsql
AS $$
BEGIN
    p_code := 'CERT-' || p_course_id || '-' || p_user_id || '-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT;
    
    INSERT INTO certificates (user_id, course_id, code)
    VALUES (p_user_id, p_course_id, p_code);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_process_payment(
    p_user_id INTEGER,
    p_course_id INTEGER,
    p_amount DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO payments (user_id, course_id, amount, status)
    VALUES (p_user_id, p_course_id, p_amount, 'completed');
    
    CALL sp_enroll_user(p_user_id, p_course_id);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_notify(
    p_user_id INTEGER,
    p_message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO notifications (user_id, message)
    VALUES (p_user_id, p_message);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_course(
    p_course_id INTEGER,
    p_title VARCHAR(255),
    p_price DECIMAL(10,2),
    p_user_id INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE courses
    SET title = p_title,
        price = p_price,
        updated_by = p_user_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_course_id;
END;
$$;

CREATE OR REPLACE VIEW v_active_courses AS
SELECT 
    c.id,
    c.title,
    u.name as teacher_name,
    cat.name as category,
    c.price
FROM courses c
JOIN users u ON c.teacher_id = u.id
JOIN categories cat ON c.category_id = cat.id
WHERE c.is_deleted = FALSE;

CREATE OR REPLACE VIEW v_user_enrollments AS
SELECT 
    e.id,
    e.user_id,
    u.name as user_name,
    c.id as course_id,
    c.title as course_title,
    e.status
FROM enrollments e
JOIN users u ON e.user_id = u.id
JOIN courses c ON e.course_id = c.id
WHERE e.is_deleted = FALSE;

CREATE OR REPLACE VIEW v_course_stats AS
SELECT 
    c.id as course_id,
    c.title,
    COUNT(DISTINCT e.user_id) as total_students,
    COALESCE(AVG(r.rating), 0) as avg_rating,
    COUNT(DISTINCT r.id) as total_reviews
FROM courses c
LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_deleted = FALSE
LEFT JOIN reviews r ON c.id = r.course_id AND r.is_deleted = FALSE
WHERE c.is_deleted = FALSE
GROUP BY c.id, c.title;

INSERT INTO users (email, password_hash, name, role) VALUES
('teacher@example.com', 'hash1', 'John Teacher', 'teacher'),
('student@example.com', 'hash2', 'Jane Student', 'student'),
('admin@example.com', 'hash3', 'Admin User', 'admin');

INSERT INTO categories (name) VALUES
('Programming'),
('Design'),
('Business');

INSERT INTO courses (title, teacher_id, category_id, price) VALUES
('Introduction to PostgreSQL', 1, 1, 49.99);

WITH u AS (
  SELECT id FROM users WHERE email = 'student@example.com'
), c AS (
  SELECT id FROM courses WHERE title = 'Introduction to PostgreSQL' AND is_deleted = FALSE
)
INSERT INTO enrollments (user_id, course_id, status)
SELECT u.id, c.id, 'active' FROM u, c
ON CONFLICT (user_id, course_id) DO NOTHING;