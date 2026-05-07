import { useEffect, useState, useCallback } from 'react';
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
  { value: 'moment-insta-star', label: 'moment.in 인스타 (시리즈)', skill: 'momentin-insta-writer' },
  { value: 'moment-insta-daily', label: 'moment.in 인스타 (데일리)', skill: 'momentin-insta-writer' },
  { value: 'moment-blog', label: 'moment_in 블로그', skill: 'momentin-blog-writer' },
  { value: 'moment-todayhouse', label: 'moment.in 오늘의집', skill: 'momentin-todayhouse-writer' },
  { value: 'moment-pin', label: 'moment.in 핀터레스트', skill: 'momentin-pinterest-writer' },
  { value: 'ohana-blog', label: 'ohana_story 블로그', skill: 'ohana-blog-writer' },
  { value: 'ohana-insta', label: 'ohana.yyy 인스타', skill: 'ohana-insta-writer' }
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
  completed: row.completed
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
  completed: !!item.completed
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
    const dayItems = items.filter(it => it.date === dateStr);
    cells.push({ empty: false, key: dateStr, day: d, dow, dateStr, dayItems, holiday: HOLIDAYS[dateStr], anniversary: ANNIVERSARIES[dateStr] });
  }

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

  const newItemDefaults = () => ({
    id: '', title: '',
    date: `${currentMonth}-01`, time: '21:00',
    channel: 'moment-insta-daily',
    channelName: 'moment.in 인스타 (데일리)',
    isCore: false, mainKeyword: '', subKeywords: [], strength: '', asset: '',
    nextSkill: 'momentin-insta-writer', completed: false
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F1EFE8', padding: '1.5rem 1rem', fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: '#1A1A1A' }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes sheetFadeIn { from { background: rgba(0,0,0,0); } to { background: rgba(0,0,0,0.5); } }
        @keyframes sheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .cal-cell { background: #FFFFFF; border-radius: 8px; padding: 8px 6px; min-height: 90px; position: relative; transition: background 0.15s; }
        .cal-cell.holiday { background: #FAF9F5; }
        .cal-cell .day-num { font-size: 13px; font-weight: 500; }
        .cal-cell .day-num.sun { color: #D4537E; }
        .cal-cell .day-num.sat { color: #5C7AA8; }
        .day-event { font-size: 9px; color: #888780; margin-top: 1px; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .dow-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
        .dow-row > div { font-size: 11px; color: #5F5E5A; text-align: center; padding: 6px 0; }
        .cal-item { width: 100%; padding: 2px 4px; border-radius: 3px; font-size: 9px; margin-top: 2px; cursor: pointer; border: none; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: inherit; }
        .cal-item.completed { opacity: 0.5; text-decoration: line-through; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 1000; }
        .modal-content { background: #FFFFFF; border-radius: 12px; padding: 22px; max-width: 480px; width: 100%; max-height: 90vh; overflow: auto; }
        @media (max-width: 640px) {
          .cal-cell { min-height: 60px; padding: 4px 3px; }
          .cal-cell .day-num { font-size: 11px; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={prevMonth} style={navBtnStyle} aria-label="이전">‹</button>
            <div style={{ minWidth: 130, textAlign: 'center' }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 2px' }}>{yearNum}년 {monthNum}월</h1>
              <p style={{ fontSize: 12, color: '#5F5E5A', margin: 0 }}>moment.in × ohana</p>
            </div>
            <button onClick={nextMonth} style={navBtnStyle} aria-label="다음">›</button>
            <button onClick={goToday} style={{ ...navBtnStyle, width: 'auto', padding: '6px 12px', fontSize: 12, color: '#5F5E5A' }}>오늘</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setEditingItem(newItemDefaults())} style={{ background: '#1A1A1A', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>+ 새 콘텐츠</button>
            <span style={{ fontSize: 12, color: '#5F5E5A' }}>{userEmail}</span>
            <button onClick={handleSignOut} style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer' }}>로그아웃</button>
          </div>
        </div>

        {loading && <div style={{ padding: 20, textAlign: 'center', color: '#5F5E5A', fontSize: 13 }}>불러오는 중...</div>}
        {error && <div style={{ padding: 12, background: '#FAF0F4', color: '#D4537E', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>오류: {error}</div>}

        {!loading && !error && (
          <>
            <div className="dow-row">{dayLabels.map(label => <div key={label}>{label}</div>)}</div>
            <div className="cal-grid">
              {cells.map(cell => {
                if (cell.empty) return <div key={cell.key} style={{ minHeight: 90 }} />;
                const dayClass = cell.dow === 0 ? 'sun' : cell.dow === 6 ? 'sat' : '';
                return (
                  <div key={cell.key} className={`cal-cell ${cell.holiday ? 'holiday' : ''}`}>
                    <div className={`day-num ${dayClass}`}>{cell.day}</div>
                    {cell.holiday && <div className="day-event" style={{ color: '#D4537E', fontWeight: 500 }}>{cell.holiday}</div>}
                    {cell.anniversary && <div className="day-event">{cell.anniversary}</div>}
                    {cell.dayItems.map(it => {
                      const c = COLORS[it.channel] || { bg: '#F0F0EB', fg: '#1A1A1A' };
                      return (
                        <button key={it.id} className={`cal-item ${it.completed ? 'completed' : ''}`} style={{ background: c.bg, color: c.fg }} onClick={() => setSelectedItem(it)}>
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

        {selectedItem && (
          <DetailModal
            item={selectedItem}
            performance={performance[selectedItem.id] || {}}
            onClose={() => { setSelectedItem(null); setMoreMenuOpen(false); }}
            onToggleCompleted={() => toggleCompleted(selectedItem.id)}
            onUpdatePerformance={(field, value) => updatePerformance(selectedItem.id, field, value)}
            onEdit={() => { setEditingItem({ ...selectedItem }); setSelectedItem(null); setMoreMenuOpen(false); }}
            onDuplicate={() => { duplicateItem(selectedItem.id); setSelectedItem(null); setMoreMenuOpen(false); }}
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
      </div>
    </div>
  );
}

const navBtnStyle = {
  background: 'transparent', border: '0.5px solid rgba(0,0,0,0.18)', borderRadius: 8,
  width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#1A1A1A',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'inherit'
};

function DetailModal({ item, performance, onClose, onToggleCompleted, onUpdatePerformance, onEdit, onDuplicate, onDelete, moreMenuOpen, setMoreMenuOpen }) {
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
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#FFFFFF', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', padding: 4, minWidth: 140, zIndex: 1100 }}>
                  <button onClick={onEdit} style={moreMenuItemStyle}>수정</button>
                  <button onClick={onDuplicate} style={moreMenuItemStyle}>복제</button>
                  <button onClick={onDelete} style={{ ...moreMenuItemStyle, color: '#D4537E' }}>삭제</button>
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
