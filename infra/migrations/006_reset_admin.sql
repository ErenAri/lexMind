USE lexmind;

-- Completely reset admin user
DELETE FROM users WHERE username = 'admin';

-- Create fresh admin user with new hash
INSERT INTO users (username, email, hashed_password, role, is_active) 
VALUES ('admin', 'admin@lexmind.com', '$2b$12$.Fef3I4dKtEGbbulsiRKbeNH4GYdCMM8C7WvxTuNwPtyb64Tr.qwy', 'admin', TRUE);