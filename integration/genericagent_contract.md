# GenericAgent × RedShrimp Integration Contract

## 1. 文档目标
本文档定义 GenericAgent 在 GA-only 方案下如何调用 RedShrimp，包括：

- 在什么时机调用
- 传什么结构化输入
- 期待什么结构化输出
- 如何消费 `decision`
- 调用失败时如何回退
- 哪些数据需要落盘，便于后续复盘

本文档默认前提：

- 不修改 GenericAgent 源码
- 不引入小红书 MCP
- GenericAgent 继续负责网页操作、抓取、发布、记录
- RedShrimp 只负责策略分析与结构化决策

---

## 2. 角色边界

### 2.1 GenericAgent 负责
GenericAgent 是执行层，负责：

- 打开和操作小红书网页
- 抓取搜索结果、帖子详情、账号主页、发布页信息
- 将原始网页数据整理为 RedShrimp 可消费的输入对象
- 调用 RedShrimp 对应任务
- 按返回结果执行 `publish / revise / skip`
- 落盘输入、输出、发布记录与结果记录

### 2.2 RedShrimp 负责
RedShrimp 是策略层，负责：

- 分析 observed posts
- 生成发帖策略
- 审查待发草稿
- 复盘已发布内容
- 统一输出结构化 decision 与 next actions

---

## 3. 调用时机

### 3.1 analyze_viral_post
在以下时机调用：

- GenericAgent 已抓取一批目标赛道帖子
- 需要提炼近期内容模式或爆点特征
- 需要为后续发帖方案提供参考输入

### 3.2 generate_post_plan
在以下时机调用：

- 已具备账号画像
- 已具备最近发布记录
- 已具备一定数量的 observed posts
- 需要决定“这次发什么、怎么发、是否值得发”

这是发前阶段的主入口任务。

### 3.3 pre_publish_review
在以下时机调用：

- 已经有待发布草稿
- GenericAgent 准备真正点击发布前
- 需要再次判断是否应发布、修改或放弃

### 3.4 postmortem
在以下时机调用：

- 某条内容发布后一段时间后
- 已回收到曝光、点赞、收藏、评论、涨粉等结果
- 需要生成复盘结论与下一轮迭代建议

---

## 4. 任务名约定
GenericAgent 调用 RedShrimp 时，`task` 字段建议固定使用以下枚举之一：

- `analyze_viral_post`
- `generate_post_plan`
- `pre_publish_review`
- `postmortem`

不建议使用自由命名，否则容易导致 prompt、schema、pipeline 之间不一致。

---

## 5. 输入契约

## 5.1 通用输入外层
所有任务建议采用统一外层结构：

```json
{
  "task": "generate_post_plan",
  "request_id": "rs_20250810_001",
  "platform": "xiaohongshu",
  "account_profile": {},
  "recent_posts": [],
  "observed_posts": [],
  "draft_content": null,
  "publish_result": null,
  "goal": "increase_followers",
  "constraints": {
    "platform": "xiaohongshu",
    "content_type": "image_text"
  },
  "context": {
    "source": "genericagent",
    "collected_at": "2025-08-10T21:00:00Z"
  }
}
```

说明：

- `task`：当前请求任务类型
- `request_id`：建议由 GenericAgent 生成，便于日志与样例对齐
- `platform`：当前固定为 `xiaohongshu`
- `account_profile`：账号画像对象
- `recent_posts`：最近发布内容摘要
- `observed_posts`：观测到的赛道帖子
- `draft_content`：仅在发前审查时必需
- `publish_result`：仅在 postmortem 时必需
- `goal`：本轮增长目标，如涨粉、互动、曝光
- `constraints`：平台、内容形式、风险边界等
- `context`：采集来源与时间等辅助上下文

---

### 5.2 各任务最低必填字段

#### analyze_viral_post
最低建议必填：

- `task`
- `observed_posts`
- `constraints.platform`

可选增强：

- `account_profile`
- `goal`

#### generate_post_plan
最低建议必填：

- `task`
- `account_profile`
- `recent_posts`
- `observed_posts`
- `goal`
- `constraints`

#### pre_publish_review
最低建议必填：

- `task`
- `draft_content`
- `account_profile`
- `constraints`

可选增强：

- `strategy_output`
- `recent_posts`

#### postmortem
最低建议必填：

- `task`
- `publish_result`
- `account_profile`

可选增强：

- `recent_posts`
- `observed_posts`
- `goal`
- 历史 baseline 数据

---

## 6. 输出契约

### 6.1 统一输出外层
所有任务都应尽量返回统一外层结构：

```json
{
  "task": "generate_post_plan",
  "decision": "publish",
  "summary": "建议围绕学生党平价穿搭做一篇可立即发布的图文笔记",
  "risk_alerts": [],
  "scores": {
    "topic_potential": 0.81,
    "fit_account": 0.76,
    "novelty": 0.62,
    "risk": 0.18
  },
  "why": [
    "近期该赛道在通勤和开学场景有稳定需求",
    "该主题与账号现有受众较匹配"
  ],
  "next_actions": [
    "优先从标题候选中选择更具体的一版",
    "封面突出价格锚点与前后对比"
  ],
  "task_specific_payload": {}
}
```

统一字段说明：

