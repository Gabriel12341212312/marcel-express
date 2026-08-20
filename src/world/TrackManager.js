/**
 * The line: a recycled ring of track segments that scrolls toward the camera
 * while the runner stays at z = 0.
 *
 * This is open air now — ballast, three tracks, low retaining walls, catenary
 * masts and a flat overcast sky. It is meant to be quiet. The lighting is a
 * single directional sun plus hemisphere fill, which is both calmer and far
 * cheaper than the lamp rig this used to carry.
 *
 * Zone names are delivered by a board at the lineside, not by the HUD.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { ZONES, SIGNS, pick } from '../data/lines.js';
import {
  ballastTexture, trackTexture, embankmentTexture, skyTexture, skyImageTexture, plateTexture,
} from './textures.js';
import { createZoneBoard } from '../entities/Obstacles.js';

/**
 * Merge a set of primitives into one geometry, once, and hand the same
 * geometry to every segment that asks. Sixteen segments are alive at a time,
 * and they are all identical apart from their textures — so the whole ring
 * shares four geometries between them.
 */
const geoCache = new Map();
function mergedGeometry(key, build) {
  let g = geoCache.get(key);
  if (!g) {
    const list = build();
    g = mergeGeometries(list, false);
    for (const p of list) p.dispose();
    geoCache.set(key, g);
  }
  return g;
}

/**
 * One set of materials per zone, shared by every segment showing that zone.
 *
 * Each segment used to own its own ballast/track/wall materials and swap the
 * texture on recycle, which meant sixty-odd materials for sixteen segments
 * and a forced program re-derive four times per recycle — several times a
 * second at speed. Sharing them makes recycling a pointer assignment, and
 * gives the renderer far fewer state changes to sort through.
 */
const zoneMats = new Map();
function zoneMaterials(zone) {
  let m = zoneMats.get(zone.id);
  if (!m) {
    m = {
      ballast: new THREE.MeshLambertMaterial({ map: ballastTexture(zone) }),
      tracks: new THREE.MeshLambertMaterial({ map: trackTexture(zone), transparent: true }),
      walls: new THREE.MeshLambertMaterial({ map: embankmentTexture(zone) }),
    };
    zoneMats.set(zone.id, m);
  }
  return m;
}

/** The catenary is the same painted steel everywhere. */
let mastMaterial = null;

