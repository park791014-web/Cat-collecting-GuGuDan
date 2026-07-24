# 냥코 구구단 대모험 — 데이터 초기화 및 릴리스 자동화 안내서

> [!CAUTION]
> **보안 경고 (CRITICAL WARNING)**:
> Firebase Admin SDK 인증을 위한 서비스 계정 키 파일(`*.json`)이나 비밀 환경 변수(`.env`)는 절대로 GitHub 저장소에 Commit하거나 Push하지 마십시오!
> 본 프로젝트의 `.gitignore`에는 이들을 방지하기 위한 가드가 적용되어 있습니다.

## 1. Firestore 게임 데이터 전체 초기화

본 작업은 Firebase Authentication 사용자를 유지한 채, 모든 사용자의 게임 진행 정보, 재화, 순위표를 완전히 초기화하는 일회성 작업입니다.

### 1단계: Dry Run (시뮬레이션)
Firestore에 저장된 삭제 예정 컬렉션 문서의 개수를 먼저 안전하게 확인합니다.
```bash
node scripts/reset-all-game-data.mjs
```

### 2단계: 실제 삭제 수행
확인 문자열 인자를 함께 전달하여 실제 삭제 처리를 작동시킵니다.
```bash
node scripts/reset-all-game-data.mjs --confirm RESET_NYANKO_GAME_DATA
```

---

## 2. 릴리스 자동화 및 배포 절차

버전 갱신, 캐시 무효화, 문법/테스트 검증, 그리고 로컬 롤백 가드가 적용된 릴리스 스크립트를 통해 안전한 배포를 자동화합니다.

### 1단계: release.cmd 실행
프로젝트 루트 디렉토리에서 `release.cmd`를 더블클릭하거나 터미널에서 실행합니다.
```cmd
.\release.cmd
```
*스크립트 내부 동작:*
1. Git 환경 및 브랜치를 확인합니다.
2. `version.json`, `app.js` (window.NYANKO_APP_INFO), `index.html`, `sw.js` 의 버전을 일괄 갱신합니다.
3. 4종의 단위/통합 테스트를 실행해 안전성을 자동 검증합니다. (실패 시 변경 사항을 완전히 롤백)
4. 테스트 성공 시 변경분을 `git add -A` 및 `release: v2.1.0 ...` 메시지로 커밋합니다.

### 2단계: Push origin
GitHub Desktop을 실행하여 방금 커밋된 내역을 확인한 후, **"Push origin"** 버튼을 클릭합니다.
Vercel에서 이를 감지하여 자동으로 무중단 배포를 완료하며, 로그인 화면 하단에 새 버전이 정상 노출됩니다.
