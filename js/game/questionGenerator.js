(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  function createOptions(answer, count, needsTrap, random) {
    random = random || Math.random;
    var options = [answer];
    if (needsTrap) {
      var target = count === 8 ? 3 : 1, traps = 0, attempts = 0;
      while (traps < target && attempts < 50) {
        var trap = answer + (Math.floor(random() * 11) - 5) * 10;
        if (trap > 0 && trap !== answer && options.indexOf(trap) < 0) { options.push(trap); traps += 1; }
        attempts += 1;
      }
    }
    while (options.length < count) {
      var wrong = answer + Math.floor(random() * 31) - 15;
      if (wrong > 0 && wrong !== answer && options.indexOf(wrong) < 0) options.push(wrong);
    }
    return options.sort(function (a, b) { return a - b; });
  }
  global.GugudanV2.questionGenerator = { createOptions: createOptions };
})(window);
