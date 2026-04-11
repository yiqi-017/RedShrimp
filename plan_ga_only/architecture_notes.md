# RedShrimp Plan（GA-only 方案一）

需求：采用“GenericAgent 直接操作小红书网页 + RedShrimp 只负责流量策略”的方案，为 RedShrimp 建立第一版规划、架构边界、文件清单与落地顺序。  
约束：当前阶段先不依赖小红书 MCP；不修改 GenericAgent 源码；优先跑通最小闭环。

---

## 1. 项目定位

RedShrimp 的目标不是再造一个 agent，也不是再包一层网页动作工具，而是：

> **成为 GenericAgent 面向小红书场景的增长决策层。**

它负责回答：

- 发什么内容更可能起量
- 什么表达方式更适合当前账号
- 什么时候发更合适
- 哪些内容风险高、应修改或跳过
- 发完后为什么有效/无效，下一轮应怎么改

---

## 2. 架构边界

### 2.1 GenericAgent 负责什么
GenericAgent 负责执行层与任务编排，包括：

- agent loop
- 工具调用
- 浏览器扫描与 JS 注入
- 页面动作执行（看帖、抓取、发帖、取结果）
- 原始数据落盘
- 调用 RedShrimp 并消费其输出

### 2.2 RedShrimp 负责什么
RedShrimp 负责策略层与结构化决策，包括：

- 爆款分析
- 选题判断
- 发帖方案生成
- 发前审查
- 发后复盘
- 风险提示与下一步建议

### 2.3 小红书网页负责什么
作为被操作对象，提供：

- 帖子内容
- 账号主页数据
- 搜索结果页
- 发布页
- 互动与公开可见指标

### 2.4 数据流
1. GenericAgent 从网页抓取原始内容与账号状态  
2. 将原始数据整理为结构化输入  
3. 调用 RedShrimp 进行分析与决策  
4. RedShrimp 返回结构化策略结果  
5. GenericAgent 执行发帖/观察/记录  
6. 发后结果再次回流到 RedShrimp，用于复盘

---

## 3. 为什么先不做小红书 MCP

当前阶段，GenericAgent 已具备：

- 浏览器读取能力
- JS 精准操控能力
- 网页数据抓取能力
- 多步骤任务执行能力

因此，小红书 MCP **不是能力上必需**，只是未来可能为了工程稳定性而进行的动作层封装。

现阶段优先级应放在：

- 先验证 RedShrimp 是否真能提升“发出更可能有流量的内容”的概率
- 先跑通“分析 → 生成 → 执行 → 复盘”的最小闭环
- 避免过早在动作层抽象上投入太多精力

---

## 4. 最小闭环

第一版只做 3 个核心能力，形成闭环：

1. **爆款分析**
2. **发帖方案生成**
3. **发后复盘**

完整流程如下：

### Step 1：GA 抓取输入
- 目标赛道帖子若干
- 当前账号画像
- 最近已发布内容
- 最近结果数据（如有）

### Step 2：RedShrimp 爆款分析
输出：
- 爆点来源
- 标题模式
- 封面模式
- 正文结构
- 标签策略
- 适用人群
- 不可照搬点

### Step 3：RedShrimp 生成发帖方案
输出：
- 推荐主题
- 推荐切入角度
- 标题候选
- 封面方向
- 正文结构
- 标签建议
- 发布时间建议
- 风险提示

### Step 4：GA 执行发帖
- 生成最终可发布内容
- 调用浏览器能力进行发帖
- 记录发布时间与内容版本

### Step 5：GA 回收结果
- 曝光
- 点赞
- 收藏
- 评论
- 涨粉
- 账号变化

### Step 6：RedShrimp 发后复盘
输出：
- 哪些因素有效
- 哪些因素拖后腿
- 下次保留什么
- 下次调整什么

---

## 5. 输入输出契约

