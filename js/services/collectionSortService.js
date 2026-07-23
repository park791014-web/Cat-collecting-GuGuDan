(function (global) {
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  var RARITY_SORT_PRIORITY = { legendary:0, hero:1, rare:2, normal:3 };
  var RECENT_SEASON_WINDOW_DAYS = 90;
  function timestamp(value) { var time = new Date(value || 0).getTime(); return Number.isFinite(time) ? time : 0; }
  function rarityPriority(rarity) { return Object.prototype.hasOwnProperty.call(RARITY_SORT_PRIORITY, rarity) ? RARITY_SORT_PRIORITY[rarity] : 999; }
  function seasonMap(seasons) { return new Map((seasons || []).map(function (season) { return [season.id, season]; })); }
  function getOwnedVisibleCats(save, cats) {
    var owned = new Set((((save || {}).collection || {}).ownedCatIds || []));
    return (cats || []).filter(function (cat) {
      return owned.has(cat.id) && cat.collection !== 'legacy' && cat.visible !== false && cat.previewOnly !== true && cat.developmentOnly !== true;
    });
  }
  function getGroup(cat, map, referenceDate, recentDays) {
    if (cat.collection === 'base') return { key:'base', priority:2, seasonTimestamp:0, label:'기본 고양이' };
    var season = map.get(cat.seasonId);
    if (!season) { console.warn('[Collection] Season data missing:', cat.id, cat.seasonId); return { key:'unknown', priority:4, seasonTimestamp:0, label:'기타 보유 고양이' }; }
    var status = v2.seasonService.getSeasonStatus(season, referenceDate), end = timestamp(season.endAt), now = timestamp(referenceDate || new Date()), recent = status.status === 'ended' && now - end <= recentDays * 86400000;
    if (status.status === 'active' || status.status === 'preview') return { key:'active:' + season.id, priority:0, seasonTimestamp:timestamp(season.startAt), displayOrder:Number(season.displayOrder)||9999, label:'현재 시즌 · ' + season.name };
    if (recent) return { key:'recent:' + season.id, priority:1, seasonTimestamp:end, displayOrder:Number(season.displayOrder)||9999, label:'최근 시즌 · ' + season.name };
    return { key:'old:' + season.id, priority:3, seasonTimestamp:end, displayOrder:Number(season.displayOrder)||9999, label:'지난 시즌 · ' + season.name };
  }
  function obtainedAt(cat, save) { var progress=(((save||{}).collection||{}).catProgress||{})[cat.id]||{};return timestamp(progress.obtainedAt); }
  function compare(a, b, map, referenceDate, recentDays, save, mode) {
    var ga=getGroup(a,map,referenceDate,recentDays),gb=getGroup(b,map,referenceDate,recentDays),diff;
    if (mode === 'rarity') { diff=rarityPriority(a.rarity)-rarityPriority(b.rarity); if(diff)return diff; diff=ga.priority-gb.priority; if(diff)return diff; }
    else if (mode === 'recently_obtained') { diff=obtainedAt(b,save)-obtainedAt(a,save); if(diff)return diff; }
    else if (mode === 'name') return String(a.displayName||'').localeCompare(String(b.displayName||''),'ko');
    else { diff=ga.priority-gb.priority; if(diff)return diff; diff=gb.seasonTimestamp-ga.seasonTimestamp; if(diff)return diff; diff=(ga.displayOrder||9999)-(gb.displayOrder||9999); if(diff)return diff; diff=rarityPriority(a.rarity)-rarityPriority(b.rarity); if(diff)return diff; }
    diff=(Number.isFinite(a.displayOrder)?a.displayOrder:9999)-(Number.isFinite(b.displayOrder)?b.displayOrder:9999);if(diff)return diff;
    diff=obtainedAt(b,save)-obtainedAt(a,save);if(diff)return diff;
    return String(a.displayName||'').localeCompare(String(b.displayName||''),'ko');
  }
  function sortOwnedCatsForCollection(cats, options) { options=options||{};var map=seasonMap(options.seasons||v2.seasons),referenceDate=options.referenceDate||new Date(),recentDays=options.recentSeasonWindowDays==null?RECENT_SEASON_WINDOW_DAYS:options.recentSeasonWindowDays,save=options.saveData||v2.storageService.loadSaveData(),mode=options.sortMode||save.settings.collectionSortMode||'season_rarity';return(cats||[]).slice().sort(function(a,b){return compare(a,b,map,referenceDate,recentDays,save,mode);}); }
  function groupSortedCats(cats, options) { options=options||{};var map=seasonMap(options.seasons||v2.seasons),result=[];(cats||[]).forEach(function(cat){var group=getGroup(cat,map,options.referenceDate||new Date(),options.recentSeasonWindowDays==null?RECENT_SEASON_WINDOW_DAYS:options.recentSeasonWindowDays),last=result[result.length-1];if(!last||last.key!==group.key){last={key:group.key,label:group.label,cats:[]};result.push(last);}last.cats.push(cat);});return result; }
  function validateOwnedCatFiltering(cats, ownedIds) { var save={collection:{ownedCatIds:ownedIds||[]}},filtered=getOwnedVisibleCats(save,cats),errors=[];filtered.forEach(function(cat){if((ownedIds||[]).indexOf(cat.id)<0||cat.collection==='legacy'||cat.visible===false||cat.previewOnly||cat.developmentOnly)errors.push(cat.id);});return{valid:!errors.length,errors:errors,cats:filtered}; }
  function validateSeasonSortMetadata(seasons) { var errors=[];(seasons||[]).forEach(function(s){if(!s.id||!s.startAt||!s.endAt||!Number.isFinite(Number(s.displayOrder)))errors.push(s.id||'missing_id');});return{valid:!errors.length,errors:errors}; }
  function validateCollectionSortOrder(cats, options) { var sorted=sortOwnedCatsForCollection(cats,options),again=sortOwnedCatsForCollection(sorted,options),valid=sorted.map(function(c){return c.id;}).join('|')===again.map(function(c){return c.id;}).join('|');return{valid:valid,errors:valid?[]:['unstable_order'],cats:sorted}; }
  v2.collectionSortService={RARITY_SORT_PRIORITY:RARITY_SORT_PRIORITY,RECENT_SEASON_WINDOW_DAYS:RECENT_SEASON_WINDOW_DAYS,getRarityPriority:rarityPriority,getOwnedVisibleCats:getOwnedVisibleCats,getCatCollectionSortGroup:function(cat,options){options=options||{};return getGroup(cat,seasonMap(options.seasons||v2.seasons),options.referenceDate||new Date(),options.recentSeasonWindowDays||RECENT_SEASON_WINDOW_DAYS);},sortOwnedCatsForCollection:sortOwnedCatsForCollection,groupSortedCats:groupSortedCats,validateOwnedCatFiltering:validateOwnedCatFiltering,validateSeasonSortMetadata:validateSeasonSortMetadata,validateCollectionSortOrder:validateCollectionSortOrder};
  var debug=global.NyankoDebug=global.NyankoDebug||{};debug.validateCollectionSortOrder=validateCollectionSortOrder;debug.validateSeasonSortMetadata=validateSeasonSortMetadata;debug.validateOwnedCatFiltering=validateOwnedCatFiltering;debug.sortOwnedCatsForCollection=sortOwnedCatsForCollection;
})(window);
