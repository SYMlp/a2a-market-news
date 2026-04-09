# Scene Layout Architecture

**层级**: D2（与 `game-loop-architecture`、`script-engine-spec` 并列的界面结构说明）  
**范围**: Agent 空间内 `SceneShell` 的静态层、内容网格、物品栏（应用 dock）、与行为呈现 `card_deck` 的协作。

## 1. 设计目标

1. **匾额（SceneBanner）** 与 **背景图（SceneBackground）** 同属「场景静态层」：随场景挂载/卸载，不参与内容区 flex 流式排版，避免与对话区抢高度。
2. **可选列表类呈现**（`browse_apps`、`view_feedback` 等 `presentation.style: card_deck`）占用固定 **物品栏** 区域，不堆在 NPC 气泡下方，避免把角色「顶飞」。
3. **展示数量、标题、气泡截断策略** 由每场景 `configs.json` → `layout` 配置，与 API 上限对齐。

## 2. 渲染栈（由后到前）

| Z 顺序 | 层 | 组件 / 元素 |
|--------|----|-------------|
| 底 | 背景 | `SceneBackground`（每场景 PNG / fallback） |
| 上 | 粒子 + 扫描 | `scene-shell__bg` |
| 上 | 四角框线 | `scene-shell__frame` |
| 上 | **静态匾额** | `scene-shell__plaque-layer` → `SceneBanner`（`pointer-events: none`） |
| 最前 | 交互内容 | `scene-shell__content`（网格） |

匾额由 `SceneShell` 的 `plaque` prop 控制；仅在 `conversation` 阶段传入，与进入场景的生命周期一致。

## 3. 内容网格（`scene-shell__content`）

默认三行：

```text
hud     ← NavigationHUD
stage   ← CharacterStage（NPC / PA 面对面）
actions ← HoloActionPanel、顾问输入、SubFlow 卡片等
```

当存在 `card_deck` 且数据非空时，`dockActive` 为 true，插入第四行 **dock**：

```text
hud
stage
dock    ← SceneAppDock（物品栏）
actions
```

对应类名：`scene-shell__content--with-dock`。

## 4. 场景布局配置（`src/lib/scene-visuals/configs.json`）

每场景可选 `layout` 字段（与 `SceneLayoutConfig` 合并默认值，见 `getSceneLayout()`）：

| 字段 | 含义 |
|------|------|
| `maxAppDockItems` | 物品栏最多展示几条（超出部分仅数据存在，UI 截断） |
| `appDockTitle` | 物品栏标题（如「今日推荐应用」） |
| `shortNpcBubbleWhenDock` | 为 true 时，有 dock 且气泡过长则截断并提示看物品栏 |
| `npcBubbleMaxChars` | 截断长度上限 |
| `dockBubbleHint` | 截断后追加的说明文案 |

**日报栏（news）** 当前约定：`maxAppDockItems: 6`，与 `GET /api/gm/recommend` 返回条数上限一致。

## 5. 行为引擎协作

- `BehaviorSpec.presentation.style === card_deck` 时，服务端仍下发完整 `data[]`（或受 API 限制的最大条数）。
- 前端 `ConversationView` 使用 `getSceneLayout(scene).maxAppDockItems` 对 `data` 做 `slice`，并渲染 `SceneAppDock` + `DeckView variant="dock"`（横向滚动小卡片）。
- NPC 气泡使用截断后的文案，避免与卡片重复堆高。

## 6. 与文档 / 规则的同步

- 视觉约定摘要：`.cursor/rules/visual-conventions.mdc`
- 行为呈现抽象：`docs/behavior-spec-architecture.md`（`card_deck` 语义不变，仅落点从气泡槽改为 dock）

## 7. 扩展注意

- 新增场景若需物品栏：在 `configs.json` 为该场景增加 `layout`。
- 若某 API 返回条数 > `maxAppDockItems`，须在 dock 元信息中体现「展示 N / 总数」（已实现）。
- 修改 `maxAppDockItems` 时请同步检查对应 DataLoader / API 的 `slice` 上限，避免无意义的 payload。
