import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';

// ============================================================
// 채널 색상
// ============================================================
const COLORS = {
  'moment-insta-star': { bg: '#FAEBE6', fg: '#8B4438' },
  'moment-insta-daily': { bg: '#F5EDE0', fg: '#8B6F38' },
  'moment-blog': { bg: '#E8E4DA', fg: '#5C5444' },
  'moment-todayhouse': { bg: '#E6F0E8', fg: '#3A6B45' },
  'moment-pin': { bg: '#F5E8EE', fg: '#8B3A5C' },
  'ohana-blog': { bg: '#E8E8F0', fg: '#4A4A6E' },
  'ohana-insta': { bg: '#F0E8E0', fg: '#6E5638' }
};

const CHANNEL_OPTIONS = [
  { value: 'moment-insta-star', label: 'moment.in 인스타 (시리즈)', shortLabel: '인스타', skill: 'momentin-insta-writer' },
  { value: 'moment-insta-daily', label: 'moment.in 인스타 (데일리)', shortLabel: '인스타', skill: 'momentin-insta-writer' },
  { value: 'moment-blog', label: 'moment_in 블로그', shortLabel: '블로그', skill: 'momentin-blog-writer' },
  { value: 'moment-todayhouse', label: 'moment.in 오늘의집', shortLabel: '오늘의집', skill: 'momentin-todayhouse-writer' },
  { value: 'moment-pin', label: 'moment.in 핀터레스트', shortLabel: '핀터레스트', skill: 'momentin-pinterest-writer' },
  { value: 'ohana-blog', label: 'ohana_story 블로그', shortLabel: 'ohana 블로그', skill: 'ohana-blog-writer' },
  { value: 'ohana-insta', label: 'ohana.yyy 인스타', shortLabel: 'ohana 인스타', skill: 'ohana-insta-writer' }
];

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

const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

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
  description: item.description || null,
  completed: !!item.completed,
  archived: !!item.archived,
  archived_at: item.archivedAt || null,
  archive_reason: item.archiveReason || null
});

