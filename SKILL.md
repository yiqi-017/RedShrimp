---
name: xiaohongshu-growth
description: 小红书流量密码与爆款运营专家，提供养号、平台推流机制、评论区运营及文案优化的标准操作流程 (SOP)。支持通过浏览器 `web_scan` / `web_execute_js` 实时观察热帖，基于 CES 输出前五条趋势帖子，并将抓取到的全部帖子、分时段最近热门帖子与不限时很火帖子按 TXT/JSON/CSV 三种格式统一归档到 data/ 目录。
---

# 小红书运营与增长策略 (Xiaohongshu Growth SOP)

## 概述
当调用此 Skill 时，AI 助手会以小红书增长策略专家的身份工作：既能基于已有参考知识库给出赛道化建议，也能通过浏览器里的 `web_scan` + `web_execute_js` 做实时热帖观察，按 CES 代理分筛出前五条趋势帖子，并把抓取到的全部帖子、分时段最近热门帖子（1 小时 / 3 小时 / 6 小时 / 12 小时 / 1 天）以及不限时很火帖子统一保存到 `data/` 下的 `TXT/`、`JSON/`、`CSV/` 三个目录，供后续人工查看、数据可视化、建模与复盘使用。

当前实时抓帖策略已统一为：**优先使用浏览器里的 `web_scan` + `web_execute_js` 做真实页面连续观测**。默认不走 HTTP 直连式探测，也不依赖额外接口工具；趋势判断以真实页面连续出现的话题、标题、封面文案和互动线索为准。

## 核心能力
- 热点洞察与赛道拆解：识别美妆、职场、留学、美食、穿搭等赛道里真正容易放大的具体话题。
- 实时热帖观察与结果归档：通过浏览器真实页面连续观察最近热帖，按 CES 输出前五条趋势帖子，并把全部抓取帖子、分时段最近热门帖子与不限时很火帖子统一写入 `data/`。
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
4. 数据目录约定：`data/TXT/`（人工查看）、`data/JSON/`（结构化留存）、`data/CSV/`（表格分析/可视化/LightGBM）
5. 最近一次实时趋势观察：`data/TXT/trends_data.txt` / `data/JSON/trends_data.json` / `data/CSV/trends_data.csv`
6. 本次/历次抓到的全部帖子：`data/TXT/all_captured_posts.txt` / `data/JSON/all_captured_posts.json` / `data/CSV/all_captured_posts.csv`
7. 最近热门帖子（1 小时）：`data/TXT/recent_hot_1h.txt` / `data/JSON/recent_hot_1h.json` / `data/CSV/recent_hot_1h.csv`
8. 最近热门帖子（3 小时）：`data/TXT/recent_hot_3h.txt` / `data/JSON/recent_hot_3h.json` / `data/CSV/recent_hot_3h.csv`
9. 最近热门帖子（6 小时）：`data/TXT/recent_hot_6h.txt` / `data/JSON/recent_hot_6h.json` / `data/CSV/recent_hot_6h.csv`
10. 最近热门帖子（12 小时）：`data/TXT/recent_hot_12h.txt` / `data/JSON/recent_hot_12h.json` / `data/CSV/recent_hot_12h.csv`
11. 最近热门帖子（1 天）：`data/TXT/recent_hot_1d.txt` / `data/JSON/recent_hot_1d.json` / `data/CSV/recent_hot_1d.csv`
12. 不限时很火帖子档案：`data/TXT/high_ces_archive.txt` / `data/JSON/high_ces_archive.json` / `data/CSV/high_ces_archive.csv`

## 浏览器观测优先与赛道路由
所有“最近火什么”“给我几个能爆的话题”“帮我看看当前热帖”的请求，优先按以下顺序执行：

1. **先走浏览器真实页观测**：优先使用 `web_scan` + `web_execute_js` 观察当前小红书页面、搜索结果页或推荐流；不要默认先走 HTTP 直连。
2. 若用户给了明确赛道：
   - 先读取对应 `references/*_viral.md`；
   - 再围绕该赛道生成 2-3 个关键词；
   - 优先在浏览器里观察该关键词下连续出现的卡片；
   - 优先输出该赛道里的具体切入点，而不是泛泛的“大赛道建议”。
