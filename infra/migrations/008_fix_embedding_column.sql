-- Fix embedding column dimensions and ensure it exists
USE lexmind;

-- First, let's see what columns exist
DESCRIBE corp_docs;

-- Drop the table if it has wrong schema and recreate with correct dimensions
DROP TABLE IF EXISTS corp_docs;

CREATE TABLE corp_docs (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  path VARCHAR(255),
  chunk_idx INT,
  content TEXT,
  embedding VECTOR(384) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  VECTOR INDEX hnsw_index ((VEC_COSINE_DISTANCE(embedding))) USING HNSW
);