(function (global) {
  'use strict';
  global.GugudanV2 = global.GugudanV2 || {};
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function validateAdminConfig(config) { return global.GugudanV2.validators.validateAdminConfig(config); }
  function loadAdminConfig() { return Object.assign(clone(global.GugudanV2.defaultAdminConfig), global.GugudanV2.storageService.loadAdminConfig()); }
  function saveAdminConfig(config) { var errors = validateAdminConfig(config); if (errors.length) return { saved: false, errors: errors }; return { saved: global.GugudanV2.storageService.saveAdminConfig(config), errors: [] }; }
  function resetAdminConfig() { return global.GugudanV2.storageService.resetAdminConfig(); }
  global.GugudanV2.adminConfigService = { validateAdminConfig: validateAdminConfig, loadAdminConfig: loadAdminConfig, saveAdminConfig: saveAdminConfig, resetAdminConfig: resetAdminConfig };
})(window);
