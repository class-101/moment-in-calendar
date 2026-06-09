import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';

// ============================================================
// 채널 색상 / 채널 목록
// ----------------------------------------------------------
// 채널은 Supabase `channels` 테이블에서 불러와 채워진다.
// 아래 DEFAULT_CHANNELS는 DB 로드 전(초기 렌더)·로드 실패 시 사용하는 기본값.
// COLORS / CHANNEL_OPTIONS 는 applyChannelData()로 다시 채워지는 가변 변수다.
// 자식 컴포넌트들이 이 모듈 변수를 그대로 참조하므로, 채널이 바뀌면
// applyChannelData() 후 App 상태를 갱신해 전체를 다시 렌더하면 반영된다.
// ============================================================
const DEFAULT_CHANNELS = [
  { value: 'moment-insta-star', label: 'moment.in 인스타 (시리즈)', shortLabel: '인스타', skill: 'momentin-insta-writer', bg: '#FAEBE6', fg: '#8B4438' },
  { value: 'moment-insta-daily', label: 'moment.in 인스타 (데일리)', shortLabel: '인스타', skill: 'momentin-insta-writer', bg: '#F5EDE0', fg: '#8B6F38' },
  { value: 'moment-blog', label: 'moment_in 블로그', shortLabel: '블로그', skill: 'momentin-blog-writer', bg: '#E8E4DA', fg: '#5C5444' },
  { value: 'moment-todayhouse', label: 'moment.in 오늘의집', shortLabel: '오늘의집', skill: 'momentin-todayhouse-writer', bg: '#E6F0E8', fg: '#3A6B45' },
  { value: 'moment-pin', label: 'moment.in 핀터레스트', shortLabel: '핀터레스트', skill: 'momentin-pinterest-writer', bg: '#F5E8EE', fg: '#8B3A5C' },
  { value: 'ohana-blog', label: 'ohana_story 블로그', shortLabel: 'ohana 블로그', skill: 'ohana-blog-writer', bg: '#E8E8F0', fg: '#4A4A6E' },
  { value: 'ohana-insta', label: 'ohana.yyy 인스타', shortLabel: 'ohana 인스타', skill: 'ohana-insta-writer', bg: '#F0E8E0', fg: '#6E5638' }
];

// 신규 채널에 돌려쓸 추천 색상 팔레트 (bg = 연한 배경, fg = 글자/포인트)
const CHANNEL_COLOR_PRESETS = [
  { bg: '#FAEBE6', fg: '#8B4438' },
  { bg: '#F5EDE0', fg: '#8B6F38' },
  { bg: '#E8E4DA', fg: '#5C5444' },
  { bg: '#E6F0E8', fg: '#3A6B45' },
  { bg: '#F5E8EE', fg: '#8B3A5C' },
  { bg: '#E8E8F0', fg: '#4A4A6E' },
  { bg: '#F0E8E0', fg: '#6E5638' },
  { bg: '#E3EEF2', fg: '#356070' },
  { bg: '#F2ECE0', fg: '#7A6024' },
  { bg: '#ECE8F2', fg: '#574A78' }
];

// 채널 유형(플랫폼) — 채널 관리에서 드롭다운으로 선택, KPI에서 구분 표시
const CHANNEL_TYPES = ['인스타그램', '블로그', '오늘의집', '핀터레스트', '유튜브', '틱톡', '스레드', '기타'];
const TYPE_EMOJI = { '인스타그램': '📷', '블로그': '✍️', '오늘의집': '🏠', '핀터레스트': '📌', '유튜브': '▶️', '틱톡': '🎵', '스레드': '🧵', '기타': '🔖' };
const typeEmoji = (t) => TYPE_EMOJI[t] || '🔖';

let COLORS = Object.fromEntries(DEFAULT_CHANNELS.map(c => [c.value, { bg: c.bg, fg: c.fg }]));
let CHANNEL_OPTIONS = DEFAULT_CHANNELS.map(c => ({ value: c.value, label: c.label, shortLabel: c.shortLabel, skill: c.skill }));

const dbToChannel = (row) => ({
  value: row.value,
  label: row.label,
  shortLabel: row.short_label || row.label,
  skill: row.skill || '',
  bg: row.bg || '#F0F0EB',
  fg: row.fg || '#1A1A1A',
  sortOrder: row.sort_order ?? 0
});

// DB(또는 기본값) 채널 배열로 모듈 전역 COLORS / CHANNEL_OPTIONS 를 다시 채운다
const applyChannelData = (channels) => {
  if (!channels || channels.length === 0) return;
  COLORS = Object.fromEntries(channels.map(c => [c.value, { bg: c.bg || '#F0F0EB', fg: c.fg || '#1A1A1A' }]));
  CHANNEL_OPTIONS = channels.map(c => ({ value: c.value, label: c.label, shortLabel: c.shortLabel || c.label, skill: c.skill || '' }));
};

const STRENGTH_OPTIONS = ['', '⭐⭐⭐ 강력', '⭐⭐⭐ 진성 블루오션', '⭐⭐ 진성 블루오션', '⭐⭐ 보통', '⭐ 블루오션', '🟢 안정', '🟡 일반', '🔴 고경쟁', '시리즈 핵심', '캐러셀 보조', '릴스', '데일리', '오늘의집', '핀 보드', '일상'];

const HOLIDAYS = {
  '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일',
  '2026-05-01': '근로자의 날', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일',
  '2026-06-03': '지방선거', '2026-06-06': '현충일',
  '2026-07-17': '제헌절',
  '2026-08-15': '광복절', '2026-08-17': '대체공휴일',
  '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일', '2026-10-09': '한글날',
  '2026-12-25': '크리스마스'
};

const ANNIVERSARIES = {
  '2026-02-14': '발렌타인데이', '2026-03-14': '화이트데이',
  '2026-05-08': '어버이날', '2026-05-15': '스승의날', '2026-05-18': '성년의날', '2026-05-21': '부부의날',
  '2026-11-11': '빼빼로데이', '2026-12-24': '크리스마스 이브'
};

const todayYM = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

const todayDateStr = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

// hex 색을 흰색과 섞어 연한 배경색 만들기 (색상 피커용)
const tintBg = (hex, ratio = 0.86) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return '#F0F0EB';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  return `#${[mix(r), mix(g), mix(b)].map(x => x.toString(16).padStart(2, '0')).join('')}`;
};

const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

// ============================================================
// 표 붙여넣기 → 마크다운 표 변환 / 마크다운 표 렌더링
// 메모(textarea)에 HTML 표나 엑셀(TSV)을 붙여넣으면 줄글로 뭉개지는 문제 해결.
// 붙여넣을 때 "| 셀 | 셀 |" 형태의 마크다운 표로 바꿔 넣고, 상세보기에서 진짜 표로 렌더한다.
// ============================================================
function rowsToMarkdownTable(rows) {
  const clean = (rows || []).map(r => (r || []).map(c => String(c == null ? '' : c).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()));
  const nonEmpty = clean.filter(r => r.some(c => c !== ''));
  if (nonEmpty.length === 0) return null;
  const cols = Math.max(...nonEmpty.map(r => r.length));
  if (cols < 2) return null; // 열이 1개뿐이면 표로 보지 않음
  const pad = (r) => { const c = r.slice(); while (c.length < cols) c.push(''); return c; };
  const line = (r) => '| ' + pad(r).join(' | ') + ' |';
  const out = [line(nonEmpty[0]), '| ' + Array(cols).fill('---').join(' | ') + ' |'];
  for (let i = 1; i < nonEmpty.length; i++) out.push(line(nonEmpty[i]));
  return out.join('\n');
}

// 클립보드(HTML 표 또는 엑셀 TSV)에서 마크다운 표 문자열을 만든다. 표가 아니면 null.
function clipboardToMarkdownTable(dt) {
  if (!dt) return null;
  const html = dt.getData && dt.getData('text/html');
  if (html && /<table[\s>]/i.test(html)) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const table = doc.querySelector('table');
      if (table) {
        const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
          Array.from(tr.querySelectorAll('th,td')).map(td => (td.textContent || '').trim())
        );
        const md = rowsToMarkdownTable(rows);
        if (md) return md;
      }
    } catch (e) { /* 무시하고 텍스트 처리로 */ }
  }
  const text = (dt.getData && dt.getData('text/plain')) || '';
  // 엑셀·시트 복사 = 탭 구분(TSV). 두 줄 이상 + 탭 있으면 표로 간주.
  if (text.includes('\t')) {
    const lines = text.replace(/\r/g, '').split('\n').filter((l, i, a) => l.length || i < a.length - 1);
    const rows = lines.filter(l => l.trim().length).map(l => l.split('\t'));
    if (rows.length >= 1 && rows.some(r => r.length >= 2)) {
      const md = rowsToMarkdownTable(rows);
      if (md) return md;
    }
  }
  return null;
}

// 마크다운 표 한 줄인지 (| a | b |)
const isMdTableLine = (l) => /^\s*\|.*\|\s*$/.test(l);
const isMdSepLine = (l) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes('-');
const splitMdRow = (l) => {
  let s = l.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map(c => c.replace(/\\\|/g, '|').trim());
};

// 메모 텍스트를 표/일반 텍스트 블록으로 나눠 렌더 (표는 진짜 <table>로)
function MemoView({ text }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (isMdTableLine(lines[i])) {
      const tbl = [];
      while (i < lines.length && isMdTableLine(lines[i])) { tbl.push(lines[i]); i++; }
      const rows = tbl.filter(l => !isMdSepLine(l)).map(splitMdRow);
      if (rows.length >= 1 && rows[0].length >= 2) {
        blocks.push({ type: 'table', rows });
        continue;
      }
      blocks.push({ type: 'text', text: tbl.join('\n') });
      continue;
    }
    const txt = [];
    while (i < lines.length && !isMdTableLine(lines[i])) { txt.push(lines[i]); i++; }
    blocks.push({ type: 'text', text: txt.join('\n') });
  }
  return (
    <div style={{ lineHeight: 1.5, overflowWrap: 'anywhere' }}>
      {blocks.map((b, bi) => b.type === 'table' ? (
        <div key={bi} style={{ overflowX: 'auto', margin: '6px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%' }}>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => {
                    const head = ri === 0;
                    const Tag = head ? 'th' : 'td';
                    return <Tag key={ci} style={{ border: '0.5px solid #E3E0D7', padding: '5px 8px', textAlign: 'left', verticalAlign: 'top', background: head ? '#F4F2EC' : '#FFFFFF', fontWeight: head ? 600 : 400, color: '#1A1A1A', whiteSpace: 'pre-wrap' }}>{c}</Tag>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        b.text.trim() === '' ? null : <div key={bi} style={{ whiteSpace: 'pre-wrap' }}>{b.text}</div>
      ))}
    </div>
  );
}

// 레퍼런스 URL 유무 마커 (있음 🔗 / 없음 ⚠️)
function RefMark({ it }) {
  const has = !!(it.referenceUrl && it.referenceUrl.trim());
  return (
    <span title={has ? '레퍼런스 있음' : '레퍼런스 없음'} style={{ fontSize: 9.5, marginRight: 3, opacity: has ? 0.9 : 0.95, verticalAlign: 'middle' }}>
      {has ? '🔗' : '⚠️'}
    </span>
  );
}

const dbToItem = (row) => ({
  id: row.id,
  date: row.date,
  time: row.time,
  title: row.title,
  channel: row.channel,
  channelName: row.channel_name,
  isCore: row.is_core,
  mainKeyword: row.main_keyword,
  subKeywords: row.sub_keywords || [],
  strength: row.strength,
  asset: row.asset,
  nextSkill: row.next_skill,
  referenceUrl: row.reference_url || '',
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  description: row.description || '',
  completed: row.completed,
  archived: !!row.archived,
  archivedAt: row.archived_at || null,
  archiveReason: row.archive_reason || ''
});

const itemToDb = (item, userId) => ({
  id: item.id,
  user_id: userId,
  date: item.date,
  time: item.time,
  title: item.title,
  channel: item.channel,
  channel_name: item.channelName,
  is_core: !!item.isCore,
  main_keyword: item.mainKeyword || null,
  sub_keywords: item.subKeywords || [],
  strength: item.strength || null,
  asset: item.asset || null,
  next_skill: item.nextSkill || null,
  reference_url: item.referenceUrl || null,
  attachments: Array.isArray(item.attachments) ? item.attachments : [],
  description: item.description || null,
  completed: !!item.completed,
  archived: !!item.archived,
  archived_at: item.archivedAt || null,
  archive_reason: item.archiveReason || null
});

