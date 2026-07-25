(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  var active = [], initialized = false;
  var settings = global.GugudanV2.storageService ? global.GugudanV2.storageService.loadSaveData().settings : { soundEnabled: true, catVoiceEnabled: true, effectVolume: 0.8, musicVolume: 0.5 };
  function initialize() { initialized = true; }
  function allSounds() { var config = global.GugudanV2.soundConfig || {}; return [].concat(config.correct || [], config.wrong || [], config.skills || [], config.boss || [], config.reward || []); }
  function playEntry(entry) {
    if (!initialized || !settings.soundEnabled || !settings.catVoiceEnabled || !entry || !entry.enabled) return Promise.resolve(false);
    try { var audio = new Audio(entry.path); audio.volume = settings.effectVolume; active.push(audio); audio.onended = function () { active = active.filter(function (item) { return item !== audio; }); }; return audio.play().then(function () { return true; }).catch(function (error) { console.info('[V2 sound] 재생을 건너뜁니다.', error); return false; }); } catch (error) { return Promise.resolve(false); }
  }
  function randomFrom(group) { var enabled = (group || []).filter(function (entry) { return entry.enabled; }); return enabled.length ? enabled[Math.floor(Math.random() * enabled.length)] : null; }
  function playCorrectSound() { return playEntry(randomFrom((global.GugudanV2.soundConfig || {}).correct)); }
  function playWrongSound() { return playEntry(randomFrom((global.GugudanV2.soundConfig || {}).wrong)); }
  function playSoundById(id) { var entry=allSounds().find(function(item){return item.id===id;});if(entry)return playEntry(entry);if(!initialized||!settings.soundEnabled)return Promise.resolve(false);try{var Context=global.AudioContext||global.webkitAudioContext;if(!Context)return Promise.resolve(false);var context=new Context(),osc=context.createOscillator(),gain=context.createGain(),frequencies={lightning_skill:660,shield_skill:420,wisdom_skill:520,time_skill:760,gold_skill:880,revive_skill:560};osc.frequency.value=frequencies[id]||500;osc.type=id==='gold_skill'?'triangle':'sine';gain.gain.setValueAtTime(.0001,context.currentTime);gain.gain.exponentialRampToValueAtTime(Math.max(.02,settings.effectVolume*.12),context.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+.22);osc.connect(gain);gain.connect(context.destination);osc.start();osc.stop(context.currentTime+.24);return Promise.resolve(true);}catch(error){console.info('[V2 sound] 스킬 사운드를 건너뜁니다.',error);return Promise.resolve(false);} }
  function persist() { if (!global.GugudanV2.storageService) return; var data = global.GugudanV2.storageService.loadSaveData(); data.settings = Object.assign(data.settings, settings); global.GugudanV2.storageService.saveSaveData(data); }
  function setEffectVolume(value) { settings.effectVolume = Math.max(0, Math.min(1, Number(value))); persist(); }
  function setMusicVolume(value) { settings.musicVolume = Math.max(0, Math.min(1, Number(value))); persist(); }
  function setCatVoiceEnabled(value) { settings.catVoiceEnabled = Boolean(value); persist(); }
  function setSoundEnabled(value) { settings.soundEnabled = Boolean(value); if (!settings.soundEnabled) stopAllSounds(); persist(); }
  function stopAllSounds() { active.forEach(function (audio) { try { audio.pause(); audio.currentTime = 0; } catch (error) {} }); active = []; }
  global.addEventListener('pointerdown', initialize, { once: true });
  global.GugudanV2.soundService = { initialize: initialize, playCorrectSound: playCorrectSound, playWrongSound: playWrongSound, playSoundById: playSoundById, setSoundEnabled: setSoundEnabled, setEffectVolume: setEffectVolume, setMusicVolume: setMusicVolume, setCatVoiceEnabled: setCatVoiceEnabled, stopAllSounds: stopAllSounds };
})(window);
