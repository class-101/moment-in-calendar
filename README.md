# moment.in × ohana 콘텐츠 캘린더

## 배포

GitHub Pages: https://class-101.github.io/moment-in-calendar/

## 기술 스택

- React 18 + Vite
- Supabase (Postgres + Auth)
- GitHub Pages + GitHub Actions

## 로컬 개발

```bash
npm install
npm run dev
```

## 배포

`main` 브랜치에 push하면 GitHub Actions가 자동 빌드·배포합니다.

## Supabase 설정

- Project URL과 anon key는 `src/supabaseClient.js`에 하드코딩
- DB 테이블: `items`, `performance` (RLS 적용 — 사용자별 데이터 격리)
