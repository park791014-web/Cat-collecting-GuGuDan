const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const serviceSource = fs.readFileSync(path.join(root, 'js/services/levelProgressService.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const modeSource = fs.readFileSync(path.join(root, 'js/game/modeEngine.js'), 'utf8');
const rankingSource = fs.readFileSync(path.join(root, 'js/ui/leaderboardV3Controller.js'), 'utf8');
const collectionSource = fs.readFileSync(path.join(root, 'js/ui/phase521UiRuntime.js'), 'utf8');
const collectionControllerSource = fs.readFileSync(path.join(root, 'js/ui/collectionController.js'), 'utf8');
const phase521Css = fs.readFileSync(path.join(root, 'css/phase521.css'), 'utf8');
const releaseCss = fs.readFileSync(path.join(root, 'css/releasePatch.css'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const context = { GugudanV2: {}, globalThis: null };
context.globalThis = context;
vm.runInNewContext(serviceSource, context);
const levels = context.GugudanV2.levelProgressService;

assert.strictEqual(levels.requiredPointsForNextLevel(0), 1000);
assert.strictEqual(levels.requiredPointsForNextLevel(1), 1500);
assert.strictEqual(levels.requiredPointsForNextLevel(2), 2000);

const newUserCurve = levels.createBaseline(1, 0);
assert.strictEqual(levels.resolveLevel(999, newUserCurve, 1), 1);
assert.strictEqual(levels.resolveLevel(1000, newUserCurve, 1), 2);
assert.strictEqual(levels.resolveLevel(2499, newUserCurve, 1), 2);
assert.strictEqual(levels.resolveLevel(2500, newUserCurve, 1), 3);
assert.strictEqual(levels.resolveLevel(4500, newUserCurve, 1), 4);
assert.strictEqual(levels.resolveLevel(7000, newUserCurve, 1), 5);
assert.strictEqual(levels.resolveLevel(10000, newUserCurve, 1), 6);

const existingCurve = levels.createBaseline(34, 5033);
assert.strictEqual(levels.resolveLevel(5033, existingCurve, 34), 34);
assert.strictEqual(levels.resolveLevel(6032, existingCurve, 34), 34);
assert.strictEqual(levels.resolveLevel(6033, existingCurve, 34), 35);
assert.strictEqual(levels.resolveLevel(7532, existingCurve, 35), 35);
assert.strictEqual(levels.resolveLevel(7533, existingCurve, 35), 36);

const highExistingCurve = levels.createBaseline(36, 9000);
assert.strictEqual(levels.resolveLevel(9999, highExistingCurve, 36), 36);
assert.strictEqual(levels.resolveLevel(10000, highExistingCurve, 36), 37);
assert.strictEqual(levels.resolveLevel(11500, highExistingCurve, 37), 38);
assert.strictEqual(levels.resolveLevel(13500, highExistingCurve, 38), 39);

assert.strictEqual(levels.calculatePlayCoins('classic', 100, true), 50);
assert.strictEqual(levels.calculatePlayCoins('timeAttack', 250, true), 125);
assert.strictEqual(levels.calculatePlayCoins('classic', 101, true), 50);
assert.strictEqual(levels.calculatePlayCoins('adventure', 100, true), 50);
assert.strictEqual(levels.calculatePlayCoins('classic', 100, false), 0);

assert.match(appSource, /playCoins = v2\.levelProgressService\.calculatePlayCoins\(mode, sessionPoints, success\)/);
assert.match(appSource, /levelRewardPremiumTickets: isDuplicate \? 0 : levelRewardPremiumTickets/);
assert.match(appSource, /playCoins: isDuplicate \? 0 : playCoins/);
assert.match(appSource, /window\.showTimeAttackResultUI\(session, savedResult\)/);
assert.doesNotMatch(modeSource, /byId\('ranking-box'\)\.style\.display = 'none'/);
assert.match(modeSource, /플레이 보상: 코인 \+/);

assert.match(rankingSource, /class="leaderboard-rank"/);
assert.match(rankingSource, /class="leaderboard-nickname"/);
assert.match(releaseCss, /\.ranking-cat-thumb\{width:40px!important;height:40px!important/);
assert.match(releaseCss, /width:34px!important;height:34px!important/);
assert.match(collectionSource, /title\.appendChild\(representative\)[\s\S]*title\.appendChild\(rarity\)[\s\S]*title\.appendChild\(name\)/);
assert.match(collectionSource, /container !== content/);
assert.match(collectionControllerSource, /titleRow\.appendChild\(createRepresentativeBadge\(\)\)[\s\S]*titleRow\.appendChild\(createRarityBadge\(cat\.rarity\)\)[\s\S]*titleRow\.appendChild\(name\)/);
assert.match(collectionControllerSource, /titleRow\.appendChild\(name\)[\s\S]*createCatStars\(save\.collection\.duplicateCounts\[cat\.id\]\)/);
assert.match(collectionControllerSource, /count <= 5 \? '★'\.repeat\(count\) : '★×' \+ count/);
assert.match(collectionControllerSource, /home-representative-name-row[\s\S]*titleRow\.appendChild\(createRarityBadge\(cat\.rarity\)\)[\s\S]*home-representative-cat-name/);
assert.match(collectionControllerSource, /global\.createCollectionRarityBadge = createRarityBadge/);
assert.match(collectionControllerSource, /function getCollectionCategoryLabel\(cat\)[\s\S]*base: '기본 고양이'[\s\S]*season: '시즌 고양이'/);
assert.match(collectionControllerSource, /class="cat-detail-meta"[\s\S]*cat-detail-rarity rarity-text-/);
assert.doesNotMatch(collectionControllerSource, /cat-detail-image[\s\S]*<span class="rarity-badge rarity-' \+ cat\.rarity/);
assert.match(collectionSource, /if \(card\.querySelector\('\.cat-card-title-row'\)\) return/);
assert.match(phase521Css, /\.cat-card-title-row > \.rarity-badge[\s\S]*position: static !important/);
assert.match(phase521Css, /\.home-representative-name-row \.rarity-badge[\s\S]*width: fit-content !important[\s\S]*flex-grow: 0 !important/);
assert.match(phase521Css, /\.cat-detail-meta[\s\S]*display: flex[\s\S]*gap: 8px/);
assert.match(collectionSource, /selected-cat-title-line/);
assert.match(collectionSource, /currency\.querySelectorAll\('\.currency-chip'\)\.length !== 3/);
assert.match(phase521Css, /\.currency-summary\s*\{[\s\S]*display:\s*flex/);
assert.doesNotMatch(indexSource, />도감 열기<\/button>/);

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.className = '';
    this.dataset = {};
    this.style = { setProperty() {} };
    this.hidden = false;
  }
  appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
  replaceChildren(...children) { this.children = []; children.forEach((child) => this.appendChild(child)); }
  setAttribute(name, value) { this[name] = value; }
  querySelectorAll() { return []; }
}

const fixtureCats = [0, 1, 5, 6, 10].map((count) => ({
  id: 'star_' + count,
  rarity: count >= 10 ? 'legendary' : 'hero',
  image: 'cat-' + count + '.png',
  displayName: '별 고양이 ' + count,
  description: '별 표시 검증 ' + count,
  visible: true
}));
const fixtureSave = {
  profile: { selectedCatId: 'star_1' },
  currency: { coins: 0, normalTickets: 0, premiumTickets: 0 },
  collection: {
    ownedCatIds: fixtureCats.map((cat) => cat.id),
    duplicateCounts: Object.fromEntries(fixtureCats.map((cat) => [cat.id, Number(cat.id.slice(5))]))
  }
};
const fixtureNodes = {
  'collection-grid': new FakeElement('div'),
  'collection-filters': new FakeElement('div'),
  'collection-empty-message': new FakeElement('p'),
  'collection-search': new FakeElement('input')
};
const collectionContext = {
  GugudanV2: {
    releasePolicyService: { applySelectedCatPolicy() {}, getVisibleCats: () => fixtureCats },
    storageService: { loadSaveData: () => fixtureSave },
    collectionSortService: { sortOwnedCatsForCollection: (cats) => cats },
    cardPackService: { grantCat() {} },
    coinDrawService: { validate() {} },
    assetLoader: { applyImageFallback() {} },
    baseCats: fixtureCats
  },
  document: {
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => fixtureNodes[id] || null
  }
};
collectionContext.globalThis = collectionContext;
collectionContext.window = collectionContext;
vm.runInNewContext(collectionControllerSource, collectionContext);
collectionContext.renderBaseCollection();

const fixtureRows = fixtureNodes['collection-grid'].children.map((card) => card.children[1].children[0]);
const fixtureIndex = { 0: 0, 1: 1, 5: 2, 6: 3, 10: 4 };
const titleFixture = (count) => fixtureRows[fixtureIndex[count]].children.map((child) => ({ className: child.className, text: child.textContent }));
assert.deepStrictEqual(titleFixture(0).map((child) => child.className), ['rarity-badge rarity-hero', 'cat-name collection-cat-row__name']);
assert.deepStrictEqual(titleFixture(1).map((child) => child.className), ['representative-badge', 'rarity-badge rarity-hero', 'cat-name collection-cat-row__name', 'cat-stars cat-stars-gold']);
assert.strictEqual(titleFixture(1)[3].text, '★');
assert.strictEqual(titleFixture(5)[2].text, '★★★★★');
assert.strictEqual(titleFixture(6)[2].text, '★×6');
assert.strictEqual(titleFixture(6)[2].className, 'cat-stars cat-stars-gold');
assert.strictEqual(titleFixture(10)[2].text, '★×10');
assert.strictEqual(titleFixture(10)[2].className, 'cat-stars cat-stars-red');

console.log('phase521ResultRewardsUi.test.cjs: PASS');
