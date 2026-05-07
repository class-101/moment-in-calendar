import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ⚠️ GitHub 저장소명과 일치해야 함
// 예: 저장소가 yejin/moment-in-calendar 면 base = '/moment-in-calendar/'
// 저장소명을 변경했다면 아래 base 값만 수정하세요.
export default defineConfig({
  plugins: [react()],
  base: '/moment-in-calendar/'
});
