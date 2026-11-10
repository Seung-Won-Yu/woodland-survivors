import {RIFT_BOSS_CUES,selectAudioEvents} from '../game/audio.js';

const fieldCues={
 shot:'swarm-shot','rocket-shot':'scatter-shot','focus-shot':'focus-shot',flame:'flame-loop',
 heat:'heat-break','fire-spread':'fire-spread','payload-impact':'conduit-impact','payload-relay':'conduit-hop','ember-burst':'heat-break',
 kill:'wood-kill',impact:'rifle-hit',explosion:'power-kill','charge-impact':'slam','salvo-impact':'power-kill','armor-impact':'guard-block',
 complete:'forge-evolve',skill:'burst',choose:'choose','boss-arrival':'boss-arrival',
 'port-hatch':'front-entry','region-entry':'front-entry','challenge-clear':'rampage','raid-success':'forge-evolve',
 heal:'heal',break:'crowd-break','xp-pickup':'xp'
};

export function selectRiftAudioEvents(events,{inferno=false,showcase}={}){
 const warning=events.has('boss-charge')?'coast-charge':RIFT_BOSS_CUES.find(cue=>events.has(cue))||(events.has('warning')?'mortar-lock':null);
 let foreground=null;
 if(events.has('hurt'))foreground='hurt';
 else if(events.has('boss-down'))foreground='armor-collapse';
 else if(events.has('aid-counter')||events.has('barrage-cancel'))foreground='battery-suppress';
 else if(showcase==='flame')foreground='inferno-ready';
 else if(showcase==='fusion')foreground='conduit-ready';
 else if(events.has('shell-land'))foreground='shell-land';
 if(foreground)return warning?[warning,foreground]:[foreground];

 const cues=new Set();
 for(const event of events)if(Object.hasOwn(fieldCues,event))cues.add(fieldCues[event]);
 if(inferno&&cues.delete('flame-loop'))cues.add('inferno-jet');
 if(cues.has('heat-break')){cues.delete('power-kill');cues.delete('wood-kill');}
 const selected=selectAudioEvents(cues);
 const transfer=cues.has('conduit-impact')&&cues.has('conduit-hop');
 const contact=selected.map(cue=>cue==='conduit-hop'&&transfer?'conduit-transfer':cue==='inferno-jet'&&cues.has('fire-spread')?'inferno-spread':cue);
 return warning?[warning,...contact.slice(0,1).filter(cue=>cue!=='xp')]:contact;
}
