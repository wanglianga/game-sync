# GameSync

面向小型独立游戏团队的异地协作项目管理工具，核心诉求是"减少信息同步的损耗"。

## 原始需求

> 四个人异地做一个独立游戏，一个策划、两个程序、一个美术。需要一个项目管理工具，核心诉求是"减少信息同步的损耗"。策划写的需求文档程序看不到最新版、美术画的素材程序不知道去哪里下载、修好的Bug策划不验证就关了——这些问题经常发生。要求：不同角色看到的界面不同但数据是同一套（前端框架自选，后端推荐Node.js或Go）。策划可以创建"功能卡片"并关联一组需求、美术素材、代码提交记录。程序提PR时可以勾选解决了哪个功能卡片，系统自动更新卡片状态（需要集成Git仓库的Webhook）。美术上传新素材后，所有依赖这个素材的功能卡片会被标记"待确认"。另外需要一个"同步墙"视图：像看板一样展示所有功能卡片的进度，但进度不是手拖的，而是系统根据关联的代码提交、素材上传、测试结果自动计算出来的。还要支持异步审阅：策划早上留了一条评论，程序晚上看到后修改代码并回复，策划第二天点一下"确认通过"这条评论才算关闭。整个系统要让人感觉"不用主动去同步，信息自己流过来"。数据库用PostgreSQL存核心数据，Redis做实时通知。

## 技术栈

- **前端**: React 18 + TypeScript + TailwindCSS 3 + Vite + Zustand
- **后端**: Express 4 + TypeScript (ESM)
- **数据库**: PostgreSQL 16
- **缓存/实时**: Redis 7
- **实时通信**: WebSocket (ws)
- **图标**: Lucide React

## 核心功能

- **同步墙看板**: 四列看板（需求中/开发中/待确认/已完成），进度由系统自动计算，不可手动拖拽
- **功能卡片**: 策划创建卡片，关联需求文档、美术素材、代码提交
- **自动状态计算**: 需求文档(20%) + 素材确认(30%) + 代码提交(30%) + 评论关闭(20%) = 总进度
- **Git Webhook 集成**: 程序提 PR 时自动关联功能卡片，系统自动更新状态
- **素材依赖追踪**: 美术上传素材后，关联的功能卡片标记"待确认"
- **异步审阅流**: 评论 → 回复 → 确认通过，策划确认后评论才关闭
- **角色差异化视图**: 策划/程序/美术看到不同优先信息，但数据统一
- **实时通知**: WebSocket + Redis Pub/Sub 推送变更

## 启动方式

### 前置要求

- Docker & Docker Compose（推荐方式）
- 或手动方式需要：Node.js 20+、PostgreSQL 16、Redis 7、npm

### Docker 一键启动（推荐）

```bash
docker compose up --build
```

后台运行：

```bash
docker compose up --build -d
```

停止并清理：

```bash
docker compose down
```

访问地址：http://localhost:3000

> Docker 启动会自动包含 PostgreSQL、Redis 和应用服务。数据库迁移在服务启动时自动执行。首次启动后可使用邀请码 `DEMO2024` 注册账号。

### 手动启动

#### 前置要求

- Node.js 20+
- PostgreSQL 16（需创建 gamesync 数据库）
- Redis 7
- npm

#### 1. 配置环境变量

```bash
cp .env.example .env
```

按需修改 `.env` 中的数据库连接、Redis 地址和 JWT 密钥。

#### 2. 安装依赖

```bash
npm install
```

#### 3. 启动服务

启动后端 + 前端开发服务器：

```bash
npm run dev
```

仅启动前端开发服务器：

```bash
npm run client:dev
```

仅启动后端开发服务器：

```bash
npm run server:dev
```

访问地址：
- 前端：http://localhost:5173
- 后端 API：http://localhost:3001

## 环境变量

