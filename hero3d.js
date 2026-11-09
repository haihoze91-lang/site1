// =====================================================================
//  Visite virtuelle 3D — Tel Aviv → tour → penthouse → salon → chambre
//  Three.js, caméra pilotée par le scroll (window.HERO3D.render(p))
// =====================================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.querySelector('#hero .stage');
const canvas = document.createElement('canvas');
canvas.id = 'three';
canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
stage.insertBefore(canvas, stage.querySelector('.scrim'));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) { canvas.remove(); throw e; }
const mobile = matchMedia('(max-width: 900px)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const FOG = new THREE.Color('#c99a8e');
scene.fog = new THREE.Fog(FOG, 300, 1700);
const camera = new THREE.PerspectiveCamera(55, 1, 0.08, 4000);
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .22; }

// ------------------------------------------------------------- lumière
const SUN = new THREE.Vector3(-1, 0.11, -0.32).normalize();
const sun = new THREE.DirectionalLight('#ffb27a', 3.2);
sun.position.copy(SUN).multiplyScalar(600);
scene.add(sun);
const hemi = new THREE.HemisphereLight('#a9a7d6', '#7a5a4a', 1.1);
scene.add(hemi);

// ---------------------------------------------------------------- ciel
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(3000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uSun: { value: SUN }, uDusk: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 uSun; uniform float uDusk;
      void main(){
        float h=clamp(vDir.y,-0.1,1.);
        vec3 top=mix(vec3(.30,.36,.62),vec3(.12,.15,.36),uDusk);
        vec3 mid=mix(vec3(.80,.55,.62),vec3(.55,.38,.55),uDusk);
        vec3 hor=mix(vec3(1.,.66,.42),vec3(.98,.50,.36),uDusk);
        vec3 c=mix(hor,mid,smoothstep(0.,.18,h)); c=mix(c,top,smoothstep(.15,.7,h));
        float s=max(dot(normalize(vDir),uSun),0.);
        c+=vec3(1.,.55,.25)*pow(s,8.)*.45 + vec3(1.,.85,.6)*pow(s,900.)*2.5;
        // nuages
        float cl=sin(vDir.x*9.+vDir.z*4.)*sin(vDir.z*13.-vDir.x*3.)*.5+.5;
        cl*=smoothstep(.03,.12,h)*smoothstep(.35,.12,h);
        c=mix(c,vec3(1.,.62,.55)*(.8+.4*pow(s,3.)),cl*.35);
        gl_FragColor=vec4(c,1.);
      }`
  })
);
scene.add(sky);

// ----------------------------------------------------------------- mer
const seaMat = new THREE.ShaderMaterial({
  fog: false, toneMapped: false,
  uniforms: { uSun: { value: SUN }, uTime: { value: 0 }, uCam: { value: camera.position } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `varying vec3 vW; uniform vec3 uSun; uniform float uTime; uniform vec3 uCam;
    void main(){
      vec2 p=vW.xz*.05;
      vec3 n=normalize(vec3(sin(p.x*3.1+uTime)*.06+sin(p.y*5.3-uTime*1.3)*.04+sin((p.x+p.y)*11.+uTime*2.)*.02,1.,
                           cos(p.y*2.7+uTime*.8)*.06+cos((p.x-p.y)*7.-uTime)*.03));
      vec3 v=normalize(uCam-vW); vec3 r=reflect(-v,n);
      float fr=pow(1.-max(dot(v,vec3(0,1,0)),0.),4.);
      vec3 deep=vec3(.07,.20,.33), skyc=vec3(.92,.58,.55);
      vec3 c=mix(deep,skyc,fr*.85);
      float s=max(dot(r,uSun),0.); c+=vec3(1.,.62,.32)*pow(s,60.)*1.6+vec3(1.,.8,.5)*pow(s,600.)*4.;
      float d=length(vW.xz-uCam.xz); c=mix(c,vec3(.85,.56,.52),smoothstep(500.,2400.,d));
      gl_FragColor=vec4(c,1.);
    }`
});
const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), seaMat);
sea.rotation.x = -Math.PI / 2; sea.position.set(-3100, 0, 0);
scene.add(sea);

// --------------------------------------------------------- sol / plage
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, metalness: 0, ...o });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 3000), std('#b8a898'));
ground.rotation.x = -Math.PI / 2; ground.position.set(740, 0, 0); scene.add(ground);
const beach = new THREE.Mesh(new THREE.PlaneGeometry(60, 3000), std('#e6caa0'));
beach.rotation.x = -Math.PI / 2; beach.position.set(-130, 0.05, 0); scene.add(beach);
const prom = new THREE.Mesh(new THREE.PlaneGeometry(10, 3000), std('#d9cfc4'));
prom.rotation.x = -Math.PI / 2; prom.position.set(-95, 0.08, 0); scene.add(prom);

// ---------------------------------------------- ville (shader instancié)
const cityMat = new THREE.ShaderMaterial({
  uniforms: { uSun: { value: SUN }, uLit: { value: .3 }, uDay: { value: 1 }, uFog: { value: FOG }, uCam: { value: camera.position } },
  vertexShader: `varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vSeed;
    void main(){
      mat4 m=modelMatrix*instanceMatrix; vec4 w=m*vec4(position,1.); vW=w.xyz;
      vN=normalize(mat3(m)*normal); vC=instanceColor; vSeed=instanceMatrix[3].x*.13+instanceMatrix[3].z*.71;
      gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vSeed;
    uniform vec3 uSun; uniform float uLit; uniform float uDay; uniform vec3 uFog; uniform vec3 uCam;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    void main(){
      vec3 n=normalize(vN);
      float glass=step(vC.b,vC.r*.98+.0)*0.+ step(.08,vC.b-vC.r);
      float dif=max(dot(n,uSun),0.);
      float dist=length(vW-uCam);
      vec3 col=vC*((.26+.12*n.y)*mix(.3,1.,uDay)*vec3(.85,.82,1.)+dif*1.05*uDay*uDay*vec3(1.,.70,.48));
      vec3 base0=col;
      if(abs(n.y)<.5){
        float u=abs(n.x)>.5?vW.z:vW.x;
        vec2 cell=floor(vec2(u/(glass>.5?2.2:3.2),vW.y/3.3));
        vec2 f=fract(vec2(u/(glass>.5?2.2:3.2),vW.y/3.3));
        float win=step(.18,f.x)*step(f.x,.82)*step(.22,f.y)*step(f.y,.78);
        if(glass>.5) win=step(.06,f.y)*step(f.x,.94);
        float lit=step(hash(cell+vSeed),uLit)*win*step(1.5,vW.y);
        col=mix(col,col*.45+vec3(.05,.07,.12),win*(glass>.5?.55:.35));
        col+=vec3(1.,.55,.22)*lit*.75;
        float far=smoothstep(180.,520.,dist);
        col=mix(col,base0*.8+vec3(1.,.62,.28)*uLit*.22*step(1.5,vW.y),far);
        if(glass>.5){ vec3 v=normalize(uCam-vW); vec3 r=reflect(-v,n); col+=vec3(1.,.6,.4)*pow(max(dot(r,uSun),0.),20.)*.9; }
      }
      col=mix(col,uFog,smoothstep(300.,1700.,dist)*.85);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
{
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const list = [];
  for (let x = -82; x < 900; x += 24) for (let z = -1300; z < 1300; z += 24) {
    const d = Math.hypot(x, z);
    if (d < 34) continue;
    const jx = (rnd() - .5) * 3, jz = (rnd() - .5) * 3;
    const east = Math.min(1, Math.max(0, (x - 140) / 400));
    const cluster = Math.exp(-((z - 180) ** 2) / 90000) * .6 + Math.exp(-((z + 420) ** 2) / 60000) * .35;
    let tower = rnd() < (.025 + .25 * east * cluster + .05 * east);
    if (d < 140) tower = false;
    const w = tower ? 18 + rnd() * 8 : 13 + rnd() * 6, dpt = tower ? 18 + rnd() * 8 : 13 + rnd() * 6;
    let h = tower ? 60 + rnd() * 130 : 9 + rnd() * 14 + (rnd() < .15 ? 10 : 0);
    if (d < 120 && !tower) h = Math.min(h, 22);
    const c = tower ? new THREE.Color().setHSL(.58 + rnd() * .05, .18 + rnd() * .15, .38 + rnd() * .14)
                    : new THREE.Color().setHSL(.08 + rnd() * .04, .10 + rnd() * .14, .66 + rnd() * .12);
    list.push([x + jx, z + jz, w, dpt, h, c]);
  }
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityMat, list.length);
  const m = new THREE.Matrix4();
  list.forEach(([x, z, w, d, h, c], i) => { m.makeScale(w, h, d); m.setPosition(x, h / 2, z); city.setMatrixAt(i, m); city.setColorAt(i, c); });
  city.frustumCulled = false; scene.add(city);

  // palmiers sur la promenade + arbres des boulevards
  const pal = [], trees = [];
  for (let z = -1300; z < 1300; z += 13) pal.push([-100 + (rnd() - .5) * 4, z + (rnd() - .5) * 4]);
  for (let x = -60; x < 700; x += 9) for (const z of [12, -12, 156, -132]) if (rnd() < .85) trees.push([x + (rnd() - .5) * 2, z + (rnd() - .5) * 2]);
  for (let z = -1200; z < 1200; z += 9) for (const x of [-72, 12, 108]) if (Math.abs(z) > 14 && rnd() < .7) trees.push([x, z]);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.25, .4, 1, 5), std('#7a6450'), pal.length);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std('#4f6b3a'), pal.length + trees.length);
  pal.forEach(([x, z], i) => {
    const h = 9 + rnd() * 4; m.makeScale(1, h, 1); m.setPosition(x, h / 2, z); trunk.setMatrixAt(i, m);
    m.makeScale(3.2, 1.2, 3.2); m.setPosition(x, h, z); crown.setMatrixAt(i, m);
  });
  trees.forEach(([x, z], i) => { const s = 3 + rnd() * 1.8; m.makeScale(s, s * .85, s); m.setPosition(x, s * 1.1, z); crown.setMatrixAt(pal.length + i, m); });
  scene.add(trunk, crown);
}

