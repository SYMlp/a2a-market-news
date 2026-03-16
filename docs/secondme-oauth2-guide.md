# SecondMe OAuth2 集成指南（本地存档）

> 来源：https://develop-docs.second.me/zh/docs/authentication/oauth2
> 存档时间：2026-03-16

## 授权码流程概览

```
1. 用户 → 重定向到 SecondMe 授权页面
2. 用户确认授权 → SecondMe 返回授权码到你的 redirect_uri
3. 你的服务端用授权码换取 Token
4. 用 Access Token 调用 API
```

## 步骤 1: 发起授权请求

```
https://go.second.me/oauth/?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&state=RANDOM_STATE
```

| 参数 | 必需 | 说明 |
|------|------|------|
| client_id | 是 | 应用的 Client ID |
| redirect_uri | 是 | 授权后的回调 URL，必须与应用配置一致 |
| response_type | 是 | 固定值 `code` |
| state | 是 | CSRF 保护参数 |

## 步骤 2: 换取 Token

```bash
curl -X POST "https://api.mindverse.com/gate/lab/api/oauth/token/code" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=lba_ac_xxxxx..." \
  -d "redirect_uri=https://your-app.com/callback" \
  -d "client_id=your_client_id" \
  -d "client_secret=your_client_secret"
```

> ⚠️ 必须用 `application/x-www-form-urlencoded`，不能用 JSON。

**响应:**
```json
{
  "code": 0,
  "data": {
    "accessToken": "lba_at_xxxxx...",
    "refreshToken": "lba_rt_xxxxx...",
    "tokenType": "Bearer",
    "expiresIn": 7200,
    "scope": ["user.info", "chat"]
  }
}
```

## 步骤 3: 使用 Token

```bash
curl -H "Authorization: Bearer lba_at_xxxxx..." \
  "https://api.mindverse.com/gate/lab/api/secondme/user/info"
```

## 步骤 4: 刷新 Token

```bash
curl -X POST "https://api.mindverse.com/gate/lab/api/oauth/token/refresh" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=lba_rt_xxxxx..." \
  -d "client_id=your_client_id" \
  -d "client_secret=your_client_secret"
```

> ⚠️ 刷新时会同时轮换 Refresh Token，旧的会失效。

## 本项目配置

| 配置 | 值 |
|------|-----|
| Client ID | `526d9920-c43c-4512-917d-5f59f706f087` |
| Redirect URI | `http://localhost:3000/api/auth/callback` |
| OAuth URL | `https://go.second.me/oauth/` |
| Token Endpoint | `https://app.mindos.com/gate/lab/api/oauth/token/code` |
| API Base | `https://app.mindos.com/gate/lab` |

## 在线调试工具

https://develop-docs.second.me/zh/docs/authentication/oauth2-debugger
