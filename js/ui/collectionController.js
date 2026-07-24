(function(global){
  'use strict';
  var v2 = global.GugudanV2, locked = false, lastFocus = null, names = { normal: '일반', rare: '희귀', hero: '영웅', legendary: '전설' };
  
  function id(x) { return document.getElementById(x); }
  function cats() { return v2.releasePolicyService.getVisibleCats(); }
  function find(catId) { return cats().find(function(c){ return c.id === catId; }); }
  function save() { v2.releasePolicyService.applySelectedCatPolicy(); return v2.storageService.loadSaveData(); }
  
  function owned(data) {
    return cats().filter(function(c){
      return data.collection.ownedCatIds.indexOf(c.id) >= 0 && c.visible !== false && c.previewOnly !== true && c.developmentOnly !== true;
    });
  }

  function renderCurrency() {
    var data = save(), cat = find(data.profile.selectedCatId), summary = id('lobby-selected-cat'), text = '보유 코인 ' + data.currency.coins + '코인';
    if (id('currency-summary')) id('currency-summary').textContent = text;
    if (id('pack-currency')) id('pack-currency').textContent = text;
    if (id('collection-owned-summary')) id('collection-owned-summary').textContent = '보유 고양이 ' + owned(data).length + '종 · 기본 컬렉션 ' + owned(data).length + '/' + (v2.baseCats || []).length;
    if (summary && cat) {
      summary.innerHTML = '<img src="' + cat.image + '" alt=""><span><small>대표 고양이</small><strong>' + cat.displayName + '</strong><em>' + names[cat.rarity] + '</em></span><button type="button">바꾸기</button>';
      v2.assetLoader.applyImageFallback(summary.querySelector('img'), cat.fallbackImage, cat.id);
      summary.querySelector('button').onclick = openCollectionScreen;
    }
  }

  function rates() {
    return Object.keys(v2.catDrawConfig.rarityRates).map(function(k){
      return names[k] + ' ' + Math.round(v2.catDrawConfig.rarityRates[k] * 100) + '%';
    }).join(' · ');
  }

  function openCardPackScreen() {
    locked = false;
    renderCurrency();
    var data = save(), cfg = v2.catDrawConfig, enough = data.currency.coins >= cfg.cost, list = id('pack-list');
    list.innerHTML = '<article class="pack-card coin-draw"><h3>기본 고양이 뽑기</h3><p>' + rates() + '</p><p>필요: ' + cfg.cost + '코인</p><button class="game-button primary" ' + (enough ? '' : 'disabled') + '>' + (enough ? '고양이 뽑기 ' + cfg.cost + '코인' : '코인이 부족합니다.') + '</button>' + (enough ? '' : '<small>게임을 플레이해 코인을 모아보세요.</small>') + '</article>';
    list.querySelector('button').onclick = draw;
    id('pack-result').hidden = true;
    id('pack-message').textContent = '';
    showScreen('card-pack-screen');
    setTimeout(function(){ id('card-pack-title').focus(); }, 0);
  }

  function draw() {
    if (locked) return;
    locked = true;
    var r = v2.coinDrawService.draw();
    if (!r.ok) {
      locked = false;
      id('pack-message').textContent = r.reason === 'insufficient_coins' ? '코인이 부족합니다. 게임을 플레이해 코인을 모아보세요.' : '고양이 뽑기를 완료하지 못했습니다.';
      return;
    }
    var box = id('pack-result'), cat = r.cat;
    box.hidden = false;
    box.className = 'pack-result rarity-' + r.rarity + ' revealing';
    box.innerHTML = '<button type="button" class="pack-skip">결과 바로 보기</button><span class="rarity-badge">' + names[r.rarity] + '</span><img src="' + cat.image + '" alt="' + cat.displayName + '"><h3>' + (r.duplicate ? '중복 획득' : '새 고양이 획득!') + '</h3><strong>' + cat.displayName + '</strong><p>' + (r.duplicate ? names[r.rarity] + ' 조각 +' + r.fragments : '도감에 추가되었습니다.') + '</p>';
    v2.assetLoader.applyImageFallback(box.querySelector('img'), cat.fallbackImage, cat.id);
    
    function reveal() {
      box.classList.remove('revealing');
      box.querySelector('.pack-skip').hidden = true;
      locked = false;
      renderCurrency();
    }
    box.onclick = reveal;
    setTimeout(reveal, 1200);
    box.focus();
  }

  function equip(catId) {
    var data = save(), cat = find(catId);
    if (!cat || data.collection.ownedCatIds.indexOf(catId) < 0) return false;
    data.profile.selectedCatId = catId;
    if (!v2.storageService.saveSaveData(data)) return false;
    
    // 대표 고양이 변경 시 이전 이펙트 상태 초기화
    if (v2.effectService && typeof v2.effectService.clear === 'function') {
      v2.effectService.clear();
    }
    
    closeCatDetail();
    renderCurrency();
    renderCollection();
    return true;
  }

  function openCatDetail(catId) {
    var cat = find(catId), data = save();
    if (!cat || data.collection.ownedCatIds.indexOf(catId) < 0) return;
    lastFocus = document.activeElement;
    var p = data.collection.catProgress[catId] || {}, dup = data.collection.duplicateCounts[catId] || 0, selected = data.profile.selectedCatId === catId, content = id('cat-detail-content');
    
    // V4 상세 화면: 별을 별도의 줄로 표시, 이름 굵게(800)
    var starsText = '★'.repeat(Math.min(5, Math.max(0, dup)));
    var starsHtml = starsText ? '<div class="cat-detail-stars gold" style="color: #ffb020; font-size: 1.2em; margin: 6px 0;">' + starsText + '</div>' : '';
    
    content.innerHTML = '<img class="cat-detail-image" src="' + cat.image + '" alt="' + cat.displayName + '" style="max-width: 100%; height: auto; object-fit: contain;"><span class="rarity-badge">' + names[cat.rarity] + '</span>' +
                        '<h2 class="cat-detail-name" style="margin: 8px 0 4px 0; font-weight: 800; font-size: 1.5em; color: #2d3748;">' + cat.displayName + '</h2>' +
                        starsHtml +
                        '<p style="margin: 4px 0; color: #4a5568; font-weight: 600;">' + names[cat.rarity] + ' 고양이</p><p style="margin: 4px 0; font-size: 0.85em; color: #718096;">획득일 ' + (p.obtainedAt ? new Date(p.obtainedAt).toLocaleDateString('ko-KR') : '처음부터 함께함') + ' · 중복 ' + dup + '회</p>' +
                        '<p class="cat-description" style="margin: 10px 0; line-height: 1.4; word-break: keep-all; font-size: 0.9em; color: #4a5568;">' + (cat.description || '') + '</p>' +
                        '<button id="equip-cat-button" class="game-button primary" style="margin-top: 10px; width: 100%;" ' + (selected ? 'disabled' : '') + '>' + (selected ? '대표 고양이로 장착 중' : '대표 고양이로 장착') + '</button>';
    
    v2.assetLoader.applyImageFallback(content.querySelector('img'), cat.fallbackImage, cat.id);
    content.querySelector('button').onclick = function () { equip(catId); };
    id('cat-detail-modal').hidden = false;
    id('cat-detail-close').focus();
  }

  function closeCatDetail() {
    id('cat-detail-modal').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function renderCollection() {
    var data = save(), list = owned(data), grid = id('collection-grid'), filters = id('collection-filters');
    if (!grid || !filters) return;
    filters.innerHTML = '<span class="collection-owned-count">보유 ' + list.length + '종</span><input id="collection-search" type="search" placeholder="고양이 이름 검색" aria-label="고양이 이름 검색"><div class="collection-rarity-filters"><button data-rarity="all" class="active">전체</button><button data-rarity="normal">일반</button><button data-rarity="rare">희귀</button><button data-rarity="hero">영웅</button><button data-rarity="legendary">전설</button></div>';
    var rarity = 'all', query = '';
    
    function paint() {
      var visible = list.filter(function (c) {
        return (rarity === 'all' || c.rarity === rarity) && (!query || c.displayName.toLocaleLowerCase('ko').indexOf(query) >= 0);
      });
      grid.className = 'collection-grid collection-single-row-list';
      grid.innerHTML = '';
      id('collection-empty-message').hidden = visible.length > 0;
      
      v2.collectionSortService.sortOwnedCatsForCollection(visible, { saveData: data, sortMode: 'rarity' }).forEach(function (cat) {
        var b = document.createElement('button');
        b.className = 'collection-item collection-cat-row rarity-' + cat.rarity;
        
        var dup = data.collection.duplicateCounts[cat.id] || 0;
        var starsText = '★'.repeat(Math.min(5, Math.max(0, dup)));
        var starsHtml = starsText ? '<span class="collection-stars gold" style="color: #ffb020; font-size: 0.8em; display: inline-flex;">' + starsText + '</span>' : '';
        
        var isRepresentative = data.profile.selectedCatId === cat.id;
        var repHtml = isRepresentative ? '<span class="collection-representative-badge" style="margin-left: 2px;">대표</span>' : '';

        // V4: 가로 1열 카드 구조로 렌더링
        b.innerHTML = '<img class="collection-cat-row__image" src="' + cat.image + '" alt="' + cat.displayName + '" style="width: 60px; height: 60px; border-radius: 8px; object-fit: contain; margin-right: 12px; flex-shrink: 0; background-color: #f7fafc; border: 1px solid #edf2f7;">' +
                      '<div class="collection-cat-row__content" style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0; text-align: left;">' +
                        '<div class="collection-cat-heading" style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px; line-height: 1.2; min-width: 0; word-break: keep-all;">' +
                          '<span class="collection-rarity" style="font-size: 0.75em; background: #edf2f7; color: #4a5568; padding: 1px 4px; border-radius: 4px; font-weight: 600;">' + names[cat.rarity] + '</span>' +
                          '<span class="collection-cat-name" style="font-weight: 700; font-size: 0.95em; color: #2d3748;">' + cat.displayName + '</span>' +
                          repHtml +
                          starsHtml +
                        '</div>' +
                        '<div class="collection-cat-description" style="margin-top: 4px; font-size: 0.8em; color: #718096; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all;">' + (cat.description || '') + '</div>' +
                      '</div>';
        
        v2.assetLoader.applyImageFallback(b.querySelector('img'), cat.fallbackImage, cat.id);
        b.onclick = function () { openCatDetail(cat.id); };
        grid.appendChild(b);
      });
    }
    
    id('collection-search').oninput = function (e) {
      query = e.target.value.trim().toLocaleLowerCase('ko');
      paint();
    };
    
    filters.querySelectorAll('[data-rarity]').forEach(function (b) {
      b.onclick = function () {
        filters.querySelectorAll('[data-rarity]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        rarity = b.dataset.rarity;
        paint();
      };
    });
    
    paint();
    renderCurrency();
    if (id('collection-screen-summary')) id('collection-screen-summary').textContent = '보유 고양이 ' + list.length + '종';
  }

  function openCollectionScreen() {
    renderCollection();
    showScreen('collection-screen');
    setTimeout(function () { id('collection-title').focus(); }, 0);
  }

  function change(key, n) {
    var data = save();
    data.currency[key] = Math.max(0, data.currency[key] + Math.floor(Number(n) || 0));
    v2.storageService.saveSaveData(data);
    renderCurrency();
    return data.currency[key];
  }

  var debug = global.NyankoDebug = global.NyankoDebug || {};
  Object.assign(debug, {
    addCoins: function (n) { return change('coins', n); },
    addNormalTickets: function (n) { return change('normalTickets', n); },
    addPremiumTickets: function (n) { return change('premiumTickets', n); },
    grantCat: v2.cardPackService.grantCat,
    setSelectedCat: equip,
    printCollectionData: function () { return save().collection; },
    printFeatureFlags: function () { return Object.assign({}, v2.FEATURE_FLAGS); },
    enableSeasonPreviewForTesting: function () { v2.FEATURE_FLAGS.seasons = true; return v2.releasePolicyService.applySelectedCatPolicy(); },
    disableSeasonPreviewForTesting: function () { v2.FEATURE_FLAGS.seasons = false; return v2.releasePolicyService.applySelectedCatPolicy(); },
    printClassicRewardConfig: function () { return v2.classicRewardConfig; },
    simulateClassicReward: function (r) { return v2.classicRewardService.calculate(r || {}, false); },
    printCatDrawConfig: function () { return v2.catDrawConfig; },
    simulateCoinCatDraw: function () { return v2.coinDrawService.draw(); },
    validateCoinDrawState: v2.coinDrawService.validate
  });

  global.openCardPackScreen = openCardPackScreen;
  global.openCatDetail = openCatDetail;
  global.closeCatDetail = closeCatDetail;
  global.renderPhase4Currency = renderCurrency;
  global.renderBaseCollection = renderCollection;
  global.openCollectionScreen = openCollectionScreen;
})(window);
