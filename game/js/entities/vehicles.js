/* Vehicles: era models (instanced), arcade physics with real slopes, enter/exit, horses. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const V = (SA.Vehicles = { list: [], defs: {}, meshes: {}, horses: null });
  const PP = () => SA.Props;

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r1, r2, h, s) => new THREE.CylinderGeometry(r1, r2, h, s || 10);
  function wheel(x, y, z, r, w, col) {
    return PP().part(cyl(r, r, w || 0.22, 12), col || '#151515', x, y, z, 0, 0, Math.PI / 2);
  }
  function bikeWheel(x, y, z, r) {
    const t = new THREE.TorusGeometry(r, 0.025, 6, 18);
    return PP().part(t, '#1a1a1a', x, y, z, 0, Math.PI / 2, 0);
  }

  // ------------------------------------------------------------------ definitions
  // Model space: +z forward, x right, y up. Each def: {paint(): [geos], trim(): [geos]}
  function D(id, o) {
    V.defs[id] = Object.assign({ id, name: id, len: 4, wid: 1.8, radius: 2.1, maxSpeed: 19, accel: 5, brake: 11, reverse: 5, steer: 0.55, wheelBase: 2.5, drag: 0.08, slopeK: 1, camDist: 7.5, camHeight: 1.7, seats: 1, colors: ['#888'], showRider: false, riderPose: 'car', horse: false, horn: 'horn2026', engine: 'car' }, o);
  }
  const P = (...a) => PP().part(...a);
  D('hatch', {
    name: 'Hatchback', len: 4.0, wid: 1.76, radius: 2.0, maxSpeed: 21, accel: 5.2, colors: ['#b8312f', '#2a4f86', '#e8e6e0', '#2b2b2b', '#6d7278', '#3e6b4f', '#d9a441', '#8b3a62'],
    paint: () => [P(box(1.76, 0.62, 4.0), '#fff', 0, 0.62, 0), P(box(1.6, 0.1, 2.0), '#fff', 0, 1.47, -0.25)],
    trim: () => [P(box(1.62, 0.5, 2.1), '#1c2733', 0, 1.18, -0.25), P(box(1.78, 0.18, 0.12), '#2a2a2a', 0, 0.42, 2.0), P(box(1.78, 0.18, 0.12), '#2a2a2a', 0, 0.42, -2.0), P(box(0.36, 0.1, 0.05), '#f4f4ea', 0.6, 0.72, 2.01), P(box(0.36, 0.1, 0.05), '#f4f4ea', -0.6, 0.72, 2.01), P(box(0.3, 0.12, 0.05), '#c4161c', 0.65, 0.78, -2.01), P(box(0.3, 0.12, 0.05), '#c4161c', -0.65, 0.78, -2.01), wheel(0.82, 0.33, 1.3, 0.33), wheel(-0.82, 0.33, 1.3, 0.33), wheel(0.82, 0.33, -1.3, 0.33), wheel(-0.82, 0.33, -1.3, 0.33)],
  });
  D('estate', {
    name: 'Estate car', len: 4.6, wid: 1.8, radius: 2.3, maxSpeed: 22, accel: 5, colors: ['#5a6470', '#1d1d1d', '#e8e6e0', '#7a2a2a', '#2f4858'],
    paint: () => [P(box(1.8, 0.62, 4.6), '#fff', 0, 0.62, 0), P(box(1.66, 0.1, 2.9), '#fff', 0, 1.5, -0.4)],
    trim: () => [P(box(1.68, 0.52, 3.0), '#1c2733', 0, 1.2, -0.4), P(box(1.82, 0.18, 0.12), '#2a2a2a', 0, 0.42, 2.3), P(box(0.36, 0.1, 0.05), '#f4f4ea', 0.6, 0.72, 2.31), P(box(0.36, 0.1, 0.05), '#f4f4ea', -0.6, 0.72, 2.31), wheel(0.84, 0.34, 1.5, 0.34), wheel(-0.84, 0.34, 1.5, 0.34), wheel(0.84, 0.34, -1.5, 0.34), wheel(-0.84, 0.34, -1.5, 0.34)],
  });
  D('suv', {
    name: 'SUV', len: 4.7, wid: 1.95, radius: 2.4, maxSpeed: 21, accel: 4.6, colors: ['#1d1d1d', '#e8e6e0', '#3a4a5a', '#6a6a6a', '#2f3f2f'],
    paint: () => [P(box(1.95, 0.85, 4.7), '#fff', 0, 0.78, 0), P(box(1.8, 0.1, 3.0), '#fff', 0, 1.82, -0.3)],
    trim: () => [P(box(1.84, 0.6, 3.1), '#1c2733', 0, 1.5, -0.3), P(box(1.96, 0.22, 0.12), '#222', 0, 0.48, 2.36), P(box(0.4, 0.12, 0.05), '#f4f4ea', 0.65, 0.95, 2.36), P(box(0.4, 0.12, 0.05), '#f4f4ea', -0.65, 0.95, 2.36), wheel(0.92, 0.4, 1.55, 0.4, 0.28), wheel(-0.92, 0.4, 1.55, 0.4, 0.28), wheel(0.92, 0.4, -1.55, 0.4, 0.28), wheel(-0.92, 0.4, -1.55, 0.4, 0.28)],
  });
  D('van', {
    name: 'Delivery van', len: 5.4, wid: 2.0, radius: 2.7, maxSpeed: 17, accel: 3.8, colors: ['#eeeeea', '#eeeeea', '#d9d9d4', '#2a4f86'],
    paint: () => [P(box(2.0, 1.9, 4.0), '#fff', 0, 1.35, -0.6), P(box(2.0, 1.1, 1.4), '#fff', 0, 0.95, 2.0)],
    trim: () => [P(box(1.9, 0.6, 0.06), '#1c2733', 0, 1.65, 2.05), P(box(2.02, 0.2, 0.12), '#222', 0, 0.42, 2.72), wheel(0.92, 0.38, 1.9, 0.38, 0.25), wheel(-0.92, 0.38, 1.9, 0.38, 0.25), wheel(0.92, 0.38, -1.8, 0.38, 0.25), wheel(-0.92, 0.38, -1.8, 0.38, 0.25)],
  });
  D('cab', {
    name: 'Taxi', len: 4.6, wid: 1.85, radius: 2.3, maxSpeed: 20, accel: 4.8, colors: ['#16171a'],
    paint: () => [P(box(1.85, 0.7, 4.6), '#fff', 0, 0.66, 0), P(box(1.7, 0.1, 2.4), '#fff', 0, 1.68, -0.3)],
    trim: () => [P(box(1.72, 0.66, 2.5), '#1c2733', 0, 1.33, -0.3), P(box(0.5, 0.16, 0.25), '#f2c94c', 0, 1.8, 0.2), wheel(0.86, 0.36, 1.45, 0.36), wheel(-0.86, 0.36, 1.45, 0.36), wheel(0.86, 0.36, -1.45, 0.36), wheel(-0.86, 0.36, -1.45, 0.36)],
  });
  D('bus2026', {
    name: 'Bus', len: 11, wid: 2.5, radius: 5.4, maxSpeed: 12, accel: 2.0, steer: 0.45, wheelBase: 6, colors: ['#2a5fae', '#c8102e'], camDist: 13, camHeight: 3,
    paint: () => [P(box(2.5, 2.9, 11), '#fff', 0, 1.75, 0)],
    trim: () => [P(box(2.54, 0.9, 10.2), '#1c2733', 0, 2.15, -0.1), P(box(2.3, 1.1, 0.06), '#1c2733', 0, 2.1, 5.51), P(box(1.4, 0.25, 0.06), '#ffb000', 0, 2.95, 5.52), wheel(1.1, 0.48, 3.6, 0.48, 0.3), wheel(-1.1, 0.48, 3.6, 0.48, 0.3), wheel(1.1, 0.48, -3.4, 0.48, 0.3), wheel(-1.1, 0.48, -3.4, 0.48, 0.3)],
  });
  D('police2026', {
    name: 'Police car', len: 4.6, wid: 1.85, radius: 2.3, maxSpeed: 25, accel: 6.5, colors: ['#ffffff'], horn: 'horn2026',
    paint: () => [P(box(1.85, 0.66, 4.6), '#fff', 0, 0.64, 0), P(box(1.7, 0.1, 2.5), '#fff', 0, 1.56, -0.3)],
    trim: () => {
      const g = [P(box(1.72, 0.55, 2.6), '#1c2733', 0, 1.25, -0.3), P(box(1.1, 0.14, 0.3), '#2457d6', 0, 1.68, -0.2), wheel(0.86, 0.35, 1.45, 0.35), wheel(-0.86, 0.35, 1.45, 0.35), wheel(0.86, 0.35, -1.45, 0.35), wheel(-0.86, 0.35, -1.45, 0.35)];
      for (let i = 0; i < 6; i++) {
        const z = -2.0 + i * 0.8;
        for (const sx of [-1, 1]) g.push(P(box(0.04, 0.3, 0.78), i % 2 ? '#1d3fb3' : '#e7ff1c', sx * 0.94, 0.62, z + 0.4));
      }
      return g;
    },
  });
  // 1964
  D('saloon60', {
    name: 'Saloon', len: 3.9, wid: 1.55, radius: 1.95, maxSpeed: 17, accel: 3.6, brake: 8, colors: ['#9fb8a6', '#d9cfa8', '#6f8fb4', '#b8312f', '#2b2b2b', '#e8e2cf', '#7a8a5a', '#c9a3a3'],
    paint: () => [P(box(1.55, 0.62, 3.9), '#fff', 0, 0.62, 0), P(box(1.36, 0.08, 1.6), '#fff', 0, 1.42, -0.2)],
    trim: () => [P(box(1.4, 0.5, 1.7), '#26333a', 0, 1.15, -0.2), P(box(1.6, 0.1, 0.12), '#d8d8d8', 0, 0.44, 1.98), P(box(1.6, 0.1, 0.12), '#d8d8d8', 0, 0.44, -1.98), P(cyl(0.11, 0.11, 0.05, 10), '#fffbe6', 0.55, 0.78, 1.96, Math.PI / 2), P(cyl(0.11, 0.11, 0.05, 10), '#fffbe6', -0.55, 0.78, 1.96, Math.PI / 2), wheel(0.72, 0.31, 1.2, 0.31, 0.18), wheel(-0.72, 0.31, 1.2, 0.31, 0.18), wheel(0.72, 0.31, -1.2, 0.31, 0.18), wheel(-0.72, 0.31, -1.2, 0.31, 0.18)],
  });
  D('small60', {
    name: 'Small saloon', len: 3.05, wid: 1.4, radius: 1.6, maxSpeed: 17, accel: 4.0, steer: 0.62, wheelBase: 2.0, colors: ['#c8102e', '#e8e2cf', '#2e6b3a', '#1d3c6e', '#d9a441', '#6f8fb4'],
    paint: () => [P(box(1.4, 0.6, 3.05), '#fff', 0, 0.55, 0), P(box(1.26, 0.06, 1.7), '#fff', 0, 1.3, -0.1)],
    trim: () => [P(box(1.3, 0.48, 1.8), '#26333a', 0, 1.03, -0.1), P(box(1.42, 0.08, 0.1), '#d8d8d8', 0, 0.36, 1.53), P(cyl(0.09, 0.09, 0.05, 10), '#fffbe6', 0.48, 0.7, 1.52, Math.PI / 2), P(cyl(0.09, 0.09, 0.05, 10), '#fffbe6', -0.48, 0.7, 1.52, Math.PI / 2), wheel(0.64, 0.26, 1.0, 0.26, 0.16), wheel(-0.64, 0.26, 1.0, 0.26, 0.16), wheel(0.64, 0.26, -1.0, 0.26, 0.16), wheel(-0.64, 0.26, -1.0, 0.26, 0.16)],
  });
  D('van60', {
    name: 'Bakery van', len: 4.3, wid: 1.7, radius: 2.2, maxSpeed: 14, accel: 3, colors: ['#e8e2cf', '#9fb8a6', '#d9cfa8'],
    paint: () => [P(box(1.7, 1.55, 3.0), '#fff', 0, 1.2, -0.6), P(box(1.6, 0.85, 1.3), '#fff', 0, 0.85, 1.5)],
    trim: () => [P(box(1.5, 0.45, 0.06), '#26333a', 0, 1.42, 1.0), P(box(1.72, 0.32, 2.4), '#8a3a2a', 0, 1.62, -0.6), wheel(0.78, 0.32, 1.4, 0.32, 0.18), wheel(-0.78, 0.32, 1.4, 0.32, 0.18), wheel(0.78, 0.32, -1.4, 0.32, 0.18), wheel(-0.78, 0.32, -1.4, 0.32, 0.18)],
  });
  D('bus1964', {
    name: 'Country bus', len: 8.4, wid: 2.4, radius: 4.2, maxSpeed: 11, accel: 1.8, steer: 0.48, wheelBase: 5, colors: ['#2e6b3a'], camDist: 12, camHeight: 3.5,
    paint: () => [P(box(2.4, 4.0, 8.4), '#fff', 0, 2.35, 0)],
    trim: () => [P(box(2.44, 0.75, 7.8), '#26333a', 0, 1.85, 0), P(box(2.44, 0.75, 7.8), '#26333a', 0, 3.5, 0), P(box(2.45, 0.22, 8.42), '#e8dcb0', 0, 2.62, 0), wheel(1.05, 0.5, 2.8, 0.5, 0.3), wheel(-1.05, 0.5, 2.8, 0.5, 0.3), wheel(1.05, 0.5, -2.6, 0.5, 0.3), wheel(-1.05, 0.5, -2.6, 0.5, 0.3)],
  });
  D('police1964', {
    name: 'Police car', len: 4.6, wid: 1.7, radius: 2.3, maxSpeed: 20, accel: 4.4, colors: ['#1a1f2a'], horn: 'bell1964',
    paint: () => [P(box(1.7, 0.72, 4.6), '#fff', 0, 0.68, 0), P(box(1.5, 0.08, 2.0), '#fff', 0, 1.56, -0.25)],
    trim: () => [P(box(1.55, 0.55, 2.1), '#26333a', 0, 1.25, -0.25), P(box(0.9, 0.22, 0.24), '#f2f2f2', 0, 1.72, -0.1), P(box(1.74, 0.1, 0.12), '#d8d8d8', 0, 0.44, 2.33), P(cyl(0.11, 0.08, 0.16, 10), '#d9b45a', 0.45, 0.62, 2.38, Math.PI / 2), wheel(0.78, 0.34, 1.45, 0.34, 0.2), wheel(-0.78, 0.34, 1.45, 0.34, 0.2), wheel(0.78, 0.34, -1.45, 0.34, 0.2), wheel(-0.78, 0.34, -1.45, 0.34, 0.2)],
  });
  D('scooter', {
    name: 'Scooter', len: 1.8, wid: 0.7, radius: 0.95, maxSpeed: 14, accel: 4.2, brake: 9, steer: 0.75, wheelBase: 1.25, colors: ['#9fd3c7', '#e8e2cf', '#c8102e', '#f2c94c'], showRider: true, riderPose: 'scooter', camDist: 5.2, camHeight: 1.5, slopeK: 1.3, horn: 'scooterHorn', engine: 'scooter',
    paint: () => [P(box(0.62, 0.42, 0.9), '#fff', 0, 0.48, -0.35), P(box(0.5, 0.75, 0.08), '#fff', 0, 0.72, 0.45), P(box(0.36, 0.08, 0.5), '#fff', 0, 0.28, 0.25)],
    trim: () => [P(box(0.34, 0.1, 0.62), '#2a2420', 0, 0.76, -0.3), P(cyl(0.04, 0.04, 0.6, 6), '#c0c0c0', 0, 1.0, 0.5, 0, 0, Math.PI / 2), P(cyl(0.025, 0.025, 0.55, 6), '#c0c0c0', 0, 0.75, 0.55), P(cyl(0.06, 0.06, 0.02, 10), '#e0e0e0', 0.32, 1.32, 0.48, Math.PI / 2), P(cyl(0.06, 0.06, 0.02, 10), '#e0e0e0', -0.32, 1.32, 0.48, Math.PI / 2), P(cyl(0.012, 0.012, 0.32, 4), '#c0c0c0', 0.32, 1.16, 0.48), P(cyl(0.012, 0.012, 0.32, 4), '#c0c0c0', -0.32, 1.16, 0.48), wheel(0, 0.2, 0.62, 0.2, 0.1), wheel(0, 0.2, -0.62, 0.2, 0.1)],
  });
  D('noddy', {
    name: 'Police motorcycle', len: 2.0, wid: 0.7, radius: 1.0, maxSpeed: 15, accel: 4.0, steer: 0.7, wheelBase: 1.35, colors: ['#5a5f66'], showRider: true, riderPose: 'scooter', horn: 'bell1964', engine: 'scooter',
    paint: () => [P(box(0.6, 0.6, 0.12), '#fff', 0, 0.62, 0.45), P(box(0.5, 0.36, 1.0), '#fff', 0, 0.5, -0.2)],
    trim: () => [P(box(0.3, 0.1, 0.55), '#222', 0, 0.78, -0.25), P(cyl(0.035, 0.035, 0.62, 6), '#c0c0c0', 0, 0.98, 0.5, 0, 0, Math.PI / 2), wheel(0, 0.26, 0.7, 0.26, 0.1), wheel(0, 0.26, -0.7, 0.26, 0.1)],
  });
  // 1897
  D('bicycle', {
    name: 'Safety bicycle', len: 1.75, wid: 0.5, radius: 0.9, maxSpeed: 8.5, accel: 2.4, brake: 5, steer: 0.7, wheelBase: 1.1, colors: ['#1d1d1d'], showRider: true, riderPose: 'bicycle', camDist: 5, camHeight: 1.6, slopeK: 1.8, horn: 'bicycleBell', engine: 'pedal', drag: 0.05,
    paint: () => [P(cyl(0.022, 0.022, 0.85, 6), '#fff', 0, 0.62, 0.05, Math.PI / 2 - 0.25), P(cyl(0.022, 0.022, 0.6, 6), '#fff', 0, 0.55, -0.28, -0.55), P(cyl(0.022, 0.022, 0.55, 6), '#fff', 0, 0.62, 0.42, 0.25)],
    trim: () => [bikeWheel(0, 0.35, 0.55, 0.35), bikeWheel(0, 0.35, -0.55, 0.35), P(box(0.16, 0.05, 0.24), '#4a3424', 0, 0.92, -0.25), P(cyl(0.018, 0.018, 0.5, 6), '#aaa', 0, 1.02, 0.45, 0, 0, Math.PI / 2)],
  });
  D('sergeantBike', Object.assign({}, V.defs.bicycle, { id: 'sergeantBike', name: 'Police bicycle', maxSpeed: 8.0, horn: 'whistle' }));
  D('cart', {
    name: "Baker's cart", len: 5.6, wid: 1.6, radius: 2.4, maxSpeed: 6.5, accel: 2.6, brake: 4, steer: 0.5, wheelBase: 3.2, colors: ['#7a3b2a', '#2e4a35', '#2c3a5a'], showRider: true, riderPose: 'driver', horse: true, horseOff: 2.3, camDist: 8, camHeight: 2.2, horn: 'horseWhinny', engine: 'hooves',
    paint: () => [P(box(1.5, 1.2, 2.2), '#fff', 0, 1.35, -1.2), P(box(1.55, 0.12, 2.3), '#fff', 0, 2.0, -1.2)],
    trim: () => [P(box(1.5, 0.08, 1.0), '#5a4030', 0, 0.85, 0.3), P(box(0.5, 0.25, 0.4), '#4a3424', 0, 1.1, 0.25), P(cyl(0.55, 0.55, 0.08, 14), '#3a2a1a', 0.8, 0.55, -1.0, 0, 0, Math.PI / 2), P(cyl(0.55, 0.55, 0.08, 14), '#3a2a1a', -0.8, 0.55, -1.0, 0, 0, Math.PI / 2), P(box(0.05, 0.05, 2.0), '#5a4030', 0.45, 0.95, 1.4), P(box(0.05, 0.05, 2.0), '#5a4030', -0.45, 0.95, 1.4)],
  });
  D('hansom', {
    name: 'Hansom cab', len: 5.4, wid: 1.6, radius: 2.4, maxSpeed: 7.5, accel: 1.9, brake: 4, steer: 0.5, wheelBase: 3.0, colors: ['#151515', '#2a1e14'], showRider: true, riderPose: 'driver', horse: true, horseOff: 2.2, camDist: 8, camHeight: 2.4, horn: 'horseWhinny', engine: 'hooves',
    paint: () => [P(box(1.4, 1.5, 1.4), '#fff', 0, 1.55, -0.9), P(box(1.45, 0.1, 1.6), '#fff', 0, 2.33, -1.0)],
    trim: () => [P(box(1.0, 0.7, 0.06), '#26333a', 0, 1.75, -0.2), P(box(0.5, 0.08, 0.5), '#2a1e14', 0, 2.5, -1.8), P(cyl(0.72, 0.72, 0.08, 16), '#2a1e14', 0.78, 0.72, -0.9, 0, 0, Math.PI / 2), P(cyl(0.72, 0.72, 0.08, 16), '#2a1e14', -0.78, 0.72, -0.9, 0, 0, Math.PI / 2), P(box(0.05, 0.05, 2.1), '#3a2a1a', 0.45, 1.0, 1.0), P(box(0.05, 0.05, 2.1), '#3a2a1a', -0.45, 1.0, 1.0)],
  });
  D('dray', {
    name: "Brewer's dray", len: 6.4, wid: 1.9, radius: 2.8, maxSpeed: 5, accel: 1.1, brake: 3, steer: 0.45, wheelBase: 3.8, colors: ['#5a3a20'], showRider: true, riderPose: 'driver', horse: true, horseOff: 2.8, camDist: 9, camHeight: 2.4, horn: 'horseWhinny', engine: 'hooves',
    paint: () => [P(box(1.9, 0.14, 3.6), '#fff', 0, 1.0, -1.3), P(box(1.9, 0.5, 0.08), '#fff', 0, 1.3, 0.48), P(box(1.9, 0.5, 0.08), '#fff', 0, 1.3, -3.1)],
    trim: () => [P(cyl(0.38, 0.38, 0.85, 10), '#7a5030', 0.45, 1.45, -0.6, 0, 0, Math.PI / 2), P(cyl(0.38, 0.38, 0.85, 10), '#7a5030', -0.45, 1.45, -1.4, 0, 0, Math.PI / 2), P(cyl(0.38, 0.38, 0.85, 10), '#7a5030', 0.45, 1.45, -2.2, 0, 0, Math.PI / 2), P(cyl(0.6, 0.6, 0.1, 12), '#3a2a1a', 1.0, 0.6, 0.1, 0, 0, Math.PI / 2), P(cyl(0.6, 0.6, 0.1, 12), '#3a2a1a', -1.0, 0.6, 0.1, 0, 0, Math.PI / 2), P(cyl(0.6, 0.6, 0.1, 12), '#3a2a1a', 1.0, 0.6, -2.6, 0, 0, Math.PI / 2), P(cyl(0.6, 0.6, 0.1, 12), '#3a2a1a', -1.0, 0.6, -2.6, 0, 0, Math.PI / 2), P(box(0.05, 0.05, 2.2), '#3a2a1a', 0.45, 1.0, 1.6), P(box(0.05, 0.05, 2.2), '#3a2a1a', -0.45, 1.0, 1.6)],
  });

  // ------------------------------------------------------------------ rendering
  const MAXI = 18;
  V.init = function (scene) {
    V.scene = scene;
    // glossy enamel on motor vehicles, satin varnish on carts and bicycles
    const paints = {};
    const paintMat = (r) => paints[r] || (paints[r] = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: r, metalness: 0 }));
    // trim carries its own surface per vertex: roughness, metalness and a lamp glow
    const matTrim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
    matTrim.onBeforeCompile = function (sh) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aSurf; varying vec3 vSurf;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vSurf = aSurf;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSurf;')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurf.x;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurf.y;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vSurf.z;');
    };
    matTrim.customProgramCacheKey = () => 'vehicle-trim';
    const VMs = SA.VehicleModels;
    for (const id in V.defs) {
      const d = V.defs[id];
      const model = VMs && VMs.models[id] ? VMs.models[id]() : null;
      const pg = model ? VMs.merge(model.paint) : PP().merge(d.paint()), tg = model ? VMs.merge(model.trim) : PP().merge(d.trim());
      const mp = new THREE.InstancedMesh(pg, paintMat(d.horse || d.engine === 'pedal' ? 0.55 : 0.24), MAXI);
      const mt = new THREE.InstancedMesh(tg, matTrim, MAXI);
      for (const m of [mp, mt]) {
        m.count = 0;
        m.frustumCulled = false;
        m.castShadow = true;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(m);
      }
      mp.setColorAt(0, new THREE.Color(1, 1, 1));
      mp.name = 'veh-' + id + '-paint';
      mt.name = 'veh-' + id + '-trim';
      V.meshes[id] = { paint: mp, trim: mt };
    }
    // horses: instanced parts
    const hm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0 });
    const mk = (geo, n) => {
      const m = new THREE.InstancedMesh(geo, hm, n);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      scene.add(m);
      return m;
    };
    // horse: shaped barrel, arched neck, tapered head with ears, mane, collar, two-part legs and
    // hooves; every part is an instance placed from the horse's own gait each frame
    const sphere = (sx, sy, sz, x, y, z) => new THREE.SphereGeometry(1, 14, 10).scale(sx, sy, sz).translate(x, y, z);
    const strip = (g) => {
      g = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      return g;
    };
    const mergeH = (list) => THREE.BufferGeometryUtils.mergeGeometries(list.map(strip));
    V.horses = {
      // the barrel: one smooth lathe from chest to rump, deeper than it is wide
      body: mk(new THREE.LatheGeometry([[0.0, -0.98], [0.2, -0.92], [0.3, -0.75], [0.34, -0.45], [0.35, -0.1], [0.34, 0.2], [0.33, 0.45], [0.3, 0.7], [0.22, 0.88], [0.0, 0.97]].map((q) => new THREE.Vector2(q[0], q[1])), 16).rotateX(Math.PI / 2).scale(0.92, 1.18, 1), 12),
      neck: mk(new THREE.CylinderGeometry(0.11, 0.24, 0.95, 12).translate(0, 0.47, 0), 12),
      // head: poll, broad cheeks, a long nose and a soft muzzle, narrower than it is deep; ears
      head: mk(mergeH([new THREE.LatheGeometry([[0, 0.06], [0.1, 0.03], [0.13, -0.08], [0.125, -0.2], [0.09, -0.36], [0.085, -0.5], [0.095, -0.58], [0.06, -0.64], [0, -0.65]].map((q) => new THREE.Vector2(q[0], q[1])), 12).scale(0.72, 1, 1), new THREE.ConeGeometry(0.035, 0.13, 6).translate(0.055, 0.1, -0.02), new THREE.ConeGeometry(0.035, 0.13, 6).translate(-0.055, 0.1, -0.02)]), 12),
      joint: mk(new THREE.SphereGeometry(0.055, 8, 6), 48),
      mane: mk(new THREE.BoxGeometry(0.05, 0.85, 0.09).translate(0, 0.45, -0.1), 12),
      collar: mk(new THREE.TorusGeometry(0.24, 0.06, 6, 14).rotateX(Math.PI / 2), 12),
      upper: mk(new THREE.CylinderGeometry(0.085, 0.06, 0.48, 8).translate(0, -0.24, 0), 48),
      lower: mk(new THREE.CylinderGeometry(0.042, 0.04, 0.42, 7).translate(0, -0.21, 0), 48),
      hoof: mk(new THREE.CylinderGeometry(0.05, 0.065, 0.07, 8).translate(0, -0.035, 0), 48),
      tail: mk(new THREE.CylinderGeometry(0.06, 0.1, 0.7, 7).translate(0, -0.35, 0), 12),
    };
    // police lights (flashing) as small emissive boxes
    const lm = new THREE.MeshBasicMaterial({ color: 0x3a7bff });
    V.lights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.12, 0.22), lm, 12);
    V.lights.count = 0;
    V.lights.frustumCulled = false;
    V.lights.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(V.lights);
  };

  // ------------------------------------------------------------------ vehicle objects
  V.create = function (defId, x, z, yaw, opts) {
    const d = V.defs[defId];
    if (!d) return null;
    opts = opts || {};
    const v = {
      def: d, x, z, yaw: yaw || 0, y: SA.Terrain.height(x, z), speed: 0, steer: 0, pitch: 0, roll: 0, era: opts.era || SA.Game.era,
      color: opts.color || d.colors[Math.floor(Math.random() * d.colors.length)], driver: opts.driver || null, ai: opts.ai || null,
      owner: opts.owner || null, mission: opts.mission || null, siren: false, damage: 0, phase: Math.random() * 10, horseColor: opts.horseColor || ['#5a3a22', '#2a1e16', '#8a8580', '#6b4a2a'][Math.floor(Math.random() * 4)],
      throttle: 0, steerIn: 0, handbrake: false, visible: true, id: Math.random().toString(36).slice(2, 8), parked: !!opts.parked, label: opts.label || d.name,
    };
    V.list.push(v);
    return v;
  };
  V.remove = function (v) {
    const i = V.list.indexOf(v);
    if (i >= 0) V.list.splice(i, 1);
    if (SA.Player.vehicle === v) V.exit(true);
  };
  V.clearEra = function (keep) {
    V.list = V.list.filter((v) => keep && keep(v));
  };

  // Parked vehicles per era (player-usable), plus mission vehicles
  V.spawnParked = function (eraId) {
    V.list = V.list.filter((v) => v === SA.Player.vehicle || (v.ai && v.era === eraId));
    const spots = {
      2026: [['hatch', 46, -10, 0.6], ['estate', 170, -205, 2.7], ['hatch', -118, -22, 1.75], ['suv', -230, -10, 2.2], ['hatch', 112, -118, 2.7], ['van', 70, -60, 2.0]],
      1964: [['saloon60', 46, -10, 0.6], ['small60', 170, -205, 2.7], ['saloon60', -118, -22, 1.75], ['van60', 74, -64, 2.0], ['saloon60', -10, -60, 0.4], ['small60', 0, -80, 1.2], ['saloon60', 15, -95, 2.3]],
      1897: [['bicycle', 120, -132, 0.4], ['cart', -150, -26, 1.75], ['hansom', 150, -186, 2.7], ['bicycle', -40, -12, 1.2]],
    };
    for (const s of spots[eraId] || []) {
      const safe = SA.World.findSafe(eraId, s[1], s[2], { r: 1.2 });
      V.create(s[0], safe.x, safe.z, s[3], { era: eraId, parked: true });
    }
    SA.emit('parked-spawned', eraId);
  };

  V.nearest = function (x, z, r) {
    let best = null, bd = r;
    for (const v of V.list) {
      if (!v.visible || v.era !== SA.Game.era) continue;
      const d = U.dist(x, z, v.x, v.z) - v.def.radius * 0.6;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  };

  V.enter = function (v) {
    const P = SA.Player;
    if (!v || P.vehicle) return false;
    if (v.locked) {
      SA.HUD && SA.HUD.toast(v.lockedMsg || 'Locked.');
      return false;
    }
    if (v.driver && v.driver !== 'player') {
      // pulling someone out: comic, and a crime
      SA.emit('carjack', v);
      SA.emit('crime', 'carjack', v.x, v.z);
      if (SA.NPCs && v.ai) {
        const node = SA.World.current.ped.nearest(v.x, v.z, 20);
        if (node) {
          const npc = SA.NPCs.spawn(SA.Game.era, node, U.rng((Math.random() * 1e9) | 0));
          npc.ch.x = v.x + Math.cos(v.yaw) * 1.6;
          npc.ch.z = v.z - Math.sin(v.yaw) * 1.6;
          SA.NPCs.knock(npc, Math.cos(v.yaw), -Math.sin(v.yaw), 2);
          setTimeout(() => SA.NPCs.bark(npc, 'carjacked'), 1500);
        }
      }
    }
    v.ai = null;
    v.driver = 'player';
    v.parked = false;
    P.vehicle = v;
    P.ch.seated = true;
    P.ch.ride = v.def.riderPose === 'bicycle' ? 'bicycle' : null;
    SA.Audio && SA.Audio.sfx('door', v.x, v.z);
    SA.emit('vehicle-enter', v);
    return true;
  };
  V.exit = function (force) {
    const P = SA.Player;
    const v = P.vehicle;
    if (!v) return false;
    if (!force && Math.abs(v.speed) > 3.5) {
      SA.HUD && SA.HUD.toast('Slow down to get off.');
      return false;
    }
    // place the player beside the vehicle (left side first, UK kerb side)
    const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
    const side = v.def.wid / 2 + 0.7;
    const cand = [[-c * side, s * side], [c * side, -s * side], [Math.sin(v.yaw) * -(v.def.len / 2 + 0.8), Math.cos(v.yaw) * -(v.def.len / 2 + 0.8)]];
    let px = v.x, pz = v.z;
    const col = SA.World.current.col;
    let ok = false;
    for (const [dx, dz] of cand) {
      if (col.isFree(v.x + dx, v.z + dz, 0.35, 'walk')) {
        px = v.x + dx;
        pz = v.z + dz;
        ok = true;
        break;
      }
    }
    if (!ok) {
      const f = SA.World.findSafe(SA.Game.era, v.x, v.z, { r: 0.4 });
      px = f.x;
      pz = f.z;
    }
    P.vehicle = null;
    v.driver = null;
    v.speed = force ? v.speed : 0;
    v.throttle = 0;
    v.parked = true;
    P.ch.seated = false;
    P.ch.ride = null;
    P.teleport(px, pz, v.yaw);
    SA.emit('vehicle-exit', v);
    return true;
  };

  // ------------------------------------------------------------------ physics
  const tmpN = new THREE.Vector3();
  V.physics = function (v, dt) {
    const d = v.def;
    const t = v.throttle, st = v.steerIn;
    // engine & brakes
    let a = 0;
    if (t > 0.05) a = v.speed < -0.4 ? d.brake * t : d.accel * t * (1 - Math.max(0, v.speed) / (d.maxSpeed * 1.05));
    else if (t < -0.05) a = v.speed > 0.4 ? -d.brake * -t : -d.accel * 0.6 * -t * (1 - Math.max(0, -v.speed) / d.reverse);
    // slope (gravity along heading)
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const half = d.len * 0.4;
    const hf = SA.Terrain.height(v.x + fx * half, v.z + fz * half), hb = SA.Terrain.height(v.x - fx * half, v.z - fz * half);
    const grade = (hf - hb) / (half * 2);
    a -= 9.81 * grade * (d.slopeK || 1) * 0.55;
    // rolling resistance + drag
    a -= v.speed * (d.drag || 0.08) + Math.sign(v.speed) * 0.25;
    if (v.handbrake) a -= Math.sign(v.speed) * d.brake * 0.6;
    v.speed += a * dt;
    if (Math.abs(v.speed) < 0.05 && Math.abs(t) < 0.05) v.speed = 0;
    v.speed = U.clamp(v.speed, -d.reverse, d.maxSpeed * 1.25);
    // steering (bicycle model)
    v.steer = U.damp(v.steer, st * d.steer * (1 - Math.min(0.55, Math.abs(v.speed) / (d.maxSpeed * 2.2))), 8, dt);
    const yawRate = (v.speed / d.wheelBase) * Math.tan(v.steer) * (v.handbrake ? 1.35 : 1);
    v.yaw += yawRate * dt;
    let nx = v.x + fx * v.speed * dt, nz = v.z + fz * v.speed * dt;
    // static collision via three circles along the body
    const col = SA.World.current.col;
    const r = Math.min(d.wid * 0.55, 1.1);
    const offs = d.len > 2.5 ? [d.len / 2 - r, 0, -(d.len / 2 - r)] : [0];
    let cx = 0, cz = 0, hit = false, hnx = 0, hnz = 0;
    for (const o of offs) {
      const px = nx + fx * o, pz = nz + fz * o;
      const res = col.resolve(px, pz, r, 'veh', v.y);
      if (res.hit) {
        hit = true;
        hnx += res.nx;
        hnz += res.nz;
        cx += res.x - px;
        cz += res.z - pz;
      }
    }
    if (hit) {
      nx += cx / offs.length * 1.2;
      nz += cz / offs.length * 1.2;
      const hl = Math.hypot(hnx, hnz) || 1;
      const into = -(fx * hnx + fz * hnz) / hl; // >0 when driving into the wall
      if (into > 0.5 && Math.abs(v.speed) > 3) {
        const impact = Math.abs(v.speed);
        v.speed *= -0.25;
        v.damage += impact;
        if (v.driver === 'player') {
          SA.Game.cam.shake = Math.min(0.6, impact * 0.04);
          SA.Audio && SA.Audio.sfx('crash', v.x, v.z, Math.min(1, impact / 15));
        }
        SA.emit('vehicle-crash', v, impact);
      } else v.speed *= 1 - 0.6 * dt * 4;
    }
    // stay in the district
    if (!SA.World.inDistrict(nx, nz)) {
      nx = v.x;
      nz = v.z;
      v.speed *= -0.2;
      if (v.driver === 'player') SA.emit('boundary', nx, nz);
    }
    v.x = nx;
    v.z = nz;
    // ground follow: pitch from front/back, roll from sides
    const hc = SA.Terrain.height(v.x, v.z);
    v.y = U.damp(v.y, hc, 18, dt);
    v.pitch = U.damp(v.pitch, Math.atan2(hf - hb, half * 2), 8, dt);
    const sx = Math.cos(v.yaw), sz = -Math.sin(v.yaw);
    const hl = SA.Terrain.height(v.x - sx * d.wid * 0.5, v.z - sz * d.wid * 0.5), hr = SA.Terrain.height(v.x + sx * d.wid * 0.5, v.z + sz * d.wid * 0.5);
    const lean = d.showRider && d.riderPose !== 'driver' ? -U.clamp(yawRate * Math.abs(v.speed) * 0.05, -0.45, 0.45) : 0;
    v.roll = U.damp(v.roll, Math.atan2(hr - hl, d.wid) + lean, 8, dt);
    v.phase += Math.abs(v.speed) * dt;
    void tmpN;
  };

  // vehicle-vehicle separation
  function separate() {
    const L = V.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (a.era !== SA.Game.era || !a.visible) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (b.era !== SA.Game.era || !b.visible) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const md = (a.def.radius + b.def.radius) * 0.62;
        const d2 = dx * dx + dz * dz;
        if (d2 < md * md && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (md - d) * 0.5;
          const nx = dx / d, nz = dz / d;
          const wa = a.parked ? 0.25 : 1, wb = b.parked ? 0.25 : 1;
          a.x -= nx * push * wa;
          a.z -= nz * push * wa;
          b.x += nx * push * wb;
          b.z += nz * push * wb;
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 3) {
            SA.emit('vehicle-bump', a, b, rel);
            if (a.driver === 'player' || b.driver === 'player') {
              SA.Audio && SA.Audio.sfx('crash', a.x, a.z, Math.min(1, rel / 12));
              SA.emit('crime', 'collision', a.x, a.z);
            }
          }
          const avg = (a.speed + b.speed) / 2;
          a.speed = U.lerp(a.speed, avg, 0.5) * 0.85;
          b.speed = U.lerp(b.speed, avg, 0.5) * 0.85;
        }
      }
    }
  }

  // ------------------------------------------------------------------ update
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), POS = new THREE.Vector3(), SC = new THREE.Vector3(1, 1, 1), C = new THREE.Color();
  V.update = function (dt) {
    const P = SA.Player;
    const I = SA.Input;
    const pv = P.vehicle;
    // player driving input
    if (pv) {
      const locked = SA.Game.inputLocked;
      pv.throttle = locked ? 0 : I.move.y;
      pv.steerIn = locked ? 0 : -I.move.x;
      pv.handbrake = I.held('brake');
      if (I.pressed('horn')) {
        SA.Audio && SA.Audio.sfx(pv.def.horn, pv.x, pv.z);
        SA.emit('horn', pv);
      }
    }
    for (const v of V.list) {
      if (v.era !== SA.Game.era) continue;
      if (v.ai && v.ai.update) v.ai.update(v, dt);
      if (v.driver || v.ai || Math.abs(v.speed) > 0.01) V.physics(v, dt);
    }
    separate();
    // enter/exit
    if (!SA.Game.inputLocked && I.pressed('vehicle')) {
      if (pv) V.exit();
      else {
        const v = V.nearest(P.ch.x, P.ch.z, 2.2);
        if (v && !v.noEnter) V.enter(v);
      }
    }
    // rider pose for the player
    if (pv) {
      const ch = P.ch;
      const d = pv.def;
      ch.x = pv.x;
      ch.z = pv.z;
      ch.yaw = pv.yaw;
      ch.y = pv.y + (d.riderPose === 'bicycle' ? 0.42 : d.riderPose === 'scooter' ? 0.12 : d.riderPose === 'driver' ? 0.55 : 0);
      ch.groundY = pv.y;
      ch.seated = d.riderPose !== 'bicycle';
      ch.ride = d.riderPose === 'bicycle' ? 'bicycle' : null;
      ch.phase += Math.abs(pv.speed) * dt * 2.2;
      ch.anim = 'idle';
      if (d.riderPose === 'driver') {
        // sit on the box seat behind the horse
        const off = 0.2;
        ch.x = pv.x + Math.sin(pv.yaw) * off;
        ch.z = pv.z + Math.cos(pv.yaw) * off;
      }
      if (d.riderPose === 'car') ch.visible = false;
    }
    V.render();
  };

  V.render = function () {
    for (const id in V.meshes) {
      V.meshes[id].paint.count = 0;
      V.meshes[id].trim.count = 0;
    }
    const H = V.horses;
    for (const k in H) H[k].count = 0;
    V.lights.count = 0;
    const t = SA.Game.time;
    for (const v of V.list) {
      if ((v.era !== SA.Game.era && !v.leaving) || !v.visible) continue;
      const m = V.meshes[v.def.id];
      if (!m || m.paint.count >= MAXI) continue;
      E.set(-v.pitch, v.yaw, v.roll, 'YXZ');
      Q.setFromEuler(E);
      POS.set(v.x, v.y, v.z);
      M.compose(POS, Q, SC);
      const i = m.paint.count;
      m.paint.setMatrixAt(i, M);
      m.paint.setColorAt(i, C.set(v.color));
      m.trim.setMatrixAt(i, M);
      m.paint.count = i + 1;
      m.trim.count = i + 1;
      if (v.def.horse) drawHorse(v, M);
      if (v.siren && (v.def.id === 'police2026')) {
        const li = V.lights.count;
        if (li < 12) {
          const on = Math.floor(t * 6) % 2 === 0;
          const LM = new THREE.Matrix4().makeTranslation(on ? 0.3 : -0.3, 1.72, -0.2);
          V.lights.setMatrixAt(li, M.clone().multiply(LM));
          V.lights.setColorAt(li, C.set(on ? '#3a7bff' : '#ff3a3a'));
          V.lights.count = li + 1;
        }
      }
    }
    for (const id in V.meshes) {
      const m = V.meshes[id];
      m.paint.visible = m.trim.visible = m.paint.count > 0;
      if (!m.paint.visible) continue;
      m.paint.instanceMatrix.needsUpdate = true;
      if (m.paint.instanceColor) m.paint.instanceColor.needsUpdate = true;
      m.trim.instanceMatrix.needsUpdate = true;
    }
    for (const k in H) {
      H[k].visible = H[k].count > 0;
      H[k].instanceMatrix.needsUpdate = true;
      if (H[k].instanceColor) H[k].instanceColor.needsUpdate = true;
    }
    V.lights.visible = V.lights.count > 0;
    V.lights.instanceMatrix.needsUpdate = true;
    if (V.lights.instanceColor) V.lights.instanceColor.needsUpdate = true;
  };
  const HM = new THREE.Matrix4(), HL = new THREE.Matrix4(), HQ = new THREE.Quaternion(), HE = new THREE.Euler(), HP = new THREE.Vector3(), HS = new THREE.Vector3(1, 1, 1);
  function hput(mesh, base, x, y, z, rx, color) {
    const i = mesh.count;
    if (i >= mesh.instanceMatrix.count) return;
    HE.set(rx || 0, 0, 0);
    HQ.setFromEuler(HE);
    HL.compose(HP.set(x, y, z), HQ, HS);
    HM.multiplyMatrices(base, HL);
    mesh.setMatrixAt(i, HM);
    mesh.setColorAt(i, C.set(color));
    mesh.count = i + 1;
  }
  function drawHorse(v, base) {
    const H = V.horses;
    const o = v.def.horseOff || 2.3;
    const sp = Math.abs(v.speed);
    const ph = v.phase * 2.4;
    const amp = Math.min(0.5, sp * 0.11);
    const col = v.horseColor;
    const dark = '#1e1610';
    const bob = Math.abs(Math.sin(ph)) * amp * 0.08;
    const nod = Math.sin(ph * 2) * amp * 0.12;
    hput(H.body, base, 0, 1.28 + bob, o, 0, col);
    // the neck leans forward from the withers; the head hangs from the poll, nose forward and down
    const na = 0.8 + nod * 0.5;
    hput(H.neck, base, 0, 1.42 + bob, o + 0.6, na, col);
    hput(H.mane, base, 0, 1.42 + bob, o + 0.6, na, dark);
    hput(H.collar, base, 0, 1.42 + 0.22 * Math.cos(na) + bob, o + 0.6 + 0.22 * Math.sin(na), na, '#3a2618');
    hput(H.head, base, 0, 1.42 + 0.92 * Math.cos(na) + bob, o + 0.6 + 0.92 * Math.sin(na), -1.05 + nod, col);
    hput(H.tail, base, 0, 1.52 + bob, o - 1.0, 0.35 + Math.sin(ph * 0.5) * 0.12, dark);
    // legs: the upper bone swings from the shoulder or hip; the lower one folds back at the knee
    // in front and forward at the hock behind as the leg comes through
    const legs = [[0.18, o + 0.55, 0, 1], [-0.18, o + 0.55, Math.PI, 1], [0.18, o - 0.58, Math.PI, -1], [-0.18, o - 0.58, 0, -1]];
    for (const [lx, lz, pp, front] of legs) {
      const p = ph + pp;
      const up = Math.sin(p) * amp * (front > 0 ? 1 : 0.85) + (front > 0 ? 0 : 0.08);
      const fold = Math.max(0, Math.cos(p)) * amp * (front > 0 ? 1.6 : -1.1);
      const top = 0.99 + bob;
      hput(H.upper, base, lx, top, lz, up, col);
      const kx = lz - Math.sin(up) * 0.48, ky = top - Math.cos(up) * 0.48;
      hput(H.joint, base, lx, ky, kx, 0, col);
      hput(H.lower, base, lx, ky, kx, up + fold, col);
      const a = up + fold;
      hput(H.hoof, base, lx, ky - Math.cos(a) * 0.42, kx - Math.sin(a) * 0.42, a, dark);
    }
  }
})();
