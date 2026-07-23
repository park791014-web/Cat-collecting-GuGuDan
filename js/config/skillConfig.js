(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  global.GugudanV2.skillConfig = { enabled:true, rankedTimeAttackPolicy:'cosmetic_only', shieldResetsCombo:true,
    skills:{combo_special_meow:{enabled:true,modes:['classic','timeAttack','adventure'],cosmetic:true},first_mistake_guard:{enabled:true,modes:['adventure']},remove_wrong_option:{enabled:true,modes:['classic','adventure']},time_bonus:{enabled:true,modes:['adventure'],seconds:2},legendary_boss_roar:{enabled:true,modes:['adventure'],cosmetic:true},single_revive:{enabled:true,modes:['adventure'],reviveLives:1},season_moon_meow:{enabled:true,modes:['classic','timeAttack','adventure'],cosmetic:true},season_blue_moon_roar:{enabled:true,modes:['adventure'],cosmetic:true}}
  };
})(window);
