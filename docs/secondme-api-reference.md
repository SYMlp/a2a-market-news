# SecondMe API 参考（本地存档）

> 来源：https://develop-docs.second.me/zh/docs/api-reference/secondme
> 存档时间：2026-03-16
> Base URL: `https://api.mindverse.com/gate/lab`（官方文档）
> 本项目实际使用: `https://app.mindos.com/gate/lab`（.env 配置）

## 认证方式

所有 API 均要求 OAuth2 Token（无 app 级调用方式）。

```
Authorization: Bearer lba_at_your_access_token
```

## 权限 (Scopes)

| 权限 | 说明 |
|------|------|
| `user.info` | 访问用户基础信息（姓名、邮箱、头像等） |
| `user.info.shades` | 访问用户兴趣标签 |
| `user.info.softmemory` | 访问用户软记忆 |
| `note.add` | 添加笔记和记忆 |
| `chat` | 访问聊天功能 |
| `voice` | 使用语音功能 |

## 令牌类型和有效期

| 令牌类型 | 前缀 | 有效期 |
|----------|------|--------|
| Authorization Code | `lba_ac_` | 5 分钟 |
| Access Token | `lba_at_` | 2 小时 |
| Refresh Token | `lba_rt_` | 30 天 |

---

## GET /api/secondme/user/info

获取用户基础信息。权限: `user.info`

**响应:**
```json
{
  "code": 0,
  "data": {
    "userId": "12345678",
    "name": "Username",
    "email": "user@example.com",
    "avatar": "https://cdn.example.com/avatar.jpg",
    "bio": "Personal bio",
    "selfIntroduction": "Self introduction content",
    "profileCompleteness": 85,
    "route": "username"
  }
}
```

---

## GET /api/secondme/user/shades

获取用户兴趣标签。权限: `user.info.shades`

**响应:**
```json
{
  "code": 0,
  "data": {
    "shades": [
      {
        "id": 123,
        "shadeName": "Tech Enthusiast",
        "shadeIcon": "https://...",
        "confidenceLevel": "HIGH",
        "shadeDescription": "Passionate about technology",
        "shadeContent": "Loves coding and gadgets",
        "sourceTopics": ["programming", "AI"],
        "hasPublicContent": true
      }
    ]
  }
}
```

---

## GET /api/secondme/user/softmemory

获取用户软记忆（个人知识库）。权限: `user.info.softmemory`

**参数:**
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| keyword | string | 否 | 搜索关键词 |
| pageNo | integer | 否 | 页码（默认1） |
| pageSize | integer | 否 | 每页条数（默认20，最大100） |

**响应:**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 456,
        "factObject": "Hobbies",
        "factContent": "Enjoys reading science fiction novels",
        "createTime": 1705315800000,
        "updateTime": 1705315800000
      }
    ],
    "total": 100
  }
}
```

---

## POST /api/secondme/chat/stream

流式对话。权限: `chat`

**请求头:**
| Header | 必需 | 说明 |
|--------|------|------|
| Authorization | 是 | Bearer Token |
| Content-Type | 是 | application/json |
| X-App-Id | 否 | 应用ID，默认 `general` |

**请求参数:**
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| message | string | 是 | 用户消息内容 |
| sessionId | string | 否 | 会话ID，不传则自动生成 |
| model | string | 否 | `anthropic/claude-sonnet-4-5`(默认) 或 `google_ai_studio/gemini-2.0-flash` |
| systemPrompt | string | 否 | **系统提示词，仅在新session首次请求生效** |
| enableWebSearch | boolean | 否 | 启用网页搜索，默认false |

**请求示例（带 systemPrompt）:**
```bash
curl -X POST "https://api.mindverse.com/gate/lab/api/secondme/chat/stream" \
  -H "Authorization: Bearer lba_at_your_access_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, introduce yourself",
    "systemPrompt": "Please reply in a friendly tone"
  }'
```

**响应（SSE）:**
```
event: session
data: {"sessionId": "labs_sess_a1b2c3d4e5f6"}

