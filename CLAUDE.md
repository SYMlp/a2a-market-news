# A2A 智选日报【A2A Market News】

这是一个基于 SecondMe 的 A2A 市场信息平台项目。

## SecondMe 集成

### 已启用模块

- ✅ **auth** - OAuth 登录
- ✅ **profile** - 用户信息（user.info, shades, softmemory）
- ✅ **chat** - 聊天功能
- ✅ **note** - 笔记功能
- ✅ **voice** - 语音功能

### API 配置

- **Client ID**: 526d9920-c43c-4512-917d-5f59f706f087
- **Redirect URI**: http://localhost:3000/api/auth/callback
- **API Base**: https://app.mindos.com/gate/lab
- **OAuth URL**: https://go.second.me/oauth/

### 数据库

- **类型**: PostgreSQL
- **连接**: 已配置在 `.env.local`

## 技术栈

- **框架**: Next.js 15+ (App Router)
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: SecondMe OAuth 2.0
- **UI**: React + TailwindCSS
- **语言**: TypeScript

## 参考文档

- [SecondMe 快速入门](https://develop-docs.second.me/zh/docs)
- [OAuth2 指南](https://develop-docs.second.me/zh/docs/authentication/oauth2)
- [API 参考](https://develop-docs.second.me/zh/docs/api-reference/secondme)
- [错误码](https://develop-docs.second.me/zh/docs/errors)

## 注意事项

⚠️ **安全提醒：**
- `.secondme/` 目录包含敏感配置，已添加到 `.gitignore`
- 不要将 `.env.local` 提交到版本控制
