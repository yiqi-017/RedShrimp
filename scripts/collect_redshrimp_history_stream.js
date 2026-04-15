const axios = require('axios');
const fs = require('fs');

const MCP_URL = 'http://localhost:18060/mcp';
const RECENT_FILE = 'C:/Users/Hp/Desktop/y4s2/lab/RedShrimp/data/recent_1h_breakouts.txt';
const HIGHLIKE_FILE = 'C:/Users/Hp/Desktop/y4s2/lab/RedShrimp/data/high_like_archive.txt';

const GLOBAL_KEYWORDS = [
  ['打工人', 'career_work'],
  ['职场', 'career_work'],
  ['留学生', 'study_abroad'],
  ['学生党', 'student_life'],
  ['穿搭', 'fashion_outfit'],
  ['美食', 'food_dining'],
  ['探店', 'food_dining'],
  ['搞钱', 'money_side_hustle'],
  ['副业', 'money_side_hustle'],
  ['AI', 'tech_ai'],
  ['科技', 'tech_ai'],
  ['旅行', 'travel_lifestyle'],
  ['健身', 'fitness'],
  ['情感', 'emotion_relationship'],
  ['考研', 'education_exam'],
];

const GLOBAL_SORTS = ['最新', '最多点赞', '最多评论', '最多收藏'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chinaIso(ms = Date.now()) {
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '+08:00');
}

function toInt(value) {
  if (value === null || value === undefined) return 0;
  const n = Number(String(value).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function loadOrInit(filePath) {
  if (!fs.existsSync(filePath)) {
    return { version: 1, updated_at: null, runs: [] };
  }
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return { version: 1, updated_at: null, runs: [] };
  return JSON.parse(raw);
}

function saveJson(filePath, doc) {
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf8');
}

function collectExistingIds(doc) {
  const ids = new Set();
  for (const run of doc.runs || []) {
    for (const post of run.posts || []) {
      if (post.id) ids.add(post.id);
    }
  }
  return ids;
}

function topEmotionWords(text) {
  const candidates = ['避雷', '宝藏', '私藏', '听劝', '崩溃', '救命', '发疯', '黑名单', '别买', '值得', '后悔', '惊艳', '离谱', '尴尬', '反思', '好奇', '求建议', '怎么', '为什么', '谁懂', '绝了', '难吃', '必吃', '合集', '清单'];
  return candidates.filter((word) => text.includes(word)).slice(0, 4);
}

function inferHookType(title, desc, comments, collects) {
  const text = `${title} ${desc}`;
  if (['避雷', '黑名单', '别买', '难吃'].some((x) => text.includes(x))) return '避雷 / 黑榜';
  if (['合集', '清单', '攻略', '收藏', '汇总'].some((x) => text.includes(x))) return '清单 / 攻略';
  if (['？', '?', '怎么', '为什么', '好奇', '求建议', '听劝'].some((x) => title.includes(x))) return '提问 / 求建议';
  if (comments >= collects * 2 && comments >= 100) return '争议 / 站队讨论';
  if (['打工人', '学生党', '留学生', '职场', '通勤', '约会', '地铁'].some((x) => text.includes(x))) return '人群 / 场景定向';
  return '情绪表达 / 生活方式';
}

function inferStructure(desc) {
  if (desc.includes('\n') && desc.split('\n').length >= 4) return '分段叙述 / 情绪展开';
  if (['1.', '2.', '3.', '①', '②', '③'].some((x) => desc.includes(x))) return '列表式 / 清单式';
  if (desc.length >= 120) return '先结论再展开';
  return '短句直给 / 快速表态';
}

function inferCommentTrigger(title, desc) {
  const text = `${title} ${desc}`;
  if (['？', '?', '怎么', '为什么', '好奇', '求建议', '听劝'].some((x) => text.includes(x))) return '标题直接抛问题，让用户给建议或站队。';
  if (['本地人', '你们', '大家', '一人说一个'].some((x) => text.includes(x))) return '把评论区设计成补充池，鼓励用户继续接龙。';
  if (['避雷', '黑名单', '别买'].some((x) => text.includes(x))) return '容易激发反驳和补充经历，评论区天然有讨论。';
  return '靠共鸣或反差触发用户补充自己的经历。';
}

function inferCollectTrigger(title, desc, collects) {
  const text = `${title} ${desc}`;
  if (['合集', '清单', '攻略', '收藏'].some((x) => text.includes(x))) return '信息可回看，适合被收藏后二刷。';
  if (collects >= 200) return '内容具备复用价值，用户会先存起来再慢慢看。';
  return '更多偏即时讨论，收藏价值次于评论价值。';
}

class MCPClient {
  constructor(url) {
    this.url = url;
    this.sessionId = null;
    this.toolId = 10;
  }

  async init() {
    const res = await axios.post(this.url, {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'redshrimp-stream', version: '1.0' },
      },
      id: 1,
    }, { timeout: 30000 });

    this.sessionId = res.headers['mcp-session-id'];

    await axios.post(this.url, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }, {
      headers: { 'mcp-session-id': this.sessionId },
      timeout: 30000,
    });
  }

  async callTool(name, args) {
    const res = await axios.post(this.url, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: args },
      id: this.toolId++,
    }, {
      headers: { 'mcp-session-id': this.sessionId },
      timeout: 240000,
    });

    const text = res?.data?.result?.content?.[0]?.text ?? '';
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

