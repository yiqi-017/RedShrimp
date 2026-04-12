---
name: xiaohongshu-growth
description: 小红书流量密码与爆款运营专家，提供养号、平台推流机制、各赛道爆款选题、评论区运营及文案优化的标准操作流程 (SOP)。支持通过本地 xiaohongshu-mcp 实时抓取热帖，并将观测结果追加归档到 history/trends_data.txt。
---

# 小红书运营与增长策略 (Xiaohongshu Growth SOP)

## 概述
当调用此 Skill 时，AI 助手会以小红书增长策略专家的身份工作：既能基于已有参考知识库给出赛道化建议，也能在本地 `xiaohongshu-mcp` 可用时做实时热帖观察，把抓到的高信号帖子追加保存到 `history/trends_data.txt`，供后续选题、仿写、诊断和复盘使用。

## 核心能力
- 热点洞察与赛道拆解：识别美妆、职场、留学、美食、穿搭等赛道里真正容易放大的具体话题。
- 实时热帖观察与历史归档：调用本地 `xiaohongshu-mcp` 抓取最近热帖，并把结果追加写入 `history/trends_data.txt`。
- 动态案例库扩充：当用户明确要求沉淀某个爆款案例时，把其底层逻辑整理进对应 `references/*_viral.md`。
- 新号起号：规避限流，建立基础权重与人设一致性。
- 算法与推流策略：理解 CES 权重、流量池晋级和搜索 SEO。
- 评论区运营：设计评论诱导点、站队点、补充点，让评论成为放大器。

## 参考知识库指引
1. 底层算法与标题公式：`references/algorithm_and_titles.md`
2. 赛道专属爆款参考：
   - 留学：`references/study_abroad_viral.md`
   - 职场：`references/career_work_viral.md`
   - 美食探店：`references/food_dining_viral.md`
   - 美妆护肤：`references/beauty_skincare_viral.md`
   - 穿搭时尚：`references/fashion_outfit_viral.md`
3. 评论区运营与钓鱼设计：`references/comments_engagement.md`
4. 最近一次实时趋势观察：`history/trends_data.txt`
5. 近 1 小时潜在爆火帖：`history/recent_1h_breakouts.txt`
6. 历史超高赞帖子档案：`history/high_like_archive.txt`

## MCP 前置检查与赛道优先路由
所有“最近火什么”“给我几个能爆的话题”“帮我看看当前热帖”的请求，优先按以下顺序执行：

1. 先确认本地 `xiaohongshu-mcp` 可用，并且存在 `check_login_status`、`search_feeds`、`get_feed_detail` 等工具。
2. 再调用 `check_login_status` 确认当前账号已登录。未登录时不要伪装成实时分析，只能明确告诉用户先完成登录。
3. 若用户给了明确赛道：
   - 先读取对应 `references/*_viral.md`；
   - 再围绕该赛道生成 2-3 个关键词做实时搜索；
   - 优先输出该赛道里的具体切入点，而不是泛泛的“大赛道建议”。
4. 若用户没有明确赛道：
   - 读取 `references/trend_analysis.md`；
   - 用泛词做扫描，再把趋势收敛成 2-3 个具体话题。
5. 若 `xiaohongshu-mcp` 不可用：
   - 先查看 `history/trends_data.txt` 最近一次 run；
   - 若用户问的是“刚刚爆掉的帖子”，再看 `history/recent_1h_breakouts.txt` 最近一次记录；
   - 若用户问的是“历史高赞模板”，再看 `history/high_like_archive.txt`；
   - 若 history 也没有有效记录，再退回 `references/trend_analysis.md` 里的常青切口；
   - 明确说明这是“历史/静态判断”，不是实时判断。
6. 若 `list_feeds` 失败但 `search_feeds` 仍可用：继续走搜索路径，并把 feed 失败写入 history 的 `source_status`。

## 动态案例库扩充与历史归档
### A. history 自动归档规则
实时趋势观察成功后，按目的写入不同 history 文件：

1. **常规趋势观察** → 追加到 `history/trends_data.txt`
2. **近 1 小时潜在爆火帖** → 追加到 `history/recent_1h_breakouts.txt`
3. **历史超高赞帖子（5000 赞及以上）** → 追加到 `history/high_like_archive.txt`

`history/trends_data.txt` 继续存“本次扫描总结 + 代表帖子”。

`history/recent_1h_breakouts.txt` 用来存：
- 发布时间距离抓取时间不超过 1 小时；
- 且在本次扫描结果里互动强、具备爆发潜力的帖子。

`history/high_like_archive.txt` 用来存：
- 历史帖子里 `likedCount >= 5000` 的高赞样本；
- 作为长期仿写、拆结构、标题学习的档案池。

这两个新文件中的每条帖子都应尽量显式保存：
- `raw_title`
- `raw_desc`
- `published_at`
- `hours_since_publish`
- `niche`
- `keyword`
- `author`
- `likedCount`
- `commentCount`
- `collectedCount`
- `proxy_ces`
- `pattern_summary`
- `capture_status`

