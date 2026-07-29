(function (global) {
  'use strict';

  function normalizeCollectionCard(card) {
    // Cards from collectionController already have the canonical title-row DOM.
    // Leave them untouched so later runtime normalizers cannot reorder it.
    if (card.querySelector('.cat-card-title-row')) return;
    var image = card.querySelector('.cat-thumbnail-item__image');
    var representative = card.querySelector('.representative-badge');
    var rarity = card.querySelector('.rarity-badge, .collection-cat-row__rarity');
    var name = card.querySelector('.cat-name, strong, .collection-cat-row__name');
    var stars = card.querySelector('.duplicate-stars, .collection-cat-row__stars');
    var description = card.querySelector('.cat-thumbnail-desc, .collection-cat-row__description');
    var containers = Array.prototype.slice.call(card.querySelectorAll('.cat-thumbnail-info, .collection-cat-row__content'));
    var content = containers[0] || document.createElement('span');
    var title = content.querySelector('.cat-thumbnail-header, .collection-cat-row__title-line') || document.createElement('span');

    card.classList.add('collection-cat-row');
    if (image) image.className = 'cat-thumbnail-item__image collection-cat-row__image';
    content.className = 'cat-thumbnail-info collection-cat-row__content';
    title.className = 'cat-card-title-row cat-thumbnail-header collection-cat-row__title-line';

    if (representative) {
      representative.className = 'representative-badge collection-cat-row__representative';
      title.appendChild(representative);
    }
    if (rarity) {
      var rarityClass = ['normal', 'rare', 'hero', 'legendary'].find(function (value) {
        return card.classList.contains('rarity-' + value);
      });
      rarity.className = 'rarity-badge collection-cat-row__rarity' +
        (rarityClass ? ' rarity-' + rarityClass : '');
      title.appendChild(rarity);
    }
    if (name) {
      name.className = 'cat-name collection-cat-row__name';
      title.appendChild(name);
    }
    if (stars) {
      stars.classList.add('collection-cat-row__stars');
      title.appendChild(stars);
    }
    content.prepend(title);

    if (description) {
      description.className = 'cat-thumbnail-desc collection-cat-row__description';
      content.appendChild(description);
    }

    if (image) image.after(content);
    else card.prepend(content);
    containers.forEach(function (container) {
      if (container !== content) container.remove();
    });
    card.dataset.phase521Collection = 'done';
  }

  function normalizeCollection() {
    var grid = document.getElementById('collection-grid');
    if (!grid) return;
    grid.classList.add('collection-single-row-list');
    grid.querySelectorAll('.cat-thumbnail-item').forEach(normalizeCollectionCard);
  }

  function rarityName(rarity) {
    return {
      normal: '일반',
      rare: '희귀',
      hero: '영웅',
      legendary: '전설'
    }[rarity] || '';
  }

  function normalizeLobbySummary() {
    var v2 = global.GugudanV2;
    var summary = document.getElementById('lobby-selected-cat');
    var currency = document.getElementById('currency-summary');
    if (!v2 || !v2.storageService) return;

    var save = v2.storageService.loadSaveData();
    var cats = v2.releasePolicyService && v2.releasePolicyService.getVisibleCats
      ? v2.releasePolicyService.getVisibleCats()
      : [].concat(v2.baseCats || [], v2.seasonCats || []);
    var catId = save.profile && save.profile.selectedCatId;
    var cat = cats.find(function (item) { return item.id === catId; });

    if (summary && cat) {
      var holder = summary.querySelector(':scope > span');
      var label = holder && holder.querySelector('small');
      var name = holder && holder.querySelector('strong');
      var rarity = holder && holder.querySelector('em');
      var title = holder && holder.querySelector('.selected-cat-title-line');
      if (!title && holder) {
        title = document.createElement('span');
        title.className = 'selected-cat-title-line';
        if (label) label.after(title);
        else holder.prepend(title);
      }
      if (title && rarity && name) {
        rarity.className = 'selected-cat-rarity rarity-' + cat.rarity;
        rarity.textContent = rarityName(cat.rarity);
        title.appendChild(rarity);
        title.appendChild(name);
      }
    }

    if (currency) {
      var values = save.currency || {};
      var coins = Math.max(0, Math.floor(Number(values.coins) || 0));
      var normalTickets = Math.max(0, Math.floor(Number(values.normalTickets) || 0));
      var premiumTickets = Math.max(0, Math.floor(Number(values.premiumTickets) || 0));
      var signature = [coins, normalTickets, premiumTickets].join(':');
      if (
        currency.dataset.currencySignature !== signature ||
        currency.querySelectorAll('.currency-chip').length !== 3
      ) {
        currency.dataset.currencySignature = signature;
        currency.innerHTML =
          '<span class="currency-chip currency-chip--coins">코인 <strong>' + coins.toLocaleString('ko-KR') + '</strong></span>' +
          '<span class="currency-chip currency-chip--normal">일반권 <strong>' + normalTickets.toLocaleString('ko-KR') + '</strong></span>' +
          '<span class="currency-chip currency-chip--premium">고급권 <strong>' + premiumTickets.toLocaleString('ko-KR') + '</strong></span>';
      }
    }
  }

  function enhance() {
    normalizeCollection();
    normalizeLobbySummary();
  }

  var queued = false;
  var observer = new MutationObserver(function () {
    if (queued) return;
    queued = true;
    global.requestAnimationFrame(function () {
      queued = false;
      observer.disconnect();
      enhance();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  enhance();
  observer.observe(document.body, { childList: true, subtree: true });
  global.normalizePhase521Collection = normalizeCollection;
  global.normalizePhase521Lobby = normalizeLobbySummary;
})(window);
