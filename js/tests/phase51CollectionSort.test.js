(function (global) {
  'use strict';
  function assert(ok, message) { if (!ok) throw new Error('[Phase5.1] ' + message); }
  function cat(id, collection, seasonId, rarity, order) { return { id:id, collection:collection, seasonId:seasonId, rarity:rarity, displayOrder:order, displayName:id }; }
  function runPhase51CollectionSortValidation() {
    var v2=global.GugudanV2,svc=v2.collectionSortService,reference='2026-08-01T00:00:00+09:00';
    var seasons=[
      {id:'active',name:'활성',enabled:true,startAt:'2026-07-01T00:00:00+09:00',endAt:'2026-09-01T23:59:59+09:00',displayOrder:1},
      {id:'recent',name:'최근',enabled:true,startAt:'2026-05-01T00:00:00+09:00',endAt:'2026-07-15T23:59:59+09:00',displayOrder:2},
      {id:'old',name:'과거',enabled:true,startAt:'2025-01-01T00:00:00+09:00',endAt:'2025-02-01T23:59:59+09:00',displayOrder:3}
    ];
    var cats=[cat('active_normal','season','active','normal',2),cat('active_legendary','season','active','legendary',1),cat('recent_hero','season','recent','hero',1),cat('base_rare','base',null,'rare',1),cat('old_legendary','season','old','legendary',1),cat('missing','season','missing','normal',1),cat('unowned','base',null,'legendary',1),cat('legacy','legacy',null,'legendary',1)];
    var ownedIds=cats.filter(function(c){return c.id!=='unowned';}).map(function(c){return c.id;}),save=v2.storageService.loadSaveData();save.collection.ownedCatIds=ownedIds;cats.forEach(function(c,index){save.collection.catProgress[c.id]={obtainedAt:new Date(2026,0,index+1).toISOString()};});
    var filtered=svc.getOwnedVisibleCats(save,cats);assert(filtered.every(function(c){return c.id!=='unowned'&&c.id!=='legacy';})&&filtered.length===6,'미보유 또는 legacy 필터 실패');
    var sorted=svc.sortOwnedCatsForCollection(filtered,{saveData:save,seasons:seasons,referenceDate:reference}),ids=sorted.map(function(c){return c.id;});
    assert(ids.join(',')==='active_legendary,active_normal,recent_hero,base_rare,old_legendary,missing','시즌·등급 기본 정렬 실패: '+ids.join(','));
    assert(svc.sortOwnedCatsForCollection(cats.slice(0,2),{saveData:save,seasons:seasons,referenceDate:reference}).map(function(c){return c.rarity;}).join(',')==='legendary,normal','같은 시즌 등급 정렬 실패');
    assert(svc.validateSeasonSortMetadata(seasons).valid,'시즌 메타데이터 실패');assert(svc.validateCollectionSortOrder(sorted,{saveData:save,seasons:seasons,referenceDate:reference}).valid,'정렬 안정성 실패');
    assert(v2.validators.validateCollectionViewSettings({collectionViewMode:'list',collectionSortMode:'season_rarity'}).valid,'도감 설정 검증 실패');
    assert(!v2.validators.validateCollectionViewSettings({collectionViewMode:'card',collectionSortMode:'wrong'}).valid,'잘못된 도감 설정 차단 실패');
    var manifest=v2.validators.validateCatImageManifest([].concat(v2.baseCats||[],v2.seasonCats||[]));assert(manifest.valid&&manifest.baseCount===20&&manifest.seasonCount===6,'이미지 매니페스트 검증 실패');
    return {passed:true,ownedCount:filtered.length,order:ids};
  }
  global.runPhase51CollectionSortValidation=runPhase51CollectionSortValidation;
})(window);
