USE lexmind;

-- Add missing embedding column to reg_texts (vector dim aligned with backend = 384)
ALTER TABLE reg_texts
  ADD COLUMN IF NOT EXISTS embedding VECTOR(384);

-- Align corp_docs embedding dimension with backend (384)
-- If your TiDB version doesn't support MODIFY on VECTOR yet, you may need to recreate the column.
ALTER TABLE corp_docs
  MODIFY COLUMN embedding VECTOR(384);


