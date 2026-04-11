# RedShrimp Pipeline: Generate Post Plan

## 1. 目标
定义 GenericAgent 如何基于账号现状、近期发布记录、赛道观察与增长目标，整理输入并调用 RedShrimp 的 `generate_post_plan`，生成一条当前最值得尝试的小红书内容方案，并将结果落盘，供后续创作与发前审查使用。

该 pipeline 负责：
1. 汇总账号与赛道上下文
2. 构造统一输入对象
3. 调用 RedShrimp 生成结构化发帖方案
4. 校验并保存输出，供草稿创作与后续 review 使用

它不直接负责点击发布；真正执行发布动作仍由 GenericAgent 完成。

---

## 2. 适用时机
在以下条件满足时执行：
- 已具备账号画像
- 已具备最近发布内容摘要
- 已具备一定数量的 observed posts 或上一轮爆款分析结果
- 需要决定“这次发什么、怎么发、是否值得发”

这是发前阶段的主入口 pipeline。

---

## 3. 参与角色
### 3.1 GenericAgent 负责
- 收集账号画像、最近发布记录与赛道观察结果
- 必要时先调用 `analyze_viral_post`
- 将多源信息整理为统一输入
- 调用 RedShrimp 的 `generate_post_plan`
- 校验结构化输出
- 将结果落盘，并交给后续内容生成或发前审查流程

### 3.2 RedShrimp 负责
- 基于目标、账号定位与赛道样本给出当前最优先内容方向
- 输出结构化的选题、角度、标题候选、正文结构、标签与风险提醒
- 使用统一 `strategy_output` schema 返回可消费结果
- 给出 `publish / revise / skip` 级别的策略建议

---

## 4. 前置输入
最低建议具备：
- `task = "generate_post_plan"`
- `account_profile`
- `recent_posts`
- `observed_posts`
- `goal`
- `constraints`

可选增强输入：
- 上一轮 `analyze_viral_post` 结果
- 当前账号阶段说明
- 本轮优先资源约束
- 历史表现 baseline
- 赛道禁区或品牌限制

---

## 5. 推荐流程

### Step 1. 汇总账号状态
GenericAgent 先整理当前账号的关键信息，至少包括：
- 账号定位
- 受众画像
- 最近内容方向
- 当前内容形式偏好
- 近期表现变化
- 可接受风险边界

这些信息应尽量映射到 `schemas/account_profile.json`，避免临时自由文本描述过多。

### Step 2. 汇总 recent_posts
从最近发布内容中提取摘要，建议覆盖：
- 最近几篇的主题
- 标题方向
- 内容形式
- 发布时间
- 可见表现摘要
- 是否出现重复角度
- 哪些内容已经测试过

目的不是完整复刻历史，而是让 RedShrimp 避免重复输出已经试过的方案。

### Step 3. 汇总 observed_posts
收集本轮赛道观察结果，可直接传入清洗后的 `observed_posts`，也可附带上一轮 `analyze_viral_post` 的结论。

建议至少保证：
- 样本与当前目标赛道强相关
- 字段结构一致
- 有基本互动信号
- 能支持判断标题、封面、正文与标签模式

若 observed posts 质量很差，先补抓或先完成爆款分析，不建议直接进入发帖方案生成。

### Step 4. 明确 goal 与 constraints
在调用前，GenericAgent 应显式定义本轮目标与约束，例如：
- 目标偏向涨粉、收藏、互动或曝光
- 内容形式是图文还是视频
- 是否有品牌、风格、合规边界
- 是否限制夸张表达、营销表达、医疗/功效类表述等

如果 goal 不明确，RedShrimp 输出容易泛化。

### Step 4.5 平台发布页可见约束回填
若 GenericAgent 已实际打开小红书创作服务平台发布页，应把“页面上真实可见”的约束写回 `constraints` 或 `context`，避免方案脱离发布端能力。

本轮在网页端图文发布页可直接观测到的信号包括：
- 发布入口含 `上传视频`、`上传图文`、`写长文`
- 当前图文页存在 `上传图片` 与 `文字配图` 两种入口
- 页面文案显示：单张图片最大 `32MB`
- 支持格式文案显示：推荐 `png / jpg / jpeg / webp`
- 页面明确显示：`不支持 gif、live 及其转化后的图片`
- 分辨率说明：`不限制宽高比例`，但推荐 `3:4` 至 `2:1`
- 分辨率说明：推荐图片分辨率 `不低于 720*960`
- 页面提示：`超过1280P的图片用网页端上传画质更清晰`
- 文字配图页编辑区实测为 `ProseMirror`
- 空态占位文案为 `真诚分享经验或资讯，提个问题也不错`
- 在编辑区输入文本后，页面会出现 `自动保存于 HH:MM` 状态文案
- 文字配图页可见 `再写一张` 入口与 `生成图片` 按钮，说明该流支持“先写文案，再生成图片/卡片”
- 页面可见 `草稿箱(0)` 与 `自动保存于 HH:MM`，说明发布前存在草稿/自动保存状态信号
- 对 `生成图片 / 下一步 / 发布` 这类按钮，普通 JS click 可能无效；执行侧应预留 CDP 真实点击方案

因此在生成发帖方案时，至少建议补入如下约束语义：
- 若选择图文方案，封面与配图必须可由静态图片承载，不依赖 GIF / Live Photo
- 图片建议优先落在网页端推荐比例区间内，避免后续裁切与构图损失
- 若方案依赖高清细节图，可在执行侧标注“优先网页端上传”
- 若需要 AI 生成配图，应确保输出格式和分辨率能落到上述可见约束内

