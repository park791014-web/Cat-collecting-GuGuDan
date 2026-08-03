(function (global) {
  'use strict';

  var v2 = global.GugudanV2 = global.GugudanV2 || {};
  var LEGACY_LABEL = '2026.08.04 이전 획득';
  var MISSING_LABEL = '획득일 기록 없음';

  function hasOwn(object, key) {
    return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  }

  function toDate(value) {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
    if (value && typeof value.toDate === 'function') return toDate(value.toDate());
    if (typeof value === 'number') {
      var milliseconds = Math.abs(value) < 100000000000 ? value * 1000 : value;
      var numericDate = new Date(milliseconds);
      return Number.isFinite(numericDate.getTime()) ? numericDate : null;
    }
    if (typeof value === 'string') {
      var text = value.trim();
      if (!text) return null;
      var parsedDate = new Date(text);
      return Number.isFinite(parsedDate.getTime()) ? parsedDate : null;
    }
    if (value && typeof value === 'object') {
      var seconds = value.seconds;
      if (seconds == null) seconds = value._seconds;
      if (seconds != null && Number.isFinite(Number(seconds))) {
        var nanos = value.nanoseconds;
        if (nanos == null) nanos = value._nanoseconds;
        return toDate(Number(seconds) * 1000 + (Number(nanos) || 0) / 1000000);
      }
    }
    return null;
  }

  function getCatAcquiredAt(options) {
    options = options || {};
    var catId = options.catId;
    var ownedEntry = options.ownedCats && options.ownedCats[catId];
    if (ownedEntry && hasOwn(ownedEntry, 'acquiredAt')) return ownedEntry.acquiredAt;
    var progress = options.catProgress && options.catProgress[catId];
    if (progress && hasOwn(progress, 'obtainedAt')) return progress.obtainedAt;
    return null;
  }

  function formatCatAcquiredDate(value) {
    var date = toDate(value);
    if (!date) return null;
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce(function (result, part) {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    return parts.year && parts.month && parts.day ? parts.year + '.' + parts.month + '.' + parts.day : null;
  }

  function getCatAcquisitionLabel(options) {
    var value = getCatAcquiredAt(options);
    if (value == null || value === '') return LEGACY_LABEL;
    var formatted = formatCatAcquiredDate(value);
    return formatted ? formatted + ' 획득' : MISSING_LABEL;
  }

  v2.catAcquisitionService = {
    getCatAcquiredAt: getCatAcquiredAt,
    formatCatAcquiredDate: formatCatAcquiredDate,
    getCatAcquisitionLabel: getCatAcquisitionLabel,
    toDate: toDate,
    LEGACY_LABEL: LEGACY_LABEL,
    MISSING_LABEL: MISSING_LABEL
  };
})(window);
