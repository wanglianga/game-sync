-- 演示用种子数据：覆盖本周各种场景，用于验证三个角色周报差异
-- 假设本周范围为周一到周日，用NOW()来模拟近期数据

-- ========== 本周新增的卡片（策划视图用） ==========
INSERT INTO cards (id, team_id, creator_id, title, description, status, progress, priority, created_at, updated_at) VALUES
  ('c0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '新英雄技能系统', '设计一个新的远程英雄，包含3个主动技能和1个被动', 'requirement', 20, 'high',
   NOW() - interval '1 day', NOW() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '商城限时活动UI', '春节限时礼包活动界面，需要新增6个礼包展示位', 'requirement', 0, 'medium',
   NOW() - interval '2 days', NOW() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '公会战匹配优化', '优化匹配算法，减少跨服匹配等待时间', 'requirement', 0, 'low',
   NOW() - interval '3 days', NOW() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

-- ========== 待验收的卡片（策划视图用） ==========
INSERT INTO cards (id, team_id, creator_id, title, description, status, progress, priority, created_at, updated_at) VALUES
  ('c0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '登录界面重设计', '全新登录界面，包含第三方登录入口', 'review', 80, 'high',
   NOW() - interval '20 days', NOW() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '好友系统基础功能', '添加好友、删除好友、好友列表展示', 'review', 75, 'medium',
   NOW() - interval '15 days', NOW() - interval '6 hours')
ON CONFLICT (id) DO NOTHING;

-- ========== 开发中的卡片（多种状态用于不同视图） ==========
INSERT INTO cards (id, team_id, creator_id, title, description, status, progress, priority, created_at, updated_at) VALUES
  ('c0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '角色战斗动作重做', '重做战士角色的普攻和技能动作表现', 'development', 50, 'high',
   NOW() - interval '30 days', NOW() - interval '4 hours'),
  ('c0000000-0000-0000-0000-000000000302', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '副本场景-熔岩洞穴', '新增高级副本熔岩洞穴的场景和怪物', 'development', 35, 'high',
   NOW() - interval '25 days', NOW() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- ========== 分配卡片给成员 ==========
INSERT INTO card_assignees (card_id, user_id) VALUES
  -- 本周新增卡片
  ('c0000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000103', 'b0000000-0000-0000-0000-000000000002'),
  -- 待验收
  ('c0000000-0000-0000-0000-000000000201', 'b0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000201', 'b0000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000202', 'b0000000-0000-0000-0000-000000000003'),
  -- 开发中
  ('c0000000-0000-0000-0000-000000000301', 'b0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000301', 'b0000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000302', 'b0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000302', 'b0000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- ========== 逾期未确认的评论（策划视图用，3天+待确认） ==========
INSERT INTO comments (id, card_id, author_id, parent_id, content, status, created_at, updated_at) VALUES
  ('cm000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000201',
   'b0000000-0000-0000-0000-000000000002', NULL,
   '登录按钮点击区域太小，在移动端容易误触，建议扩大40%的热区范围。',
   'pending_confirm', NOW() - interval '5 days', NOW() - interval '5 days'),
  ('cm000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000202',
   'b0000000-0000-0000-0000-000000000003', NULL,
   '好友列表中，离线用户的排序逻辑和文档不一致。文档要求按最近登录时间排序，当前实现是按字母序。',
   'pending_confirm', NOW() - interval '4 days', NOW() - interval '4 days')
ON CONFLICT (id) DO NOTHING;

-- ========== 普通评论用于展示 ==========
INSERT INTO comments (id, card_id, author_id, parent_id, content, status, created_at, updated_at) VALUES
  ('cm000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000101',
   'b0000000-0000-0000-0000-000000000001', NULL,
   '请确认Q技能的冷却时间是8秒还是10秒？文档写的两处不一致。',
   'open', NOW() - interval '1 day', NOW() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- ========== webhook配置用于提交记录 ==========
INSERT INTO webhook_configs (id, team_id, created_by, repo_url, secret, created_at) VALUES
  ('wh000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001', 'https://git.example.com/game/repo', 'demo-secret-123',
   NOW() - interval '60 days')
ON CONFLICT (id) DO NOTHING;

-- ========== 本周提交的commits（程序视图用 - PR关联卡片） ==========
INSERT INTO commits (id, webhook_config_id, commit_hash, message, url, author, ref, committed_at) VALUES
  -- 程序员小红的提交
  ('co000000-0000-0000-0000-000000000001', 'wh000000-0000-0000-0000-000000000001',
   'a1b2c3d4e5f6789012345678901234567890abcd',
   'feat(hero): implement new hero Q skill animation and damage logic\n\nreferences #c0000000-0000-0000-0000-000000000101',
   'https://git.example.com/game/repo/commit/a1b2c3d', '程序员小红', 'refs/heads/main',
   NOW() - interval '2 days'),
  ('co000000-0000-0000-0000-000000000002', 'wh000000-0000-0000-0000-000000000001',
   'b2c3d4e5f6789012345678901234567890abcde1',
   'fix: resolve skill cooldown calculation issue in hero combat\n\ncloses #c0000000-0000-0000-0000-000000000101',
   'https://git.example.com/game/repo/commit/b2c3d4e', '程序员小红', 'refs/heads/main',
   NOW() - interval '1 day'),
  ('co000000-0000-0000-0000-000000000003', 'wh000000-0000-0000-0000-000000000001',
   'c3d4e5f6789012345678901234567890abcdef2',
   'refactor(guild): rewrite matchmaking queue to reduce cross-server wait\n\nreferences #c0000000-0000-0000-0000-000000000103',
   'https://git.example.com/game/repo/commit/c3d4e5f', '程序员小红', 'refs/heads/feature/matchmaking',
   NOW() - interval '6 hours'),
  -- 被退回卡片的提交（本周又更新但在开发状态）
  ('co000000-0000-0000-0000-000000000004', 'wh000000-0000-0000-0000-000000000001',
   'd4e5f6789012345678901234567890abcdef34',
   'fix(combat): adjust warrior attack animation timing per review comments\n\nreferences #c0000000-0000-0000-0000-000000000301',
   'https://git.example.com/game/repo/commit/d4e5f67', '程序员小红', 'refs/heads/main',
   NOW() - interval '4 hours'),
  -- 程序员小蓝的提交
  ('co000000-0000-0000-0000-000000000005', 'wh000000-0000-0000-0000-000000000001',
   'e5f6789012345678901234567890abcdef456',
   'feat(shop): implement limited-time event UI with 6 package slots\n\nreferences #c0000000-0000-0000-0000-000000000102',
   'https://git.example.com/game/repo/commit/e5f6789', '程序员小蓝', 'refs/heads/main',
   NOW() - interval '1 day'),
  ('co000000-0000-0000-0000-000000000006', 'wh000000-0000-0000-0000-000000000001',
   'f6789012345678901234567890abcdef56789a',
   'refactor(friends): fix friend sorting to use recent login time instead of alphabetical\n\nreferences #c0000000-0000-0000-0000-000000000202',
   'https://git.example.com/game/repo/commit/f678901', '程序员小蓝', 'refs/heads/main',
   NOW() - interval '8 hours')
ON CONFLICT (id) DO NOTHING;

-- ========== 关联commits到卡片 ==========
INSERT INTO card_commits (card_id, commit_id) VALUES
  ('c0000000-0000-0000-0000-000000000101', 'co000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000101', 'co000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000103', 'co000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000301', 'co000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000102', 'co000000-0000-0000-0000-000000000005'),
  ('c0000000-0000-0000-0000-000000000202', 'co000000-0000-0000-0000-000000000006')
ON CONFLICT DO NOTHING;

-- ========== 素材（美术视图用） ==========
INSERT INTO assets (id, team_id, uploaded_by, filename, original_name, mime_type, size, url, thumbnail_url, version, status, description, created_at) VALUES
  -- 本周新上传素材
  ('as000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   'hero-splash-new.png', '新英雄-立绘.png', 'image/png', 2048576, '/uploads/hero-splash-new.png', '/uploads/hero-splash-new.png',
   1, 'pending', '新英雄的初始立绘，全身像', NOW() - interval '2 days'),
  ('as000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   'hero-icon-new.png', '新英雄-头像.png', 'image/png', 102400, '/uploads/hero-icon-new.png', '/uploads/hero-icon-new.png',
   1, 'pending', '新英雄的头像图标', NOW() - interval '1 day'),
  -- 本周新上传且已确认
  ('as000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   'warrior-skins.png', '战士皮肤合集.png', 'image/png', 1536000, '/uploads/warrior-skins.png', '/uploads/warrior-skins.png',
   1, 'confirmed', '战士角色的3种新皮肤', NOW() - interval '3 days'),
  -- 待确认素材（更早上传）
  ('as000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   'lava-bg-v1.png', '熔岩洞穴背景v1.png', 'image/png', 4096000, '/uploads/lava-bg-v1.png', '/uploads/lava-bg-v1.png',
   1, 'pending', '熔岩洞穴副本主背景图', NOW() - interval '10 days'),
  ('as000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   'lava-boss.png', '熔岩BOSS立绘.png', 'image/png', 3145728, '/uploads/lava-boss.png', '/uploads/lava-boss.png',
   1, 'pending', '熔岩洞穴最终BOSS造型', NOW() - interval '8 days')
ON CONFLICT (id) DO NOTHING;

-- ========== 关联素材到卡片 ==========
INSERT INTO card_assets (card_id, asset_id, confirmed) VALUES
  -- 新英雄素材（未确认，本周上传）
  ('c0000000-0000-0000-0000-000000000101', 'as000000-0000-0000-0000-000000000001', false),
  ('c0000000-0000-0000-0000-000000000101', 'as000000-0000-0000-0000-000000000002', false),
  -- 战士皮肤（已确认，本周上传）
  ('c0000000-0000-0000-0000-000000000301', 'as000000-0000-0000-0000-000000000003', true),
  -- 熔岩洞穴素材（未确认）
  ('c0000000-0000-0000-0000-000000000302', 'as000000-0000-0000-0000-000000000004', false),
  ('c0000000-0000-0000-0000-000000000302', 'as000000-0000-0000-0000-000000000005', false),
  -- 登录界面已确认素材（本周之前）
  ('c0000000-0000-0000-0000-000000000201', 'as000000-0000-0000-0000-000000000003', true)
ON CONFLICT DO NOTHING;

-- ========== 需求文档版本（需求变更检测用） ==========
-- 新英雄初始版本
INSERT INTO requirement_docs (card_id, content, version, updated_by, updated_at) VALUES
  ('c0000000-0000-0000-0000-000000000101',
   '# 新英雄设计\n被动：每3次普攻回复血量\nQ：远程射箭 冷却8秒', 1,
   'b0000000-0000-0000-0000-000000000001', NOW() - interval '2 days'),
  -- 熔岩洞穴初始版本
  ('c0000000-0000-0000-0000-000000000302',
   '# 熔岩副本设计\n3层关卡，BOSS血量10万', 1,
   'b0000000-0000-0000-0000-000000000001', NOW() - interval '25 days'),
  -- 熔岩洞穴本周更新（触发需求变更）
  ('c0000000-0000-0000-0000-000000000302',
   '# 熔岩副本设计-v2\n5层关卡，BOSS血量提升到20万，新增2个精英怪点', 2,
   'b0000000-0000-0000-0000-000000000001', NOW() - interval '1 day'),
  -- 战士动作重做初始版本
  ('c0000000-0000-0000-0000-000000000301',
   '# 战士动作\n普攻3连击，技能前摇0.3秒', 1,
   'b0000000-0000-0000-0000-000000000001', NOW() - interval '30 days'),
  -- 战士本周需求变更
  ('c0000000-0000-0000-0000-000000000301',
   '# 战士动作-v2\n普攻改为5连击，技能前摇缩短到0.2秒，添加技能命中特效', 2,
   'b0000000-0000-0000-0000-000000000001', NOW() - interval '3 days')
ON CONFLICT DO NOTHING;
