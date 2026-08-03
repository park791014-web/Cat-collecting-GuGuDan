const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.window = global;
global.GugudanV2 = {};
['js/config/seasonConfig.js', 'js/config/cardPackConfig.js', 'js/data/cats.js', 'js/data/seasonCats.js', 'js/data/seasons.js', 'js/services/cardPackService.js'].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }));
const v2 = global.GugudanV2;
const expected = [
  ['summer_2026_heatwave_flame_cat', '폭염불꽃냥이', 'legendary', 'heatwave-flame-cat.jpg'],
  ['summer_2026_bikini_cat', '비키니 냥이', 'hero', 'bikini-cat.jpg'],
  ['summer_2026_watermelon_cat', '수박냥이', 'rare', 'watermelon-cat.jpg'],
  ['summer_2026_icecream_cat', '아이스크림 냥이', 'rare', 'icecream-cat.jpg']
];
const ids = v2.seasonCats.map(cat => cat.id);
assert.equal(new Set(ids).size, ids.length, 'duplicate cat ids');
expected.forEach(([id, name, rarity, filename]) => {
  const cat = v2.seasonCats.find(item => item.id === id);
  assert(cat, id + ' missing');
  assert.equal(cat.displayName, name);
  assert.equal(cat.rarity, rarity);
  assert.equal(cat.collection, 'season');
  assert.equal(cat.seasonId, 'summer_2026');
  assert(cat.description);
  assert.equal(cat.image, 'assets/cats/seasons/summer_2026/' + filename);
  assert(fs.existsSync(cat.image), cat.image + ' missing');
  assert(!/[\sA-Z]/.test(filename), 'asset filename must remain lowercase without spaces');
});
const pickup = v2.cardPackService.getPremiumPickup();
assert(pickup.active && pickup.season.id === 'summer_2026');
assert.equal(pickup.title, '2026 여름 시즌 뽑기');
assert.equal(pickup.subtitle, '한여름 냥캉스');
assert.deepStrictEqual(v2.cardPackConfig.premiumPack.rarityRates, { normal: .45, rare: .35, hero: .17, legendary: .03 });
assert.equal(v2.cardPackService.getPremiumCandidates('normal').some(entry => entry.cat.seasonId === 'summer_2026'), false);
['rare', 'hero', 'legendary'].forEach(rarity => {
  const entries = v2.cardPackService.getPremiumCandidates(rarity);
  assert(entries.filter(entry => entry.cat.collection === 'base').every(entry => entry.weight === 1));
  assert(entries.filter(entry => entry.cat.seasonId === 'summer_2026').every(entry => entry.weight === 2));
  assert(!entries.some(entry => entry.cat.seasonId === 'season_01'));
});
const rare = v2.cardPackService.getPremiumCandidates('rare');
const watermelon = rare.find(entry => entry.cat.id === 'summer_2026_watermelon_cat');
const icecream = rare.find(entry => entry.cat.id === 'summer_2026_icecream_cat');
assert(watermelon && icecream && watermelon.weight === 2 && icecream.weight === 2);
assert.equal(v2.cardPackService.selectWeightedCat([{ cat: { id: 'a' }, weight: 1 }, { cat: { id: 'b' }, weight: 2 }], 0).id, 'a');
assert.equal(v2.cardPackService.selectWeightedCat([{ cat: { id: 'a' }, weight: 1 }, { cat: { id: 'b' }, weight: 2 }], .34).id, 'b');
const app = fs.readFileSync('js/app.js', 'utf8');
assert.match(app, /currencyKey = 'premiumTickets'/);
assert.match(app, /getPremiumCandidates\(chosenRarity\)/);
assert.match(app, /selectWeightedCat\(premiumCandidates\)/);
assert.match(app, /function getAllCatalogCats\(\)/);
global.document = {
  body: { appendChild() {} },
  getElementById() { return { querySelectorAll() { return []; } }; },
  querySelectorAll() { return []; },
  createElement() { return {}; }
};
global.MutationObserver = function () { this.observe = function () {}; };
v2.coinDrawService = { draw() {}, validate() {} };
v2.storageService = { loadSaveData() { return { pendingDrawReveal: null, collection: { ownedCatIds: [] } }; }, saveSaveData() {} };
vm.runInThisContext(fs.readFileSync('js/ui/collectionController.js', 'utf8'), { filename: 'js/ui/collectionController.js' });
const baseOwned = v2.baseCats.slice(0, 19).map(cat => cat.id);
const emptySummer = v2.collectionSummaryService.getSummary({ collection: { ownedCatIds: baseOwned } });
assert.equal(emptySummer.ownedCount, 19);
assert.equal(emptySummer.baseOwned, 19);
assert.equal(emptySummer.baseTotal, v2.baseCats.length);
assert.equal(emptySummer.seasonOwned, 0);
assert.equal(emptySummer.seasonTotal, 4);
assert.match(emptySummer.detailText, /2026 여름 시즌 0\/4/);
const oneSummer = v2.collectionSummaryService.getSummary({ collection: { ownedCatIds: baseOwned.concat('summer_2026_watermelon_cat', 'summer_2026_watermelon_cat') } });
assert.equal(oneSummer.ownedCount, 20);
assert.equal(oneSummer.baseOwned, 19);
assert.equal(oneSummer.seasonOwned, 1);
assert.match(oneSummer.detailText, /2026 여름 시즌 1\/4/);
vm.runInThisContext(fs.readFileSync('js/ui/phase54Controller.js', 'utf8'), { filename: 'js/ui/phase54Controller.js' });
const premiumHtml = v2.gachaUiRenderer.renderPremiumPickup({ currency: { premiumTickets: 1 } }, v2.cardPackConfig.premiumPack);
assert.match(premiumHtml, /2026 여름 시즌 뽑기/);
assert.match(premiumHtml, /한여름 냥캉스/);
assert.match(premiumHtml, /같은 등급에서 등장 확률 2배!/);
assert.match(premiumHtml, /등급별 확률은 기존 고급 뽑기와 동일합니다./);
assert.match(premiumHtml, /고급 뽑기권 1장 사용/);
expected.forEach(([, name, , filename]) => {
  assert.match(premiumHtml, new RegExp(name));
  assert.match(premiumHtml, new RegExp(filename));
});
const style = fs.readFileSync('css/style.css', 'utf8');
assert.match(style, /\.summer-pickup-preview \.rarity-badge\{display:none\}/);
assert(!/^\.rarity-badge\{display:none\}/m.test(style), 'global rarity badges must remain visible');
assert.match(style, /\.summer-season-banner>img\{left:auto;right:0;width:58%;object-fit:contain;object-position:right center/);
assert.match(style, /@media\(max-width:360px\)\{\.summer-season-banner\{min-height:190px\}\.summer-season-banner>img\{width:66%;object-position:right center/);
vm.runInThisContext(fs.readFileSync('js/services/seasonService.js', 'utf8'), { filename: 'js/services/seasonService.js' });
global.NyankoDebug.setSeasonDateForTesting('2026-08-04T00:00:00+09:00');
function element(tagName) {
  return {
    tagName,
    children: [],
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren() { this.children = []; },
    querySelector(selector) {
      if (selector === 'img') return this.children.find(child => child.tagName === 'img') || null;
      return null;
    }
  };
}
const bannerSlot = element('div');
global.document = {
  body: { appendChild() {} },
  getElementById(id) { return id === 'season-banner-slot' ? bannerSlot : null; },
  querySelector(selector) { return selector === '#pack-list .summer-pickup [data-draw-type="premiumTicket"]' ? { focus() {} } : null; },
  createElement: element
};
v2.storageService.loadSaveData = function () { return { collection: { ownedCatIds: baseOwned }, pendingDrawReveal: null }; };
let openPackCalls = 0;
global.openCardPackScreen = function () { openPackCalls += 1; };
global.setTimeout = function (callback) { callback(); };
vm.runInThisContext(fs.readFileSync('js/ui/summerSeasonBannerController.js', 'utf8'), { filename: 'js/ui/summerSeasonBannerController.js' });
v2.summerSeasonBanner.render();
assert.equal(bannerSlot.children.length, 1);
const banner = bannerSlot.children[0];
assert.equal(banner.className, 'season-banner summer-season-banner');
assert.equal(banner.children[0].src, 'assets/cats/seasons/summer_2026/heatwave-flame-cat.jpg');
assert.match(banner.children[1].innerHTML, /2026 여름 시즌/);
assert.match(banner.children[1].innerHTML, /한여름 냥캉스/);
assert.match(banner.children[1].innerHTML, /2026\.08\.04~09\.03/);
assert.match(banner.children[1].innerHTML, /수집 0\/4/);
assert.equal(banner.children[2].type, 'button');
banner.children[2].onclick();
assert.equal(openPackCalls, 1);
assert.equal(v2.summerSeasonBanner.openPremiumPickup(), true);
assert.equal(openPackCalls, 2);
assert.equal(v2.seasons.find(season => season.id === 'summer_2026').startAt, '2026-08-04T00:00:00+09:00');
assert.equal(v2.seasons.find(season => season.id === 'summer_2026').endAt, '2026-09-03T23:59:59+09:00');
assert.equal(v2.seasonService.getActiveSeason().id, 'summer_2026');
assert.equal(v2.seasonService.getSeasonStatus(v2.seasonService.getActiveSeason()).status, 'active');
assert.equal(v2.seasonService.getSeasonStatus(v2.seasonService.getActiveSeason(), '2026-09-04T00:00:00+09:00').status, 'ended');
assert.equal(v2.seasons.find(season => season.id === 'season_01').enabled, false);
const index = fs.readFileSync('index.html', 'utf8');
assert.match(index, /phase54Controller\.js\?v=phase64-summer-pickup/);
assert.match(index, /featureFlags\.js\?v=phase64-summer-pickup/);
assert.match(index, /summerSeasonBannerController\.js\?v=phase64-summer-banner/);
console.log(JSON.stringify({ passed: true, cases: ['catalog', 'assets', 'premium_rates', 'normal_pool_excludes_summer', 'summer_pickup_pool', 'weights', 'boundary_selection', 'premium_transaction', 'home_summary_empty_season', 'home_summary_owned_season', 'actual_premium_renderer', 'summer_banner_renderer', 'summer_banner_button', 'summer_period', 'cache_bust'] }));
