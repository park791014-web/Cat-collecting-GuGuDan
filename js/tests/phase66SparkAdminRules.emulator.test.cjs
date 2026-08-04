/* Firestore Emulator only. Never uses production credentials or project data. */
const fs = require('fs');
const assert = require('assert');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, collection, query, where, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp } = require('firebase/firestore');

const PROJECT_ID = 'demo-cat-gugudan-admin';
const ADMIN_UID = 'xg6wYMihYRTsF60NCLf36XigPFB3';
const NORMAL_UID = 'normal-user-test-uid';
const TARGET_UID = 'target-user-test-uid';
let currentPhase = 'bootstrap';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.log(JSON.stringify({ skipped: true, reason: 'FIRESTORE_EMULATOR_HOST is not configured; refusing any non-Emulator target' }));
  process.exit(0);
}

const baseUser = () => ({
  profile: { loginId: 'teststudent', nickname: '테스트학생', representativeCatId: 'base_normal_01' },
  currency: { coins: 100, normalTickets: 2, premiumTickets: 1, seasonTickets: 0 },
  ownedCats: {},
  stats: { level: 1, totalPoints: 0 },
  adventure: {},
  dailyMissions: {},
  rewardState: {},
  updatedAt: new Date()
});

function actionPayload(actionId, overrides) {
  return Object.assign({
    actionId,
    adminUid: ADMIN_UID,
    targetUid: TARGET_UID,
    targetLoginId: 'teststudent',
    targetNickname: '테스트학생',
    type: 'coins',
    amount: 1,
    catId: null,
    catName: null,
    note: 'emulator test',
    before: 100,
    after: 101,
    status: 'applied',
    createdAt: serverTimestamp(),
    appVersion: 'V.3.4.0'
  }, overrides || {});
}

