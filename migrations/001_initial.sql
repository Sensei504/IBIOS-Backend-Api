CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  username varchar(32) NOT NULL UNIQUE,
  email varchar(254) NOT NULL UNIQUE,
  full_name varchar(100) NOT NULL,
  password_hash varchar(255) NOT NULL,
  role varchar(16) NOT NULL DEFAULT 'student' CHECK (role IN ('student','faculty','staff','admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_users_role ON users(role);
CREATE TABLE IF NOT EXISTS refresh_sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), last_used_at timestamptz, revoked_at timestamptz, user_agent varchar(500)
);
CREATE INDEX IF NOT EXISTS ix_refresh_sessions_user_id ON refresh_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_sessions_expiry ON refresh_sessions(expires_at) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY, title varchar(120) NOT NULL, description text NOT NULL,
  category varchar(40) NOT NULL CHECK (category IN ('Academics','Facilities','IT & Internet','Student Services','Enrollment & Registrar','Safety & Security','Finance','Other')),
  priority varchar(16) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Critical')),
  status varchar(24) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Under Discussion','Resolved','Closed')),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_issues_title ON issues(title);
CREATE INDEX IF NOT EXISTS ix_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS ix_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS ix_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS ix_issues_reporter_id ON issues(reporter_id);
CREATE INDEX IF NOT EXISTS ix_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_issues_status_priority ON issues(status, priority);
CREATE INDEX IF NOT EXISTS ix_issues_search ON issues USING gin (to_tsvector('simple', title || ' ' || description));
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY, issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  text varchar(250) NOT NULL, author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_accepted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_positions_issue_id ON positions(issue_id);
CREATE INDEX IF NOT EXISTS ix_positions_author_id ON positions(author_id);
CREATE INDEX IF NOT EXISTS ix_positions_created_at ON positions(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_positions_one_accepted_per_issue ON positions(issue_id) WHERE is_accepted = true;
CREATE TABLE IF NOT EXISTS arguments (
  id uuid PRIMARY KEY, position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  type varchar(8) NOT NULL CHECK (type IN ('pro','con')), text varchar(200) NOT NULL,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_arguments_position_id ON arguments(position_id);
CREATE INDEX IF NOT EXISTS ix_arguments_author_id ON arguments(author_id);
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY, position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_vote_position_user UNIQUE (position_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS ix_votes_position_id ON votes(position_id);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(80) NOT NULL, entity_type varchar(50) NOT NULL, entity_id varchar(80),
  details jsonb NOT NULL DEFAULT '{}'::jsonb, ip_address varchar(64), user_agent varchar(500), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS ix_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS ix_audit_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_created_action ON audit_logs(created_at DESC, action);
