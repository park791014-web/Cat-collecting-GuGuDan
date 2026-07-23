(function(global){
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  var maxParticles = 40;
  
  // global 타이머 추적 리스트
  global.nyankoEffectTimers = global.nyankoEffectTimers || [];

  var SVG_SHAPES = {
    // 11. 특성 아이콘 제작 기준 (투명 배경, 굵은 실루엣, rect 없음)
    paw: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 40c8 0 15-7 15-15s-7-15-15-15-15 7-15 15 7 15 15 15zm-25 15c6 0 11-5 11-11s-5-11-11-11-11 5-11 11 5 11 11 11zm50 0c6 0 11-5 11-11s-5-11-11-11-11 5-11 11 5 11 11 11zM50 55c-15 0-25 10-25 22 0 7 7 11 25 11s25-4 25-11c0-12-10-22-25-22z"/></svg>',
    lightning: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M60 10 L28 52 L54 52 L38 90 L72 46 L48 46 Z"/></svg>',
    shield: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 12 L82 22 V54 C82 72 50 88 50 88 C50 88 18 72 18 54 V22 Z M50 20 L26 28 V52 C26 66 50 78 50 78 C50 78 74 66 74 52 V28 Z"/></svg>',
    bookLight: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M16 22 C16 22 35 18 50 26 C65 18 84 22 84 22 V76 C84 76 65 72 50 80 C35 72 16 76 16 76 Z M50 26 V80 M24 34 H42 M24 46 H42 M24 58 H42 M58 34 H76 M58 46 H76 M58 58 H76"/></svg>',
    clock: '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="38" fill="none" stroke-width="8"/><circle cx="50" cy="50" r="28" fill="none" stroke-width="2"/><path d="M50 22 V50 H70" fill="none" stroke-width="7" stroke-linecap="round"/></svg>',
    coin: '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="38" fill="none" stroke-width="6"/><circle cx="50" cy="50" r="24" fill="none" stroke-width="2"/><path d="M50 18 V30 M50 70 V82 M18 50 H30 M70 50 H82" stroke-width="5" stroke-linecap="round"/></svg>',
    dollar: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 10 V90 M32 30 C32 20, 68 15, 68 32 C68 46, 32 44, 32 58 C32 75, 68 78, 68 62" fill="none" stroke-width="10" stroke-linecap="round"/></svg>',
    heart: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 82 C50 82 14 55 14 34 C14 18 27 12 38 23 C45 30 50 36 50 36 C50 36 55 30 62 23 C73 12 86 18 86 34 C86 55 50 82 50 82 Z"/></svg>',
    // 생명 오라 / 불꽃 형태의 SVG path
    lifeFlame: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 90 C25 90 12 70 12 45 C12 25 32 8 50 8 C68 8 88 25 88 45 C88 70 75 90 50 90 Z M50 80 C62 80 72 65 72 45 C72 32 58 20 50 20 C42 20 28 32 28 45 C28 65 38 80 50 80 Z M50 70 C42 66 38 58 38 48 C38 38 46 30 50 30 C54 30 62 38 62 48 C62 58 58 66 50 70 Z"/></svg>'
  };

  var NEON_PAW_COLORS = [
    "#39ff14", // 네온 그린
    "#00f5ff", // 네온 블루
    "#ff4dff", // 네온 핑크
    "#ffe600", // 네온 옐로
    "#ff5f1f", // 네온 오렌지
    "#8b5cff"  // 네온 퍼플 (사용자 지정 색상 코드 적용)
  ];

  var HERO_EFFECT_MAP = {
    base_hero_01: { shape: "lightning", color: "#f5ff45" },
    base_hero_02: { shape: "shield", color: "#45d7ff" },
    base_hero_03: { shape: "bookLight", color: "#c566ff" },
    base_hero_04: { shape: "clock", color: "#63fff2" }
  };

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

    // 매핑 누락된 전설 고양이 경고
    if (item.rarity === 'legendary') {
      console.warn("[Cat Effect] Legendary effect mapping missing:", item.id);
    }

    return {
      rarity: item.rarity || "normal",
      baseShape: "paw",
      specialShapes: []
    };
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
    
    // 동작 감소 설정 대응 (대응 정책 유지)
    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 파티클 생성 함수
    function createParticle(svgContent, size, color, isSpecial, isLegendary) {
      // 17. 파티클 수 제한 (최대 40개)
      var currentNodes = el.querySelectorAll('.combo-particle');
      if (currentNodes.length >= maxParticles) {
        // 가장 오래된 것 삭제
        var removeCount = (currentNodes.length - maxParticles) + 1;
        for (var k = 0; k < removeCount; k++) {
          if (currentNodes[k]) currentNodes[k].remove();
        }
      }

      var p = document.createElement('div');
      p.className = 'combo-particle' + (isSpecial ? ' is-special' : '') + (isLegendary ? ' is-legendary' : '');
      p.innerHTML = svgContent;

      // 14. 생성 위치 분산 (잘림 방지 뷰포트 내부 제한)
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
        pxY = qRect.top - 30 + Math.random() * (qRect.height + 60);
      } else if (roll < 0.5 && optRect) { // 문제와 보기 영역 사이
        pxX = optRect.left + Math.random() * optRect.width;
        pxY = optRect.top - 60 + Math.random() * 40;
      } else if (roll < 0.75 && catRect) { // 대표 고양이 주변
        pxX = catRect.left + Math.random() * catRect.width;
        pxY = catRect.top - 20 + Math.random() * (catRect.height + 40);
      } else { // 화면 중앙 좌우 분산
        pxX = (window.innerWidth * 0.15) + Math.random() * (window.innerWidth * 0.7);
        pxY = (window.innerHeight * 0.3) + Math.random() * (window.innerHeight * 0.45);
      }

      // 화면 경계 안전 보장 (가장자리 잘림 차단)
      pxX = Math.max(35, Math.min(pxX, window.innerWidth - 65));
      pxY = Math.max(50, Math.min(pxY, window.innerHeight - 90));

      // 13. 무작위 이동 변수 설정
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

      // 17. 파티클 안전 제거 리스너 및 타이머
      p.addEventListener('animationend', function(e) { e.currentTarget.remove(); }, { once: true });
      var t = setTimeout(function(){
        if (p.parentNode) p.parentNode.removeChild(p);
      }, duration + 300);
      global.nyankoEffectTimers.push(t);
    }

    if (!correct) {
      // 오답 시 붉은 발바닥 4개 흩뿌림
      var wrongCount = reduced ? 2 : 4;
      for (var w = 0; w < wrongCount; w++) {
        createParticle(SVG_SHAPES.paw, 40, '#ff4d6d', false, false);
      }
      return '아쉬워요. 다시 집중!';
    }

    // 정답 시
    var profile = resolveCatEffectProfile(item);
    
    // 6. 기본 발바닥 생성 (일반·희귀·기본 콤보 수 비례)
    var pawCount = Math.max(1, Math.min(combo, 24));
    if (reduced) pawCount = Math.max(1, Math.min(pawCount, 4));

    var colorsPool = NEON_PAW_COLORS.slice();
    if (colors.primary && colorsPool.indexOf(colors.primary) < 0) {
      colorsPool.unshift(colors.primary);
    }

    for (var i = 0; i < pawCount; i++) {
      // 12. 기본 발바닥 크기 (38~60px)
      var pSize = 38 + Math.random() * 22;
      var pColor = colorsPool[i % colorsPool.length];
      createParticle(SVG_SHAPES.paw, pSize, pColor, false, false);
    }

    // 7. 영웅 고양이 특성 이펙트 추가 (형광 발바닥 + 특성 모양 1종)
    if (profile.rarity === 'hero' && profile.specialShapes.length > 0) {
      var heroSpecialCount = Math.min(8, Math.max(1, Math.ceil(combo / 3)));
      if (reduced) heroSpecialCount = 1;
      
      var spec = profile.specialShapes[0];
      var specSvg = SVG_SHAPES[spec.shape];
      if (specSvg) {
        for (var j = 0; j < heroSpecialCount; j++) {
          // 12. 영웅 특성 크기 (46~70px)
          var hSize = 46 + Math.random() * 24;
          createParticle(specSvg, hSize, spec.color, true, false);
        }
      }
    }

    // 8. 전설 고양이 특성 이펙트 A + B 추가 (형광 발바닥 + 특성 A + 특성 B)
    if (profile.rarity === 'legendary' && profile.specialShapes.length >= 2) {
      // 9. 전설 특성 파티클 수 계산 (각각 최대 7개 제한)
      var legCountA = Math.min(7, Math.max(1, Math.ceil(combo / 4)));
      var legCountB = Math.min(7, Math.max(1, Math.ceil(combo / 4)));
      if (reduced) {
        legCountA = 1;
        legCountB = 1;
      }

      var specA = profile.specialShapes[0];
      var specB = profile.specialShapes[1];
      var svgA = SVG_SHAPES[specA.shape];
      var svgB = SVG_SHAPES[specB.shape];

      if (svgA) {
        for (var a = 0; a < legCountA; a++) {
          // 12. 전설 특성 크기 (50~78px)
          var lSizeA = 50 + Math.random() * 28;
          createParticle(svgA, lSizeA, specA.color, true, true);
        }
      }
      if (svgB) {
        for (var b = 0; b < legCountB; b++) {
          var lSizeB = 50 + Math.random() * 28;
          createParticle(svgB, lSizeB, specB.color, true, true);
        }
      }
    }

    // 텍스트 반응 튀어오름
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
