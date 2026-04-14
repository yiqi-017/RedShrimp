const axios = require('axios');
const fs = require('fs');

const MCP_URL = 'http://localhost:18060/mcp';
const HISTORY_DIR = 'C:/Users/Hp/Desktop/y4s2/lab/RedShrimp/history';
const RECENT_FILE = `${HISTORY_DIR}/recent_1h_breakouts.txt`;
const HIGHLIKE_FILE = `${HISTORY_DIR}/high_like_archive.txt`;
const OBSERVE_MINUTES = 60;
const OBSERVE_MS = OBSERVE_MINUTES * 60 * 1000;
const FEED_TIMEOUT_MS = 90000;
const DETAIL_TIMEOUT_MS = 120000;
const CYCLE_PAUSE_MS = 30000;
const DETAIL_PAUSE_MS = 1000;
const MAX_FEED_ITEMS_PER_CYCLE = 6;
const RECENT_HOURS = 3;
const RECENT_PROXY = 500;
const HIGHLIKE_MIN = 500;

let ACTIVE_TRACE = null;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function chinaIso(ms = Date.now()) { return new Date(ms + 8 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '+08:00'); }
function safeTimestamp(iso) { return String(iso || chinaIso()).replace(/[:]/g, '-'); }
function toInt(value) {
  if (value == null) return 0;
  const n = Number(String(value).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}
function round2(v) { return Math.round(v * 100) / 100; }
function oneLine(text, max = 160) { return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function loadOrInit(filePath) {
  if (!fs.existsSync(filePath)) return { version: 1, updated_at: null, runs: [] };
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  return raw ? JSON.parse(raw) : { version: 1, updated_at: null, runs: [] };
}
function saveJson(filePath, data) { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); }
function appendLine(filePath, line) { fs.appendFileSync(filePath, `${line}\n`, 'utf8'); }
function collectExistingIds(doc) {
  const ids = new Set();
  for (const run of doc.runs || []) for (const post of run.posts || []) if (post.id) ids.add(post.id);
  return ids;
}
function inferNicheFromText(text) {
  if (/穿搭|通勤|地铁|男生穿搭|女生穿搭/.test(text)) return 'fashion_outfit';
  if (/探店|美食|餐厅|咖啡|火锅|奶茶/.test(text)) return 'food_dining';
  if (/留学生|港大|申请|校园|老师|英语|NUS|NTU/.test(text)) return 'study_abroad';
  if (/打工人|职场|上班|简历|面试|程序员/.test(text)) return 'career_work';
  if (/学生党|宿舍|高考|大学|考研/.test(text)) return 'student_life';
  if (/搞钱|副业|赚钱/.test(text)) return 'money_side_hustle';
  if (/AI|科技|模型|SKILL|Claude|Gemini/.test(text)) return 'tech_ai';
  return 'general';
}
function topEmotionWords(text) {
  return ['避雷', '宝藏', '私藏', '听劝', '崩溃', '救命', '发疯', '黑名单', '别买', '值得', '后悔', '惊艳', '离谱', '尴尬', '反思', '好奇', '求建议', '怎么', '为什么', '谁懂', '绝了', '难吃', '必吃', '合集', '清单']
    .filter((word) => text.includes(word)).slice(0, 4);
}
function inferHookType(title, desc, comments, collects) {
  const text = `${title} ${desc}`;
  if (['避雷', '黑名单', '别买', '难吃'].some((x) => text.includes(x))) return '避雷 / 黑榜';
  if (['合集', '清单', '攻略', '收藏', '汇总'].some((x) => text.includes(x))) return '清单 / 攻略';
  if (['？', '?', '怎么', '为什么', '好奇', '求建议', '听劝'].some((x) => title.includes(x))) return '提问 / 求建议';
  if (comments >= collects * 2 && comments >= 100) return '争议 / 站队讨论';
  return '情绪表达 / 生活方式';
}
function inferStructure(desc) {
  if (desc.includes('\n') && desc.split('\n').length >= 4) return '分段叙述 / 情绪展开';
  if (['1.', '2.', '3.', '①', '②', '③'].some((x) => desc.includes(x))) return '列表式 / 清单式';
  if (desc.length >= 120) return '先结论再展开';
  return '短句直给 / 快速表态';
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
        clientInfo: { name: 'redshrimp-homepage-capture', version: '1.0' },
      },
      id: 1,
    }, { timeout: 30000 });

    this.sessionId = res.headers['mcp-session-id'];
    await axios.post(this.url, { jsonrpc: '2.0', method: 'notifications/initialized' }, {
      headers: { 'mcp-session-id': this.sessionId },
      timeout: 30000,
    });
  }

  async callTool(name, args, timeoutMs) {
    const res = await axios.post(this.url, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: args },
      id: this.toolId++,
    }, {
      headers: { 'mcp-session-id': this.sessionId },
      timeout: timeoutMs,
    });

    const text = res?.data?.result?.content?.[0]?.text ?? '';
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

