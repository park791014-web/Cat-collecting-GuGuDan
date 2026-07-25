(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  global.GugudanV2.soundConfig = {
    correct: [
      { id: 'correct_meow_01', path: 'assets/sounds/correct/meow_01.mp3', enabled: false },
      { id: 'correct_meow_02', path: 'assets/sounds/correct/meow_02.mp3', enabled: false },
      { id: 'correct_meow_03', path: 'assets/sounds/correct/meow_03.mp3', enabled: false }
    ],
    wrong: [
      { id: 'wrong_angry_meow_01', path: 'assets/sounds/wrong/angry_meow_01.mp3', enabled: false },
      { id: 'wrong_angry_meow_02', path: 'assets/sounds/wrong/angry_meow_02.mp3', enabled: false }
    ],
    skills: [], boss: [], reward: []
  };
})(window);