// ------------------------------------------------------- la tour (héros)
const WHITE = std('#f3eee6', { roughness: .7 });
const CREAM = std('#efe6d8', { roughness: .8 });
const BRONZE = std('#3b3026', { roughness: .4, metalness: .6 });
const WOOD = std('#8a6142', { roughness: .6 });
const STONE = std('#e3d8c8', { roughness: .35 });
const FABRIC = std('#ece4d6', { roughness: .95 });
const GLASS = new THREE.MeshStandardMaterial({ color: '#9fb4c4', roughness: .05, metalness: .2, transparent: true, opacity: .07, depthWrite: false, envMapIntensity: .25 });
const glowMat = (c, i = 1) => new THREE.MeshStandardMaterial({ color: '#000', emissive: c, emissiveIntensity: i });

const tower = new THREE.Group(); scene.add(tower);
const FLOORS = 13, FH = 3.4, YR = FLOORS * FH + .2;           // niveau du toit-terrasse
const EYE = YR + 1.65;
const box = (w, h, d, mat, x, y, z, parent = tower) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); parent.add(o); return o; };
const rbox = (w, h, d, r, mat, x, y, z, parent = tower) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat); o.position.set(x, y, z); parent.add(o); return o; };

{ // dalles arrondies (balcons) + façade vitrée éclairée
  const shape = new THREE.Shape(); const W = 34, D = 23, R = 6, x0 = -15, z0 = -11.5;
  shape.moveTo(x0 + R, z0); shape.lineTo(x0 + W - R, z0); shape.quadraticCurveTo(x0 + W, z0, x0 + W, z0 + R);
  shape.lineTo(x0 + W, z0 + D - R); shape.quadraticCurveTo(x0 + W, z0 + D, x0 + W - R, z0 + D);
  shape.lineTo(x0 + R, z0 + D); shape.quadraticCurveTo(x0, z0 + D, x0, z0 + D - R);
  shape.lineTo(x0, z0 + R); shape.quadraticCurveTo(x0, z0, x0 + R, z0);
  const slabG = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false, curveSegments: 10 });
  slabG.rotateX(Math.PI / 2);
  const slabs = new THREE.InstancedMesh(slabG, WHITE, FLOORS);
  const m = new THREE.Matrix4();
  for (let i = 0; i < FLOORS; i++) { m.makeTranslation(0, (i + 1) * FH + .2, 0); slabs.setMatrixAt(i, m); }
  tower.add(slabs);
  // texture de façade : baies vitrées, rideaux, lumière chaude
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, '#ffd59a'); grd.addColorStop(1, '#f2a35a');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 32) { g.fillStyle = 'rgba(255,240,220,.55)'; g.fillRect(x + 4, 0, 8, 128); g.fillStyle = '#2a2018'; g.fillRect(x, 0, 3, 128); }
  g.fillStyle = 'rgba(60,40,25,.35)'; g.fillRect(0, 92, 256, 36);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, FLOORS);
  const coreMat = new THREE.MeshStandardMaterial({ color: '#2b2622', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: .85, roughness: .2 });
  box(30, FLOORS * FH, 19, coreMat, 2, FLOORS * FH / 2, 0);
  box(4, YR, 24, WHITE, 2, YR / 2, 0);                       // colonne centrale
  box(36, 2.5, 25, std('#e9e1d4'), 2, 1.25, 0);              // socle
}

