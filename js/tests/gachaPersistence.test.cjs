const assert = require('assert');
const service = require('../services/gachaPersistenceService.js');

const base = {
  currency: { coins: 2200, normalTickets: 5, premiumTickets: 2, extra: 9 },
  ownedCats: { base_normal_01: { count: 1, acquiredAt: 'old', custom: true } },
  coins: 100
};

const coin = service.buildMutation(base, {
  currencyKey: 'coins', cost: 500, catId: 'base_rare_02', acquiredAt: 'now'
});
assert.strictEqual(coin.currency.coins, 1700);
assert.strictEqual(coin.currency.normalTickets, 5);
assert.strictEqual(coin.currency.premiumTickets, 2);
assert.strictEqual(coin.ownedCats.base_rare_02.count, 1);
assert.strictEqual(base.currency.coins, 2200, 'input must not mutate');

const ticket = service.buildMutation(base, {
  currencyKey: 'normalTickets', cost: 1, catId: 'base_rare_02', acquiredAt: 'now'
});
assert.strictEqual(ticket.currency.normalTickets, 4);
assert.strictEqual(ticket.currency.coins, 2200);

const duplicate = service.buildMutation(base, {
  currencyKey: 'premiumTickets', cost: 1, catId: 'base_normal_01', acquiredAt: 'ignored'
});
assert.strictEqual(duplicate.ownedCats.base_normal_01.count, 2);
assert.strictEqual(duplicate.ownedCats.base_normal_01.custom, true);
assert.strictEqual(duplicate.ownedCats.base_normal_01.acquiredAt, 'old');

const season = service.buildMutation({
  currency: { coins: 2200, normalTickets: 5, premiumTickets: 2, seasonTickets: 3 },
  ownedCats: {}
}, {
  currencyKey: 'seasonTickets', cost: 1, catId: 'season_01_normal_01', acquiredAt: 'now'
});
assert.strictEqual(season.currency.seasonTickets, 2);
assert.strictEqual(season.currency.coins, 2200);

const verified = {
  currency: coin.currency,
  ownedCats: coin.ownedCats
};
assert(service.verifyServerResult(verified, {
  catId: 'base_rare_02', currencyKey: 'coins', expectedCurrencyValue: 1700, expectedCount: 1
}));
assert(!service.verifyServerResult(base, {
  catId: 'base_rare_02', currencyKey: 'coins', expectedCurrencyValue: 1700, expectedCount: 1
}));

const ticketController = require('fs').readFileSync('js/ui/ticketDrawController.js', 'utf8');
assert(ticketController.includes('authenticated_gacha_handler_missing'));
assert(ticketController.includes("executeDraw('coin'"));
assert(ticketController.includes('executeDraw(drawType'));

const phase54Controller = require('fs').readFileSync('js/ui/phase54Controller.js', 'utf8');
assert(phase54Controller.includes("data-draw-type=\"coin\""));
assert(phase54Controller.includes("data-draw-type=\"normalTicket\""));
assert(phase54Controller.includes("data-draw-type=\"premiumTicket\""));
assert(phase54Controller.includes("list.addEventListener('click',handlePackListClick)"));
assert(!phase54Controller.includes('buttons[0].onclick=drawCoin'));
assert(!phase54Controller.includes('v2.coinDrawService.draw();if(!r.ok'));

const seasonBridge = require('fs').readFileSync('js/ui/gachaSeasonBridgeController.js', 'utf8');
assert(seasonBridge.includes("button.dataset.drawType = 'seasonTicket'"));
assert(seasonBridge.includes('await global.handleDrawRequest(button.dataset.drawType)'));

const app = require('fs').readFileSync('js/app.js', 'utf8');
assert(app.includes("drawType === 'seasonTicket'"));
assert(app.includes("currencyKey = 'seasonTickets'"));

console.log(JSON.stringify({
  passed: true,
  cases: ['coin_only', 'normal_ticket_only', 'season_ticket_only', 'duplicate_preserves_fields', 'server_verification', 'authenticated_guest_split'],
  canonicalCurrencyWinsLegacy: base.currency.coins === 2200 && base.coins === 100
}, null, 2));
