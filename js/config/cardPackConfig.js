(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  global.GugudanV2.cardPackConfig = {
    normalPack:{label:'기본 뽑기권',ticketType:'normalTickets',ticketCost:1,rarityRates:{normal:.60,rare:.30,hero:.09,legendary:.01}},
    premiumPack:{label:'고급 뽑기권',ticketType:'premiumTickets',ticketCost:1,rarityRates:{normal:.45,rare:.35,hero:.17,legendary:.03}},
    seasonPack:{label:'시즌 뽑기권',ticketType:'seasonTickets',ticketCost:1,rarityRates:{normal:.45,rare:.35,hero:.17,legendary:.03}},
    duplicateFragments:{normal:1,rare:2,hero:4,legendary:8}
  };
})(window);
