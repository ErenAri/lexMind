USE lexmind;

-- Users table for authentication and authorization
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  hashed_password VARCHAR(255) NOT NULL,
  role ENUM('viewer', 'analyst', 'admin') DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Insert default admin user (password: admin123)
-- Note: This hash is for 'admin123' using bcrypt (generated with Python passlib)
INSERT IGNORE INTO users (username, email, hashed_password, role, is_active) 
VALUES ('admin', 'admin@lexmind.com', '$2b$12$HmS7kqggd17ods25o6SAx.lUg0GDLv1fzvRnzYjlPKJEzmUCH2jX2', 'admin', TRUE);