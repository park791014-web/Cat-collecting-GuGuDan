const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.window = global;
global.GugudanV2 = {};
['js/services/adminValidationService.js', 'js/services/adminFirestoreService.js', 'js/services/adminBatchGrantService.js', 'js/ui/adminModeController.js'].forEach(file => {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
});

const validation = global.GugudanV2.adminValidationService;
const service = global.GugudanV2.adminFirestoreService;
const controller = global.GugudanV2.adminModeController;
const batchService = global.GugudanV2.adminBatchGrantService;
const adminAuth = { currentUser: { uid: validation.ADMIN_UID } };
const userAuth = { currentUser: { uid: 'not_an_admin_001' } };

assert.equal(controller.messageFor({ message: 'admin_forbidden' }), '관리자만 이용할 수 있습니다.');
assert.equal(controller.messageFor({ message: 'cat_grants_disabled' }), '고양이 지급은 현재 지원하지 않습니다.');
assert.match(controller.createActionId(), /^[A-Za-z0-9_-]{16,128}$/);
assert.equal(controller.formatKst(null), '처리 시간 기록 중');
const batch = batchService.createBatch([{ uid: 'target_user_001' }, { uid: 'target_user_002' }], { resourceType: 'coins', amount: 1, note: '' }, validation.validateActionId);
assert.equal(batch.batchId.length >= 16, true);
assert.notEqual(batch.entries.target_user_001.actionId, batch.entries.target_user_002.actionId);
let concurrent = 0, peak = 0, grants = 0;
(async () => {
  await batchService.run(batch, async request => { concurrent++; peak = Math.max(peak, concurrent); grants++; await new Promise(resolve => setTimeout(resolve, 1)); concurrent--; return { after: 1, before: 0, idempotentReplay: false }; }, {});
  assert.equal(grants, 2);
  assert.equal(peak <= 2, true);
  assert.equal(batch.status, 'completed');
  assert.equal(batchService.retryable(batch).length, 0);
})().catch(error => { throw error; });
assert.match(controller.formatKst(new Date('2026-08-04T00:00:00Z')), /26/);

