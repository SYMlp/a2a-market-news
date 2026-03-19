# SecondMe OAuth 2.0 认证模板

基于 Next.js 15 (App Router) 的 SecondMe OAuth 登录模板。
**零额外依赖**——无数据库，用户信息存在加密 Cookie 中。
复制到你的 Next.js 项目即可使用。

## 认证流程

```
浏览器                  你的应用                    SecondMe
  │                      │                          │
  │  GET /api/auth/login │                          │
  │ ───────────────────> │                          │
  │                      │                          │
  │  302 → SecondMe 登录页（带 client_id + redirect_uri）
  │ <─────────────────── │                          │
  │                      │                          │
  │  用户在 SecondMe 登录并授权                       │
  │ ─────────────────────────────────────────────>  │
  │                      │                          │
  │  302 → /api/auth/callback?code=xxx              │
  │ <─────────────────────────────────────────────  │
  │                      │                          │
  │                      │  POST token endpoint     │
  │                      │  (code + client_secret)  │
  │                      │ ──────────────────────>  │
  │                      │  ← access_token          │
  │                      │ <──────────────────────  │
  │                      │                          │
  │                      │  GET /user/info           │
  │                      │  (Bearer access_token)   │
  │                      │ ──────────────────────>  │
  │                      │  ← 用户资料               │
  │                      │ <──────────────────────  │
  │                      │                          │
  │  Set-Cookie (session) │                          │
  │  302 → /             │                          │
  │ <─────────────────── │                          │
```

## 文件结构

```
secondme-auth-starter/
├── README.md                          # 本文件
├── .env.example                       # 环境变量模板
└── src/
    ├── lib/
    │   └── auth.ts                    # OAuth 核心 + Cookie Session 管理
    └── app/api/auth/
        ├── login/route.ts             # GET → 跳到 SecondMe 登录
        ├── callback/route.ts          # SecondMe 回调 → 换Token → 写Cookie
        ├── me/route.ts                # GET → 返回当前用户信息
        └── logout/route.ts           # POST → 清Cookie登出
```

## 使用步骤

### 1. 在 SecondMe 开发者后台注册应用

前往 https://develop-docs.second.me/zh/docs 注册应用，获取：
- Client ID
- Client Secret
- 设置 Redirect URI（如 `http://localhost:3000/api/auth/callback`）

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填入你的值：

```bash
cp .env.example .env.local
```

### 3. 复制文件到你的项目

```
把 src/lib/auth.ts             → 你的项目 src/lib/auth.ts
把 src/app/api/auth/ 整个目录   → 你的项目 src/app/api/auth/
```

就这两步，不需要装额外依赖，不需要数据库。

### 4. 前端调用

```tsx
// 登录：直接跳转
<a href="/api/auth/login">使用 SecondMe 登录</a>

// 获取当前用户
const res = await fetch('/api/auth/me')
const { user } = await res.json()
// user 为 null 表示未登录
// user.id / user.name / user.email / user.avatarUrl

// 登出
await fetch('/api/auth/logout', { method: 'POST' })
```

## 如果你需要数据库

当前模板把用户信息存在 Cookie 里，适合轻量场景。
如果你需要持久化用户数据（比如关联业务表），可以：

1. 加 Prisma + PostgreSQL
2. 在 callback 里把用户 upsert 到 User 表
3. Cookie 只存 user_id，用户信息从数据库读

## 部署注意事项

- Vercel/线上环境的 `SECONDME_REDIRECT_URI` 要改成线上域名
- SecondMe 后台也要添加对应的线上回调地址
- 本地和线上可以共用同一个 Client ID，各配各的回调地址

## OAuth Scope 说明

默认申请的权限：

| Scope | 用途 |
|:---|:---|
| `user.info` | 基本用户信息（昵称、头像） |
| `user.info.shades` | 用户 Shades 数据 |
| `user.info.softmemory` | 用户 SoftMemory 数据 |
| `chat` | 聊天功能 |
| `note.add` | 笔记写入 |
| `voice` | 语音功能 |

按需在 `auth.ts` 的 `getAuthorizationUrl()` 中调整 `scope` 参数。

## 参考文档

- [SecondMe 快速入门](https://develop-docs.second.me/zh/docs)
- [OAuth2 指南](https://develop-docs.second.me/zh/docs/authentication/oauth2)
- [API 参考](https://develop-docs.second.me/zh/docs/api-reference/secondme)
- [错误码](https://develop-docs.second.me/zh/docs/errors)
