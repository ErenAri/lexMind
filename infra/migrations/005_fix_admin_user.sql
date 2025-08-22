USE lexmind;

-- Remove any existing admin user and recreate with correct password
DELETE FROM users WHERE username = 'admin';

-- Insert admin user with correct bcrypt hash for 'admin123'
INSERT INTO users (username, email, hashed_password, role, is_active) 
VALUES ('admin', 'admin@lexmind.com', '$2b$12$HmS7kqggd17ods25o6SAx.lUg0GDLv1fzvRnzYjlPKJEzmUCH2jX2', 'admin', TRUE);