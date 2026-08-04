(function (root, factory) {
  var service = factory(root && root.GugudanV2 && root.GugudanV2.adminValidationService);
  if (typeof module !== 'undefined' && module.exports) module.exports = service;
  if (root) {
    root.GugudanV2 = root.GugudanV2 || {};
    root.GugudanV2.adminFirestoreService = service;
  }
})(typeof window !== 'undefined' ? window : null, function (validation) {
  'use strict';

  function requireDependency(value, code) { if (!value) throw new Error(code); return value; }
  function clone(value) { return Object.assign({}, value || {}); }
  function catalogFrom(options) { var runtime=(typeof window !== 'undefined' && window.GugudanV2)||{};return options.catalog || runtime.allCats || [].concat(runtime.baseCats||[],runtime.seasonCats||[]); }
  function refs(db, targetUid, actionId) { return { userRef: db.collection('users').doc(targetUid), actionRef: db.collection('adminActions').doc(actionId) }; }
  function timestamp(firebaseSdk) { return firebaseSdk.firestore.FieldValue.serverTimestamp(); }

  function searchAdminUser(request, options) {
    options = options || {};
    var auth = requireDependency(options.auth, 'admin_auth_unavailable');
    var db = requireDependency(options.db, 'admin_firestore_unavailable');
    validation.assertCurrentUserAdmin(auth);
    var input = validation.validateSearchRequest(request);
    if (!input.valid) throw new Error(input.code);
    if (input.searchType === 'uid') {
      return db.collection('users').doc(input.query).get().then(function (snapshot) {
        return snapshot.exists ? directoryUserSummary(snapshot, catalogFrom(options)) : null;
      });
    }
    return db.collection('users').where('profile.loginId', '==', input.query).limit(2).get().then(function (snapshot) {
      if (snapshot.empty) return null;
      if (snapshot.size !== 1) throw new Error('duplicate_login_id');
      var doc = snapshot.docs[0];
      return directoryUserSummary(doc, catalogFrom(options));
    });
  }

  function grantAdminResource(request, options) {
    options = options || {};
    var auth = requireDependency(options.auth, 'admin_auth_unavailable');
    var db = requireDependency(options.db, 'admin_firestore_unavailable');
    var firebaseSdk = requireDependency(options.firebase, 'admin_firebase_unavailable');
    var current = validation.assertCurrentUserAdmin(auth);
    var input = validation.validateGrantRequest(request, catalogFrom(options));
    if (!input.valid) return Promise.reject(new Error(input.code));
    var paths = refs(db, input.targetUid, input.actionId);

    return db.runTransaction(function (transaction) {
      return Promise.all([transaction.get(paths.actionRef), transaction.get(paths.userRef)]).then(function (snapshots) {
        var actionSnapshot = snapshots[0];
        var userSnapshot = snapshots[1];
        if (actionSnapshot.exists) {
          var existing = actionSnapshot.data();
          if (!validation.sameActionPayload(existing, input)) throw new Error('action_id_conflict');
          return { actionId: input.actionId, targetUid: input.targetUid, type: input.grantType, amount: existing.amount == null ? null : existing.amount, before: existing.before || null, after: existing.after || null, idempotentReplay: true };
        }
        if (!userSnapshot.exists) throw new Error('target_user_not_found');
        var userData = userSnapshot.data() || {};
        var profile = userData.profile || {};
        var change;
        var audit;
        if (input.grantType === 'cat') {
          var ownedCats = clone(userData.ownedCats);
          if (ownedCats[input.catId]) throw new Error('cat_already_owned');
          var cat = catalogFrom(options).filter(function (item) { return item.id === input.catId; })[0];
          ownedCats[input.catId] = { count: 1, acquiredAt: timestamp(firebaseSdk) };
          change = { ownedCats: ownedCats, updatedAt: timestamp(firebaseSdk) };
          audit = { before: null, after: 1, catId: input.catId, catName: cat.displayName, amount: null };
        } else {
          var currency = clone(userData.currency);
          var before = currency[input.grantType];
          if (!Number.isInteger(before) || before < 0) throw new Error('invalid_existing_currency');
          currency[input.grantType] = before + input.amount;
          change = { currency: currency, updatedAt: timestamp(firebaseSdk) };
          audit = { before: before, after: currency[input.grantType], catId: null, catName: null, amount: input.amount };
        }
        transaction.update(paths.userRef, change);
        transaction.set(paths.actionRef, {
          actionId: input.actionId,
          adminUid: current.uid,
          targetUid: input.targetUid,
          targetLoginId: typeof profile.loginId === 'string' ? profile.loginId : '',
          targetNickname: typeof profile.nickname === 'string' ? profile.nickname : '',
          type: input.grantType,
          amount: audit.amount,
          catId: audit.catId,
          catName: audit.catName,
          note: input.note,
          before: audit.before,
          after: audit.after,
          status: 'applied',
          createdAt: timestamp(firebaseSdk),
          appVersion: options.appVersion || 'V.3.4.0'
        });
        return { actionId: input.actionId, targetUid: input.targetUid, type: input.grantType, amount: audit.amount, before: audit.before, after: audit.after, idempotentReplay: false };
      });
    });
  }

  function actionSummary(snapshot) {
    var value = snapshot.data ? snapshot.data() : snapshot;
    value = value || {};
    return {
      actionId: value.actionId || snapshot.id || '',
      targetUid: value.targetUid || '',
      targetLoginId: value.targetLoginId || '',
      targetNickname: value.targetNickname || '',
      type: value.type || '',
      amount: Number.isInteger(value.amount) ? value.amount : null,
      before: Number.isInteger(value.before) ? value.before : null,
      after: Number.isInteger(value.after) ? value.after : null,
      note: typeof value.note === 'string' ? value.note : '',
      status: value.status || '',
      createdAt: value.createdAt || null
    };
  }

  function ownedCatSummary(ownedCats, catalog) {
    var rarityCounts = { legendary: 0, hero: 0, rare: 0, normal: 0 };
    var catalogById = {};
    (catalog || []).forEach(function (cat) { if (cat && typeof cat.id === 'string') catalogById[cat.id] = cat; });
    if (!ownedCats || typeof ownedCats !== 'object' || Array.isArray(ownedCats)) return { ownedCatCount: 0, ownedCatRarityCounts: rarityCounts };
    Object.keys(ownedCats).forEach(function (catId) {
      var owned = ownedCats[catId];
      if (!owned || !Number.isFinite(Number(owned.count)) || Number(owned.count) < 1) return;
      var cat = catalogById[catId];
      if (!cat || !Object.prototype.hasOwnProperty.call(rarityCounts, cat.rarity)) return;
      rarityCounts[cat.rarity] += 1;
    });
    return { ownedCatCount: rarityCounts.legendary + rarityCounts.hero + rarityCounts.rare + rarityCounts.normal, ownedCatRarityCounts: rarityCounts };
  }

  function directoryUserSummary(snapshot, catalog) {
    var summary = validation.summarizeUser(snapshot.id, snapshot.data());
    var cats = ownedCatSummary((snapshot.data() || {}).ownedCats, catalog);
    return {
      uid: summary.uid,
      loginId: summary.loginId,
      nickname: summary.nickname,
      level: summary.level,
      currency: { coins: summary.coins, normalTickets: summary.normalTickets, premiumTickets: summary.premiumTickets },
      ownedCatCount: cats.ownedCatCount,
      ownedCatRarityCounts: cats.ownedCatRarityCounts
    };
  }

  function listAdminUsersPage(options) {
    options = options || {};
    var auth = requireDependency(options.auth, 'admin_auth_unavailable');
    var db = requireDependency(options.db, 'admin_firestore_unavailable');
    var firebaseSdk = requireDependency(options.firebase, 'admin_firebase_unavailable');
    validation.assertCurrentUserAdmin(auth);
    var pageSize = Math.max(1, Math.min(50, Number.isInteger(options.pageSize) ? options.pageSize : 30));
    var query = db.collection('users').orderBy(firebaseSdk.firestore.FieldPath.documentId()).limit(pageSize);
    if (options.cursor) query = query.startAfter(options.cursor);
    return query.get().then(function (snapshot) {
      var docs = snapshot.docs || [];
      return { users: docs.map(function (doc) { return directoryUserSummary(doc, catalogFrom(options)); }), cursor: docs.length ? docs[docs.length - 1] : null, hasMore: docs.length === pageSize };
    });
  }

  function searchAdminUsersExact(query, options) {
    options = options || {};
    var auth = requireDependency(options.auth, 'admin_auth_unavailable');
    var db = requireDependency(options.db, 'admin_firestore_unavailable');
    validation.assertCurrentUserAdmin(auth);
    var value = String(query || '').trim();
    if (!value) return Promise.resolve([]);
    var lower = validation.normalizeLoginId(value);
    var uidRead = validation.validateSearchRequest({ searchType: 'uid', query: value }).valid ? db.collection('users').doc(value).get() : Promise.resolve(null);
    return Promise.all([
      uidRead,
      db.collection('users').where('profile.loginId', '==', lower).limit(2).get(),
      db.collection('users').where('profile.nickname', '==', value).limit(30).get()
    ]).then(function (results) {
      var unique = {};
      var docs = [];
      if (results[0] && results[0].exists) docs.push(results[0]);
      [results[1], results[2]].forEach(function (snapshot) { (snapshot.docs || []).forEach(function (doc) { docs.push(doc); }); });
      return docs.filter(function (doc) { if (unique[doc.id]) return false; unique[doc.id] = true; return true; }).map(function (doc) { return directoryUserSummary(doc, catalogFrom(options)); });
    });
  }

  function listRecentAdminActions(limit, options) {
    options = options || {};
    var auth = requireDependency(options.auth, 'admin_auth_unavailable');
    var db = requireDependency(options.db, 'admin_firestore_unavailable');
    validation.assertCurrentUserAdmin(auth);
    var safeLimit = Math.max(1, Math.min(50, Number.isInteger(limit) ? limit : 20));
    return db.collection('adminActions').orderBy('createdAt', 'desc').limit(safeLimit).get().then(function (snapshot) {
      return (snapshot.docs || []).map(actionSummary);
    });
  }

  return { searchAdminUser: searchAdminUser, searchAdminUsersExact: searchAdminUsersExact, grantAdminResource: grantAdminResource, listRecentAdminActions: listRecentAdminActions, listAdminUsersPage: listAdminUsersPage };
});
