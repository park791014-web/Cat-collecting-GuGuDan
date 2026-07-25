(function(global){
  'use strict';
  var v2=global.GugudanV2;if(!v2)return;
  var timing={houseEnterMs:400,houseShakeMs:500,doorOpenMs:1000,afterDoorOpenDelayMs:1000,catEmergenceMs:750,resultInfoDelayMs:150};
  Object.keys(v2.dailyMissionConfig||{}).forEach(function(id){var mission=v2.dailyMissionConfig[id];if(mission.type==='correct')mission.title='구구단 '+mission.target+'개';else if(mission.type==='classicRuns')mission.title='기본 게임 '+mission.target+'회';else if(mission.type==='timeAttackRuns')mission.title='타임어택 '+mission.target+'회';else if(mission.type==='adventureClears')mission.title='모험 '+mission.target+'회';else if(mission.type==='bossClears')mission.title='보스 '+mission.target+'회';else if(mission.type==='perfectRuns')mission.title='정확도 100% '+mission.target+'회';else if(mission.type==='bestCombo')mission.title=mission.target+'콤보';});
  var debug=global.NyankoDebug=global.NyankoDebug||{};delete debug.skipGachaSequenceForTesting;delete debug.skipGachaAnimationForTesting;
  Object.assign(debug,{previewGachaRevealTiming:function(){return Object.assign({},timing,{totalBeforeCatMs:2900});},printGachaAnimationTiming:function(){return Object.assign({},timing);},printDailyMissionTitles:function(){return Object.keys(v2.dailyMissionConfig||{}).map(function(id){return{id:id,title:v2.dailyMissionConfig[id].title};});}});
})(window);
