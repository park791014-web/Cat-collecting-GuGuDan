(function (global) {
  'use strict';

  var v2 = global.GugudanV2;

  function activePickupSeason() {
    var id = v2.seasonConfig && v2.seasonConfig.activePremiumPickupSeasonId;
    var season = (v2.seasons || []).find(function (item) { return item.id === id; });
    var status = season && v2.seasonService.getSeasonStatus(season);
    return status && status.status === 'active' ? { season: season, status: status } : null;
  }

  function formatRange(season) {
    var start = String(season.startAt).slice(0, 10).replace(/-/g, '.');
    var end = String(season.endAt).slice(5, 10).replace('-', '.');
    return start + '~' + end;
  }

  function openSummerPremiumPickup() {
    if (typeof global.openCardPackScreen !== 'function') return false;
    global.openCardPackScreen();
    global.setTimeout(function () {
      var button = document.querySelector('#pack-list .summer-pickup [data-draw-type="premiumTicket"]');
      if (button) button.focus();
    }, 0);
    return true;
  }

  function renderSummerBanner() {
    var slot = document.getElementById('season-banner-slot');
    var active = activePickupSeason();
    if (!slot) return;
    slot.replaceChildren();
    if (!active) return;

    var season = active.season;
    var save = v2.storageService.loadSaveData();
    var owned = (v2.seasonCats || []).filter(function (cat) {
      return cat.seasonId === season.id && save.collection.ownedCatIds.indexOf(cat.id) >= 0;
    }).length;
    var banner = document.createElement('section');
    var content = document.createElement('div');
    var title = document.createElement('strong');
    var details = document.createElement('small');
    var button = document.createElement('button');
    var visual = document.createElement('div');
    var image = document.createElement('img');

    banner.className = 'season-banner summer-season-banner';
    content.className = 'summer-season-banner__content';
    title.className = 'summer-season-banner__title';
    title.textContent = season.name;
    details.textContent = season.breed.displayName + ' · ' + formatRange(season) + ' · 수집 ' + owned + '/' + season.catIds.length;
    button.type = 'button';
    button.className = 'game-button primary summer-season-banner__button';
    button.textContent = '시즌 보기 →';
    button.onclick = openSummerPremiumPickup;

    visual.className = 'summer-season-banner__visual';
    image.src = 'assets/cats/seasons/summer_2026/heatwave-flame-cat.jpg';
    image.alt = '폭염불꽃냥이';
    content.appendChild(title);
    content.appendChild(details);
    content.appendChild(button);
    visual.appendChild(image);
    banner.appendChild(content);
    banner.appendChild(visual);
    if (v2.assetLoader) v2.assetLoader.applyImageFallback(image, 'assets/placeholders/cat-placeholder.svg', 'summer_2026_heatwave_flame_cat');
    slot.appendChild(banner);
  }

  global.openSummerPremiumPickup = openSummerPremiumPickup;
  global.renderSeasonBanner = renderSummerBanner;
  v2.summerSeasonBanner = { render: renderSummerBanner, openPremiumPickup: openSummerPremiumPickup, formatRange: formatRange };
})(window);
