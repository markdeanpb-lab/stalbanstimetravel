/* All story text: dialogue, letters, barks, objectives, journal entries. Everything here is fictional;
   real places are used as settings only. */
(function () {
  'use strict';
  const S = (window.SA.STORY = {});

  S.names = {
    robin: 'Robin', bev: 'Aunt Bev (phone)', okafor: 'Mrs Okafor', edieOld: 'Edie', edieYoung: 'Edie', josiah: 'Josiah Pennick', terry: 'Terry',
    abbott: 'Mrs Abbott', crabbe: 'Mr Crabbe', mayor: 'The Mayor', cook: 'Mrs Dawes', priya: 'Priya Pennick', dot: 'Dot', constable: 'Constable',
    auctioneer: 'Gentleman', reveller: 'Reveller', clerk: 'Clerk', narrator: '',
  };

  // ------------------------------------------------------------------ prologue (2026)
  S.phone1 = [
    ['bev', "Robin? It's Bev. You found St Albans, then. Did the bus stop where I said?"],
    ['robin', "Outside the Town Hall. Sorry, the Museum. Why is everything a museum now?"],
    ['bev', "Because everything here's old, love. Right. Lattimore and Hale, the solicitors. High Street, next to the Clock Tower. They've had a parcel for you since 1971."],
    ['robin', "Since before Mum was born."],
    ['bev', "Addressed to you. By name. 'Robin Pennick, to be handed over in person on the fifth of October 2026, not a day before.' Your great-great-granny Edie wrote that."],
    ['robin', "Edie. The Jubilee thief's daughter."],
    ['bev', "Don't you dare. Your Nana spent her whole life saying old Josiah never took a penny. You promised her you'd find out."],
    ['robin', "I promised her I'd look it up. I didn't think it'd involve a solicitor."],
    ['bev', "Go and get it. Ring me after. And Robin? Don't stand about on the Market Place gawping. They'll charge you for it."],
  ];
  S.towerSeen = [['robin', "There it is. Six hundred years of telling St Albans it's late."]];
  S.solicitor = [
    ['okafor', "Robin Pennick? You're expected. Not by me personally. By this."],
    ['okafor', "It's been in our strongroom since 1971. It has outlived three senior partners, two floods and a fax machine."],
    ['robin', "Who left it?"],
    ['okafor', "A Mrs Edith Pennick, aged ninety-one. Very particular. She asked us to pass on a message." ],
    ['okafor', "'Mind the steps, and don't wind it indoors.'"],
    ['robin', "Wind what?"],
    ['okafor', "Sign here, please. I'm not paid to speculate."],
  ];
  S.letter = {
    date: 'St Albans, 9th March 1971',
    body: [
      'My dear Robin,',
      "You won't remember me yet. You will.",
      "This key winds the old clock in the Tower, and other things besides. Stand by the Tower, hold it steady, turn it back, and listen for Gabriel. He's the bell. He's older than all of us and he never forgets a face.",
      "Then come and find me on French Row. I'll be old and you'll be late, so we'll both have something to complain about.",
      "Don't be frightened. You weren't, the first time.",
    ],
    sig: 'Your loving great-great-grandmother,<br>Edie Pennick',
    ps: 'P.S. Steady hands. Stand still when you wind it, and never with a policeman on your heels.',
  };
  S.atTower = [['robin', "'Stand by the Tower, turn it back, and listen.' Right. Totally normal Monday."]];

  // ------------------------------------------------------------------ 1964
  S.arrive1964 = [['robin', "Okay. Okay. That's not my century. And a van tried to sit on me."]];
  S.slipLines = {
    building: 'The key slipped you sideways: something solid stands where you were in this year.',
    vehicle: 'The key slipped you sideways: a vehicle was standing exactly where you landed.',
    road: 'The key slipped you onto the pavement: traffic was coming.',
    unsafe: 'The key slipped you to safer ground.',
  };
  S.edieMeet = [
    ['edieOld', "Well, don't stand there catching flies. You're late. Sixty-seven years late, give or take."],
    ['robin', "You're... Edie?"],
    ['edieOld', "Mrs Pennick to the likes of you. Oh, go on. Edie. You always did. You will. This tense business gives me a headache."],
    ['edieOld', "Jubilee night, 1897. The Tower clock stopped at fourteen minutes past nine, and the Jubilee Dinner Fund walked out of the Town Hall. Two hundred and twelve pounds. They blamed my father, the keeper of the clock."],
    ['robin', "Josiah."],
    ['edieOld', "Nobody ever proved it. Nobody ever needed to. Mud sticks in a small town, and it stuck to us for seventy years."],
    ['edieOld', "I saw the man who did it. Pale check suit. Red carnation. Carpet bag. Smelled of violet cachous. I told a constable and he told me to go home and stop riding my bicycle in bloomers."],
    ['robin', "And you want me to go back there."],
    ['edieOld', "Want? You already did. I was there. I saw you. Now, the key. Four rules, and mind them."],
  ];
  S.rules = [
    { id: 'earshot', title: 'Earshot', text: 'The key only works where Gabriel can be heard: the old town. Further out it goes cold.', line: ['edieOld', "One: it only works where you can hear Gabriel. The old town. Go too far and it goes cold as a fishmonger's hand."] },
    { id: 'steady', title: 'Steady hands', text: 'Wind it on foot, standing still, with nobody chasing you. It will not turn for a fugitive.', line: ['edieOld', "Two: steady hands. On your own two feet, standing still, and nobody chasing you. It won't turn for a fugitive."] },
    { id: 'rest', title: 'Rest', text: 'After each wind the key must rest: 45 seconds for a short wind, 90 for the long one (1897 to 2026).', line: ['edieOld', "Three: it needs a rest after. The further you wind, the longer it sulks."] },
    { id: 'pockets', title: 'Pockets', text: 'It takes you, your clothes and your pockets. Never vehicles, animals or other people. What you leave behind stays.', line: ['edieOld', "Four: it takes you, your clothes and your pockets. Not your bicycle. I learned that the hard way, in 1911, in the river."] },
    { id: 'slip', title: 'Same place, safe ground', text: 'You arrive on the same spot in the other year. If something solid is there, the key slips you to the nearest safe ground.', line: ['edieOld', "And it never puts you inside a wall. If something's standing where you'd land, it shoves you aside. You noticed."] },
  ];
  S.edieErrand = [
    ['robin', "There was a van."],
    ['edieOld', "There's always a van. Now, you can't go to 1897 looking like that. You'll be arrested for being Belgian."],
    ['edieOld', "Mrs Abbott's jumble stall, on the market in St Peter's Street. She's put by a gentleman's coat and cap for me. Here's half a crown."],
    ['edieOld', "Terry from the coffee bar has a scooter. Borrow it. Tell him I said so. He'll say no. Borrow it anyway."],
  ];
  S.terry = [['terry', "Oi! That's my scooter! Oh, you're Mrs P's mate. Go on then. Mind the mirrors. All fourteen of 'em."]];
  S.abbott = [
    ['abbott', "For Edie Pennick? One gentleman's coat, one cap, very lightly moth-eaten. Two and six."],
    ['robin', "Here."],
    ['abbott', "Ta, love. Tell Edie my clock's still losing ten minutes a day. She'll know what that means. I don't."],
  ];
  S.edieChange = [['edieOld', "Put it on, behind the screen. Go on, I've seen worse. I've seen the Sixties."]];
  S.edieSendoff = [
    ['edieOld', "There. You look like a curate who's lost a bet. Perfect."],
    ['edieOld', "Last thing. When you meet me, young me, don't tell me who you are. I didn't know until 1971, and I liked not knowing."],
    ['robin', "Why 1971?"],
    ['edieOld', "Because that's when I'll write you a letter. Off you go. The key's had its rest. Wind it back to the Jubilee, and give my love to Father."],
  ];
  S.terryBack = [['terry', "She's back! Not a scratch. Mrs P's mates are all right."]];
  S.terryDamaged = [['terry', "My mirrors! What've you done to my mirrors?"]];

  // ------------------------------------------------------------------ 1897
  S.arrive1897 = [['robin', "Gas lamps. Bunting. And the clock's stopped. ...Did I just stop the clock?"]];
  S.josiahBurst = [
    ['josiah', "Who's been at my clock? Gabriel's never struck at fourteen past in thirty years!"],
    ['edieYoung', "Father! There's shouting at the Town Hall. The Jubilee Fund's gone! The whole box!"],
    ['josiah', "Gone? But I've the only other key to the strongroom. Oh, Lord help us."],
    ['edieYoung', "You. Yes, you, the queer-looking curate. Did you see a man come out of the Town Hall arcade? He went towards the market like his coat-tails were on fire."],
    ['robin', "Pale check suit. Red carnation. Carpet bag."],
    ['edieYoung', "...How do you know that?"],
    ['robin', "Lucky guess. Which way?"],
    ['edieYoung', "St Peter's Street, among the crowds. Find him!"],
  ];
  S.suspects = {
    auctioneer: [['auctioneer', "I beg your pardon! I am an auctioneer, not a thief. Though I grant the professions are often confused."]],
    reveller: [['reveller', "A carnation? It's the Jubilee, friend. Everyone's in bloom. And I smell of nothing but good honest beer."]],
    crabbe: [
      ['robin', "Violets. Definitely violets."],
      ['crabbe', "I don't know what you're... Ah. Good evening. Must dash!"],
    ],
  };
  S.wrongSuspectRobin = ["No carpet bag. Not him.", "Check suit, but no carnation. Not him either."];
  S.chaseStart = [
    ['edieYoung', "He's taken the baker's cart! Take my bicycle. The brakes are... optimistic."],
  ];
  S.grabBag = [
    ['crabbe', "Thief! Constable! That curate has robbed me!"],
    ['robin', "Oh, come on."],
  ];
  S.loseThem = [['robin', "The key won't turn with them on my heels. Lose them first."]];
  S.edieBag = [
    ['edieYoung', "You've got it! Wait, there's a note in here."],
    ['edieYoung', "'To the Master of the Workhouse. The Committee have cancelled the Jubilee dinner and voted the money to a gilded lamp for the Town Hall steps, with their own names upon it. This is the people's money. Feed them tonight. A Friend.'"],
    ['edieYoung', "Oh, Mr Crabbe, you ridiculous, sentimental man. He wasn't stealing it. He was giving it away."],
    ['robin', "And your father gets the blame either way."],
    ['edieYoung', "Unless it goes back. Take it to the Town Hall and Father is cleared, the Committee get their lamp, and Mr Crabbe gets six months' hard labour."],
    ['edieYoung', "Or take it to the Corn Exchange, where the tables are laid and three hundred people are waiting for a dinner that isn't coming. They'll eat tonight. And folk will go on saying Father did it."],
    ['edieYoung', "It's your bag, curate. Your choice."],
  ];
  S.choice = {
    title: 'Where does the Jubilee Fund go?',
    body: "Carry the carpet bag to one of two places. You can't take it back afterwards: history will remember what you do.",
    returned: { label: 'The Town Hall', hint: "Josiah's name is cleared, Crabbe is arrested and the Committee builds its gilded lamp." },
    dinner: { label: 'The Corn Exchange', hint: "The cancelled dinner goes ahead for 300 people. Suspicion stays on Josiah." },
  };
  S.endReturned = [
    ['mayor', "Bless my soul. The Jubilee Fund! And the rogue? Crabbe? Constable, take that man!"],
    ['mayor', "And somebody tell Pennick he's a credit to this city. Three cheers for the curate!"],
    ['josiah', "I knew it. I knew Gabriel didn't stop for nothing."],
  ];
  S.endDinner = [
    ['cook', "Two hundred and twelve pounds? Lord above. Roast beef for three hundred, and plum duff after!"],
    ['edieYoung', "They'll whisper about Father till the day he dies. But look at them, curate. Just look at them."],
  ];
  S.goodbyeYoung = [
    ['edieYoung', "Who are you, really?"],
    ['robin', "Someone who'll see you again. You'll be older. I'll be late."],
    ['edieYoung', "...Cheek."],
  ];

  // ------------------------------------------------------------------ return to 2026
  S.arriveHome = [['robin', "Right. What did I do?"]];
  S.priya = [['priya', "Robin! Mum said you'd turn up looking like you'd seen a ghost. Come in, I'll put the kettle on. Pennicks have made clocks on this row since 1881. You've heard the speech."]];
  S.dot = [['dot', "Pay what you can, love. We've fed this town every Tuesday since Jubilee night 1897. Some anonymous saint paid for the first one."]];
  S.phoneFixx = [['clerk', "Screen protector? No? Then what are you staring at?"]];
  S.phone2 = {
    returned: [
      ['bev', "Robin! Why does the family Bible say Josiah Pennick was thanked by the Mayor in 1897? It never said that. I've read it a hundred times."],
      ['robin', "Nana was right, Bev. He never took a penny."],
      ['bev', "Well, of course he didn't! ...Robin, what have you done?"],
    ],
    dinner: [
      ['bev', "Robin, I've been through the biscuit tin. There's a menu in here from 1897. Roast beef for three hundred. And someone's written your name on the back in pencil."],
      ['robin', "Nana was right, Bev. Just not the way she thought."],
      ['bev', "...Robin, what have you done?"],
    ],
  };
  S.teaser = [['robin', "Gabriel just rang. I didn't wind anything."]];

  // ------------------------------------------------------------------ objectives
  S.obj = {
    toSolicitor: 'Walk to Lattimore & Hale, solicitors, on the High Street',
    lookTower: 'Look around: find the Clock Tower above the rooftops',
    enterSolicitor: 'Go into Lattimore & Hale',
    toTower: 'Go to the Clock Tower',
    windBack1964: 'Stand still and wind the key back to 1964 (hold the key button)',
    findEdie: "Find Edie's shop on French Row",
    talkEdie: 'Talk to Edie',
    getScooter: "Borrow Terry's scooter outside the Gabriel Espresso Bar",
    rideToStall: "Ride to Mrs Abbott's jumble stall on St Peter's Street",
    buyCoat: 'Buy the coat and cap from Mrs Abbott',
    backToEdie: "Take the coat back to Edie's on French Row",
    changeClothes: "Change behind Edie's screen",
    windBack1897: 'Wind the key back to 1897',
    findThief: 'Find the man Edie described: pale check suit, red carnation, carpet bag',
    chaseCart: 'Chase the baker\'s cart',
    grabBag: 'Ride alongside the cart and grab the carpet bag',
    loseCops: 'Lose the constables (break their line of sight)',
    meetEdie: 'Meet young Edie at the Clock Tower',
    choose: 'Choose: carry the Jubilee Fund to the Town Hall or to the Corn Exchange',
    windForward: 'Wind the key forward to 2026',
    seeChange: "See what's changed on French Row",
    done: 'Free roam: explore St Albans in any year',
  };

  // ------------------------------------------------------------------ hints (contextual teaching)
  S.hints = {
    move: { keyboard: 'Move with <b>W A S D</b>. Hold <b>Shift</b> to run.', touch: 'Drag the <b>left side</b> of the screen to walk. Hold <b>🏃 Run</b> to sprint.', gamepad: 'Move with the <b>left stick</b>. Hold <b>B</b> to run.' },
    look: { keyboard: 'Click and drag (or click to lock the mouse) to <b>look around</b>.', touch: 'Drag the <b>right side</b> of the screen to look around.', gamepad: 'Look around with the <b>right stick</b>.' },
    interact: { keyboard: 'Press <b>E</b> to interact.', touch: 'Tap <b>✋ Use</b> to interact.', gamepad: 'Press <b>A</b> to interact.' },
    wind: { keyboard: 'Stand still and <b>hold Q</b> to wind the key.', touch: 'Stand still and <b>hold ⌛ Key</b> to wind.', gamepad: 'Stand still and <b>hold X</b> to wind.' },
    pickEra: { keyboard: 'While winding, <b>1 / 2</b> (or the mouse wheel) choose the year.', touch: 'Tap a year above the button to choose it.', gamepad: 'Use the <b>d-pad</b> to choose the year.' },
    vehicle: { keyboard: 'Press <b>F</b> to get on or off. <b>W/S</b> throttle and brake, <b>A/D</b> steer, <b>Space</b> handbrake, <b>H</b> horn.', touch: 'Tap <b>🛵 Ride</b> to get on. Stick up to go, down to brake, sideways to steer.', gamepad: 'Press <b>Y</b> to get on. <b>RT</b> go, <b>LT</b> brake, left stick steers.' },
    map: { keyboard: 'Press <b>M</b> for the map, <b>J</b> for the journal, <b>Esc</b> for the menu.', touch: 'Tap <b>🗺 Map</b> for the map and <b>⏸ Menu</b> to pause.', gamepad: 'Press <b>Back</b> for the map, <b>Start</b> for the menu.' },
    wanted: { keyboard: 'Break line of sight: duck through alleys and passages until the stars fade.', touch: 'Break line of sight: duck through alleys and passages until the stars fade.', gamepad: 'Break line of sight: duck through alleys and passages until the stars fade.' },
  };

  // ------------------------------------------------------------------ UI strings
  S.ui = {
    keyNone: 'Not found',
    keyReady: 'Ready',
    keyRest: (s) => 'Resting ' + s,
    keyCold: 'Cold: out of earshot',
    keyChased: 'Hands shaking: lose the police',
    keyMoving: 'Stand still to wind',
    keyVehicle: 'Get off to wind',
    keyLocked: 'Not now',
    winding: 'Winding the Curfew Key…',
    windTo: (y) => 'to ' + y,
    lostThem: 'You lost them.',
    policeRemember: 'The police in this year still remember your face.',
    searching: { 2026: 'Officers searching', 1964: 'Constables searching', 1897: 'Constables searching' },
    chasing: { 2026: 'Patrol in pursuit', 1964: 'Constables in pursuit', 1897: 'City Police in pursuit' },
    boundary: "Gabriel can't hear you out there. The key goes cold. Head back into town.",
    outfitOdd: 'Out of place: people stare, police notice',
    saved: 'Game saved',
    gotItem: (n) => 'Got: ' + n,
  };
  S.items = {
    parcel: "Edie's parcel", key: 'The Curfew Key', letter: "Edie's letter (1971)", halfcrown: 'Half a crown (2s 6d)', coat: 'Gentleman\'s coat & cap (1890s)', bag: 'Carpet bag: the Jubilee Fund (£212)',
  };

  // ------------------------------------------------------------------ barks (all subtitled)
  S.barks = {
    2026: {
      outfit: ["Nice cosplay.", "Is there a Dickens festival on?", "Mate, the Sixties called. They want their jacket back.", "Is that for a podcast?"],
      bump: ["Watch it!", "Oi, phone down! Oh. That's you.", "Sorry! Why am I saying sorry?"],
      knocked: ["My oat latte!", "I'm putting this online.", "Unbelievable. Absolutely unbelievable."],
      car: ["Pavement's for walking!", "Are you mad?", "That's a pedestrian zone!"],
      police: ["Bloody hell.", "Is someone filming this?"],
      carjacked: ["That's my car! I've got a dentist at five!"],
    },
    1964: {
      outfit: ["Ooh, look at the spaceman.", "Is that what they're wearing in London now?", "You'll catch your death in that.", "Off to a fancy dress, are we?"],
      bump: ["Do you mind!", "Manners!", "Mind my bags!"],
      knocked: ["Me shopping!", "I'll have the law on you!", "Well, I never did."],
      car: ["Road hog!", "Slow down, you lunatic!"],
      police: ["Here, what's he done?", "Ooh, it's like the pictures."],
      carjacked: ["Oi! That's my car! It's got eleven payments left on it!"],
    },
    1897: {
      outfit: ["Heavens, what is that person wearing?", "Is the circus in town?", "Mind the foreigner, Mabel.", "A most peculiar jacket."],
      bump: ["I say!", "Have a care!", "Manners, sir! Or madam!"],
      knocked: ["My hat! My good hat!", "Ruffian!", "In front of the Queen's bunting, too."],
      car: ["Scorcher!", "Mind the horses!", "Reckless!"],
      police: ["Fetch a constable!", "Stop thief! Probably!"],
      carjacked: ["Stop! That's my cart! The bread'll be cold!"],
      cheer: ["God save the Queen!", "Sixty years! Hurrah!"],
    },
  };
  S.barkSpeaker = function (era, look) {
    if (era === 1897) return look && look.fem ? 'Lady' : 'Gentleman';
    if (era === 1964) return look && look.fem ? 'Shopper' : 'Passer-by';
    return 'Passer-by';
  };
  S.policeShouts = {
    2026: ["Stop! Police!", "Control, suspect heading for the Clock Tower.", "Stay where you are!"],
    1964: ["Oi! You! Stop in the name of the law!", "Hold it right there, sunshine!", "You're nicked! Well, you will be."],
    1897: ["Stop, thief!", "Halt, in the Queen's name!", "Fetch the sergeant!"],
  };
  S.caught = {
    2026: ["Right. You're getting words of advice and a leaflet. Off you go, and behave."],
    1964: ["Let's say no more about it this time. But I've got my eye on you, sunshine."],
    1897: ["A night in the cells and a shilling fine, if the Mayor weren't in such a Jubilee humour. Be off with you."],
  };
  S.missionCaught = [['constable', "Got you! Into the station with you, and we'll sort this out in the morning."], ['narrator', "The constable's grip slips in the Jubilee crowd. You get another chance."]];

  // ------------------------------------------------------------------ journal text
  S.journal = {
    premise: "On Jubilee night in 1897 the Clock Tower's clock stopped at 9.14 and the Jubilee Dinner Fund (£212) vanished from the Town Hall. Josiah Pennick, keeper of the clock and Robin's great-great-great-grandfather, took the blame. Robin's Nana always said he was innocent.",
    eras: {
      2026: 'Monday 5 October 2026. The Old Town Hall is now the Museum + Gallery. Christopher Place shopping centre stands where inn yards once were.',
      1964: 'Saturday 10 October 1964. Market day, five days before the general election. The police are working from a temporary station while Victoria Street is rebuilt. The Christopher site is a rubble car park.',
      1897: "Tuesday 22 June 1897. Queen Victoria's Diamond Jubilee. Gas lamps, bunting and a brass band. A saddler has the Clock Tower's ground floor; the clock keeper lives upstairs.",
    },
    teaser: "Gabriel rang once more, and nobody had wound the key. Someone else is out there with one. Edie's letter called them nothing at all, which is somehow worse.",
  };

  // ------------------------------------------------------------------ discoveries
  S.discoveries = [
    { id: 'eleanor', era: 'all', x: 0, z: 9, r: 3.5, title: 'The Eleanor Cross site', text: { 2026: "A cross for Queen Eleanor stood near here from 1291 until 1702. The town pump replaced it, and a drinking fountain replaced the pump.", 1964: "A cross for Queen Eleanor stood here from 1291 until 1702. Now there's a bus stop and a man selling the Evening News.", 1897: "Where Queen Eleanor's cross stood until 1702, Gilbert Scott's granite fountain of 1874 now gurgles. The water tastes of pennies." } },
    { id: 'waxhouse', era: 'all', x: -16, z: 30, r: 3.0, title: 'Waxhouse Gate', text: { 2026: "The pilgrims' way to the Abbey, where wax candles were sold. A small war memorial sits on the arch.", 1964: "The pilgrims' way to the Abbey. A war memorial on the arch lists names from the Great War.", 1897: "The pilgrims' way to the Abbey, through an arch older than anyone's grandmother. No memorial plaque yet; that will come after a war nobody here can imagine." } },
    { id: 'k6', era: 2026, x: 33, z: 4.5, r: 2.5, title: 'The Boot Alley phone box', text: "A K6 kiosk (Giles Gilbert Scott, 1935), listed. Nobody has made a call from it this decade. Somebody has left a book on Roman Verulamium inside." },
    { id: 'espresso', era: 1964, x: 33, z: -22, r: 3.0, title: 'The Gabriel Espresso Bar', text: "Frothy coffee in glass cups, a jukebox and a lot of parkas. Somebody local is supposed to be starting a band." },
    { id: 'rubble', era: 1964, x: -12, z: -60, r: 6.0, title: 'The Christopher site', text: "Council land since 1949: rubble, buddleia and parked cars. In twenty years it'll be a shopping centre named after the inn whose yard this was." },
    { id: 'saddler', era: 1897, x: 0, z: 6, r: 3.0, title: "Ashby's saddlery in the Clock Tower", text: "Harnesses hang outside the Tower's ground floor. The saddler works below, the clock keeper lives above, and Gabriel rings over both of them." },
    { id: 'band', era: 1897, x: 108, z: -88, r: 9.0, title: 'The Jubilee band', text: "A brass band in red tunics plays outside the Town Hall. The tuba is a fraction behind the beat, and the crowd is a fraction too pleased to care." },
    { id: 'peahen', era: 1897, x: 58, z: 62, r: 6.0, title: 'The old coaching inn', text: "The old inn on the corner of Holywell Hill, before its rebuilding next year. Coaches once changed horses here on the London road." },
  ];
  S.postcards = { clocktower: 'The Clock Tower', cathedral: 'Cathedral west front', townhall: 'The Town Hall', gateway: 'The Abbey Gateway', corn: 'The Corn Exchange' };
})();
