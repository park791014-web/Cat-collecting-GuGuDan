(function(global){
  'use strict';
  var v2=global.GugudanV2=global.GugudanV2||{},fallback='assets/placeholders/cat-placeholder.svg';
  function cat(id,name,rarity,skill){return{id:id,displayName:name,collection:'season',seasonId:'season_01',breed:'russian_blue',rarity:rarity,image:'assets/seasons/season_01/cats/'+id+'.webp',fallbackImage:fallback,available:true,obtainable:true,skill:skill||null,visual:{frame:rarity,glow:rarity==='legendary'}};}
  v2.seasonCats=[cat('s01_normal_01','푸른빛 냥이','normal'),cat('s01_normal_02','은빛 꼬리 냥이','normal'),cat('s01_rare_01','달그림자 냥이','rare'),cat('s01_rare_02','푸른 보석 냥이','rare'),cat('s01_hero_01','월광 냥이','hero',{id:'season_moon_meow',name:'월광의 울음',type:'visual_effect',trigger:'combo_10',modes:['classic','timeAttack','adventure'],description:'10콤보마다 푸른 달빛 연출이 재생됩니다.'}),cat('s01_legendary_01','푸른 달 냥이','legendary',{id:'season_blue_moon_roar',name:'푸른 달의 포효',type:'boss_effect',trigger:'boss_start',modes:['adventure'],description:'보스전 입장 때 푸른 달빛 연출이 재생됩니다.'})];
  v2.seasonCats.forEach(function(item,index){item.displayOrder=index+1;item.description=['푸른 달빛을 닮은 차분한 털의 냥이예요.','은빛 꼬리를 살랑이며 모험을 안내해요.','달그림자 속에서 조용히 집중을 응원해요.','푸른 보석처럼 맑은 빛을 반짝이는 냥이예요.','월광 파티클과 맑은 울음으로 정답을 축하해요.','푸른 달의 후광과 신비한 울음을 지닌 냥이예요.'][index];if(item.rarity==='hero'||item.rarity==='legendary'){item.presentationSkill={effectThemeId:'moonlight',soundThemeId:'moon_meow'};item.skillActive=false;}if(item.rarity==='legendary')item.legendarySkill={specialOption:'보스전 입장 시 푸른 달 후광 연출',affectsScore:false};});
  function summerCat(id,name,rarity,file,description){return{id:id,displayName:name,collection:'season',seasonId:'summer_2026',breed:'summer',rarity:rarity,image:'assets/cats/seasons/summer_2026/'+file,fallbackImage:fallback,available:true,obtainable:true,limited:true,description:description,visual:{frame:rarity,glow:rarity==='legendary'}};}
  var summerCats=[
    summerCat('summer_2026_heatwave_flame_cat','폭염불꽃냥이','legendary','heatwave-flame-cat.jpg','여름의 태양처럼 빛나는 전설 냥이예요. 뜨거운 불꽃으로 모든 모험을 밝혀요.'),
    summerCat('summer_2026_bikini_cat','비키니 냥이','hero','bikini-cat.jpg','바다 공을 품에 안고 여름을 즐기는 냥이예요. 통통 튀는 에너지로 기분을 밝혀 줘요.'),
    summerCat('summer_2026_watermelon_cat','수박냥이','rare','watermelon-cat.jpg','수박처럼 상큼한 무늬를 가진 여름 냥이예요. 보기만 해도 시원한 기분이 들어요.'),
    summerCat('summer_2026_icecream_cat','아이스크림 냥이','rare','icecream-cat.jpg','무지개 아이스크림을 꼭 안고 있는 냥이예요. 무더운 여름을 시원하게 반겨 줘요.')
  ];
  summerCats.forEach(function(item,index){item.displayOrder=v2.seasonCats.length+index+1;if(item.rarity==='hero'||item.rarity==='legendary'){item.presentationSkill={effectThemeId:item.rarity==='legendary'?'gold':'moonlight',soundThemeId:item.rarity==='legendary'?'gold_meow':'moon_meow'};item.skillActive=false;}if(item.rarity==='legendary')item.legendarySkill={specialOption:'여름 불꽃 후광 연출',affectsScore:false};});
  v2.seasonCats=v2.seasonCats.concat(summerCats);
  function chuseokCat(id,name,rarity,file,description){return{id:id,displayName:name,collection:'season',seasonId:'chuseok_2026',breed:'chuseok',rarity:rarity,image:'assets/cats/seasons/chuseok_2026/'+file,fallbackImage:fallback,available:true,obtainable:true,limited:true,description:description,visual:{frame:rarity,glow:rarity==='legendary'}};}
  var chuseokCats=[
    chuseokCat('chuseok_2026_fullmoon_guardian_cat','보름지기냥','legendary','fullmoon-guardian-cat.png','보름달이 가장 밝게 빛나는 밤, 달빛을 지키기 위해 나타나는 전설의 고양이.'),
    chuseokCat('chuseok_2026_rice_pounder_cat','떡방아냥','legendary','rice-pounder-cat.png','달빛 아래에서 신나게 떡방아를 찧는 고양이. 오늘도 맛있는 떡을 만들기 위해 바쁘다.'),
    chuseokCat('chuseok_2026_chestnut_cat','밤토리냥','hero','chestnut-cat.png','잘 익은 알밤을 찾아 가을 숲을 누비는 고양이. 품속에는 언제나 밤이 한가득이다.'),
    chuseokCat('chuseok_2026_songpyeon_cat','송편냥','hero','songpyeon-cat.png','알록달록한 송편을 세상에서 가장 좋아하는 고양이. 맛있는 송편은 친구들과 꼭 나누어 먹는다.')
  ];
  chuseokCats.forEach(function(item,index){item.displayOrder=v2.seasonCats.length+index+1;item.presentationSkill={effectThemeId:item.rarity==='legendary'?'gold':'moonlight',soundThemeId:item.rarity==='legendary'?'gold_meow':'moon_meow'};item.skillActive=false;if(item.rarity==='legendary')item.legendarySkill={specialOption:'추석 보름달 후광 연출',affectsScore:false};});
  v2.seasonCats=v2.seasonCats.concat(chuseokCats);
})(window);