// ------------------------------------------------ penthouse & terrasse
const ph = new THREE.Group(); ph.position.y = YR; tower.add(ph);
const P = (w, h, d, mat, x, y, z) => box(w, h, d, mat, x, y, z, ph);
const R = (w, h, d, r, mat, x, y, z) => rbox(w, h, d, r, mat, x, y, z, ph);
// sols
P(13, .1, 22, std('#d8ccbb', { roughness: .5 }), -8.5, .05, 0);
P(20, .1, 18, STONE, 8, .06, 0);
// piscine
P(8.4, .3, 6.4, std('#f1ebe2'), -9, .15, 5);
const water = P(8, .05, 6, new THREE.MeshStandardMaterial({ color: '#2fd0d8', emissive: '#1fb9c8', emissiveIntensity: .6, roughness: .05, metalness: .1 }), -9, .28, 5);
// garde-corps vitrés
P(.06, 1.1, 22, GLASS, -14.9, .6, 0); P(13, 1.1, .06, GLASS, -8.5, .6, 10.9); P(13, 1.1, .06, GLASS, -8.5, .6, -10.9);
P(.08, .06, 22, BRONZE, -14.9, 1.15, 0);
// salon extérieur
R(5, .8, 1.6, .3, FABRIC, -9, .45, -7.6); R(1.6, .8, 4, .3, FABRIC, -12.3, .45, -5.8);
R(2, .4, 1.2, .1, STONE, -9, .25, -5.2);
// oliviers en pots
const olive = (x, z, s = 1) => { R(1.1 * s, 1 * s, 1.1 * s, .3, std('#cfc3b3'), x, .5 * s, z);
  const f = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 * s, 1), std('#6f8550')); f.position.set(x, 2.4 * s, z); f.scale.set(1, .8, 1); ph.add(f);
  P(.12, 1.6 * s, .12, WOOD, x, 1.5 * s, z); };
