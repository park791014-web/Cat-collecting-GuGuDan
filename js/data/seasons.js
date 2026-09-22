(function (global) {
  'use strict';

  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  function catIds(seasonId) {
    return (v2.seasonCats || []).filter(function (cat) { return cat.seasonId === seasonId; }).map(function (cat) { return cat.id; });
  }

  v2.seasons = [
    {
      id: 'season_01', name: '푸른 달의 러시안블루', shortName: '러시안블루 시즌',
      breed: { id: 'russian_blue', displayName: '러시안블루' }, enabled: false, previewOnly: false,
      startAt: '2026-07-01T00:00:00+09:00', endAt: '2026-10-31T23:59:59+09:00', catIds: catIds('season_01'),
      artwork: { banner: 'assets/seasons/season_01/season_banner.svg', background: 'assets/seasons/season_01/season_banner.svg', icon: 'assets/seasons/season_01/season_icon.svg' },
      audio: { theme: null, packOpen: null }, cardPack: { enabled: true, ticketType: 'seasonTickets', ticketCost: 1, rarityRates: { normal: .50, rare: .32, hero: .14, legendary: .04 } },
      missions: (v2.seasonMissions || []).map(function (mission) { return mission.id; }), entryReward: { enabled: true, seasonTickets: 1 }, afterSeasonPolicy: 'limited_return', claimGracePeriodDays: 3, displayOrder: 1
    },
    {
      id: 'summer_2026', name: '2026 여름 시즌', shortName: '여름 시즌',
      breed: { id: 'summer', displayName: '한여름 냥캉스' }, enabled: true, previewOnly: false,
      startAt: '2026-08-04T00:00:00+09:00', endAt: '2026-09-03T23:59:59+09:00', catIds: catIds('summer_2026'),
      artwork: { banner: 'assets/cats/seasons/summer_2026/heatwave-flame-cat.jpg', background: 'assets/cats/seasons/summer_2026/heatwave-flame-cat.jpg', icon: 'assets/cats/seasons/summer_2026/heatwave-flame-cat.jpg' },
      audio: { theme: null, packOpen: null }, cardPack: { enabled: false, ticketType: 'premiumTickets', ticketCost: 1, rarityRates: { normal: .45, rare: .35, hero: .17, legendary: .03 } }, missions: [], entryReward: { enabled: false }, afterSeasonPolicy: 'limited_return', claimGracePeriodDays: 3, displayOrder: 0
    },
    {
      id: 'chuseok_2026', name: '2026 추석 이벤트', shortName: '추석 이벤트',
      breed: { id: 'chuseok', displayName: '보름달 아래 고양이들' }, enabled: true, previewOnly: false,
      startAt: '2026-09-22T00:00:00+09:00', endAt: '2026-10-05T23:59:59+09:00', catIds: catIds('chuseok_2026'),
      artwork: { banner: 'assets/cats/seasons/chuseok_2026/fullmoon-guardian-cat.png', background: 'assets/cats/seasons/chuseok_2026/fullmoon-guardian-cat.png', icon: 'assets/cats/seasons/chuseok_2026/fullmoon-guardian-cat.png' },
      audio: { theme: null, packOpen: null }, cardPack: { enabled: false, ticketType: 'premiumTickets', ticketCost: 1, rarityRates: { normal: .45, rare: .35, hero: .17, legendary: .03 } }, missions: [], entryReward: { enabled: false }, afterSeasonPolicy: 'limited_return', claimGracePeriodDays: 3, displayOrder: 0
    }
  ];
})(window);
