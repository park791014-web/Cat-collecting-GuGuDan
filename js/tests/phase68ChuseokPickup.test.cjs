const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.window = global;
global.GugudanV2 = {};
[
  'js/config/seasonConfig.js',
  'js/config/catDrawConfig.js',
  'js/config/cardPackConfig.js',
  'js/data/cats.js',
  'js/data/seasonCats.js',
  'js/data/seasons.js',
  'js/services/cardPackService.js',
  'js/services/seasonService.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }));

const v2 = global.GugudanV2;
const season = v2.seasons.find(item => item.id === 'chuseok_2026');
const summer = v2.seasons.find(item => item.id === 'summer_2026');
assert(season && summer, 'both seasons must remain in the catalog');
assert.equal(v2.seasonConfig.activePremiumPickupSeasonId, 'chuseok_2026');
assert.equal(summer.endAt, '2026-09-03T23:59:59+09:00');
assert.equal(v2.seasonCats.filter(cat => cat.seasonId === 'summer_2026').length, 4);
assert.equal(season.startAt, '2026-09-22T00:00:00+09:00');
assert.equal(season.endAt, '2026-10-05T23:59:59+09:00');
assert.deepEqual(season.cardPack.rarityRates, v2.cardPackConfig.premiumPack.rarityRates);
assert.deepEqual(v2.cardPackConfig.premiumPack.rarityRates, { normal: 0, rare: .60, hero: .30, legendary: .10 });
assert.equal(v2.cardPackService.selectRarity(v2.cardPackConfig.premiumPack.rarityRates, 0), 'rare', 'zero-rate normal must never be selected');
assert.equal(v2.cardPackService.selectRarity(v2.cardPackConfig.premiumPack.rarityRates, .6), 'hero');
assert.equal(v2.cardPackService.selectRarity(v2.cardPackConfig.premiumPack.rarityRates, .95), 'legendary');
assert.match(fs.readFileSync('js/app.js', 'utf8'), /if \(rand < cumulative\)/, 'authenticated draw must skip zero-rate rarity');
assert.match(fs.readFileSync('js/app.js', 'utf8'), /let chosenRarity = 'legendary'/, 'rounding fallback must not select zero-rate normal');

const expected = [
  ['chuseok_2026_fullmoon_guardian_cat', '보름지기냥', 'legendary', 'fullmoon-guardian-cat.png'],
  ['chuseok_2026_rice_pounder_cat', '떡방아냥', 'legendary', 'rice-pounder-cat.png'],
  ['chuseok_2026_chestnut_cat', '밤토리냥', 'hero', 'chestnut-cat.png'],
  ['chuseok_2026_songpyeon_cat', '송편냥', 'hero', 'songpyeon-cat.png']
];
assert.equal(new Set(v2.seasonCats.map(cat => cat.id)).size, v2.seasonCats.length);
expected.forEach(([id, name, rarity, filename]) => {
  const cat = v2.seasonCats.find(item => item.id === id);
  assert(cat, id + ' missing');
  assert.equal(cat.displayName, name);
  assert.equal(cat.rarity, rarity);
  assert.equal(cat.seasonId, season.id);
  assert(cat.description && cat.description.length > 20);
  assert.equal(cat.image, 'assets/cats/seasons/chuseok_2026/' + filename);
  assert(fs.existsSync(cat.image));
  assert(season.catIds.includes(id));
});

global.NyankoDebug.setSeasonDateForTesting('2026-09-21T23:59:59+09:00');
assert.equal(v2.cardPackService.getPremiumPickup().active, false, 'pickup must not start early');
global.NyankoDebug.setSeasonDateForTesting('2026-09-25T12:00:00+09:00');
const pickup = v2.cardPackService.getPremiumPickup();
assert(pickup.active && pickup.season.id === season.id);
assert.equal(pickup.title, '2026 추석 이벤트 뽑기');
assert.equal(v2.seasonService.getActiveSeason().id, season.id);
['normal', 'rare'].forEach(rarity => {
  assert(v2.cardPackService.getPremiumCandidates(rarity).every(entry => entry.cat.collection === 'base'));
});
['hero', 'legendary'].forEach(rarity => {
  const entries = v2.cardPackService.getPremiumCandidates(rarity);
  assert(entries.some(entry => entry.cat.seasonId === season.id && entry.weight === 2));
  assert(!entries.some(entry => entry.cat.seasonId === summer.id));
  assert(entries.filter(entry => entry.cat.collection === 'base').every(entry => entry.weight === 1));
});
global.NyankoDebug.setSeasonDateForTesting('2026-10-06T00:00:00+09:00');
assert.equal(v2.cardPackService.getPremiumPickup().active, false, 'pickup must end on time');
assert(v2.cardPackService.getPremiumCandidates('hero').every(entry => entry.cat.collection === 'base'));
global.NyankoDebug.setSeasonDateForTesting('2026-09-25T12:00:00+09:00');

function element(tagName) {
  return {
    tagName, children: [],
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren() { this.children = []; },
    querySelector(selector) { return selector === 'img' ? this.children.find(child => child.tagName === 'img') : null; }
  };
}
const slot = element('div');
const nodes = {};
global.document = {
  body: { appendChild() {}, contains() { return false; } },
  getElementById(id) { return id === 'season-banner-slot' ? slot : (nodes[id] ||= { dataset: {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } }); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement: element
};
global.MutationObserver = function () { this.observe = function () {}; };
global.setTimeout = callback => callback();
v2.storageService = {
  loadSaveData() { return { collection: { ownedCatIds: [], duplicateCounts: {} }, currency: { coins: 500, normalTickets: 1, premiumTickets: 1 } }; },
  saveSaveData() { return true; }
};
v2.coinDrawService = { draw() {} };
let opened = 0;
global.openCardPackScreen = () => { opened += 1; };
vm.runInThisContext(fs.readFileSync('js/ui/summerSeasonBannerController.js', 'utf8'), { filename: 'js/ui/summerSeasonBannerController.js' });
v2.summerSeasonBanner.render();
assert.equal(slot.children.length, 1);
const banner = slot.children[0];
assert.equal(banner.className, 'season-banner summer-season-banner');
assert.equal(banner.children[0].children[0].textContent, season.name);
assert.match(banner.children[0].children[1].textContent, /수집 0\/4/);
assert.equal(banner.children[1].children[0].src, season.artwork.banner);
banner.children[0].children[2].onclick();
assert.equal(opened, 1);

vm.runInThisContext(fs.readFileSync('js/ui/phase54Controller.js', 'utf8'), { filename: 'js/ui/phase54Controller.js' });
global.showScreen = () => {};
global.openCardPackScreen();
const drawGuide = document.getElementById('pack-list').innerHTML;
assert.match(drawGuide, /코인 뽑기<\/h3><p>일반 50% · 희귀 30% · 영웅 15% · 전설 5%/);
assert.match(drawGuide, /기본 뽑기권<\/h3><p>일반 50% · 희귀 30% · 영웅 15% · 전설 5%/);
assert.match(drawGuide, /2026 추석 이벤트 뽑기/);
assert.match(drawGuide, /일반 0% · 희귀 60% · 영웅 30% · 전설 10%/);
const pickupHtml = v2.gachaUiRenderer.renderPremiumPickup({ currency: { premiumTickets: 1 } }, v2.cardPackConfig.premiumPack);
assert.match(pickupHtml, /summer-pickup/);
assert.match(pickupHtml, /2026 추석 이벤트 뽑기/);
expected.forEach(([, name, , filename]) => {
  assert(pickupHtml.includes(name));
  assert(pickupHtml.includes(filename));
});
assert(!pickupHtml.includes('폭염불꽃냥이'));
global.NyankoDebug.setSeasonDateForTesting('2026-10-06T00:00:00+09:00');
const endedHtml = v2.gachaUiRenderer.renderPremiumPickup({ currency: { premiumTickets: 1 } }, v2.cardPackConfig.premiumPack);
assert(!endedHtml.includes('2026 추석 이벤트'));
assert.match(endedHtml, /고급 뽑기권 1장 사용/);

const index = fs.readFileSync('index.html', 'utf8');
assert.match(index, /id="season-banner-slot"/);
assert.match(index, /코인·기본·고급 뽑기의 등급별 확률을 아래에서 확인하세요/);
assert.match(index, /seasonCats\.js\?v=phase68-chuseok-2026/);
assert.match(index, /seasons\.js\?v=2026-09-draw-rates/);
assert.match(index, /catDrawConfig\.js\?v=2026-09-draw-rates/);
assert.match(index, /cardPackConfig\.js\?v=2026-09-draw-rates/);
assert.match(index, /app\.js\?v=2026-09-draw-rates/);
assert.match(index, /seasonController\.js\?v=2026-09-draw-rates/);
assert.match(index, /cardPackService\.js\?v=phase68-chuseok-2026/);
assert.match(index, /summerSeasonBannerController\.js\?v=phase68-chuseok-2026/);
assert.match(fs.readFileSync('js/ui/phase54Controller.js', 'utf8'), /pickup\.title/);
assert.match(fs.readFileSync('js/ui/ticketDrawController.js', 'utf8'), /pickup\.title/);
const seasonGuide = fs.readFileSync('js/ui/seasonController.js', 'utf8');
assert.match(seasonGuide, /Object\.keys\(s\.cardPack\.rarityRates\)/);
assert.match(seasonGuide, /pack\.disabled=!s\.cardPack\.enabled/);
assert(!seasonGuide.includes('확률 · 일반 50% · 희귀 32% · 영웅 14% · 전설 4%'));
console.log(JSON.stringify({ passed: true, season: season.id, cats: expected.length, summerPreserved: true, datesEnforced: true, bannerReused: true }));