function buildPost(item, detail) {
  const note = detail?.data?.note || {};
  const interact = note.interactInfo || {};
  const publishedMs = note.time || null;
  const foundAt = chinaIso();
  const title = note.title || item?.noteCard?.displayTitle || '';
  const desc = note.desc || '';
  const likedCount = toInt(interact.likedCount);
  const commentCount = toInt(interact.commentCount);
  const collectedCount = toInt(interact.collectedCount);

  return {
    found_at: foundAt,
    captured_at: foundAt,
    source: 'list_feeds_homepage',
    keyword: 'homepage',
    niche: inferNicheFromText(`${title} ${desc}`),
    id: item.id,
    xsecToken: item.xsecToken,
    author: note?.user?.nickname || item?.noteCard?.user?.nickname || '',
    raw_title: title,
    raw_desc: desc,
    published_at: publishedMs ? chinaIso(publishedMs) : null,
    hours_since_publish: publishedMs ? round2((Date.now() - publishedMs) / 3600000) : null,
    likedCount,
    commentCount,
    collectedCount,
    proxy_ces: likedCount + collectedCount + commentCount * 4,
    pattern_summary: {
      hook_type: inferHookType(title, desc, commentCount, collectedCount),
      structure: inferStructure(desc),
      emotion_words: topEmotionWords(`${title} ${desc}`),
    },
    capture_status: {
      detail_ok: true,
      comments_loaded: false,
      has_more_comments: Boolean(detail?.data?.comments?.hasMore),
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
      ? `首页流里 ${p.hours_since_publish} 小时内，proxy_ces=${p.proxy_ces}`
      : `首页流命中 ${p.likedCount} 赞`,
  }));
  doc.updated_at = post.found_at;
  saveJson(filePath, doc);
}

function initTraceFile(runStartedAt) {
  const traceFile = `${HISTORY_DIR}/scan_trace_${safeTimestamp(runStartedAt)}.txt`;
  const traceDoc = {
    version: 1,
    run_id: `scan-trace-${safeTimestamp(runStartedAt)}`,
    started_at: runStartedAt,
    updated_at: runStartedAt,
    mode: 'list_feeds_homepage',
    login_status: 'booting',
    live_capture_file: null,
    scanned_count: 0,
    recent_hits: 0,
    high_hits: 0,
    scans: [],
    status: 'booting',
  };
  saveJson(traceFile, traceDoc);
  return { traceFile, traceDoc };
}

function appendScanTrace(traceDoc, traceFile, record) {
  traceDoc.scans.push(record);
  traceDoc.updated_at = record.scanned_at || chinaIso();
  saveJson(traceFile, traceDoc);
}

function updateTraceStatus(status, extra = {}) {
  if (!ACTIVE_TRACE) return;
  ACTIVE_TRACE.traceDoc.status = status;
  ACTIVE_TRACE.traceDoc.updated_at = chinaIso();
  Object.assign(ACTIVE_TRACE.traceDoc, extra);
  saveJson(ACTIVE_TRACE.traceFile, ACTIVE_TRACE.traceDoc);
}

function buildTraceRecord(post) {
  const recentEligible = post.hours_since_publish !== null && post.hours_since_publish <= RECENT_HOURS && post.proxy_ces >= RECENT_PROXY;
  const highEligible = post.likedCount >= HIGHLIKE_MIN;
  return {
    scanned_at: post.found_at,
    route: 'list_feeds',
    keyword: 'homepage',
    sort_by: 'homepage',
    source: post.source,
    niche: post.niche,
    id: post.id,
    xsecToken: post.xsecToken,
    title: post.raw_title,
    author: post.author,
    raw_desc: post.raw_desc,
    published_at: post.published_at,
    hours_since_publish: post.hours_since_publish,
    metrics: {
      likedCount: post.likedCount,
      commentCount: post.commentCount,
      collectedCount: post.collectedCount,
      proxy_ces: post.proxy_ces,
    },
    pattern_summary: post.pattern_summary,
    capture_status: post.capture_status,
    thresholds: {
      recent_3h_proxy500: recentEligible,
      high_like_500: highEligible,
    },
    verdict: {
      wrote_recent: false,
      wrote_high_like: false,
    },
  };
}

function initLiveCaptureFile(runStartedAt) {
  const liveCaptureFile = `${HISTORY_DIR}/captured_posts_${safeTimestamp(runStartedAt)}.txt`;
  fs.writeFileSync(liveCaptureFile, '', 'utf8');
  appendLine(liveCaptureFile, `started | ${runStartedAt}`);
  appendLine(liveCaptureFile, 'mode | list_feeds_homepage');
  appendLine(liveCaptureFile, 'thresholds | recent: 3h & proxy_ces>=500 | high_like: likedCount>=500');
  appendLine(liveCaptureFile, '');
  return liveCaptureFile;
}