data: {"choices": [{"delta": {"content": "Hello"}}]}
data: {"choices": [{"delta": {"content": "! I am..."}}]}
data: [DONE]
```

**启用 WebSearch 时的事件流:**
```
event: tool_call
data: {"toolName": "web_search", "status": "searching"}

event: tool_result
data: {"toolName": "web_search", "query": "tech news", "resultCount": 5}

data: {"choices": [{"delta": {"content": "Based on search results..."}}]}
data: [DONE]
```

---

## POST /api/secondme/act/stream

结构化动作判断（返回 JSON）。权限: `chat`

**请求参数:**
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| message | string | 是 | 用户消息内容 |
| actionControl | string | 是 | 动作控制指令（20-8000字符），定义JSON结构和判断规则 |
| model | string | 否 | 同 chat/stream |
| sessionId | string | 否 | 会话ID |
| systemPrompt | string | 否 | 系统提示词 |

**actionControl 要求:**
- 包含判断规则和信息不足时的 fallback 规则
- 包含 JSON 结构示例（带花括号）
- 长度 20-8000 字符

**示例:**
```bash
curl -X POST "https://api.mindverse.com/gate/lab/api/secondme/act/stream" \
  -H "Authorization: Bearer lba_at_your_access_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I really love this product, it is amazing!",
    "actionControl": "Output only a valid JSON object, no explanation.\nStructure: {\"is_liked\": boolean}.\nIf the user explicitly expresses liking or support, set is_liked=true;\notherwise is_liked=false."
  }'
```

---

## POST /api/secondme/note/add

> ⚠️ 当前不可用。已弃用，未来将移除。如需上报信息给AI分身，请使用 Agent Memory Ingest。

---

## POST /api/secondme/tts/generate

文字转语音。权限: `voice`

**参数:**
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| text | string | 是 | 要转换的文字（最大10000字符） |
| emotion | string | 否 | `happy`/`sad`/`angry`/`fearful`/`disgusted`/`surprised`/`calm`/`fluent`(默认) |

**响应:**
```json
{
  "code": 0,
  "data": {
    "url": "https://cdn.example.com/tts/audio_12345.mp3",
    "durationMs": 2500,
    "sampleRate": 24000,
    "format": "mp3"
  }
}
```

---

## POST /api/secondme/agent_memory/ingest

上报用户行为事件到 Agent Memory Ledger。无需特定 scope。

**参数:**
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| channel | ChannelInfo | 是 | 渠道信息 |
| action | string | 是 | 动作类型（`post`, `reply`, `operate` 等） |
| refs | RefItem[] | 是 | 证据引用数组（至少1项） |
| actionLabel | string | 否 | 动作显示文本 |
| displayText | string | 否 | 可读摘要 |
| importance | number | 否 | 重要度 0.0~1.0 |
| idempotencyKey | string | 否 | 幂等键，防重复 |

---

## GET /api/secondme/chat/session/list

获取聊天会话列表。权限: `chat`

**参数:** `appId` (可选, 按应用ID筛选)

---

## GET /api/secondme/chat/session/messages

获取会话消息历史。权限: `chat`

**参数:** `sessionId` (必需)

---

## 通用响应格式

**成功:** `{ "code": 0, "data": { ... } }`
**错误:** `{ "code": 403, "message": "...", "subCode": "oauth2.scope.insufficient" }`
**认证失败:** `{ "detail": "需要认证" }`

## 常见错误码

| 错误码 | 说明 |
|--------|------|
| oauth2.scope.insufficient | 缺少所需权限 |
| oauth2.token.expired | Access Token 过期 |
| oauth2.code.invalid | 授权码无效或过期 |
| oauth2.client.secret_mismatch | Client Secret 错误 |
| secondme.user.invalid_id | 无效用户ID |
| secondme.stream.error | 流式响应错误 |
| secondme.act.action_control.empty | actionControl 为空 |
| secondme.act.action_control.invalid_format | 缺少 JSON 结构示例 |
