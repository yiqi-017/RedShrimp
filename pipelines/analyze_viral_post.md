# RedShrimp Pipeline: Analyze Viral Post

## 1. 目标
定义 GenericAgent 如何把“小红书赛道帖子抓取结果”整理成 RedShrimp 可消费的输入，并调用 `analyze_viral_post` 完成爆款分析，再将结果落盘，供后续 `generate_post_plan` 使用。

该 pipeline 只负责：
1. 抓取与整理 `observed_posts`
2. 调用 RedShrimp 爆款分析
3. 保存输入输出与关键信号

它不负责直接决定发布哪一条内容；那属于 `generate_post_plan` 的职责。

---

## 2. 适用时机
在以下条件满足时执行：
- GenericAgent 已进入目标赛道或关键词搜索页
- 已抓取一批候选帖子
- 需要提炼近期可借鉴的内容模式、爆点结构与风险边界
- 后续准备进入发帖方案生成阶段

---

## 3. 参与角色
### 3.1 GenericAgent 负责
- 打开小红书搜索页、话题页、用户页或推荐流
- 抓取帖子卡片与帖子详情
- 过滤明显无效、缺字段或重复数据
- 将数据整理为 `observed_posts[]`
- 组装统一输入对象
- 调用 RedShrimp
- 将结果落盘给后续流程复用

### 3.2 RedShrimp 负责
- 分析 observed posts 中可能起量的模式
- 输出结构化结论，而不是自由文本总结
- 给出可供下游消费的 `decision`、`why`、`risk_alerts`、`next_actions`
- 在 `task_specific_payload` 中沉淀爆点结构、标题模式、封面方向、正文组织与注意事项

---

## 4. 前置输入
最低建议具备：
- `task = "analyze_viral_post"`
- `observed_posts`
- `constraints.platform = "xiaohongshu"`

可选增强输入：
- `account_profile`
- `goal`
- `context`
- 当前赛道关键词、采样方法、抓取批次说明

---

## 5. 推荐流程

### Step 1. 确定采样范围
GenericAgent 先定义本轮观测范围，例如：
- 某个关键词搜索结果
- 某类赛道主题词
- 某个对标账号最近内容
- 某个话题页下的高互动帖子

建议同时记录：
- 关键词或赛道名
- 采样入口
- 抓取时间
- 样本数量
- 是否包含详情页信息

目的不是追求“大而全”，而是保证这批样本能代表当前要发内容的竞争环境。

### Step 2. 抓取 observed posts
GenericAgent 从页面中获取帖子原始信息，尽量覆盖：
- 标题
- 正文摘要或全文
- 封面描述
- 作者信息
- 发布时间
- 点赞、收藏、评论等可见互动数据
- 标签
- 链接或唯一标识
- 是否广告感强、是否教程型、是否清单型等初步特征

如果列表页字段不足，优先补抓少量详情页，而不是只依赖卡片摘要。

### Step 3. 清洗与标准化
将抓到的原始网页数据整理成 `schemas/observed_post.json` 对应结构。

建议处理：
- 去重：按链接、note_id 或高相似标题去重
- 去噪：删除明显采集失败、字段残缺严重、无正文信息的样本
- 统一字段：时间、互动量、标签、作者字段命名保持一致
- 标记缺失：不确定字段保留空值，不要伪造补齐

如果样本质量太差，应先回到抓取阶段补数据，而不是让 RedShrimp 在脏数据上强行分析。

### Step 4. 组装请求对象
按统一输入外层构造请求，例如：

```json
{
  "task": "analyze_viral_post",
  "request_id": "rs_xhs_analyze_001",
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
    "collection_entry": "search",
    "collection_keyword": "关键词"
  }
}
```

其中：
- `observed_posts` 是本 pipeline 的核心输入
- `goal` 可用于帮助分析“什么样的内容更适合本轮目标”
- `account_profile` 若提供，可帮助 RedShrimp 判断哪些爆点适合当前账号，而不是只看样本本身

### Step 5. 调用 RedShrimp
把上述对象发送给 RedShrimp，对应任务固定为：
- `task = "analyze_viral_post"`

期望返回统一 `strategy_output` 结构，至少包含：
- `task`
- `decision`
- `summary`
- `risk_alerts`
- `scores`
- `why`
- `next_actions`
- `task_specific_payload`

其中 `task_specific_payload` 一般会沉淀：
- 爆点来源
- 标题模式
- 封面方向
- 正文结构特征
- 标签策略
- 适用对象
- 不建议照搬的点

### Step 6. 校验输出
GenericAgent 在消费前应做基本校验：
- `task` 是否确认为 `analyze_viral_post`
- 返回是否符合统一 schema
- `decision` 是否为约定枚举
- `task_specific_payload` 是否确实包含可供后续发帖方案使用的信息
- 若 RedShrimp 输出为空泛总结，应视为低质量结果，记录异常并考虑补样本重试

### Step 7. 落盘
建议至少保存三类内容：

1. **原始输入快照**
   - 本次请求 JSON
   - 抓取批次标识
   - 样本来源信息

2. **分析输出快照**
   - RedShrimp 原始输出 JSON
   - 解析后的核心结论摘要

3. **供下游复用的提炼结果**
   - 可直接传给 `generate_post_plan` 的 observed post 分析结论
   - 本轮不建议使用的内容方向或风险提示

---

## 6. 推荐目录组织
可按批次保存，例如：

```text
runs/
  analyze_viral_post/
    2025-08-xx_batch_001/
      input.json
      observed_posts.json
      output.json
      notes.md
```

其中：
- `input.json`：发给 RedShrimp 的完整输入
- `observed_posts.json`：清洗后的样本
- `output.json`：RedShrimp 返回结果
- `notes.md`：对异常、缺失字段、采样偏差的补充说明

---

## 7. 失败与回退策略

### 7.1 抓取失败
现象：
- 样本太少
- 详情抓取不完整
- 互动字段缺失严重

处理：
- 先补抓，不要急着调用 RedShrimp
- 必要时缩小赛道范围，提高样本相关性

### 7.2 输入结构不完整
现象：
- `task` 错误
- `observed_posts` 为空
- `constraints.platform` 缺失

处理：
- 由 GenericAgent 在本地修正后再调用
- 不要把结构错误直接推给模型兜底

### 7.3 输出结构错误
现象：
- 返回自由文本
- 缺少统一字段
- `task_specific_payload` 无法复用

处理：
- 记录失败输出
- 优先检查 prompt / schema / task 是否一致
- 必要时重新调用，但避免在同一脏输入上重复无意义重试

### 7.4 分析结论过于空泛
现象：
- 只有“标题吸引人”“内容有价值”这类泛化判断
- 没有给出结构化模式与禁忌项

处理：
- 先检查 observed posts 是否信息密度不足
- 优先补充详情页样本，而不是只增加卡片数量

---

## 8. 与下游模块的衔接
本 pipeline 的输出主要供：
- `prompts/post_plan.md`
- `pipelines/generate_post_plan.md`

下游使用方式：
- 将本轮总结出的高潜力模式作为发帖方案的参考输入
- 将风险提醒、不适配点作为发帖方案的约束
- 不直接“复制爆款”，而是提炼可迁移模式后再结合账号状态生成新内容方案

---

## 9. 完成判据
当满足以下条件时，可认为本 pipeline 落地完成：
1. 已说明 GA 如何抓取帖子并整理为 `observed_posts`
2. 已说明如何组装 `analyze_viral_post` 的统一输入
3. 已说明 RedShrimp 返回什么结构化结果
4. 已说明输出校验、失败回退与落盘方式
5. 已说明结果如何进入后续 `generate_post_plan`