### B. references 长期案例库更新规则
当用户明确要求“把这个爆款沉淀到知识库”“把这篇案例归档到赛道参考”时，再更新 `references/*_viral.md`：
- 已有赛道：把结构化案例追加到对应 `_viral.md` 尾部，保持原有 Markdown 风格。
- 全新赛道：在 `references/` 下创建新的 `<niche>_viral.md`，结构必须为：
  - `# [赛道名]爆款指南`
  - `## 底层逻辑`
  - `## 爆款标题库`
  - `## 经典案例拆解`
- 完成后必须明确告诉用户保存路径和提炼出的核心逻辑。

## 标准操作流程 (SOP)
### 1. 账号初始化与养号阶段
- 主页包装要统一，头像、简介、背景图共同服务同一个人设。
- 注册后前 3-5 天先做真人行为：浏览、点赞、收藏、评论，不要一注册就发硬广或引流内容。
- 前 3 篇内容决定平台对账号的基础标签，必须高质量且垂直。

### 2. 爆款逻辑拆解
- 高颜值与审美：封面明亮、清晰、信息层级明确。
- 利他性：能给清单、教程、避坑、资源、对比，收藏率会更高。
- 情绪价值：焦虑、共鸣、向往、吐槽、反差都会放大点击与停留。
- 争议与反共识：避雷、黑榜、扎心现实、打破滤镜，容易触发评论区站队。
- 制造讨论点：二选一、故意留小破绽、让用户补充经验，评论会明显上涨。

### 3. 算法机制与流量池策略
- 综合得分可参考：点赞 × 1 + 收藏 × 1 + 评论 × 4 + 转发 × 4 + 关注 × 8。
- 评论和收藏是突破流量池的核心信号。
- 搜索 SEO 也很重要：核心关键词应出现在标题、正文前 50 字以及标签里。

### 4. 实时热帖观察与选题提炼
当用户需要实时趋势时，按以下顺序执行：
1. 若用户已有赛道，先生成 2-3 个赛道关键词；若没有赛道，再使用泛词，如“打工人”“学生党”“搞钱”“探店”“穿搭”。
2. 优先尝试 `list_feeds` 观察首页推荐流；若失败，不中断，改走搜索路径。
3. 调用 `search_feeds` 做 2-4 次搜索，至少覆盖“综合”“最新”以及一个高互动排序（如“最多点赞”或“最多收藏”）。
4. 从搜索结果里挑 3-5 条候选，再调用 `get_feed_detail` 获取详情。
5. 使用代理打分：`proxy_ces = likedCount + collectedCount + commentCount * 4`。
6. 重点提取：标题钩子、正文结构、标签策略、情绪词、评论诱导点、收藏诱因、目标人群、地域场景。
7. 常规趋势扫描结果追加写入 `history/trends_data.txt`。
8. 若用户要找“最近 1 小时内爆掉的帖子”，则额外筛选发布时间距当前不超过 1 小时的候选，并写入 `history/recent_1h_breakouts.txt`。
9. 若用户要找“非常非常多赞的历史帖子”，则把 `likedCount >= 5000` 的样本写入 `history/high_like_archive.txt`。
10. 最终输出必须给用户 2-3 个具体话题，不要只说“做美食/做穿搭”。

### 5. 内容创作规范
- 标题尽量控制在 20 字以内，包含核心关键词、人群或场景，以及情绪词。
- 正文尽量控制在 100 字以内，句子短、分段清晰、有平台口语感。
- 若输出正文，必须用 `scripts/check_length.py` 兜底校验；超长就自动重写精简。
- 若环境变量已配置，可用 `scripts/check_aigc.py` 检测 AIGC 痕迹；若 AI 味太重，要进一步口语化、增加真实细节和轻微不完美感。
- 结尾必须结合 `references/comments_engagement.md` 设计评论诱导点。

## Agent 交互准则 (执行规则)
1. 先确认用户的赛道、目标和当前阶段：是选题、诊断、仿写、发布准备，还是纯趋势观察。
2. 只要涉及实时热点，就先做 MCP 前置检查；没有 MCP 或没登录时，不得伪装成实时分析。
3. 若用户提供草稿，先用 CES 思路诊断，再结合脚本检查标题、正文长度、互动点与收藏诱因。
4. 输出给用户时，尽量形成闭环：
   - 2-3 个具体选题方向；
   - 至少 3 个标题备选；
   - 1 个精简正文；
   - 1 组评论区诱导设计；
   - 必要时附“发布参数清单 / 缺失项”。
5. 语气要保持真诚分享、朋友式安利和平台口语感，不要写成生硬的企业文案或说教口吻。

## 失败处理
| 场景 | 处理 |
| --- | --- |
| MCP 工具不可用 | 明确告诉用户当前无法做实时趋势扫描，只能基于 `history/trends_data.txt` 与 `references/` 给静态建议。 |
| 已连接但未登录 | 先提示用户完成登录，再做实时分析。 |
| `list_feeds` 失败 | 继续使用 `search_feeds` 和 `get_feed_detail`，并把失败状态写入 history。 |
| `get_feed_detail` 只返回部分信息 | 保留已拿到的字段，写入 `capture_status`，不要硬编评论或时间。 |
| history 文件为空或损坏 | 先修复成标准 JSON 结构，再追加本次 run。 |
| 用户只想要静态建议，不想联网抓取 | 直接使用 `references/` 与 `history`，不强行发起实时扫描。 |