### 5.1 推荐输入对象
```json
{
  "task": "generate_post_plan",
  "account_profile": {},
  "recent_posts": [],
  "observed_posts": [],
  "goal": "increase_followers",
  "constraints": {
    "platform": "xiaohongshu",
    "content_type": "image_text"
  }
}
```

### 5.2 推荐输出对象
```json
{
  "decision": "publish|revise|skip",
  "recommended_topic": "...",
  "content_plan": {
    "angle": "...",
    "title_candidates": ["..."],
    "cover_direction": "...",
    "body_structure": ["..."],
    "tags": ["..."]
  },
  "publish_window": "21:00-22:30",
  "risk_alerts": ["..."],
  "scores": {
    "topic_potential": 0.0,
    "fit_account": 0.0,
    "novelty": 0.0,
    "risk": 0.0
  },
  "why": ["..."],
  "next_actions": ["..."]
}
```

---

## 6. 首批应创建文件

### docs/
- `docs/vision.md`  
  定义目标、边界、不做什么、与 GenericAgent 的关系

- `docs/modules.md`  
  列出能力模块、优先级与相互关系

### integration/
- `integration/genericagent_contract.md`  
  定义 GA 如何调用 RedShrimp、什么时候调用、输入输出格式、失败回退策略

### schemas/
- `schemas/account_profile.json`  
  账号画像结构

- `schemas/observed_post.json`  
  单篇观测帖子结构

- `schemas/strategy_output.json`  
  RedShrimp 的统一输出结构

### prompts/
- `prompts/viral_analysis.md`  
  爆款分析模板

- `prompts/post_plan.md`  
  发帖方案生成模板

- `prompts/pre_publish_review.md`  
  发前审查模板

- `prompts/postmortem.md`  
  发后复盘模板

### pipelines/
- `pipelines/analyze_viral_post.md`  
  GA 如何抓取帖子并触发分析

- `pipelines/generate_post_plan.md`  
  从账号状态+目标到发帖方案的流程

- `pipelines/review_after_publish.md`  
  发后结果回收与复盘流程

### examples/
- `examples/inputs/`
- `examples/outputs/`  
  放 1~2 组最小样例，便于后续联调和 few-shot

---

## 7. 每类文件的职责

### vision
回答“RedShrimp 到底是什么”。

### contract
回答“GenericAgent 在什么时候、以什么格式调用 RedShrimp”。

### schema
回答“RedShrimp 输出什么结构，避免自然语言漂移”。

### prompt
回答“每类能力如何稳定地产出分析/建议”。

### pipeline
回答“从输入数据到最终策略输出的流程怎么串”。

### examples
回答“什么叫合格输入、什么叫合格输出”。

---

## 8. 实施顺序

### Phase 1：先锁定位与接口
1. `docs/vision.md`
2. `integration/genericagent_contract.md`

目的：
- 避免后续每个文件的边界不一致
- 先把“谁负责什么”钉死

### Phase 2：固定结构化输出
3. `schemas/strategy_output.json`
4. `schemas/account_profile.json`
5. `schemas/observed_post.json`

目的：
- 让后续 prompt 和 pipeline 有统一对象格式

### Phase 3：先补最关键模板
6. `prompts/viral_analysis.md`
7. `prompts/post_plan.md`
8. `prompts/postmortem.md`

目的：
- 先做最小闭环，不贪大而全

### Phase 4：写流程文档
9. `pipelines/analyze_viral_post.md`
10. `pipelines/generate_post_plan.md`
11. `pipelines/review_after_publish.md`

目的：
- 让 GA 到 RedShrimp 的调用链完整

### Phase 5：加样例并联调
12. `examples/inputs/*`
13. `examples/outputs/*`

目的：
- 便于 few-shot
- 便于后续调试和验收

---

## 9. 原型完成标志

当满足以下条件时，视为 RedShrimp 第一版原型可用：

- GA 能抓取一批目标赛道帖子
- RedShrimp 能输出结构化爆款分析
- RedShrimp 能输出结构化发帖方案
- GA 能根据方案执行一次发帖
- 发后结果能回流并得到复盘建议