olive(-14, -10, 1.1); olive(-14, 10, 1.1); olive(-3, -8, 1); olive(-3, 8.2, 1);
// pergola
for (const z of [-9.5, 9.5]) { P(.3, 4.8, .3, WHITE, -14.5, 2.4, z); P(13, .4, .3, WHITE, -8.3, 4.8, z); }
{ const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(.18, .32, 19.4), WOOD, 21); const m = new THREE.Matrix4();
  for (let i = 0; i < 21; i++) { m.makeTranslation(-14.4 + i * .6, 4.85, 0); sl.setMatrixAt(i, m); } ph.add(sl); }
// enveloppe du penthouse
const H = 5;
P(21, .5, 19, WHITE, 8, H + .25, 0);                         // toit
P(21, .05, 19, std('#f4eee5'), 8, H - .02, 0);               // plafond
// façade ouest vitrée, portes coulissantes ouvertes (z -3..3)
for (const [z0, z1] of [[-9, -3], [3, 9]]) {
  P(.06, H, z1 - z0, GLASS, -2, H / 2, (z0 + z1) / 2);
  for (let z = z0; z <= z1 + .01; z += 2) P(.12, H, .1, BRONZE, -2, H / 2, z);
}
P(.12, .14, 18, BRONZE, -2, H - .07, 0);
// façades nord / sud du séjour vitrées
for (const zs of [-9, 9]) { P(10, H, .06, GLASS, 3, H / 2, zs); for (let x = -2; x <= 8; x += 2) P(.1, H, .12, BRONZE, x, H / 2, zs); }
// mur du fond du séjour (x=8) avec ouverture vers le couloir
const wallMat = std('#e8dccb', { roughness: .9 });
P(.4, H, 7.6, wallMat, 8, H / 2, -5.2); P(.4, H, 7.6, wallMat, 8, H / 2, 5.2); P(.4, 1.6, 2.8, wallMat, 8, H - .8, 0);
// niches éclairées + tableaux
for (const z of [-3.2, 3.2]) { P(.1, 3.2, 1.6, std('#5e412d', { roughness: .5 }), 7.78, 2.0, z);
  for (const y of [1.1, 2.0, 2.9]) { P(.3, .05, 1.5, std('#d8c6ae'), 7.65, y, z); P(.04, .03, 1.4, glowMat('#ffd29a', 2.2), 7.62, y + .06, z);
    const o = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 8), std('#efe8dc')); o.position.set(7.6, y + .18, z + (y > 2 ? .3 : -.3)); ph.add(o); } }
