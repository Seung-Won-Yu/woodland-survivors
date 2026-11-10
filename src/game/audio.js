const IMPORTANT = ['hurt', 'armor-collapse', 'front-entry', 'forge-union', 'forge-evolve', 'guard-block', 'boss-arrival', 'boss-warning', 'boss-charge', 'boss-thorns', 'boss-defeated', 'elite-break', 'crowd-break', 'rampage', 'horde', 'evolve', 'signature-ash', 'signature-ember', 'signature-grove', 'burst', 'level', 'heal', 'choose', 'slam', 'warning', 'elite'];
const IMPACTS = ['heat-break', 'conduit-hop', 'conduit-impact', 'power-kill', 'wood-impact', 'wood-kill', 'blade-impact', 'ember-impact'];
const CASTS = ['inferno-jet', 'flame-loop', 'scatter-shot', 'swarm-shot', 'acorn-shot', 'whoosh', 'throw', 'buzz', 'swing', 'rune-hit', 'pulse'];

export function selectAudioEvents(events) {
  const has = event => events.has(event);
  const important = IMPORTANT.find(has);
  const contact = IMPACTS.find(has);
  const impact = contact==='wood-impact'&&has('kill')?'wood-kill':contact;
  const cast = CASTS.find(has);
  // One foreground cue plus one contact, never one voice per enemy.
  if (important === 'hurt' || important === 'elite-break' || important === 'crowd-break') return [important];
  if (important) return impact ? [important, impact] : [important];
  if(has('relic-proc'))return impact?['relic-proc',impact]:['relic-proc'];
  if (cast) return impact ? [cast, impact] : [cast];
  if (impact) return [impact];
  const other = ['fire-spread', 'ember-shot', 'xp', 'kill'].find(has);
  return other ? [other] : [];
}

