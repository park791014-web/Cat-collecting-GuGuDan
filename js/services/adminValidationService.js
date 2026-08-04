(function (root, factory) {
  var service = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = service;
  if (root) {
    root.GugudanV2 = root.GugudanV2 || {};
    root.GugudanV2.adminValidationService = service;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var ADMIN_UID = 'xg6wYMihYRTsF60NCLf36XigPFB3';
  var CAT_GRANTS_ENABLED = false;
  var RESOURCE_LIMITS = Object.freeze({ coins: 100000, normalTickets: 100, premiumTickets: 100 });
  var GRANT_TYPES = Object.freeze(['coins', 'normalTickets', 'premiumTickets', 'cat']);
  var ACTION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
  var USER_ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
  var LOGIN_ID_PATTERN = /^[a-z0-9가-힣]{2,16}$/;

  function fail(code) { return { valid: false, code: code }; }
  function string(value) { return typeof value === 'string'; }
  function isPlainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

  function normalizeLoginId(value) {
    return String(value || '').normalize('NFKC').trim().toLowerCase();
  }

  function isCurrentUserAdmin(auth) {
    return Boolean(auth && auth.currentUser && auth.currentUser.uid === ADMIN_UID);
  }

  function assertCurrentUserAdmin(auth) {
    if (!auth || !auth.currentUser) throw new Error('admin_auth_required');
    if (auth.currentUser.uid !== ADMIN_UID) throw new Error('admin_forbidden');
    return auth.currentUser;
  }

  function validateActionId(actionId) {
    return string(actionId) && ACTION_ID_PATTERN.test(actionId) ? { valid: true, value: actionId } : fail('invalid_action_id');
  }

  function validateSearchRequest(request) {
    var input = request || {};
    if (input.searchType !== 'uid' && input.searchType !== 'loginId') return fail('invalid_search_type');
    if (!string(input.query)) return fail('invalid_search_query');
    var query = input.searchType === 'loginId' ? normalizeLoginId(input.query) : input.query.trim();
    if (!query) return fail('empty_search_query');
    if (input.searchType === 'uid' && !USER_ID_PATTERN.test(query)) return fail('invalid_uid');
    if (input.searchType === 'loginId' && !LOGIN_ID_PATTERN.test(query)) return fail('invalid_login_id');
    return { valid: true, searchType: input.searchType, query: query };
  }

  function catalogById(catalog) {
    var result = {};
    (catalog || []).forEach(function (cat) {
      if (cat && string(cat.id)) result[cat.id] = cat;
    });
    return result;
  }

  function validateGrantRequest(request, catalog) {
    var input = request || {};
    var action = validateActionId(input.actionId);
    if (!action.valid) return action;
    if (!string(input.targetUid) || !USER_ID_PATTERN.test(input.targetUid)) return fail('invalid_target_uid');
    if (GRANT_TYPES.indexOf(input.grantType) < 0) return fail('invalid_grant_type');
    var note = input.note == null ? '' : input.note;
    if (!string(note) || note.trim().length > 100) return fail('invalid_note');
    if (input.grantType === 'cat') {
      if (!CAT_GRANTS_ENABLED) return fail('cat_grants_disabled');
      if (!string(input.catId) || !catalogById(catalog)[input.catId]) return fail('invalid_cat_id');
      if (input.amount !== null && input.amount !== undefined && input.amount !== '') return fail('cat_amount_not_allowed');
      return { valid: true, actionId: action.value, targetUid: input.targetUid, grantType: input.grantType, amount: null, catId: input.catId, note: note.trim() };
    }
    if (input.catId !== null && input.catId !== undefined && input.catId !== '') return fail('resource_cat_not_allowed');
    if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > RESOURCE_LIMITS[input.grantType]) return fail('invalid_amount');
    return { valid: true, actionId: action.value, targetUid: input.targetUid, grantType: input.grantType, amount: input.amount, catId: null, note: note.trim() };
  }

  function sameActionPayload(existing, proposed) {
    return Boolean(existing) && existing.adminUid === ADMIN_UID && existing.targetUid === proposed.targetUid && existing.type === proposed.grantType &&
      (proposed.grantType === 'cat' ? existing.catId === proposed.catId : existing.amount === proposed.amount && existing.catId == null);
  }

  function summarizeUser(uid, data) {
    var profile = (data && data.profile) || {};
    var currency = (data && data.currency) || {};
    var stats = (data && data.stats) || {};
    return {
      uid: uid,
      loginId: string(profile.loginId) ? profile.loginId : '',
      nickname: string(profile.nickname) ? profile.nickname : '',
      level: Number.isInteger(stats.level) ? stats.level : 0,
      coins: Number.isInteger(currency.coins) ? currency.coins : 0,
      normalTickets: Number.isInteger(currency.normalTickets) ? currency.normalTickets : 0,
      premiumTickets: Number.isInteger(currency.premiumTickets) ? currency.premiumTickets : 0,
      ownedCatCount: Object.keys((data && data.ownedCats) || {}).length
    };
  }

  return {
    ADMIN_UID: ADMIN_UID,
    CAT_GRANTS_ENABLED: CAT_GRANTS_ENABLED,
    RESOURCE_LIMITS: RESOURCE_LIMITS,
    GRANT_TYPES: GRANT_TYPES,
    normalizeLoginId: normalizeLoginId,
    isPlainObject: isPlainObject,
    isCurrentUserAdmin: isCurrentUserAdmin,
    assertCurrentUserAdmin: assertCurrentUserAdmin,
    validateActionId: validateActionId,
    validateSearchRequest: validateSearchRequest,
    validateGrantRequest: validateGrantRequest,
    sameActionPayload: sameActionPayload,
    summarizeUser: summarizeUser
  };
});
