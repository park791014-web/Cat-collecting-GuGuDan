(function(global){
  'use strict';
  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  var maxParticles = 40;
  
  // global 타이머 추적 리스트
  global.nyankoEffectTimers = global.nyankoEffectTimers || [];

  var SVG_SHAPES = {
    paw: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path fill="currentColor" stroke="#fff" stroke-width="4" d="M50 40c8 0 15-7 15-15s-7-15-15-15-15 7-15 15 7 15 15 15zm-25 15c6 0 11-5 11-11s-5-11-11-11-11 5-11 11 5 11 11 11zm50 0c6 0 11-5 11-11s-5-11-11-11-11 5-11 11 5 11 11 11zM50 55c-15 0-25 10-25 22 0 7 7 11 25 11s25-4 25-11c0-12-10-22-25-22z"/></svg>',
    lightning: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path fill="currentColor" stroke="#fff" stroke-width="4" d="M60 10 L30 50 L55 50 L40 90 L75 45 L50 45 Z"/></svg>',
    shield: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path fill="currentColor" stroke="#fff" stroke-width="4" d="M50 15 L80 25 V55 C80 72 50 85 50 85 C50 85 20 72 20 55 V25 Z"/></svg>',
    wisdom: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path fill="currentColor" stroke="#fff" stroke-width="4" d="M20 25 H50 V75 H20 Z M50 25 H80 V75 H50 Z M20 35 H80 M20 48 H80 M20 62 H80"/></svg>',
    clock: '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="8"/><circle cx="50" cy="50" r="35" stroke="#fff" stroke-width="2" fill="none"/><path d="M50 22 V50 H70" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M50 22 V50 H70" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
    dollar: '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-width="2"/><text x="50" y="68" font-size="52" font-family="Arial, sans-serif" font-weight="900" text-anchor="middle" fill="currentColor" stroke="#fff" stroke-width="2">$</text></svg>',
    heart: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path fill="currentColor" stroke="#fff" stroke-width="4" d="M50 80 C50 80 15 55 15 35 C15 20 28 15 38 25 C45 32 50 38 50 38 C50 38 55 32 62 25 C72 15 85 20 85 35 C85 55 50 80 50 80 Z"/></svg>'
  };

  var NEON_PAW_COLORS = [
    "#39ff14", // 네온 그린
    "#00f5ff", // 네온 블루
    "#ff4dff", // 네온 핑크
    "#ffe600", // 네온 옐로
    "#ff5f1f", // 네온 오렌지
    "#7b61ff"  // 네온 퍼플
  ];

  var HERO_EFFECT_MAP = {
    base_hero_01: "lightning",
    base_hero_02: "shield",
    base_hero_03: "wisdom",
    base_hero_04: "clock"
  };

  var LEGENDARY_EFFECT_MAP = {
    base_legendary_01: "dollar",
    base_legendary_02: "heart"
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

  // 5-4. 이펙트 해석 함수 통합
  function resolveCatEffectProfile(item) {
    if (!item) {
      return {
        baseShape: "paw",
        specialShape: null
      };
    }
    var special = HERO_EFFECT_MAP[item.id] || LEGENDARY_EFFECT_MAP[item.id] || null;
    return {
      baseShape: "paw",
      specialShape: special
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
    
    // 공식 타임어택/성능 제어 정책 지원 (감소 모드 대응)
    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 파티클 지우기
    var currentNodes = el.querySelectorAll('.effect-particle');
    if (currentNodes.length > maxParticles) {
      for (var k = 0; k < currentNodes.length - maxParticles; k++) {
        currentNodes[k].remove();
      }
    }

    if (!correct) {
      // 오답 시 기존 파티클 렌더링
      var wrongCount = reduced ? 2 : 4;
      for (var w = 0; w < wrongCount; w++) {
        var pWrong = document.createElement('span');
        pWrong.className = 'effect-particle effect-particle--wrong';
        pWrong.style.setProperty('--x', (20 + Math.random() * 60) + 'vw');
        pWrong.style.setProperty('--y', (30 + Math.random() * 40) + 'vh');
        pWrong.style.setProperty('--dx', (-30 + Math.random() * 60) + 'px');
        pWrong.style.setProperty('--dy', (60 + Math.random() * 60) + 'px');
        pWrong.style.setProperty('--size', '20px');
        pWrong.style.setProperty('--delay', '0ms');
        pWrong.style.setProperty('--duration', '800ms');
        pWrong.style.setProperty('--particle-color', '#ff4d6d');
        pWrong.innerHTML = SVG_SHAPES.paw;
        pWrong.style.position = 'fixed';
        pWrong.style.pointerEvents = 'none';
        pWrong.style.filter = 'drop-shadow(0 0 6px #ff4d6d)';
        el.appendChild(pWrong);
        pWrong.addEventListener('animationend', function(e){ e.currentTarget.remove(); }, { once: true });
      }
      return '아쉬워요. 다시 집중!';
    }

    // 정답 시
    var profile = resolveCatEffectProfile(item);
    var isSpecial = !!profile.specialShape;

    // 기본 형광 발바닥 파티클 수 계산
    var pawCount = Math.max(1, Math.min(combo, 24));
    if (reduced) pawCount = Math.max(1, Math.min(pawCount, 4));

    // 색상 순환 풀 구성
    var colorsPool = NEON_PAW_COLORS.slice();
    if (colors.primary && colorsPool.indexOf(colors.primary) < 0) {
      colorsPool.unshift(colors.primary);
    }

    // 1. 기본 발바닥 생성
    for (var i = 0; i < pawCount; i++) {
      var p = document.createElement('span');
      p.className = 'effect-particle effect-particle--correct';
      p.innerHTML = SVG_SHAPES.paw;
      
      var neonColor = colorsPool[i % colorsPool.length];
      
      p.style.setProperty('--x', (10 + Math.random() * 80) + 'vw');
      p.style.setProperty('--y', (20 + Math.random() * 60) + 'vh');
      p.style.setProperty('--dx', (-100 + Math.random() * 200) + 'px');
      p.style.setProperty('--dy', (-150 - Math.random() * 100) + 'px');
      p.style.setProperty('--size', (24 + Math.random() * 20 + Math.min(combo, 15) * 0.4) + 'px');
      p.style.setProperty('--delay', (Math.random() * 150) + 'ms');
      p.style.setProperty('--duration', (850 + Math.random() * 500) + 'ms');
      p.style.setProperty('--particle-color', neonColor);
      
      p.style.position = 'fixed';
      p.style.pointerEvents = 'none';
      p.style.filter = 'drop-shadow(0 0 10px ' + neonColor + ')';
      
      el.appendChild(p);
      p.addEventListener('animationend', function(e){ e.currentTarget.remove(); }, { once: true });
    }

    // 2. 영웅·전설 특성 모양 추가 생성 (기본 발바닥을 대체하지 않음)
    if (isSpecial) {
      var specialCount = Math.min(8, Math.max(1, Math.ceil(combo / 3)));
      if (reduced) specialCount = 1;
      
      var specialSvg = SVG_SHAPES[profile.specialShape];
      
      if (specialSvg) {
        for (var j = 0; j < specialCount; j++) {
          var sp = document.createElement('span');
          sp.className = 'effect-particle effect-particle--correct';
          sp.innerHTML = specialSvg;
          
          var spColor = colors.secondary || colors.primary || '#ffffff';
          
          sp.style.setProperty('--x', (10 + Math.random() * 80) + 'vw');
          sp.style.setProperty('--y', (20 + Math.random() * 60) + 'vh');
          sp.style.setProperty('--dx', (-120 + Math.random() * 240) + 'px');
          sp.style.setProperty('--dy', (-180 - Math.random() * 120) + 'px');
          sp.style.setProperty('--size', (28 + Math.random() * 24 + Math.min(combo, 15) * 0.5) + 'px');
          sp.style.setProperty('--delay', (50 + Math.random() * 200) + 'ms');
          sp.style.setProperty('--duration', (900 + Math.random() * 600) + 'ms');
          sp.style.setProperty('--particle-color', spColor);
          
          sp.style.position = 'fixed';
          sp.style.pointerEvents = 'none';
          sp.style.filter = 'drop-shadow(0 0 12px ' + spColor + ')';
          
          el.appendChild(sp);
          sp.addEventListener('animationend', function(e){ e.currentTarget.remove(); }, { once: true });
        }
      }
    }

    // 화면 번쩍임 효과 (전설 고양이 고유 효과)
    if (item && item.rarity === 'legendary') {
      var flash = document.createElement('div');
      flash.style.position = 'fixed';
      flash.style.inset = '0';
      flash.style.backgroundColor = colors.primary || '#ffd84d';
      flash.style.opacity = '0.12';
      flash.style.pointerEvents = 'none';
      flash.style.zIndex = '1900';
      el.appendChild(flash);
      
      var fTimer = setTimeout(function(){
        if (flash.parentNode) flash.parentNode.removeChild(flash);
      }, 250);
      global.nyankoEffectTimers.push(fTimer);
    }

    // 텍스트 반응 적용
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
