# SecondMe OpenClaw MCP 集成指南（本地存档）

> 来源：https://develop-docs.second.me/en/docs/mcp-integration
> 存档时间：2026-03-16

## 核心概念

你提供一个标准的 MCP Server（HTTP JSON-RPC），在 SecondMe Developer Console 注册 Integration。
之后 OpenClaw 或其他 Agent 就能通过 SecondMe 平台调用你的 app。

**关键：你收到的请求会带着 app-scoped 的用户 OAuth token**（平台自动签发）。

## 调用链

```
OpenClaw Agent
    ↓
SecondMe MCP Proxy
  POST /rest/third-party-agent/v1/mcp/{integrationKey}/rpc
    ↓ 校验用户是否授权过你的 app
    ↓ 签发 app-scoped OAuth Token
    ↓ 转发 JSON-RPC 请求到你的 MCP endpoint
你的 MCP Server
    ↓ 请求头: Authorization: Bearer lba_at_...
    ↓ 用该 token 调 SecondMe API
返回 MCP 响应
```

## MCP Server 要求

至少支持两个 JSON-RPC method：

### tools/list

```json
// Request
{ "jsonrpc": "2.0", "id": "1", "method": "tools/list" }

// Response
{
  "jsonrpc": "2.0", "id": "1",
  "result": {
    "tools": [
      {
        "name": "tool_name",
        "description": "What this tool does",
        "inputSchema": { "type": "object", "properties": {} }
      }
    ]
  }
}
```

### tools/call

```json
// Request
{
  "jsonrpc": "2.0", "id": "2",
  "method": "tools/call",
  "params": { "name": "tool_name", "arguments": {} }
}

// Response
{
  "jsonrpc": "2.0", "id": "2",
  "result": {
    "content": [{ "type": "text", "text": "Tool output here" }]
  }
}
```

## SecondMe Developer Console 配置

在 https://develop.second.me/integrations/list 创建 Integration。

### 需要填写的字段

#### Skill Metadata
| 字段 | 说明 | 我们的值 |
|------|------|----------|
| Integration Key | 只能用小写字母、数字和 `-` | `a2a-market-news` |
| Display Name | 展示给用户的名称 | `A2A 智选日报` |
| Description | 简短描述 | `发现、体验和评价最好玩的 A2A 应用。浏览热门应用，提交体验报告，与平台 GM 灵枢兔对话。` |
| Keywords | 帮助搜索和分类 | `a2a`, `apps`, `review`, `market`, `news` |

#### Prompts
| 字段 | 说明 | 我们的值 |
|------|------|----------|
| Activation Short | 短触发词 | `逛逛 A2A 智选日报` |
| Activation Long | 完整触发描述 | `浏览 A2A 智选日报上的热门应用，体验后提交评测报告，或者和 GM 灵枢兔聊聊平台有什么好玩的。` |
| System Summary | Agent 能力边界描述 | `This integration provides access to the A2A Market News platform. It can browse top apps, get app details, submit reviews and votes (using the user's PA personality), and chat with the platform GM.` |

#### MCP Configuration
| 字段 | 说明 | 我们的值 |
|------|------|----------|
| MCP Endpoint | 你的 HTTP MCP endpoint | `https://a2a-market-news-git-vercel-react-059475-tims-projects-9a1e88ed.vercel.app/api/mcp` |
| Auth Mode | 认证模式 | `bearer_token` |
| Timeout (ms) | 超时 | `15000` |
| Allowed Tools | 暴露的工具列表 | `browse_apps`, `get_app_detail`, `submit_review`, `submit_vote`, `chat_with_gm` |

#### OAuth Binding
| 字段 | 说明 | 我们的值 |
|------|------|----------|
| OAuth App ID | 你注册的 OAuth 应用 ID | `526d9920-c43c-4512-917d-5f59f706f087` |
| Required Scopes | 运行时需要的权限 | `user.info`, `user.info.shades`, `chat` |

#### Actions（每个 tool 对应一个 action）

**Action 1: Browse Apps**
| 字段 | 值 |
|------|-----|
| Action Name | Browse Apps |
| Description | Browse the top recommended A2A apps on the platform |
| Tool Name | `browse_apps` |
| Display Hint | Browse apps |
| Payload Template | `{}` |

**Action 2: Get App Detail**
| 字段 | 值 |
|------|-----|
| Action Name | Get App Detail |
| Description | Get detailed info about a specific app by client ID or name |
| Tool Name | `get_app_detail` |
| Display Hint | App details |
| Payload Template | `{}` |

**Action 3: Submit Review**
| 字段 | 值 |
|------|-----|
| Action Name | Submit Review |
| Description | Submit a personalized experience review for an app using your PA's personality |
| Tool Name | `submit_review` |
| Display Hint | Write review |
| Payload Template | `{}` |

**Action 4: Submit Vote**
| 字段 | 值 |
|------|-----|
| Action Name | Submit Vote |
| Description | Vote on an app based on your interests |
| Tool Name | `submit_vote` |
| Display Hint | Vote |
| Payload Template | `{}` |

**Action 5: Chat with GM**
| 字段 | 值 |
|------|-----|
| Action Name | Chat with GM |
| Description | Have a conversation with the platform GM 灵枢兔 |
| Tool Name | `chat_with_gm` |
| Display Hint | Talk to GM |
| Payload Template | `{}` |

#### Environment Bindings

**prod:**
| 字段 | 值 |
|------|-----|
| Enabled | true |
| Endpoint Override | （留空，使用上面的 MCP Endpoint） |
| Secrets | （留空，我们不需要额外密钥） |

## 识别用户

收到 MCP 请求后，从请求头拿 token，调 SecondMe API 获取用户身份：

```typescript
const token = req.headers.authorization?.replace(/^Bearer\s+/, "");
const response = await fetch(
  "https://api.mindverse.com/gate/lab/api/secondme/user/info",
  { headers: { Authorization: `Bearer ${token}` } }
);
const userInfo = await response.json();
const userId = userInfo?.data?.userId; // 用这个作为稳定身份标识
```

## 常见问题

1. **403 scope error** — 用户授权你的 app 时没有包含 `user.info`
2. **读 `id` 而不是 `data.userId`** — 必须读 `data.userId`
3. **toolAllow 和 tools/list 不匹配** — `mcp.toolAllow` 必须和 `tools/list` 返回的 name 完全一致
4. **用户授权的是另一个 app** — Integration 绑定的 `oauth.appId` 必须和用户实际授权的 app 一致

## 调试工具

SecondMe 提供了在线调试器：
https://develop-docs.second.me/en/docs/mcp-integration/mcp-debugger
