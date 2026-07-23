(function (global) {
  'use strict';
  var v2=global.GugudanV2=global.GugudanV2||{};
  function getSafeImagePath(imagePath,fallbackPath){return typeof imagePath==='string'&&imagePath.trim()?imagePath:fallbackPath;}
  function applyImageFallback(image,fallbackPath,assetId){if(!image)return;image.onerror=function(){if(image.dataset.fallbackApplied)return;var missing=image.currentSrc||image.src,id=assetId||image.dataset.catId||image.alt||'unknown';image.dataset.fallbackApplied='true';console.warn('[Cat image missing]',id,missing);if(fallbackPath){image.src=fallbackPath;image.alt=image.alt||'고양이 이미지 준비 중';}else{image.removeAttribute('src');image.classList.add('image-fallback');image.setAttribute('role','img');image.setAttribute('aria-label',image.alt||'이미지 준비 중');}};}
  v2.assetLoader={getSafeImagePath:getSafeImagePath,applyImageFallback:applyImageFallback};
})(window);
