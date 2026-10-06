/* Era definitions: the single source of truth for how each year looks, sounds and behaves. */
(function () {
  'use strict';
  const SA = window.SA;

  function sunDir(azDeg, elDeg) {
    const A = (azDeg * Math.PI) / 180, E = (elDeg * Math.PI) / 180;
    // x east, y up, z = -north
    return [Math.sin(A) * Math.cos(E), Math.sin(E), -Math.cos(A) * Math.cos(E)];
  }

  const ERAS = (SA.ERAS = {
    2026: {
      id: 2026,
      name: 'Present day',
      dateLong: 'Monday 5 October 2026',
      timeText: '4.40 pm',
      clock: { h: 16, m: 40 },
      blurb: 'Late afternoon, low autumn sun.',
      sky: { top: 0x5d8fd0, mid: 0xa9c4e2, horizon: 0xf0cfa6, sunGlow: 0xffd6a0 },
      sun: { dir: sunDir(241, 15), color: 0xffd7aa, intensity: 2.6 },
      // renderer look: physical sky, exposure, environment light, bloom and colour grade (core/render.js)
      look: {
        sky: { turbidity: 3.4, rayleigh: 1.35, mie: 0.006, mieG: 0.82, clouds: 0.36, cloudDensity: 0.5, gain: 1.0 },
        exposure: 0.78, env: 0.75,
        bloom: { intensity: 0.32, threshold: 0.95 },
        grade: { lift: [0.0, 0.0, 0.012], gamma: [1.0, 1.0, 1.0], gain: [1.03, 1.0, 0.97], sat: 1.12, contrast: 1.13, vignette: 0.26, grain: 0.0, split: 0.12, shadowTint: '#6a7fa8', highTint: '#ffcfa0' },
      },
      hemi: { sky: 0xcfdcf5, ground: 0x6e6255, intensity: 1.05 },
      fog: { color: 0xd7c8b6, near: 110, far: 460 },
      exposure: 1.0,
      grade: { color: 'rgba(255,200,150,0.05)', vignette: 0.25, grain: 0 },
      night: 0, // 0 day ... 1 night (lamps, windows)
      windowLight: 0.15,
      lampStyle: 'led',
      ground: { pave: '#a8a39a', road: '#4a4a4c', setts: '#8b8379', grass: '#5f7f3e', edge: '#c9c4ba', line: '#f1f1ec', yellow: '#e8c33a' },
      walls: { brick: ['#9a4b35', '#8e4430', '#a85a40', '#7d3f2e', '#b0664a'], stucco: ['#ece6d8', '#e4dccb', '#f2efe6', '#d9d0bd', '#e8e0d0'], stock: ['#c9b48a', '#bfa77b'], flint: ['#8c8a84'] },
      npc: {
        count: 46,
        palette: {
          top: ['#20232a', '#2f3b52', '#4a5a3a', '#7a7066', '#c8b79c', '#a33a3a', '#e3c84a', '#2a6f78', '#d97ba0', '#eeeeee', '#3d3d3d', '#5b3f6b'],
          legs: ['#2b3f63', '#1f2a40', '#222222', '#3a3a3a', '#6b6156', '#8a7f72', '#2f4a6b'],
          skin: ['#f1c9a5', '#e0ac85', '#c68c63', '#8d5a3b', '#5c3a26', '#f6d7bd'],
          hair: ['#2a1d14', '#4a3222', '#8a6a44', '#c8a464', '#1a1a1a', '#b7b2aa', '#7a3b21'],
        },
        hats: { none: 0.62, beanie: 0.12, cap: 0.12, hood: 0.1, bun: 0.04 },
        skirts: 0.12,
        props: { phone: 0.35, coffee: 0.12, bag: 0.25 },
        speed: [1.05, 1.45],
        lines: 'npc2026',
      },
      vehicles: { player: ['hatch', 'estate'], traffic: ['hatch', 'hatch', 'suv', 'van', 'estate', 'bus2026', 'cab'], density: 9 },
      police: { name: 'Police', unit: 'patrol car', car: 'police2026', foot: 'pc2026', siren: 'siren2026', maxStars: 4 },
      ambience: 'amb2026',
      currency: '£',
    },
    1964: {
      id: 1964,
      name: 'The sixties',
      dateLong: 'Saturday 10 October 1964',
      timeText: '11.30 am',
      clock: { h: 11, m: 30 },
      blurb: 'Market day, five days before the general election.',
      sky: { top: 0x6f9cc8, mid: 0xb7cfe0, horizon: 0xe9e2cf, sunGlow: 0xfff0c8 },
      sun: { dir: sunDir(158, 29), color: 0xfff1d6, intensity: 2.5 },
      // a warm, slightly faded colour-film look
      look: {
        sky: { turbidity: 4.6, rayleigh: 1.15, mie: 0.007, mieG: 0.8, clouds: 0.5, cloudDensity: 0.45, gain: 0.95 },
        exposure: 0.79, env: 0.7,
        bloom: { intensity: 0.3, threshold: 0.95 },
        grade: { lift: [0.025, 0.02, 0.0], gamma: [1.0, 1.0, 0.98], gain: [1.04, 1.0, 0.9], sat: 0.94, contrast: 1.12, vignette: 0.36, grain: 0.045, split: 0.16, shadowTint: '#5f8a86', highTint: '#ffd9a2' },
      },
      hemi: { sky: 0xd8e4ef, ground: 0x6f6452, intensity: 1.15 },
      fog: { color: 0xd9d3c0, near: 90, far: 400 },
      exposure: 1.02,
      grade: { color: 'rgba(255,170,90,0.10)', vignette: 0.35, grain: 0.06 },
      night: 0,
      windowLight: 0.05,
      lampStyle: 'concrete',
      ground: { pave: '#9b978d', road: '#525050', setts: '#837a70', grass: '#6b8a45', edge: '#bdb7aa', line: '#ecebe2', yellow: '#d9b84a' },
      walls: { brick: ['#8f4a36', '#7f3f2e', '#9c5640', '#6f3a2b', '#a35f45'], stucco: ['#e5ddc8', '#ddd2bb', '#ece4d2', '#cfc4ad', '#e2d6bf'], stock: ['#bda67c', '#b39a70'], flint: ['#85827b'] },
      npc: {
        count: 50,
        palette: {
          top: ['#5a5f6b', '#6b5440', '#2d3a55', '#3b4b3a', '#c9b38a', '#8a2f2f', '#d9a441', '#7aa6b8', '#e7c9c9', '#f2efe4', '#4b4f2e', '#9b6b9f', '#d46a3a'],
          legs: ['#3a3a40', '#4a4036', '#2b2b2b', '#5a5248', '#6b6b6b', '#3a4a6b'],
          skin: ['#f1c9a5', '#e8b996', '#d9a17c', '#a8714d', '#f5d4b8'],
          hair: ['#2a1d14', '#4a3222', '#8a6a44', '#d8b878', '#1a1a1a', '#9a9590', '#6b2f1a'],
        },
        hats: { none: 0.46, trilby: 0.12, flatcap: 0.14, headscarf: 0.14, beehive: 0.08, parka: 0.06 },
        skirts: 0.38,
        props: { basket: 0.2, paper: 0.12, bag: 0.15 },
        speed: [1.0, 1.35],
        lines: 'npc1964',
      },
      vehicles: { player: ['scooter', 'saloon60'], traffic: ['saloon60', 'saloon60', 'small60', 'van60', 'bus1964', 'saloon60', 'scooter'], density: 8 },
      police: { name: 'Hertfordshire Constabulary', unit: 'patrol car', car: 'police1964', bike: 'noddy', foot: 'pc1964', siren: 'bell1964', maxStars: 3 },
      ambience: 'amb1964',
      currency: '£sd',
    },
    1897: {
      id: 1897,
      name: 'Jubilee night',
      dateLong: 'Tuesday 22 June 1897',
      timeText: '9.13 pm',
      clock: { h: 21, m: 13 },
      blurb: "Queen Victoria's Diamond Jubilee. Gas lamps and lanterns.",
      sky: { top: 0x16264a, mid: 0x3d5682, horizon: 0xd88a52, sunGlow: 0xff9a55 },
      sun: { dir: sunDir(318, 7), color: 0xffb27a, intensity: 0.75 },
      // Jubilee night: deep twilight in the north-west, first stars, gas light that blooms
      look: {
        sky: { sun: [321, -6], turbidity: 2.2, rayleigh: 2.4, mie: 0.004, mieG: 0.78, clouds: 0.16, cloudDensity: 0.4, gain: 1.0, twilight: 1.0, stars: 1.0, horizon: 0.16 },
        exposure: 1.18, env: 0.4,
        bloom: { intensity: 1.05, threshold: 0.72 },
        grade: { lift: [0.01, 0.012, 0.03], gamma: [1.0, 0.99, 0.97], gain: [1.06, 0.99, 0.9], sat: 0.84, contrast: 1.1, vignette: 0.48, grain: 0.06, split: 0.2, shadowTint: '#4a5a8a', highTint: '#ffb26a' },
      },
      hemi: { sky: 0x7f93c4, ground: 0x4a3a2c, intensity: 0.95 },
      fog: { color: 0x4a4a5c, near: 55, far: 300 },
      exposure: 1.05,
      grade: { color: 'rgba(255,170,90,0.12)', vignette: 0.5, grain: 0.09 },
      night: 0.75,
      windowLight: 0.85,
      lampStyle: 'gas',
      ground: { pave: '#8d8478', road: '#6b5f50', setts: '#77706a', grass: '#56703b', edge: '#a39a8a', line: null, yellow: null },
      walls: { brick: ['#8a4a36', '#7a3f2e', '#955440', '#6a3a2b', '#9b5a42'], stucco: ['#ddd3bd', '#d4c8ae', '#e3d9c4', '#c8bba0', '#d9ccb2'], stock: ['#b29c74', '#a8916a'], flint: ['#7e7b74'] },
      npc: {
        count: 56,
        palette: {
          top: ['#1d1d22', '#2c2620', '#3a2f28', '#4a4038', '#2b3245', '#5a2a2a', '#3e4a35', '#5e5248', '#f0ebdf', '#6b4a6b', '#2a3a4a'],
          legs: ['#1e1e22', '#2b2622', '#3a342e', '#4a4440', '#222a38', '#5a2a2a', '#3a2c40'],
          skin: ['#f3d2b4', '#e9bf9b', '#dcae8a', '#f6dcc4', '#c99a74'],
          hair: ['#2a1d14', '#4a3222', '#7a5a3a', '#b89060', '#1a1a1a', '#a8a39b'],
        },
        hats: { bowler: 0.24, flatcap: 0.18, boater: 0.16, ladyhat: 0.26, tophat: 0.05, bonnet: 0.06, none: 0.05 },
        skirts: 0.45,
        longSkirts: true,
        props: { flag: 0.1, cane: 0.08, basket: 0.08 },
        speed: [0.85, 1.2],
        lines: 'npc1897',
      },
      vehicles: { player: ['bicycle', 'cart'], traffic: ['cart', 'hansom', 'cart', 'dray', 'bicycle'], density: 6 },
      police: { name: 'St Albans City Police', unit: 'constables', foot: 'pc1897', bike: 'sergeantBike', siren: 'whistle', maxStars: 3 },
      ambience: 'amb1897',
      currency: '£sd',
    },
  });

  SA.ERA_ORDER = [1897, 1964, 2026];
  SA.eraIndex = (y) => SA.ERA_ORDER.indexOf(y);

  // ------------------------------------------------------------------ fictional shop names by era and kind
  // All names are invented. Where a real building is recognisable, its occupant is fictional.
  SA.SHOPNAMES = {
    2026: {
      generic: ['Verulam Bean', 'Crumb & Co', 'Abbey Optics', 'Gabriel Gifts', 'Ver Valley Homes', 'Scoop & Saucer', 'Hartley Thread', 'Little Linen Co', 'Phone Fixx', 'The Paper Mill', 'Northcott Shoes',
        'Pippin Kitchen', 'Salt & Cedar', 'Bramble Florist', 'Cask & Crow', 'Mint Leaf Thai', 'Kettle & Key', 'Halfpenny Books', 'Odd Socks', 'Wren Wines', 'Fennel Deli', 'Atlas Travel', 'Corner Cuts Barbers',
        'Luna Nails', 'Fable Toys', 'The Lamp Room', 'Hearth Homeware', 'Kimono Ramen', 'Penny Lane Vintage', 'Cobble Coffee', 'Marlow Jewellers', 'Bloom Pharmacy', 'Quire Stationers', 'Velvet Bean'],
      bank: ['Albion Bank', 'Ver Building Society', 'Meridian Bank'],
      pub: ['The Bell & Gabriel', 'The Old Fusilier', 'The Mitre & Cross'],
      food: ['Pizzeria Romana', 'Saffron Spice', 'Burger Yard', 'Noodle Bar 88', 'Crêpe Corner'],
    },
    1964: {
      generic: ['F. W. Bassett Outfitters', 'Hollis Radio & TV', 'Mayhew Chemist', 'Coopers Shoe Shop', 'The Wool Shop', 'Dorothy\'s Hats', 'Pratt Ironmonger', 'Lennard Butchers', 'Crowther Bakers', 'Golding Fruit & Veg',
        'Savoy Tobacconist', 'Abbey Cycles', 'Peach Hairdressing', 'Greaves Newsagent', 'Ver Vintners', 'Kendal Furnishers', 'Marsh Photographic', 'Twyford Opticians', 'Holloway Records', 'Fenton Toys',
        'Bunce & Son Grocers', 'Tasker Haberdashery', 'Ashby Hardware', 'Gas Showroom', 'Electricity Showroom', 'Henley Dry Cleaners'],
      bank: ['Albion Bank', 'Verulam & County Bank', 'Midshires Bank'],
      pub: ['The Bell & Gabriel', 'The Old Fusilier', 'The Mitre & Cross'],
      food: ['The Gabriel Espresso Bar', 'Wagon Wheel Grill', 'Copper Kettle Tea Rooms', 'Market Café'],
    },
    1897: {
      generic: ['W. Ashby, Saddler', 'J. Hollis, Draper', 'T. Mayhew, Chemist', 'Coopers Boot Maker', 'E. Golding, Fruiterer', 'Lennard, Family Butcher', 'Crowther, Baker', 'Pratt, Ironmonger', 'Greaves, Stationer',
        'Straw Hat Warehouse', 'H. Kendal, Upholsterer', 'Tasker, Milliner', 'Bunce & Son, Grocers', 'Marsh, Photographer', 'R. Twyford, Watchmaker', 'S. Fenton, Toys & Fancy Goods', 'Hale, Tailor & Outfitter',
        'Dawes, Corn Chandler', 'Pilling, Tobacconist', 'Bassett, Hosier'],
      bank: ['The County Bank', 'Verulam Savings Bank'],
      pub: ['The Bell', 'The French King', 'The Mitre & Cross'],
      food: ['Coffee Tavern', 'Temperance Dining Rooms'],
    },
  };
})();