// Short synthesized cues keep the game self-contained. No media requests or autoplay.
export function createAudio() {
  let context = null, noiseBuffer = null;
  const lastLane = new Map();
  const lastEvent = new Map();
  let dangerUntil = 0;
  function unlock() {
    try {
      context ??= new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
  function note(hz, end, type, time, duration, volume) {
    const voice = context.createOscillator(),
      gain = context.createGain();
    voice.type = type;
    voice.frequency.setValueAtTime(hz, time);
    voice.frequency.exponentialRampToValueAtTime(end, time + duration);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    voice.connect(gain).connect(context.destination);
    voice.start(time);
    voice.stop(time + duration + .01);
    voice.onended = () => {
      voice.disconnect();
      gain.disconnect();
    };
  }
  function transient(time, duration, volume, frequency) {
    // Reuse a small deterministic noise texture; no combat RNG or media download.
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * .2), context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.sin(i * 127.1 + 19.7) * 43758.5453 % 1);
    }
    const voice = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    voice.buffer = noiseBuffer;
    filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .7;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    voice.connect(filter).connect(gain).connect(context.destination);
    voice.start(time); voice.stop(time + duration);
    voice.onended = () => { voice.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  function play(event, variant, evolved = false) {
    if (context?.state !== 'running') return;
    const now = context.currentTime;
    const lane = IMPACTS.includes(event) ? 'impact' : IMPORTANT.includes(event) ? 'important' : CASTS.includes(event)?'cast':'background';
    // A short foreground window separates being hit from dealing damage in a crowd.
    if (event !== 'hurt' && !['boss-warning','boss-charge'].includes(event) && now < dangerUntil) return;
    const cooldown = event==='relic-proc'?.35:lane === 'impact' ? .085 : lane==='cast'?.11:['xp', 'kill'].includes(event) ? .16 : .06;
    if ((event !== 'hurt' && now - (lastLane.get(lane) ?? -1) < (lane === 'impact' ? .085 : .045)) || now - (lastEvent.get(event) ?? -1) < cooldown) return;
    lastLane.set(lane, now);
    lastEvent.set(event, now);
    if(event==='forge-union'||event==='forge-evolve'){const union=event==='forge-union';transient(now,.07,.045,union?950:1400);note(110,55,'triangle',now,.16,.035);[1,1.5,2].forEach((ratio,i)=>note(330*ratio,440*ratio,'sine',now+i*.06,.15,.02));}
    else if(event==='heat-break'){transient(now,.12,.055,540);note(98,28,'triangle',now,.22,.045);note(540,170,'sine',now,.13,.016);}
    else if(event==='conduit-impact'){transient(now,.046,.035,1900);note(290,110,'triangle',now,.11,.035);note(980,430,'sine',now+.014,.066,.019);}
    else if(event==='conduit-hop'){transient(now,.04,.035,1900);note(320,760,'triangle',now,.065,.023);note(950,1300,'sine',now+.022,.044,.012);}
    else if(event==='inferno-jet'){transient(now,.12,.042,730);note(100,53,'triangle',now,.14,.022);}
    else if(event==='flame-loop'){transient(now,.13,.035,1250);note(82,64,'triangle',now,.14,.012);}
    else if(event==='power-kill'){transient(now,.04,.05,1100);note(140,42,'triangle',now,.1,.038);note(790,1200,'sine',now+.01,.06,.013);}
    else if(event==='scatter-shot'){transient(now,.035,.03,1800);note(180,65,'triangle',now,.09,.03);note(78,45,'sine',now,.1,.018);}
    else if(event==='swarm-shot'){transient(now,.025,.02,2400);note(240,170,'triangle',now,.06,.014);}
    else if(event==='armor-collapse'){
      transient(now,.19,.065,620);note(100,32,'triangle',now,.29,.055);
      note(295,139,'triangle',now+.035,.16,.021);note(570,270,'sine',now+.14,.14,.012);
    }else if(event==='front-entry'){
      transient(now,.055,.015,1500);
      note(392,392,'square',now+.04,.07,.012);note(587,587,'square',now+.13,.15,.012);
    }
    else if(event==='acorn-shot'){
      transient(now,.022,.023,2100);note(230,85,'triangle',now,.065,.028);note(90,55,'sine',now,.075,.018);
    }else if(event==='wood-kill'){
      transient(now,.035,.046,1300);note(190,52,'triangle',now,.09,.033);note(900,1250,'sine',now+.012,.045,.013);
    }else if(event==='wood-impact'){
      transient(now,.032,.052,1500);note(160,63,'triangle',now,.075,.035);note(760,230,'sine',now,.035,.012);
    }else if(event==='whoosh'||event==='throw'){
      transient(now,.045,.016,event==='whoosh'?1100:1800);note(event==='whoosh'?440:330,170,'sine',now,.08,.014);
    }else if(event==='buzz'){
      note(190,240,'triangle',now,.045,.01);
    }else if (event === 'hurt') {
      dangerUntil = now + .18;
      transient(now, .075, .08, 950);
      note(145, 42, 'triangle', now, .2, .06);
      note(72, 38, 'sine', now + .015, .22, .035);
    } else if (event === 'burst') {
      transient(now,.09,.035,1400);
      note(180,420,'triangle',now,.1,.025);
    } else if(event==='rampage'){
      note(220,440,'triangle',now,.1,.025);note(330,660,'sine',now+.06,.13,.02);transient(now,.05,.025,1800);
    } else if(event==='horde'){
      note(100,65,'triangle',now,.28,.035);note(150,100,'triangle',now+.12,.24,.025);
    } else if(event==='relic-proc'){
      note(590,790,'sine',now,.09,.018);note(885,1180,'sine',now+.025,.1,.011);
    } else if (event === 'guard-block') {
      note(390, 810, 'sine', now, .13, .03);
      transient(now, .04, .035, 2400);
    } else if (event.startsWith('signature-')) {
      const hz = event === 'signature-ash' ? 180 : event === 'signature-ember' ? 300 : 530;
      note(hz, hz * 2, 'triangle', now, .16, .035);
      note(hz * 2, hz * 3, 'sine', now + .05, .16, .022);
    } else if (event === 'elite-break') {
      note(110, 38, 'triangle', now, .18, .045);
      transient(now, .07, .06, 1100);
      note(660, 990, 'sine', now + .045, .2, .018);
    } else if (event === 'crowd-break') {
      note(105, 34, 'triangle', now, .22, .055);
      transient(now, .075, .06, 850);
      note(440, 880, 'sine', now + .035, .18, .022);
    } else if (event === 'blade-impact') {
      note(150, 48, 'triangle', now, .12, .045);
      note(1650, 520, 'sine', now, .045, .016);
      transient(now, .055, .075, 2100);
      if (evolved) note(2200, 1100, 'sine', now, .08, .012);
    } else if (event === 'ember-impact') {
      note(95, 36, 'triangle', now, .2, .035);
      note(240, 70, 'sine', now, .16, .024);
      transient(now, .11, .065, 650);
      if (evolved) note(65, 32, 'triangle', now, .2, .018);
    } else if (event === 'fire-spread') {
      note(380, 790, 'sine', now, .1, .016);
    } else if (event === 'swing') {
      note(variant === 'duelist' ? 180 : 310, 65, 'triangle', now, variant === 'sweep' ? .14 : .09, .032);
      note(1000, 210, 'sine', now, .045, .012);
    } else if (event === 'ember-shot') {
      note(variant === 'detonation' ? 130 : 240, variant === 'wildfire' ? 420 : 720, 'sine', now, variant === 'detonation' ? .15 : .09, .023);
      note(150, 75, 'triangle', now + .025, .09, .018);
    } else if (event === 'rune-hit' || event === 'pulse') {
      note(variant === 'bulwark' ? 390 : variant === 'horizon' ? 660 : 520, variant === 'horizon' ? 880 : 490, 'sine', now, .18, .022);
      note(780, 735, 'sine', now + .03, .18, .012);
      note(120, 60, 'triangle', now, .065, .026);
      if (evolved) note(1040, 880, 'sine', now, .2, .012);
    } else if (event === 'heal' || event === 'level' || event === 'evolve' || event === 'boss-defeated') {
      const base = event === 'heal' ? 440 : event === 'boss-defeated' ? 330 : 550;
      [1, 1.25, 1.5].forEach((ratio, i) => note(base * ratio, base * ratio, 'sine', now + i * .07, .2, .023));
    } else {
      const hz = {
        xp: 760,
        kill: 230,
        choose: 880,
        hurt: 100,
        elite: 120,
        warning: 200,
        slam: 70,
        'boss-arrival': 95,
        'boss-warning': 220,
        'boss-charge': 75,
        'boss-thorns': 380
      }[event] ?? 300;
      note(hz, event === 'xp' ? hz * 1.2 : hz * .55, event === 'hurt' ? 'triangle' : 'sine', now, event === 'hurt' ? .15 : .1, event === 'hurt' ? .045 : .02);
    }
  }
  // Existing tails are brief; suspend immediately when muting or leaving the page.
  function suspend() {
    if (context?.state === 'running') context.suspend().catch(() => {});
  }
  return {
    unlock,
    play,
    suspend,
    state: () => context?.state ?? 'uninitialized'
  };
}
