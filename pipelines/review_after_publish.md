# RedShrimp Pipeline: Review After Publish

## 1. 目标
定义 GenericAgent 如何在小红书内容发布后一段时间回收结果数据，整理为 RedShrimp 可消费的输入，并调用 `postmortem` 完成发后复盘，输出可进入下一轮策略迭代的结构化结论。

该 pipeline 负责：
1. 回收发布结果与表现数据
2. 整理发布前方案、发布内容与发布后结果
3. 调用 RedShrimp 执行 `postmortem`
4. 保存复盘结果，供后续下一轮选题和发帖方案使用

它不负责直接修改已发布内容；其职责是分析与迭代建议。

---

## 2. 适用时机
在以下条件满足时执行：
- 某条内容已经发布
- 已经过了一段可观察窗口
- 能回收到至少部分结果数据
- 需要判断这条内容为什么表现好/差，以及下一轮怎么调整

典型时间点可以是：
- 发布后数小时的早期回收
- 发布后 24 小时的初步复盘
- 发布后 48~72 小时的稳定期复盘

---

## 3. 参与角色
### 3.1 GenericAgent 负责
- 定位已发布内容
- 回收曝光、点赞、收藏、评论、涨粉等结果
- 收集发布前方案、最终草稿、发布时间等背景信息
- 组装统一输入对象
- 调用 RedShrimp 的 `postmortem`
- 保存输入、输出与结果摘要
- 将建议反馈给下一轮策略决策

### 3.2 RedShrimp 负责
- 对照目标、方案、草稿与结果进行复盘
- 判断内容成败信号与可能原因
- 输出结构化的复盘结论、风险提示与下一轮建议
- 通过统一 `strategy_output` 返回 `continue / revise / stop` 类决策信号

---

## 4. 前置输入
最低建议具备：
- `task = "postmortem"`
- `publish_result`
- `goal`
- `constraints.platform = "xiaohongshu"`

可选增强输入：
- `account_profile`
- `recent_posts`
- `observed_posts`
- 当时的发帖方案
- 最终发布草稿
- 发布时间窗口
- 评论区反馈摘要

注意：如果只有极少量结果数据，依然可以做早期复盘，但应在 `context` 中明确“当前仍是早期窗口”。

---

## 5. 推荐流程

### Step 1. 确定复盘对象
GenericAgent 先明确本次复盘针对哪条内容，建议记录：
- post_id / note_id / URL
- 发布时间
- 内容类型（图文/视频）
- 对应请求批次或 request_id
- 对应的发帖方案版本

这样可以把发布前与发布后数据串起来，避免后续难以追溯。

### Step 2. 回收 publish_result
从已发布内容页面、账号页或后台可见区域回收结果，尽量包括：
- 曝光或可替代表现指标
- 点赞数
- 收藏数
- 评论数
- 转发或分享信号（若可见）
- 涨粉结果（若可归因）
- 发布时间后的采样时点
- 评论区主要反馈
- 是否出现异常风险，如争议、限流迹象、违规提示

如果平台端没有完整后台数据，至少保留当前能观测到的公开指标与采样时间。

### Step 3. 补齐发布前上下文
为了让 RedShrimp 能判断“为什么这样”，建议同时补充：
- 本条内容的发帖方案摘要
- 最终发布标题
- 最终正文
- 封面方向或首图描述
- 使用的标签
- 发布时间窗口
- 目标（如涨粉、收藏、曝光）

如果只有结果没有上下文，复盘会退化成表层数据描述。

### Step 4. 组装请求对象
按统一输入外层构造请求，例如：

```json
{
  "task": "postmortem",
  "request_id": "rs_xhs_postmortem_001",
  "platform": "xiaohongshu",
  "account_profile": {},
  "recent_posts": [],
  "observed_posts": [],
  "draft_content": {
    "title": "最终发布标题",
    "body": "最终发布正文",
    "tags": ["标签A", "标签B"]
  },
  "publish_result": {
    "post_id": "note_xxx",
    "published_at": "2025-08-10T20:00:00Z",
    "sampled_at": "2025-08-11T20:00:00Z",
    "metrics": {
      "likes": 120,
      "collects": 45,
      "comments": 18
    },
    "comment_feedback_summary": [
      "有人表示很实用",
      "有人提到标题有吸引力"
    ]
  },
  "goal": "increase_followers",
  "constraints": {
    "platform": "xiaohongshu",
    "content_type": "image_text"
  },
  "context": {
    "source": "genericagent",
    "review_window": "24h"
  }
}
```

其中：
- `publish_result` 是本 pipeline 的核心输入
- `draft_content` 用于帮助判断“方案与实际执行是否一致”
- `recent_posts` 有助于判断这条内容与近期整体趋势的关系