const controllerSource = fs.readFileSync('js/ui/adminModeController.js', 'utf8');
assert.doesNotMatch(controllerSource, /data-mode=/);
assert.match(controllerSource, /data-admin-search/);
assert.match(controllerSource, /게임 닉네임, 로그인 ID 또는 UID 검색/);
assert.match(controllerSource, /searchAdminUsersExact\(query,state\.context\)/);
assert.match(controllerSource, /data-search-reset/);
assert.match(controllerSource, /normalTickets/);
assert.match(controllerSource, /premiumTickets/);
assert.doesNotMatch(controllerSource, /option value="cat"/);
assert.match(controllerSource, /crypto\.randomUUID/);
assert.match(controllerSource, /idempotentReplay/);
assert.match(controllerSource, /Escape/);
assert.match(controllerSource, /listRecentAdminActions\(20/);
assert.match(controllerSource, /grantAdminResource\(request,state\.context\)/);
assert.match(controllerSource, /전체 사용자/);
assert.match(controllerSource, /function visibleUsers\(\)/);
assert.match(controllerSource, /\[user\.nickname,user\.loginId,user\.uid\]/);
assert.match(controllerSource, /data-copy-uid/);
assert.match(controllerSource, /aria-label="UID 복사"/);
assert.match(controllerSource, /<th scope="col" class="admin-user-column-uid">UID<\/th>/);
assert.doesNotMatch(controllerSource, /<th>작업<\/th>/);
assert.match(controllerSource, /<colgroup>/);
assert.match(controllerSource, /admin-user-table__select/);
assert.match(controllerSource, /admin-user-uid-cell/);
assert.match(controllerSource, /admin-user-uid-value/);
assert.match(controllerSource, /fallback\.remove\(\)/);
assert.match(controllerSource, /ownedCatRarityCounts/);
assert.match(controllerSource, /전설/);
assert.match(controllerSource, /영웅/);
assert.match(controllerSource, /희귀/);
assert.match(controllerSource, /일반/);
assert.match(controllerSource, /admin-search-button/);
assert.match(controllerSource, /admin-grant-review-button/);
assert.match(controllerSource, /지급 전 확인/);

const renderedUserTable = controller.renderAdminUserTable([{
  uid: 'target_user_001', nickname: 'Long nickname', loginId: 'target01', level: 7,
  currency: { coins: 10, normalTickets: 2, premiumTickets: 3 }, ownedCatCount: 4,
  ownedCatRarityCounts: { legendary: 1, hero: 1, rare: 1, normal: 1 }
}]);
const colgroup = renderedUserTable.match(/<colgroup>([\s\S]*?)<\/colgroup>/)[1];
const headerRow = renderedUserTable.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/)[1];
const bodyRow = renderedUserTable.match(/<tbody><tr[^>]*>([\s\S]*?)<\/tr><\/tbody>/)[1];
assert.equal((colgroup.match(/<col /g) || []).length, 9);
assert.equal((headerRow.match(/<th(?:\s|>)/g) || []).length, 9);
assert.equal((bodyRow.match(/<td(?:\s|>)/g) || []).length, 9);
assert.match(headerRow, /<th scope="col" class="admin-user-column-uid">UID<\/th>/);
const uidHeader = headerRow.match(/<th scope="col" class="admin-user-column-uid">([\s\S]*?)<\/th>/)[1];
assert.equal(uidHeader, 'UID');
assert.doesNotMatch(uidHeader, /<input|<textarea|<button|<div|<span/);
assert.match(bodyRow, /<div class="admin-user-uid-cell">/);
assert.match(bodyRow, /<span class="admin-user-uid-value" title="target_user_001">target…_001<\/span>/);
assert.match(bodyRow, /aria-label="UID 복사"/);
assert.match(bodyRow, /admin-cat-count-cell/);
assert.match(bodyRow, /전설 1 · 영웅 1 · 희귀 1 · 일반 1/);
assert.match(controller.renderAdminUserTable([]), /colspan="9"/);
const adminCss = fs.readFileSync('css/style.css', 'utf8');
const desktopTableCss = adminCss.slice(adminCss.lastIndexOf('/* Phase 6.6C.5.2'));
assert.match(desktopTableCss, /@media\(min-width:768px\)/);
assert.match(desktopTableCss, /thead\{display:table-header-group\}/);
assert.match(desktopTableCss, /tbody\{display:table-row-group\}/);
assert.match(desktopTableCss, /tr\{display:table-row\}/);
assert.match(desktopTableCss, /th,\.admin-user-table td\{display:table-cell/);
['4%', '16%', '16%', '20%', '6%', '7%', '7%', '7%', '17%'].forEach(width => assert.match(desktopTableCss, new RegExp('width:' + width.replace('%', '\\%'))));
assert.match(desktopTableCss, /admin-user-uid-cell\{display:flex/);
assert.doesNotMatch(desktopTableCss, /margin-left:auto/);
assert.match(desktopTableCss, /admin-cat-count-cell\{display:flex;flex-direction:column;align-items:flex-start/);
assert.match(controllerSource, /function selectedUserSnapshot\(/);
assert.match(controllerSource, /batchService\(\)\.createBatch/);
assert.match(controllerSource, /batchService\(\)\.run\(batch,firestore\(\)\.grantAdminResource/);
assert.match(controllerSource, /일괄 지급을 확인할까요/);
assert.match(controllerSource, /일괄 지급 처리 중/);
assert.match(controllerSource, /일괄 지급 결과/);
assert.match(controllerSource, /확인 필요 사용자 다시 시도/);
assert.match(controllerSource, /retryUncertainEntries/);
assert.match(controllerSource, /entry\.status==='success'\|\|entry\.status==='replay'/);
assert.match(controllerSource, /entry\.after/);
assert.match(controllerSource, /loadHistory\(\);/);

let queryContract = null;
const db = {
  collection(name) {
    assert.equal(name, 'adminActions');
    return {
      orderBy(field, direction) {
        queryContract = { field, direction };
        return {
          limit(count) {
            queryContract.limit = count;
            return { get: async () => ({ docs: [{ id: 'a1', data: () => ({ actionId: 'a1', targetUid: 'target_user_001', type: 'coins', amount: 10, createdAt: null }) }] }) };
          }
        };
      }
    };
  }
};

(async () => {
  const history = await service.listRecentAdminActions(99, { auth: adminAuth, db });
  assert.deepEqual(queryContract, { field: 'createdAt', direction: 'desc', limit: 50 });
  assert.equal(history.length, 1);
  assert.equal(history[0].actionId, 'a1');
  assert.throws(() => service.listRecentAdminActions(20, { auth: userAuth, db }), /admin_forbidden/);
  const directoryDocs = [
    { id: 'user_a_001', data: () => ({ profile: { loginId: 'alpha', nickname: '알파' }, stats: { level: 3 }, currency: { coins: 5, normalTickets: 1, premiumTickets: 2 }, ownedCats: { cat_legend: { count: 3 }, cat_hero: { count: 1 }, cat_rare: { count: 1 }, cat_normal: { count: 1 }, cat_zero: { count: 0 }, unknown_cat: { count: 2 } } }) },
    { id: 'user_b_001', data: () => ({ profile: {}, stats: {}, currency: {}, ownedCats: null }) }
  ];
  let directoryQuery = { startAfter: null };
  const directoryDb = {
    collection(name) {
      assert.equal(name, 'users');
      return {
        orderBy(field) { assert.equal(field, '__name__'); return this; },
        limit(size) { directoryQuery.limit = size; return this; },
        startAfter(cursor) { directoryQuery.startAfter = cursor; return this; },
        get: async () => ({ docs: directoryDocs })
      };
    }
  };
  const catalog = [{ id: 'cat_legend', rarity: 'legendary' }, { id: 'cat_hero', rarity: 'hero' }, { id: 'cat_rare', rarity: 'rare' }, { id: 'cat_normal', rarity: 'normal' }, { id: 'cat_zero', rarity: 'normal' }];
  const directory = await service.listAdminUsersPage({ auth: adminAuth, db: directoryDb, firebase: { firestore: { FieldPath: { documentId: () => '__name__' } } }, catalog, pageSize: 99, cursor: 'previous-page' });
  assert.equal(directoryQuery.limit, 50);
  assert.equal(directoryQuery.startAfter, 'previous-page');
  assert.equal(directory.users.length, 2);
  assert.deepEqual(Object.keys(directory.users[0]).sort(), ['currency', 'level', 'loginId', 'nickname', 'ownedCatCount', 'ownedCatRarityCounts', 'uid']);
  assert.equal(directory.users[0].currency.coins, 5);
  assert.equal(directory.users[0].ownedCatCount, 4);
  assert.deepEqual(directory.users[0].ownedCatRarityCounts, { legendary: 1, hero: 1, rare: 1, normal: 1 });
  assert.deepEqual(directory.users[1].ownedCatRarityCounts, { legendary: 0, hero: 0, rare: 0, normal: 0 });
  assert.equal(directory.users[1].loginId, '');
  assert.throws(() => service.listAdminUsersPage({ auth: userAuth, db: directoryDb, firebase: { firestore: { FieldPath: { documentId: () => '__name__' } } } }), /admin_forbidden/);
  console.log('phase66 admin UI controller contract: passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
