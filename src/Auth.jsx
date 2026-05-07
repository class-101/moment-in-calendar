import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ type: 'success', text: '가입 완료. 이메일을 확인해주세요. (Supabase 무료 플랜은 별도 인증 메일 보냄)' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F1EFE8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: "'Pretendard', -apple-system, sans-serif",
      color: '#1A1A1A'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '32px 28px',
        width: '100%',
        maxWidth: 360,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
      }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>moment.in × ohana</h1>
          <p style={{ fontSize: 13, color: '#5F5E5A', margin: 0 }}>콘텐츠 캘린더</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 4, fontWeight: 500 }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '0.5px solid rgba(0,0,0,0.22)',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                background: '#FFFFFF'
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#5F5E5A', display: 'block', marginBottom: 4, fontWeight: 500 }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '0.5px solid rgba(0,0,0,0.22)',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                background: '#FFFFFF'
              }}
            />
          </div>

          {message && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 12,
              marginBottom: 12,
              background: message.type === 'error' ? '#FAF0F4' : '#F0F8F0',
              color: message.type === 'error' ? '#D4537E' : '#3A7D3A',
              lineHeight: 1.5
            }}>{message.text}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontFamily: 'inherit',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >{loading ? '처리 중...' : (mode === 'signup' ? '가입하기' : '로그인')}</button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setMessage(null); }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: '#5F5E5A',
              fontFamily: 'inherit'
            }}
          >{mode === 'signup' ? '이미 계정이 있어요 → 로그인' : '계정이 없어요 → 가입하기'}</button>
        </div>
      </div>
    </div>
  );
}
