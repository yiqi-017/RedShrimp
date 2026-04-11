# RedShrimp Modules

## 1. 模块总览
RedShrimp 当前按“策略层”拆成 5 个核心模块：

1. 爆款分析（viral analysis）
2. 发帖方案生成（post planning）
3. 发前审查（pre-publish review）
4. 发后复盘（postmortem）
5. 统一策略输出层（strategy output normalization）

其中前 3 个用于发前决策，发后复盘用于闭环迭代，统一策略输出层用于保证所有模块都能给 GenericAgent 返回可消费的结构化结果。

---

## 2. 模块优先级

### P0：必须先落地
这些模块直接决定最小闭环是否成立：

- 爆款分析
- 发帖方案生成
- 发后复盘
- 统一策略输出层

### P1：建议紧接着落地
这些模块能显著降低误发与低质量发帖：

- 发前审查

### P2：后续增强
这些模块不是第一阶段必须，但会提升可复用性与稳定性：

- 账号画像增强
- 赛道画像沉淀
- 选题库/模板库
- 发布时间策略规则库
- 实验记录与 AB 对比模块

---

## 3. 每个模块的职责、输入与输出

### 3.1 爆款分析
**目标**：从已观测到的小红书帖子中提炼“为什么它可能起量”。

**典型输入**：
- observed_posts[]
- 可选的 account_profile
- 当前内容赛道或目标

**典型输出**：
- 爆点来源
- 标题模式
- 封面方向
- 正文结构
- 标签策略
- 适用账号/人群
- 不可直接照搬的部分

**对下游的价值**：
为发帖方案生成提供参考模式，而不是机械抄袭。

---

### 3.2 发帖方案生成
**目标**：基于账号现状、赛道观察与增长目标，生成当前最值得尝试的一条内容方案。

**典型输入**：
- account_profile
- recent_posts[]
- observed_posts[]
- goal
- constraints

**典型输出**：
- decision（publish / revise / skip）
- recommended_topic
- angle
- title_candidates[]
- cover_direction
- body_structure[]
- tags[]
- publish_window
- risk_alerts[]
- why[]
- next_actions[]

**对下游的价值**：
作为 GenericAgent 发帖前的主决策入口。

---

### 3.3 发前审查
**目标**：对一条已经形成草稿的内容进行最后一轮发布前判断。

**典型输入**：
- draft_content
- account_profile
- constraints
- strategy_output（可选）

**典型输出**：
- decision（publish / revise / skip）
- 具体问题点
- 必改项
- 可选优化项
- 风险提示

**对下游的价值**：
在真正点击发布前做一次风险闸门，减少低质量发布。

---

### 3.4 发后复盘
**目标**：根据发布后的结果与内容版本，分析这条内容为何表现好或不好。

**典型输入**：
- published_content_snapshot
- publish_context
- performance_metrics
- account_change
- baseline 或历史对比数据（可选）

**典型输出**：
- 有效因素
- 拖后腿因素
- 应保留项
- 应删除项
- 下一轮测试建议
- 下一篇选题方向建议

**对下游的价值**：
为下一轮发帖方案提供反馈，形成闭环。

---

### 3.5 统一策略输出层
**目标**：把所有模块的结果收敛到一致的结构，避免自然语言漂移与接入混乱。

**典型输入**：
- 上述任一模块的分析结果
- 当前 task 类型

**典型输出**：
- decision
- scores
- why
- risk_alerts
- next_actions
- task_specific_payload

**对下游的价值**：
让 GenericAgent 可以稳定地解析和消费 RedShrimp 结果，而不依赖自由文本理解。

---

## 4. 模块之间的关系

### 主链路
1. GenericAgent 抓取 observed_posts 与账号状态
2. RedShrimp 执行爆款分析
3. RedShrimp 基于分析结果生成发帖方案
4. 如存在草稿，则先经过发前审查
5. GenericAgent 执行 publish / revise / skip
6. 发布后回收结果
7. RedShrimp 执行发后复盘
8. 复盘结果回流到下一轮发帖方案生成

### 关系说明
- 爆款分析为发帖方案生成提供参考依据
- 发帖方案生成是发前阶段的主模块
- 发前审查是发布前最后一道过滤
- 发后复盘为下一轮发帖方案提供反馈
- 统一策略输出层贯穿所有模块

---

## 5. 第一阶段建议实现顺序
按最小闭环优先级，建议顺序如下：

1. strategy_output schema
2. account_profile / observed_post schema
3. 爆款分析 prompt
4. 发帖方案生成 prompt
5. 发后复盘 prompt
6. GenericAgent 调用契约
7. analyze_viral_post pipeline
8. generate_post_plan pipeline
9. review_after_publish pipeline
10. 最小输入输出样例
11. 发前审查模块

说明：
- 发前审查很重要，但它不是第一闭环成立的前提，因此放在闭环跑通后补齐。
- schema 与 contract 要先于大多数 prompt，因为它们决定了输出是否能被稳定消费。

---

## 6. 对应落地文件映射

### docs/
- `docs/vision.md`：定义 RedShrimp 是什么
- `docs/modules.md`：定义模块划分与优先级

### integration/
- `integration/genericagent_contract.md`：定义 RedShrimp 与 GenericAgent 的交互方式

### schemas/
- `schemas/account_profile.json`：账号画像
- `schemas/observed_post.json`：观测帖子
- `schemas/strategy_output.json`：统一输出

### prompts/
- `prompts/viral_analysis.md`：爆款分析
- `prompts/post_plan.md`：发帖方案生成
- `prompts/pre_publish_review.md`：发前审查
- `prompts/postmortem.md`：发后复盘

### pipelines/
- `pipelines/analyze_viral_post.md`：从抓帖到分析
- `pipelines/generate_post_plan.md`：从账号状态到发帖方案
- `pipelines/review_after_publish.md`：从结果回收到复盘

### examples/
- `examples/inputs/`：示例输入
- `examples/outputs/`：示例输出

---

## 7. 第一阶段完成判据
当以下模块状态同时成立时，第一阶段可以视为完成：

- 爆款分析可稳定输出结构化观察结果
- 发帖方案生成可稳定输出 publish / revise / skip 决策
- 发后复盘可输出下一轮可执行建议
- GenericAgent 能按契约调用并消费结构化结果
- 至少有一组样例能完整演示闭环数据流