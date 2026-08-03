const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.window = global;
global.GugudanV2 = {};

function Element(tagName) {
  this.tagName = tagName;
  this.children = [];
  this.dataset = {};
  this.style = { setProperty() {} };
  this.hidden = false;
}
Element.prototype.appendChild = function (child) { this.children.push(child); return child; };
Element.prototype.replaceChildren = function () { this.children = []; };
Element.prototype.querySelector = function (selector) {
  if (selector === 'img') return this.children.find(child => child.tagName === 'img') || null;
  return null;
};

['js/config/seasonConfig.js', 'js/config/cardPackConfig.js', 'js/data/cats.js', 'js/data/seasonCats.js', 'js/data/seasons.js', 'js/services/cardPackService.js', 'js/services/catAcquisitionService.js'].forEach(file => {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
});
const v2 = global.GugudanV2;
const acquisition = v2.catAcquisitionService;

assert.equal(acquisition.formatCatAcquiredDate({ seconds: 1785772800, nanoseconds: 0 }), '2026.08.04');
assert.equal(acquisition.formatCatAcquiredDate('2026-08-04T00:00:00+09:00'), '2026.08.04');
assert.equal(acquisition.formatCatAcquiredDate(new Date('2026-08-04T15:00:00Z')), '2026.08.05');
assert.equal(acquisition.getCatAcquisitionLabel({ catId: 'legacy', ownedCats: {}, catProgress: {} }), '2026.08.04 이전 획득');
assert.equal(acquisition.getCatAcquisitionLabel({ catId: 'broken', ownedCats: { broken: { acquiredAt: 'not-a-date' } }, catProgress: {} }), '획득일 기록 없음');
assert.equal(acquisition.getCatAcquiredAt({ catId: 'cat', ownedCats: { cat: { acquiredAt: '2026-08-04T00:00:00+09:00' } }, catProgress: { cat: { obtainedAt: '2020-01-01T00:00:00Z' } } }), '2026-08-04T00:00:00+09:00');
assert.equal(acquisition.getCatAcquiredAt({ catId: 'guest', ownedCats: {}, catProgress: { guest: { obtainedAt: '2026-08-04T00:00:00+09:00' } } }), '2026-08-04T00:00:00+09:00');

vm.runInThisContext(fs.readFileSync('js/services/gachaPersistenceService.js', 'utf8'), { filename: 'js/services/gachaPersistenceService.js' });
const firstTimestamp = { seconds: 1785772800, nanoseconds: 0 };
const duplicateMutation = v2.gachaPersistenceService.buildMutation({ currency: { coins: 1000 }, ownedCats: { cat: { count: 1, acquiredAt: firstTimestamp } } }, { currencyKey: 'coins', cost: 500, catId: 'cat', acquiredAt: { seconds: 1785859200 } });
assert.strictEqual(duplicateMutation.ownedCats.cat.acquiredAt, firstTimestamp);

const slot = new Element('div');
global.document = {
  body: { appendChild() {} }, activeElement: null,
  getElementById(id) { return id === 'season-banner-slot' ? slot : null; },
  querySelector(selector) { return selector === '#pack-list .summer-pickup [data-draw-type="premiumTicket"]' ? { focus() {} } : null; },
  querySelectorAll() { return []; }, createElement(tagName) { return new Element(tagName); }
};
global.MutationObserver = function () { this.observe = function () {}; };
global.setTimeout = function (callback) { callback(); };
v2.assetLoader = { applyImageFallback() {} };
v2.storageService = { loadSaveData() { return { collection: { ownedCatIds: [], catProgress: {}, duplicateCounts: {} }, profile: { selectedCatId: '' }, pendingDrawReveal: null }; }, saveSaveData() {} };
v2.coinDrawService = { draw() {}, validate() {} };
v2.releasePolicyService = { getVisibleCats() { return v2.baseCats.concat(v2.seasonCats); }, applySelectedCatPolicy() {} };
v2.seasonService = { getSeasonStatus() { return { status: 'active' }; } };
let openCalls = 0;
global.openCardPackScreen = function () { openCalls += 1; };
vm.runInThisContext(fs.readFileSync('js/ui/summerSeasonBannerController.js', 'utf8'), { filename: 'js/ui/summerSeasonBannerController.js' });
v2.summerSeasonBanner.render();
const banner = slot.children[0];
const content = banner.children[0];
assert.equal(content.className, 'summer-season-banner__content');
assert.equal(content.children[0].className, 'summer-season-banner__title');
assert.equal(content.children[2].className, 'game-button primary summer-season-banner__button');
assert.equal(banner.children[1].className, 'summer-season-banner__visual');
content.children[2].onclick();
assert.equal(openCalls, 1);