(async () => {
  const [host, portText] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host, port: Number(portText), rules: fs.readFileSync('firestore.rules', 'utf8') }
  });
  const admin = () => testEnv.authenticatedContext(ADMIN_UID).firestore();
  const normal = () => testEnv.authenticatedContext(NORMAL_UID).firestore();
  const unauthenticated = () => testEnv.unauthenticatedContext().firestore();
  const targetRef = database => doc(database, 'users', TARGET_UID);
  const adminActionRef = (database, actionId) => doc(database, 'adminActions', actionId);
  const reset = async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users', TARGET_UID), baseUser());
      await setDoc(doc(context.firestore(), 'users', NORMAL_UID), Object.assign(baseUser(), { profile: { loginId: 'normaluser', nickname: '일반사용자', representativeCatId: 'base_normal_01' } }));
    });
  };

  try {
    await reset();
    currentPhase = 'read access';
    await assertFails(getDoc(targetRef(unauthenticated())));
    await assertFails(getDocs(collection(unauthenticated(), 'users')));

    await assertSucceeds(getDoc(targetRef(admin())));
    await assertSucceeds(getDocs(query(collection(admin(), 'users'), where('profile.loginId', '==', 'teststudent'))));
    await assertSucceeds(getDocs(collection(admin(), 'users')));
    await assertSucceeds(getDoc(doc(normal(), 'users', NORMAL_UID)));
    await assertFails(getDoc(targetRef(normal())));
    await assertFails(getDocs(query(collection(normal(), 'users'), where('profile.loginId', '==', 'teststudent'))));

    currentPhase = 'currency grants';
    const currencyCase = async (name, changes, shouldPass) => {
      currentPhase = 'currency grants: ' + name;
      await reset();
      const result = updateDoc(targetRef(admin()), changes);
      return shouldPass ? assertSucceeds(result) : assertFails(result);
    };
    await currencyCase('coins +1', { currency: { coins: 101, normalTickets: 2, premiumTickets: 1, seasonTickets: 0 }, updatedAt: serverTimestamp() }, true);
    await currencyCase('coins +100000', { currency: { coins: 100100, normalTickets: 2, premiumTickets: 1, seasonTickets: 0 }, updatedAt: serverTimestamp() }, true);
    await currencyCase('coins decrease', { currency: { coins: 99, normalTickets: 2, premiumTickets: 1, seasonTickets: 0 }, updatedAt: serverTimestamp() }, false);
    await currencyCase('coins zero', { currency: { coins: 100, normalTickets: 2, premiumTickets: 1, seasonTickets: 0 }, updatedAt: serverTimestamp() }, false);
    await currencyCase('coins decimal', { currency: { coins: 100.5, normalTickets: 2, premiumTickets: 1, seasonTickets: 0 }, updatedAt: serverTimestamp() }, false);
    await currencyCase('coins over cap', { currency: { coins: 100101, normalTickets: 2, premiumTickets: 1, seasonTickets: 0 }, updatedAt: serverTimestamp() }, false);
    await currencyCase('normal +100', { currency: { coins: 100, normalTickets: 102, premiumTickets: 1, seasonTickets: 0 }, updatedAt: serverTimestamp() }, true);
    await currencyCase('premium +100', { currency: { coins: 100, normalTickets: 2, premiumTickets: 101, seasonTickets: 0 }, updatedAt: serverTimestamp() }, true);
    await currencyCase('multiple fields', { currency: { coins: 100, normalTickets: 102, premiumTickets: 101, seasonTickets: 0 }, updatedAt: serverTimestamp() }, false);
    await currencyCase('season tickets', { currency: { coins: 100, normalTickets: 2, premiumTickets: 1, seasonTickets: 1 }, updatedAt: serverTimestamp() }, false);
    await currencyCase('profile', { profile: { loginId: 'teststudent', nickname: '변경금지', representativeCatId: 'base_normal_01' } }, false);
    await currencyCase('stats', { stats: { level: 2, totalPoints: 0 } }, false);
    await assertFails(setDoc(doc(admin(), 'users', 'new-user-test-uid'), baseUser()));
    await assertFails(deleteDoc(targetRef(admin())));

    currentPhase = 'cat grants disabled';
    const catCase = async (ownedCats, extra, shouldPass) => {
      await reset();
      const change = Object.assign({ ownedCats, updatedAt: serverTimestamp() }, extra || {});
      const result = updateDoc(targetRef(admin()), change);
      return shouldPass ? assertSucceeds(result) : assertFails(result);
    };
    await catCase({ base_rare_01: { count: 1, acquiredAt: serverTimestamp() } }, null, false);
    await catCase({ not_in_catalog: { count: 1, acquiredAt: serverTimestamp() } }, null, false);
    await catCase({ base_rare_01: { count: 2, acquiredAt: serverTimestamp() } }, null, false);
    await catCase({ base_rare_01: { count: 1 } }, null, false);
    await catCase({ base_rare_01: { count: 1, acquiredAt: 'not-a-timestamp' } }, null, false);
    await catCase({ base_rare_01: { count: 1, acquiredAt: serverTimestamp() }, base_rare_02: { count: 1, acquiredAt: serverTimestamp() } }, null, false);
    currentPhase = 'cat mutation rejection';
    await reset();
    await testEnv.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'users', TARGET_UID), { ownedCats: { base_rare_01: { count: 1, acquiredAt: new Date() } } });
    });
    await assertFails(updateDoc(targetRef(admin()), { ownedCats: { base_rare_01: { count: 2, acquiredAt: new Date() } }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(targetRef(admin()), { ownedCats: {}, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(targetRef(admin()), { ownedCats: { base_rare_01: { count: 1, acquiredAt: new Date() }, base_rare_02: { count: 1, acquiredAt: serverTimestamp() } }, updatedAt: serverTimestamp() }));
    await catCase({ base_rare_01: { count: 1, acquiredAt: serverTimestamp() } }, { profile: { loginId: 'teststudent', nickname: '변경금지', representativeCatId: 'base_normal_01' } }, false);

    currentPhase = 'admin actions';
    await reset();
    const actionId = 'e31a539b-31d1-4aec-b0d6-4c905efd1101';
    await assertSucceeds(setDoc(adminActionRef(admin(), actionId), actionPayload(actionId)));
    await assertSucceeds(getDoc(adminActionRef(admin(), actionId)));
    await assertFails(getDoc(adminActionRef(normal(), actionId)));
    await assertFails(setDoc(adminActionRef(normal(), 'e31a539b-31d1-4aec-b0d6-4c905efd1102'), actionPayload('e31a539b-31d1-4aec-b0d6-4c905efd1102', { adminUid: NORMAL_UID })));
    await assertFails(updateDoc(adminActionRef(admin(), actionId), { note: 'immutable' }));
    await assertFails(deleteDoc(adminActionRef(admin(), actionId)));
    const badAction = async (id, payload) => { await assertFails(setDoc(adminActionRef(admin(), id), payload)); };
    await badAction('e31a539b-31d1-4aec-b0d6-4c905efd1103', actionPayload('different-action-id'));
    await badAction('e31a539b-31d1-4aec-b0d6-4c905efd1104', actionPayload('e31a539b-31d1-4aec-b0d6-4c905efd1104', { type: 'seasonTickets' }));
    await badAction('e31a539b-31d1-4aec-b0d6-4c905efd1105', actionPayload('e31a539b-31d1-4aec-b0d6-4c905efd1105', { amount: 100001 }));
    await badAction('e31a539b-31d1-4aec-b0d6-4c905efd1106', actionPayload('e31a539b-31d1-4aec-b0d6-4c905efd1106', { status: 'pending' }));
    await badAction('e31a539b-31d1-4aec-b0d6-4c905efd1107', actionPayload('e31a539b-31d1-4aec-b0d6-4c905efd1107', { adminUid: NORMAL_UID }));
    await badAction('e31a539b-31d1-4aec-b0d6-4c905efd1108', actionPayload('e31a539b-31d1-4aec-b0d6-4c905efd1108', { createdAt: new Date() }));
    await badAction('e31a539b-31d1-4aec-b0d6-4c905efd1109', Object.assign(actionPayload('e31a539b-31d1-4aec-b0d6-4c905efd1109'), { unexpected: true }));

    currentPhase = 'existing user regression';
    await reset();
    await assertSucceeds(updateDoc(doc(normal(), 'users', NORMAL_UID), { stats: { level: 2, totalPoints: 10 } }));
    await assertSucceeds(updateDoc(doc(normal(), 'users', NORMAL_UID), { currency: { coins: 110, normalTickets: 2, premiumTickets: 1, seasonTickets: 0 }, ownedCats: { base_rare_01: { count: 1, acquiredAt: serverTimestamp() } }, dailyMissions: { dateKey: '2026-08-04', missions: {} } }));
    await assertSucceeds(setDoc(doc(normal(), 'processedGameSessions', NORMAL_UID + '_session_001'), { sessionId: 'session_001' }));
    await assertFails(setDoc(doc(normal(), 'processedGameSessions', TARGET_UID + '_session_001'), { sessionId: 'session_001' }));

    console.log(JSON.stringify({
      passed: true,
      projectId: PROJECT_ID,
      cases: ['unauthenticated_denied', 'admin_get_and_login_id_query', 'ordinary_user_isolation', 'currency_grant_boundaries', 'currency_extra_field_denied', 'cat_grants_explicitly_denied', 'admin_actions_immutable_schema', 'existing_owner_game_gacha_mission_updates', 'processed_sessions']
    }));
  } finally {
    await testEnv.cleanup();
  }
})().catch(error => { console.error('Failed phase:', currentPhase); console.error(error); process.exitCode = 1; });
