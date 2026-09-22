(function (global) {
  'use strict';
  var v2 = global.GugudanV2, opening = false, rarities = ['normal', 'rare', 'hero', 'legendary'];

  function validateCardPackRates(pack) {
    var errors = [], sum = 0;
    rarities.forEach(function (rarity) { var value = pack && pack.rarityRates && Number(pack.rarityRates[rarity]); if (!Number.isFinite(value) || value < 0) errors.push(rarity); else sum += value; });
    if (Math.abs(sum - 1) > .000001 && Math.abs(sum - 100) > .000001) errors.push('probability_sum');
    if (!pack || !Number.isInteger(pack.ticketCost) || pack.ticketCost < 1) errors.push('ticketCost');
    return { valid: !errors.length, errors: errors, sum: sum };
  }
  function validateCardPackConfig() { var results = {}; ['normalPack', 'premiumPack'].forEach(function (key) { results[key] = validateCardPackRates(v2.cardPackConfig[key]); }); return { valid: results.normalPack.valid && results.premiumPack.valid, results: results }; }
  function selectRarity(rates, randomValue) { var value = randomValue == null ? Math.random() : Math.max(0, Math.min(.999999, randomValue)), sum = 0; for (var i = 0; i < rarities.length; i += 1) { sum += Number(rates[rarities[i]]) || 0; if (value < sum) return rarities[i]; } return 'legendary'; }
  function activePremiumPickupSeason() {
    var id = v2.seasonConfig && v2.seasonConfig.activePremiumPickupSeasonId;
    var season = (v2.seasons || []).find(function (item) { return item.id === id && item.enabled !== false; });
    if (!season) return null;
    if (v2.seasonService && typeof v2.seasonService.getSeasonStatus === 'function') {
      return v2.seasonService.getSeasonStatus(season).status === 'active' ? season : null;
    }
    var now = Date.now(), start = new Date(season.startAt).getTime(), end = new Date(season.endAt).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end ? season : null;
  }
  function candidates(rarity) { return (v2.baseCats || []).filter(function (cat) { return cat.collection === 'base' && cat.available !== false && cat.obtainable !== false && cat.rarity === rarity; }); }
  function premiumCandidates(rarity) {
    var base = candidates(rarity), season = activePremiumPickupSeason();
    if (!season) return base.map(function (cat) { return { cat: cat, weight: 1 }; });
    return base.map(function (cat) { return { cat: cat, weight: 1 }; }).concat((v2.seasonCats || []).filter(function (cat) { return cat.seasonId === season.id && cat.available !== false && cat.obtainable !== false && cat.rarity === rarity; }).map(function (cat) { return { cat: cat, weight: 2 }; }));
  }
  function selectWeightedCat(entries, randomValue) {
    var candidates = (entries || []).filter(function (entry) { return entry && entry.cat && Number(entry.weight) > 0; }), total = candidates.reduce(function (sum, entry) { return sum + Number(entry.weight); }, 0);
    if (!total) return null;
    var target = (randomValue == null ? Math.random() : Math.max(0, Math.min(.999999, randomValue))) * total;
    for (var i = 0, sum = 0; i < candidates.length; i += 1) { sum += Number(candidates[i].weight); if (target < sum) return candidates[i].cat; }
    return candidates[candidates.length - 1].cat;
  }
  function getPremiumPickup() { var season = activePremiumPickupSeason(); return { season: season, active: Boolean(season), title: season ? season.name + ' 뽑기' : '고급 티켓 뽑기', subtitle: season ? season.breed.displayName : '', candidates: premiumCandidates }; }
  function planOpen(packId, randomRarity, randomCat) {
    var pack = v2.cardPackConfig[packId], valid = validateCardPackRates(pack); if (!valid.valid) return { ok: false, reason: 'invalid_config' };
    var save = v2.storageService.loadSaveData(); if (save.currency[pack.ticketType] < pack.ticketCost) return { ok: false, reason: 'insufficient_ticket' };
    var rarity = selectRarity(pack.rarityRates, randomRarity), cat = packId === 'premiumPack' ? selectWeightedCat(premiumCandidates(rarity), randomCat) : (function () { var pool = candidates(rarity); return pool[Math.floor((randomCat == null ? Math.random() : Math.max(0, Math.min(.999999, randomCat))) * pool.length)]; })();
    if (!cat) return { ok: false, reason: 'empty_pool' };
    var duplicate = save.collection.ownedCatIds.indexOf(cat.id) >= 0, fragments = duplicate ? v2.cardPackConfig.duplicateFragments[rarity] : 0;
    return { ok: true, save: save, pack: pack, cat: cat, rarity: rarity, duplicate: duplicate, fragments: fragments };
  }
  function openPack(packId, randomRarity, randomCat) {
    if (opening) return { ok: false, reason: 'busy' }; opening = true;
    try { var plan = planOpen(packId, randomRarity, randomCat); if (!plan.ok) return plan; var save = plan.save, cat = plan.cat; save.currency[plan.pack.ticketType] -= plan.pack.ticketCost; if (plan.duplicate) { save.collection.duplicateCounts[cat.id] = (save.collection.duplicateCounts[cat.id] || 0) + 1; save.collection.catFragments[cat.rarity] += plan.fragments; save.collection.catProgress[cat.id] = save.collection.catProgress[cat.id] || { obtainedAt: null, duplicateCount: 0, cosmeticsUnlocked: [] }; save.collection.catProgress[cat.id].duplicateCount = save.collection.duplicateCounts[cat.id]; } else { save.collection.ownedCatIds.push(cat.id); save.collection.catProgress[cat.id] = { obtainedAt: new Date().toISOString(), duplicateCount: 0, cosmeticsUnlocked: [] }; } if (!v2.storageService.saveSaveData(save)) return { ok: false, reason: 'save_failed' }; return { ok: true, cat: cat, rarity: plan.rarity, duplicate: plan.duplicate, fragments: plan.fragments, currency: save.currency, totalFragments: save.collection.catFragments[cat.rarity] }; } catch (error) { console.error('[Card pack error]', error); return { ok: false, reason: 'unexpected', error: error }; } finally { opening = false; }
  }
  function grantCat(catId) { var cat = (v2.baseCats || []).find(function (item) { return item.id === catId && item.collection === 'base'; }); if (!cat) return false; var save = v2.storageService.loadSaveData(); if (save.collection.ownedCatIds.indexOf(catId) < 0) save.collection.ownedCatIds.push(catId); save.collection.catProgress[catId] = save.collection.catProgress[catId] || { obtainedAt: new Date().toISOString(), duplicateCount: 0, cosmeticsUnlocked: [] }; return v2.storageService.saveSaveData(save); }
  v2.cardPackService = { validateCardPackRates: validateCardPackRates, validateCardPackConfig: validateCardPackConfig, selectRarity: selectRarity, getCandidates: candidates, getPremiumCandidates: premiumCandidates, selectWeightedCat: selectWeightedCat, getPremiumPickup: getPremiumPickup, planOpen: planOpen, openPack: openPack, grantCat: grantCat, isOpening: function () { return opening; } };
})(window);
