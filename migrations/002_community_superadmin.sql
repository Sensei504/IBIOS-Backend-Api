-- IBIOS community feed, complaint case chat, notifications, and single-super-admin policy.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student','faculty','staff','admin','super_admin'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_single_super_admin ON users (role) WHERE role = 'super_admin';
CREATE TABLE IF NOT EXISTS community_threads (
  id uuid PRIMARY KEY, author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title varchar(160) NOT NULL, body text NOT NULL, category varchar(40) NOT NULL DEFAULT 'General',
  is_pinned boolean NOT NULL DEFAULT false, is_locked boolean NOT NULL DEFAULT false,
  moderation_status varchar(16) NOT NULL DEFAULT 'published' CHECK (moderation_status IN ('published','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_community_threads_created_at ON community_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_community_threads_category ON community_threads(category);
CREATE INDEX IF NOT EXISTS ix_community_threads_author ON community_threads(author_id);
CREATE INDEX IF NOT EXISTS ix_community_threads_status_pinned ON community_threads(moderation_status,is_pinned,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_community_threads_search ON community_threads USING gin (to_tsvector('simple', title || ' ' || body));
CREATE TABLE IF NOT EXISTS thread_replies (
  id uuid PRIMARY KEY, thread_id uuid NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, parent_reply_id uuid REFERENCES thread_replies(id) ON DELETE CASCADE,
  body varchar(2000) NOT NULL, moderation_status varchar(16) NOT NULL DEFAULT 'published' CHECK (moderation_status IN ('published','hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_thread_replies_thread_created ON thread_replies(thread_id,created_at);
CREATE INDEX IF NOT EXISTS ix_thread_replies_author ON thread_replies(author_id);
CREATE TABLE IF NOT EXISTS thread_reactions (
  thread_id uuid NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (thread_id,user_id)
);
CREATE TABLE IF NOT EXISTS thread_flags (
  id uuid PRIMARY KEY, thread_id uuid REFERENCES community_threads(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES thread_replies(id) ON DELETE CASCADE, reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason varchar(32) NOT NULL, details varchar(500) NOT NULL DEFAULT '',
  status varchar(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','actioned')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((thread_id IS NOT NULL AND reply_id IS NULL) OR (thread_id IS NULL AND reply_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_thread_flags_status_created ON thread_flags(status,created_at DESC);
CREATE TABLE IF NOT EXISTS issue_messages (
  id uuid PRIMARY KEY, issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, body varchar(4000) NOT NULL,
  visibility varchar(16) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','internal')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_issue_messages_issue_created ON issue_messages(issue_id,created_at);
CREATE INDEX IF NOT EXISTS ix_issue_messages_author ON issue_messages(author_id);
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(40) NOT NULL, title varchar(160) NOT NULL, body varchar(500) NOT NULL DEFAULT '',
  href varchar(500) NOT NULL DEFAULT '/', is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notifications_user_created ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_notifications_unread ON notifications(user_id,is_read) WHERE is_read = false;
