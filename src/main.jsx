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

    return () => subscription.unsubscribe();
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