3. 若用户没有明确赛道：
   - 读取 `references/trend_analysis.md`；
   - 用泛词做浏览器扫描，并按 `proxy_ces` 输出前 5 条趋势帖子。
4. 若浏览器里已经能稳定看到真实帖子流：
   - 先基于 `web_scan` 连续记录标题、封面文案、作者、互动线索；
   - 整体采用慢速扫描策略：小步查看、分段停顿、避免高频连续滚动或过密触发页面动作，以降低风控概率；
   - 直接基于这些真实页面样本做趋势判断和选题提炼。
5. 若浏览器方案暂时不可用：
   - 人工快速查看时，优先看 `data/TXT/` 下对应文件；
   - 若用户问的是“抓到的全部帖子”，再看 `data/TXT/all_captured_posts.txt`，必要时同步参考 `data/JSON/all_captured_posts.json` 与 `data/CSV/all_captured_posts.csv`；
   - 若用户问的是“最近热门帖子”，按时间窗查看 `data/TXT/recent_hot_1h.txt`、`data/TXT/recent_hot_3h.txt`、`data/TXT/recent_hot_6h.txt`、`data/TXT/recent_hot_12h.txt`、`data/TXT/recent_hot_1d.txt`；
   - 若用户问的是“不限时很火帖子”，再看 `data/TXT/high_ces_archive.txt`；
   - 若要做结构化筛选、统计、可视化或建模，优先使用 `data/JSON/` 与 `data/CSV/` 下同名文件；
   - 若 data 中也没有有效记录，再退回 `references/trend_analysis.md` 里的常青切口；
   - 明确说明这是“历史/静态判断”，不是实时判断。

## 动态案例库扩充与结果归档
### A. data 自动归档规则
实时趋势观察成功后，抓取产生的所有数据统一写入 `data/`，并按格式拆分到三个目录：
- `data/TXT/`：给人直接看，适合快速翻阅、人工复盘。
- `data/JSON/`：给结构化留存，适合字段稳定、嵌套信息、程序二次处理。
- `data/CSV/`：给表格分析、数据可视化、特征工程与 LightGBM 训练。

同一批数据原则上三种格式都保留同名镜像文件，按目的拆分为：

1. **常规趋势观察总结 + CES 总前五 + 分时段前列摘要** → `data/TXT/trends_data.txt` / `data/JSON/trends_data.json` / `data/CSV/trends_data.csv`
2. **抓到的全部帖子原始池** → `data/TXT/all_captured_posts.txt` / `data/JSON/all_captured_posts.json` / `data/CSV/all_captured_posts.csv`
3. **最近热门帖子（1 小时）** → `data/TXT/recent_hot_1h.txt` / `data/JSON/recent_hot_1h.json` / `data/CSV/recent_hot_1h.csv`
4. **最近热门帖子（3 小时）** → `data/TXT/recent_hot_3h.txt` / `data/JSON/recent_hot_3h.json` / `data/CSV/recent_hot_3h.csv`
5. **最近热门帖子（6 小时）** → `data/TXT/recent_hot_6h.txt` / `data/JSON/recent_hot_6h.json` / `data/CSV/recent_hot_6h.csv`
6. **最近热门帖子（12 小时）** → `data/TXT/recent_hot_12h.txt` / `data/JSON/recent_hot_12h.json` / `data/CSV/recent_hot_12h.csv`
7. **最近热门帖子（1 天）** → `data/TXT/recent_hot_1d.txt` / `data/JSON/recent_hot_1d.json` / `data/CSV/recent_hot_1d.csv`
8. **不限时很火帖子档案** → `data/TXT/high_ces_archive.txt` / `data/JSON/high_ces_archive.json` / `data/CSV/high_ces_archive.csv`

`data/TXT/trends_data.txt`、`data/JSON/trends_data.json`、`data/CSV/trends_data.csv` 统一存：本次扫描总结、按 `proxy_ces` 排序的总前 5 条趋势帖子、最近 1 小时内前 3 条、最近 3 小时内前 3 条、最近 6 小时内前 3 条、最近 12 小时内前 3 条；三种格式保持同一批结果的镜像表达，其中 TXT 便于人工阅读，JSON 便于结构化消费，CSV 便于筛选、透视、可视化与建模。

