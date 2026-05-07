import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// ============================================================
// 휴일·기념일 (2026년 전체)
// ============================================================
const HOLIDAYS = {
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '대체공휴일',
  '2026-05-01': '근로자의 날',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일',
  '2026-06-03': '지방선거',
  '2026-06-06': '현충일',
  '2026-07-17': '제헌절',
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '크리스마스'
};

const ANNIVERSARIES = {
  '2026-02-14': '발렌타인데이',
  '2026-03-14': '화이트데이',
  '2026-05-08': '어버이날',
  '2026-05-15': '스승의날',
  '2026-05-18': '성년의날',
  '2026-05-21': '부부의날',
  '2026-11-11': '빼빼로데이',
  '2026-12-24': '크리스마스 이브'
};

const todayYM = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

export default function App({ session }) {
  const [currentMonth, setCurrentMonth] = useState('2026-05');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ============================================
  // Supabase에서 items 로드
  // ============================================
  useEffect(() => {
    let cancelled = false;
    async function loadItems() {
      setLoading(true);
      setError(null);
      try {
        const [yearStr, monthStr] = currentMonth.split('-');
        const startDate = `${yearStr}-${monthStr}-01`;
        const yearNum = parseInt(yearStr, 10);
        const monthNum = parseInt(monthStr, 10);
        const lastDay = new Date(yearNum, monthNum, 0).getDate();
        const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase
          .from('items')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true })
          .order('time', { ascending: true });

        if (error) throw error;
        if (!cancelled) setItems(data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || '데이터 로드 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadItems();
    return () => { cancelled = true; };
  }, [currentMonth]);

  // ============================================
  // 캘린더 그리드 빌드
  // ============================================
  const [yearStr, monthStr] = currentMonth.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const startDate = new Date(yearNum, monthNum - 1, 1);
  const startDay = startDate.getDay();
  const lastDay = new Date(yearNum, monthNum, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push({ empty: true, key: `empty-${i}` });
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    const dt = new Date(yearNum, monthNum - 1, d);
    const dow = dt.getDay();
    const dayItems = items.filter(it => it.date === dateStr);
    cells.push({
      empty: false,
      key: dateStr,
      day: d,
      dow,
      dateStr,
      dayItems,
      holiday: HOLIDAYS[dateStr],
      anniversary: ANNIVERSARIES[dateStr]
    });
  }

  // 월 이동
  const prevMonth = () => {
    const d = new Date(yearNum, monthNum - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(yearNum, monthNum, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const goToday = () => setCurrentMonth(todayYM);

  // 로그아웃
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F1EFE8',
      padding: '1.5rem 1rem',
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#1A1A1A'
    }}>
      <style>{`
        * { box-sizing: border-box; }
        .cal-cell { background: #FFFFFF; border-radius: 8px; padding: 8px 6px; min-height: 90px; position: relative; transition: background 0.15s; }
        .cal-cell.holiday { background: #FAF9F5; }
        .cal-cell .day-num { font-size: 13px; font-weight: 500; }
        .cal-cell .day-num.sun { color: #D4537E; }
        .cal-cell .day-num.sat { color: #5C7AA8; }
        .cal-cell .day-num.today { background: #1A1A1A; color: #FFFFFF; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; }
        .day-event { font-size: 9px; color: #888780; margin-top: 1px; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .dow-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
        .dow-row > div { font-size: 11px; color: #5F5E5A; text-align: center; padding: 6px 0; }
        @media (max-width: 640px) {
          .cal-cell { min-height: 60px; padding: 4px 3px; }
          .cal-cell .day-num { font-size: 11px; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={prevMonth}
              style={navBtnStyle}
              aria-label="이전 달"
            >‹</button>
            <div style={{ minWidth: 130, textAlign: 'center' }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 2px' }}>{yearNum}년 {monthNum}월</h1>
              <p style={{ fontSize: 12, color: '#5F5E5A', margin: 0 }}>moment.in × ohana</p>
            </div>
            <button
              onClick={nextMonth}
              style={navBtnStyle}
              aria-label="다음 달"
            >›</button>
            <button
              onClick={goToday}
              style={{ ...navBtnStyle, width: 'auto', padding: '6px 12px', fontSize: 12, color: '#5F5E5A' }}
            >오늘</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#5F5E5A' }}>{session.user.email}</span>
            <button
              onClick={handleSignOut}
              style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.22)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', color: '#5F5E5A', cursor: 'pointer' }}
            >로그아웃</button>
          </div>
        </div>

        {/* 상태 표시 */}
        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: '#5F5E5A', fontSize: 13 }}>데이터 불러오는 중...</div>
        )}
        {error && (
          <div style={{ padding: 12, background: '#FAF0F4', color: '#D4537E', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
            오류: {error}
          </div>
        )}

        {/* 캘린더 */}
        {!loading && !error && (
          <>
            <div className="dow-row">
              {dayLabels.map(label => (
                <div key={label}>{label}</div>
              ))}
            </div>
            <div className="cal-grid">
              {cells.map(cell => {
                if (cell.empty) {
                  return <div key={cell.key} style={{ minHeight: 90 }} />;
                }
                const dayClass = cell.dow === 0 ? 'sun' : cell.dow === 6 ? 'sat' : '';
                return (
                  <div key={cell.key} className={`cal-cell ${cell.holiday ? 'holiday' : ''}`}>
                    <div className={`day-num ${dayClass}`}>{cell.day}</div>
                    {cell.holiday && <div className="day-event" style={{ color: '#D4537E', fontWeight: 500 }}>{cell.holiday}</div>}
                    {cell.anniversary && <div className="day-event">{cell.anniversary}</div>}
                    {cell.dayItems.map(it => (
                      <div key={it.id} style={{ fontSize: 9, color: '#1A1A1A', marginTop: 2, padding: '2px 4px', background: '#F0F0EB', borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* 1단계 안내 */}
            <div style={{ marginTop: 24, padding: 16, background: '#F8F8F6', borderRadius: 8, fontSize: 13, color: '#5F5E5A', lineHeight: 1.6 }}>
              <strong style={{ color: '#1A1A1A' }}>1단계: 최소 작동 버전</strong><br />
              로그인·세션 유지·빈 캘린더 표시·월 이동이 작동합니다.<br />
              다음 단계에서 콘텐츠 추가/수정/삭제 + 발행 후 기록 기능을 추가합니다.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const navBtnStyle = {
  background: 'transparent',
  border: '0.5px solid rgba(0,0,0,0.18)',
  borderRadius: 8,
  width: 32,
  height: 32,
  cursor: 'pointer',
  fontSize: 14,
  color: '#1A1A1A',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  fontFamily: 'inherit'
};
