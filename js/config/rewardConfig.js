(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  global.GugudanV2.rewardConfig = {
    normalFirstClear:{coins:20,normalTickets:0,premiumTickets:0},
    normalRepeatClear:{coins:20,normalTickets:0,premiumTickets:0},
    midBossFirstClear:{coins:0,normalTickets:1,premiumTickets:0},
    finalBossFirstClear:{coins:0,normalTickets:0,premiumTickets:1},
    starMilestones:{1:0,2:0,3:0}, rewardedSessionLimit:100
  };
})(window);
