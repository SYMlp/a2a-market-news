## 调研笔记：Task 2.1 四层模型落地验证

**来源数量**: session.ts, scenes.ts, session-context.ts, game-loop.ts, grep import
**时间**: 2026-03-21

### 核心发现

- L0 (session.ts)、L1 (scenes/registry)、L2 (session-context)、L3 (game-loop) 代码映射正确
- **越层调用**: game-loop (L3) 直接 import persistSession from session (L0)
- session-context (L2) → session (L0) 为合理调用（L2 可调用 L0 持久化）

### 层间依赖图

```
L0 session.ts ←── session-context (L2)
     ↑              ↑
     |              |
     +──────────────+── game-loop (L3)
     |
     +── conversation-guard
```

### 越层调用清单

| 调用方 | 被调用方 | 函数 |
|:---|:---|:---|
| game-loop (L3) | session (L0) | persistSession |
| conversation-guard | session (L0) | persistSession |

### 本地文件索引

- 原始依赖: `raw/task-2-1-layer-deps.md`
