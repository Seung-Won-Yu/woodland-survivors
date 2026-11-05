const paths={
 p:'M12 21h55v15H44v9H29l-4 14H13l8-26h-9zm55 4h20v7H67z',
 h:'M9 24h61v15H38l-5 19H20l5-19H9zm61 4h24v7H70zM39 39h15v18H39zM10 14h24v7H10z',
 r:'M13 21h65v23H13zm-6-5h9v34H7zm71 8h12l9 9-9 8H78zM29 44h13v14H28z',
 s:'M7 27h45V16h38v8H53v7h37v8H51l-9 17H28l5-19H7z',
 f:'M7 20h21v36H7zm25 8h32v10H47l-7 17H29l8-21zm31-5h14v21H63zM80 25l6-14 4 11 9 6-9 7-6 15-4-18z',
 v:'M5 23h64v7h27v7H69v6H43l-9 15H21l5-18H5zm41-12h40v7H46z',
 n:'M7 22h22v35H7zm24 3h48v18H46l-8 14H27l9-24zm48-8 16 17-16 16zM39 12h25v8H39z',
 tank:'M18 37h62l12 10-4 12H13L8 47zm15-23h34l9 23H23zm28 5h35v7H61z',
 med:'M38 8h24v15h22v24H62v15H38V47H16V23h22z',
 gear:'M45 8h12l3 10 10 4 9-5 8 9-5 10 4 9 10 3v12l-11 3-4 9-10-5-9 4-3 10H45l-3-11-9-4-10 5-8-9 5-9-4-9-10-3V36l11-3 4-9 9 5 10-4zM40 36v16h20V36z'
};
export function weaponIcon(id,cls=''){return `<svg class="weapon-icon ${cls}" viewBox="0 0 100 72" aria-hidden="true" focusable="false"><path d="${paths[id]||paths.h}" fill="currentColor" fill-rule="evenodd"/></svg>`;}
