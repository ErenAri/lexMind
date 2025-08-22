USE lexmind;

-- Conversations table to group chat messages
CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  user_id BIGINT,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_conversations_user_id (user_id),
  INDEX idx_conversations_created_at (created_at DESC)
);

-- Messages table for individual chat messages
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  conversation_id BIGINT NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  metadata JSON NULL, -- For storing document references, confidence scores, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_conversation_id (conversation_id),
  INDEX idx_messages_created_at (created_at DESC),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);