- `task`：对应输入任务名
- `decision`：最终动作建议
- `summary`：一句话说明结论
- `risk_alerts`：风险提示
- `scores`：评分对象，范围建议为 0~1
- `why`：支撑判断的关键原因
- `next_actions`：下一步可执行动作
- `task_specific_payload`：任务专属结果体

---

### 6.2 decision 枚举与含义
`decision` 只建议使用以下 3 个值：

- `publish`：可以继续发布或推进执行
- `revise`：可做，但需要先修改
- `skip`：当前不建议做

不建议输出其它别名，例如 `go`、`hold`、`reject`，以避免消费层分支复杂化。

---

### 6.3 各任务的 task_specific_payload

#### analyze_viral_post
建议包含：

```json
{
  "patterns": {
    "title_patterns": [],
    "cover_patterns": [],
    "body_patterns": [],
    "tag_patterns": []
  },
  "hooks": [],
  "audience_fit": [],
  "copy_risks": [],
  "notes": []
}
```

#### generate_post_plan
建议包含：

```json
{
  "recommended_topic": "...",
  "content_plan": {
    "angle": "...",
    "title_candidates": ["..."],
    "cover_direction": "...",
    "body_structure": ["..."],
    "tags": ["..."]
  },
  "publish_window": "21:00-22:30"
}
```

#### pre_publish_review
建议包含：

```json
{
  "blocking_issues": [],
  "must_fix": [],
  "nice_to_fix": [],
  "approved_version_notes": []
}
```

#### postmortem
建议包含：

```json
{
  "effective_factors": [],
  "weak_factors": [],
  "keep_next_time": [],
  "change_next_time": [],
  "next_experiments": []
}
```

---

## 7. GenericAgent 如何消费 decision

### 7.1 当 decision = publish
GenericAgent 应：

1. 继续使用 task_specific_payload 中的具体方案
2. 若当前任务是 `generate_post_plan`，则进入内容组织或发布动作
3. 若当前任务是 `pre_publish_review`，则可直接进入最终发布
4. 记录本次决策与执行时间

### 7.2 当 decision = revise
GenericAgent 应：

1. 不立即发布
2. 将 `must_fix`、`risk_alerts`、`next_actions` 作为修改清单
3. 修改后可再次调用 `pre_publish_review` 或重新生成方案
4. 记录“修改前版本”和“修改后版本”的关联

### 7.3 当 decision = skip
GenericAgent 应：

1. 停止当前发布动作
2. 记录跳过原因
3. 视情况回到重新抓取、重新选题或等待下一时间窗口
4. 不应在未修改前提下强行发布

---

## 8. 失败回退策略

### 8.1 RedShrimp 返回非结构化文本
若输出无法解析为预期结构：

- 视为调用失败
- GenericAgent 不直接执行发布
- 将原始输出落盘到失败日志
- 重新触发一次同任务调用，或进入人工检查队列

### 8.2 缺关键字段
若缺少以下关键字段之一：

- `decision`
- `why`
- `next_actions`

则视为部分失败。处理方式：

- 优先重试一次
- 若仍失败，则降级为 `skip`
- 记录缺失字段清单

### 8.3 输入不足
若 GenericAgent 尚未收集到最小输入，例如：

- observed_posts 太少
- account_profile 缺失
- publish_result 缺失

则不应强行调用对应任务，而应：

- 先补抓数据
- 或改调用更适合的任务
- 或直接记录“因输入不足跳过”

### 8.4 发布链路保护
只要 RedShrimp 输出不可信、不可解析或风险过高，GenericAgent 默认不发布。

也就是说：

> 失败时宁可保守跳过，也不要在高不确定性下自动发帖。

---

## 9. 落盘建议

### 9.1 建议至少落盘的对象
每次调用建议保留：

- 原始输入对象
- RedShrimp 原始输出
- 解析后的结构化输出
- GenericAgent 实际执行结果
- 发布时间与内容版本
- 发后结果快照

### 9.2 request_id 串联
建议所有对象都带上同一个 `request_id` 或 `post_id`，用于串联：

- 输入
- 策略输出
- 发帖动作
- 发后复盘

这样后续做样例回放和 AB 对比会更容易。

---

## 10. 最小接入建议

### 10.1 第一阶段只接 2 条主线
优先接入：

1. `generate_post_plan`
2. `postmortem`

因为它们最直接支撑“发前决策 + 发后复盘”闭环。

### 10.2 爆款分析作为增强输入
`analyze_viral_post` 可以先作为独立分析任务存在，其输出再并入 `generate_post_plan` 的参考输入。

### 10.3 发前审查后补
`pre_publish_review` 适合作为闭环稳定后增加的第二道保险，而不是最早阻塞项。

---

## 11. 契约稳定性原则
为避免后续联调混乱，第一阶段建议遵守以下原则：

- task 名称固定，不随 prompt 文案变化
- decision 枚举固定为 `publish / revise / skip`
- 所有输出尽量走统一外层
- 新增字段优先追加，不随意改名
- schema 一旦给出示例，prompt 与 examples 必须与之对齐

---

## 12. 与后续文件的关系
本文档会直接约束后续文件：

- `schemas/strategy_output.json`：定义统一输出结构
- `prompts/*.md`：必须产出本契约兼容的字段
- `pipelines/*.md`：必须说明何时调用、如何落盘、如何回退
- `examples/inputs/*` 与 `examples/outputs/*`：必须给出符合本契约的样例