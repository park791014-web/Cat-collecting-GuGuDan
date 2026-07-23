(function(global){
  'use strict';
  var v2=global.GugudanV2,storage=v2.storageService,LEGACY_KEY=storage.SAVE_KEY,GUEST_ID_KEY='nyanko:v2:guest:id',OWNER_KEY='nyanko:v2:migration:legacy-owner',context=null,baseMigrate=storage.migrateSaveData;
  function uid(){try{return global.crypto&&global.crypto.randomUUID?global.crypto.randomUUID():'guest_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);}catch(e){return'guest_'+Date.now().toString(36);}}
  function guestId(){var id=global.localStorage.getItem(GUEST_ID_KEY);if(!id){id=uid();global.localStorage.setItem(GUEST_ID_KEY,id);}return id;}
  function normalize(input){input=input||{};if(input.type==='authenticated'&&input.userId)return{type:'authenticated',userId:String(input.userId),nickname:input.nickname||String(input.userId)};return{type:'guest',userId:input.userId||guestId(),nickname:'GUEST'};}
  function keyFor(ctx){ctx=ctx||context||normalize();return ctx.type==='authenticated'?'nyanko:v2:user:'+encodeURIComponent(ctx.userId)+':save':'nyanko:v2:guest:'+encodeURIComponent(ctx.userId)+':save';}
  function enrich(data,ctx){var result=baseMigrate(data);result.schemaVersion=7;result.profile.userId=ctx.userId;result.profile.nickname=result.profile.nickname||ctx.nickname||'';result.dailyMissions=result.dailyMissions||{dateKey:'',missions:{}};return result;}
  function migrateLegacyOnce(ctx){var key=keyFor(ctx);if(ctx.type!=='authenticated'||global.localStorage.getItem(key))return;var legacy=global.localStorage.getItem(LEGACY_KEY),owner=global.localStorage.getItem(OWNER_KEY);if(legacy&&!owner){try{global.localStorage.setItem(key,JSON.stringify(enrich(JSON.parse(legacy),ctx)));global.localStorage.setItem(OWNER_KEY,ctx.userId);global.localStorage.setItem('nyanko:v2:migration:legacy-owner:'+encodeURIComponent(ctx.userId),'complete');}catch(error){console.error('[User save migration error]',error);}}}
  function setUserContext(input){context=normalize(input);migrateLegacyOnce(context);return getUserContext();}
  function getUserContext(){return Object.assign({},context||normalize());}
  function load(){var ctx=context||setInitial(),raw=global.localStorage.getItem(keyFor(ctx));try{return enrich(raw?JSON.parse(raw):null,ctx);}catch(error){console.error('[User save load error]',error);return enrich(null,ctx);}}
  function save(data){var ctx=context||setInitial(),value=enrich(data,ctx);try{global.localStorage.setItem(keyFor(ctx),JSON.stringify(value));return true;}catch(error){console.error('[User save error]',error);return false;}}
  function reset(){try{global.localStorage.removeItem(keyFor(context||setInitial()));return true;}catch(e){return false;}}
  function better(mode,next,best){
    if(!best)return true;
    if(mode==='timeAttack'){
      var nextVal=Number(next.correctCount)||0,curVal=Number(best.bestCorrectCount)||0;
      if(nextVal!==curVal)return nextVal>curVal;
      var nextAcc=Number(next.accuracy)||0,curAcc=Number(best.bestAccuracy)||0;
      if(nextAcc!==curAcc)return nextAcc>curAcc;
      var nextWrong=Number(next.wrongCount)||0,curWrong=Number(best.lowestWrongCount||0);
      var curWrongVal=(best.lowestWrongCount===undefined||best.lowestWrongCount===null)?Infinity:curWrong;
      if(nextWrong!==curWrongVal)return nextWrong<curWrongVal;
      var nextTime=new Date(next.playedAt).getTime()||0,curTime=new Date(best.achievedAt).getTime()||0;
      return nextTime<curTime;
    }
    return next.score>best.bestScore||(next.score===best.bestScore&&next.bestCombo>best.bestCombo);
  }
  function recordGame(result){if(result.mode!=='classic'&&result.mode!=='timeAttack')return{saved:false,isPersonalBest:false,data:load()};var data=load(),best=data.personalBests[result.mode];data.gameHistory.push(JSON.parse(JSON.stringify(result)));data.gameHistory=data.gameHistory.slice(-50);data.progress.totalGames++;data.progress.totalScore+=result.score;data.progress.totalCorrect+=result.correctCount;data.progress.totalWrong+=result.wrongCount;data.progress.bestCombo=Math.max(data.progress.bestCombo,result.bestCombo);var personal=better(result.mode,result,best);if(personal)data.personalBests[result.mode]=result.mode==='timeAttack'?{bestScore:result.score,bestCorrectCount:result.correctCount,bestCombo:result.bestCombo,lowestWrongCount:result.wrongCount,bestAccuracy:result.accuracy,achievedAt:result.playedAt}:{bestScore:result.score,bestCombo:result.bestCombo,achievedAt:result.playedAt};save(data);return{saved:true,isPersonalBest:personal,data:data};}
  function setInitial(){context=normalize({type:'guest'});return context;}
  function clearMemory(){context=null;return true;}
  function validateIsolation(){var original=getUserContext(),a=normalize({type:'authenticated',userId:'test_account_a'}),b=normalize({type:'authenticated',userId:'test_account_b'});return{valid:keyFor(a)!==keyFor(b)&&keyFor(a)!==keyFor(normalize({type:'guest',userId:'test_guest'})),keys:[keyFor(a),keyFor(b)] ,current:original};}
  context=setInitial();storage.defaults=enrich(storage.defaults,context);storage.SAVE_KEY_LEGACY=LEGACY_KEY;storage.getCurrentUserStorageKey=function(){return keyFor(context||setInitial());};storage.getCurrentUserContext=getUserContext;storage.setUserContext=setUserContext;storage.clearInMemoryUserState=clearMemory;storage.loadUserScopedSaveData=function(userId){var ctx=normalize({type:'authenticated',userId:userId});var raw=global.localStorage.getItem(keyFor(ctx));return enrich(raw?JSON.parse(raw):null,ctx);};storage.saveUserScopedSaveData=function(userId,data){var ctx=normalize({type:'authenticated',userId:userId});global.localStorage.setItem(keyFor(ctx),JSON.stringify(enrich(data,ctx)));return true;};storage.handleAuthenticatedUserChanged=function(user){return setUserContext(user);};storage.validateUserDataIsolation=validateIsolation;storage.migrateSaveDataToSchema7=function(data,userContext){return enrich(data,normalize(userContext));};storage.migrateSaveData=storage.migrateSaveDataToSchema7;storage.migrateSaveDataToSchema4=storage.migrateSaveDataToSchema7;storage.migrateSaveDataToSchema5=storage.migrateSaveDataToSchema7;storage.migrateSaveDataToSchema6=storage.migrateSaveDataToSchema7;storage.loadSaveData=load;storage.saveSaveData=save;storage.resetSaveData=reset;storage.recordGame=recordGame;
  var debug=global.NyankoDebug=global.NyankoDebug||{};Object.assign(debug,{printCurrentUserContext:getUserContext,printCurrentUserStorageKey:storage.getCurrentUserStorageKey,validateUserDataIsolation:validateIsolation,simulateUserSwitchForTesting:function(userId){return setUserContext({type:'authenticated',userId:userId});},clearCurrentUserMemoryForTesting:clearMemory});
})(window);