`data/TXT/all_captured_posts.txt`、`data/JSON/all_captured_posts.json`、`data/CSV/all_captured_posts.csv` 用来存：
- 本次扫描中抓到的全部帖子；
- 不因是否热门、是否高赞而过滤；
- 作为后续复盘、补算 CES、排查漏网样本的原始池。

`data/TXT/recent_hot_1h.txt`、`data/TXT/recent_hot_3h.txt`、`data/TXT/recent_hot_6h.txt`、`data/TXT/recent_hot_12h.txt`、`data/TXT/recent_hot_1d.txt`，以及 `data/JSON/`、`data/CSV/` 下对应同名文件，用来存：
- 发布时间分别落在最近 1 小时 / 3 小时 / 6 小时 / 12 小；
- 且 `proxy_ces` 达到“最近热门”入库阈值的帖子；
- 阈值可按赛道和样本密度微调，但必须在 run summary 里写明本次使用的阈值。

“最近热门”建议默认阈值：
- `recent_hot_1h`: `proxy_ces >= 300`
- `recent_hot_3h`: `proxy_ces >= 500`
- `recent_hot_6h`: `proxy_ces >= 800`
- `recent_hot_12h`: `proxy_ces >= 1200`

`data/TXT/high_ces_archive.txt`，以及 `data/JSON/high_ces_archive.json`、`data/CSV/high_ces_archive.csv` 用来存：
- 不限制发布时间；
- 只要 `proxy_ces` 达到“很火帖子”阈值就可入库；
- 建议默认阈值：`proxy_ces >= 2500`；
- 作为长期观察和结构分析的档案池。

这些文件中的每条帖子都应尽量显式保存：
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
- `captured_at`
- `data_bucket`
- `threshold_rule`

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

### 4. 实时热帖观察与 CES 排序输出
当用户需要实时趋势时，按以下顺序执行：
1. 若用户已有赛道，先生成 2-3 个赛道关键词；若没有赛道，再使用泛词，如“打工人”“学生党”“搞钱”“探店”“穿搭”。
2. **优先使用 `web_scan` 观察真实页面**：先看当前推荐流、搜索结果页或对应赛道页连续出现了什么，不要默认先打 HTTP 接口。
3. 配合 `web_execute_js` 做小步滚动，每次控制在约 1 屏以内；整体采用慢速扫描，不要高频连续滚动；每次动作后适当停顿，再次 `web_scan`，记录新出现的标题、封面文案、作者和互动线索。
4. 若连续扫描里反复出现同类题材、同类情绪钩子或相近关键词，可直接判断为近期高讨论方向。
5. 若滚动后出现大量重复卡片：进一步减小滚动步长并延长停顿，等待懒加载完成后再继续观察；宁可慢一点，也不要因节奏过快触发风控或把“没刷出新内容”误判成“没有趋势”。
6. 在浏览器里先收集尽可能多的高信号候选，再基于标题、封面文案、作者、发布时间线索和互动表现做判断。
7. 使用代理打分：`proxy_ces = likedCount + collectedCount + commentCount * 4`。
8. 先把本次抓到的全部帖子分别写入 `data/TXT/all_captured_posts.txt`、`data/JSON/all_captured_posts.json`、`data/CSV/all_captured_posts.csv`，不要先按热门与否过滤。
9. 按 `proxy_ces` 从高到低排序，输出前 5 条趋势帖子；默认不要自动生成“有流量的帖子”、仿写稿或 2-3 个选题方向，除非用户另行要求。
10. 重点提取并保存：标题钩子、标签策略、情绪词、评论诱导点、收藏诱因、目标人群、地域场景。
11. 常规趋势扫描结果分别写入 `data/TXT/trends_data.txt`、`data/JSON/trends_data.json`、`data/CSV/trends_data.csv`；其中必须包含：本次扫描总结、按 `proxy_ces` 排序的总前 5 条、最近 1 小时内前 3 条、最近 3 小时内前 3 条、最近 6 小时内前 3 条、最近 12 小时内前 3 条。
12. 再按发布时间窗口筛选“最近热门帖子”：
   - 最近 1 小时且 `proxy_ces >= 300` → `data/TXT/recent_hot_1h.txt` / `data/JSON/recent_hot_1h.json` / `data/CSV/recent_hot_1h.csv`
   - 最近 3 小时且 `proxy_ces >= 500` → `data/TXT/recent_hot_3h.txt` / `data/JSON/recent_hot_3h.json` / `data/CSV/recent_hot_3h.csv`
   - 最近 6 小时且 `proxy_ces >= 800` → `data/TXT/recent_hot_6h.txt` / `data/JSON/recent_hot_6h.json` / `data/CSV/recent_hot_6h.csv`
   - 最近 12 小时且 `proxy_ces >= 1200` → `data/TXT/recent_hot_12h.txt` / `data/JSON/recent_hot_12h.json` / `data/CSV/recent_hot_12h.csv`
   - 最近 1 天且 `proxy_ces >= 1800` → `data/TXT/recent_hot_1d.txt` / `data/JSON/recent_hot_1d.json` / `data/CSV/recent_hot_1d.csv`