for (const z of [-6.3, 6.3]) { P(.06, 1.9, 1.7, std('#2c241d'), 7.77, 2.6, z); P(.06, 1.75, 1.55, std('#efe7da'), 7.74, 2.6, z); }
// couloir
P(2, H, .2, wallMat, 9, H / 2, -1.5); P(2, H, .2, wallMat, 9, H / 2, 1.5);
P(2, .05, 3, std('#f4eee5'), 9, 3.2, 0);
P(1.8, .04, .1, glowMat('#ffd29a', 3), 9, 3.18, -1.3); P(1.8, .04, .1, glowMat('#ffd29a', 3), 9, 3.18, 1.3);
// mur d'entrée de la chambre (x=10)
P(.3, H, 7.6, wallMat, 10, H / 2, -5.2); P(.3, H, 7.6, wallMat, 10, H / 2, 5.2); P(.3, 1.8, 2.8, wallMat, 10, H - .9, 0);
// chambre : murs latéraux, baie à l'est
const bedWall = std('#eadfce', { roughness: .95 });
P(8, H, .2, bedWall, 14, H / 2, -5); P(8, H, .2, bedWall, 14, H / 2, 5);
P(.2, H, 18, std('#f3eee6'), 10.2, H / 2, 0).visible = false;
P(.06, 3.6, 8.4, GLASS, 18, 2.05, 0);
for (let z = -4.2; z <= 4.21; z += 2.8) P(.12, 3.7, .12, BRONZE, 18, 2.05, z);
P(.12, .12, 8.6, BRONZE, 18, 3.9, 0); P(.12, .12, 8.6, BRONZE, 18, .2, 0);
P(.3, 1.1, 10, std('#f3eee6'), 18, H - .55, 0);
for (const z of [-4.6, 4.6]) P(.25, 4.6, .9, std('#efe4d2', { roughness: 1 }), 17.6, 2.35, z);   // rideaux
// bois mural derrière le lit
P(6, 3.4, .1, WOOD, 14.2, 1.9, -4.85);
// lit
R(2.4, .55, 2.6, .12, std('#d9cbb6'), 14.2, .35, -3.4);
R(2.3, .3, 2.5, .12, std('#f7f3ec', { roughness: 1 }), 14.2, .75, -3.4);
R(2.6, 1.3, .25, .1, std('#d6c7b2'), 14.2, 1.1, -4.7);
for (const x of [13.6, 14.8]) R(.9, .35, .3, .12, std('#efe7da'), x, 1.05, -4.35);
P(2.35, .06, .9, std('#c7b39a'), 14.2, .93, -2.6);             // plaid
for (const x of [12.4, 16]) { P(.6, .5, .5, std('#cdbda6'), x, .25, -4.5); const l = new THREE.Mesh(new THREE.CylinderGeometry(.18, .22, .4, 16), glowMat('#ffd7a0', 1.6)); l.position.set(x, .75, -4.5); ph.add(l); }
R(1, .7, 1, .3, FABRIC, 16.4, .35, 3.2);                       // fauteuil
P(5, .02, 4, std('#e9e0d0', { roughness: 1 }), 14.5, .08, -1.2); // tapis
// séjour : canapés, tables, tapis, suspensions
for (const s of [-1, 1]) {
  R(5, .45, 1.1, .2, FABRIC, 2.6, .35, 5 * s); R(5, .8, .35, .15, FABRIC, 2.6, .75, 5.5 * s);
  for (let k = 0; k < 3; k++) R(.6, .5, .18, .1, std('#d8ccba'), 1 + k * 1.6, .85, 5.3 * s);
  R(2, .4, 1.1, .2, s > 0 ? STONE : WOOD, 2.6, .25, 3.4 * s);
  P(5.8, .02, 3.6, std('#cfc4b4', { roughness: 1 }), 2.6, .08, 4.1 * s);
  for (const [r, y] of [[1.1, 3.6], [.75, 3.3]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, .035, 8, 48), glowMat('#ffcf8f', 3));
    t.rotation.x = Math.PI / 2; t.position.set(2.6, y, 3.6 * s); ph.add(t);
  }
}
const vase = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 12), std('#fbf8f0')); vase.position.set(2.6, .6, -3.4); ph.add(vase);
// bandeaux lumineux au plafond
for (const z of [-7.5, 7.5]) P(9.6, .04, .12, glowMat('#ffd29a', 2.5), 3, H - .06, z);
P(.12, .04, 15, glowMat('#ffd29a', 2.5), 7.6, H - .06, 0);
// lumières intérieures
const pl = (x, y, z, i, d) => { const l = new THREE.PointLight('#ffd6a8', i, d, 2); l.position.set(x, YR + y, z); scene.add(l); };
pl(2.6, 3.4, 0, 60, 22); pl(9, 2.8, 0, 10, 8); pl(14, 3.6, -.5, 38, 14); pl(-8, 2.5, 0, 25, 20);

