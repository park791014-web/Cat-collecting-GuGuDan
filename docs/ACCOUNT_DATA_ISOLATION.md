# 계정별 데이터 분리

- 인증 사용자: `nyanko:v2:user:{encodeURIComponent(userDocumentId)}:save`
- 게스트: `nyanko:v2:guest:{guestId}:save`
- 기존 공용 키: `gugudanV2Save` — 읽기 전용 legacy 원본으로 보존
- 1회 이전 소유자: `nyanko:v2:migration:legacy-owner`

인증 사용자 문서 ID는 표시 이름이 아니라 현재 로그인 시스템의 고유 문서 키다. 로그인 시 이전 계정 저장 후 새 컨텍스트를 선택하고, 로그아웃 시 메모리와 화면을 비우되 저장 데이터는 삭제하지 않는다. 게스트 ID는 인증 계정과 별도로 유지된다.