export default function App({ session }) {
  const userId = session.user.id;
  const userEmail = session.user.email;

  const [currentMonth, setCurrentMonth] = useState(todayYM);
  const [items, setItems] = useState([]);
  const [performance, setPerformance] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 채널 목록 (Supabase channels 테이블)
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [channelMgrOpen, setChannelMgrOpen] = useState(false);

  // 요일별 발행 계획 (weekday_plan 테이블) — { 0:[channelValue,...], ..., 6:[...] }
  const [weekdayPlan, setWeekdayPlan] = useState({});
  // 월간·주간 캘린더에 발행 목표 오버레이 표시 여부
  const [showPlanOverlay, setShowPlanOverlay] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('moment-plan-overlay') !== 'off';
  });

  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [deleteSheet, setDeleteSheet] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);

  // 우클릭 컨텍스트 메뉴
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item } | null
  // 보관함 모달
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveItems, setArchiveItems] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  // 보관 사유 입력 시트
  const [archiveSheet, setArchiveSheet] = useState(null); // { itemId, title } | { multi:true, ids, count } | null
  // 다중 선택 모드
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // 뷰 모드: 'month' | 'week' | 'list' | 'kpi'
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 640) return 'list';
    return 'month';
  });
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() - dow); // 일요일 시작
    return d;
  });
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 640 : false);

  // 검색·필터
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChannels, setFilterChannels] = useState(new Set()); // 빈 Set = 전체
  const [filterCompleted, setFilterCompleted] = useState('all'); // 'all' | 'todo' | 'done'
  const [filterCore, setFilterCore] = useState(false);
  const [filterRef, setFilterRef] = useState('all'); // 'all' | 'has' | 'none'
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 640;
      setIsMobile(mobile);
      // 모바일 진입 시 자동 리스트뷰 (PC 복귀 시 강제 변경 X)
      if (mobile && viewMode === 'month') setViewMode('list');
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [viewMode]);

  const loadMonthData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [yearStr, monthStr] = currentMonth.split('-');
      const yearNum = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const lastDay = new Date(yearNum, monthNum, 0).getDate();

      // 그리드 표시 범위 = 이전달 마지막주 일요일 ~ 다음달 첫주 토요일 (최대 6주)
      const firstDow = new Date(yearNum, monthNum - 1, 1).getDay(); // 1일의 요일
      const gridStart = new Date(yearNum, monthNum - 1, 1 - firstDow);
      const gridEnd = new Date(gridStart);
      gridEnd.setDate(gridStart.getDate() + 41); // 6주 = 42일
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const startDate = fmt(gridStart);
      const endDate = fmt(gridEnd);

      const { data: itemsData, error: itemsErr } = await supabase
        .from('items').select('*')
        .gte('date', startDate).lte('date', endDate)
        .or('archived.is.null,archived.eq.false')
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      if (itemsErr) throw itemsErr;

      const itemList = (itemsData || []).map(dbToItem);
      setItems(itemList);

      const itemIds = itemList.map(i => i.id);
      if (itemIds.length > 0) {
        const { data: perfData, error: perfErr } = await supabase
          .from('performance').select('*').in('item_id', itemIds);
        if (perfErr) throw perfErr;
        const perfMap = {};
        (perfData || []).forEach(p => {
          perfMap[p.item_id] = {
            url: p.url || '',
            likes: p.likes != null ? String(p.likes) : '',
            saves: p.saves != null ? String(p.saves) : '',
            note: p.note || ''
          };
        });
        setPerformance(perfMap);
      } else {
        setPerformance({});
      }
    } catch (err) {
      setError(err.message || '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => { loadMonthData(); }, [loadMonthData]);

  // ============================================
  // 채널 (Channels)
  // ============================================
  const loadChannels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('channels').select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        const list = data.map(dbToChannel);
        applyChannelData(list); // 모듈 전역 COLORS / CHANNEL_OPTIONS 갱신
        setChannels(list);      // 리렌더 트리거
      }
    } catch (err) {
      console.error('채널 로드 실패:', err);
    }
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  // 주간 뷰에서 보고 있는 주에 맞춰 데이터 로드 범위(currentMonth)를 동기화.
  // → 다른 달의 주로 이동해도 그 주의 콘텐츠가 로드돼 발행 목표 달성(✓) 판정이 정확해진다.
  useEffect(() => {
    if (viewMode !== 'week') return;
    const mid = new Date(weekStart);
    mid.setDate(mid.getDate() + 3); // 그 주의 수요일이 속한 달 기준 (주 전체가 6주 그리드에 포함됨)
    const ym = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, '0')}`;
    if (ym !== currentMonth) setCurrentMonth(ym);
  }, [viewMode, weekStart, currentMonth]);

  // ============================================
  // 요일별 발행 계획 (Weekday publishing plan)
  // ============================================
  const loadWeekdayPlan = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('weekday_plan').select('*');
      if (error) throw error;
      const map = {};
      (data || []).forEach(r => { map[r.dow] = Array.isArray(r.channels) ? r.channels : []; });
      setWeekdayPlan(map);
    } catch (err) {
      console.error('발행 계획 로드 실패:', err);
    }
  }, []);

  useEffect(() => { loadWeekdayPlan(); }, [loadWeekdayPlan]);

  // 특정 요일(dow)의 채널 목록 저장 — 드래그·추가·삭제 후 호출 (낙관적 업데이트)
  const setDayChannels = async (dow, channelArr) => {
    setWeekdayPlan(prev => ({ ...prev, [dow]: channelArr }));
    try {
      const { error } = await supabase.from('weekday_plan')
        .upsert({ dow, channels: channelArr, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (err) {
      alert('발행 계획 저장 실패: ' + (err.message || err));
      await loadWeekdayPlan();
    }
  };

  const togglePlanOverlay = () => {
    setShowPlanOverlay(v => {
      const nv = !v;
      if (typeof window !== 'undefined') window.localStorage.setItem('moment-plan-overlay', nv ? 'on' : 'off');
      return nv;
    });
  };

  // 채널 추가
  const addChannel = async (ch) => {
    try {
      const value = ch.value || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const maxOrder = channels.reduce((m, c) => Math.max(m, c.sortOrder || 0), 0);
      const { error } = await supabase.from('channels').insert({
        value,
        label: ch.label,
        short_label: ch.shortLabel || ch.label,
        skill: ch.skill || null,
        bg: ch.bg || '#F0F0EB',
        fg: ch.fg || '#1A1A1A',
        sort_order: maxOrder + 1
      });
      if (error) throw error;
      await loadChannels();
    } catch (err) {
      alert('채널 추가 실패: ' + (err.message || err));
    }
  };

  // 채널 수정 (이름·색상·스킬 등)
  const updateChannel = async (value, patch) => {
    try {
      const dbPatch = {};
      if (patch.label !== undefined) dbPatch.label = patch.label;
      if (patch.shortLabel !== undefined) dbPatch.short_label = patch.shortLabel || patch.label;
      if (patch.skill !== undefined) dbPatch.skill = patch.skill || null;
      if (patch.bg !== undefined) dbPatch.bg = patch.bg;
      if (patch.fg !== undefined) dbPatch.fg = patch.fg;
      const { error } = await supabase.from('channels').update(dbPatch).eq('value', value);
      if (error) throw error;
      // 이름이 바뀌면 기존 콘텐츠의 채널 이름 스냅샷도 함께 갱신 (표시 일관성)
      if (patch.label !== undefined) {
        await supabase.from('items').update({ channel_name: patch.label }).eq('channel', value);
      }
      await loadChannels();
      await loadMonthData();
    } catch (err) {
      alert('채널 수정 실패: ' + (err.message || err));
    }
  };

  // 채널 삭제 — 해당 채널을 쓰는 콘텐츠가 있으면 개수 안내 후 진행
  const deleteChannel = async (value) => {
    try {
      if (channels.length <= 1) { alert('채널은 최소 1개는 있어야 해요.'); return; }
      const { count, error: cntErr } = await supabase
        .from('items').select('id', { count: 'exact', head: true }).eq('channel', value);
      if (cntErr) throw cntErr;
      const ch = channels.find(c => c.value === value);
      const name = ch ? ch.label : value;
      const msg = count > 0
        ? `'${name}' 채널을 삭제할까요?\n\n이 채널을 쓰는 콘텐츠 ${count}편은 삭제되지 않지만, 채널 색상·필터에서 빠지고 기존에 저장된 채널 이름만 남아요.`
        : `'${name}' 채널을 삭제할까요?`;
      if (!window.confirm(msg)) return;
      const { error } = await supabase.from('channels').delete().eq('value', value);
      if (error) throw error;
      await loadChannels();
      await loadMonthData();
    } catch (err) {
      alert('채널 삭제 실패: ' + (err.message || err));
    }
  };

  // 채널 순서 이동 (dir: -1 위로 / +1 아래로)
  const moveChannel = async (value, dir) => {
    const list = [...channels].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const idx = list.findIndex(c => c.value === value);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    // 낙관적 업데이트로 즉시 반영
    const reordered = list.map((c, i) => ({ ...c, sortOrder: i + 1 }));
    applyChannelData(reordered);
    setChannels(reordered);
    try {
      await Promise.all(reordered.map(c =>
        supabase.from('channels').update({ sort_order: c.sortOrder }).eq('value', c.value)
      ));
    } catch (err) {
      alert('순서 변경 실패: ' + (err.message || err));
      await loadChannels();
    }
  };

  const saveItem = async (item) => {
    try {
      const isNew = !item.id;
      const finalItem = { ...item, id: item.id || `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
      const dbRow = itemToDb(finalItem, userId);

      if (isNew) {
        const { error } = await supabase.from('items').insert(dbRow);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('items').update(dbRow).eq('id', finalItem.id);
        if (error) throw error;
      }
      setEditingItem(null);
      await loadMonthData();
    } catch (err) {
      alert('저장 실패: ' + (err.message || err));
    }
  };

  const duplicateItem = async (itemId) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      const newItem = {
        ...item,
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: item.title + ' (복제)',
        completed: false
      };
      const { error } = await supabase.from('items').insert(itemToDb(newItem, userId));
      if (error) throw error;
      await loadMonthData();
    } catch (err) {
      alert('복제 실패: ' + (err.message || err));
    }
  };

  const deleteItem = async (itemId) => {
    try {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== itemId));
      setPerformance(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } catch (err) {
      alert('삭제 실패: ' + (err.message || err));
    }
  };

  // ============================================
  // 보관함 (Archive)
  // ============================================
  const moveToArchive = async (itemId, reason = '') => {
    try {
      const { error } = await supabase.from('items').update({
        archived: true,
        archived_at: new Date().toISOString(),
        archive_reason: reason || null
      }).eq('id', itemId);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      alert('보관 실패: ' + (err.message || err));
    }
  };

  // 다중 선택 일괄 보관
  const moveMultipleToArchive = async (ids, reason = '') => {
    if (!ids || ids.length === 0) return;
    try {
      const { error } = await supabase.from('items').update({
        archived: true,
        archived_at: new Date().toISOString(),
        archive_reason: reason || null
      }).in('id', ids);
      if (error) throw error;
      const idSet = new Set(ids);
      setItems(prev => prev.filter(i => !idSet.has(i.id)));
    } catch (err) {
      alert('일괄 보관 실패: ' + (err.message || err));
    }
  };

  // 선택 토글 / 모드 종료 / 전체 선택
  const toggleSelect = (itemId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredItems.map(i => i.id)));
  };

  const restoreFromArchive = async (itemId) => {
    try {
      const { error } = await supabase.from('items').update({
        archived: false,
        archived_at: null,
        archive_reason: null
      }).eq('id', itemId);
      if (error) throw error;
      setArchiveItems(prev => prev.filter(i => i.id !== itemId));
      await loadMonthData(); // 현재 월에 해당하면 다시 표시
    } catch (err) {
      alert('복원 실패: ' + (err.message || err));
    }
  };

  const deleteFromArchive = async (itemId) => {
    try {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) throw error;
      setArchiveItems(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      alert('영구 삭제 실패: ' + (err.message || err));
    }
  };

  const loadArchive = async () => {
    setArchiveLoading(true);
    try {
      const { data, error } = await supabase
        .from('items').select('*')
        .eq('archived', true)
        .order('archived_at', { ascending: false });
      if (error) throw error;
      setArchiveItems((data || []).map(dbToItem));
    } catch (err) {
      alert('보관함 로드 실패: ' + (err.message || err));
    } finally {
      setArchiveLoading(false);
    }
  };

  const openArchive = async () => {
    setArchiveOpen(true);
    await loadArchive();
  };

  const toggleCompleted = async (itemId) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      const newCompleted = !item.completed;
      // 발행(완료)하려면 레퍼런스 URL 필요 — 없으면 막고 수정 모달 열기
      if (newCompleted && !(item.referenceUrl && item.referenceUrl.trim())) {
        alert('발행하려면 레퍼런스 URL이 필요해요.\n레퍼런스를 먼저 채워주세요.');
        setEditingItem({ ...item });
        setSelectedItem(null);
        return;
      }
      const { error } = await supabase.from('items').update({ completed: newCompleted }).eq('id', itemId);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, completed: newCompleted } : i));
      setSelectedItem(prev => prev && prev.id === itemId ? { ...prev, completed: newCompleted } : prev);
    } catch (err) {
      alert('업데이트 실패: ' + (err.message || err));
    }
  };

  // ============================================
  // 드래그앤드롭
  // ============================================
  const moveItem = async (itemId, newDate) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item || item.date === newDate) return;
      const { error } = await supabase.from('items').update({ date: newDate }).eq('id', itemId);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, date: newDate } : i));
    } catch (err) {
      alert('일정 변경 실패: ' + (err.message || err));
    }
  };

  const handleDragStart = (e, itemId) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
    setDraggingId(itemId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverDate(null);
  };

  const handleDragOver = (e, dateStr) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDate !== dateStr) setDragOverDate(dateStr);
  };

  const handleDragLeave = (e, dateStr) => {
    // relatedTarget이 같은 셀 안인지 확인
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverDate === dateStr) setDragOverDate(null);
  };

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    setDragOverDate(null);
    if (itemId) await moveItem(itemId, dateStr);
  };

  const updatePerformance = (itemId, field, value) => {
    setPerformance(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [field]: value } }));
  };

  // 현재 로드된 items를 ref로 추적 (performance 자동저장이 items 변경마다 재실행되지 않도록)
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      for (const [itemId, perf] of Object.entries(performance)) {
        if (!itemsRef.current.find(i => i.id === itemId)) continue;
        try {
          await supabase.from('performance').upsert({
            item_id: itemId,
            user_id: userId,
            url: perf.url || null,
            likes: perf.likes ? parseInt(perf.likes, 10) : null,
            saves: perf.saves ? parseInt(perf.saves, 10) : null,
            note: perf.note || null
          });
        } catch (e) {
          console.error('performance 저장 실패:', e);
        }
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [performance, userId]);

  // 필터 적용
  const applyFilters = (allItems) => {
    return allItems.filter(it => {
      // 검색어
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (it.title || '').toLowerCase().includes(q);
        const matchKeyword = (it.mainKeyword || '').toLowerCase().includes(q);
        const matchAsset = (it.asset || '').toLowerCase().includes(q);
        const matchDesc = (it.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchKeyword && !matchAsset && !matchDesc) return false;
      }
      // 채널 필터
      if (filterChannels.size > 0 && !filterChannels.has(it.channel)) return false;
      // 완료 여부
      if (filterCompleted === 'todo' && it.completed) return false;
      if (filterCompleted === 'done' && !it.completed) return false;
      // 핵심만
      if (filterCore && !it.isCore) return false;
      // 레퍼런스 유무
      const hasRef = !!(it.referenceUrl && it.referenceUrl.trim());
      if (filterRef === 'has' && !hasRef) return false;
      if (filterRef === 'none' && hasRef) return false;
      return true;
    });
  };
  const filteredItems = applyFilters(items);
  const isFiltered = searchQuery || filterChannels.size > 0 || filterCompleted !== 'all' || filterCore || filterRef !== 'all';

  // 날짜별 실제 발행(예정) 채널 집합 — 발행 목표 달성 여부 판정용 (필터와 무관하게 전체 items 기준)
  const dateChannelMap = {};
  items.forEach(i => {
    if (!dateChannelMap[i.date]) dateChannelMap[i.date] = new Set();
    dateChannelMap[i.date].add(i.channel);
  });

  // 캘린더 그리드 (6주 = 42일, 이전달·다음달 일부 포함)
  const [yearStr, monthStr] = currentMonth.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const startDateObj = new Date(yearNum, monthNum - 1, 1);
  const startDay = startDateObj.getDay();
  const lastDay = new Date(yearNum, monthNum, 0).getDate();

  // 오늘 + 이번 주 계산 (일요일 시작 기준)
  const _todayObj = new Date();
  const _todayStr = `${_todayObj.getFullYear()}-${String(_todayObj.getMonth() + 1).padStart(2, '0')}-${String(_todayObj.getDate()).padStart(2, '0')}`;
  const _thisWeekStart = new Date(_todayObj);
  _thisWeekStart.setDate(_todayObj.getDate() - _todayObj.getDay()); // 일요일
  _thisWeekStart.setHours(0, 0, 0, 0);
  const _thisWeekEnd = new Date(_thisWeekStart);
  _thisWeekEnd.setDate(_thisWeekStart.getDate() + 6);
  _thisWeekEnd.setHours(23, 59, 59, 999);

  // 6주 그리드 시작점 = 이번달 1일이 속한 주의 일요일
  const _gridStart = new Date(yearNum, monthNum - 1, 1 - startDay);
  const _fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(_gridStart);
    dt.setDate(_gridStart.getDate() + i);
    const dateStr = _fmtDate(dt);
    const dow = dt.getDay();
    const dayItems = filteredItems.filter(it => it.date === dateStr);
    const isToday = dateStr === _todayStr;
    const isThisWeek = dt >= _thisWeekStart && dt <= _thisWeekEnd;
    const isCurrentMonth = dt.getFullYear() === yearNum && (dt.getMonth() + 1) === monthNum;
    cells.push({
      empty: false,
      key: dateStr,
      day: dt.getDate(),
      dow,
      dateStr,
      dayItems,
      holiday: HOLIDAYS[dateStr],
      anniversary: ANNIVERSARIES[dateStr],
      isToday,
      isThisWeek,
      isCurrentMonth
    });
  }

  // 마지막 주가 전부 다음달이면 그 주는 자르기 (5주짜리 월 대응)
  const lastWeekStart = 35;
  const lastWeekAllOtherMonth = cells.slice(lastWeekStart, 42).every(c => !c.isCurrentMonth);
  if (lastWeekAllOtherMonth) cells.length = lastWeekStart;

  const toggleChannelFilter = (channel) => {
    setFilterChannels(prev => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  };
  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterChannels(new Set());
    setFilterCompleted('all');
    setFilterCore(false);
    setFilterRef('all');
  };

  const prevMonth = () => {
    const d = new Date(yearNum, monthNum - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(yearNum, monthNum, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const goToday = () => setCurrentMonth(todayYM);
  const handleSignOut = () => supabase.auth.signOut();

  const newItemDefaults = (initialDate) => {
    // 기본 채널 = 'moment-insta-daily'가 있으면 그것, 없으면 첫 채널
    const def = channels.find(c => c.value === 'moment-insta-daily') || channels[0] || DEFAULT_CHANNELS[1];
    return {
      id: '', title: '',
      date: initialDate || `${currentMonth}-01`, time: '21:00',
      channel: def.value,
      channelName: def.label,
      isCore: false, mainKeyword: '', subKeywords: [], strength: '', asset: '',
      nextSkill: def.skill || '', referenceUrl: '', attachments: [], description: '', completed: false
    };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F1EFE8', fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: '#1A1A1A' }} className="app-root">
      <style>{`
        * { box-sizing: border-box; }
        @keyframes sheetFadeIn { from { background: rgba(0,0,0,0); } to { background: rgba(0,0,0,0.5); } }
        @keyframes sheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .app-root { padding: 1.5rem 1rem; }
        @media (max-width: 640px) { .app-root { padding: 1rem 0.75rem; } }
        @media (max-width: 380px) { .app-root { padding: 0.75rem 0.5rem; } }
        .cal-cell { background: #FFFFFF; border-radius: 8px; padding: 6px 6px 4px; min-height: 110px; max-height: 180px; position: relative; transition: background 0.15s, box-shadow 0.15s; display: flex; flex-direction: column; overflow: hidden; }
        .cal-cell-empty { min-height: 110px; max-height: 180px; }
        .cal-cell.holiday { background: #FDF0E8; }
        .cal-cell.drag-over { background: #F0EDE0; box-shadow: inset 0 0 0 2px #1A1A1A; }
        .cal-cell.today { background: #FFF8E7; box-shadow: 0 0 0 2px #1A1A1A, 0 2px 8px rgba(0,0,0,0.06); position: relative; z-index: 1; }
        .cal-cell.today.holiday { background: #FFF0E0; }
        .cal-cell.other-month { background: #F8F7F2; }
        .cal-cell.other-month .day-num { color: #BFBDB5; }
        .cal-cell.other-month .day-num.sun { color: #E8B5C8; }
        .cal-cell.other-month .day-num.sat { color: #B5C5DD; }
        .cal-cell.other-month .day-event { color: #BFBDB5; }
        .cal-cell.other-month .cal-item { opacity: 0.55; }
        .cal-cell.other-month.holiday { background: #FAEEE6; }
        .cal-cell.other-month.drag-over { background: #EDE9DC; }
        .cal-cell .day-num { font-size: 15px; font-weight: 500; display: flex; align-items: center; gap: 5px; line-height: 1.1; }
        .cal-cell .day-num.sun { color: #D4537E; }
        .cal-cell .day-num.sat { color: #5C7AA8; }
        .cal-cell.today .day-num .day-text { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 6px; border-radius: 12px; background: #1A1A1A; color: #FFFFFF; font-weight: 600; font-size: 13px; }
        .cal-cell.today .day-num.sun .day-text { background: #D4537E; }
        .cal-cell.today .day-num.sat .day-text { background: #5C7AA8; }
        .today-badge { display: inline-flex; align-items: center; font-size: 10px; background: #1A1A1A; color: #FFFFFF; padding: 1px 6px; border-radius: 3px; font-weight: 500; letter-spacing: 0.3px; line-height: 1.4; }
        .day-event { font-size: 10.5px; color: #888780; margin-top: 2px; line-height: 1.3; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .cal-grid.this-week { background: #FAF5E8; border-radius: 10px; padding: 4px; gap: 4px; margin-top: 4px; margin-bottom: 4px; }
        .dow-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 6px; }
        .dow-row > div { font-size: 12.5px; color: #5F5E5A; text-align: center; padding: 6px 0; font-weight: 500; }
        .dow-row > div.sun { color: #D4537E; }
        .dow-row > div.sat { color: #5C7AA8; }
        .cal-item { width: 100%; padding: 4px 6px; border-radius: 4px; font-size: 11.5px; margin-top: 3px; cursor: grab; border: none; border-left: 3px solid; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: inherit; transition: opacity 0.15s, transform 0.1s; line-height: 1.35; font-weight: 500; }
        .cal-item:active { cursor: grabbing; }
        .cal-item.completed { opacity: 0.5; text-decoration: line-through; }
        .cal-item.dragging { opacity: 0.3; transform: scale(0.95); }
        .cal-item.select-mode { cursor: pointer; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 1000; }
        .modal-content { background: #FFFFFF; border-radius: 12px; padding: 22px; max-width: 480px; width: 100%; max-height: 90vh; overflow: auto; }
        .header-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 1rem; }
        .header-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .header-nav { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .month-title { font-size: 20px; font-weight: 600; margin: 0 0 2px; }
        .user-email { font-size: 12px; color: #5F5E5A; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .view-toggle { display: flex; gap: 0; background: #FFFFFF; border-radius: 10px; padding: 3px; }
        .view-toggle-btn { flex: 1; padding: 8px 10px; background: transparent; border: none; cursor: pointer; font-size: 13px; font-family: inherit; color: #5F5E5A; border-radius: 8px; transition: all 0.15s; font-weight: 500; white-space: nowrap; }
        .view-toggle-btn.active { background: #1A1A1A; color: #FFFFFF; }
        .view-toggle-btn:hover:not(.active) { color: #1A1A1A; }

        .control-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 1rem; }
        .search-filter { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .search-box { display: flex; align-items: center; gap: 6px; background: #FFFFFF; border-radius: 10px; padding: 8px 12px; min-width: 200px; }
        .search-input { border: none; outline: none; background: transparent; font-size: 13px; font-family: inherit; flex: 1; min-width: 100px; color: #1A1A1A; }
        .search-input::placeholder { color: #888780; }
        .search-clear { background: transparent; border: none; cursor: pointer; color: #888780; font-size: 16px; padding: 0 4px; line-height: 1; font-family: inherit; }
        .filter-btn { background: #FFFFFF; border: none; border-radius: 10px; padding: 8px 14px; cursor: pointer; font-size: 13px; font-family: inherit; color: #5F5E5A; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; }
        .filter-btn.active { color: #1A1A1A; font-weight: 600; }
        .filter-dot { width: 6px; height: 6px; border-radius: 50%; background: #D4537E; display: inline-block; }
        .filter-clear-btn { background: transparent; border: none; cursor: pointer; font-size: 12px; font-family: inherit; color: #888780; padding: 6px 8px; }
        .filter-clear-btn:hover { color: #D4537E; }

        .filter-panel { background: #FFFFFF; border-radius: 12px; padding: 16px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 14px; }
        .filter-section-label { font-size: 12px; color: #888780; font-weight: 500; margin-bottom: 8px; }
        .filter-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .filter-chip { background: #F4F2EC; border: 1px solid transparent; border-radius: 16px; padding: 6px 12px; font-size: 12px; font-family: inherit; color: #5F5E5A; cursor: pointer; transition: all 0.15s; }
        .filter-chip:hover { background: #E8E5DC; }
        .filter-chip.active { background: #1A1A1A; color: #FFFFFF; }

        .filter-result-count { font-size: 12px; color: #5F5E5A; padding: 6px 4px 12px; }

        .kpi-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .kpi-card { background: #FFFFFF; border-radius: 12px; padding: 16px; }
        .kpi-card-label { font-size: 12px; color: #888780; margin-bottom: 6px; }
        .kpi-card-value { font-size: 22px; font-weight: 600; line-height: 1.1; }
        .kpi-card-sub { font-size: 11px; margin-top: 4px; }
        .kpi-card-full { background: #FFFFFF; border-radius: 12px; padding: 18px; }
        .kpi-card-title { font-size: 14px; font-weight: 600; margin-bottom: 14px; color: #1A1A1A; }
        .kpi-bar-track { width: 100%; height: 10px; background: #D8D5CC; border-radius: 5px; overflow: hidden; position: relative; }
        .kpi-bar-fill { height: 100%; transition: width 0.4s ease-out; border-radius: 5px; }

        .list-view { display: flex; flex-direction: column; gap: 8px; }
        .list-day { background: #FFFFFF; border-radius: 12px; overflow: hidden; transition: box-shadow 0.15s; }
        .list-day.today { background: #FFF8E7; box-shadow: 0 0 0 2px #1A1A1A, 0 2px 8px rgba(0,0,0,0.06); }
        .list-day.expanded { box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .list-day-header-btn { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 14px 16px; background: transparent; border: none; cursor: pointer; font-family: inherit; text-align: left; transition: background 0.1s; }
        .list-day-header-btn:hover { background: #FAF9F5; }
        .list-day.expanded .list-day-header-btn { border-bottom: 0.5px solid rgba(0,0,0,0.06); }
        .list-arrow { display: inline-block; font-size: 18px; color: #888780; transition: transform 0.2s; flex-shrink: 0; line-height: 1; width: 14px; text-align: center; }
        .list-arrow.expanded { transform: rotate(90deg); }
        .list-day-date { font-size: 15px; font-weight: 600; color: #1A1A1A; display: flex; align-items: center; gap: 4px; }
        .list-day-date .dow { font-size: 13px; color: #5F5E5A; margin-left: 2px; font-weight: 400; }
        .list-day-date .dow.sun { color: #D4537E; }
        .list-day-date .dow.sat { color: #5C7AA8; }
        .today-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #1A1A1A; margin-right: 6px; }
        .list-day-event { font-size: 12px; color: #888780; }
        .list-day-event.holiday { color: #D4537E; }
        .list-day-count { font-size: 12px; color: #5F5E5A; padding: 3px 8px; background: #F4F2EC; border-radius: 10px; font-weight: 500; }
        .list-day-add-btn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #F4F2EC; color: #5F5E5A; border-radius: 50%; cursor: pointer; font-size: 16px; line-height: 1; user-select: none; transition: background 0.1s, color 0.1s; }
        .list-day-add-btn:hover { background: #1A1A1A; color: #FFFFFF; }
        .list-items { padding: 4px 0 8px; }
        .list-item { display: flex; gap: 10px; padding: 10px 16px; cursor: pointer; align-items: center; transition: background 0.1s; border: none; background: transparent; width: 100%; text-align: left; font-family: inherit; }
        .list-item:hover { background: #F8F8F6; }
        .list-item.selected { background: #F0EDE0; }
        .list-item-dot { width: 4px; align-self: stretch; min-height: 32px; border-radius: 2px; flex-shrink: 0; }
        .list-item-content { flex: 1; min-width: 0; }
        .list-item-title { font-size: 14px; color: #1A1A1A; font-weight: 500; line-height: 1.4; word-break: keep-all; }
        .list-item-title.completed { opacity: 0.5; text-decoration: line-through; }
        .list-item-meta { font-size: 11px; color: #888780; margin-top: 3px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .list-empty { padding: 40px 20px; text-align: center; color: #888780; font-size: 13px; }
        .list-select-check { font-size: 16px; flex-shrink: 0; color: #1A1A1A; }

        .week-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .week-grid { display: grid; grid-template-columns: repeat(7, minmax(120px, 1fr)); gap: 4px; width: 100%; min-width: 700px; }
        .week-cell { background: #FFFFFF; border-radius: 8px; padding: 10px 8px; min-height: 320px; display: flex; flex-direction: column; overflow: hidden; transition: background 0.15s, box-shadow 0.15s; }
        .week-cell.holiday { background: #FDF0E8; }
        .week-cell.today { background: #FFF8E7; box-shadow: 0 0 0 2px #1A1A1A, 0 2px 8px rgba(0,0,0,0.06); }
        .week-cell.today.holiday { background: #FFF0E0; }
        .week-cell-header { padding-bottom: 8px; border-bottom: 0.5px solid rgba(0,0,0,0.06); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .week-cell-day { font-size: 20px; font-weight: 600; line-height: 1; }
        .week-cell.today .week-cell-day { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 15px; background: #1A1A1A; color: #FFFFFF; font-size: 15px; }
        .week-cell-dow { font-size: 12px; color: #5F5E5A; }
        .week-cell-items { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .week-item { padding: 7px 9px; border-radius: 6px; font-size: 12px; cursor: grab; border: none; text-align: left; font-family: inherit; line-height: 1.35; word-break: keep-all; font-weight: 500; }
        .week-item.completed { opacity: 0.5; text-decoration: line-through; }

        .bulk-bar { position: fixed; left: 0; right: 0; bottom: 0; background: #1A1A1A; color: #FFFFFF; padding: 14px 20px; display: flex; align-items: center; gap: 12px; z-index: 1500; box-shadow: 0 -4px 16px rgba(0,0,0,0.15); }

        /* 발행 목표 오버레이 (월간 점 / 주간 칩) */
        .plan-dots { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin: 2px 0 3px; }
        .plan-dot { width: 9px; height: 9px; border-radius: 50%; box-sizing: border-box; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
        .plan-dot.unmet { opacity: 0.4; }
        .plan-chips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin: 0 0 8px; }
        .plan-chips-label { font-size: 9.5px; color: #B0AEA6; font-weight: 600; letter-spacing: 0.4px; margin-right: 1px; }
        .plan-chip { font-size: 10.5px; line-height: 1.4; padding: 2px 7px; border-radius: 9px; border: 1px solid transparent; font-weight: 500; white-space: nowrap; }
        .plan-chip.unmet { background: transparent !important; border-style: dashed; opacity: 0.75; }

        /* 발행 계획 보드 */
        .plan-intro { background: #FFFFFF; border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; }
        .plan-intro-title { font-size: 15px; font-weight: 600; color: #1A1A1A; margin: 0 0 4px; }
        .plan-intro-sub { font-size: 12.5px; color: #888780; line-height: 1.55; margin: 0; }
        .plan-palette { background: #FFFFFF; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
        .plan-palette-label { font-size: 12px; color: #888780; font-weight: 500; margin-bottom: 10px; }
        .plan-palette-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .plan-pal-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 10px; font-size: 12.5px; font-weight: 500; cursor: grab; border: 1px solid transparent; font-family: inherit; user-select: none; transition: transform 0.1s, box-shadow 0.1s; }
        .plan-pal-chip:active { cursor: grabbing; }
        .plan-pal-chip.dragging { opacity: 0.4; }
        .plan-pal-dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
        .plan-board { display: grid; grid-template-columns: repeat(7, minmax(124px, 1fr)); gap: 6px; width: 100%; min-width: 760px; }
        .plan-col { background: #FFFFFF; border-radius: 10px; padding: 10px 8px 8px; min-height: 200px; display: flex; flex-direction: column; transition: background 0.15s, box-shadow 0.15s; }
        .plan-col.over { background: #F4F1E6; box-shadow: inset 0 0 0 2px #1A1A1A; }
        .plan-col-head { display: flex; align-items: baseline; gap: 6px; padding: 0 4px 8px; border-bottom: 0.5px solid rgba(0,0,0,0.06); margin-bottom: 8px; }
        .plan-col-dow { font-size: 14px; font-weight: 700; }
        .plan-col-count { font-size: 11px; color: #B0AEA6; margin-left: auto; }
        .plan-col-body { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .plan-day-chip { display: flex; align-items: center; gap: 6px; padding: 7px 8px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: grab; border-left: 3px solid; font-family: inherit; text-align: left; }
        .plan-day-chip:active { cursor: grabbing; }
        .plan-day-chip .x { margin-left: auto; cursor: pointer; color: inherit; opacity: 0.5; font-size: 14px; line-height: 1; padding: 0 2px; }
        .plan-day-chip .x:hover { opacity: 1; }
        .plan-col-empty { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; color: #C4C2BA; font-size: 11px; line-height: 1.5; border: 1px dashed #E3E0D7; border-radius: 8px; padding: 14px 6px; min-height: 60px; }
        .plan-add-btn { margin-top: 6px; width: 100%; background: #F4F2EC; border: none; border-radius: 8px; padding: 7px; cursor: pointer; font-size: 12px; color: #5F5E5A; font-family: inherit; transition: background 0.1s, color 0.1s; }
        .plan-add-btn:hover { background: #1A1A1A; color: #FFFFFF; }
        .plan-add-pop { background: #FAF9F5; border: 0.5px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 6px; margin-top: 6px; display: flex; flex-direction: column; gap: 3px; }
        .plan-add-pop button { display: flex; align-items: center; gap: 6px; background: transparent; border: none; padding: 6px 7px; border-radius: 6px; cursor: pointer; font-size: 12px; color: #1A1A1A; font-family: inherit; text-align: left; }
        .plan-add-pop button:hover { background: #ECE9E0; }
        .plan-summary { background: #FFFFFF; border-radius: 12px; padding: 16px 18px; margin-top: 14px; }
        .plan-summary-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
        .plan-summary-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; }
        .plan-summary-row + .plan-summary-row { border-top: 0.5px solid rgba(0,0,0,0.05); }
        .plan-summary-days { display: flex; gap: 3px; margin-left: auto; }
        .plan-summary-day { width: 20px; height: 20px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; }
        /* 모바일: 7열 가로 스크롤 대신 세로 스택 */
        .plan-board.stack { display: flex; flex-direction: column; gap: 8px; min-width: 0; width: 100%; }
        .plan-board.stack .plan-col { min-height: auto; padding: 11px 12px 11px; }
        .plan-board.stack .plan-col-head { padding: 0 0 8px; }
        .plan-board.stack .plan-col-body { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 6px; }
        .plan-board.stack .plan-day-chip { flex: 0 0 auto; }
        .plan-board.stack .plan-add-btn { width: auto; flex: 0 0 auto; margin-top: 0; padding: 7px 13px; }
        .plan-board.stack .plan-add-pop { flex: 0 0 100%; width: 100%; margin-top: 4px; }
        @media (max-width: 640px) {
          .plan-intro-title { font-size: 14px; }
          .plan-summary-row { flex-wrap: wrap; }
          .plan-summary-days { margin-left: 0; width: 100%; justify-content: flex-start; padding-left: 19px; margin-top: 4px; }
        }

        @media (max-width: 640px) {
          .cal-cell { min-height: 90px; max-height: 140px; padding: 5px 4px; }
          .cal-cell-empty { min-height: 90px; max-height: 140px; }
          .cal-cell .day-num { font-size: 13px; }
          .cal-cell.today .day-num .day-text { min-width: 22px; height: 22px; font-size: 12px; }
          .today-badge { font-size: 9px; padding: 1px 4px; }
          .day-event { font-size: 9.5px; }
          .cal-item { font-size: 11px; padding: 3px 5px; }
          .day-event { font-size: 8px; }
          .cal-item { font-size: 9px; padding: 2px 4px; }
          .modal-overlay { padding: 0; align-items: flex-end; }
          .modal-content { border-radius: 16px 16px 0 0; max-height: 92vh; padding: 18px; max-width: 100%; }
          .header-row { gap: 6px; }
          .month-title { font-size: 17px; }
          .user-email { font-size: 11px; max-width: 100%; }
          .cal-grid { gap: 2px; }
          .dow-row { gap: 2px; }
          .dow-row > div { font-size: 11.5px; padding: 4px 0; }
          .control-bar { flex-direction: column; align-items: stretch; gap: 8px; }
          .view-toggle { max-width: 100%; }
          .view-toggle-btn { padding: 8px 8px; font-size: 12px; }
          .search-filter { width: 100%; }
          .search-box { flex: 1; min-width: 0; }
          .week-cell { min-height: 240px; padding: 8px 5px; }
          .week-cell-day { font-size: 17px; }
          .week-cell.today .week-cell-day { min-width: 26px; height: 26px; font-size: 13px; }
          .week-item { font-size: 11.5px; padding: 5px 6px; }
          .list-day-header-btn { padding: 12px 14px; }
          .list-day-date { font-size: 14px; }
          .list-day-count { font-size: 11px; padding: 2px 7px; }
          .list-item { padding: 10px 14px; gap: 8px; }
          .list-item-title { font-size: 13px; }
          .kpi-cards { grid-template-columns: repeat(2, 1fr); }
          .bulk-bar { padding: 12px 14px; gap: 8px; flex-wrap: wrap; }
        }
        @media (max-width: 380px) {
          .cal-cell { min-height: 80px; max-height: 120px; padding: 4px 3px; }
          .cal-cell-empty { min-height: 80px; max-height: 120px; }
          .cal-cell .day-num { font-size: 10px; }
          .cal-item { font-size: 8px; padding: 2px 3px; }
          .day-event { font-size: 7px; }
          .month-title { font-size: 15px; }
          .user-email { display: none; }
          .week-cell { min-height: 200px; padding: 6px 4px; }
        }

        /* 콘텐츠 작성/수정 모달 — 태블릿·웹에서 넓게, 모바일은 하단 시트 풀폭 */
        .modal-content.edit-modal { max-width: 620px; }
        @media (min-width: 1024px) { .modal-content.edit-modal { max-width: 720px; } }
        @media (max-width: 640px) { .modal-content.edit-modal { max-width: 100%; } }
        /* 상세 모달 — 수정 모달과 동일한 폭 */
        .modal-content.detail-modal { max-width: 620px; }
        @media (min-width: 1024px) { .modal-content.detail-modal { max-width: 720px; } }
        @media (max-width: 640px) { .modal-content.detail-modal { max-width: 100%; } }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: selectMode ? 80 : 0 }}>
        <div className="header-row">
          <div className="header-top">
            <div className="header-nav">
              <button onClick={prevMonth} style={navBtnStyle} aria-label="이전">‹</button>
              <div style={{ minWidth: 110, textAlign: 'center' }}>
                <h1 className="month-title">{yearNum}년 {monthNum}월</h1>
                <p style={{ fontSize: 11, color: '#5F5E5A', margin: 0 }}>moment.in × ohana</p>
              </div>
              <button onClick={nextMonth} style={navBtnStyle} aria-label="다음">›</button>
              <button onClick={goToday} style={{ ...navBtnStyle, width: 'auto', padding: '6px 10px', fontSize: 12, color: '#5F5E5A' }}>오늘</button>
            </div>
            <div className="header-actions">
              <button onClick={() => setEditingItem(newItemDefaults(todayDateStr))} style={{ background: '#1A1A1A', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap' }}>+ 새 콘텐츠</button>
              <button onClick={() => { if (selectMode) exitSelectMode(); else setSelectMode(true); }} style={{ background: selectMode ? '#1A1A1A' : 'transparent', color: selectMode ? '#FFFFFF' : '#5F5E5A', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }} title="여러 개 선택">{selectMode ? '✕ 선택 해제' : '✓ 선택'}</button>
              <button onClick={openArchive} style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer', whiteSpace: 'nowrap' }} title="보관함">📦 보관함</button>
              <button onClick={() => setChannelMgrOpen(true)} style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer', whiteSpace: 'nowrap' }} title="채널 관리">🎨 채널</button>
              <span className="user-email">{userEmail}</span>
              <button onClick={handleSignOut} style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer', whiteSpace: 'nowrap' }}>로그아웃</button>
            </div>
          </div>
        </div>

        {/* 선택 모드 안내 */}
        {selectMode && (
          <div style={{ background: '#FAF5E8', border: '0.5px solid #E5DCC4', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#5F5E5A' }}>
            콘텐츠를 탭해 선택하고 하단 바에서 한 번에 보관하세요.
          </div>
        )}

        {/* 뷰 토글 + 검색·필터 */}
        <div className="control-bar">
          <div className="view-toggle">
            {[
              { value: 'month', label: '월간' },
              { value: 'week', label: '주간' },
              { value: 'list', label: '리스트' },
              { value: 'kpi', label: 'KPI' },
              { value: 'plan', label: '발행 계획' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setViewMode(opt.value)}
                className={`view-toggle-btn ${viewMode === opt.value ? 'active' : ''}`}
              >{opt.label}</button>
            ))}
          </div>

          <div className="search-filter">
            {(viewMode === 'month' || viewMode === 'week') && (
              <button
                onClick={togglePlanOverlay}
                className={`filter-btn ${showPlanOverlay ? 'active' : ''}`}
                title="요일별 발행 목표를 캘린더에 표시"
              >🎯 목표 {showPlanOverlay ? 'ON' : 'OFF'}</button>
            )}
            <div className="search-box">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="6" cy="6" r="4.5" stroke="#888780" strokeWidth="1.3" fill="none" />
                <path d="M9.5 9.5 L12 12" stroke="#888780" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색"
                className="search-input"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="search-clear" aria-label="검색 지우기">×</button>
              )}
            </div>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`filter-btn ${(filterChannels.size > 0 || filterCompleted !== 'all' || filterCore || filterRef !== 'all') ? 'active' : ''}`}
              title="필터"
            >
              필터{(filterChannels.size > 0 || filterCompleted !== 'all' || filterCore || filterRef !== 'all') && <span className="filter-dot" />}
            </button>
            {isFiltered && (
              <button onClick={clearAllFilters} className="filter-clear-btn">초기화</button>
            )}
          </div>
        </div>

        {/* 필터 패널 */}
        {filterOpen && (
          <div className="filter-panel">
            <div className="filter-section">
              <div className="filter-section-label">채널</div>
              <div className="filter-chips">
                {(() => {
                  return CHANNEL_OPTIONS.map(opt => {
                    const c = COLORS[opt.value] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                    const active = filterChannels.has(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleChannelFilter(opt.value)}
                        className={`filter-chip ${active ? 'active' : ''}`}
                        style={active ? { background: c.bg, color: c.fg, borderColor: c.fg } : {}}
                      >{opt.label}</button>
                    );
                  });
                })()}
              </div>
            </div>
            <div className="filter-section">
              <div className="filter-section-label">상태</div>
              <div className="filter-chips">
                {[
                  { value: 'all', label: '전체' },
                  { value: 'todo', label: '미발행' },
                  { value: 'done', label: '발행 완료' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterCompleted(opt.value)}
                    className={`filter-chip ${filterCompleted === opt.value ? 'active' : ''}`}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
            <div className="filter-section">
              <div className="filter-section-label">유형</div>
              <div className="filter-chips">
                <button
                  onClick={() => setFilterCore(c => !c)}
                  className={`filter-chip ${filterCore ? 'active' : ''}`}
                >★ 핵심 콘텐츠만</button>
              </div>
            </div>
            <div className="filter-section">
              <div className="filter-section-label">레퍼런스</div>
              <div className="filter-chips">
                {[
                  { value: 'all', label: '전체' },
                  { value: 'has', label: '🔗 있음' },
                  { value: 'none', label: '⚠️ 없음' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterRef(opt.value)}
                    className={`filter-chip ${filterRef === opt.value ? 'active' : ''}`}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 필터 결과 카운트 */}
        {isFiltered && (
          <div className="filter-result-count">
            {filteredItems.length}편 표시됨 · 전체 {items.length}편
          </div>
        )}

        {loading && <div style={{ padding: 20, textAlign: 'center', color: '#5F5E5A', fontSize: 13 }}>불러오는 중...</div>}
        {error && <div style={{ padding: 12, background: '#FAF0F4', color: '#D4537E', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>오류: {error}</div>}

        {!loading && !error && viewMode === 'month' && (
          <>
            <div className="dow-row">{dayLabels.map((label, i) => (
              <div key={label} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{label}</div>
            ))}</div>
            {/* 주 단위로 7개씩 분할 */}
            {(() => {
              const weeks = [];
              for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
              return weeks.map((week, wIdx) => {
                const isThisWeekRow = week.some(c => !c.empty && c.isThisWeek);
                return (
                  <div key={`w-${wIdx}`} className={`cal-grid ${isThisWeekRow ? 'this-week' : ''}`}>
                    {week.map(cell => {
                      if (cell.empty) return <div key={cell.key} className="cal-cell-empty" />;
                      const dayClass = cell.dow === 0 ? 'sun' : cell.dow === 6 ? 'sat' : '';
                      const isDragOver = dragOverDate === cell.dateStr;
                      return (
                        <div
                          key={cell.key}
                          className={`cal-cell ${cell.holiday ? 'holiday' : ''} ${isDragOver ? 'drag-over' : ''} ${cell.isToday ? 'today' : ''} ${!cell.isCurrentMonth ? 'other-month' : ''}`}
                          onDragOver={(e) => handleDragOver(e, cell.dateStr)}
                          onDragLeave={(e) => handleDragLeave(e, cell.dateStr)}
                          onDrop={(e) => handleDrop(e, cell.dateStr)}
                          onDoubleClick={(e) => {
                            if (selectMode) return;
                            if (e.target.classList.contains('cal-item')) return;
                            setEditingItem(newItemDefaults(cell.dateStr));
                          }}
                          title={cell.isToday ? '오늘' : (!cell.isCurrentMonth ? `${cell.dateStr} (다른 달 — 더블클릭으로 콘텐츠 추가, 드래그로 이동 가능)` : '더블클릭하여 새 콘텐츠 추가')}
                        >
                          <div className={`day-num ${dayClass}`}>
                            <span className="day-text">{cell.day}</span>
                            {cell.isToday && <span className="today-badge">오늘</span>}
                          </div>
                          {cell.holiday && <div className="day-event" style={{ color: '#D4537E', fontWeight: 500 }}>{cell.holiday}</div>}
                          {cell.anniversary && <div className="day-event">{cell.anniversary}</div>}
                          {showPlanOverlay && (
                            <PlanTargets dow={cell.dow} plan={weekdayPlan} present={dateChannelMap[cell.dateStr]} variant="dots" />
                          )}
                          {cell.dayItems.map(it => {
                            const c = COLORS[it.channel] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                            const isDragging = draggingId === it.id;
                            const isSelected = selectMode && selectedIds.has(it.id);
                            return (
                              <button
                                key={it.id}
                                className={`cal-item ${it.completed ? 'completed' : ''} ${isDragging ? 'dragging' : ''} ${selectMode ? 'select-mode' : ''}`}
                                style={{ background: c.bg, color: c.fg, borderLeftColor: c.fg, boxShadow: isSelected ? 'inset 0 0 0 2px #1A1A1A' : 'none' }}
                                draggable={!selectMode}
                                onDragStart={(e) => handleDragStart(e, it.id)}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectMode) { toggleSelect(it.id); return; }
                                  if (!isDragging) setSelectedItem(it);
                                }}
                                onContextMenu={(e) => {
                                  if (selectMode) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setContextMenu({ x: e.clientX, y: e.clientY, item: it });
                                }}
                              >
                                {selectMode && (isSelected ? '☑ ' : '☐ ')}<RefMark it={it} />{it.isCore && '★ '}{it.title}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </>
        )}

        {!loading && !error && viewMode === 'week' && (
          <WeekView
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            items={filteredItems}
            plan={weekdayPlan}
            showPlanOverlay={showPlanOverlay}
            dateChannelMap={dateChannelMap}
            holidays={HOLIDAYS}
            anniversaries={ANNIVERSARIES}
            onItemClick={setSelectedItem}
            onItemContextMenu={(e, it) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, item: it });
            }}
            draggingId={draggingId}
            dragOverDate={dragOverDate}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            isMobile={isMobile}
            selectMode={selectMode}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
          />
        )}

        {!loading && !error && viewMode === 'list' && (
          <ListView
            key={currentMonth}
            items={filteredItems}
            currentMonth={currentMonth}
            holidays={HOLIDAYS}
            anniversaries={ANNIVERSARIES}
            onItemClick={setSelectedItem}
            onItemContextMenu={(e, it) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, item: it });
            }}
            onAddClick={(dateStr) => setEditingItem(newItemDefaults(dateStr))}
            selectMode={selectMode}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
          />
        )}

        {!loading && !error && viewMode === 'kpi' && (
          <KPIView items={items} performance={performance} channels={channels} currentMonth={currentMonth} />
        )}

        {!loading && !error && viewMode === 'plan' && (
          <PlanView
            plan={weekdayPlan}
            channels={channels}
            onSetDay={setDayChannels}
            isMobile={isMobile}
          />
        )}

        {selectedItem && (
          <DetailModal
            item={selectedItem}
            performance={performance[selectedItem.id] || {}}
            onClose={() => { setSelectedItem(null); setMoreMenuOpen(false); }}
            onToggleCompleted={() => toggleCompleted(selectedItem.id)}
            onUpdatePerformance={(field, value) => updatePerformance(selectedItem.id, field, value)}
            onEdit={() => { setEditingItem({ ...selectedItem }); setSelectedItem(null); setMoreMenuOpen(false); }}
            onDuplicate={() => { duplicateItem(selectedItem.id); setSelectedItem(null); setMoreMenuOpen(false); }}
            onArchive={() => {
              setMoreMenuOpen(false);
              setArchiveSheet({ itemId: selectedItem.id, title: selectedItem.title });
              setSelectedItem(null);
            }}
            onDelete={() => { setMoreMenuOpen(false); setDeleteSheet(selectedItem.id); }}
            moreMenuOpen={moreMenuOpen}
            setMoreMenuOpen={setMoreMenuOpen}
          />
        )}

        {editingItem && (
          <EditModal item={editingItem} onSave={saveItem} onClose={() => setEditingItem(null)} />
        )}

        {channelMgrOpen && (
          <ChannelManagerModal
            channels={channels}
            onClose={() => setChannelMgrOpen(false)}
            onAdd={addChannel}
            onUpdate={updateChannel}
            onDelete={deleteChannel}
            onMove={moveChannel}
          />
        )}

        {deleteSheet && (
          <DeleteSheet
            itemTitle={items.find(i => i.id === deleteSheet)?.title}
            onCancel={() => setDeleteSheet(null)}
            onConfirm={async () => {
              await deleteItem(deleteSheet);
              setDeleteSheet(null);
              setSelectedItem(null);
            }}
          />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            actions={[
              { icon: '📋', label: '상세보기', onClick: () => { setSelectedItem(contextMenu.item); setContextMenu(null); } },
              { icon: '✏️', label: '수정', onClick: () => { setEditingItem({ ...contextMenu.item }); setContextMenu(null); } },
              { icon: '🔁', label: '복제', onClick: () => { duplicateItem(contextMenu.item.id); setContextMenu(null); } },
              { icon: contextMenu.item.completed ? '↻' : '✓', label: contextMenu.item.completed ? '완료 취소' : '발행 완료', onClick: () => { toggleCompleted(contextMenu.item.id); setContextMenu(null); } },
              { divider: true },
              { icon: '📦', label: '보관함으로', onClick: () => { setArchiveSheet({ itemId: contextMenu.item.id, title: contextMenu.item.title }); setContextMenu(null); } },
              { icon: '🗑️', label: '영구 삭제', danger: true, onClick: () => { setDeleteSheet(contextMenu.item.id); setContextMenu(null); } }
            ]}
          />
        )}

        {/* 다중 선택 하단 바 */}
        {selectMode && (
          <div className="bulk-bar">
            <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedIds.size}개 선택됨</span>
            <button onClick={selectAllVisible} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.4)', color: '#FFFFFF', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>전체 선택</button>
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>선택 비우기</button>
            )}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => {
                if (selectedIds.size === 0) { alert('선택된 콘텐츠가 없습니다.'); return; }
                setArchiveSheet({ multi: true, ids: Array.from(selectedIds), count: selectedIds.size });
              }}
              style={{ background: '#FFFFFF', color: '#1A1A1A', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >📦 보관함으로 ({selectedIds.size})</button>
            <button onClick={exitSelectMode} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>
        )}

        {archiveSheet && (
          <ArchiveSheet
            itemTitle={archiveSheet.multi ? `선택한 ${archiveSheet.count}개 콘텐츠` : archiveSheet.title}
            onCancel={() => setArchiveSheet(null)}
            onConfirm={async (reason) => {
              if (archiveSheet.multi) {
                await moveMultipleToArchive(archiveSheet.ids, reason);
                exitSelectMode();
              } else {
                await moveToArchive(archiveSheet.itemId, reason);
              }
              setArchiveSheet(null);
            }}
          />
        )}

        {archiveOpen && (
          <ArchiveModal
            items={archiveItems}
            loading={archiveLoading}
            onClose={() => setArchiveOpen(false)}
            onRestore={restoreFromArchive}
            onDelete={deleteFromArchive}
          />
        )}
      </div>
    </div>
  );
}

const navBtnStyle = {
  background: 'transparent', border: '0.5px solid rgba(0,0,0,0.18)', borderRadius: 8,
  width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#1A1A1A',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'inherit'
};

function DetailModal({ item, performance, onClose, onToggleCompleted, onUpdatePerformance, onEdit, onDuplicate, onArchive, onDelete, moreMenuOpen, setMoreMenuOpen }) {
  const channelColor = COLORS[item.channel]?.bg || '#888780';
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 12px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#1A1A1A', padding: 4, lineHeight: 1 }}>×</button>
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setMoreMenuOpen(!moreMenuOpen); }} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#1A1A1A', padding: '4px 8px', lineHeight: 1, letterSpacing: 2 }}>⋯</button>
            {moreMenuOpen && (
              <>
                <div onClick={() => setMoreMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1099 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#FFFFFF', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', padding: 4, minWidth: 160, zIndex: 1100 }}>
                  <button onClick={onEdit} style={moreMenuItemStyle}>✏️ 수정</button>
                  <button onClick={onDuplicate} style={moreMenuItemStyle}>🔁 복제</button>
                  <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
                  <button onClick={onArchive} style={moreMenuItemStyle}>📦 보관함으로</button>
                  <button onClick={onDelete} style={{ ...moreMenuItemStyle, color: '#D4537E' }}>🗑️ 영구 삭제</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ padding: '20px 22px 16px' }}>
          <h3 style={{ fontSize: 19, fontWeight: 600, margin: '0 0 10px', wordBreak: 'keep-all', lineHeight: 1.4 }}>
            {item.isCore && <span style={{ color: '#D4A92E', marginRight: 6 }}>★</span>}{item.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#5F5E5A' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: channelColor, flexShrink: 0 }} />
            <span>{item.channelName}</span>
          </div>
          <div style={{ fontSize: 13, color: '#5F5E5A', marginTop: 4 }}>{item.date.replace(/-/g, '.')} {item.time}</div>
        </div>

        <div style={{ padding: '0 22px 4px', borderTop: '0.5px solid rgba(0,0,0,0.06)', paddingTop: 12 }}>
          {item.referenceUrl && item.referenceUrl.trim() && (
            <InfoRow label="레퍼런스" value={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {item.referenceUrl.split(/\r?\n/).map(u => u.trim()).filter(Boolean).map((u, i) => {
                  const href = /^https?:\/\//i.test(u) ? u : `https://${u}`;
                  return <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#3A6B9E', wordBreak: 'break-all', textDecoration: 'underline' }}>{u}</a>;
                })}
              </div>
            } />
          )}
          {item.mainKeyword && <InfoRow label="메인 키워드" value={<div><div>{item.mainKeyword}</div>{item.strength && <div style={{ color: '#888780', fontSize: 12, marginTop: 2 }}>{item.strength}</div>}</div>} />}
          {item.asset && <InfoRow label="자산" value={item.asset} />}
          {item.nextSkill && <InfoRow label="작성 스킬" value={<code style={{ background: '#F8F8F6', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: '#5F5E5A', fontFamily: 'ui-monospace, monospace', overflowWrap: 'anywhere' }}>{item.nextSkill}</code>} />}
          {Array.isArray(item.attachments) && item.attachments.length > 0 && (
            <InfoRow label="첨부" value={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {item.attachments.map((a, i) => {
                  const isImg = /^image\//.test(a.type || '') || /\.(png|jpe?g|gif|webp|svg|heic)$/i.test(a.name || '');
                  return (
                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#1A1A1A' }}>
                      {isImg
                        ? <img src={a.url} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        : <span style={{ width: 30, height: 30, borderRadius: 6, background: '#EEEBE3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15 }}>📄</span>}
                      <span style={{ fontSize: 13, color: '#3A6B9E', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    </a>
                  );
                })}
              </div>
            } />
          )}
          {item.description && <InfoRow label="메모" value={<MemoView text={item.description} />} />}
        </div>

        <div style={{ padding: '12px 22px 16px', borderTop: '0.5px solid rgba(0,0,0,0.06)', marginTop: 12 }}>
          <div style={{ fontSize: 12, color: '#888780', fontWeight: 500, marginBottom: 10 }}>발행 후 기록</div>
          <input type="url" placeholder="발행 URL" value={performance.url || ''} onChange={(e) => onUpdatePerformance('url', e.target.value)} style={recordInputStyle} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="number" placeholder="좋아요" value={performance.likes || ''} onChange={(e) => onUpdatePerformance('likes', e.target.value)} style={{ ...recordInputStyle, flex: 1 }} />
            <input type="number" placeholder="저장" value={performance.saves || ''} onChange={(e) => onUpdatePerformance('saves', e.target.value)} style={{ ...recordInputStyle, flex: 1 }} />
          </div>
          <textarea placeholder="메모" value={performance.note || ''} onChange={(e) => onUpdatePerformance('note', e.target.value)} rows={2} style={{ ...recordInputStyle, marginTop: 8, resize: 'vertical', minHeight: 50 }} />
        </div>

        <div style={{ padding: '12px 16px 16px', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
          {(() => {
            const hasRef = !!(item.referenceUrl && item.referenceUrl.trim());
            const needRef = !item.completed && !hasRef;
            return (
              <>
                <button onClick={onToggleCompleted} style={{ width: '100%', background: item.completed ? '#FFFFFF' : (needRef ? '#F0EEE8' : '#1A1A1A'), color: item.completed ? '#5F5E5A' : (needRef ? '#8A7B52' : '#FFFFFF'), border: (item.completed || needRef) ? '0.5px solid rgba(0,0,0,0.18)' : 'none', borderRadius: 10, padding: '14px', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', fontWeight: 600 }}>
                  {item.completed ? '발행 취소' : (needRef ? '⚠️ 레퍼런스 추가 후 발행' : '발행 완료')}
                </button>
                {needRef && (
                  <div style={{ fontSize: 11.5, color: '#A8946A', marginTop: 8, textAlign: 'center' }}>
                    발행하려면 레퍼런스 URL이 필요해요
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

const moreMenuItemStyle = {
  display: 'block', width: '100%', textAlign: 'left',
  background: 'transparent', border: 'none', padding: '10px 14px',
  cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', color: '#1A1A1A', borderRadius: 6
};

const recordInputStyle = {
  width: '100%', padding: '8px 10px', border: '0.5px solid rgba(0,0,0,0.18)',
  borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#FFFFFF', boxSizing: 'border-box'
};

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '8px 0', alignItems: 'flex-start', fontSize: 14 }}>
      <div style={{ width: 72, flexShrink: 0, color: '#888780', fontSize: 12, paddingTop: 2 }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, color: '#1A1A1A', lineHeight: 1.5, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

// ============================================================
// 채널 관리 모달 (추가 / 이름변경 / 색상변경 / 순서 / 삭제)
// ============================================================
const chFieldStyle = {
  width: '100%', padding: '9px 11px', border: '0.5px solid rgba(0,0,0,0.18)',
  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#FFFFFF',
  boxSizing: 'border-box', outline: 'none', color: '#1A1A1A'
};
const chMiniLabel = { fontSize: 11, color: '#888780', marginBottom: 4, display: 'block' };
const chSelectStyle = {
  ...chFieldStyle, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', paddingRight: 30,
  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4 L6 8 L10 4' stroke='%235F5E5A' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center'
};

// 색상 선택기: 프리셋 + 직접 선택(배경/글자) + 배경 자동
function ColorEditor({ color, onChange }) {
  const pickWrap = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5F5E5A', cursor: 'pointer', position: 'relative' };
  const nativeInput = { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 };
  const swatch = (bg) => ({ width: 22, height: 22, borderRadius: 6, background: bg, border: '1px solid rgba(0,0,0,0.15)', display: 'inline-block' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CHANNEL_COLOR_PRESETS.map((p, i) => (
          <button key={i} type="button" onClick={() => onChange(p)}
            style={{ width: 26, height: 26, borderRadius: 7, background: p.bg,
              border: color.bg === p.bg && color.fg === p.fg ? '2px solid #1A1A1A' : `2px solid ${p.fg}`, cursor: 'pointer' }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <label style={pickWrap}>
          <span style={swatch(color.bg)} /> 배경
          <input type="color" value={color.bg} onChange={(e) => onChange({ ...color, bg: e.target.value })} style={nativeInput} />
        </label>
        <label style={pickWrap}>
          <span style={swatch(color.fg)} /> 글자
          <input type="color" value={color.fg} onChange={(e) => onChange({ ...color, fg: e.target.value })} style={nativeInput} />
        </label>
        <button type="button" onClick={() => onChange({ ...color, bg: tintBg(color.fg) })}
          style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 7, padding: '5px 10px', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer' }}
          title="글자색에 맞춰 배경을 연하게 자동 생성">배경 자동</button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 9px', borderRadius: 6, background: color.bg, color: color.fg, fontWeight: 500 }}>미리보기</span>
      </div>
    </div>
  );
}

function ChannelRow({ ch, index, total, onUpdate, onDelete, onMove }) {
  const [label, setLabel] = useState(ch.label);
  const [shortLabel, setShortLabel] = useState(ch.shortLabel || '');
  const [skill, setSkill] = useState(ch.skill || '');
  const [color, setColor] = useState({ bg: ch.bg, fg: ch.fg });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLabel(ch.label); setShortLabel(ch.shortLabel || ''); setSkill(ch.skill || '');
    setColor({ bg: ch.bg, fg: ch.fg });
  }, [ch.value, ch.label, ch.shortLabel, ch.skill, ch.bg, ch.fg]);

  const dirty = label !== ch.label || shortLabel !== (ch.shortLabel || '') ||
    skill !== (ch.skill || '') || color.bg !== ch.bg || color.fg !== ch.fg;

  const arrowBtn = (disabled) => ({
    background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer',
    color: disabled ? '#CFCDC5' : '#888780', fontSize: 11, lineHeight: 1, padding: 0, height: 13
  });

  const typeValue = CHANNEL_TYPES.includes(shortLabel) ? shortLabel : (shortLabel ? '기타' : '');

  return (
    <div style={{ background: '#FAF9F5', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
          <button type="button" disabled={index === 0} onClick={() => onMove(ch.value, -1)} style={arrowBtn(index === 0)} title="위로">▲</button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(ch.value, 1)} style={arrowBtn(index === total - 1)} title="아래로">▼</button>
        </div>
        <button type="button" onClick={() => setOpen(o => !o)} title="색상 변경"
          style={{ width: 24, height: 24, borderRadius: 7, background: color.bg, border: `2px solid ${color.fg}`, cursor: 'pointer', flexShrink: 0 }} />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="채널 이름" style={{ ...chFieldStyle, fontWeight: 500 }} />
        <button type="button" onClick={() => onDelete(ch.value)} title="삭제"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, color: '#C0392B', padding: '4px 4px', flexShrink: 0 }}>🗑️</button>
      </div>

      {/* 유형 — 항상 보임 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 30 }}>
        <span style={{ fontSize: 12, color: '#888780', flexShrink: 0 }}>유형</span>
        <select value={typeValue} onChange={(e) => setShortLabel(e.target.value)} style={{ ...chSelectStyle, maxWidth: 200 }}>
          {!typeValue && <option value="">선택</option>}
          {CHANNEL_TYPES.map(t => <option key={t} value={t}>{typeEmoji(t)} {t}</option>)}
        </select>
        <button type="button" onClick={() => setOpen(o => !o)}
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888780', fontFamily: 'inherit', flexShrink: 0 }}>
          {open ? '접기 ▲' : '색상·스킬 ▼'}
        </button>
      </div>

      {open && (
        <>
          <ColorEditor color={color} onChange={setColor} />
          <div>
            <label style={chMiniLabel}>작성 스킬 (선택)</label>
            <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="예: momentin-insta-writer" style={chFieldStyle} />
          </div>
        </>
      )}

      {dirty && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: open ? 0 : 10 }}>
          <button type="button"
            onClick={() => { setLabel(ch.label); setShortLabel(ch.shortLabel || ''); setSkill(ch.skill || ''); setColor({ bg: ch.bg, fg: ch.fg }); }}
            style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer' }}>되돌리기</button>
          <button type="button"
            onClick={() => onUpdate(ch.value, { label: label.trim() || ch.label, shortLabel: shortLabel.trim(), skill: skill.trim(), bg: color.bg, fg: color.fg })}
            style={{ background: '#1A1A1A', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500 }}>저장</button>
        </div>
      )}
    </div>
  );
}

function ChannelManagerModal({ channels, onClose, onAdd, onUpdate, onDelete, onMove }) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newShort, setNewShort] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [newColor, setNewColor] = useState(CHANNEL_COLOR_PRESETS[0]);

  const resetAdd = () => { setAdding(false); setNewLabel(''); setNewShort(''); setNewSkill(''); setNewColor(CHANNEL_COLOR_PRESETS[0]); };
  const submitAdd = () => {
    if (!newLabel.trim()) { alert('채널 이름을 입력해주세요'); return; }
    onAdd({ label: newLabel.trim(), shortLabel: newShort.trim(), skill: newSkill.trim(), bg: newColor.bg, fg: newColor.fg });
    resetAdd();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden', maxWidth: 520, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>채널 관리</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#1A1A1A', padding: 4, lineHeight: 1 }} aria-label="닫기">×</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {channels.map((ch, i) => (
            <ChannelRow key={ch.value} ch={ch} index={i} total={channels.length} onUpdate={onUpdate} onDelete={onDelete} onMove={onMove} />
          ))}

          {adding ? (
            <div style={{ background: '#FAF5E8', border: '0.5px solid #E5DCC4', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input autoFocus value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="채널 이름 (예: 유튜브 쇼츠)" style={{ ...chFieldStyle, fontWeight: 500 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={newShort} onChange={(e) => setNewShort(e.target.value)} style={chSelectStyle}>
                  <option value="">유형 선택</option>
                  {CHANNEL_TYPES.map(t => <option key={t} value={t}>{typeEmoji(t)} {t}</option>)}
                </select>
                <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="작성 스킬 (선택)" style={chFieldStyle} />
              </div>
              <ColorEditor color={newColor} onChange={setNewColor} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
                <button type="button" onClick={resetAdd} style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer' }}>취소</button>
                <button type="button" onClick={submitAdd} style={{ background: '#1A1A1A', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500 }}>추가</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              style={{ background: 'transparent', border: '1px dashed rgba(0,0,0,0.25)', borderRadius: 12, padding: '13px', fontSize: 14, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer', fontWeight: 500 }}>+ 새 채널 추가</button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item);
  const [showMore, setShowMore] = useState(!!(item.mainKeyword || item.asset || item.isCore));
  const [uploading, setUploading] = useState(false);
  const isEdit = !!item.id;

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // 첨부파일 업로드 / 제거
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const added = [];
      for (const file of files) {
        const safe = (file.name || 'file').replace(/[^\w.\-]+/g, '_');
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
        const { error } = await supabase.storage.from('attachments').upload(path, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from('attachments').getPublicUrl(path);
        added.push({ name: file.name, url: data.publicUrl, path, size: file.size, type: file.type || '' });
      }
      setForm(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...added] }));
    } catch (e) {
      alert('첨부 실패: ' + (e.message || e));
    } finally {
      setUploading(false);
    }
  };
  const removeAttachment = async (idx) => {
    const att = (form.attachments || [])[idx];
    setForm(prev => ({ ...prev, attachments: (prev.attachments || []).filter((_, i) => i !== idx) }));
    if (att && att.path) { try { await supabase.storage.from('attachments').remove([att.path]); } catch (e) { /* 무시 */ } }
  };
  const handleChannelChange = (newChannel) => {
    const opt = CHANNEL_OPTIONS.find(o => o.value === newChannel);
    setForm(prev => ({
      ...prev,
      channel: newChannel,
      channelName: opt ? opt.label : prev.channelName,
      nextSkill: opt ? opt.skill : prev.nextSkill
    }));
  };
  const handleSave = () => {
    if (!form.title || !form.title.trim()) { alert('제목을 입력해주세요'); return; }
    onSave({ ...form, referenceUrl: (form.referenceUrl || '').trim() });
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 14px',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    background: '#F4F2EC',
    color: '#1A1A1A',
    outline: 'none'
  };
  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    paddingRight: 36,
    backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4 L6 8 L10 4' stroke='%235F5E5A' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center'
  };
  const labelStyle = { fontSize: 13, color: '#5F5E5A', marginBottom: 6, display: 'block', fontWeight: 500 };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{isEdit ? '콘텐츠 수정' : '새 콘텐츠'}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#1A1A1A', padding: 4, lineHeight: 1 }} aria-label="닫기">×</button>
        </div>

        {/* 본문 (스크롤) */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* 제목 — 큰 입력 (가장 중요한 필드) */}
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="제목을 입력하세요"
            autoFocus
            style={{
              width: '100%',
              padding: '12px 0',
              border: 'none',
              borderBottom: '0.5px solid rgba(0,0,0,0.18)',
              fontSize: 20,
              fontWeight: 500,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              background: 'transparent',
              outline: 'none',
              color: '#1A1A1A',
              marginBottom: 20
            }}
          />

          {/* 발행일 + 시간 */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>발행일</label>
              <input type="date" value={form.date} onChange={(e) => handleChange('date', e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>시간</label>
              <input type="time" value={form.time} onChange={(e) => handleChange('time', e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* 채널 */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>채널</label>
            <select value={form.channel} onChange={(e) => handleChannelChange(e.target.value)} style={selectStyle}>
              {!CHANNEL_OPTIONS.some(opt => opt.value === form.channel) && (
                <option value={form.channel}>{form.channelName || form.channel} (삭제된 채널)</option>
              )}
              {CHANNEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          {/* 레퍼런스 URL — 저장은 선택, 발행 전 필요 */}
          {(() => {
            const hasRef = !!(form.referenceUrl && form.referenceUrl.trim());
            return (
              <div style={{ marginBottom: 8 }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  레퍼런스 URL
                  <span style={{ fontSize: 11, fontWeight: 500, color: hasRef ? '#3A7D3A' : '#B07D2B', background: hasRef ? '#E7F1E8' : '#FBF1DD', borderRadius: 5, padding: '2px 7px' }}>
                    {hasRef ? '🔗 입력됨' : '발행 전 필요'}
                  </span>
                </label>
                <textarea
                  value={form.referenceUrl || ''}
                  onChange={(e) => handleChange('referenceUrl', e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }}
                  placeholder={'참고할 링크 (지금 비워둬도 저장돼요)\n여러 개면 한 줄에 하나씩'}
                />
                <div style={{ fontSize: 11.5, color: '#A8946A', marginTop: 6 }}>
                  {hasRef ? '여러 개면 한 줄에 하나씩 적어주세요.' : <>주제만 먼저 저장해도 돼요. <b>발행 완료</b>하려면 레퍼런스가 필요해요.</>}
                </div>
              </div>
            );
          })()}

          {/* 첨부파일 */}
          <div style={{ marginBottom: 8, marginTop: 4 }}>
            <label style={labelStyle}>첨부파일</label>
            {(form.attachments && form.attachments.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {form.attachments.map((a, i) => {
                  const isImg = /^image\//.test(a.type || '') || /\.(png|jpe?g|gif|webp|svg|heic)$/i.test(a.name || '');
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F4F2EC', borderRadius: 8, padding: '8px 10px' }}>
                      {isImg
                        ? <img src={a.url} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        : <span style={{ width: 34, height: 34, borderRadius: 6, background: '#E5E1D6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>📄</span>}
                      <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</a>
                      <button type="button" onClick={() => removeAttachment(i)} title="삭제" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#C0392B', fontSize: 18, flexShrink: 0, padding: '2px 4px', lineHeight: 1 }}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#FFFFFF', border: '1px dashed rgba(0,0,0,0.25)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#5F5E5A', cursor: uploading ? 'default' : 'pointer', fontWeight: 500 }}>
              {uploading ? '업로드 중…' : '＋ 파일 첨부 (이미지·PDF 등)'}
              <input type="file" multiple disabled={uploading} onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
            </label>
          </div>

          {/* 더보기 토글 */}
          <button
            type="button"
            onClick={() => setShowMore(s => !s)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: '14px 0',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#5F5E5A',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '0.5px solid rgba(0,0,0,0.06)',
              marginTop: 8
            }}
          >
            <span>키워드·자산·핵심 콘텐츠</span>
            <span style={{ fontSize: 11, color: '#888780' }}>{showMore ? '▲' : '▼'}</span>
          </button>

          {showMore && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>메인 키워드</label>
                <input type="text" value={form.mainKeyword || ''} onChange={(e) => handleChange('mainKeyword', e.target.value)} style={inputStyle} placeholder="예: 어버이날 카네이션" />
              </div>
              <div>
                <label style={labelStyle}>강도</label>
                <select value={form.strength || ''} onChange={(e) => handleChange('strength', e.target.value)} style={selectStyle}>
                  {STRENGTH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt || '선택 안 함'}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>자산</label>
                <input type="text" value={form.asset || ''} onChange={(e) => handleChange('asset', e.target.value)} style={inputStyle} placeholder="예: 5/3 펜던트 시공 영상" />
              </div>
              <div>
                <label style={labelStyle}>메모</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  onPaste={(e) => {
                    const md = clipboardToMarkdownTable(e.clipboardData);
                    if (!md) return; // 표가 아니면 기본 붙여넣기
                    e.preventDefault();
                    const ta = e.target;
                    const start = ta.selectionStart ?? (form.description || '').length;
                    const end = ta.selectionEnd ?? start;
                    const cur = form.description || '';
                    const before = cur.slice(0, start);
                    const after = cur.slice(end);
                    // 표 앞뒤로 빈 줄 보장 (다른 글과 안 붙게)
                    const pre = before && !before.endsWith('\n') ? before + '\n' : before;
                    const post = after && !after.startsWith('\n') ? '\n' + after : after;
                    const next = pre + md + post;
                    handleChange('description', next);
                    const caret = (pre + md).length;
                    requestAnimationFrame(() => { try { ta.selectionStart = ta.selectionEnd = caret; } catch (err) { /* 무시 */ } });
                  }}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 70, lineHeight: 1.5 }}
                  placeholder="추가 설명·아이디어·캡션 초안 등 (표를 붙여넣으면 표로 정리돼요)"
                />
              </div>

              {/* 토스 스타일 토글 스위치 */}
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '4px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, color: '#1A1A1A' }}>★ 핵심 콘텐츠</span>
                  <span style={{ fontSize: 12, color: '#888780' }}>시리즈 메인으로 강조 표시</span>
                </div>
                <div style={{
                  position: 'relative',
                  width: 44,
                  height: 26,
                  background: form.isCore ? '#1A1A1A' : '#D4D2CC',
                  borderRadius: 13,
                  transition: 'background 0.2s',
                  flexShrink: 0
                }}>
                  <input
                    type="checkbox"
                    checked={!!form.isCore}
                    onChange={(e) => handleChange('isCore', e.target.checked)}
                    style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: 3,
                    left: form.isCore ? 21 : 3,
                    width: 20,
                    height: 20,
                    background: '#FFFFFF',
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                  }} />
                </div>
              </label>
            </div>
          )}
        </div>

        {/* 메인 액션 — 토스 스타일 풀폭 버튼 */}
        <div style={{ padding: '12px 16px 16px', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
          <button
            onClick={handleSave}
            style={{
              width: '100%',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 12,
              padding: '15px',
              cursor: 'pointer',
              fontSize: 15,
              fontFamily: 'inherit',
              fontWeight: 600
            }}
          >{isEdit ? '저장' : '추가'}</button>
        </div>
      </div>
    </div>
  );
}


function DeleteSheet({ itemTitle, onCancel, onConfirm }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000, animation: 'sheetFadeIn 0.2s ease-out' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, width: '100%', maxWidth: 480, padding: '24px 20px 28px', boxSizing: 'border-box', animation: 'sheetSlideUp 0.25s ease-out' }}>
        <div style={{ width: 40, height: 4, background: 'rgba(0,0,0,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>이 콘텐츠를 삭제할까요?</h3>
        <p style={{ fontSize: 14, color: '#5F5E5A', margin: '0 0 20px', lineHeight: 1.5, wordBreak: 'keep-all' }}>
          {itemTitle && <span style={{ color: '#1A1A1A', fontWeight: 500 }}>{itemTitle}</span>}
          {itemTitle && <br />}
          삭제하면 되돌릴 수 없어요.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, background: '#F8F8F6', color: '#1A1A1A', border: 'none', borderRadius: 10, padding: '14px', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', fontWeight: 500 }}>취소</button>
          <button onClick={onConfirm} style={{ flex: 1, background: '#D4537E', color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '14px', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', fontWeight: 600 }}>삭제</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 리스트뷰
// ============================================================
function ListView({ items, currentMonth, holidays, anniversaries, onItemClick, onItemContextMenu, onAddClick, selectMode, selectedIds, toggleSelect }) {
  const dayLabelsLocal = ['일', '월', '화', '수', '목', '금', '토'];
  const [yearStr, monthStr] = currentMonth.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const lastDay = new Date(yearNum, monthNum, 0).getDate();

  // 오늘 날짜 (당월일 때만 자동 펼침)
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

  const datesWithItems = new Set(items.map(it => it.date));
  const dates = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    if (datesWithItems.has(dateStr) || holidays[dateStr] || anniversaries[dateStr]) {
      dates.push(dateStr);
    }
  }

  // 펼침 상태 — 오늘만 기본 펼침
  const [expandedDates, setExpandedDates] = useState(() => {
    const initial = new Set();
    if (dates.includes(todayStr)) initial.add(todayStr);
    return initial;
  });

  const toggleDate = (dateStr) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const expandAll = () => setExpandedDates(new Set(dates));
  const collapseAll = () => setExpandedDates(new Set());

  if (dates.length === 0) {
    return (
      <div className="list-view">
        <div className="list-empty">
          이번 달에 등록된 콘텐츠가 없어요.<br />
          <span style={{ fontSize: 12, color: '#888780' }}>+ 새 콘텐츠 버튼으로 추가하세요.</span>
        </div>
      </div>
    );
  }

  const totalItems = items.length;
  const completedItems = items.filter(it => it.completed).length;
  const allExpanded = dates.every(d => expandedDates.has(d));

  return (
    <div className="list-view">
      {/* 요약 + 전체 펼침/접힘 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', marginBottom: 4 }}>
        <div style={{ fontSize: 13, color: '#5F5E5A' }}>
          이번 달 <strong style={{ color: '#1A1A1A' }}>{totalItems}편</strong>
          <span style={{ color: '#888780' }}> · 발행 {completedItems}편 ({totalItems > 0 ? Math.round(completedItems / totalItems * 100) : 0}%)</span>
        </div>
        <button
          onClick={allExpanded ? collapseAll : expandAll}
          style={{ background: 'transparent', border: 'none', color: '#5F5E5A', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px' }}
        >{allExpanded ? '모두 접기' : '모두 펼치기'}</button>
      </div>

      {dates.map(dateStr => {
        const [, , dayStr] = dateStr.split('-');
        const day = parseInt(dayStr, 10);
        const dt = new Date(yearNum, monthNum - 1, day);
        const dow = dt.getDay();
        const dowLabel = dayLabelsLocal[dow];
        const dowClass = dow === 0 ? 'sun' : dow === 6 ? 'sat' : '';
        const dayItems = items.filter(it => it.date === dateStr);
        const holiday = holidays[dateStr];
        const anniversary = anniversaries[dateStr];
        const isExpanded = expandedDates.has(dateStr);
        const dayCompletedCount = dayItems.filter(it => it.completed).length;
        const isToday = dateStr === todayStr;

        return (
          <div key={dateStr} className={`list-day ${isExpanded ? 'expanded' : ''} ${isToday ? 'today' : ''}`}>
            <button
              className="list-day-header-btn"
              onClick={() => toggleDate(dateStr)}
              type="button"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span className={`list-arrow ${isExpanded ? 'expanded' : ''}`}>›</span>
                <div className="list-day-date">
                  {isToday && <span className="today-badge" style={{ marginRight: 6 }}>오늘</span>}
                  {monthNum}월 {day}일
                  <span className={`dow ${dowClass}`}>({dowLabel})</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {(holiday || anniversary) && (
                  <span className={`list-day-event ${holiday ? 'holiday' : ''}`}>
                    {holiday || anniversary}
                  </span>
                )}
                {dayItems.length > 0 && (
                  <span className="list-day-count">
                    {dayItems.length}편
                    {dayCompletedCount > 0 && <span style={{ color: '#3A7D3A', marginLeft: 4 }}>· {dayCompletedCount}</span>}
                  </span>
                )}
                {onAddClick && !selectMode && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onAddClick(dateStr); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onAddClick(dateStr); } }}
                    className="list-day-add-btn"
                    aria-label="이 날짜에 콘텐츠 추가"
                  >+</span>
                )}
              </div>
            </button>
            {isExpanded && dayItems.length > 0 && (
              <div className="list-items">
                {dayItems.map(it => {
                  const c = COLORS[it.channel] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                  const isSelected = selectMode && selectedIds && selectedIds.has(it.id);
                  return (
                    <button
                      key={it.id}
                      className={`list-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (selectMode) { toggleSelect(it.id); return; }
                        onItemClick(it);
                      }}
                      onContextMenu={(e) => { if (selectMode) return; onItemContextMenu && onItemContextMenu(e, it); }}
                    >
                      {selectMode && (
                        <span className="list-select-check">{isSelected ? '☑' : '☐'}</span>
                      )}
                      <div className="list-item-dot" style={{ background: c.bg }} />
                      <div className="list-item-content">
                        <div className={`list-item-title ${it.completed ? 'completed' : ''}`}>
                          <RefMark it={it} />{it.isCore && <span style={{ color: '#D4A92E', marginRight: 4 }}>★</span>}
                          {it.title}
                        </div>
                        <div className="list-item-meta">
                          <span>{it.channelName}</span>
                          {it.time && <span>· {it.time}</span>}
                          {it.completed && <span style={{ color: '#3A7D3A' }}>· 발행 완료</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekView({ weekStart, setWeekStart, items, plan, showPlanOverlay, dateChannelMap, holidays, anniversaries, onItemClick, onItemContextMenu, draggingId, dragOverDate, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop, isMobile, selectMode, selectedIds, toggleSelect }) {
  const dayLabelsLocal = ['일', '월', '화', '수', '목', '금', '토'];

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    weekDates.push({ date: d, dateStr, dow: d.getDay(), day: d.getDate() });
  }

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };
  const thisWeek = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); setWeekStart(d); };

  const startStr = `${weekDates[0].date.getMonth() + 1}.${weekDates[0].day}`;
  const endStr = `${weekDates[6].date.getMonth() + 1}.${weekDates[6].day}`;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handleItemClick = (e, it, isDragging) => {
    e.stopPropagation();
    if (selectMode) { toggleSelect(it.id); return; }
    if (!isDragging) onItemClick(it);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: '#5F5E5A' }}>
        <button onClick={prevWeek} style={{ ...weekNavBtn, fontSize: 14 }}>‹</button>
        <span style={{ minWidth: 80, textAlign: 'center', fontWeight: 500 }}>{startStr} ~ {endStr}</span>
        <button onClick={nextWeek} style={{ ...weekNavBtn, fontSize: 14 }}>›</button>
        <button onClick={thisWeek} style={{ ...weekNavBtn, width: 'auto', padding: '4px 10px', fontSize: 12 }}>이번 주</button>
      </div>

      {isMobile ? (
        /* 모바일: 세로 리스트 */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {weekDates.map(wd => {
            const dayItems = items.filter(it => it.date === wd.dateStr);
            const holiday = holidays[wd.dateStr];
            const anniversary = anniversaries[wd.dateStr];
            const isToday = wd.dateStr === todayStr;
            const dowColor = wd.dow === 0 ? '#D4537E' : wd.dow === 6 ? '#5C7AA8' : '#1A1A1A';
            return (
              <div key={wd.dateStr} style={{ background: '#FFFFFF', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: dayItems.length > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: isToday ? '#1A1A1A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: isToday ? '#FFF' : dowColor }}>{wd.day}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#888780' }}>{dayLabelsLocal[wd.dow]}{holiday ? ` · ${holiday}` : ''}{anniversary ? ` · ${anniversary}` : ''}</span>
                  {dayItems.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888780' }}>{dayItems.length}개</span>}
                </div>
                {showPlanOverlay && (
                  <PlanTargets dow={wd.dow} plan={plan} present={dateChannelMap && dateChannelMap[wd.dateStr]} variant="chips" style={{ padding: '6px 14px 0' }} />
                )}
                {dayItems.length > 0 && (
                  <div style={{ padding: '6px 0' }}>
                    {dayItems.map(it => {
                      const c = COLORS[it.channel] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                      const isSelected = selectMode && selectedIds && selectedIds.has(it.id);
                      return (
                        <button key={it.id}
                          onClick={(e) => handleItemClick(e, it, false)}
                          onContextMenu={(e) => { if (selectMode) return; onItemContextMenu && onItemContextMenu(e, it); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', background: isSelected ? '#F0EDE0' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                          {selectMode && <span style={{ fontSize: 15 }}>{isSelected ? '☑' : '☐'}</span>}
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: c.fg, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: it.completed ? '#aaa' : '#1A1A1A', textDecoration: it.completed ? 'line-through' : 'none', flex: 1 }}>
                            <RefMark it={it} />{it.isCore && '★ '}{it.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* 데스크탑: 7열 그리드 */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {weekDates.map(wd => {
            const dayItems = items.filter(it => it.date === wd.dateStr);
            const holiday = holidays[wd.dateStr];
            const anniversary = anniversaries[wd.dateStr];
            const dowColor = wd.dow === 0 ? '#D4537E' : wd.dow === 6 ? '#5C7AA8' : '#1A1A1A';
            const isDragOver = dragOverDate === wd.dateStr;
            const isToday = wd.dateStr === todayStr;
            return (
              <div key={wd.dateStr}
                className={`week-cell ${holiday ? 'holiday' : ''} ${isDragOver ? 'drag-over' : ''} ${isToday ? 'today' : ''}`}
                onDragOver={(e) => handleDragOver(e, wd.dateStr)}
                onDragLeave={(e) => handleDragLeave(e, wd.dateStr)}
                onDrop={(e) => handleDrop(e, wd.dateStr)}
              >
                <div className="week-cell-header">
                  <div className="week-cell-day" style={isToday ? {} : { color: dowColor }}>{wd.day}</div>
                  <div className="week-cell-dow">{dayLabelsLocal[wd.dow]}</div>
                  {isToday && <span className="today-badge">오늘</span>}
                  {holiday && <div style={{ fontSize: 11, color: '#D4537E', marginTop: 2, fontWeight: 500, width: '100%' }}>{holiday}</div>}
                  {anniversary && <div style={{ fontSize: 11, color: '#888780', marginTop: 2, width: '100%' }}>{anniversary}</div>}
                </div>
                {showPlanOverlay && (
                  <PlanTargets dow={wd.dow} plan={plan} present={dateChannelMap && dateChannelMap[wd.dateStr]} variant="chips" />
                )}
                <div className="week-cell-items">
                  {dayItems.map(it => {
                    const c = COLORS[it.channel] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                    const isDragging = draggingId === it.id;
                    const isSelected = selectMode && selectedIds && selectedIds.has(it.id);
                    return (
                      <button key={it.id}
                        className={`week-item ${it.completed ? 'completed' : ''}`}
                        style={{ background: c.bg, color: c.fg, opacity: isDragging ? 0.3 : 1, boxShadow: isSelected ? 'inset 0 0 0 2px #1A1A1A' : 'none' }}
                        draggable={!selectMode}
                        onDragStart={(e) => handleDragStart(e, it.id)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleItemClick(e, it, isDragging)}
                        onContextMenu={(e) => { if (selectMode) return; onItemContextMenu && onItemContextMenu(e, it); }}
                      >{selectMode && (isSelected ? '☑ ' : '☐ ')}<RefMark it={it} />{it.isCore && '★ '}{it.title}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

const weekNavBtn = {
  background: 'transparent',
  border: '0.5px solid rgba(0,0,0,0.18)',
  borderRadius: 6,
  width: 28,
  height: 28,
  cursor: 'pointer',
  color: '#1A1A1A',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  fontFamily: 'inherit'
};

// ============================================================
// 발행 목표 오버레이 (월간 = 점 / 주간 = 칩)
// present: 해당 날짜에 실제 등록된 채널들의 Set
// ============================================================
function PlanTargets({ dow, plan, present, variant, style }) {
  const planned = ((plan && plan[dow]) || []).filter(cv => CHANNEL_OPTIONS.some(o => o.value === cv));
  if (planned.length === 0) return null;
  const has = (cv) => present instanceof Set ? present.has(cv) : false;

  if (variant === 'dots') {
    const metCount = planned.filter(has).length;
    const title = '발행 목표 ' + planned.map(cv => {
      const opt = CHANNEL_OPTIONS.find(o => o.value === cv);
      return `${opt ? opt.label : cv}${has(cv) ? ' ✓' : ' (미등록)'}`;
    }).join(', ') + ` · ${metCount}/${planned.length} 등록됨`;
    return (
      <div className="plan-dots" title={title}>
        {planned.map(cv => {
          const col = COLORS[cv] || { fg: '#888780' };
          const met = has(cv);
          return <span key={cv} className={`plan-dot ${met ? 'met' : 'unmet'}`}
            style={{ background: col.bg || '#EFEDE6' }} />;
        })}
      </div>
    );
  }

  // chips (주간)
  return (
    <div className="plan-chips" style={style}>
      <span className="plan-chips-label">목표</span>
      {planned.map(cv => {
        const opt = CHANNEL_OPTIONS.find(o => o.value === cv);
        const col = COLORS[cv] || { bg: '#F0F0EB', fg: '#888780' };
        const met = has(cv);
        const label = opt ? opt.label : cv;
        return (
          <span key={cv} className={`plan-chip ${met ? 'met' : 'unmet'}`}
            title={met ? '등록됨' : '아직 등록 안 됨'}
            style={met ? { background: col.bg, color: col.fg } : { color: col.fg, borderColor: col.fg }}>
            {met ? '✓ ' : '○ '}{label}
          </span>
        );
      })}
    </div>
  );
}

// ============================================================
// 발행 계획 — 요일별 채널 목표 (드래그앤드롭 보드)
// ============================================================
function PlanView({ plan, channels, onSetDay, isMobile }) {
  const dayLabelsLocal = ['일', '월', '화', '수', '목', '금', '토'];
  const chList = (channels && channels.length ? channels : []);
  const chById = Object.fromEntries(chList.map(c => [c.value, c]));
  const [dragData, setDragData] = useState(null);   // { channel, fromDow }
  const [dragOverDow, setDragOverDow] = useState(null);
  const [addOpenDow, setAddOpenDow] = useState(null);

  // 존재하는 채널만 (삭제된 채널 자동 정리)
  const planFor = (dow) => ((plan && plan[dow]) || []).filter(cv => chById[cv]);

  const dropOn = (dow) => {
    setDragOverDow(null);
    if (!dragData) return;
    const { channel, fromDow } = dragData;
    setDragData(null);
    const target = planFor(dow);
    if (!target.includes(channel)) onSetDay(dow, [...target, channel]);
    if (fromDow != null && fromDow !== dow) {
      onSetDay(fromDow, planFor(fromDow).filter(c => c !== channel));
    }
  };
  const removeFromDay = (dow, channel) => onSetDay(dow, planFor(dow).filter(c => c !== channel));
  const addToDay = (dow, channel) => {
    const t = planFor(dow);
    if (!t.includes(channel)) onSetDay(dow, [...t, channel]);
    setAddOpenDow(null);
  };

  // 채널별 주간 요약 (주 N회 + 요일)
  const summary = chList.map(c => {
    const days = [];
    for (let d = 0; d < 7; d++) if (planFor(d).includes(c.value)) days.push(d);
    return { ch: c, days };
  }).filter(s => s.days.length > 0);

  const totalTargets = [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + planFor(d).length, 0);

  return (
    <div>
      <div className="plan-intro">
        <p className="plan-intro-title">🎯 요일별 발행 계획</p>
        <p className="plan-intro-sub">
          채널을 요일로 끌어다 놓으면 발행 목표가 정해지고, 월간·주간 캘린더에 표시돼요. <span style={{ color: '#B0AEA6' }}>이동: 끌기 · 삭제: ×</span>
          {totalTargets > 0 && <> · 주간 목표 <b>{totalTargets}건</b></>}
        </p>
      </div>

      {/* 채널 팔레트 */}
      <div className="plan-palette">
        <div className="plan-palette-label">채널 — 끌어서 요일에 추가</div>
        <div className="plan-palette-chips">
          {chList.length === 0 && <span style={{ fontSize: 12.5, color: '#B0AEA6' }}>먼저 🎨 채널에서 채널을 추가하세요.</span>}
          {chList.map(c => {
            const col = COLORS[c.value] || { bg: '#F0F0EB', fg: '#1A1A1A' };
            return (
              <div key={c.value}
                className={`plan-pal-chip ${dragData && dragData.channel === c.value && dragData.fromDow == null ? 'dragging' : ''}`}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/plain', c.value); setDragData({ channel: c.value, fromDow: null }); }}
                onDragEnd={() => { setDragData(null); setDragOverDow(null); }}
                style={{ background: col.bg, color: col.fg }}
                title={`${c.label} — 끌어서 요일에 놓기`}>
                <span className="plan-pal-dot" style={{ background: col.fg }} />
                {c.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* 7요일 보드 — 데스크탑은 7열 가로, 모바일은 세로 스택 */}
      <div className={isMobile ? '' : 'week-scroll'}>
        <div className={`plan-board ${isMobile ? 'stack' : ''}`}>
          {[0, 1, 2, 3, 4, 5, 6].map(dow => {
            const dayChannels = planFor(dow);
            const dowColor = dow === 0 ? '#D4537E' : dow === 6 ? '#5C7AA8' : '#1A1A1A';
            const available = chList.filter(c => !dayChannels.includes(c.value));
            return (
              <div key={dow}
                className={`plan-col ${dragOverDow === dow ? 'over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverDow !== dow) setDragOverDow(dow); }}
                onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget)) return; setDragOverDow(d => d === dow ? null : d); }}
                onDrop={(e) => { e.preventDefault(); dropOn(dow); }}>
                <div className="plan-col-head">
                  <span className="plan-col-dow" style={{ color: dowColor }}>{dayLabelsLocal[dow]}</span>
                  {dayChannels.length > 0 && <span className="plan-col-count">{dayChannels.length}</span>}
                </div>
                <div className="plan-col-body">
                  {dayChannels.length === 0 && addOpenDow !== dow && !isMobile && (
                    <div className="plan-col-empty">채널을<br />여기에 놓기</div>
                  )}
                  {dayChannels.map(cv => {
                    const col = COLORS[cv] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                    const c = chById[cv];
                    return (
                      <div key={cv}
                        className="plan-day-chip"
                        draggable
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/plain', cv); setDragData({ channel: cv, fromDow: dow }); }}
                        onDragEnd={() => { setDragData(null); setDragOverDow(null); }}
                        style={{ background: col.bg, color: col.fg, borderLeftColor: col.fg }}
                        title={c ? c.label : cv}>
                        {c ? c.label : cv}
                        <span className="x" onClick={(e) => { e.stopPropagation(); removeFromDay(dow, cv); }} title="삭제">×</span>
                      </div>
                    );
                  })}
                  {addOpenDow === dow ? (
                    <div className="plan-add-pop">
                      {available.length === 0 && <div style={{ fontSize: 11.5, color: '#B0AEA6', padding: '4px 7px' }}>추가할 채널이 없어요</div>}
                      {available.map(c => {
                        const col = COLORS[c.value] || { fg: '#1A1A1A' };
                        return (
                          <button key={c.value} onClick={() => addToDay(dow, c.value)}>
                            <span className="plan-pal-dot" style={{ background: col.fg }} />
                            {c.label}
                          </button>
                        );
                      })}
                      <button onClick={() => setAddOpenDow(null)} style={{ color: '#888780', justifyContent: 'center' }}>닫기</button>
                    </div>
                  ) : (
                    <button className="plan-add-btn" onClick={() => setAddOpenDow(dow)}>＋ 채널 추가</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 채널별 주간 요약 */}
      {summary.length > 0 && (
        <div className="plan-summary">
          <div className="plan-summary-title">채널별 주간 발행 빈도</div>
          {summary.map(({ ch, days }) => {
            const col = COLORS[ch.value] || { bg: '#F0F0EB', fg: '#1A1A1A' };
            return (
              <div key={ch.value} className="plan-summary-row">
                <span style={{ width: 11, height: 11, borderRadius: 3, background: col.fg, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, color: '#1A1A1A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.label}</span>
                <span style={{ fontSize: 12, color: '#888780', flexShrink: 0 }}>주 {days.length}회</span>
                <div className="plan-summary-days">
                  {[0, 1, 2, 3, 4, 5, 6].map(d => {
                    const on = days.includes(d);
                    return (
                      <span key={d} className="plan-summary-day"
                        style={{ background: on ? col.bg : '#F2F1EC', color: on ? col.fg : '#C4C2BA' }}>
                        {dayLabelsLocal[d]}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// KPI 대시보드
// ============================================================
function KPIView({ items, performance, channels, currentMonth }) {
  const [yearStr, monthStr] = currentMonth.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const lastDay = new Date(yearNum, monthNum, 0).getDate();

  // 이번 달 콘텐츠만 (월간 그리드는 6주라 이웃 달이 섞일 수 있음)
  const monthItems = items.filter(it => {
    const p = (it.date || '').split('-');
    return parseInt(p[0], 10) === yearNum && parseInt(p[1], 10) === monthNum;
  });

  const total = monthItems.length;
  const completed = monthItems.filter(it => it.completed).length;
  const rate = total > 0 ? Math.round(completed / total * 100) : 0;
  const coreItems = monthItems.filter(it => it.isCore);
  const coreDone = coreItems.filter(it => it.completed).length;
  const coreRate = coreItems.length > 0 ? Math.round(coreDone / coreItems.length * 100) : 0;

  // 채널별 발행률 — 채널 설정(추가·삭제·유형)에 연동
  const chList = (channels && channels.length ? channels : CHANNEL_OPTIONS);
  const byCh = {};
  chList.forEach(c => {
    byCh[c.value] = {
      value: c.value,
      name: c.label,
      type: c.shortLabel || '',
      color: COLORS[c.value] || { bg: '#F0F0EB', fg: '#5F5E5A' },
      total: 0, done: 0
    };
  });
  monthItems.forEach(it => {
    // 설정에 없는(삭제된) 채널이면 즉석으로 추가해 표시
    if (!byCh[it.channel]) byCh[it.channel] = {
      value: it.channel, name: it.channelName || '기타', type: '',
      color: COLORS[it.channel] || { bg: '#F0F0EB', fg: '#5F5E5A' }, total: 0, done: 0
    };
    byCh[it.channel].total += 1;
    if (it.completed) byCh[it.channel].done += 1;
  });
  // 콘텐츠 많은 순 → 없는 채널은 뒤로
  const channelStats = Object.values(byCh).sort((a, b) => b.total - a.total);

  // 유형별 집계
  const byType = {};
  channelStats.forEach(ch => {
    const t = ch.type || '기타';
    if (!byType[t]) byType[t] = { type: t, total: 0, done: 0 };
    byType[t].total += ch.total;
    byType[t].done += ch.done;
  });
  const typeStats = Object.values(byType).filter(t => t.total > 0).sort((a, b) => b.total - a.total);

  // 참여 지표 (좋아요·저장) — performance 테이블
  let totalLikes = 0, totalSaves = 0;
  const perfRows = [];
  monthItems.forEach(it => {
    const p = performance && performance[it.id];
    if (!p) return;
    const likes = parseInt(p.likes, 10) || 0;
    const saves = parseInt(p.saves, 10) || 0;
    if (likes || saves || p.url) {
      totalLikes += likes; totalSaves += saves;
      perfRows.push({ it, likes, saves });
    }
  });
  const hasEngagement = perfRows.length > 0;
  const topPosts = [...perfRows].sort((a, b) => (b.likes + b.saves) - (a.likes + a.saves)).slice(0, 3);

  // 주차별 발행 분포
  const weeksData = [
    { label: '1주', range: '1~7', total: 0, done: 0 },
    { label: '2주', range: '8~14', total: 0, done: 0 },
    { label: '3주', range: '15~21', total: 0, done: 0 },
    { label: '4주', range: '22~28', total: 0, done: 0 },
    { label: '5주', range: `29~${lastDay}`, total: 0, done: 0 }
  ];
  monthItems.forEach(it => {
    const day = parseInt(it.date.split('-')[2], 10);
    const wi = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : day <= 28 ? 3 : 4;
    weeksData[wi].total += 1;
    if (it.completed) weeksData[wi].done += 1;
  });

  if (total === 0) {
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '56px 24px', textAlign: 'center', color: '#888780' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
        <div style={{ fontSize: 15, color: '#5F5E5A', fontWeight: 500 }}>{monthNum}월에 등록된 콘텐츠가 없어요</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>＋ 새 콘텐츠로 일정을 추가해 보세요</div>
      </div>
    );
  }

  const rateColor = rate >= 70 ? '#3A7D3A' : rate >= 40 ? '#C79A2E' : '#D4537E';
  const R = 54, SW = 13, C = 2 * Math.PI * R;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 히어로: 발행률 도넛 + 요약 */}
      <div className="kpi-card-full" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0, margin: '0 auto' }}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#ECE9E0" strokeWidth={SW} />
            <circle cx="70" cy="70" r={R} fill="none" stroke={rateColor} strokeWidth={SW} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - rate / 100)}
              transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>{rate}%</span>
            <span style={{ fontSize: 12, color: '#888780', marginTop: 4 }}>발행률</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <HeroStat label="전체 콘텐츠" value={total} unit="편" />
          <HeroStat label="발행 완료" value={completed} unit="편" color="#3A7D3A" />
          <HeroStat label="미발행" value={total - completed} unit="편" color={(total - completed) > 0 ? '#D4537E' : '#888780'} />
          <HeroStat label="핵심 발행률" value={coreRate} unit="%" color="#C79A2E" sub={`${coreDone}/${coreItems.length}편`} />
        </div>
      </div>

      {/* 유형별 발행 (인스타/블로그 등) */}
      {typeStats.length > 1 && (
        <div className="kpi-card-full">
          <div className="kpi-card-title">유형별 발행</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {typeStats.map(t => {
              const tr = t.total > 0 ? Math.round(t.done / t.total * 100) : 0;
              return (
                <div key={t.type} style={{ flex: '1 1 100px', background: '#FAF9F5', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12.5, color: '#5F5E5A', marginBottom: 5 }}>{typeEmoji(t.type)} {t.type}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>{tr}<span style={{ fontSize: 12, fontWeight: 500 }}>%</span></div>
                  <div style={{ fontSize: 11, color: '#A8A69E', marginTop: 3 }}>{t.done}/{t.total}편 발행</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 채널별 발행률 */}
      <div className="kpi-card-full">
        <div className="kpi-card-title">채널별 발행률</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {channelStats.map((ch, i) => {
            const r = ch.total > 0 ? Math.round(ch.done / ch.total * 100) : 0;
            const muted = ch.total === 0;
            return (
              <div key={ch.value || i} style={{ opacity: muted ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: ch.color.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, color: '#1A1A1A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                    {ch.type && <span style={{ fontSize: 11, color: '#888780', background: '#EEEBE3', borderRadius: 5, padding: '2px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>{typeEmoji(ch.type)} {ch.type}</span>}
                  </div>
                  <span style={{ fontSize: 12.5, color: '#5F5E5A', flexShrink: 0 }}>
                    {ch.total > 0 ? <><b style={{ color: '#1A1A1A' }}>{r}%</b> · {ch.done}/{ch.total}편</> : '0편'}
                  </span>
                </div>
                <div style={{ height: 9, background: '#EFEDE6', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${r}%`, height: '100%', background: ch.color.bg, borderRadius: 5, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 참여 지표 */}
      {hasEngagement && (
        <div className="kpi-card-full">
          <div className="kpi-card-title">참여 지표</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: topPosts.length ? 18 : 0, flexWrap: 'wrap' }}>
            <EngChip emoji="❤️" label="총 좋아요" value={totalLikes} />
            <EngChip emoji="🔖" label="총 저장" value={totalSaves} />
            <EngChip emoji="📊" label="기록된 콘텐츠" value={perfRows.length} unit="편" />
          </div>
          {topPosts.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#888780', marginBottom: 8 }}>인기 콘텐츠 TOP {topPosts.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {topPosts.map((p, i) => {
                  const c = COLORS[p.it.channel] || { bg: '#F0F0EB', fg: '#5F5E5A' };
                  return (
                    <div key={p.it.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 18, fontSize: 13, fontWeight: 700, color: '#C79A2E', flexShrink: 0, textAlign: 'center' }}>{i + 1}</span>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: c.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.it.title}</span>
                      <span style={{ fontSize: 12, color: '#5F5E5A', flexShrink: 0, whiteSpace: 'nowrap' }}>❤️ {p.likes} · 🔖 {p.saves}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 주차별 발행 분포 */}
      <div className="kpi-card-full">
        <div className="kpi-card-title">주차별 발행 분포</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {weeksData.map(w => {
            const maxTotal = Math.max(...weeksData.map(x => x.total), 1);
            const barWidth = w.total > 0 ? Math.round((w.total / maxTotal) * 100) : 0;
            const doneWidth = w.total > 0 ? Math.round((w.done / w.total) * barWidth) : 0;
            return (
              <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, flexShrink: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A1A' }}>{w.label}</div>
                  <div style={{ fontSize: 10, color: '#A8A69E' }}>{w.range}</div>
                </div>
                <div style={{ flex: 1, position: 'relative', height: 26, background: '#F0EFE9', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${barWidth}%`, background: '#DCD6CA', borderRadius: 6, transition: 'width 0.5s' }} />
                  {doneWidth > 0 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${doneWidth}%`, background: rateColor, borderRadius: 6, transition: 'width 0.5s' }} />}
                </div>
                <div style={{ width: 40, textAlign: 'right', flexShrink: 0, fontSize: 13, color: '#1A1A1A' }}>
                  <b>{w.total}</b><span style={{ fontSize: 11, color: '#888780' }}>편</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
          <Legend color="#DCD6CA" label="계획" />
          <Legend color={rateColor} label="발행 완료" />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, unit, color, sub }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#888780', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || '#1A1A1A', lineHeight: 1.1 }}>
        {value}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 1 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: '#A8A69E', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function EngChip({ emoji, label, value, unit }) {
  return (
    <div style={{ flex: '1 1 90px', background: '#FAF9F5', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: '#888780', marginBottom: 4 }}>{emoji} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A' }}>{value.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 500, color: '#888780', marginLeft: 2 }}>{unit || ''}</span></div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 11, color: '#888780' }}>{label}</span>
    </div>
  );
}

// ============================================================
// 우클릭 컨텍스트 메뉴 (Context Menu)
// ============================================================
function ContextMenu({ x, y, actions, onClose }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let nx = x;
      let ny = y;
      if (x + rect.width > vw - 8) nx = vw - rect.width - 8;
      if (y + rect.height > vh - 8) ny = vh - rect.height - 8;
      if (nx < 8) nx = 8;
      if (ny < 8) ny = 8;
      setPosition({ x: nx, y: ny });
    }
    const onClick = () => onClose();
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    const onScroll = () => onClose();
    setTimeout(() => {
      document.addEventListener('click', onClick);
      document.addEventListener('contextmenu', onClick);
    }, 0);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('contextmenu', onClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [x, y, onClose]);

  return (
    <div
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        background: '#FFFFFF',
        border: '0.5px solid rgba(0,0,0,0.12)',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
        padding: 4,
        minWidth: 180,
        zIndex: 2000,
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      {actions.map((a, i) => {
        if (a.divider) return <div key={i} style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />;
        return (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); a.onClick(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
              color: a.danger ? '#D4537E' : '#1A1A1A',
              borderRadius: 6,
              transition: 'background 0.1s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = a.danger ? '#FCE8EE' : '#F4F2EC'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// 보관 사유 입력 시트
// ============================================================
function ArchiveSheet({ itemTitle, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const presets = ['자산 부족', '시즌 지남', '다양성 위반', '우선순위 밀림', '아이디어만 보존'];

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px' }}>📦 보관함으로 이동</h3>
          <p style={{ fontSize: 13, color: '#5F5E5A', margin: 0, wordBreak: 'keep-all', lineHeight: 1.5 }}>"{itemTitle}"<br/>캘린더에서 사라지지만 보관함에서 언제든 복원할 수 있어요.</p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#888780', fontWeight: 500, marginBottom: 8 }}>보관 사유 (선택)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {presets.map(p => (
              <button
                key={p}
                onClick={() => setReason(p)}
                style={{
                  background: reason === p ? '#1A1A1A' : '#F4F2EC',
                  color: reason === p ? '#FFFFFF' : '#5F5E5A',
                  border: 'none',
                  borderRadius: 14,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  cursor: 'pointer'
                }}
              >{p}</button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="또는 직접 입력 (다음 캘린더 기획 시 참고용)"
            rows={2}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'inherit',
              background: '#F4F2EC',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              minHeight: 48
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: '0.5px solid rgba(0,0,0,0.18)',
              borderRadius: 10,
              fontSize: 14,
              fontFamily: 'inherit',
              color: '#1A1A1A',
              cursor: 'pointer'
            }}
          >취소</button>
          <button
            onClick={() => onConfirm(reason.trim())}
            style={{
              flex: 1,
              padding: '12px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontFamily: 'inherit',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >보관하기</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 보관함 모달
// ============================================================
function ArchiveModal({ items, loading, onClose, onRestore, onDelete }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 2px' }}>📦 보관함</h3>
            <p style={{ fontSize: 12, color: '#5F5E5A', margin: 0 }}>{items.length}개의 보관된 콘텐츠</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#1A1A1A', padding: 4, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#888780', fontSize: 13 }}>로딩 중...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888780' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>📭</div>
              <div style={{ fontSize: 13 }}>보관된 콘텐츠가 없습니다.</div>
              <div style={{ fontSize: 11, marginTop: 6, color: '#A8A39A' }}>콘텐츠를 우클릭하거나 상세보기 ⋯ 메뉴에서<br/>"보관함으로" 를 선택하면 여기에 모입니다.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(it => {
                const c = COLORS[it.channel] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                return (
                  <div key={it.id} style={{ background: '#FFFFFF', border: '0.5px solid rgba(0,0,0,0.10)', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c.bg, flexShrink: 0, marginTop: 6 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#888780', marginBottom: 3 }}>
                        원래 {it.date.replace(/-/g, '.')} · {it.channelName}
                        {it.archivedAt && <span> · 보관 {it.archivedAt.slice(0, 10).replace(/-/g, '.')}</span>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 4, wordBreak: 'keep-all', lineHeight: 1.4 }}>
                        {it.isCore && '★ '}{it.title}
                      </div>
                      {it.archiveReason && (
                        <div style={{ display: 'inline-block', fontSize: 11, color: '#5F5E5A', background: '#F4F2EC', padding: '3px 8px', borderRadius: 4 }}>
                          사유: {it.archiveReason}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => onRestore(it.id)}
                        style={{
                          padding: '6px 10px',
                          fontSize: 11,
                          fontFamily: 'inherit',
                          background: '#E6F0E8',
                          color: '#3A6B45',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >↩ 복원</button>
                      <button
                        onClick={() => {
                          if (confirm('영구 삭제하시겠습니까? 복원할 수 없습니다.')) onDelete(it.id);
                        }}
                        style={{
                          padding: '6px 10px',
                          fontSize: 11,
                          fontFamily: 'inherit',
                          background: 'transparent',
                          color: '#D4537E',
                          border: '0.5px solid #F5C3CD',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >🗑️ 삭제</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