---

## 10. 当前建议

如果继续推进，下一步最值得直接写的是：

1. `docs/vision.md`
2. `integration/genericagent_contract.md`
3. `schemas/strategy_output.json`

这是最小且最关键的三件套。没有这三项，后续 prompt 和 pipeline 很容易分散失控。
</file_content>

<file_content>
# RedShrimp GA-only 架构补充说明

本文档用于补充 `plan.md`，强调设计原则、模块关系与未来演进方向。

---

## 1. 核心设计原则

### 1.1 RedShrimp 不做“动作执行”
它不直接控制浏览器，不直接发帖，不直接抓网页。

这些能力交给 GenericAgent，原因是：
- GenericAgent 已有成熟工具链
- 避免 RedShrimp 同时承担“执行 + 策略”双重复杂性
- 便于未来替换网页来源，而不影响策略层

### 1.2 RedShrimp 不做“大而全框架”
第一版不追求：
- 独立运行框架
- 复杂插件系统
- 专门 server
- 过早代码化的规则引擎

第一版先做：
- 文档化能力定义
- 结构化输入输出
- 可复用模板
- 可复盘闭环

### 1.3 先验证“是否提升命中率”，再谈工程包装
当前最重要的问题不是：
- 能不能操作页面

而是：
- 这套策略是否真的提升内容起量概率

---

## 2. 推荐的能力优先级

### P0：必须先做
1. 爆款分析
2. 发帖方案生成
3. 发后复盘

### P1：第二阶段再做
4. 发前审查
5. 账号阶段策略
6. 选题评分器

### P2：后续增强
7. 热点感知
8. 账号私有经验沉淀
9. 半规则化评分系统

---

## 3. 模块之间的关系

### 3.1 爆款分析
作用：
- 从外部样本中提炼可复用模式

产物：
- 内容模式
- 表达模式
- 人群适配判断

### 3.2 发帖方案生成
作用：
- 把“观察到的模式”和“当前账号目标”组合成可执行建议

产物：
- 选题
- 标题候选
- 封面方向
- 正文结构
- 发布时间建议

### 3.3 发后复盘
作用：
- 把真实结果反馈到下一轮决策中

产物：
- 保留项
- 删除项
- 调整项
- 下轮实验方向

---

## 4. 为什么结构化输出很重要

如果 RedShrimp 每次只输出自然语言，会出现：

- GenericAgent 难以稳定消费
- 结果难以比较
- 不方便积累样本
- 不便后续做自动校验

所以第一版就要坚持：
- 明确字段
- 明确决策类型
- 明确分数字段
- 明确风险字段

---

## 5. 未来演进方向

当 GA-only 方案跑通后，可再考虑这些增强：

### 5.1 经验层
记录“这个账号对什么风格更敏感”：
- 哪类标题收藏更高
- 哪类选题涨粉更快
- 哪个发布时间段更优
- 哪类内容高曝光但不转粉

### 5.2 规则打分器
把部分经验固化成轻量规则：
- 标题钩子强度
- 账号匹配度
- 风险强度
- 同质化程度

### 5.3 动作层抽象
只有当网页动作变得非常复杂时，才考虑把小红书动作层抽出来单独封装。

这一步不是当前重点。

---

## 6. 建议的第一批验收问题

当第一版写完后，可以用以下问题验收：

1. RedShrimp 是否能稳定输出统一结构？
2. 输出结果是否足够让 GenericAgent 直接执行？
3. 爆款分析是否能提炼出“可复用模式”，而不是空泛总结？
4. 发后复盘是否真的能指导下一轮调整？
5. 这些文档是否足够支撑后续继续代码化？

---

## 7. 一句话定位

> RedShrimp 是 GenericAgent 面向小红书的增长决策层，不负责网页动作，负责把样本、账号状态与历史反馈转成可执行的流量策略。