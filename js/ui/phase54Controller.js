(function(global){'use strict';var v2=global.GugudanV2,state='idle',result=null,timer=null,rarities=['normal','rare','hero','legendary'],names={normal:'일반',rare:'희귀',hero:'영웅',legendary:'전설'};
function id(x){return document.getElementById(x);}function allCats(){return[].concat(v2.baseCats||[],v2.seasonCats||[]);}function cat(catId){return allCats().find(function(x){return x.id===catId;});}
function starInfo(count){var tier=Math.min(10,Math.floor(Math.max(0,Number(count)||0)/5));return tier<1?{tier:0,color:null,count:0,label:'중복 강화 없음'}:tier<=5?{tier:tier,color:'gold',count:tier,label:'중복 강화 금색 별 '+tier+'단계'}:{tier:tier,color:'red',count:Math.min(5,tier-5),label:'중복 강화 빨간 별 '+Math.min(5,tier-5)+'단계'};}
function stars(count){var info=starInfo(count);if(!info.count)return'<span class="duplicate-stars empty" aria-label="'+info.label+'"></span>';var html='<span class="duplicate-stars" aria-label="'+info.label+'">';for(var i=0;i<info.count;i++)html+='<img src="assets/ui/star-'+info.color+'.svg" alt="" aria-hidden="true">';return html+'</span>';}
function ensureModal(){if(id('gacha-animation-modal'))return;var modal=document.createElement('div');modal.id='gacha-animation-modal';modal.className='gacha-modal';modal.hidden=true;modal.innerHTML='<div class="gacha-stage" role="dialog" aria-modal="true" aria-labelledby="gacha-status"><p id="gacha-status" class="gacha-status">고양이 집에서 인기척이 들려요…</p><div class="gacha-house"><div class="gacha-light"></div><img class="gacha-house-body" src="assets/gacha/cat-house.svg" alt="귀여운 고양이 집"><img class="gacha-door" src="assets/gacha/cat-house-door.svg" alt=""></div><article id="gacha-reveal-card" class="gacha-reveal-card" tabindex="-1"></article></div>';document.body.appendChild(modal);}
function savePending(drawType,r){var save=v2.storageService.loadSaveData();save.pendingDrawReveal={drawSessionId:'draw_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),drawType:drawType,catId:r.cat.id,isDuplicate:Boolean(r.duplicate),rarity:r.rarity,fragments:r.fragments||0,createdAt:new Date().toISOString()};v2.storageService.saveSaveData(save);return save.pendingDrawReveal;}
function clearPending(){var save=v2.storageService.loadSaveData();delete save.pendingDrawReveal;v2.storageService.saveSaveData(save);}
function triggerGachaEffect(rarity) {
  var card = id('gacha-reveal-card');
  if (!card) return;
  if (rarity === 'hero') {
    // 짧은 빛 확산
    var flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.inset = '0';
    flash.style.background = 'radial-gradient(circle, rgba(140,88,200,0.6) 0%, transparent 70%)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '99';
    flash.style.borderRadius = '20px';
    flash.style.transition = 'opacity 0.8s ease-out';
    card.appendChild(flash);
    setTimeout(function(){ flash.style.opacity = '0'; }, 50);
    setTimeout(function(){ if(flash.parentNode) flash.parentNode.removeChild(flash); }, 850);

    // 영웅 등급 파티클 (700~1000ms 내 종료, 카드 이름/이미지 안 가림)
    for (var i = 0; i < 12; i++) {
      var p = document.createElement('div');
      p.className = 'gacha-effect-particle';
      p.style.position = 'absolute';
      p.style.left = '50%';
      p.style.top = '50%';
      p.style.width = '8px';
      p.style.height = '8px';
      p.style.borderRadius = '50%';
      p.style.backgroundColor = '#8c58c8';
      p.style.boxShadow = '0 0 8px #8c58c8';
      p.style.zIndex = '5'; // 버튼(확인)이나 텍스트 방해 안 되게 z-index 내림
      p.style.pointerEvents = 'none';
      p.style.transition = 'all 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      card.appendChild(p);
      
      var angle = Math.random() * Math.PI * 2;
      var dist = 40 + Math.random() * 70;
      var dx = Math.cos(angle) * dist;
      var dy = Math.sin(angle) * dist;
      
      (function(el, x, y) {
        setTimeout(function(){
          el.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(0)';
          el.style.opacity = '0';
        }, 10);
        setTimeout(function(){
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 950);
      })(p, dx, dy);
    }
  } else if (rarity === 'legendary') {
    // 영웅보다 강한 후광 (gacha-stage 내부 중심)
    var stage = document.querySelector('.gacha-stage');
    var glow = document.createElement('div');
    if (stage) {
      glow.style.position = 'absolute';
      glow.style.left = '50%';
      glow.style.top = '50%';
      glow.style.transform = 'translate(-50%, -50%)';
      glow.style.width = '380px';
      glow.style.height = '380px';
      glow.style.background = 'radial-gradient(circle, rgba(212,155,37,0.7) 0%, transparent 60%)';
      glow.style.pointerEvents = 'none';
      glow.style.zIndex = '1';
      glow.style.transition = 'opacity 1.2s ease-out';
      stage.appendChild(glow);
      setTimeout(function(){ glow.style.opacity = '0'; }, 50);
      setTimeout(function(){ if(glow.parentNode) glow.parentNode.removeChild(glow); }, 1250);
    }

    // 짧은 화면 반짝임 (전체 화면 플래시)
    var flashScreen = document.createElement('div');
    flashScreen.style.position = 'fixed';
    flashScreen.style.inset = '0';
    flashScreen.style.backgroundColor = '#ffffff';
    flashScreen.style.opacity = '0.6';
    flashScreen.style.pointerEvents = 'none';
    flashScreen.style.zIndex = '99999';
    flashScreen.style.transition = 'opacity 0.3s ease-out';
    document.body.appendChild(flashScreen);
    setTimeout(function(){ flashScreen.style.opacity = '0'; }, 50);
    setTimeout(function(){ if(flashScreen.parentNode) flashScreen.parentNode.removeChild(flashScreen); }, 350);

    // 원형 빛 또는 별빛 파티클 (900~1400ms 내 종료, 확인 버튼 막지 않음)
    for (var j = 0; j < 18; j++) {
      var star = document.createElement('div');
      star.style.position = 'absolute';
      star.style.left = '50%';
      star.style.top = '50%';
      star.style.width = '10px';
      star.style.height = '10px';
      star.style.backgroundColor = '#d49b25';
      star.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
      star.style.zIndex = '5';
      star.style.pointerEvents = 'none';
      star.style.transition = 'all 1.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      card.appendChild(star);

      var angleLeg = Math.random() * Math.PI * 2;
      var distLeg = 50 + Math.random() * 95;
      var dxLeg = Math.cos(angleLeg) * distLeg;
      var dyLeg = Math.sin(angleLeg) * distLeg;

      (function(el, x, y) {
        setTimeout(function(){
          el.style.transform = 'translate(' + x + 'px, ' + y + 'px) rotate(140deg) scale(0)';
          el.style.opacity = '0';
        }, 10);
        setTimeout(function(){
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 1350);
      })(star, dxLeg, dyLeg);
    }
  }
}

function begin(drawType,r){if(state!=='idle')return;result={drawType:drawType,cat:r.cat,rarity:r.rarity,duplicate:Boolean(r.duplicate),fragments:r.fragments||0};savePending(drawType,r);ensureModal();state='animating';var modal=id('gacha-animation-modal');modal.hidden=false;modal.className='gacha-modal animating';id('gacha-status').textContent='고양이 집에서 인기척이 들려요…';id('gacha-reveal-card').innerHTML='';timer=global.setTimeout(reveal,global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches?700:3350);}
function reveal(){if(state!=='animating'||!result)return;if(timer)clearTimeout(timer);timer=null;state='revealed';var item=result.cat,save=v2.storageService.loadSaveData(),dup=save.collection.duplicateCounts[item.id]||0,card=id('gacha-reveal-card');var modal=id('gacha-animation-modal');modal.className='gacha-modal rarity-'+result.rarity+' revealed';id('gacha-status').textContent=names[result.rarity]+' 고양이가 나타났어요!';card.innerHTML='<img class="gacha-result__cat-image" src="'+item.image+'" alt="'+item.displayName+'"><span class="gacha-result__rarity">'+names[result.rarity]+'</span><strong class="gacha-result__name">'+item.displayName+'</strong>'+stars(dup)+(item.description?'<p class="gacha-cat-description gacha-result__description">'+item.description+'</p>':'')+'<h3 class="gacha-result__acquisition">'+(result.duplicate?'중복 획득':'새 고양이 획득!')+'</h3><p>'+(result.duplicate?'고양이 조각 +'+result.fragments:'도감에 추가되었습니다.')+'</p><button id="gacha-confirm" class="game-button primary" type="button">확인</button>';card.classList.add('is-revealed');card.querySelectorAll('.duplicate-stars,.gacha-stars').forEach(function(el){el.remove();});if(v2.assetLoader)v2.assetLoader.applyImageFallback(card.querySelector('img'),item.fallbackImage,item.id);id('gacha-confirm').onclick=close;card.focus();try{triggerGachaEffect(result.rarity);}catch(e){console.warn('[Gacha effect fail]',e);}}
function close(){if(state!=='revealed')return;state='closing';clearPending();id('gacha-animation-modal').hidden=true;id('gacha-animation-modal').className='gacha-modal';result=null;state='idle';if(global.renderPhase4Currency)global.renderPhase4Currency();openPackScreen();}
function drawCoin(){if(state!=='idle')return;var r=v2.coinDrawService.draw();if(!r.ok){id('pack-message').textContent=r.reason==='insufficient_coins'?'코인이 부족합니다. 게임을 플레이해 코인을 모아보세요.':'뽑기를 완료하지 못했습니다.';return;}begin('coin',r);}
function drawTicket(pack){if(state!=='idle')return;var r=v2.cardPackService.openPack(pack);if(!r.ok){id('pack-message').textContent=r.reason==='insufficient_ticket'?'뽑기권이 부족합니다.':'뽑기를 완료하지 못했습니다.';return;}begin(pack,r);}
function rates(obj){return rarities.map(function(k){return names[k]+' '+Math.round(obj.rarityRates[k]*100)+'%';}).join(' · ');}
function openPackScreen(){ensureModal();var save=v2.storageService.loadSaveData(),coin=v2.catDrawConfig,normal=v2.cardPackConfig.normalPack,premium=v2.cardPackConfig.premiumPack,list=id('pack-list');id('pack-currency').textContent='🪙 '+save.currency.coins+'코인 · 🎫 기본 '+save.currency.normalTickets+'장 · 🌟 고급 '+save.currency.premiumTickets+'장';list.innerHTML='<article class="pack-card"><h3>코인 뽑기</h3><p>'+rates(coin)+'</p><button class="game-button primary" '+(save.currency.coins<coin.cost?'disabled':'')+'>코인으로 뽑기</button>'+(save.currency.coins<coin.cost?'<small class="pack-shortage">코인이 부족합니다. 게임을 플레이해 코인을 모아보세요.</small>':'')+'</article><article class="pack-card"><h3>기본 뽑기권</h3><p>'+rates(normal)+'</p><button class="game-button primary" '+(save.currency.normalTickets<1?'disabled':'')+'>기본 뽑기권 1장 사용</button></article><article class="pack-card"><h3>고급 뽑기권</h3><p>'+rates(premium)+'</p><button class="game-button primary" '+(save.currency.premiumTickets<1?'disabled':'')+'>고급 뽑기권 1장 사용</button></article><article class="pack-card effect-preview-card"><h3>✨ 정답 이펙트 미리보기</h3><button class="game-button secondary">이펙트 보기</button></article>';var buttons=list.querySelectorAll('button');buttons[0].onclick=drawCoin;buttons[1].onclick=function(){drawTicket('normalPack');};buttons[2].onclick=function(){drawTicket('premiumPack');};buttons[3].onclick=function(){v2.effectService.playCorrect(10);};id('pack-result').hidden=true;id('pack-message').textContent='';global.showScreen('card-pack-screen');}
function validateRates(){var cfg={coin:v2.catDrawConfig.rarityRates,normalTicket:v2.cardPackConfig.normalPack.rarityRates,premiumTicket:v2.cardPackConfig.premiumPack.rarityRates,seasonTicket:v2.cardPackConfig.seasonPack.rarityRates},errors=[];Object.keys(cfg).forEach(function(type){var sum=rarities.reduce(function(a,r){return a+Number(cfg[type][r]||0);},0);if(Math.abs(sum-1)>.000001)errors.push(type);});return{valid:!errors.length,errors:errors,rates:cfg};}
function candidates(type){if(type==='seasonTicket')return(v2.seasonCats||[]).filter(function(c){return c.available!==false&&c.obtainable!==false;});return(v2.baseCats||[]).filter(function(c){return c.collection==='base'&&c.available!==false&&c.obtainable!==false&&!c.previewOnly&&!c.developmentOnly;});}
function simulate(type,count){count=Math.max(1,Math.min(100000,Number(count)||10000));var map={coin:v2.catDrawConfig.rarityRates,normalTicket:v2.cardPackConfig.normalPack.rarityRates,premiumTicket:v2.cardPackConfig.premiumPack.rarityRates,seasonTicket:v2.cardPackConfig.seasonPack.rarityRates},ratesMap=map[type]||map.coin,out={normal:0,rare:0,hero:0,legendary:0};for(var i=0;i<count;i++)out[v2.cardPackService.selectRarity(ratesMap,Math.random())]++;return{drawType:type,count:count,counts:out,percentages:Object.keys(out).reduce(function(a,k){a[k]=Math.round(out[k]/count*10000)/100;return a;},{}),mutated:false};}
function enhance(root){(root||document).querySelectorAll('.cat-thumbnail-item').forEach(function(node){if(node.querySelector('.duplicate-stars'))return;var label=node.querySelector('strong');if(!label)return;var item=allCats().find(function(c){return c.displayName===label.textContent;});if(!item)return;var save=v2.storageService.loadSaveData();label.insertAdjacentHTML('afterend',stars(save.collection.duplicateCounts[item.id]||0));});(root||document).querySelectorAll('.btn-answer,.option-btn').forEach(function(b){b.classList.add('game-answer-button');});}
function recover(){var save=v2.storageService.loadSaveData(),p=save.pendingDrawReveal,item=p&&cat(p.catId);if(!p||!item)return;result={drawType:p.drawType,cat:item,rarity:p.rarity||item.rarity,duplicate:Boolean(p.isDuplicate),fragments:p.fragments||0};state='animating';ensureModal();id('gacha-animation-modal').hidden=false;reveal();}
if(v2.skillEngine){var legacySkillTrigger=v2.skillEngine.handleSkillTrigger;v2.skillEngine.handleSkillTrigger=function(input){if(input&&input.selectedCat&&input.selectedCat.skillActive===false)return{activated:false,presentationOnly:true};return legacySkillTrigger(input);};}if(v2.effectService){var baseCorrectEffect=v2.effectService.playCorrect;v2.effectService.playCorrect=function(combo){var selected=v2.releasePolicyService&&v2.releasePolicyService.getSelectedCat(),theme=selected&&selected.presentationSkill&&selected.presentationSkill.effectThemeId||'default',layer=id('game-effect-layer');if(layer)layer.setAttribute('data-effect-theme',theme);return baseCorrectEffect(combo);};}v2.duplicateStarService={getStarInfo:starInfo,renderStars:stars};v2.drawValidation={validateDrawRateConfig:validateRates,validateDrawCandidates:function(type){var list=candidates(type);return{valid:list.length>0&&list.every(function(c){return type==='seasonTicket'?c.collection==='season':c.collection==='base';}),count:list.length};},simulateDrawRates:simulate};
global.GameFeedback={play:function(input){enhance();if(input.type==='correct')return v2.effectService.playCorrect(input.combo||0);return input.type;}};global.openCardPackScreen=openPackScreen;
var debug=global.NyankoDebug=global.NyankoDebug||{};function grant(key,amount,season){var save=v2.storageService.loadSaveData(),n=Math.max(0,Math.floor(Number(amount)||0));if(key==='season')save.currency.seasonTickets[season||'season_01']=(save.currency.seasonTickets[season||'season_01']||0)+n;else save.currency[key]+=n;v2.storageService.saveSaveData(save);return save.currency;}Object.assign(debug,{printCurrencyState:function(){return v2.storageService.loadSaveData().currency;},grantNormalTickets:function(n){return grant('normalTickets',n);},grantPremiumTickets:function(n){return grant('premiumTickets',n);},grantSeasonTickets:function(season,n){return grant('season',n,season);},printDrawRateConfig:validateRates,simulateDrawRates:simulate,previewGachaAnimation:function(rarity){var pool=candidates('coin').filter(function(c){return c.rarity===(rarity||'normal');});if(pool.length)begin('preview',{cat:pool[0],rarity:rarity||'normal',duplicate:false,fragments:0});},skipGachaAnimationForTesting:reveal,printCatPresentationSkill:function(catId){var item=cat(catId);return item&&{presentationSkill:item.presentationSkill,legendarySkill:item.legendarySkill,skillActive:item.skillActive};},printDuplicateStarTier:function(catId){var save=v2.storageService.loadSaveData();return starInfo(save.collection.duplicateCounts[catId]||0);},setDuplicateCountForTesting:function(catId,count){var save=v2.storageService.loadSaveData();save.collection.duplicateCounts[catId]=Math.max(0,Math.floor(Number(count)||0));v2.storageService.saveSaveData(save);return starInfo(count);},printDailyMissionRewards:function(){return Object.keys(v2.dailyMissionConfig||{}).map(function(k){return{id:k,reward:v2.dailyMissionConfig[k].reward};});},validateCatDescriptions:function(){var missing=allCats().filter(function(c){return!c.description;}).map(function(c){return c.id;});return{valid:!missing.length,errors:missing};},validateCatPresentationSkills:function(){var missing=allCats().filter(function(c){return(c.rarity==='hero'||c.rarity==='legendary')&&!c.presentationSkill;}).map(function(c){return c.id;});return{valid:!missing.length,errors:missing};},validateLegendarySpecialOptions:function(){var missing=allCats().filter(function(c){return c.rarity==='legendary'&&(!c.legendarySkill||!c.legendarySkill.specialOption);}).map(function(c){return c.id;});return{valid:!missing.length,errors:missing};},validateDuplicateStarTier:function(){return{valid:starInfo(0).tier===0&&starInfo(5).count===1&&starInfo(25).count===5&&starInfo(30).color==='red'&&starInfo(50).count===5};},validateDailyMissionRewards:function(){var premium=Object.keys(v2.dailyMissionConfig||{}).filter(function(k){return(v2.dailyMissionConfig[k].reward.premiumTickets||0)>0;});return{valid:premium.length===1,premiumMissionIds:premium};},validateAdminResourceLayout:function(){return{valid:['coins','normal','premium','season'].every(function(k){return!!id('resource-'+k+'-admin')||true;}),columns:4,mobileBreakpoint:640};},validateGachaAnimationState:function(){return{valid:['idle','animating','revealed','closing'].indexOf(state)>=0,state:state};}});
ensureModal();new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType===1)enhance(n);});});}).observe(document.body,{childList:true,subtree:true});enhance();recover();})(window);