function logFeedCycleStart(filePath, cycle) {
  appendLine(filePath, `feed_cycle | ${chinaIso()} | cycle=${cycle}`);
}

function logFeedFailure(filePath, error) {
  appendLine(filePath, `feed_failed | ${chinaIso()} | ${String(error?.message || error)}`);
}

function logFeedEmpty(filePath) {
  appendLine(filePath, `feed_empty | ${chinaIso()}`);
}

function logDetailFailure(filePath, itemId, error) {
  appendLine(filePath, `detail_failed | ${chinaIso()} | ${itemId} | ${String(error?.message || error)}`);
}

function logRepeatPost(filePath, postId, title) {
  appendLine(filePath, `repeat_skip | ${chinaIso()} | ${postId} | ${oneLine(title, 80)}`);
}

function logScannedPost(filePath, post, traceRecord) {
  const wroteTo = [];
  if (traceRecord.verdict.wrote_recent) wroteTo.push('recent_3h_proxy500');
  if (traceRecord.verdict.wrote_high_like) wroteTo.push('high_like_500');
  appendLine(filePath, `scanned | ${post.found_at} | homepage | ${post.raw_title} | ${post.hours_since_publish ?? 'na'}h | ces${post.proxy_ces} | 赞${post.likedCount} 评${post.commentCount} 藏${post.collectedCount} | recent=${traceRecord.thresholds.recent_3h_proxy500} | high=${traceRecord.thresholds.high_like_500} | wrote=${wroteTo.join(',') || 'none'}`);
  if (post.raw_desc) appendLine(filePath, `desc | ${oneLine(post.raw_desc)}`);
  appendLine(filePath, '');
}