export class TrackManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.segments = [];
    this.distance = 0;
    this.zone = ZONES[0];
    this.productionLocked = false;

    /** 0..1 dimmer, nudged by the 500-error event. Normally 1. */
    this.lightFactor = 1;

    this.buildSky();
    this.buildLights();

    const count = CONFIG.SEGMENTS_AHEAD + CONFIG.SEGMENTS_BEHIND;
    for (let i = 0; i < count; i++) {
      const seg = this.buildSegment();
      seg.group.position.z = (i - CONFIG.SEGMENTS_BEHIND) * CONFIG.SEGMENT_LENGTH;
      this.paintSegment(seg, this.zoneAt(seg.group.position.z), i);
      this.segments.push(seg);
    }
  }

  /* ---------------------------- sky & light ---------------------------- */

  buildSky() {
    // Everything up here rides with the camera, so the horizon never moves
    // and the picture never drifts off to one side.
    this.skyRig = new THREE.Group();
    this.scene.add(this.skyRig);

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 24, 16),
      new THREE.MeshBasicMaterial({
        map: skyTexture(this.zone), side: THREE.BackSide, fog: false, depthWrite: false,
      })
    );
    this.skyRig.add(this.sky);

    // The picture in the sky. One quad, hung straight ahead and high up,
    // facing back at the camera. It is loaded lazily and simply never appears
    // if the file is not there.
    this.picture = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.SKY_IMAGE_SIZE, CONFIG.SKY_IMAGE_SIZE),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: CONFIG.SKY_IMAGE_OPACITY,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      })
    );
    this.picture.position.set(0, CONFIG.SKY_IMAGE_HEIGHT, CONFIG.SKY_IMAGE_DISTANCE);
    this.picture.rotation.y = Math.PI;     // the camera looks down +z
    this.picture.renderOrder = -1;         // behind the world, in front of the dome
    this.picture.visible = false;
    this.skyRig.add(this.picture);

    const img = new Image();
    img.onload = () => {
      this.picture.material.map = skyImageTexture(img);
      this.picture.material.needsUpdate = true;
      this.picture.visible = true;
    };
    img.onerror = () => { /* no picture today */ };
    img.src = CONFIG.SKY_IMAGE_PATH;
  }

  buildLights() {
    // A bright overcast afternoon. The ground is what is meant to be muted,
    // not the daylight — this used to read as dusk.
    this.hemi = new THREE.HemisphereLight(this.zone.light, this.zone.floor, 1.45);
    this.sun = new THREE.DirectionalLight(this.zone.light, 1.75);
    this.sun.position.set(-14, 24, 18);
    this.scene.add(this.hemi, this.sun);
  }

  tint(zone) {
    this.hemi.color.setHex(zone.light);
    this.hemi.groundColor.setHex(zone.floor);
    this.sun.color.setHex(zone.light);
    this.sky.material.map = skyTexture(zone);
    this.sky.material.needsUpdate = true;
  }

  /* ---------------------------- zones ---------------------------- */

  zoneAt(zOffset) {
    if (this.productionLocked) return ZONES[ZONES.length - 1];
    const d = Math.max(0, this.distance + zOffset);
    return ZONES[Math.floor(d / CONFIG.ZONE_LENGTH) % ZONES.length];
  }

  currentZone() { return this.zoneAt(0); }

  lockProduction() { this.productionLocked = true; }

  /* ---------------------------- segments ---------------------------- */

  buildSegment() {
    const L = CONFIG.SEGMENT_LENGTH;
    const HW = CONFIG.CUT_HALF_WIDTH;
    const H = CONFIG.CUT_HEIGHT;
    const g = new THREE.Group();

    const first = zoneMaterials(ZONES[0]);
    const ballast = new THREE.Mesh(
      mergedGeometry('ballast', () => {
        const p = new THREE.PlaneGeometry(HW * 2, L);
        p.rotateX(-Math.PI / 2);
        return [p];
      }),
      first.ballast
    );
    g.add(ballast);

    // All three permanent ways in one geometry, and both retaining walls in
    // another. Sixteen segments are alive at once, so every mesh saved here
    // is sixteen draw calls saved — and these share a material anyway.
    const tracks = new THREE.Mesh(
      mergedGeometry('tracks', () => CONFIG.LANE_X.map((x) => {
        const p = new THREE.PlaneGeometry(2.35, L);
        p.rotateX(-Math.PI / 2);
        p.translate(x, 0.015, 0);
        return p;
      })),
      first.tracks
    );
    g.add(tracks);

    const walls = new THREE.Mesh(
      mergedGeometry('walls', () => [-1, 1].map((s) => {
        const p = new THREE.PlaneGeometry(L, H);
        p.rotateY(-s * Math.PI / 2);
        p.translate(s * HW, H / 2, 0);
        return p;
      })),
      first.walls
    );
    g.add(walls);

    /*
     * Catenary.
     *
     * Everything overhead is deliberately built ABOVE the camera. The chase
     * camera flies at a constant 7.8 m, so anything higher than that
     * projects above the horizon line — it sits in the sky where it belongs,
     * instead of sweeping across the track and hiding the obstacles you are
     * supposed to be reading. The old boom at 7.1 m and the single wire at
     * 6.1 m both fell below the camera and cut straight through the play area.
     *
     * In the tight framing the camera pitches so far down that none of this
     * is in shot at all, which is exactly right when Marcel is on top of you.
     */
    // masts, boom and contact wires, baked into one mesh per bay
    mastMaterial ??= new THREE.MeshLambertMaterial({ color: 0x6a7076 });
    const mastMat = mastMaterial;
    g.add(new THREE.Mesh(mergedGeometry('catenary', () => {
      const list = [];
      for (const s of [-1, 1]) {
        const m = new THREE.BoxGeometry(0.24, 10.0, 0.24);
        m.translate(s * (HW - 0.7), 5.0, 0);
        list.push(m);
      }
      const boom = new THREE.BoxGeometry((HW - 0.7) * 2, 0.16, 0.16);
      boom.translate(0, 9.2, 0);
      list.push(boom);
      // contact wires: one over each track rather than one down the sightline,
      // so they converge on the vanishing point instead of splitting the view
      for (const x of CONFIG.LANE_X) {
        const w = new THREE.BoxGeometry(0.05, 0.05, L);
        w.translate(x, 8.6, 0);
        list.push(w);
      }
      return list;
    }), mastMat));

    // a lineside sign on roughly one segment in five
    const sign = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), mastMat);
    post.position.y = 1.1;
    sign.add(post);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 1.1),
      new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false })
    );
    board.position.y = 2.4;
    sign.add(board);
    sign.position.set(-(HW - 1.4), 0, 0);
    sign.visible = false;
    g.add(sign);

    // the zone board, shown only on the segment where a zone begins
    const zoneBoard = new THREE.Group();
    zoneBoard.position.set(HW - 1.6, 0, 0);
    zoneBoard.rotation.y = Math.PI;
    zoneBoard.visible = false;
    g.add(zoneBoard);

    this.group.add(g);
    return { group: g, ballast, tracks, walls, sign, board, zoneBoard, zoneBoardZone: null };
  }

  paintSegment(seg, zone, index) {
    seg.zone = zone;
    const mats = zoneMaterials(zone);
    seg.ballast.material = mats.ballast;
    seg.tracks.material = mats.tracks;
    seg.walls.material = mats.walls;

    if (Math.random() < 0.2) {
      const [a, b] = pick(SIGNS);
      seg.board.material.map = plateTexture(a, b, zone.accent, { w: 512, h: 192 });
      seg.board.material.needsUpdate = true;
      seg.sign.visible = true;
    } else {
      seg.sign.visible = false;
    }

    // one board per zone change, rebuilt only when the zone actually differs
    const startsZone = index === undefined ? false : this.zoneStartsHere(seg);
    if (startsZone) {
      if (seg.zoneBoardZone !== zone.id) {
        seg.zoneBoard.clear();
        seg.zoneBoard.add(createZoneBoard(zone, -1));
        seg.zoneBoardZone = zone.id;
      }
      seg.zoneBoard.visible = true;
    } else {
      seg.zoneBoard.visible = false;
    }
  }

  /** True if this segment is the first of a new stretch of line. */
  zoneStartsHere(seg) {
    if (this.productionLocked) return false;
    const d = this.distance + seg.group.position.z;
    const prev = d - CONFIG.SEGMENT_LENGTH;
    if (d < 0 || prev < 0) return false;
    return Math.floor(d / CONFIG.ZONE_LENGTH) !== Math.floor(prev / CONFIG.ZONE_LENGTH);
  }

  /* ---------------------------- per-frame ---------------------------- */

  update(dt, moved, t) {
    this.distance += moved;

    const ring = this.segments.length * CONFIG.SEGMENT_LENGTH;
    const recycleAt = -CONFIG.SEGMENTS_BEHIND * CONFIG.SEGMENT_LENGTH;
    for (const seg of this.segments) {
      seg.group.position.z -= moved;
      if (seg.group.position.z < recycleAt) {
        seg.group.position.z += ring;
        this.paintSegment(seg, this.zoneAt(seg.group.position.z), 0);
      }
    }

    const z = this.currentZone();
    if (z !== this.zone) {
      this.zone = z;
      this.tint(z);
    }

    this.hemi.intensity = 1.45 * this.lightFactor;
    this.sun.intensity = 1.75 * this.lightFactor;
  }

  /** Keep the sky and the picture centred on the camera. */
  followCamera(camera) {
    this.skyRig.position.copy(camera.position);
  }

  reset() {
    this.distance = 0;
    this.productionLocked = false;
    this.lightFactor = 1;
    this.zone = ZONES[0];
    this.segments.forEach((seg, i) => {
      seg.group.position.z = (i - CONFIG.SEGMENTS_BEHIND) * CONFIG.SEGMENT_LENGTH;
      this.paintSegment(seg, this.zoneAt(seg.group.position.z), i);
    });
    this.tint(this.zone);
  }
}
