(function(global){
  'use strict';
  var v2=global.GugudanV2=global.GugudanV2||{},fallback='assets/placeholders/cat-placeholder.svg';
  function cat(id,name,rarity,skill){return{id:id,displayName:name,collection:'base',breed:'generic',rarity:rarity,image:'assets/cats/base/'+id+'-transparent.png',fallbackImage:fallback,available:true,obtainable:true,skill:skill||null,visual:{frame:rarity,glow:rarity==='legendary',animation:null}};}
  var skills={
    lightning:{id:'combo_special_meow',name:'번개 울음',type:'sound_effect',trigger:'combo_10',modes:['classic','timeAttack','adventure'],description:'10콤보마다 번개 연출과 특별한 울음이 재생됩니다.'},
    shield:{id:'first_mistake_guard',name:'실수 방패',type:'mistake_guard',trigger:'first_wrong_answer',modes:['adventure'],description:'모험에서 첫 오답의 목숨 감소를 한 번 막습니다.'},
    wisdom:{id:'remove_wrong_option',name:'지혜의 발톱',type:'remove_option',trigger:'manual_once',modes:['classic','adventure'],description:'게임당 한 번 현재 문제의 오답 보기 하나를 제거합니다.'},
    time:{id:'time_bonus',name:'시간의 바람',type:'time_bonus',trigger:'timed_start',modes:['adventure'],value:2,description:'모험 시간 제한 스테이지에서 제한 시간이 2초 늘어납니다.'},
    gold:{id:'legendary_boss_roar',name:'황금의 포효',type:'boss_effect',trigger:'boss_start',modes:['adventure'],description:'보스전 시작과 첫 공격에 황금빛 연출이 재생됩니다.'},
    lives:{id:'single_revive',name:'아홉 번째 기회',type:'revive',trigger:'lives_zero',modes:['adventure'],value:1,description:'모험에서 목숨이 0이 되면 한 번만 목숨 1로 부활합니다.'}
  };
  v2.baseCats=[
    cat('base_normal_01','하얀 냥이','normal'),cat('base_normal_02','까만 냥이','normal'),cat('base_normal_03','치즈 냥이','normal'),cat('base_normal_04','회색 냥이','normal'),cat('base_normal_05','삼색 냥이','normal'),cat('base_normal_06','얼룩 냥이','normal'),cat('base_normal_07','턱시도 냥이','normal'),cat('base_normal_08','갈색 냥이','normal'),
    cat('base_rare_01','별무늬 냥이','rare'),cat('base_rare_02','달빛 냥이','rare'),cat('base_rare_03','구름 냥이','rare'),cat('base_rare_04','무지개 냥이','rare'),cat('base_rare_05','보석 냥이','rare'),cat('base_rare_06','왕관 냥이','rare'),
    cat('base_hero_01','번개 냥이','hero',skills.lightning),cat('base_hero_02','방패 냥이','hero',skills.shield),cat('base_hero_03','지혜 냥이','hero',skills.wisdom),cat('base_hero_04','시간 냥이','hero',skills.time),
    cat('base_legendary_01','황금 냥이','legendary',skills.gold),cat('base_legendary_02','아홉 목숨 냥이','legendary',skills.lives)
  ];
  var descriptions=['포근한 흰 털을 가진 호기심 많은 냥이예요.','밤처럼 까만 털과 반짝이는 눈을 가진 장난꾸러기예요.','치즈빛 무늬처럼 따뜻한 기운을 나눠 주는 냥이예요.','차분한 회색 털로 곁을 든든하게 지켜 주는 냥이예요.','알록달록한 무늬와 밝은 성격을 가진 친구예요.','개성 있는 얼룩무늬로 어디서든 눈에 띄는 냥이예요.','멋진 턱시도를 차려입은 예의 바른 냥이예요.','숲과 흙을 닮은 갈색 털의 씩씩한 탐험가예요.','별빛 무늬를 반짝이며 정답을 응원하는 냥이예요.','은은한 달빛처럼 조용히 집중을 도와주는 냥이예요.','폭신한 구름처럼 마음을 편안하게 해 주는 냥이예요.','무지개빛 기분으로 신나는 모험을 함께해요.','반짝이는 보석처럼 소중한 행운을 품은 냥이예요.','작은 왕관을 쓰고 당당하게 문제에 도전하는 냥이예요.','정답 순간 번쩍이는 번개 효과로 분위기를 끌어올려요.','포근한 보호 빛과 든든한 울음으로 곁을 지켜줘요.','반짝이는 지혜의 발톱으로 집중력을 북돋아 줘요.','바람 같은 빛과 경쾌한 울음으로 속도감을 더해요.','황금빛 후광과 특별한 울음소리를 가진 신비한 냥이예요.','아홉 번의 용기를 상징하는 붉은 후광의 수호자예요.'];
  v2.baseCats.forEach(function(item,index){item.displayOrder=index+1;item.description=descriptions[index];if(item.rarity==='hero'||item.rarity==='legendary'){var themeIds=['lightning','shield','wisdom','wind','gold','revive'],theme=themeIds[index-14]||item.rarity;item.presentationSkill={effectThemeId:theme,soundThemeId:theme+'_meow'};item.skillActive=false;}if(item.rarity==='legendary')item.legendarySkill={specialOption:item.id==='base_legendary_01'?'보스전 입장 시 황금 후광 연출':'목숨이 위험할 때 붉은 수호 후광 연출',affectsScore:false};});
})(window);
