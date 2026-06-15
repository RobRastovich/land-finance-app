CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key VARCHAR(500) NOT NULL,
  name VARCHAR(255) NOT NULL,
  size BIGINT,
  content_type VARCHAR(100),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id),
  UNIQUE(project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