function buildPost(item, detail, keyword, niche, source) {
  const note = detail?.data?.note || {};
  const comments = detail?.data?.comments || {};
  const interact = note.interactInfo || {};
  const likedCount = toInt(interact.likedCount);
  const commentCount = toInt(interact.commentCount);
  const collectedCount = toInt(interact.collectedCount);
  const publishedMs = note.time || null;
  const foundAt = chinaIso();
  const title = note.title || item?.noteCard?.displayTitle || '';
  const desc = note.desc || '';
  const hours = publishedMs ? round2((Date.now() - publishedMs) / 3600000) : null;
  const proxyCes = likedCount + collectedCount + commentCount * 4;
  const text = `${title} ${desc}`;

  return {
    found_at: foundAt,
    captured_at: foundAt,
    source,
    keyword,
    niche,
    id: item.id,
    xsecToken: item.xsecToken,
    author: note?.user?.nickname || item?.noteCard?.user?.nickname || '',
    raw_title: title,
    raw_desc: desc,
    published_at: publishedMs ? chinaIso(publishedMs) : null,
    hours_since_publish: hours,
    likedCount,
    commentCount,
    collectedCount,
    proxy_ces: proxyCes,
    pattern_summary: {
      hook_type: inferHookType(title, desc, commentCount, collectedCount),
      structure: inferStructure(desc),
      emotion_words: topEmotionWords(text),
      comment_trigger: inferCommentTrigger(title, desc),
      collect_trigger: inferCollectTrigger(title, desc, collectedCount),
    },
    capture_status: {
      detail_ok: true,
      comments_loaded: false,
      has_more_comments: Boolean(comments.hasMore),
    },
  };
}

function ensureRun(doc, run) {
  doc.updated_at = run.captured_at;
  doc.runs.push(run);
  return run;
}

function appendPost(doc, filePath, run, post) {
  run.posts.push(post);
  run.summary.candidate_count = run.posts.length;
  run.summary.top_topics = run.posts.slice(0, 3).map((p) => ({
    topic: p.raw_title.slice(0, 28),
    reason: filePath === RECENT_FILE
      ? `${p.keyword} 下发布 ${p.hours_since_publish} 小时内，proxy_ces=${p.proxy_ces}。`
      : `${p.likedCount} 赞，适合做历史爆款模板。`,
  }));
  doc.updated_at = post.found_at;
  saveJson(filePath, doc);
}

function inferNicheFromText(text) {
  if (/穿搭|通勤|地铁|男生穿搭|女生穿搭/.test(text)) return 'fashion_outfit';
  if (/探店|美食|餐厅|咖啡|火锅|奶茶/.test(text)) return 'food_dining';
  if (/留学生|港大|申请|校园|老师|英语/.test(text)) return 'study_abroad';
  if (/打工人|职场|上班|简历|面试|程序员/.test(text)) return 'career_work';
  if (/学生党|宿舍|高考|大学/.test(text)) return 'student_life';
  if (/搞钱|副业|赚钱/.test(text)) return 'money_side_hustle';
  return 'general';
}

