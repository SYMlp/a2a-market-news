## 调研笔记：Task 3.1 Human Space 6 领域边界验证

**来源数量**: human-space-domain-map, circles, practices, pa-directory, pa-action, gamification routes
**时间**: 2026-03-21

### 核心发现

- Gamification、PA Actions 有独立 lib，逻辑内聚
- Community、Practices、PA Directory 为 "Logic is inline"，符合 domain-map 描述
- PA Directory 读取 AchievementUnlock（gamification 数据），为跨域数据依赖

### 内聚度评分

| 领域 | 内聚度 | 说明 |
|:---|:---|:---|
| Gamification | High | 独立 lib，API 薄 |
| PA Actions | High | pa-actions + gamification |
| Developer | Medium | notification.ts，其余 inline |
| Community | Low | 全 inline |
| Practices | Low | 全 inline |
| PA Directory | Low | 全 inline，依赖 gamification 数据 |

### 跨域调用清单

- gamification.reward-pipeline → pa-actions.logPAAction
- pa-action routes → gamification (addPoints, rewardReview, incrementDailyTask)
- pa-directory → AchievementUnlock (Prisma 模型，非 lib)
