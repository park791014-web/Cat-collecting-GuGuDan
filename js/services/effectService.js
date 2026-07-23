(function(global){
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  var maxParticles = 56; // 9. 권장 최대 활성 파티클 수 56으로 상향

  // global 타이머 추적 리스트
  global.nyankoEffectTimers = global.nyankoEffectTimers || [];

  // 11. 특성 아이콘 제작 기준 (투명 배경, 사각형 배지 없음, svg rect 없음)
  var SVG_SHAPES = {
    paw: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 40c8 0 15-7 15-15s-7-15-15-15-15 7-15 15 7 15 15 15zm-25 15c6 0 11-5 11-11s-5-11-11-11-11 5-11 11 5 11 11 11zm50 0c6 0 11-5 11-11s-5-11-11-11-11 5-11 11 5 11 11 11zM50 55c-15 0-25 10-25 22 0 7 7 11 25 11s25-4 25-11c0-12-10-22-25-22z"/></svg>',
    lightning: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M60 10 L28 52 L54 52 L38 90 L72 46 L48 46 Z"/></svg>',
    shield: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 12 L82 22 V54 C82 72 50 88 50 88 C50 88 18 72 18 54 V22 Z M50 20 L26 28 V52 C26 66 50 78 50 78 C50 78 74 66 74 52 V28 Z"/></svg>',
    
    // 5. 지혜 고양이 책 모양 전면 개선 (펼쳐진 입체 마법책)
    magicBook: '<svg viewBox="0 0 100 100" width="100%" height="100%">' +
      '<path class="wisdom-book-page" d="M12 75 L48 83 L50 81 L52 83 L88 75 V25 L50 33 L12 25 Z" />' +
      '<path d="M50 33 V80" stroke="rgba(255, 255, 255, 0.85)" stroke-width="3" fill="none" />' +
      '<path class="wisdom-book-page" d="M15 26 C30 18 45 28 48 31 V77 C45 74 30 68 15 72 Z" />' +
      '<path class="wisdom-book-page" d="M85 26 C70 18 55 28 52 31 V77 C55 74 70 68 85 72 Z" />' +
      '<path class="wisdom-book-line" d="M22 38 H40 M22 48 H40 M22 58 H34" />' +
      '<path class="wisdom-book-line" d="M60 38 H78 M60 48 H78 M60 58 H70" />' +
      '<path class="wisdom-book-glow" d="M50 8 L52 14 L58 16 L52 18 L50 24 L48 18 L42 16 L48 14 Z" />' +
    '</svg>',
    
    clock: '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="38" fill="none" stroke-width="8"/><circle cx="50" cy="50" r="28" fill="none" stroke-width="2"/><path d="M50 22 V50 H70" fill="none" stroke-width="7" stroke-linecap="round"/></svg>',
    coin: '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="38" fill="none" stroke-width="6"/><circle cx="50" cy="50" r="24" fill="none" stroke-width="2"/><path d="M50 18 V30 M50 70 V82 M18 50 H30 M70 50 H82" stroke-width="5" stroke-linecap="round"/></svg>',
    
    // 8. 달러 기호 SVG path로 직접 제작 (글자 $ 사용 금지)
    dollar: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 10 V90 M32 30 C32 20, 68 15, 68 32 C68 46, 32 44, 32 58 C32 75, 68 78, 68 62" fill="none" stroke-width="10" stroke-linecap="round"/></svg>',
    
    heart: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 82 C50 82 14 55 14 34 C14 18 27 12 38 23 C45 30 50 36 50 36 C50 36 55 30 62 23 C73 12 86 18 86 34 C86 55 50 82 50 82 Z"/></svg>',
    lifeFlame: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 90 C25 90 12 70 12 45 C12 25 32 8 50 8 C68 8 88 25 88 45 C88 70 75 90 50 90 Z M50 80 C62 80 72 65 72 45 C72 32 58 20 50 20 C42 20 28 32 28 45 C28 65 38 80 50 80 Z M50 70 C42 66 38 58 38 48 C38 38 46 30 50 30 C54 30 62 38 62 48 C62 58 58 66 50 70 Z"/></svg>'
  };

  var NEON_PAW_COLORS = [
    "#39ff14", // 네온 그린
    "#00f5ff", // 네온 블루
    "#ff4dff", // 네온 핑크
    "#ffe600", // 네온 옐로
    "#ff5f1f", // 네온 오렌지
    "#8b5cff"  // 네온 퍼플
  ];

  // 7. 영웅 고양이 특성 매핑
  var HERO_EFFECT_MAP = {
    base_hero_01: { shape: "lightning", color: "#f5ff45" },
    base_hero_02: { shape: "shield", color: "#45d7ff" },
    base_hero_03: { shape: "magicBook", color: "#b65cff" }, // 지혜 고양이 magicBook 매핑 및 청보라색 적용
    base_hero_04: { shape: "clock", color: "#63fff2" }
  };

  // 8. 전설 고양이 특성 매핑 2종
  var LEGENDARY_EFFECT_MAP = {
    base_legendary_01: {
      shapes: [
        { shape: "coin", color: "#ffe600" },
        { shape: "dollar", color: "#7dff59" }
      ]
    },
    base_legendary_02: {
      shapes: [
        { shape: "heart", color: "#ff4d9d" },
        { shape: "lifeFlame", color: "#9b6cff" }
      ]
    }
  };

  function layer() {
    return document.getElementById('game-effect-layer');
  }

  function cat(catId) {
    var list = [].concat(v2.baseCats || [], v2.seasonCats || []);
    if (catId) {
      return list.find(function(x){ return x.id === catId; });
    }
    try {
      return v2.releasePolicyService.getSelectedCat();
    } catch(e) {
      return list[0];
    }
  }

  function palette(item) {
    return item && item.effectPalette || {
      primary: '#39ff14',
      secondary: '#00f5ff',
      glow: 'rgba(57,255,20,.85)'
    };
  }

  function clear() {
    var el = layer();
    if (el) {
      el.innerHTML = '';
      el.removeAttribute('data-effect-theme');
    }
    if (global.nyankoEffectTimers) {
      global.nyankoEffectTimers.forEach(clearTimeout);
      global.nyankoEffectTimers = [];
    }
  }

  // 7. 기본 발바닥 개수 정책 함수
  function getPawParticleCount(comboCount) {
    var safeCombo = Number.isFinite(Number(comboCount))
      ? Math.floor(Number(comboCount))
      : 1;
    return Math.max(1, Math.min(safeCombo, 24));
  }

  // 10. 공통 이펙트 프로필 함수
  function resolveCatEffectProfile(item) {
    if (!item) {
      return {
        rarity: "normal",
        baseShape: "paw",
        specialShapes: []
      };
    }
    
    var heroEffect = HERO_EFFECT_MAP[item.id];
    if (heroEffect) {
      return {
        rarity: "hero",
        baseShape: "paw",
        specialShapes: [heroEffect]
      };
    }

    var legendaryEffect = LEGENDARY_EFFECT_MAP[item.id];
    if (legendaryEffect) {
      return {
        rarity: "legendary",
        baseShape: "paw",
        specialShapes: legendaryEffect.shapes.slice(0, 2)
      };
    }

    if (item.rarity === 'legendary') {
      console.warn("[Cat Effect] Legendary effect mapping missing:", item.id);
    }

    return {
      rarity: item.rarity || "normal",
      baseShape: "paw",
      specialShapes: []
    };
  }

  // 10. 파티클 개수 계산과 DOM 생성 분리 계획 함수
  function createComboEffectPlan(options) {
    var comboCount = options.comboCount;
    var effectProfile = options.effectProfile;
    
    var pawCount = getPawParticleCount(comboCount);
    var specialCountA = 0;
    var specialCountB = 0;

    if (effectProfile.rarity === "hero") {
      specialCountA = Math.min(8, Math.max(1, Math.ceil(comboCount / 3)));
    }

    if (effectProfile.rarity === "legendary") {
      specialCountA = Math.min(7, Math.max(1, Math.ceil(comboCount / 4)));
      specialCountB = Math.min(7, Math.max(1, Math.ceil(comboCount / 4)));
    }

    return {
      pawCount: pawCount,
      specialCountA: specialCountA,
      specialCountB: specialCountB
    };
  }

  // 9. 활성 파티클 제한 및 오래된 노드 정리 함수
  function trimOldParticles(requiredSlots) {
    var particles = Array.prototype.slice.call(document.querySelectorAll(".combo-particle"));
    var overflow = particles.length + requiredSlots - maxParticles;
    if (overflow <= 0) return;
    
    for (var k = 0; k < overflow; k++) {
      if (particles[k]) {
        particles[k].remove();
      }
    }
  }

  function play(input) {
    input = typeof input === 'object' ? input : { type: 'correct', combo: Number(input) || 0 };
    var el = layer();
    if (!el || document.body.classList.contains('is-admin-mode')) {
      return input.type;
    }

    var item = input.selectedCat || cat(input.catId);
    var colors = palette(item);
    var combo = Math.max(0, Number(input.combo) || 0);
    var correct = input.type !== 'wrong';
    
    // 동작 감소 설정 감지
    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 13. 파티클 생성 및 마운트 공통 유틸 함수
    function spawn(svgContent, size, color, isSpecial, isLegendary) {
      var p = document.createElement('div');
      p.className = 'combo-particle' + (isSpecial ? ' is-special' : '') + (isLegendary ? ' is-legendary' : '');
      p.innerHTML = svgContent;

      // 14. 뷰포트 내부 안쪽 생성 위치 계산 분산
      var qElement = document.querySelector('.question-text, #question');
      var optElement = document.getElementById('options-container');
      var catElement = document.getElementById('lobby-selected-cat') || document.getElementById('skill-hud');
      
      var qRect = qElement ? qElement.getBoundingClientRect() : null;
      var optRect = optElement ? optElement.getBoundingClientRect() : null;
      var catRect = catElement ? catElement.getBoundingClientRect() : null;

      var pxX = window.innerWidth / 2;
      var pxY = window.innerHeight * 0.45;
      
      var roll = Math.random();
      if (roll < 0.25 && qRect) { // 문제 영역 주변
        pxX = qRect.left + Math.random() * qRect.width;
        pxY = qRect.top - 20 + Math.random() * (qRect.height + 40);
      } else if (roll < 0.5 && optRect) { // 문제와 보기 영역 사이
        pxX = optRect.left + Math.random() * optRect.width;
        pxY = optRect.top - 50 + Math.random() * 30;
      } else if (roll < 0.75 && catRect) { // 대표 고양이 주변
        pxX = catRect.left + Math.random() * catRect.width;
        pxY = catRect.top - 15 + Math.random() * (catRect.height + 30);
      } else { // 화면 중앙 좌우 분산
        pxX = (window.innerWidth * 0.2) + Math.random() * (window.innerWidth * 0.6);
        pxY = (window.innerHeight * 0.35) + Math.random() * (window.innerHeight * 0.35);
      }

      // 화면 가장자리 잘림 완전 차단 (뷰포트 범위 제한)
      pxX = Math.max(38, Math.min(pxX, window.innerWidth - 70));
      pxY = Math.max(50, Math.min(pxY, window.innerHeight - 95));

      var duration = 950 + Math.random() * 500;
      p.style.left = pxX + 'px';
      p.style.top = pxY + 'px';
      p.style.setProperty('--particle-size', size + 'px');
      p.style.setProperty('--particle-color', color);
      p.style.setProperty('--drift-x', (-95 + Math.random() * 190) + 'px');
      p.style.setProperty('--drift-y', (-60 - Math.random() * 100) + 'px');
      p.style.setProperty('--start-rotation', (-22 + Math.random() * 44) + 'deg');
      p.style.setProperty('--end-rotation', (-38 + Math.random() * 76) + 'deg');
      p.style.setProperty('--particle-duration', duration + 'ms');

      el.appendChild(p);

      // 애니메이션 삭제 및 안전 타이머 백업
      p.addEventListener('animationend', function(e) { e.currentTarget.remove(); }, { once: true });
      var t = setTimeout(function(){
        if (p.parentNode) p.parentNode.removeChild(p);
      }, duration + 300);
      global.nyankoEffectTimers.push(t);
    }

    if (!correct) {
      // 오답 시 붉은 발바닥
      var wrongCount = reduced ? 2 : 4;
      trimOldParticles(wrongCount);
      for (var w = 0; w < wrongCount; w++) {
        spawn(SVG_SHAPES.paw, 40, '#ff4d6d', false, false);
      }
      return '아쉬워요. 다시 집중!';
    }

    // 정답 시 플랜 연산 분리
    var profile = resolveCatEffectProfile(item);
    var plan = createComboEffectPlan({ comboCount: combo, effectProfile: profile });
    var requiredSlots = plan.pawCount + plan.specialCountA + plan.specialCountB;

    // 13. 디버그 및 검증을 위한 active 노드 개수 추적
    var activeBefore = document.querySelectorAll(".combo-particle").length;

    // 오래된 파티클 트리밍 실행
    trimOldParticles(requiredSlots);

    // 1. 기본 발바닥 생성 (일반·희귀·영웅·전설 공통)
    var colorsPool = NEON_PAW_COLORS.slice();
    if (colors.primary && colorsPool.indexOf(colors.primary) < 0) {
      colorsPool.unshift(colors.primary);
    }
    for (var i = 0; i < plan.pawCount; i++) {
      // 12. 기본 발바닥 크기 (38~60px)
      var pSize = 38 + Math.random() * 22;
      var pColor = colorsPool[i % colorsPool.length];
      spawn(SVG_SHAPES.paw, pSize, pColor, false, false);
    }

    // 2. 영웅 특성 생성
    if (profile.rarity === 'hero' && profile.specialShapes.length > 0) {
      var spec = profile.specialShapes[0];
      var specSvg = SVG_SHAPES[spec.shape];
      if (specSvg) {
        for (var h = 0; h < plan.specialCountA; h++) {
          // 12. 영웅 특성 크기 (46~70px)
          var hSize = 46 + Math.random() * 24;
          spawn(specSvg, hSize, spec.color, true, false);
        }
      }
    }

    // 3. 전설 특성 2종 생성
    if (profile.rarity === 'legendary' && profile.specialShapes.length >= 2) {
      var specA = profile.specialShapes[0];
      var specB = profile.specialShapes[1];
      var svgA = SVG_SHAPES[specA.shape];
      var svgB = SVG_SHAPES[specB.shape];

      if (svgA) {
        for (var la = 0; la < plan.specialCountA; la++) {
          // 12. 전설 특성 크기 (50~78px)
          var lSizeA = 50 + Math.random() * 28;
          spawn(svgA, lSizeA, specA.color, true, true);
        }
      }
      if (svgB) {
        for (var lb = 0; lb < plan.specialCountB; lb++) {
          var lSizeB = 50 + Math.random() * 28;
          spawn(svgB, lSizeB, specB.color, true, true);
        }
      }
    }

    var activeAfter = document.querySelectorAll(".combo-particle").length;

    // 13. 개발 검증 디버그 로그 한 줄 출력
    console.debug("[Combo Effect]", {
      comboCount: combo,
      pawCount: plan.pawCount,
      specialCountA: plan.specialCountA,
      specialCountB: plan.specialCountB,
      totalRequested: requiredSlots,
      activeBefore: activeBefore,
      activeAfter: activeAfter
    });

    // 텍스트 정답 팝업 이펙트 바인딩
    var target = input.gameArea || document.querySelector('.active-screen .question-box,.active-screen #question');
    if (target) {
      var cls = 'question-flash-correct';
      target.classList.remove(cls);
      void target.offsetWidth;
      target.classList.add(cls);
    }

    return combo === 10 ? '10콤보! 대단하다냥!' : '정답이다냥!';
  }

  v2.effectService = {
    play: play,
    playCorrect: function(combo) { return play({ type: 'correct', combo: combo }); },
    playWrong: function() { return play({ type: 'wrong' }); },
    clear: clear,
    resolveCatEffectProfile: resolveCatEffectProfile,
    resolvePalette: function(id) { return palette(cat(id)); }
  };

  global.GameFeedback = { play: play };

  var d = global.NyankoDebug = global.NyankoDebug || {};
  Object.assign(d, {
    testFullScreenEffect: function(catId, combo, type) {
      return play({ catId: catId, combo: combo, type: type || 'correct' });
    },
    clearAllEffectParticles: clear,
    printResolvedEffectPalette: function(catId) {
      return palette(cat(catId));
    },
    testCorrectEffect: function() {
      return play({ type: 'correct', combo: 10 });
    }
  });

})(window);
