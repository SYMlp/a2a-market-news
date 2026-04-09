# A2A 智选日报 - 领域本体

## 1. 开发背景

我们在一个 **A2A（Agent-to-Agent）软件平台** 上搭建应用。

### 平台基础单位：PA（Person Agent）

- 每个现实的人注册并上传自己的**虚拟身份**，即 PA
- PA 是平台中最基础的实体单位
- 我们的任务是**给 PA 搭建应用**

### 赛道选择

| 赛道 | 定位 | 目标 |
|------|------|------|
| 赛道一 | 实用型 | 做一个"有用"的产品，解决实际场景需求 |
| 赛道二 | 娱乐型 | 让 A2A 好玩，用游戏让交互更直观 |
| 赛道三 | 实验型 | Visionary，做完全没人做过的疯狂��验 |

**本项目定位**：赛道一 - 实用型（A2A 市场信息服务）

---

## 2. 核心实体

### 2.1 PA（Person Agent）

平台最基础单位，代表一个人的虚拟身份。

**属性**：
- `route` - PA 的唯一标识路由
- `name` - 显示名称
- `email` - 关联邮箱
- `avatarUrl` - 头像
- `shades` - 兴趣标签（数组）
- `softmemory` - 软记忆（数组）

### 2.2 应用（App）

为 PA 提供服务的程序。

**属性**：
- `appId` - 应用唯一标识
- `client_id` - OAuth 客户端 ID
- `client_secret` - OAuth 客户端密钥
- `redirect_uri` - 授权回调地址
- `scopes` - 请求的权限范围

### 2.3 会话（Session）

PA 与应用之间的交互上下文。

**属性**：
- `sessionId` - 会话唯一标识（前缀 `labs_sess_`）
- `messages` - 消息列表

### 2.4 笔记（Note）

PA 存储的结构化信息。

**属性**：
- `noteId` - 笔记 ID
- `content` - 内容

---

## 3. 可用 API 能力

### 3.1 认证模块（auth）

| 能力 | 说明 |
|------|------|
| OAuth2 授权 | 获取用户授权，换取 access_token |
| Token 刷新 | 使用 refresh_token 刷新过期 token |

**Token 生命周期**：
- Authorization Code: 5 分钟
- Access Token: 2 小时
- Refresh Token: 30 天

### 3.2 用户信息模块（profile）

| API | 数据路径 | 说明 |
|-----|---------|------|
| `/api/secondme/user/info` | `result.data` | 基础信息（email, name, avatarUrl, route） |
| `/api/secondme/user/shades` | `result.data.shades` | 兴趣标签数组 |
| `/api/secondme/user/softmemory` | `result.data.list` | 软记忆数组 |

### 3.3 聊天模块（chat）

| API | 数据路径 | 说明 |
|-----|---------|------|
| `/api/secondme/chat/session/list` | `result.data.sessions` | 会话列表 |
| `/api/secondme/chat/session/messages` | `result.data.messages` | 会话消息 |
| `/api/secondme/chat/stream` | SSE 流 | 流式对话 |

### 3.4 结构化动作模块（act）

| API | 说明 |
|-----|------|
| `/api/secondme/act/stream` | 结构化 JSON 输出，用于意图判断、分类决策 |

**适用场景**：
- 情感/意图判断
- 是/否决策
- 多分类判断

### 3.5 笔记模块（note）

| API | 数据路径 | 说明 |
|-----|---------|------|
| `/api/secondme/note/add` | `result.data.noteId` | 添加笔记 |

### 3.6 语音模块（voice）

待补充具体 API。

---

## 4. API 配置

```
Base URL: https://app.mindos.com/gate/lab
OAuth URL: https://go.second.me/oauth/
Token Endpoint: https://app.mindos.com/gate/lab/oauth/token
```

**本项目配置**：
- Client ID: `526d9920-c43c-4512-917d-5f59f706f087`
- Redirect URI: `http://localhost:3000/api/auth/callback`
- Scopes: `user.info`, `user.info.shades`, `user.info.softmemory`, `chat`, `note.add`, `voice`

---

## 5. 响应格式

所有 API 统一响应格式：

```json
{
  "code": 0,
  "data": { ... }
}
```

**处理原则**：始终从 `result.data` 提取实际数据。

---

## 6. 待定义

- [ ] A2A 市场中的"应用"实体定义
- [ ] 排行榜维度和评分规则
- [ ] 评选/竞赛机制
- [ ] Agent 自荐流程

---

*文档版本: v0.1*
*更新时间: 2026-02-10*