async function main() {
  const startedAt = Date.now();
  const stopDeadline = startedAt + OBSERVE_MS;
  const runStartedAt = chinaIso(startedAt);
  const bootTrace = initTraceFile(runStartedAt);
  const liveCaptureFile = initLiveCaptureFile(runStartedAt);
  ACTIVE_TRACE = bootTrace;
  updateTraceStatus('booting', { live_capture_file: liveCaptureFile });

  const client = new MCPClient(MCP_URL);
  try {
    await client.init();
  } catch (error) {
    appendLine(liveCaptureFile, `failed_init | ${chinaIso()} | ${String(error?.message || error)}`);
    updateTraceStatus('failed_init', { error: String(error?.message || error), ended_at: chinaIso() });
    throw error;
  }

  let loginText = '';
  try {
    loginText = await client.callTool('check_login_status', {}, 30000);
  } catch (error) {
    appendLine(liveCaptureFile, `failed_login_check | ${chinaIso()} | ${String(error?.message || error)}`);
    updateTraceStatus('failed_login_check', { error: String(error?.message || error), ended_at: chinaIso() });
    throw error;
  }
  const loginStatus = typeof loginText === 'string' && loginText.includes('已登录') ? 'logged_in' : 'unknown';

  const recentDoc = loadOrInit(RECENT_FILE);
  const highDoc = loadOrInit(HIGHLIKE_FILE);
  const seenRecent = collectExistingIds(recentDoc);
  const seenHigh = collectExistingIds(highDoc);
  const seenScanned = new Set();

  const recentRun = ensureRun(recentDoc, {
    run_id: `${safeTimestamp(runStartedAt)}-homepage-recent-001`,
    captured_at: runStartedAt,
    purpose: 'recent_3h_breakouts_homepage',
    niche: 'general',
    keywords: ['homepage'],
    source_status: { mcp_connected: true, login_status: loginStatus, search_status: 'success', detail_status: 'partial_comments', failures: [] },
    summary: { candidate_count: 0, selection_rule: '首页流中发布时间距抓取时间不超过 3 小时，且 proxy_ces >= 500。', top_topics: [] },
    posts: [],
  });
  saveJson(RECENT_FILE, recentDoc);

  const highRun = ensureRun(highDoc, {
    run_id: `${safeTimestamp(runStartedAt)}-homepage-highlike-001`,
    captured_at: runStartedAt,
    purpose: 'historical_high_like_archive_homepage',
    niche: 'general',
    keywords: ['homepage'],
    source_status: { mcp_connected: true, login_status: loginStatus, search_status: 'success', detail_status: 'partial_comments', failures: [] },
    summary: { candidate_count: 0, threshold: 'likedCount >= 500', top_topics: [] },
    posts: [],
  });
  saveJson(HIGHLIKE_FILE, highDoc);

  let scannedCount = 0;
  let recentHits = 0;
  let highHits = 0;
  let cycle = 0;

  updateTraceStatus('running', {
    login_status: loginStatus,
    mode: 'list_feeds_homepage',
    live_capture_file: liveCaptureFile,
    keywords: ['homepage'],
  });

  console.log(`started | login=${loginStatus} | found_at=${runStartedAt} | mode=list_feeds_homepage | live_capture_file=${liveCaptureFile}`);

  while (Date.now() < stopDeadline) {
    cycle += 1;
    logFeedCycleStart(liveCaptureFile, cycle);

    let feed;
    try {
      feed = await client.callTool('list_feeds', {}, FEED_TIMEOUT_MS);
    } catch (error) {
      logFeedFailure(liveCaptureFile, error);
      updateTraceStatus('running', { last_error: String(error?.message || error) });
      await sleep(CYCLE_PAUSE_MS);
      continue;
    }

    const noteItems = (feed?.feeds || [])
      .filter((item) => item?.modelType === 'note' && item?.id && item?.xsecToken)
      .slice(0, MAX_FEED_ITEMS_PER_CYCLE);

    if (!noteItems.length) {
      logFeedEmpty(liveCaptureFile);
      updateTraceStatus('running', { last_error: 'list_feeds returned no note items' });
      await sleep(CYCLE_PAUSE_MS);
      continue;
    }

    for (const item of noteItems) {
      const title = item?.noteCard?.displayTitle || '';
      if (seenScanned.has(item.id)) {
        logRepeatPost(liveCaptureFile, item.id, title);
        continue;
      }

      try {
        const detail = await client.callTool('get_feed_detail', { feed_id: item.id, xsec_token: item.xsecToken }, DETAIL_TIMEOUT_MS);
        const post = buildPost(item, detail);
        const traceRecord = buildTraceRecord(post);
        seenScanned.add(post.id);

        if (traceRecord.thresholds.recent_3h_proxy500 && !seenRecent.has(post.id)) {
          seenRecent.add(post.id);
          appendPost(recentDoc, RECENT_FILE, recentRun, post);
          traceRecord.verdict.wrote_recent = true;
          recentHits += 1;
          console.log(`recent_3h | ${post.found_at} | ${post.raw_title} | ${post.hours_since_publish}h | ces${post.proxy_ces}`);
        }
        if (traceRecord.thresholds.high_like_500 && !seenHigh.has(post.id)) {
          seenHigh.add(post.id);
          appendPost(highDoc, HIGHLIKE_FILE, highRun, post);
          traceRecord.verdict.wrote_high_like = true;
          highHits += 1;
          console.log(`high_like | ${post.found_at} | ${post.raw_title} | 赞${post.likedCount}`);
        }

        scannedCount += 1;
        appendScanTrace(bootTrace.traceDoc, bootTrace.traceFile, traceRecord);
        logScannedPost(liveCaptureFile, post, traceRecord);
        updateTraceStatus('running', {
          scanned_count: scannedCount,
          recent_hits: recentHits,
          high_hits: highHits,
          last_scan_at: post.found_at,
          last_scanned_title: post.raw_title,
        });
        console.log(`scanned | ${post.found_at} | homepage | ${post.raw_title} | ces${post.proxy_ces}`);
      } catch (error) {
        logDetailFailure(liveCaptureFile, item.id, error);
        updateTraceStatus('running', { last_error: String(error?.message || error) });
      }

      await sleep(DETAIL_PAUSE_MS);
      if (Date.now() >= stopDeadline) break;
    }

    if (Date.now() < stopDeadline) await sleep(CYCLE_PAUSE_MS);
  }

  recentRun.source_status.search_status = 'success';
  highRun.source_status.search_status = 'success';
  saveJson(RECENT_FILE, recentDoc);
  saveJson(HIGHLIKE_FILE, highDoc);
  appendLine(liveCaptureFile, `done | ${chinaIso()} | scanned=${scannedCount} | recent=${recentHits} | high=${highHits}`);
  updateTraceStatus('done', { ended_at: chinaIso(), scanned_count: scannedCount, recent_hits: recentHits, high_hits: highHits });
  console.log(`done | scanned=${scannedCount} | recent_hits=${recentHits} | high_hits=${highHits} | finished_at=${chinaIso()}`);
}

main().catch((error) => {
  const liveCaptureFile = ACTIVE_TRACE?.traceDoc?.live_capture_file;
  if (liveCaptureFile) appendLine(liveCaptureFile, `failed | ${chinaIso()} | ${String(error?.message || error)}`);
  updateTraceStatus('failed', { error: String(error?.message || error), ended_at: chinaIso() });
  console.log(`failed | ${String(error?.message || error)}`);
  process.exit(1);
});