13. 再筛选“不限时很火帖子”：只要 `proxy_ces >= 2500`，就分别写入 `data/TXT/high_ces_archive.txt`、`data/JSON/high_ces_archive.json`、`data/CSV/high_ces_archive.csv`。
14. JSON 应保留最完整字段；CSV 应优先保证一行一帖、列名稳定，便于透视、可视化与 LightGBM 直接读取。
15. 若本轮按赛道特性调整了 CES 阈值，必须在本次 run summary 里明确记录“调整原因 + 新阈值”。

### 5. 内容创作规范
- 标题尽量控制在 20 字以内，包含核心关键词、人群或场景，以及情绪词。
- 正文尽量控制在 100 字以内，句子短、分段清晰、有平台口语感。
- 若输出正文，必须用 `scripts/check_length.py` 兜底校验；超长就自动重写精简。
- 若环境变量已配置，可用 `scripts/check_aigc.py` 检测 AIGC 痕迹；若 AI 味太重，要进一步口语化、增加真实细节和轻微不完美感。
- 结尾必须结合 `references/comments_engagement.md` 设计评论诱导点。

## Agent 交互准则 (执行规则)
1. 先确认用户的赛道、目标和当前阶段：是选题、诊断、仿写、发布准备，还是纯趋势观察。
2. 只要涉及实时热点，就先做浏览器真实页观测；若当前无法稳定看到真实帖子流，不得伪装成实时分析。
3. 若用户提供草稿，先用 CES 思路诊断，再结合脚本检查标题、正文长度、互动点与收藏诱因。
4. 输出给用户时，若任务是“抓趋势”，默认形成以下闭环：
   - 按 CES 排序的前 5 条趋势帖子；
   - 每条帖子的核心字段与 `proxy_ces`；
   - 必要时附“抓取范围 / 缺失字段 / capture_status”。
   只有当用户明确要求选题、标题、正文或评论区设计时，才继续生成创作内容。
5. 语气要保持真诚分享、朋友式安利和平台口语感，不要写成生硬的企业文案或说教口吻。

## 失败处理
| 场景 | 处理 |
| --- | --- |
| 浏览器页无法稳定加载真实帖子流 | 明确告诉用户当前无法做实时趋势扫描；人工查看优先基于 `data/TXT/trends_data.txt`、`data/TXT/all_captured_posts.txt`、各 `data/TXT/recent_hot_*.txt` 与 `data/TXT/high_ces_archive.txt` 给静态建议；若要做统计、可视化或建模，再使用 `data/JSON/` 与 `data/CSV/` 下同名文件。 |
| 页面已打开但未登录或内容受限 | 先提示用户完成登录或解除限制，再做实时分析。 |
| 滚动后只出现重复卡片 | 缩小滚动步长、短暂停顿等待懒加载，再继续扫描。 |
| 页面信息只暴露部分字段 | 保留已拿到的字段，写入 `capture_status`，不要硬编评论或时间。 |
| data 文件为空或损坏 | 先修复成标准 JSON 结构，再追加本次 run。 |
| 用户只想要静态建议，不想联网抓取 | 直接使用 `references/` 与 `data/`，不强行发起实时扫描。 |
