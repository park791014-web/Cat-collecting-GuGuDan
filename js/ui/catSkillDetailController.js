(function (global) {
  'use strict';

  var v2 = global.GugudanV2;

  function safe(value) {
    var node = document.createElement('span');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  }

  function getCat(catId) {
    return [].concat(v2.baseCats || [], v2.seasonCats || []).find(function (cat) {
      return cat.id === catId;
    });
  }

  function renderCatSkillDetail(catId, container) {
    var cat = getCat(catId);
    if (!cat || !container) return false;

    var existing = container.querySelector('.cat-skill-description');
    if (existing) existing.remove();

    var presentation = cat.presentationSkill;
    var legendary = cat.legendarySkill;
    if (!presentation && !legendary) return true;

    var section = document.createElement('section');
    section.className = 'cat-skill-description rarity-' + cat.rarity;
    section.innerHTML = '<strong>고양이 연출 테마</strong>' +
      (presentation
        ? '<p>효과: ' + safe(presentation.effectThemeId) + ' · 사운드: ' + safe(presentation.soundThemeId) + '</p>'
        : '') +
      (legendary ? '<p><b>특별 옵션:</b> ' + safe(legendary.specialOption) + '</p>' : '') +
      '<small>점수와 시간에는 영향을 주지 않는 연출 전용 기능입니다.</small>';

    var equipButton = container.querySelector('#equip-cat-button');
    container.insertBefore(section, equipButton || null);
    if (equipButton) {
      equipButton.dataset.catId = catId;
      equipButton.onclick = async function () {
        if (equipButton.disabled) return;
        equipButton.disabled = true;
        try {
          var ok = global.updateRepresentativeCat
            ? await global.updateRepresentativeCat(equipButton.dataset.catId)
            : false;
          if (!ok) return;
          if (global.refreshCurrentUserData) await global.refreshCurrentUserData();
          if (global.closeCatDetail) global.closeCatDetail();
          if (global.renderPhase4Currency) global.renderPhase4Currency();
          if (global.renderBaseCollection) global.renderBaseCollection();
        } finally {
          equipButton.disabled = false;
        }
      };
    }
    return true;
  }

  global.renderCatSkillDetail = renderCatSkillDetail;

  // collectionController가 상세 모달을 소유한다. 이 보조기는 렌더 완료 후 스킬 영역만 보강한다.
  document.addEventListener('click', function (event) {
    var card = event.target.closest && event.target.closest('.collection-item');
    if (!card) return;
    global.setTimeout(function () {
      var button = document.querySelector('#cat-detail-content #equip-cat-button');
      var catId = button && button.dataset.catId;
      if (catId) renderCatSkillDetail(catId, document.getElementById('cat-detail-content'));
    }, 0);
  });
})(window);