vm.runInThisContext(fs.readFileSync('js/ui/collectionController.js', 'utf8'), { filename: 'js/ui/collectionController.js' });
const save = v2.storageService.loadSaveData();
const summerCat = v2.seasonCats.find(cat => cat.seasonId === 'summer_2026');
const seasonCard = v2.collectionUiRenderer.createCollectionCard(summerCat, save);
const baseCard = v2.collectionUiRenderer.createCollectionCard(v2.baseCats[0], save);
assert.equal(seasonCard.dataset.collection, 'season');
assert.equal(seasonCard.dataset.seasonId, 'summer_2026');
assert.equal(baseCard.dataset.collection, 'base');
assert.equal(baseCard.dataset.seasonId, undefined);

const style = fs.readFileSync('css/style.css', 'utf8');
assert.match(style, /\.summer-season-banner__title\{[^}]*white-space:nowrap[^}]*word-break:keep-all/);
assert.match(style, /\.summer-season-banner__button\{position:static/);
assert(!/\.summer-season-banner__button\{position:absolute/.test(style));
assert.match(style, /\.summer-season-banner\{[^}]*height:170px[^}]*min-height:160px[^}]*max-height:190px[^}]*overflow:hidden/);
assert.match(style, /\.summer-season-banner__visual\{[^}]*position:absolute[^}]*top:0[^}]*bottom:0[^}]*width:42%[^}]*overflow:hidden/);
assert.match(style, /\.summer-season-banner__visual img\{[^}]*position:absolute[^}]*right:0[^}]*width:100%[^}]*height:100%[^}]*object-fit:contain/);
assert.match(style, /@media\(max-width:767px\)\{\.summer-season-banner\{[^}]*height:170px[^}]*min-height:145px[^}]*max-height:185px/);
assert.match(style, /\.collection-cat-row\[data-collection="season"\] img\{[^}]*width:82%!important[^}]*height:82%!important[^}]*object-fit:contain!important[^}]*padding:0!important/);
assert(!/\.collection-cat-row\[data-collection="base"\] img/.test(style));
assert(!/\.cat-detail-image[^}]*width:82%/.test(style));
assert.match(style, /\.ranking-title\{[^}]*margin:4px 0 10px!important/);
assert(!/\.screen\{[^}]*margin-top:6px/.test(style));

const app = fs.readFileSync('js/app.js', 'utf8');
const rankingMarkup = fs.readFileSync('index.html', 'utf8').match(/<div id="ranking-screen"[\s\S]*?<\/div>\s*<script/);
assert(rankingMarkup, 'ranking screen markup must remain isolated from the game container');
assert.equal((rankingMarkup[0].match(/class="ranking-title__icon"/g) || []).length, 2, 'ranking title needs balanced trophy icons');
assert.equal((rankingMarkup[0].match(/class="ranking-title__text">냥코 순위/g) || []).length, 1, 'ranking title text must remain singular');
assert.match(app, /gameContainer\.hidden = targetId === 'ranking-screen'/);
assert.match(style, /\.ranking-title\{[^}]*justify-content:center[^}]*white-space:nowrap/);
assert.match(style, /\.ranking-title__icon\{[^}]*flex:0 0 auto/);
assert.match(style, /#ranking-screen\{padding-top:4px\}[\s\S]*#ranking-screen \.ranking-box\{margin-top:0!important/);
assert(!/\.screen\{[^}]*padding-top:4px/.test(style));
assert.match(style, /\.summer-season-banner__content\{[^}]*width:66%[^}]*height:100%/);
assert.match(style, /@media\(max-width:767px\)[\s\S]*\.summer-season-banner__visual img\{[^}]*width:96%[^}]*height:96%/);

const index = fs.readFileSync('index.html', 'utf8');
assert(index.indexOf('catAcquisitionService.js') < index.indexOf('collectionController.js'));
console.log(JSON.stringify({ passed: true, cases: ['banner-flow-layout', 'season-card-data', 'season-thumbnail-scope', 'kst-timestamp', 'iso-date', 'legacy-date', 'invalid-date', 'authenticated-priority', 'guest-fallback', 'duplicate-preserves-first-date', 'ranking-scope'] }));
