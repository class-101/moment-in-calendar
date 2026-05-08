import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './supabaseClient';
import Auth from './Auth.jsx';
import App from './App.jsx';

function Root() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 세션 초기 로드
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 세션 변화 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // 탭이 다시 활성화될 때 세션 재검증
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
          if (currentSession) {
            // 토큰 만료 임박 시 갱신
            const expiresAt = currentSession.expires_at;
            const now = Math.floor(Date.now() / 1000);
            if (expiresAt && expiresAt - now < 600) {
              // 10분 이내 만료 → 갱신
              supabase.auth.refreshSession();
            }
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 네트워크 복구 시 세션 재검증
    const handleOnline = () => {
      supabase.auth.getSession();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F1EFE8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Pretendard', -apple-system, sans-serif",
        color: '#5F5E5A'
      }}>로딩 중...</div>
    );
  }

  return session ? <App session={session} /> : <Auth />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
