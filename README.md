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
│   ├── routes/            # 路由（auth, cards, comments, assets, webhooks）
│   ├── services/          # 业务服务（notification）
│   ├── middleware/         # 中间件（auth, role）
│   ├── app.ts             # Express 应用配置
│   ├── server.ts          # 服务器入口
│   ├── db.ts              # PostgreSQL 连接池
│   ├── redis.ts           # Redis 客户端
│   ├── ws.ts              # WebSocket 服务
│   └── migrate.ts         # 数据库迁移
├── src/                    # 前端
│   ├── pages/             # 页面组件
│   ├── components/        # 公共组件
│   ├── store/             # Zustand 状态管理
│   ├── lib/               # 工具库（api 客户端）
│   └── hooks/             # 自定义 Hooks
├── shared/                 # 前后端共享类型
├── migrations/             # SQL 迁移脚本
├── docker-compose.yml      # Docker 编排
├── Dockerfile              # Docker 构建
└── .env.example            # 环境变量模板
```
