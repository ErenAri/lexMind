USE lexmind;

-- Create a test user with simple credentials for debugging
DELETE FROM users WHERE username = 'test';

-- Create test user (username: test, password: test)
INSERT INTO users (username, email, hashed_password, role, is_active) 
VALUES ('test', 'test@lexmind.com', '$2b$12$2cIsF.TmKiEOhf7YYh8L7u0JcKQ.mKfIqwHECPyq7QxKKbqCrIqzG', 'admin', TRUE);