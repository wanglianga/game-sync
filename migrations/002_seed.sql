INSERT INTO teams (id, name, invite_code) VALUES ('a0000000-0000-0000-0000-000000000001', 'Demo Team', 'DEMO2024')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash, name, role) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'planner@demo.com', '$2a$10$dummyhash1planner1234567890abcd', '策划小明', 'planner'),
  ('b0000000-0000-0000-0000-000000000002', 'dev1@demo.com', '$2a$10$dummyhash1dev1234567890abcdefg', '程序员小红', 'programmer'),
  ('b0000000-0000-0000-0000-000000000003', 'dev2@demo.com', '$2a$10$dummyhash1dev2234567890abcdefg', '程序员小蓝', 'programmer'),
  ('b0000000-0000-0000-0000-000000000004', 'artist@demo.com', '$2a$10$dummyhash1artist234567890abc', '美术小花', 'artist')
ON CONFLICT (id) DO NOTHING;

INSERT INTO team_members (team_id, user_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004')
ON CONFLICT (team_id, user_id) DO NOTHING;
