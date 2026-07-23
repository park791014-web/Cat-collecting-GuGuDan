(function (global) {
  'use strict';
  var v2 = global.GugudanV2, validators = v2.validators = v2.validators || {};
  function validateReleaseState() {
    var errors = [], save = v2.storageService.loadSaveData();
    if (v2.APP_VERSION !== '2.0.0') errors.push('app_version');
    if (!v2.CONTENT_VERSION) errors.push('content_version');
    if (save.schemaVersion !== 7) errors.push('schema_version');
    if (save.appVersion !== v2.APP_VERSION || save.contentVersion !== v2.CONTENT_VERSION) errors.push('saved_versions');
    return { valid: !errors.length, errors: errors };
  }
  function validateSeasonCatData() {
    var errors = [], ids = new Set(), counts = { normal:0, rare:0, hero:0, legendary:0 };
    (v2.seasonCats || []).forEach(function (cat) { if (ids.has(cat.id)) errors.push('duplicate:' + cat.id); ids.add(cat.id); if (!counts.hasOwnProperty(cat.rarity)) errors.push('rarity:' + cat.id); else counts[cat.rarity] += 1; if (!cat.seasonId || !cat.displayName || !cat.fallbackImage) errors.push('shape:' + cat.id); });
    if (counts.normal !== 2 || counts.rare !== 2 || counts.hero !== 1 || counts.legendary !== 1) errors.push('season_01_counts');
    return { valid: !errors.length, errors: errors, counts: counts };
  }
  function validateSeasonMissionData() {
    var errors = [], ids = new Set(); (v2.seasonMissions || []).forEach(function (mission) { if (ids.has(mission.id)) errors.push('duplicate:' + mission.id); ids.add(mission.id); if (!mission.target || !mission.reward) errors.push('shape:' + mission.id); }); return { valid: !errors.length, errors: errors };
  }
  Object.assign(validators, { validateSeasonData:function(){return v2.seasonService.validateSeasonData();}, validateSeasonCatData:validateSeasonCatData, validateSeasonMissionData:validateSeasonMissionData, validateReleaseState:validateReleaseState, validateCollectionSortOrder:function(cats,options){return v2.collectionSortService.validateCollectionSortOrder(cats,options);}, validateSeasonSortMetadata:function(seasons){return v2.collectionSortService.validateSeasonSortMetadata(seasons);}, validateOwnedCatFiltering:function(cats,ownedIds){return v2.collectionSortService.validateOwnedCatFiltering(cats,ownedIds);} });
})(window);