// --------------------------------------------------- trajectoire caméra
const K = [
  [0.00, [-640, 340, 600], [80, 0, -140]],
  [0.15, [-430, 230, 380], [40, 20, -60]],
  [0.29, [-230, 125, 180], [0, 40, 0]],
  [0.40, [-100, 66, 62], [0, YR, 0]],
  [0.49, [-44, 52, 12], [0, YR, 0]],
  [0.56, [-23, YR + 3.2, 0], [0, YR + 1, 0]],
  [0.62, [-12.5, EYE + .2, 0], [10, EYE, 0]],
  [0.69, [-3.2, EYE, 0], [12, EYE - .1, 0]],
  [0.77, [3.8, EYE, 0], [14, EYE - .15, 0]],
  [0.85, [8.9, EYE, 0], [18, EYE - .25, 0]],
  [0.93, [11.0, EYE, 1.0], [18, EYE - .5, -1.2]],
  [1.00, [11.6, EYE - .05, 2.4], [18, EYE - .8, -2.6]]
].map(([t, p, q]) => [t, new THREE.Vector3(...p), new THREE.Vector3(...q)]);
const cr = (p0, p1, p2, p3, u, out) => {
  const u2 = u * u, u3 = u2 * u;
  return out.set(0, 0, 0)
    .addScaledVector(p0, -.5 * u3 + u2 - .5 * u).addScaledVector(p1, 1.5 * u3 - 2.5 * u2 + 1)
    .addScaledVector(p2, -1.5 * u3 + 2 * u2 + .5 * u).addScaledVector(p3, .5 * u3 - .5 * u2);
};
const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3();
function cameraAt(p) {
  let i = 0; while (i < K.length - 2 && p > K[i + 1][0]) i++;
  const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(K.length - 1, i + 2)];
  let u = (p - b[0]) / (c[0] - b[0]); u = Math.min(1, Math.max(0, u)); u = u * u * (3 - 2 * u) * .35 + u * .65;
  cr(a[1], b[1], c[1], d[1], u, tmpP); cr(a[2], b[2], c[2], d[2], u, tmpT);
  camera.position.copy(tmpP); camera.lookAt(tmpT);
}

// --------------------------------------------------------------- rendu
const fade = document.createElement('div');
fade.style.cssText = 'position:absolute;inset:0;background:#F4EEE4;opacity:0;pointer-events:none';
stage.insertBefore(fade, stage.querySelector('.steps'));
let W = 0, Hh = 0;
function resize() {
  W = stage.clientWidth; Hh = stage.clientHeight; renderer.setSize(W, Hh, false);
  camera.aspect = W / Hh; camera.fov = Hh > W ? 72 : 55; camera.updateProjectionMatrix();
}
resize(); addEventListener('resize', resize);
const clock = new THREE.Clock();
const FOG_DAY = FOG.clone(), FOG_NIGHT = new THREE.Color('#4a3f5c');
function render(p) {
  cameraAt(p);
  const dusk = Math.min(1, Math.max(0, (p - .25) / .5));
  sky.material.uniforms.uDusk.value = dusk;
  cityMat.uniforms.uLit.value = .18 + .3 * dusk; cityMat.uniforms.uDay.value = 1 - .75 * dusk;
  sun.intensity = 3.2 - 1.6 * dusk; hemi.intensity = 1.1 - .45 * dusk;
  seaMat.uniforms.uTime.value = clock.getElapsedTime() * .6;
  const inside = Math.min(1, Math.max(0, (p - .6) / .15));
  scene.fog.near = 300 + inside * 400;
  FOG.lerpColors(FOG_DAY, FOG_NIGHT, Math.min(1, dusk * 1.1));
  fade.style.opacity = Math.min(1, Math.max(0, (p - .95) / .05));
  renderer.render(scene, camera);
}
render(0);
window.HERO3D = { render };
document.getElementById('scene').style.display = 'none';
window.dispatchEvent(new Event('hero3d-ready'));
