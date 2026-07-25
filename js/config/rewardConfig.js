(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  global.GugudanV2.rewardConfig = {
    normalFirstClear:{coins:100,normalTickets:1,premiumTickets:0},
    normalRepeatClear:{coins:20,normalTickets:0,premiumTickets:0},
    midBossFirstClear:{coins:200,normalTickets:1,premiumTickets:1},
    finalBossFirstClear:{coins:300,normalTickets:0,premiumTickets:1},
    starMilestones:{1:20,2:30,3:50}, rewardedSessionLimit:100
  };
})(window);
