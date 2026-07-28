(function (root, factory) {
  var service = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = service;
  if (root) {
    root.GugudanV2 = root.GugudanV2 || {};
    root.GugudanV2.gachaPersistenceService = service;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function cloneMap(value) {
    return Object.assign({}, value || {});
  }

  function buildMutation(rawUserData, options) {
    var raw = rawUserData || {};
    var currency = cloneMap(raw.currency);
    var ownedCats = cloneMap(raw.ownedCats);
    var currencyKey = options.currencyKey;
    var cost = Number(options.cost) || 0;
    var catId = options.catId;
    var beforeValue = Number(currency[currencyKey]);

    if (!Number.isFinite(beforeValue)) throw new Error('gacha_v3_currency_missing');
    if (beforeValue < cost) {
      throw new Error(currencyKey === 'coins' ? 'insufficient_coins' : 'insufficient_ticket');
    }

    currency[currencyKey] = beforeValue - cost;
    var previous = ownedCats[catId];
    var previousCount = previous ? Number(previous.count) || 0 : 0;
    ownedCats[catId] = previous
      ? Object.assign({}, previous, { count: previousCount + 1 })
      : { count: 1, acquiredAt: options.acquiredAt };

    return {
      currency: currency,
      ownedCats: ownedCats,
      currencyKey: currencyKey,
      expectedCurrencyValue: beforeValue - cost,
      previousCount: previousCount,
      expectedCount: previousCount + 1,
      duplicate: Boolean(previous)
    };
  }

  function verifyServerResult(verified, expected) {
    var currency = verified && verified.currency;
    var ownedCats = verified && verified.ownedCats;
    var entry = ownedCats && ownedCats[expected.catId];
    return Boolean(
      currency &&
      Number(currency[expected.currencyKey]) === expected.expectedCurrencyValue &&
      entry &&
      Number(entry.count) >= expected.expectedCount
    );
  }

  return {
    buildMutation: buildMutation,
    verifyServerResult: verifyServerResult
  };
});
