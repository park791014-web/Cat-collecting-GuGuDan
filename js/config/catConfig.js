(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  global.GugudanV2.catConfig = Object.freeze({
    rarities: ['normal', 'rare', 'hero', 'legendary'],
    legacyRankMap: { N: 'normal', R: 'rare', SR: 'hero', UR: 'legendary' },
    placeholderImage: ''
  });
})(window);