这些约束来自真实页面可见文案，优先级高于经验性假设。

### Step 5. 组装请求对象
按统一输入外层组织请求，例如：

```json
{
  "task": "generate_post_plan",
  "request_id": "rs_xhs_plan_001",
  "platform": "xiaohongshu",
  "account_profile": {},
  "recent_posts": [],
  "observed_posts": [],
  "draft_content": null,
  "publish_result": null,
  "goal": "increase_followers",
  "constraints": {
    "platform": "xiaohongshu",
    "content_type": "image_text",
    "risk_boundary": [
      "no_false_claims",
      "no_over_marketing"
    ]
  },
  "context": {
    "source": "genericagent",
    "strategy_stage": "pre_publish_planning"
  }
}
```

可选增强：
- 将 `analyze_viral_post` 的核心结果写入 `context` 或补充字段
- 将近期测试失败原因附在 `context`
- 将本轮不可重复的主题写入 `constraints`

### Step 6. 调用 RedShrimp
向 RedShrimp 发起：
- `task = "generate_post_plan"`

期望返回统一 `strategy_output`，其中重点包括：
- `decision`
- `summary`
- `risk_alerts`
- `scores`
- `why`
- `next_actions`
- `task_specific_payload`

`task_specific_payload` 通常可包含：
- `recommended_topic`
- `angle`
- `title_candidates`
- `cover_direction`
- `body_structure`
- `tags`
- `publish_window`
- `avoid_points`
- `cta_direction`

### Step 7. 校验输出
GenericAgent 在消费前应检查：
- `task` 是否为 `generate_post_plan`
- `decision` 是否为约定枚举
- 输出是否符合统一 schema
- 是否提供了足够具体、可落地的内容方案
- 若 `decision = revise`，是否说明了关键缺口
- 若 `decision = skip`，是否说明放弃原因与替代方向

若输出只有空泛建议，如“做更有价值的内容”，应判定为不可直接执行。

### Step 8. 结果分流
根据 `decision` 进行后续处理：

#### 8.1 `publish`
表示该方向可直接进入内容起草或成稿阶段。
- GenericAgent 可据此生成草稿
- 若已有草稿，可进一步进入 `pre_publish_review`

#### 8.2 `revise`
表示方向可做，但当前信息不足或方案需调整。
- 优先根据 `next_actions` 补充观察数据、修正角度或收紧约束
- 必要时重新调用 `generate_post_plan`

#### 8.3 `skip`
表示当前方向不值得继续投入。
- 记录放弃原因
- 切换目标主题、受众切口或内容形式后再重新规划

### Step 9. 落盘
建议至少保存：

1. **输入快照**
   - 请求 JSON
   - account_profile 快照
   - recent_posts 摘要
   - observed_posts 或分析结论引用

2. **输出快照**
   - RedShrimp 返回的完整 JSON
   - 本轮最终采用的方案摘要

3. **执行衔接资料**
   - 准备用于写草稿的标题候选
   - 正文结构与标签建议
   - 风险提醒与禁止项

---

## 6. 推荐目录组织
可按批次保存，例如：

```text
runs/
  generate_post_plan/
    2025-08-xx_plan_001/
      input.json
      output.json
      plan_summary.md
      references.json
```

其中：
- `input.json`：发给 RedShrimp 的完整输入
- `output.json`：结构化返回
- `plan_summary.md`：人工可读摘要
- `references.json`：引用的 recent posts、observed posts 或上游分析结果索引

---

## 7. 失败与回退策略

### 7.1 账号上下文不足
现象：
- `account_profile` 过空
- `recent_posts` 缺失
- 无法判断账号是否适合某类方向

处理：
- 先补齐账号画像与最近内容摘要
- 不要在账号定位缺失时要求模型做高精度推荐

### 7.2 赛道样本不足
现象：
- `observed_posts` 太少
- 样本与目标赛道不相关
- 缺少互动信号

处理：
- 返回上游补抓或先执行 `analyze_viral_post`
- 不要在低质量样本上反复重试同一请求

### 7.3 输出过于空泛
现象：
- 没有明确选题与角度
- 标题候选不可直接使用
- 正文结构没有层次

处理：
- 检查 goal 是否明确
- 检查输入中是否给足约束与历史信息
- 必要时补充“哪些方向不能再做”的上下文后重新调用

### 7.4 输出结构错误
现象：
- 缺少统一字段
- `task_specific_payload` 不完整
- `decision` 不合法

处理：
- 先记录异常输出
- 回查 prompt / schema / task 枚举一致性
- 修正后重调，避免盲目重复

---

## 8. 与上下游模块的衔接

### 上游来源
通常来自：
- `schemas/account_profile.json`
- `schemas/observed_post.json`
- `pipelines/analyze_viral_post.md`

### 下游去向
通常流向：
- 草稿生成阶段
- `prompts/pre_publish_review.md`
- `pipelines/review_after_publish.md`

衔接原则：
- 发帖方案是发前主决策，不等于最终成稿
- 后续草稿若与方案偏离过大，应先 review 再发布
- 发布后复盘结果应回流到下一轮 `generate_post_plan`

---

## 9. 完成判据
当满足以下条件时，可认为本 pipeline 已落地：
1. 已说明如何汇总账号状态、近期内容与赛道观察
2. 已说明如何构造 `generate_post_plan` 的统一输入
3. 已说明 RedShrimp 返回的关键结构化字段
4. 已说明 `publish / revise / skip` 的后续分流
5. 已说明如何落盘并衔接到发前审查与发后复盘
6. 已将发布页真实可见的图片上传约束、格式限制与比例/分辨率建议纳入方案约束来源