function dedupeKeywordPairs(pairs) {
  const seen = new Set();
  const result = [];
  for (const [keyword, niche] of pairs) {
    const normalized = String(keyword || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push([normalized, niche || inferNicheFromText(normalized)]);
  }
  return result;
}

async function buildFeedSnapshot(client) {
  const feedItems = [];
  const pairs = [];
  try {
    const feed = await client.callTool('list_feeds', {});
    for (const item of feed?.feeds || []) {
      if (item?.modelType === 'hot_query') {
        const keyword = item?.title || item?.query || item?.noteCard?.displayTitle || '';
        if (keyword) pairs.push([keyword, inferNicheFromText(keyword)]);
        continue;
      }
      if (item?.modelType === 'note') {
        const title = item?.noteCard?.displayTitle || '';
        if (title) {
          feedItems.push(item);
          pairs.push([title.slice(0, 12), inferNicheFromText(title)]);
        }
      }
    }
  } catch (_) {
    // fallback to seeds below
  }
  return {
    feedItems,
    keywordPairs: dedupeKeywordPairs([...GLOBAL_KEYWORDS, ...pairs]).slice(0, 20),
  };
}

async function main() {
  const client = new MCPClient(MCP_URL);
  await client.init();
  const loginStatusText = await client.callTool('check_login_status', {});
  const loginStatus = typeof loginStatusText === 'string' && loginStatusText.includes('已登录') ? 'logged_in' : 'unknown';

  const recentDoc = loadOrInit(RECENT_FILE);
  const highLikeDoc = loadOrInit(HIGHLIKE_FILE);
  const seenRecent = collectExistingIds(recentDoc);
  const seenHigh = collectExistingIds(highLikeDoc);
  const { feedItems, keywordPairs } = await buildFeedSnapshot(client);

  const recentRun = ensureRun(recentDoc, {
    run_id: `${chinaIso().slice(0, 10)}-general-recent-1h-stream-001`,
    captured_at: chinaIso(),
    purpose: 'recent_1h_breakouts',
    niche: 'general',
    keywords: keywordPairs.map(([keyword]) => keyword),
    source_status: {
      mcp_connected: true,
      login_status: loginStatus,
      search_status: 'running',
      detail_status: 'partial_comments',
      failures: [],
    },
    summary: {
      candidate_count: 0,
      selection_rule: '发布时间距抓取时间不超过 3 小时，且 proxy_ces >= 500。',
      top_topics: [],
    },
    posts: [],
  });
  saveJson(RECENT_FILE, recentDoc);

  const highLikeRun = ensureRun(highLikeDoc, {
    run_id: `${chinaIso().slice(0, 10)}-general-high-like-stream-001`,
    captured_at: chinaIso(),
    purpose: 'historical_high_like_archive',
    niche: 'general',
    keywords: keywordPairs.map(([keyword]) => keyword),
    source_status: {
      mcp_connected: true,
      login_status: loginStatus,
      search_status: 'running',
      detail_status: 'partial_comments',
      failures: [],
    },
    summary: {
      candidate_count: 0,
      threshold: 'likedCount >= 500',
      top_topics: [],
    },
    posts: [],
  });
  saveJson(HIGHLIKE_FILE, highLikeDoc);

  console.log(`started | login=${loginStatus} | found_at=${chinaIso()} | feed_items=${feedItems.length} | global_keywords=${keywordPairs.map(([k]) => k).join(' / ')}`);

  for (const item of feedItems.slice(0, 6)) {
    try {
      const title = item?.noteCard?.displayTitle || '';
      if (!title) continue;
      const detail = await client.callTool('get_feed_detail', {
        feed_id: item.id,
        xsec_token: item.xsecToken,
      });
      const post = buildPost(item, detail, title.slice(0, 12), inferNicheFromText(title), 'list_feeds');
      if (post.hours_since_publish !== null && post.hours_since_publish <= 3 && post.proxy_ces >= 500 && !seenRecent.has(post.id)) {
        seenRecent.add(post.id);
        appendPost(recentDoc, RECENT_FILE, recentRun, post);
        console.log(`recent_1h | ${post.found_at} | feed | ${post.raw_title} | ${post.hours_since_publish}h | 赞${post.likedCount} 评${post.commentCount} 藏${post.collectedCount}`);
      }
      if (post.likedCount >= 500 && !seenHigh.has(post.id)) {
        seenHigh.add(post.id);
        appendPost(highLikeDoc, HIGHLIKE_FILE, highLikeRun, post);
        console.log(`high_like | ${post.found_at} | feed | ${post.raw_title} | 赞${post.likedCount} 评${post.commentCount} 藏${post.collectedCount}`);
      }
    } catch (error) {
      recentRun.source_status.failures.push({ source: 'list_feeds', id: item?.id, error: String(error.message || error) });
      highLikeRun.source_status.failures.push({ source: 'list_feeds', id: item?.id, error: String(error.message || error) });
      saveJson(RECENT_FILE, recentDoc);
      saveJson(HIGHLIKE_FILE, highLikeDoc);
    }
    await sleep(250);
  }

  const expandedPairs = dedupeKeywordPairs([...keywordPairs]);

  for (const [keyword, niche] of keywordPairs) {
    for (const sortBy of GLOBAL_SORTS) {
      let search;
      try {
        const filters = sortBy === '最新' ? { sort_by: sortBy, publish_time: '一天内' } : { sort_by: sortBy };
        search = await client.callTool('search_feeds', { keyword, filters });
      } catch (error) {
        if (sortBy === '最新') {
          recentRun.source_status.failures.push({ keyword, sort_by: sortBy, error: String(error.message || error) });
          saveJson(RECENT_FILE, recentDoc);
        } else {
          highLikeRun.source_status.failures.push({ keyword, sort_by: sortBy, error: String(error.message || error) });
          saveJson(HIGHLIKE_FILE, highLikeDoc);
        }
        continue;
      }

      let inspected = 0;
      for (const item of search?.feeds || []) {
        if (item?.modelType === 'hot_query') {
          const hotKeyword = item?.title || item?.query || item?.noteCard?.displayTitle || '';
          if (hotKeyword) expandedPairs.push([hotKeyword, inferNicheFromText(hotKeyword)]);
          continue;
        }
        if (item?.modelType !== 'note') continue;
        const title = item?.noteCard?.displayTitle || '';
        if (!title) continue;

        try {
          const detail = await client.callTool('get_feed_detail', {
            feed_id: item.id,
            xsec_token: item.xsecToken,
          });
          const source = sortBy === '最新' ? 'search_feeds_latest_day' : `search_feeds_${sortBy}`;
          const post = buildPost(item, detail, keyword, niche, source);

          if (post.hours_since_publish !== null && post.hours_since_publish <= 3 && post.proxy_ces >= 500 && !seenRecent.has(post.id)) {
            seenRecent.add(post.id);
            appendPost(recentDoc, RECENT_FILE, recentRun, post);
            console.log(`recent_1h | ${post.found_at} | ${keyword}/${sortBy} | ${post.raw_title} | ${post.hours_since_publish}h | 赞${post.likedCount} 评${post.commentCount} 藏${post.collectedCount}`);
          }

          if (post.likedCount >= 500 && !seenHigh.has(post.id)) {
            seenHigh.add(post.id);
            appendPost(highLikeDoc, HIGHLIKE_FILE, highLikeRun, post);
            console.log(`high_like | ${post.found_at} | ${keyword}/${sortBy} | ${post.raw_title} | 赞${post.likedCount} 评${post.commentCount} 藏${post.collectedCount}`);
          }
        } catch (error) {
          if (sortBy === '最新') {
            recentRun.source_status.failures.push({ keyword, sort_by: sortBy, id: item.id, error: String(error.message || error) });
            saveJson(RECENT_FILE, recentDoc);
          } else {
            highLikeRun.source_status.failures.push({ keyword, sort_by: sortBy, id: item.id, error: String(error.message || error) });
            saveJson(HIGHLIKE_FILE, highLikeDoc);
          }
        }

        inspected += 1;
        if (inspected >= 4) break;
        await sleep(250);
      }
    }
  }

  const finalPairs = dedupeKeywordPairs(expandedPairs).slice(0, 30);
  recentRun.keywords = finalPairs.map(([k]) => k);
  highLikeRun.keywords = finalPairs.map(([k]) => k);
  recentRun.source_status.search_status = recentRun.posts.length ? 'success' : 'no_candidates';
  saveJson(RECENT_FILE, recentDoc);

  highLikeRun.source_status.search_status = highLikeRun.posts.length ? 'success' : 'no_candidates';
  saveJson(HIGHLIKE_FILE, highLikeDoc);

  highLikeRun.source_status.search_status = highLikeRun.posts.length ? 'success' : 'no_candidates';
  saveJson(HIGHLIKE_FILE, highLikeDoc);

  console.log(`done | recent_1h=${recentRun.posts.length} | high_like=${highLikeRun.posts.length} | finished_at=${chinaIso()}`);
}

main().catch((error) => {
  console.log(`failed | ${String(error?.message || error)}`);
  process.exit(1);
});