export default function App({ session }) {
  const userId = session.user.id;
  const userEmail = session.user.email;

  const [currentMonth, setCurrentMonth] = useState('2026-05');
  const [items, setItems] = useState([]);
  const [performance, setPerformance] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  const [archiveSheet, setArchiveSheet] = useState(null); // { itemId, title } | null

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
      const startDate = `${yearStr}-${monthStr}-01`;
      const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

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

  const saveItem = async (item) => {
    try {
      const isNew = !items.find(i => i.id === item.id);
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

  useEffect(() => {
    const timer = setTimeout(async () => {
      for (const [itemId, perf] of Object.entries(performance)) {
        if (!items.find(i => i.id === itemId)) continue;
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
  }, [performance, userId, items]);

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
      return true;
    });
  };
  const filteredItems = applyFilters(items);
  const isFiltered = searchQuery || filterChannels.size > 0 || filterCompleted !== 'all' || filterCore;

  // 캘린더 그리드
  const [yearStr, monthStr] = currentMonth.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const startDateObj = new Date(yearNum, monthNum - 1, 1);
  const startDay = startDateObj.getDay();
  const lastDay = new Date(yearNum, monthNum, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push({ empty: true, key: `empty-${i}` });
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    const dt = new Date(yearNum, monthNum - 1, d);
    const dow = dt.getDay();
    const dayItems = filteredItems.filter(it => it.date === dateStr);
    cells.push({ empty: false, key: dateStr, day: d, dow, dateStr, dayItems, holiday: HOLIDAYS[dateStr], anniversary: ANNIVERSARIES[dateStr] });
  }

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

  const newItemDefaults = (initialDate) => ({
    id: '', title: '',
    date: initialDate || `${currentMonth}-01`, time: '21:00',
    channel: 'moment-insta-daily',
    channelName: 'moment.in 인스타 (데일리)',
    isCore: false, mainKeyword: '', subKeywords: [], strength: '', asset: '',
    nextSkill: 'momentin-insta-writer', description: '', completed: false
  });

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
        .cal-cell.holiday { background: #FAF9F5; }
        .cal-cell.drag-over { background: #F0EDE0; box-shadow: inset 0 0 0 2px #1A1A1A; }
        .cal-cell .day-num { font-size: 13px; font-weight: 500; }
        .cal-cell .day-num.sun { color: #D4537E; }
        .cal-cell .day-num.sat { color: #5C7AA8; }
        .day-event { font-size: 9px; color: #888780; margin-top: 1px; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .dow-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
        .dow-row > div { font-size: 11px; color: #5F5E5A; text-align: center; padding: 6px 0; }
        .cal-item { width: 100%; padding: 3px 5px; border-radius: 4px; font-size: 10px; margin-top: 2px; cursor: grab; border: none; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: inherit; transition: opacity 0.15s, transform 0.1s; line-height: 1.4; }
        .cal-item:active { cursor: grabbing; }
        .cal-item.completed { opacity: 0.5; text-decoration: line-through; }
        .cal-item.dragging { opacity: 0.3; transform: scale(0.95); }
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
        .list-item-dot { width: 4px; align-self: stretch; min-height: 32px; border-radius: 2px; flex-shrink: 0; }
        .list-item-content { flex: 1; min-width: 0; }
        .list-item-title { font-size: 14px; color: #1A1A1A; font-weight: 500; line-height: 1.4; word-break: keep-all; }
        .list-item-title.completed { opacity: 0.5; text-decoration: line-through; }
        .list-item-meta { font-size: 11px; color: #888780; margin-top: 3px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .list-empty { padding: 40px 20px; text-align: center; color: #888780; font-size: 13px; }

        .week-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .week-grid { display: grid; grid-template-columns: repeat(7, minmax(120px, 1fr)); gap: 4px; width: 100%; min-width: 700px; }
        .week-cell { background: #FFFFFF; border-radius: 8px; padding: 10px 8px; min-height: 320px; display: flex; flex-direction: column; overflow: hidden; }
        .week-cell.holiday { background: #FAF9F5; }
        .week-cell-header { padding-bottom: 8px; border-bottom: 0.5px solid rgba(0,0,0,0.06); margin-bottom: 8px; }
        .week-cell-day { font-size: 18px; font-weight: 600; }
        .week-cell-dow { font-size: 11px; color: #5F5E5A; }
        .week-cell-items { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .week-item { padding: 6px 8px; border-radius: 6px; font-size: 11px; cursor: grab; border: none; text-align: left; font-family: inherit; line-height: 1.3; word-break: keep-all; }
        .week-item.completed { opacity: 0.5; text-decoration: line-through; }

        @media (max-width: 640px) {
          .cal-cell { min-height: 90px; max-height: 140px; padding: 5px 4px; }
          .cal-cell-empty { min-height: 90px; max-height: 140px; }
          .cal-cell .day-num { font-size: 11px; }
          .day-event { font-size: 8px; }
          .cal-item { font-size: 9px; padding: 2px 4px; }
          .modal-overlay { padding: 0; align-items: flex-end; }
          .modal-content { border-radius: 16px 16px 0 0; max-height: 92vh; padding: 18px; max-width: 100%; }
          .header-row { gap: 6px; }
          .month-title { font-size: 17px; }
          .user-email { font-size: 11px; max-width: 100%; }
          .cal-grid { gap: 2px; }
          .dow-row { gap: 2px; }
          .dow-row > div { font-size: 10px; padding: 4px 0; }
          .control-bar { flex-direction: column; align-items: stretch; gap: 8px; }
          .view-toggle { max-width: 100%; }
          .view-toggle-btn { padding: 8px 8px; font-size: 12px; }
          .search-filter { width: 100%; }
          .search-box { flex: 1; min-width: 0; }
          .week-cell { min-height: 240px; padding: 8px 5px; }
          .week-cell-day { font-size: 15px; }
          .week-item { font-size: 10px; padding: 4px 5px; }
          .list-day-header-btn { padding: 12px 14px; }
          .list-day-date { font-size: 14px; }
          .list-day-count { font-size: 11px; padding: 2px 7px; }
          .list-item { padding: 10px 14px; gap: 8px; }
          .list-item-title { font-size: 13px; }
          .kpi-cards { grid-template-columns: repeat(2, 1fr); }
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
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
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
              <button onClick={() => setEditingItem(newItemDefaults())} style={{ background: '#1A1A1A', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap' }}>+ 새 콘텐츠</button>
              <button onClick={openArchive} style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer', whiteSpace: 'nowrap' }} title="보관함">📦 보관함</button>
              <span className="user-email">{userEmail}</span>
              <button onClick={handleSignOut} style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer', whiteSpace: 'nowrap' }}>로그아웃</button>
            </div>
          </div>
        </div>

        {/* 뷰 토글 + 검색·필터 */}
        <div className="control-bar">
          <div className="view-toggle">
            {[
              { value: 'month', label: '월간' },
              { value: 'week', label: '주간' },
              { value: 'list', label: '리스트' },
              { value: 'kpi', label: 'KPI' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setViewMode(opt.value)}
                className={`view-toggle-btn ${viewMode === opt.value ? 'active' : ''}`}
              >{opt.label}</button>
            ))}
          </div>

          <div className="search-filter">
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
              className={`filter-btn ${(filterChannels.size > 0 || filterCompleted !== 'all' || filterCore) ? 'active' : ''}`}
              title="필터"
            >
              필터{(filterChannels.size > 0 || filterCompleted !== 'all' || filterCore) && <span className="filter-dot" />}
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
                  const seen = new Set();
                  return CHANNEL_OPTIONS.filter(opt => {
                    if (seen.has(opt.shortLabel)) return false;
                    seen.add(opt.shortLabel);
                    return true;
                  }).map(opt => {
                    const sameGroup = CHANNEL_OPTIONS.filter(o => o.shortLabel === opt.shortLabel);
                    const c = COLORS[opt.value] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                    const active = sameGroup.some(o => filterChannels.has(o.value));
                    return (
                      <button
                        key={opt.shortLabel}
                        onClick={() => {
                          setFilterChannels(prev => {
                            const next = new Set(prev);
                            if (active) sameGroup.forEach(o => next.delete(o.value));
                            else sameGroup.forEach(o => next.add(o.value));
                            return next;
                          });
                        }}
                        className={`filter-chip ${active ? 'active' : ''}`}
                        style={active ? { background: c.bg, color: c.fg, borderColor: c.fg } : {}}
                      >{opt.shortLabel}</button>
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
            <div className="dow-row">{dayLabels.map(label => <div key={label}>{label}</div>)}</div>
            <div className="cal-grid">
              {cells.map(cell => {
                if (cell.empty) return <div key={cell.key} className="cal-cell-empty" />;
                const dayClass = cell.dow === 0 ? 'sun' : cell.dow === 6 ? 'sat' : '';
                const isDragOver = dragOverDate === cell.dateStr;
                return (
                  <div
                    key={cell.key}
                    className={`cal-cell ${cell.holiday ? 'holiday' : ''} ${isDragOver ? 'drag-over' : ''}`}
                    onDragOver={(e) => handleDragOver(e, cell.dateStr)}
                    onDragLeave={(e) => handleDragLeave(e, cell.dateStr)}
                    onDrop={(e) => handleDrop(e, cell.dateStr)}
                    onDoubleClick={(e) => {
                      // 콘텐츠 항목이 아닌 빈 영역에서만 작동
                      if (e.target.classList.contains('cal-item')) return;
                      setEditingItem(newItemDefaults(cell.dateStr));
                    }}
                    title="더블클릭하여 새 콘텐츠 추가"
                  >
                    <div className={`day-num ${dayClass}`}>{cell.day}</div>
                    {cell.holiday && <div className="day-event" style={{ color: '#D4537E', fontWeight: 500 }}>{cell.holiday}</div>}
                    {cell.anniversary && <div className="day-event">{cell.anniversary}</div>}
                    {cell.dayItems.map(it => {
                      const c = COLORS[it.channel] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                      const isDragging = draggingId === it.id;
                      return (
                        <button
                          key={it.id}
                          className={`cal-item ${it.completed ? 'completed' : ''} ${isDragging ? 'dragging' : ''}`}
                          style={{ background: c.bg, color: c.fg }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, it.id)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isDragging) setSelectedItem(it);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenu({ x: e.clientX, y: e.clientY, item: it });
                          }}
                        >
                          {it.isCore && '★ '}{it.title}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!loading && !error && viewMode === 'week' && (
          <WeekView
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            items={filteredItems}
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
          />
        )}

        {!loading && !error && viewMode === 'list' && (
          <ListView
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
          />
        )}

        {!loading && !error && viewMode === 'kpi' && (
          <KPIView items={items} currentMonth={currentMonth} />
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

        {archiveSheet && (
          <ArchiveSheet
            itemTitle={archiveSheet.title}
            onCancel={() => setArchiveSheet(null)}
            onConfirm={async (reason) => {
              await moveToArchive(archiveSheet.itemId, reason);
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden' }}>
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
          {item.mainKeyword && <InfoRow label="메인 키워드" value={<div><div>{item.mainKeyword}</div>{item.strength && <div style={{ color: '#888780', fontSize: 12, marginTop: 2 }}>{item.strength}</div>}</div>} />}
          {item.asset && <InfoRow label="자산" value={item.asset} />}
          {item.nextSkill && <InfoRow label="작성 스킬" value={<code style={{ background: '#F8F8F6', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: '#5F5E5A', fontFamily: 'ui-monospace, monospace' }}>{item.nextSkill}</code>} />}
          {item.description && <InfoRow label="메모" value={<div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.description}</div>} />}
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
          <button onClick={onToggleCompleted} style={{ width: '100%', background: item.completed ? '#FFFFFF' : '#1A1A1A', color: item.completed ? '#5F5E5A' : '#FFFFFF', border: item.completed ? '0.5px solid rgba(0,0,0,0.18)' : 'none', borderRadius: 10, padding: '14px', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', fontWeight: 600 }}>
            {item.completed ? '발행 취소' : '발행 완료'}
          </button>
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
      <div style={{ width: 80, flexShrink: 0, color: '#888780', fontSize: 12, paddingTop: 2 }}>{label}</div>
      <div style={{ flex: 1, color: '#1A1A1A', lineHeight: 1.5, wordBreak: 'keep-all' }}>{value}</div>
    </div>
  );
}

function EditModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item);
  const [showMore, setShowMore] = useState(!!(item.mainKeyword || item.asset || item.isCore));
  const isEdit = !!item.id;

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
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
    onSave(form);
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>채널</label>
            <select value={form.channel} onChange={(e) => handleChannelChange(e.target.value)} style={selectStyle}>
              {CHANNEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
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
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 70, lineHeight: 1.5 }}
                  placeholder="추가 설명·아이디어·캡션 초안 등"
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
function ListView({ items, currentMonth, holidays, anniversaries, onItemClick, onItemContextMenu, onAddClick }) {
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
          <div key={dateStr} className={`list-day ${isExpanded ? 'expanded' : ''}`}>
            <button
              className="list-day-header-btn"
              onClick={() => toggleDate(dateStr)}
              type="button"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span className={`list-arrow ${isExpanded ? 'expanded' : ''}`}>›</span>
                <div className="list-day-date">
                  {isToday && <span className="today-dot" />}
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
                {onAddClick && (
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
                  return (
                    <button
                      key={it.id}
                      className="list-item"
                      onClick={() => onItemClick(it)}
                      onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, it)}
                    >
                      <div className="list-item-dot" style={{ background: c.bg }} />
                      <div className="list-item-content">
                        <div className={`list-item-title ${it.completed ? 'completed' : ''}`}>
                          {it.isCore && <span style={{ color: '#D4A92E', marginRight: 4 }}>★</span>}
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

function WeekView({ weekStart, setWeekStart, items, holidays, anniversaries, onItemClick, onItemContextMenu, draggingId, dragOverDate, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop, isMobile }) {
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
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

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
                {dayItems.length > 0 && (
                  <div style={{ padding: '6px 0' }}>
                    {dayItems.map(it => {
                      const c = COLORS[it.channel] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                      return (
                        <button key={it.id}
                          onClick={() => onItemClick(it)}
                          onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, it)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: c.fg, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: it.completed ? '#aaa' : '#1A1A1A', textDecoration: it.completed ? 'line-through' : 'none', flex: 1 }}>
                            {it.isCore && '★ '}{it.title}
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
            return (
              <div key={wd.dateStr}
                className={`week-cell ${holiday ? 'holiday' : ''} ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, wd.dateStr)}
                onDragLeave={(e) => handleDragLeave(e, wd.dateStr)}
                onDrop={(e) => handleDrop(e, wd.dateStr)}
              >
                <div className="week-cell-header">
                  <div className="week-cell-day" style={{ color: dowColor }}>{wd.day}</div>
                  <div className="week-cell-dow">{dayLabelsLocal[wd.dow]}</div>
                  {holiday && <div style={{ fontSize: 10, color: '#D4537E', marginTop: 2 }}>{holiday}</div>}
                  {anniversary && <div style={{ fontSize: 10, color: '#888780', marginTop: 2 }}>{anniversary}</div>}
                </div>
                <div className="week-cell-items">
                  {dayItems.map(it => {
                    const c = COLORS[it.channel] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                    const isDragging = draggingId === it.id;
                    return (
                      <button key={it.id}
                        className={`week-item ${it.completed ? 'completed' : ''}`}
                        style={{ background: c.bg, color: c.fg, opacity: isDragging ? 0.3 : 1 }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, it.id)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => { e.stopPropagation(); if (!isDragging) onItemClick(it); }}
                        onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, it)}
                      >{it.isCore && '★ '}{it.title}</button>
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
// KPI 대시보드
// ============================================================
function KPIView({ items, currentMonth }) {
  // 통계 계산
  const total = items.length;
  const completed = items.filter(it => it.completed).length;
  const completionRate = total > 0 ? Math.round(completed / total * 100) : 0;

  // 채널별 집계 — shortLabel 기준으로 그룹핑
  const byShortLabel = {};
  CHANNEL_OPTIONS.forEach(opt => {
    const key = opt.shortLabel || opt.label;
    if (!byShortLabel[key]) {
      byShortLabel[key] = { shortLabel: key, total: 0, done: 0, color: COLORS[opt.value] || { bg: '#F0F0EB', fg: '#5F5E5A' } };
    }
  });
  items.forEach(it => {
    const opt = CHANNEL_OPTIONS.find(o => o.value === it.channel);
    if (!opt) return;
    const key = opt.shortLabel || opt.label;
    if (byShortLabel[key]) {
      byShortLabel[key].total += 1;
      if (it.completed) byShortLabel[key].done += 1;
    }
  });
  const channelStats = Object.values(byShortLabel).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  // 핵심 vs 일반
  const coreItems = items.filter(it => it.isCore);
  const coreCompleted = coreItems.filter(it => it.completed).length;
  const coreRate = coreItems.length > 0 ? Math.round(coreCompleted / coreItems.length * 100) : 0;

  // 주차별 발행 분포 (월간)
  const [yearStr, monthStr] = currentMonth.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const lastDay = new Date(yearNum, monthNum, 0).getDate();
  const weeksData = [
    { label: '1주차', range: '1~7일', total: 0, done: 0 },
    { label: '2주차', range: '8~14일', total: 0, done: 0 },
    { label: '3주차', range: '15~21일', total: 0, done: 0 },
    { label: '4주차', range: '22~28일', total: 0, done: 0 },
    { label: '5주차', range: `29~${lastDay}일`, total: 0, done: 0 }
  ];
  items.forEach(it => {
    const day = parseInt(it.date.split('-')[2], 10);
    let weekIdx;
    if (day <= 7) weekIdx = 0;
    else if (day <= 14) weekIdx = 1;
    else if (day <= 21) weekIdx = 2;
    else if (day <= 28) weekIdx = 3;
    else weekIdx = 4;
    weeksData[weekIdx].total += 1;
    if (it.completed) weeksData[weekIdx].done += 1;
  });

  // 발행 후 기록은 별도 테이블 — 여기선 표시 안 함 (TODO: 추후 join)

  if (total === 0) {
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 60, textAlign: 'center', color: '#888780', fontSize: 14 }}>
        이번 달에 등록된 콘텐츠가 없어요.<br />
        <span style={{ fontSize: 12, marginTop: 8, display: 'inline-block' }}>+ 새 콘텐츠 버튼으로 추가하세요.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 핵심 지표 4종 */}
      <div className="kpi-cards">
        <KpiCard label="이번 달 콘텐츠" value={`${total}편`} sub={`핵심 ${coreItems.length}편`} />
        <KpiCard label="발행 완료" value={`${completed}편`} sub={`${completionRate}%`} accent={completionRate >= 50 ? '#3A7D3A' : '#5F5E5A'} />
        <KpiCard label="미발행" value={`${total - completed}편`} sub={`${100 - completionRate}%`} accent={total - completed > 0 ? '#D4537E' : '#5F5E5A'} />
        <KpiCard label="핵심 발행률" value={`${coreRate}%`} sub={`${coreCompleted}/${coreItems.length}편`} accent="#D4A92E" />
      </div>

      {/* 발행률 막대 */}
      <div className="kpi-card-full">
        <div className="kpi-card-title">전체 발행률</div>
        <div className="kpi-bar-track">
          <div className="kpi-bar-fill" style={{ width: `${completionRate}%`, background: completionRate >= 70 ? '#3A7D3A' : completionRate >= 40 ? '#D4A92E' : '#D4537E' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888780', marginTop: 6 }}>
          <span>{completed}편 발행</span>
          <span>{completionRate}%</span>
        </div>
      </div>

      {/* 채널별 */}
      <div className="kpi-card-full">
        <div className="kpi-card-title">채널별 발행 현황</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {channelStats.map(ch => {
            const rate = ch.total > 0 ? Math.round(ch.done / ch.total * 100) : 0;
            return (
              <div key={ch.shortLabel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ch.color.fg || '#5F5E5A', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>{ch.shortLabel}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#5F5E5A' }}>{ch.done}/{ch.total}편 · {rate}%</span>
                </div>
                <div className="kpi-bar-track">
                  <div className="kpi-bar-fill" style={{ width: `${Math.max(rate, rate > 0 ? 2 : 0)}%`, background: ch.color.fg || '#5F5E5A' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 주차별 */}
      <div className="kpi-card-full">
        <div className="kpi-card-title">주차별 발행 분포</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {weeksData.map(w => {
            const maxTotal = Math.max(...weeksData.map(x => x.total), 1);
            const barWidth = w.total > 0 ? Math.round((w.total / maxTotal) * 100) : 0;
            const doneWidth = w.total > 0 ? Math.round((w.done / w.total) * barWidth) : 0;
            return (
              <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{w.label}</div>
                  <div style={{ fontSize: 10, color: '#888780' }}>{w.range}</div>
                </div>
                <div style={{ flex: 1, position: 'relative', height: 28, background: '#F0EFE9', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barWidth}%`, background: '#D8D3C8', borderRadius: 6, transition: 'width 0.4s' }} />
                  {doneWidth > 0 && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${doneWidth}%`, background: '#8B7355', borderRadius: 6, transition: 'width 0.4s' }} />}
                </div>
                <div style={{ width: 48, textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{w.total}</span>
                  <span style={{ fontSize: 11, color: '#888780' }}>편</span>
                  {w.done > 0 && <div style={{ fontSize: 10, color: '#3A7D3A', fontWeight: 500 }}>✓ {w.done}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#D8D3C8', display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: '#888780' }}>미발행</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#8B7355', display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: '#888780' }}>발행 완료</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-label">{label}</div>
      <div className="kpi-card-value" style={{ color: accent || '#1A1A1A' }}>{value}</div>
      {sub && <div className="kpi-card-sub" style={{ color: accent || '#888780' }}>{sub}</div>}
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
