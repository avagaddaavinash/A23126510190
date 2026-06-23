CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

CREATE TABLE IF NOT EXISTS students (
    student_id   SERIAL PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    email        VARCHAR(200) UNIQUE NOT NULL,
    password     VARCHAR(255) NOT NULL,
    roll_number  VARCHAR(50)  UNIQUE NOT NULL,
    department   VARCHAR(100),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active       BOOLEAN   DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS notifications (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id       INT  REFERENCES students(student_id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL,
    message          TEXT NOT NULL,
    is_read          BOOLEAN   DEFAULT FALSE,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata         JSONB     DEFAULT '{}'    -- flexible extra payload
);

CREATE INDEX IF NOT EXISTS idx_notifications_student_id
    ON notifications (student_id);

CREATE INDEX IF NOT EXISTS idx_notifications_student_unread
    ON notifications (student_id, created_at DESC)
    WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_type_date
    ON notifications (notification_type, created_at DESC);

INSERT INTO students (name, email, password, roll_number, department)
VALUES ('avinash', 'avinash@anits.edu.in', 'hashed_pw', 'A23126510190', 'CSE')
ON CONFLICT DO NOTHING;