### Step 5. 调用 RedShrimp
向 RedShrimp 发起：
- `task = "postmortem"`

期望返回统一 `strategy_output`，重点包括：
- `decision`
- `summary`
- `risk_alerts`
- `scores`
- `why`
- `next_actions`
- `task_specific_payload`

`task_specific_payload` 一般可包含：
- 表现判断（优于/低于预期）
- 原因拆解
- 影响表现的关键因素
- 可复用成功元素
- 需避免重复的问题
- 下一轮测试建议
- 是否建议加大同类题材投入

### Step 6. 校验输出
GenericAgent 在消费前应检查：
- `task` 是否为 `postmortem`
- 输出是否符合统一 schema
- `decision` 是否为约定枚举
- 是否明确说明“结果表现 + 可能原因 + 下一步建议”
- 若建议继续某方向，是否说清可复用点
- 若建议停止，是否给出停止依据

如果输出只是在重复指标，而没有解释和下一轮动作，则不能视为有效复盘。

### Step 7. 结果回流
根据 `decision` 把复盘结果回流到下一轮：

#### 7.1 `continue`
表示当前方向值得继续放大或延展。
- 将成功元素写入下一轮选题参考
- 提高同类题材优先级
- 可在下一轮 `generate_post_plan` 中复用成功模式

#### 7.2 `revise`
表示方向有潜力，但需要调整。
- 根据 `next_actions` 调整标题、切口、结构、发布时间或标签
- 作为下一轮方案优化输入，而不是直接照搬

#### 7.3 `stop`
表示该方向当前不建议继续。
- 记录失败原因
- 将该方向加入暂缓或禁用清单
- 转向其他主题、形式或受众切口

### Step 8. 落盘
建议至少保存：

1. **发布结果快照**
   - `publish_result` 原始 JSON
   - 指标采样时间
   - 页面来源说明

2. **复盘输入快照**
   - 发给 RedShrimp 的完整请求
   - 关联的 draft / 方案摘要

3. **复盘输出快照**
   - RedShrimp 返回 JSON
   - 一页式结论摘要
   - 下一轮行动项

---

## 6. 推荐目录组织
可按单条内容或批次保存，例如：

```text
runs/
  postmortem/
    2025-08-xx_note_001/
      input.json
      publish_result.json
      output.json
      summary.md
```

其中：
- `input.json`：发给 RedShrimp 的完整输入
- `publish_result.json`：回收的结果指标
- `output.json`：复盘结构化输出
- `summary.md`：便于人工浏览的结论摘要与下一步动作

---

## 7. 失败与回退策略

### 7.1 结果数据不足
现象：
- 刚发布不久
- 只能看到极少量公开指标
- 无法判断涨粉或曝光

处理：
- 允许先做早期复盘，但明确标注采样窗口
- 后续在 24h 或 72h 再补做一次稳定期复盘

### 7.2 无法关联发布前方案
现象：
- 找不到 request_id
- 没有保存 draft 或 plan 摘要
- 难以判断“策略问题”还是“执行偏差”

处理：
- 仍可做结果描述型复盘
- 但应将“缺少前置上下文”记为复盘质量限制
- 后续流程必须加强落盘关联

### 7.3 输出过于表面
现象：
- 只重复点赞、收藏、评论数字
- 没有解释原因
- 没有给出下一轮建议

处理：
- 检查是否传入足够上下文
- 增补 draft、plan、评论反馈后重试
- 不要把纯指标摘要当成有效 postmortem

### 7.4 输出结构错误
现象：
- 缺少统一字段
- `task_specific_payload` 信息不足
- `decision` 不在约定枚举内

处理：
- 记录错误输出
- 回查 prompt / schema / task 配置
- 修正后再调用

---

## 8. 与上下游模块的衔接

### 上游来源
通常来自：
- `pipelines/generate_post_plan.md`
- 发前草稿与发布记录
- 页面回收的发布结果数据

### 下游去向
主要流向：
- 下一轮 `analyze_viral_post`
- 下一轮 `generate_post_plan`
- 长期内容方向优先级调整

衔接原则：
- 复盘不是结束，而是下一轮输入
- 发后结论应回流到下一轮选题和约束设置
- 成功元素要抽象成模式，失败元素要沉淀为避坑项

---

## 9. 完成判据
当满足以下条件时，可认为本 pipeline 已落地：
1. 已说明如何回收发布结果并整理 `publish_result`
2. 已说明如何补齐发布前方案与草稿上下文
3. 已说明如何调用 `postmortem` 并消费结构化输出
4. 已说明 `continue / revise / stop` 的回流逻辑
5. 已说明如何落盘并进入下一轮策略迭代