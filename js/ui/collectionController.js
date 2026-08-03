(function (global) {
  'use strict';

  var v2 = global.GugudanV2;
  var locked = false;
  var lastFocus = null;
  var rarityNames = {
    normal: '일반',
    rare: '희귀',
    hero: '영웅',
    legendary: '전설'
  };
  var rarityColors = {
    normal: '#90A4AE',
    rare: '#4FC3F7',
    hero: '#BA68C8',
    legendary: '#FFB74D'
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function visibleCats() {
    return v2.releasePolicyService.getVisibleCats();
  }

  function catalogCats() {
    return v2.allCats || [].concat(v2.baseCats || [], v2.seasonCats || []);
  }

  function collectionSummary(save) {
    var ownedIds = new Set((save.collection && save.collection.ownedCatIds) || []);
    var catalog = catalogCats();
    var pickup = v2.cardPackService && typeof v2.cardPackService.getPremiumPickup === 'function'
      ? v2.cardPackService.getPremiumPickup()
      : null;
    var season = pickup && pickup.active ? pickup.season : null;
    var baseCats = (v2.baseCats || []).filter(function (cat) { return cat.available !== false && cat.obtainable !== false; });
    var seasonCats = season ? catalog.filter(function (cat) { return cat.seasonId === season.id && cat.available !== false && cat.obtainable !== false; }) : [];
    var ownedCount = catalog.filter(function (cat) { return ownedIds.has(cat.id); }).length;
    var baseOwned = baseCats.filter(function (cat) { return ownedIds.has(cat.id); }).length;
    var seasonOwned = seasonCats.filter(function (cat) { return ownedIds.has(cat.id); }).length;
    return {
      ownedCount: ownedCount,
      baseOwned: baseOwned,
      baseTotal: baseCats.length,
      seasonOwned: seasonOwned,
      seasonTotal: seasonCats.length,
      seasonName: season ? season.name : '',
      homeText: '보유 고양이 ' + ownedCount + '종',
      baseText: '기본 컬렉션 ' + baseOwned + '/' + baseCats.length,
      seasonText: season ? season.name + ' ' + seasonOwned + '/' + seasonCats.length : '',
      detailText: '기본 컬렉션 ' + baseOwned + '/' + baseCats.length + (season ? ' · ' + season.name + ' ' + seasonOwned + '/' + seasonCats.length : '')
    };
  }

  function findCat(catId) {
    return visibleCats().find(function (cat) { return cat.id === catId; });
  }

  function loadSave() {
    v2.releasePolicyService.applySelectedCatPolicy();
    return v2.storageService.loadSaveData();
  }

  function ownedCats(save) {
    return visibleCats().filter(function (cat) {
      return save.collection.ownedCatIds.indexOf(cat.id) >= 0 &&
        cat.visible !== false &&
        cat.previewOnly !== true &&
        cat.developmentOnly !== true;
    });
  }

  function createRarityBadge(rarity) {
    var badge = document.createElement('span');
    badge.className = 'rarity-badge rarity-' + rarity;
    badge.textContent = rarityNames[rarity] || '';
    return badge;
  }

  function createRepresentativeBadge() {
    var badge = document.createElement('span');
    badge.className = 'representative-badge';
    badge.textContent = '대표';
    return badge;
  }

  function createCatStars(value) {
    var count = Math.max(0, Math.floor(Number(value) || 0));
    if (!count) return null;

    var stars = document.createElement('span');
    stars.className = 'cat-stars ' + (count >= 10 ? 'cat-stars-red' : 'cat-stars-gold');
    stars.textContent = count <= 5 ? '★'.repeat(count) : '★×' + count;
    stars.setAttribute('aria-label', '중복 별 ' + count + '개');
    return stars;
  }

  function getCollectionCategoryLabel(cat) {
    return {
      base: '기본 고양이',
      season: '시즌 고양이',
      event: '이벤트 고양이'
    }[cat && cat.collection] || '';
  }

  function formatNumber(value) {
    return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('ko-KR');
  }

  function renderCurrency() {
    var save = loadSave();
    var cat = findCat(save.profile.selectedCatId);
    var summary = byId('lobby-selected-cat');
    var currency = byId('currency-summary');
    var packCurrency = byId('pack-currency');
    var ownedSummary = byId('collection-owned-summary');

    if (currency) {
      currency.innerHTML =
        '<span class="currency-chip currency-chip--coins">코인 <strong>' + formatNumber(save.currency.coins) + '</strong></span>' +
        '<span class="currency-chip currency-chip--normal">일반권 <strong>' + formatNumber(save.currency.normalTickets) + '</strong></span>' +
        '<span class="currency-chip currency-chip--premium">고급권 <strong>' + formatNumber(save.currency.premiumTickets) + '</strong></span>';
    }
    if (packCurrency) {
      packCurrency.textContent = '보유 코인 ' + formatNumber(save.currency.coins) + '코인';
    }
    if (ownedSummary) {
      var summaryData = collectionSummary(save);
      ownedSummary.innerHTML = '<span class="collection-owned-total">' + summaryData.homeText + '</span><span class="collection-owned-base">' + summaryData.baseText + '</span>' +
        (summaryData.seasonText ? '<span class="collection-owned-season">' + summaryData.seasonText + '</span>' : '');
    }

    if (!summary) return;
    summary.replaceChildren();
    if (!cat) return;

    var image = document.createElement('img');
    image.src = cat.image;
    image.alt = '';

    var information = document.createElement('span');
    information.className = 'home-representative-info';
    var label = document.createElement('small');
    label.className = 'home-representative-label';
    label.textContent = '대표 고양이';

    var titleRow = document.createElement('span');
    titleRow.className = 'home-representative-name-row selected-cat-title-line';
    titleRow.appendChild(createRarityBadge(cat.rarity));

    var name = document.createElement('strong');
    name.className = 'home-representative-cat-name representative-cat-name';
    name.textContent = cat.displayName;
    titleRow.appendChild(name);

    information.appendChild(label);
    information.appendChild(titleRow);

    var changeButton = document.createElement('button');
    changeButton.type = 'button';
    changeButton.textContent = '바꾸기';
    changeButton.onclick = openCollectionScreen;

    summary.appendChild(image);
    summary.appendChild(information);
    summary.appendChild(changeButton);
    v2.assetLoader.applyImageFallback(image, cat.fallbackImage, cat.id);
  }

  function drawRates() {
    return Object.keys(v2.catDrawConfig.rarityRates).map(function (rarity) {
      return rarityNames[rarity] + ' ' + Math.round(v2.catDrawConfig.rarityRates[rarity] * 100) + '%';
    }).join(' · ');
  }

  function openCardPackScreen() {
    locked = false;
    renderCurrency();
    var save = loadSave();
    var config = v2.catDrawConfig;
    var enough = save.currency.coins >= config.cost;
    var list = byId('pack-list');
    list.innerHTML = '<article class="pack-card coin-draw"><h3>기본 고양이 뽑기</h3><p>' +
      drawRates() + '</p><p>필요: ' + config.cost + '코인</p><button class="game-button primary" ' +
      (enough ? '' : 'disabled') + '>' +
      (enough ? '고양이 뽑기 ' + config.cost + '코인' : '코인이 부족합니다.') + '</button>' +
      (enough ? '' : '<small>게임을 플레이해 코인을 모아보세요.</small>') + '</article>';
    list.querySelector('button').onclick = draw;
    byId('pack-result').hidden = true;
    byId('pack-message').textContent = '';
    showScreen('card-pack-screen');
    setTimeout(function () { byId('card-pack-title').focus(); }, 0);
  }

  function draw() {
    if (locked) return;
    locked = true;
    var drawPromise = global.performDrawCatTransaction
      ? global.performDrawCatTransaction('coin')
      : Promise.resolve(v2.coinDrawService.draw());

    drawPromise.then(function (result) {
      if (!result.ok) {
        locked = false;
        byId('pack-message').textContent = result.reason === 'insufficient_coins'
          ? '코인이 부족합니다. 게임을 플레이해 코인을 모아보세요.'
          : '고양이 뽑기를 완료하지 못했습니다.';
        return;
      }

      var box = byId('pack-result');
      var cat = result.cat;
      box.hidden = false;
      box.className = 'pack-result rarity-' + result.rarity + ' revealing';
      box.innerHTML = '<button type="button" class="pack-skip">결과 바로 보기</button>' +
        '<span class="rarity-badge rarity-' + result.rarity + '">' + rarityNames[result.rarity] + '</span>' +
        '<img src="' + cat.image + '" alt="' + cat.displayName + '"><h3>' +
        (result.duplicate ? '중복 획득' : '새 고양이 획득!') + '</h3><strong>' + cat.displayName + '</strong><p>' +
        (result.duplicate ? rarityNames[result.rarity] + ' 조각 +' + result.fragments : '도감에 추가되었습니다.') + '</p>';
      v2.assetLoader.applyImageFallback(box.querySelector('img'), cat.fallbackImage, cat.id);

      function reveal() {
        box.classList.remove('revealing');
        box.querySelector('.pack-skip').hidden = true;
        locked = false;
        if (global.refreshCurrentUserData && global.showLobby) {
          global.refreshCurrentUserData().then(function () {
            global.showLobby();
            renderCurrency();
            if (global.renderBaseCollection) global.renderBaseCollection();
          });
        } else {
          renderCurrency();
          if (global.renderBaseCollection) global.renderBaseCollection();
        }
      }

      box.onclick = reveal;
      setTimeout(reveal, 1200);
      box.focus();
    }).catch(function (error) {
      locked = false;
      console.error('고양이 뽑기 에러:', error);
      byId('pack-message').textContent = error.message === 'insufficient_coins'
        ? '코인이 부족합니다.'
        : '뽑기 진행 중 오류가 발생했다냥.';
    });
  }

  function equip(catId) {
    var save = loadSave();
    var cat = findCat(catId);
    if (!cat || save.collection.ownedCatIds.indexOf(catId) < 0) return false;

    if (global.updateRepresentativeCat) {
      global.updateRepresentativeCat(catId).then(function (ok) {
        if (!ok) return;
        if (global.refreshCurrentUserData && global.showLobby) {
          global.refreshCurrentUserData().then(function () {
            global.showLobby();
            closeCatDetail();
            renderCurrency();
            renderCollection();
          });
        } else {
          closeCatDetail();
          renderCurrency();
          renderCollection();
        }
      }).catch(function (error) {
        console.error('대표고양이 업데이트 오류:', error);
      });
    } else {
      save.profile.selectedCatId = catId;
      if (!v2.storageService.saveSaveData(save)) return false;
      closeCatDetail();
      renderCurrency();
      renderCollection();
    }
    return true;
  }

  function openCatDetail(catId) {
    var cat = findCat(catId);
    var save = loadSave();
    if (!cat || save.collection.ownedCatIds.indexOf(catId) < 0) return;

    lastFocus = document.activeElement;
    var progress = save.collection.catProgress[catId] || {};
    var duplicates = save.collection.duplicateCounts[catId] || 0;
    var selected = save.profile.selectedCatId === catId;
    var content = byId('cat-detail-content');
    var categoryLabel = getCollectionCategoryLabel(cat);
    var detailMeta = '<div class="cat-detail-meta">' +
      '<span class="cat-detail-rarity rarity-text-' + cat.rarity + '">' + rarityNames[cat.rarity] + '</span>' +
      (categoryLabel ? '<span class="cat-detail-category">' + categoryLabel + '</span>' : '') +
      '</div>';
    content.innerHTML = '<img class="cat-detail-image" src="' + cat.image + '" alt="' + cat.displayName + '">' +
      '<h2 id="cat-detail-name" class="cat-detail-name">' + cat.displayName + '</h2>' + detailMeta + '<p>획득일 ' +
      (progress.obtainedAt ? new Date(progress.obtainedAt).toLocaleDateString('ko-KR') : '처음부터 함께함') +
      ' · 중복 ' + duplicates + '회</p><button id="equip-cat-button" class="game-button primary" ' +
      (selected ? 'disabled' : '') + '>' +
      (selected ? '대표 고양이로 장착 중' : '대표 고양이로 장착') + '</button>';
    v2.assetLoader.applyImageFallback(content.querySelector('img'), cat.fallbackImage, cat.id);

    var representativeButton = content.querySelector('#equip-cat-button');
    representativeButton.dataset.catId = catId;
    representativeButton.onclick = async function () {
      representativeButton.disabled = true;
      try {
        if (global.updateRepresentativeCat) {
          var ok = await global.updateRepresentativeCat(catId);
          if (ok) {
            closeCatDetail();
            renderCurrency();
            renderCollection();
          }
        } else {
          equip(catId);
        }
      } finally {
        representativeButton.disabled = false;
      }
    };
    byId('cat-detail-modal').hidden = false;
    byId('cat-detail-close').focus();
  }

  function closeCatDetail() {
    byId('cat-detail-modal').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function createCollectionCard(cat, save) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'collection-item cat-thumbnail-item collection-cat-row rarity-' + cat.rarity;
    card.style.setProperty('--rarity-color', rarityColors[cat.rarity]);

    var image = document.createElement('img');
    image.className = 'cat-thumbnail-item__image collection-cat-row__image';
    image.src = cat.image;
    image.alt = cat.displayName;

    var information = document.createElement('div');
    information.className = 'cat-thumbnail-info collection-cat-row__content';

    var titleRow = document.createElement('div');
    titleRow.className = 'cat-card-title-row cat-thumbnail-header collection-cat-row__title-line';
    if (save.profile.selectedCatId === cat.id) {
      titleRow.appendChild(createRepresentativeBadge());
    }
    titleRow.appendChild(createRarityBadge(cat.rarity));

    var name = document.createElement('strong');
    name.className = 'cat-name collection-cat-row__name';
    name.textContent = cat.displayName;
    titleRow.appendChild(name);

    var stars = createCatStars(save.collection.duplicateCounts[cat.id]);
    if (stars) titleRow.appendChild(stars);

    var description = document.createElement('p');
    description.className = 'cat-thumbnail-desc collection-cat-row__description';
    description.textContent = cat.description || '';

    information.appendChild(titleRow);
    information.appendChild(description);
    card.appendChild(image);
    card.appendChild(information);
    v2.assetLoader.applyImageFallback(image, cat.fallbackImage, cat.id);
    card.onclick = function () { openCatDetail(cat.id); };
    return card;
  }

  function renderCollection() {
    var save = loadSave();
    var list = ownedCats(save);
    var grid = byId('collection-grid');
    var filters = byId('collection-filters');
    if (!grid || !filters) return;

    var summaryData = collectionSummary(save);
    filters.innerHTML = '<span class="collection-owned-count">보유 ' + summaryData.ownedCount +
      '종</span><input id="collection-search" type="search" placeholder="고양이 이름 검색" ' +
      'aria-label="고양이 이름 검색"><div class="collection-rarity-filters">' +
      '<button data-rarity="all" class="active">전체</button><button data-rarity="normal">일반</button>' +
      '<button data-rarity="rare">희귀</button><button data-rarity="hero">영웅</button>' +
      '<button data-rarity="legendary">전설</button></div>' +
      (summaryData.seasonName ? '<small class="collection-season-progress">' + summaryData.seasonName + ' · ' + summaryData.seasonOwned + '/' + summaryData.seasonTotal + '</small>' : '');

    var rarity = 'all';
    var query = '';

    function paint() {
      var visible = list.filter(function (cat) {
        return (rarity === 'all' || cat.rarity === rarity) &&
          (!query || cat.displayName.toLocaleLowerCase('ko').indexOf(query) >= 0);
      });
      grid.className = 'collection-grid collection-grid-view';
      grid.replaceChildren();
      byId('collection-empty-message').hidden = visible.length > 0;
      v2.collectionSortService.sortOwnedCatsForCollection(visible, {
        saveData: save,
        sortMode: 'rarity'
      }).forEach(function (cat) {
        grid.appendChild(createCollectionCard(cat, save));
      });
    }

    byId('collection-search').oninput = function (event) {
      query = event.target.value.trim().toLocaleLowerCase('ko');
      paint();
    };
    filters.querySelectorAll('[data-rarity]').forEach(function (button) {
      button.onclick = function () {
        filters.querySelectorAll('[data-rarity]').forEach(function (item) {
          item.classList.remove('active');
        });
        button.classList.add('active');
        rarity = button.dataset.rarity;
        paint();
      };
    });

    paint();
    renderCurrency();
    if (byId('collection-screen-summary')) {
      byId('collection-screen-summary').textContent = summaryData.homeText + ' · ' + summaryData.detailText;
    }
  }

  function openCollectionScreen() {
    renderCollection();
    showScreen('collection-screen');
    setTimeout(function () { byId('collection-title').focus(); }, 0);
  }

  function changeCurrency(key, amount) {
    var save = loadSave();
    save.currency[key] = Math.max(0, save.currency[key] + Math.floor(Number(amount) || 0));
    v2.storageService.saveSaveData(save);
    renderCurrency();
    return save.currency[key];
  }

  var debug = global.NyankoDebug = global.NyankoDebug || {};
  Object.assign(debug, {
    addCoins: function (amount) { return changeCurrency('coins', amount); },
    addNormalTickets: function (amount) { return changeCurrency('normalTickets', amount); },
    addPremiumTickets: function (amount) { return changeCurrency('premiumTickets', amount); },
    grantCat: v2.cardPackService.grantCat,
    setSelectedCat: equip,
    printCollectionData: function () { return loadSave().collection; },
    printFeatureFlags: function () { return Object.assign({}, v2.FEATURE_FLAGS); },
    enableSeasonPreviewForTesting: function () {
      v2.FEATURE_FLAGS.seasons = true;
      return v2.releasePolicyService.applySelectedCatPolicy();
    },
    disableSeasonPreviewForTesting: function () {
      v2.FEATURE_FLAGS.seasons = false;
      return v2.releasePolicyService.applySelectedCatPolicy();
    },
    printClassicRewardConfig: function () { return v2.classicRewardConfig; },
    simulateClassicReward: function (result) {
      return v2.classicRewardService.calculate(result || {}, false);
    },
    printCatDrawConfig: function () { return v2.catDrawConfig; },
    simulateCoinCatDraw: function () { return v2.coinDrawService.draw(); },
    validateCoinDrawState: v2.coinDrawService.validate
  });

  global.createCollectionRarityBadge = createRarityBadge;
  global.openCardPackScreen = openCardPackScreen;
  global.openCatDetail = openCatDetail;
  global.closeCatDetail = closeCatDetail;
  global.renderPhase4Currency = renderCurrency;
  global.renderBaseCollection = renderCollection;
  global.openCollectionScreen = openCollectionScreen;
  v2.collectionSummaryService = { getSummary: collectionSummary };
})(window);