| 变量名 | 说明 | 必填 | 默认值 |
|--------|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | 是 | `postgresql://postgres:postgres@localhost:5432/gamesync` |
| `REDIS_URL` | Redis 连接地址 | 是 | `redis://localhost:6379` |
| `JWT_SECRET` | JWT 签名密钥 | 是 | `gamesync-dev-secret` |
| `PORT` | 后端服务端口 | 否 | `3001` |

## 项目结构

```
├── api/                    # 后端 API
│   ├── routes/            # 路由（auth, cards, comments, assets, webhooks, reports, notifications）
│   ├── services/          # 业务服务（notification, scheduler, weeklyReport）
│   ├── middleware/         # 中间件（auth）
│   ├── app.ts             # Express 应用配置
│   ├── server.ts          # 服务器入口
│   ├── db.ts              # PostgreSQL 连接池
│   ├── redis.ts           # Redis 客户端
│   ├── ws.ts              # WebSocket 服务
│   └── migrate.ts         # 数据库迁移
├── src/                    # 前端
│   ├── pages/             # 页面组件（Home, CardDetail, Assets, Webhooks, Reports, Notifications）
│   ├── components/        # 公共组件
│   ├── store/             # Zustand 状态管理（auth, notifications）
│   ├── lib/               # 工具库（api 客户端, utils）
│   └── hooks/             # 自定义 Hooks
├── shared/                 # 前后端共享类型
├── migrations/             # SQL 迁移脚本（003 周报, 004 演示数据, 005 通知逾期标记）
├── docker-compose.yml      # Docker 编排
├── Dockerfile              # Docker 构建
└── .env.example            # 环境变量模板
```

## 周报快照功能说明

### 功能概述

每周日自动为团队每个角色生成一份差异化周报快照。支持手动触发重新生成和导出 Markdown 格式。

### 三个角色差异化视图

| 角色 | 周报内容模块 |
|------|--------------|
| **策划** | ① 本周新增卡片 ② 待验收卡片（status=review）③ 逾期未确认评论（待确认超过3天） |
| **程序** | ① 本周提交PR关联的卡片 ② 被退回的PR/卡片 ③ 等待素材的卡片（有提交但无确认素材） |
| **美术** | ① 本周被引用素材的卡片 ② 待确认素材的卡片 ③ 需求变更的卡片（本周需求文档版本>1） |

### 触发方式

1. **自动触发**：服务器每小时检查一次，若当天是周日则自动为所有团队生成周报（每天最多执行一次）
2. **手动触发-个人**：登录后进入「周报快照」页面，点击「重新生成我的周报」
3. **手动触发-全团队**：策划角色可见「生成全团队周报」按钮，一键为所有团队成员重新生成

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports/weekly/me` | 获取当前用户最新周报 |
| GET | `/api/reports/weekly/team` | 获取本团队所有人周报（可传 `weekStart` / `weekEnd` 查询参数） |
| POST | `/api/reports/weekly/generate` | 手动重新生成当前用户周报（body 可传 weekStart/weekEnd 指定周期） |
| POST | `/api/reports/weekly/generate-all` | （仅策划）为全团队生成周报 |
| GET | `/api/reports/weekly/:id/preview` | 预览某周报的 Markdown 内容 |
| GET | `/api/reports/weekly/:id/export` | 下载某周报的 Markdown 文件 |

### 演示验证步骤

1. **注册三个角色账号**（或使用种子数据，首次 Docker 启动后可通过邀请码 `DEMO2024` 注册）
   - 策划邮箱：`planner@demo.com`
   - 程序邮箱：`dev1@demo.com` / `dev2@demo.com`
   - 美术邮箱：`artist@demo.com`
2. 登录任一账号 → 进入左侧导航「周报快照」
3. 点击「重新生成我的周报」或策划点击「生成全团队周报」
4. 在「团队周报」列表中依次预览三个角色的周报：
   - **策划周报**显示：新增卡片(3)、待验收(2)、逾期评论(2)
   - **程序周报**显示：PR关联卡片、被退回卡片、等素材卡片
   - **美术周报**显示：素材引用卡片、待确认素材、需求变更卡片
5. 点击「导出」下载对应的 `.md` 文件，验证 Markdown 结构
