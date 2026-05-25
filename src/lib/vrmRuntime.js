import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName, VRMHumanBoneName } from '@pixiv/three-vrm'

function createLoader(manager) {
  const loader = new GLTFLoader(manager)
  loader.setMeshoptDecoder(MeshoptDecoder)
  loader.register((parser) => new VRMLoaderPlugin(parser))
  return loader
}

function summarizeVrm(vrm, fallbackName = 'unknown.vrm') {
  const humanoidBones = Object.keys(vrm?.humanoid?.humanBones ?? {})
  const expressionKeys = Object.keys(vrm?.expressionManager?.expressionMap ?? {})
  return {
    avatarName: vrm?.meta?.name || fallbackName,
    format: 'VRM',
    specVersion: vrm?.meta?.metaVersion || vrm?.meta?.specVersion || 'unknown',
    sceneChildren: vrm?.scene?.children?.length ?? 0,
    humanoidBoneCount: humanoidBones.length,
    expressionCount: expressionKeys.length,
    expressionKeys,
  }
}

function summarizeGltf(gltf, fallbackName = 'unknown.glb') {
  const diagnostics = collectAvatarDiagnostics(gltf?.scene, gltf?.animations)
  return {
    avatarName: fallbackName,
    format: inferImportKind(fallbackName) === 'gltf' ? 'glTF (embedded)' : 'GLB/glTF',
    specVersion: 'non-VRM',
    sceneChildren: gltf?.scene?.children?.length ?? 0,
    humanoidBoneCount: diagnostics.boneCount,
    expressionCount: diagnostics.morphTargetCount,
    expressionKeys: diagnostics.morphTargetNames,
    meshCount: diagnostics.meshCount,
    skinnedMeshCount: diagnostics.skinnedMeshCount,
    skeletonCount: diagnostics.skeletonCount,
    animationCount: diagnostics.animationClipCount,
    animationClipNames: diagnostics.animationClipNames,
  }
}


function buildBundleUrlMap(files = []) {
  const map = new Map()
  const objectUrls = []
  for (const file of files) {
    const rel = file.webkitRelativePath || file.name
    const url = URL.createObjectURL(file)
    objectUrls.push(url)
    map.set(rel, url)
    map.set(file.name, url)
    map.set(rel.split('/').pop(), url)
  }
  return { map, objectUrls }
}

function pickBundleEntry(files = []) {
  const list = Array.from(files)
  const direct = list.find((file) => ['vrm', 'glb'].includes(inferImportKind(file.name)))
  if (direct) return direct
  return list.find((file) => inferImportKind(file.name) === 'gltf')
}

function createBundleLoader(files = []) {
  const { map, objectUrls } = buildBundleUrlMap(files)
  const manager = new THREE.LoadingManager()
  manager.setURLModifier((url) => {
    const clean = decodeURIComponent(String(url).split('?')[0].split('#')[0])
    const candidates = [clean, clean.replace(/^\.\//, ''), clean.split('/').pop()]
    for (const candidate of candidates) {
      if (map.has(candidate)) return map.get(candidate)
      const match = [...map.entries()].find(([key]) => key.endsWith(`/${candidate}`))
      if (match) return match[1]
    }
    return url
  })
  return { loader: createLoader(manager), objectUrls }
}

function inferImportKind(name = '') {
  const lower = name.toLowerCase()
  if (lower.endsWith('.vrm')) return 'vrm'
  if (lower.endsWith('.glb')) return 'glb'
  if (lower.endsWith('.gltf')) return 'gltf'
  if (lower.endsWith('.fbx')) return 'fbx'
  if (lower.endsWith('.usdz')) return 'usdz'
  return 'unknown'
}

const BASE_Y = -1.15
const MOOD_POSES = {
  idle: { sway: 0.12, bob: 0.03, tilt: 0.02, turnSpeed: 0.8, breathScale: 0.012 },
  listening: { sway: 0.18, bob: 0.05, tilt: 0.04, turnSpeed: 1.2, breathScale: 0.018 },
  speaking: { sway: 0.1, bob: 0.06, tilt: 0.03, turnSpeed: 1.6, breathScale: 0.02 },
  celebrate: { sway: 0.24, bob: 0.09, tilt: 0.06, turnSpeed: 2.2, breathScale: 0.028 },
}

const ARM_BONE_SPECS = [
  {
    label: 'chest',
    boneName: VRMHumanBoneName.Chest,
    rotation: { x: 0.08, y: 0.03, z: 0.04 },
    clamp: { x: 0.12, y: 0.05, z: 0.08 },
    phase: Math.PI * 0.12,
  },
  {
    label: 'head',
    boneName: VRMHumanBoneName.Head,
    rotation: { x: 0.12, y: 0.08, z: 0.05 },
    clamp: { x: 0.18, y: 0.12, z: 0.08 },
    phase: Math.PI * 0.42,
  },
  {
    label: 'leftShoulder',
    boneName: VRMHumanBoneName.LeftShoulder,
    rotation: { x: 0.14, y: 0.05, z: 0.18 },
    clamp: { x: 0.2, y: 0.08, z: 0.24 },
    phase: 0,
  },
  {
    label: 'rightShoulder',
    boneName: VRMHumanBoneName.RightShoulder,
    rotation: { x: 0.14, y: -0.05, z: -0.18 },
    clamp: { x: 0.2, y: 0.08, z: 0.24 },
    phase: Math.PI,
  },
  {
    label: 'leftUpperArm',
    boneName: VRMHumanBoneName.LeftUpperArm,
    rotation: { x: 0.22, y: 0.08, z: 0.34 },
    clamp: { x: 0.28, y: 0.12, z: 0.42 },
    phase: Math.PI * 0.18,
  },
  {
    label: 'rightUpperArm',
    boneName: VRMHumanBoneName.RightUpperArm,
    rotation: { x: 0.22, y: -0.08, z: -0.34 },
    clamp: { x: 0.28, y: 0.12, z: 0.42 },
    phase: Math.PI * 1.18,
  },
  {
    label: 'leftLowerArm',
    boneName: VRMHumanBoneName.LeftLowerArm,
    rotation: { x: -0.08, y: 0.05, z: 0.22 },
    clamp: { x: 0.16, y: 0.08, z: 0.28 },
    phase: Math.PI * 0.35,
  },
  {
    label: 'rightLowerArm',
    boneName: VRMHumanBoneName.RightLowerArm,
    rotation: { x: -0.08, y: -0.05, z: -0.22 },
    clamp: { x: 0.16, y: 0.08, z: 0.28 },
    phase: Math.PI * 1.35,
  },
  {
    label: 'leftHand',
    boneName: VRMHumanBoneName.LeftHand,
    rotation: { x: 0.16, y: 0.05, z: 0.12 },
    clamp: { x: 0.2, y: 0.08, z: 0.16 },
    phase: Math.PI * 0.5,
  },
  {
    label: 'rightHand',
    boneName: VRMHumanBoneName.RightHand,
    rotation: { x: 0.16, y: -0.05, z: -0.12 },
    clamp: { x: 0.2, y: 0.08, z: 0.16 },
    phase: Math.PI * 1.5,
  },
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const smoothstep = (t) => t * t * (3 - 2 * t)
const toDegrees = (rad) => Math.round((rad * 180 / Math.PI) * 10) / 10

const VISEME_PRESET_MAP = {
  aa: VRMExpressionPresetName.Aa,
  ih: VRMExpressionPresetName.Ih,
  ou: VRMExpressionPresetName.Ou,
  ee: VRMExpressionPresetName.Ee,
  oh: VRMExpressionPresetName.Oh,
}


function captureArmBones(vrm) {
  const humanoid = vrm?.humanoid
  if (!humanoid?.getNormalizedBoneNode) {
    return {
      bones: [],
      availableBoneLabels: [],
    }
  }

  const bones = ARM_BONE_SPECS.flatMap((spec) => {
    const node = humanoid.getNormalizedBoneNode(spec.boneName)
    if (!node) return []
    return [{
      ...spec,
      node,
      baseQuaternion: node.quaternion.clone(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
    }]
  })

  return {
    bones,
    availableBoneLabels: bones.map((bone) => bone.label),
  }
}

function createArmMotionState() {
  return {
    active: false,
    durationMs: 0,
    startedAtMs: 0,
    cycleHz: 1.55,
    peak: {},
    snapshot: {
      active: false,
      availableBoneLabels: [],
      animatedBoneCount: 0,
      durationMs: 0,
      mode: 'not-run',
      peakDegrees: {},
    },
  }
}

function startArmMotionProof(state, armRig, options = {}) {
  const durationMs = options.durationMs ?? 2600
  state.active = true
  state.durationMs = durationMs
  state.startedAtMs = performance.now()
  state.cycleHz = options.cycleHz ?? 1.55
  state.peak = {}
  state.snapshot = {
    active: true,
    availableBoneLabels: armRig.availableBoneLabels,
    animatedBoneCount: armRig.bones.length,
    durationMs,
    mode: 'running',
    peakDegrees: {},
  }
  return {
    durationMs,
    availableBoneLabels: armRig.availableBoneLabels,
    animatedBoneCount: armRig.bones.length,
    peakDegreeTargets: Object.fromEntries(armRig.bones.map((bone) => [bone.label, {
      x: toDegrees(bone.clamp.x),
      y: toDegrees(bone.clamp.y),
      z: toDegrees(bone.clamp.z),
    }])),
  }
}

function finalizeArmMotionState(state, armRig) {
  state.active = false
  state.snapshot = {
    active: false,
    availableBoneLabels: armRig.availableBoneLabels,
    animatedBoneCount: armRig.bones.length,
    durationMs: state.durationMs,
    mode: 'completed',
    peakDegrees: state.peak,
  }
}


const MOUTH_MORPH_REGEX = /(mouth|jaw|lip|viseme|phoneme|aa|ah|aah|ih|ee|oh|ou|smile|frown|open)/i
const JAW_BONE_REGEX = /(jaw|chin|mandible)/i
const HEAD_BONE_REGEX = /(^|[^a-z])(head|neck)([^a-z]|$)/i
const HAIR_BONE_REGEX = /(hair|bang|fringe|sideburn|ponytail|braid|twin|tail|ahoge|antenna|ribbon|accessory|skirt|cloth)/i
const NON_VRM_VISEME_SLOT_RULES = {
  aa: [/(^|[^a-z])ae[_-]?aa([^a-z]|$)/i, /mouthopen/i, /shout/i],
  oh: [/(^|[^a-z])ao[_-]?a([^a-z]|$)/i, /(^|[^a-z])uh[_-]?oo([^a-z]|$)/i, /(^|[^a-z])uw[_-]?u([^a-z]|$)/i],
  ih: [/(^|[^a-z])ax[_-]?e([^a-z]|$)/i, /(^|[^a-z])td[_-]?i([^a-z]|$)/i],
  ee: [/(^|[^a-z])td[_-]?i([^a-z]|$)/i, /(^|[^a-z])ax[_-]?e([^a-z]|$)/i],
  ou: [/(^|[^a-z])uh[_-]?oo([^a-z]|$)/i, /(^|[^a-z])uw[_-]?u([^a-z]|$)/i],
  fv: [/(^|[^a-z])fv([^a-z]|$)/i],
  mpb: [/(^|[^a-z])mpb([^a-z]|$)/i],
}

function normalizeBoneToken(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/^mixamorig[:_\-. ]*/i, '')
    .replace(/^armature[:_\-. ]*/i, '')
    .replace(/^metarig[:_\-. ]*/i, '')
    .replace(/[:_\-. ]+/g, '')
}

function collectAvatarDiagnostics(root, animations = []) {
  const skinnedMeshes = []
  const skeletons = []
  const skeletonKeySet = new Set()
  const boneMap = new Map()
  const morphMeshes = []
  let meshCount = 0

  root?.traverse?.((node) => {
    if (node.isMesh) meshCount += 1
    if (node.isSkinnedMesh) {
      skinnedMeshes.push(node)
      const skeleton = node.skeleton
      if (skeleton) {
        const skeletonKey = skeleton.uuid || skeleton.bones.map((bone) => bone.uuid).join(':')
        if (!skeletonKeySet.has(skeletonKey)) {
          skeletonKeySet.add(skeletonKey)
          skeletons.push(skeleton)
        }
        skeleton.bones.forEach((bone) => {
          if (bone?.uuid && !boneMap.has(bone.uuid)) boneMap.set(bone.uuid, bone)
        })
      }
    }
    if (node.isBone && node?.uuid && !boneMap.has(node.uuid)) {
      boneMap.set(node.uuid, node)
    }
    if (node.isMesh && node.morphTargetDictionary && node.morphTargetInfluences) {
      const morphNames = Object.keys(node.morphTargetDictionary)
      morphMeshes.push({
        mesh: node,
        meshName: node.name || node.uuid,
        morphNames,
      })
    }
  })

  const bones = [...boneMap.values()]
  const morphTargetNames = [...new Set(morphMeshes.flatMap((entry) => entry.morphNames))]
  const jawBones = bones.filter((bone) => JAW_BONE_REGEX.test(bone.name || ''))
  const headBones = bones.filter((bone) => HEAD_BONE_REGEX.test(bone.name || ''))
  const mouthMorphCandidates = morphMeshes.flatMap((entry) =>
    entry.morphNames
      .filter((name) => MOUTH_MORPH_REGEX.test(name))
      .map((name) => ({ meshName: entry.meshName, morphName: name }))
  )

  return {
    meshCount,
    skinnedMeshCount: skinnedMeshes.length,
    skeletonCount: skeletons.length,
    boneCount: bones.length,
    boneNames: bones.map((bone) => bone.name || bone.uuid),
    morphTargetCount: morphTargetNames.length,
    morphTargetNames,
    morphMeshes: morphMeshes.map((entry) => ({ meshName: entry.meshName, morphNames: entry.morphNames })),
    animationClipCount: animations.length,
    animationClipNames: animations.map((clip) => clip.name || '(unnamed clip)'),
    jawBoneNames: jawBones.map((bone) => bone.name || bone.uuid),
    headBoneNames: headBones.map((bone) => bone.name || bone.uuid),
    mouthMorphCandidates,
    raw: { skinnedMeshes, skeletons, bones, morphMeshes, jawBones, headBones, animations },
  }
}

function worldAxesForBone(bone) {
  const q = new THREE.Quaternion()
  return {
    worldX: new THREE.Vector3(1, 0, 0).applyQuaternion(bone.getWorldQuaternion(q.clone())).toArray().map((value) => Number(value.toFixed(4))),
    worldY: new THREE.Vector3(0, 1, 0).applyQuaternion(bone.getWorldQuaternion(q.clone())).toArray().map((value) => Number(value.toFixed(4))),
    worldZ: new THREE.Vector3(0, 0, 1).applyQuaternion(bone.getWorldQuaternion(q.clone())).toArray().map((value) => Number(value.toFixed(4))),
  }
}

function pickMouthController(diagnostics) {
  const morph = diagnostics.mouthMorphCandidates?.[0] || null
  if (morph) return { type: 'mouthMorph', morph }
  const jaw = diagnostics.raw?.bones?.find((bone) => JAW_BONE_REGEX.test(bone.name || '')) || null
  if (jaw) return { type: 'jawBone', bone: jaw, reason: 'jaw-bone-fallback' }
  const headNames = diagnostics.headBoneNames || []
  return {
    type: 'unsupportedHeadOnly',
    reason: `no mouth morph and no jaw bone; head/neck candidates ${headNames.join(', ')} are NOT mouth proof`,
    headBoneNames: headNames,
  }
}

function getNonVrmVisemeMap(diagnostics) {
  const candidates = diagnostics?.raw?.morphMeshes?.flatMap((entry) =>
    entry.morphNames
      .filter((name) => MOUTH_MORPH_REGEX.test(name))
      .map((morphName) => ({ mesh: entry.mesh, meshName: entry.meshName, morphName }))
  ) || []
  const mapping = {}
  for (const [slot, rules] of Object.entries(NON_VRM_VISEME_SLOT_RULES)) {
    const match = candidates.find((candidate) => rules.some((rule) => rule.test(candidate.morphName || '')))
    if (match) mapping[slot] = { ...match }
  }
  return mapping
}

function escapeRegexLiteral(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\$&')
}

function buildMorphRegexFromSlot(slot, mapping) {
  const mapped = mapping?.[slot]?.morphName
  if (mapped) return `^${escapeRegexLiteral(mapped)}$`
  const fallback = NON_VRM_VISEME_SLOT_RULES[slot]
  return fallback?.[0]?.source || null
}


function pickGenericArmBone(bones, side = 'right') {
  const sideRules = side === 'left'
    ? [/^left(?=[A-Z]|$)/, /^l(?=[A-Z]|$)/, /(^|[^a-z])(left|l)([^a-z]|$)/i, /(^|[^a-z])l([^a-z]|$)/i, /\bleft\b/i]
    : [/^right(?=[A-Z]|$)/, /^r(?=[A-Z]|$)/, /(^|[^a-z])(right|r)([^a-z]|$)/i, /(^|[^a-z])r([^a-z]|$)/i, /\bright\b/i]
  const priorities = [
    { label: 'hand', rules: [/(hand|wrist|palm)/i] },
    { label: 'lowerArm', rules: [/(lowerarm|forearm|elbow)/i] },
    { label: 'upperArm', rules: [/(upperarm|arm)/i] },
    { label: 'shoulder', rules: [/(shoulder|clavicle|collar)/i] },
  ]
  const scored = bones
    .map((bone) => {
      const name = String(bone.name || '')
      const sideScore = sideRules.some((rule) => rule.test(name)) ? 100 : 0
      const priorityIndex = priorities.findIndex((entry) => entry.rules.some((rule) => rule.test(name)))
      if (sideScore === 0 || priorityIndex === -1) return null
      return {
        bone,
        boneName: name,
        side,
        part: priorities[priorityIndex].label,
        reason: `${side}-${priorities[priorityIndex].label}-name-match`,
        score: sideScore - priorityIndex,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
  return scored[0] || null
}


const BODY_PART_RULES = [
  { part: 'head', rules: [/(^|[^a-z])(head)([^a-z]|$)/i], amp: { x: 0.12, y: 0.1, z: 0.06 }, phase: 0.2 },
  { part: 'neck', rules: [/(^|[^a-z])(neck)([^a-z]|$)/i], amp: { x: 0.08, y: 0.08, z: 0.04 }, phase: 0.45 },
  { part: 'torso', rules: [/(spine|chest|torso|upperbody)/i], amp: { x: 0.04, y: 0.035, z: 0.06 }, phase: 0.8 },
  { part: 'leftShoulder', rules: [/(left|^l)[_:\-. ]*(shoulder|clavicle|collar)/i, /(shoulder|clavicle|collar)[_:\-. ]*(left|l$)/i], amp: { x: 0.11, y: 0.05, z: 0.12 }, phase: 1.1 },
  { part: 'rightShoulder', rules: [/(right|^r)[_:\-. ]*(shoulder|clavicle|collar)/i, /(shoulder|clavicle|collar)[_:\-. ]*(right|r$)/i], amp: { x: 0.11, y: -0.05, z: -0.12 }, phase: 2.2 },
  { part: 'leftUpperArm', rules: [/(left|^l)[_:\-. ]*(upperarm|arm)/i, /(upperarm|arm)[_:\-. ]*(left|l$)/i], amp: { x: 0.18, y: 0.08, z: 0.26 }, phase: 1.35 },
  { part: 'rightUpperArm', rules: [/(right|^r)[_:\-. ]*(upperarm|arm)/i, /(upperarm|arm)[_:\-. ]*(right|r$)/i], amp: { x: 0.18, y: -0.08, z: -0.26 }, phase: 2.55 },
  { part: 'leftLowerArm', rules: [/(left|^l)[_:\-. ]*(lowerarm|forearm|elbow)/i, /(lowerarm|forearm|elbow)[_:\-. ]*(left|l$)/i], amp: { x: 0.14, y: 0.04, z: 0.18 }, phase: 1.7 },
  { part: 'rightLowerArm', rules: [/(right|^r)[_:\-. ]*(lowerarm|forearm|elbow)/i, /(lowerarm|forearm|elbow)[_:\-. ]*(right|r$)/i], amp: { x: 0.14, y: -0.04, z: -0.18 }, phase: 2.85 },
  { part: 'leftHand', rules: [/(left|^l)[_:\-. ]*(hand|wrist|palm)/i, /(hand|wrist|palm)[_:\-. ]*(left|l$)/i], amp: { x: 0.14, y: 0.08, z: 0.12 }, phase: 2.0 },
  { part: 'rightHand', rules: [/(right|^r)[_:\-. ]*(hand|wrist|palm)/i, /(hand|wrist|palm)[_:\-. ]*(right|r$)/i], amp: { x: 0.14, y: -0.08, z: -0.12 }, phase: 3.15 },
  { part: 'leftUpperLeg', rules: [/(left|^l)[_:\-. ]*(upperleg|upleg|thigh)/i, /(upperleg|upleg|thigh)[_:\-. ]*(left|l$)/i], amp: { x: 0.08, y: 0.03, z: 0.04 }, phase: 3.5 },
  { part: 'rightUpperLeg', rules: [/(right|^r)[_:\-. ]*(upperleg|upleg|thigh)/i, /(upperleg|upleg|thigh)[_:\-. ]*(right|r$)/i], amp: { x: 0.08, y: -0.03, z: -0.04 }, phase: 4.0 },
  { part: 'leftLowerLeg', rules: [/(left|^l)[_:\-. ]*(lowerleg|leg|calf|shin|knee)/i, /(lowerleg|leg|calf|shin|knee)[_:\-. ]*(left|l$)/i], amp: { x: 0.07, y: 0.02, z: 0.035 }, phase: 4.25 },
  { part: 'rightLowerLeg', rules: [/(right|^r)[_:\-. ]*(lowerleg|leg|calf|shin|knee)/i, /(lowerleg|leg|calf|shin|knee)[_:\-. ]*(right|r$)/i], amp: { x: 0.07, y: -0.02, z: -0.035 }, phase: 4.75 },
]

function classifyBodyBone(boneName = '') {
  const raw = String(boneName || '')
  const normalized = normalizeBoneToken(raw)
  return BODY_PART_RULES.find((entry) => entry.rules.some((rule) => rule.test(raw) || rule.test(normalized))) || null
}

function captureGenericBodyPartRig(diagnostics) {
  const byPart = new Map()
  for (const bone of diagnostics?.raw?.bones || []) {
    if (!bone?.isBone) continue
    const match = classifyBodyBone(bone.name || '')
    if (!match) continue
    if (!byPart.has(match.part)) byPart.set(match.part, { match, bone })
  }
  const bones = [...byPart.values()].map(({ match, bone }) => ({
    part: match.part,
    bone,
    boneName: bone.name || match.part,
    baseQuaternion: bone.quaternion.clone(),
    basePosition: bone.position.clone(),
    quaternion: new THREE.Quaternion(),
    euler: new THREE.Euler(),
    amplitude: match.amp,
    phase: match.phase,
  }))
  return { bones, availableParts: bones.map((entry) => entry.part) }
}


function captureHairRig(root, springBoneManager = null) {
  const byUuid = new Map()
  const addBone = (node, source = 'name') => {
    if (!node?.isBone) return
    const name = String(node.name || '')
    if (source === 'name' && !HAIR_BONE_REGEX.test(name)) return
    // Never animate the avatar/root/hips/clothing as hair. Only real hair/appendage secondary bones are accepted.
    if (/(skirt|dress|cloth|sleeve|cape|coat|hood|ribboncloth)/i.test(name)) return
    if (/(hips|root|spine|chest|neck|head|shoulder|arm|hand|leg|foot)/i.test(name) && source !== 'spring') return
    if (source === 'spring' && !HAIR_BONE_REGEX.test(name) && !/hairjoint/i.test(name)) return
    if (byUuid.has(node.uuid)) return
    byUuid.set(node.uuid, {
      label: name || `${source}HairBone`,
      source,
      bone: node,
      baseQuaternion: node.quaternion.clone(),
      basePosition: node.position.clone(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      phase: (byUuid.size + 1) * 0.71,
      amp: {
        x: THREE.MathUtils.degToRad(source === 'spring' ? 5.2 : 3.8),
        y: THREE.MathUtils.degToRad(source === 'spring' ? 3.0 : 2.2),
        z: THREE.MathUtils.degToRad(source === 'spring' ? 6.3 : 5.2),
      },
    })
  }
  root?.traverse?.((node) => addBone(node, 'name'))
  // Many good VRMs use generic bone names for hair, but mark them as VRM spring-bone joints.
  // Use those joints as real secondary-motion/hair/accessory bones instead of shaking the whole model.
  const joints = Array.from(springBoneManager?.joints || springBoneManager?.springBones || [])
  for (const joint of joints) addBone(joint?.bone, 'spring')
  const bones = [...byUuid.values()].slice(0, 72)
  return { bones, availableHairBones: bones.map((entry) => `${entry.label}${entry.source === 'spring' ? ' (spring)' : ''}`) }
}

function captureEyeRig(vrm, root) {
  const byUuid = new Map()
  const add = (node, label) => {
    if (!node?.isBone || byUuid.has(node.uuid)) return
    byUuid.set(node.uuid, {
      label,
      bone: node,
      baseQuaternion: node.quaternion.clone(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      phase: byUuid.size ? Math.PI : 0,
    })
  }
  const humanoid = vrm?.humanoid
  if (humanoid?.getNormalizedBoneNode) {
    add(humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftEye), 'leftEye')
    add(humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightEye), 'rightEye')
  }
  root?.traverse?.((node) => {
    if (!node?.isBone) return
    const name = String(node.name || '')
    if (/(^|[^a-z])(left|l)[_:\-. ]*eye([^a-z]|$)/i.test(name)) add(node, name || 'leftEye')
    if (/(^|[^a-z])(right|r)[_:\-. ]*eye([^a-z]|$)/i.test(name)) add(node, name || 'rightEye')
  })
  const bones = [...byUuid.values()]
  return { bones, availableEyeBones: bones.map((entry) => entry.label) }
}

function createMotionPlanState() {
  return {
    active: false,
    startedAtMs: 0,
    totalDurationMs: 0,
    cues: [],
    current: { body: 1, head: 1, arms: 1, hands: 1, hair: 1, eyes: 1 },
    snapshot: { active: false, cueCount: 0, current: {}, source: 'none' },
  }
}

function normalizeMovementCueEntry(cue, fallback = {}) {
  const time = Number.isFinite(Number(cue?.time ?? cue?.startMs)) ? Number(cue.time ?? cue.startMs) : Number(fallback.time || 0)
  const duration = Number.isFinite(Number(cue?.duration ?? cue?.durationMs)) ? Number(cue.duration ?? cue.durationMs) : Number(fallback.duration || 900)
  const rawPart = String(cue?.part || fallback.part || 'body').trim()
  const part = /^(left|right)hand$/i.test(rawPart) || /^(left|right)arm$/i.test(rawPart)
    ? rawPart
    : /head|neck/i.test(rawPart)
      ? 'head'
      : /eye|look|gaze/i.test(rawPart)
        ? 'eyes'
        : /arm|shoulder/i.test(rawPart)
          ? 'arms'
          : /hand|wrist/i.test(rawPart)
            ? (/left/i.test(rawPart) ? 'leftHand' : 'rightHand')
            : 'body'
  const action = String(cue?.action || fallback.action || 'gesture').trim().toLowerCase()
  return {
    time: Math.max(0, Math.round(time)),
    duration: clamp(Number.isFinite(duration) ? duration : 900, 220, 2600),
    part,
    action: /wave|bow|peek-around|nod|point|lean|raise|gesture|look/.test(action) ? action : action.includes('peek') ? 'peek-around' : 'gesture',
    intensity: clamp(Number(cue?.intensity ?? fallback.intensity ?? 0.9), 0, 1.6),
  }
}

function deriveFallbackMovementCues(spokenText = '') {
  const source = String(spokenText || '').toLowerCase()
  const cues = []
  if (/wave|hello|hi\b/.test(source)) {
    cues.push({ time: 0, part: 'rightHand', action: 'wave', intensity: 1.3, duration: 1450 })
    cues.push({ time: 120, part: 'arms', action: 'raise', intensity: 1.0, duration: 1200 })
    cues.push({ time: 140, part: 'head', action: 'nod', intensity: 0.65, duration: 720 })
    cues.push({ time: 0, part: 'body', action: 'lean', intensity: 0.4, duration: 1150 })
  }
  if (/bow|bend/.test(source)) cues.push({ time: 0, part: 'body', action: 'bow', intensity: 1, duration: 1100 })
  if (/peek/.test(source)) cues.push({ time: 0, part: 'body', action: 'peek-around', intensity: 1, duration: 1200 })
  if (/point/.test(source)) cues.push({ time: 0, part: 'rightHand', action: 'point', intensity: 1, duration: 1200 })
  if (/nod|yes/.test(source) && !cues.some((cue) => cue.action === 'nod')) cues.push({ time: 0, part: 'head', action: 'nod', intensity: 1, duration: 760 })
  if (!cues.length) {
    cues.push({ time: 0, part: 'body', action: 'lean', intensity: 0.55, duration: 900 })
    cues.push({ time: 80, part: 'head', action: 'nod', intensity: 0.5, duration: 680 })
    cues.push({ time: 100, part: 'rightHand', action: 'gesture', intensity: 0.55, duration: 780 })
  }
  return cues.map((cue) => normalizeMovementCueEntry(cue))
}

function normalizeMotionPlan(plan, spokenText = '') {
  const rawCues = Array.isArray(plan?.cues) ? plan.cues : []
  const rawMovementCues = Array.isArray(plan?.movement_cues) ? plan.movement_cues : []
  const text = String(spokenText || plan?.spokenText || '')
  const fallbackDuration = Math.max(1200, Math.min(8500, text.length * 55))
  const sharedMovementCues = (rawMovementCues.length ? rawMovementCues : deriveFallbackMovementCues(text)).slice(0, 40).map((cue) => normalizeMovementCueEntry(cue))
  const cues = rawCues.slice(0, 24).map((cue, index) => {
    const startMs = Number.isFinite(Number(cue.startMs)) ? Number(cue.startMs) : index * 450
    const durationMs = Number.isFinite(Number(cue.durationMs)) ? Number(cue.durationMs) : 650
    const body = cue.body || {}
    const localMovements = Array.isArray(cue?.movements) && cue.movements.length
      ? cue.movements.map((movement) => normalizeMovementCueEntry(movement, { time: startMs, duration: durationMs }))
      : sharedMovementCues.filter((movement) => movement.time <= startMs + durationMs && movement.time + movement.duration >= startMs)
    const parts = {
      body: clamp(Number(body.body ?? body.torso ?? cue.bodyIntensity ?? (localMovements.some((movement) => movement.part === 'body') ? 1.0 : 0.68)), 0, 2.2),
      head: clamp(Number(body.head ?? cue.headIntensity ?? (localMovements.some((movement) => movement.part === 'head') ? 1.0 : 0.74)), 0, 2.2),
      arms: clamp(Number(body.arms ?? cue.armIntensity ?? (localMovements.some((movement) => /arm|hand/i.test(movement.part)) ? 1.1 : 0.72)), 0, 2.4),
      hands: clamp(Number(body.hands ?? cue.handIntensity ?? (localMovements.some((movement) => /hand/i.test(movement.part)) ? 1.18 : 0.74)), 0, 2.6),
      hair: clamp(Number(body.hair ?? cue.hairIntensity ?? 1), 0, 2.6),
      eyes: clamp(Number(body.eyes ?? cue.eyeIntensity ?? (localMovements.some((movement) => movement.part === 'eyes') ? 0.92 : 0.72)), 0, 2.0),
    }
    return {
      startMs: Math.max(0, startMs),
      durationMs: clamp(durationMs, 160, 2600),
      text: String(cue.text || cue.spokenText || text || '').slice(0, 160),
      mood: ['idle', 'listening', 'speaking', 'celebrate'].includes(cue.mood) ? cue.mood : 'speaking',
      parts,
      movements: localMovements,
    }
  })
  if (!cues.length) {
    cues.push({
      startMs: 0,
      durationMs: fallbackDuration,
      text: text.slice(0, 160),
      mood: 'speaking',
      parts: { body: 1, head: 1, arms: 1, hands: 1, hair: 1.35, eyes: 1 },
      movements: sharedMovementCues,
    })
  }
  return {
    spokenText: text,
    movementCues: sharedMovementCues,
    cues,
    totalDurationMs: Math.max(fallbackDuration, ...cues.map((cue) => cue.startMs + cue.durationMs), ...sharedMovementCues.map((cue) => cue.time + cue.duration)),
  }
}

function createBodyPartMotionState() {
  return {
    active: false,
    durationMs: 0,
    startedAtMs: 0,
    cycleHz: 0.85,
    peak: {},
    snapshot: {
      active: false,
      mode: 'not-run',
      availableParts: [],
      animatedPartCount: 0,
      durationMs: 0,
      peakDegrees: {},
      rootMotionGuard: 'root-transform-stays-fixed',
    },
  }
}

function startBodyPartMotionProof(state, rig, options = {}) {
  const durationMs = options.durationMs ?? 3200
  state.active = true
  state.durationMs = durationMs
  state.startedAtMs = performance.now()
  state.cycleHz = options.cycleHz ?? 0.85
  state.peak = {}
  state.snapshot = {
    active: true,
    mode: 'running',
    availableParts: rig.availableParts,
    animatedPartCount: rig.bones.length,
    durationMs,
    peakDegrees: {},
    rootMotionGuard: 'root-transform-stays-fixed',
  }
  return {
    durationMs,
    availableParts: rig.availableParts,
    animatedPartCount: rig.bones.length,
    rootMotionGuard: 'root transform is not animated; only detected skeleton bones are rotated',
  }
}

export async function createVrmPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(canvas.clientWidth || 640, canvas.clientHeight || 360, false)
  renderer.setClearColor('#0f131c', 1)
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace
  if ('toneMapping' in renderer && THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping
  if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = 1.15

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0f131c')

  const camera = new THREE.PerspectiveCamera(30, (canvas.clientWidth || 640) / (canvas.clientHeight || 360), 0.1, 100)
  const previewLookAt = new THREE.Vector3(0, 0.95, 0)
  camera.position.set(0, 1.05, 3.1)
  camera.lookAt(previewLookAt)

  const hemi = new THREE.HemisphereLight('#ffffff', '#1d2230', 1.5)
  scene.add(hemi)

  const dir = new THREE.DirectionalLight('#ffffff', 1.8)
  dir.position.set(1.5, 2.5, 2.5)
  scene.add(dir)

  const grid = new THREE.GridHelper(6, 12, '#92f0c3', '#2b3040')
  grid.position.y = BASE_Y
  scene.add(grid)

  let currentVrm = null
  let currentAvatarScene = null
  let currentGenericScene = null
  let currentAvatarDiagnostics = null
  let currentAnimationClips = []
  let currentAnimationMixer = null
  let currentAnimationAction = null
  let animationProofActive = false
  let currentMouthOpen = 0
  let targetMouthOpen = 0
  let targetMouthViseme = 'aa'
  const currentMouthWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, fv: 0, mpb: 0 }
  const targetMouthWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, fv: 0, mpb: 0 }
  let gazeTarget = null
  let currentMood = 'idle'
  let raf = 0
  let motionSeconds = 0
  const smoothedGazeTarget = new THREE.Vector3(0, 1.42, 0.9)
  let proceduralPartPeak = {}
  let armRig = { bones: [], availableBoneLabels: [] }
  let bodyPartRig = { bones: [], availableParts: [] }
  let hairRig = { bones: [], availableHairBones: [] }
  let eyeRig = { bones: [], availableEyeBones: [] }
  const motionPlanState = createMotionPlanState()
  const armMotionState = createArmMotionState()
  const bodyPartMotionState = createBodyPartMotionState()
  const clock = new THREE.Clock()
  const renderLoopSamples = []
  let renderLoopTick = 0
  const currentVrmBasePosition = new THREE.Vector3(0, BASE_Y, 0)
  let currentVrmBaseScale = 1
  let currentVrmBaseYaw = 0
  const MOUTH_ATTACK_SPEED = 26
  const MOUTH_RELEASE_SPEED = 9
  const MOUTH_GRACEFUL_CLOSE_MS = 220
  let mouthReleaseAnchor = 0
  let mouthReleaseUntilMs = 0

  const resolveExpressionKey = (manager, preset, fallback) => {
    const map = manager?.expressionMap || {}
    const candidates = [preset, fallback, String(preset || '').toLowerCase(), String(fallback || '').toLowerCase(), String(fallback || '').toUpperCase()].filter(Boolean)
    for (const key of candidates) if (Object.prototype.hasOwnProperty.call(map, key)) return key
    const wanted = String(fallback || preset || '').toLowerCase()
    return Object.keys(map).find((key) => key.toLowerCase() === wanted) || preset || fallback
  }

  const safeSetExpression = (manager, preset, fallback, value) => {
    const key = resolveExpressionKey(manager, preset, fallback)
    try {
      manager.setValue(key, clamp(value, 0, 1))
    } catch {
      try { manager.setValue(fallback, clamp(value, 0, 1)) } catch {}
    }
  }

  const updateMouthTargets = () => {
    for (const key of Object.keys(targetMouthWeights)) targetMouthWeights[key] = 0
    const open = clamp(targetMouthOpen, 0, 0.9)
    if (open <= 0.001) return
    const viseme = targetMouthViseme || 'aa'
    targetMouthWeights[viseme] = open
    if (viseme !== 'aa') targetMouthWeights.aa = Math.max(targetMouthWeights.aa, open * 0.28)
  }

  const applyExpressionState = () => {
    const manager = currentVrm?.expressionManager
    if (!manager) return

    const blinkPulse = Math.max(0, Math.sin(motionSeconds * 1.7)) ** 30
    const eyePlan = partMotionMultiplier('eyes')
    const glanceLeft = Math.max(0, Math.sin(motionSeconds * 0.53)) * 0.18 * eyePlan
    const glanceRight = Math.max(0, -Math.sin(motionSeconds * 0.53)) * 0.18 * eyePlan
    safeSetExpression(manager, VRMExpressionPresetName.Aa, 'aa', currentMouthWeights.aa)
    safeSetExpression(manager, VRMExpressionPresetName.Ih, 'ih', currentMouthWeights.ih)
    safeSetExpression(manager, VRMExpressionPresetName.Ou, 'ou', currentMouthWeights.ou)
    safeSetExpression(manager, VRMExpressionPresetName.Ee, 'ee', currentMouthWeights.ee)
    safeSetExpression(manager, VRMExpressionPresetName.Oh, 'oh', currentMouthWeights.oh)
    safeSetExpression(manager, VRMExpressionPresetName.Blink, 'blink', blinkPulse)
    safeSetExpression(manager, VRMExpressionPresetName.LookLeft, 'lookLeft', glanceLeft)
    safeSetExpression(manager, VRMExpressionPresetName.LookRight, 'lookRight', glanceRight)
    safeSetExpression(manager, VRMExpressionPresetName.Relaxed, 'relaxed', currentMood === 'listening' ? 0.18 : 0)
    safeSetExpression(manager, VRMExpressionPresetName.Happy, 'happy', currentMood === 'celebrate' ? 0.42 : 0)
    safeSetExpression(manager, VRMExpressionPresetName.Surprised, 'surprised', currentMood === 'speaking' ? 0.08 : 0)
    rememberProceduralPeak('eye:expressionBlinkLook', { x: blinkPulse * 0.08, y: Math.max(glanceLeft, glanceRight) * 0.2, z: 0 })
  }

  const applyNonVrmVisemeState = () => {
    if (!currentAvatarScene || !currentAvatarDiagnostics?.raw?.morphMeshes?.length) return
    const visemeMap = getNonVrmVisemeMap(currentAvatarDiagnostics)
    const appliedMeshes = new Set()
    const aggregatedTargets = new Map()
    for (const [slot, entry] of Object.entries(visemeMap)) {
      const mesh = entry?.mesh
      const morphName = entry?.morphName
      const idx = mesh?.morphTargetDictionary?.[morphName]
      if (!mesh || !Number.isInteger(idx) || !mesh.morphTargetInfluences) continue
      const key = `${mesh.uuid}:${idx}`
      const nextValue = clamp(currentMouthWeights[slot] || 0, 0, 1)
      const previous = aggregatedTargets.get(key)
      if (!previous || nextValue > previous.value) {
        aggregatedTargets.set(key, { mesh, idx, value: nextValue })
      }
    }
    for (const { mesh, idx, value } of aggregatedTargets.values()) {
      mesh.morphTargetInfluences[idx] = value
      mesh.skeleton?.update?.()
      mesh.updateMatrixWorld?.(true)
      appliedMeshes.add(mesh)
    }
    if (appliedMeshes.size) currentAvatarScene.updateMatrixWorld(true)
  }

  const isNonVrmMouthTimelineActive = () => {
    if (!currentGenericScene) return false
    if (targetMouthOpen > 0.001 || currentMouthOpen > 0.001) return true
    if (mouthReleaseUntilMs > performance.now()) return true
    return Object.values(currentMouthWeights).some((value) => Math.abs(value) > 0.001)
  }

  const updateSmoothedMouth = (delta) => {
    const nowMs = performance.now()
    let effectiveTarget = targetMouthOpen

    if (targetMouthOpen <= 0.001 && mouthReleaseUntilMs > nowMs) {
      const remaining = (mouthReleaseUntilMs - nowMs) / MOUTH_GRACEFUL_CLOSE_MS
      effectiveTarget = mouthReleaseAnchor * clamp(remaining, 0, 1)
    }

    const speed = effectiveTarget > currentMouthOpen ? MOUTH_ATTACK_SPEED : MOUTH_RELEASE_SPEED
    const alpha = 1 - Math.exp(-speed * delta)
    currentMouthOpen += (effectiveTarget - currentMouthOpen) * alpha

    if (Math.abs(effectiveTarget - currentMouthOpen) < 0.001) {
      currentMouthOpen = effectiveTarget
    }

    updateMouthTargets()
    for (const key of Object.keys(currentMouthWeights)) {
      const desired = targetMouthWeights[key] || 0
      const weightSpeed = desired > currentMouthWeights[key] ? MOUTH_ATTACK_SPEED : MOUTH_RELEASE_SPEED
      const weightAlpha = 1 - Math.exp(-weightSpeed * delta)
      currentMouthWeights[key] += (desired - currentMouthWeights[key]) * weightAlpha
      if (Math.abs(desired - currentMouthWeights[key]) < 0.001) currentMouthWeights[key] = desired
    }
  }


  const proceduralMoodWeight = () => {
    if (currentMood === 'speaking') return 1
    if (currentMood === 'celebrate') return 1.35
    if (currentMood === 'listening') return 0.68
    return 0.34
  }

  const rememberProceduralPeak = (label, rotation) => {
    proceduralPartPeak[label] = {
      x: Math.max(Math.abs(toDegrees(rotation.x || 0)), proceduralPartPeak[label]?.x ?? 0),
      y: Math.max(Math.abs(toDegrees(rotation.y || 0)), proceduralPartPeak[label]?.y ?? 0),
      z: Math.max(Math.abs(toDegrees(rotation.z || 0)), proceduralPartPeak[label]?.z ?? 0),
    }
  }

  const cueEnvelopeAt = (elapsed, cue) => {
    const local = (elapsed - cue.startMs) / cue.durationMs
    if (local < 0 || local > 1) return 0
    return smoothstep(clamp(local / 0.22, 0, 1)) * (1 - smoothstep(clamp((local - 0.78) / 0.22, 0, 1)))
  }

  const collectActiveMovementDirectives = (elapsed) => {
    const directives = []
    for (const cue of motionPlanState.cues) {
      const envelope = cueEnvelopeAt(elapsed, cue)
      if (envelope <= 0.0001) continue
      for (const movement of cue.movements || []) {
        const movementLocal = (elapsed - movement.time) / movement.duration
        if (movementLocal < 0 || movementLocal > 1) continue
        directives.push({
          ...movement,
          envelope: envelope * smoothstep(clamp(movementLocal / 0.18, 0, 1)) * (1 - smoothstep(clamp((movementLocal - 0.82) / 0.18, 0, 1))),
          progress: clamp(movementLocal, 0, 1),
        })
      }
    }
    return directives.filter((directive) => directive.envelope > 0.0001)
  }

  const labelTargetsMotionPart = (label = '', part = '') => {
    if (!part) return false
    if (part === 'body') return /torso|chest|spine|hips|pelvis|body/i.test(label)
    if (part === 'head') return /head|neck/i.test(label)
    if (part === 'eyes') return /eye/i.test(label)
    if (part === 'arms') return /shoulder|upperarm|lowerarm|arm/i.test(label)
    if (part === 'leftHand') return /left/i.test(label) && /shoulder|upperarm|lowerarm|hand|wrist/i.test(label)
    if (part === 'rightHand') return /right/i.test(label) && /shoulder|upperarm|lowerarm|hand|wrist/i.test(label)
    return false
  }

  const sumMotionDirectiveRotation = (label = '', directives = []) => {
    const rotation = { x: 0, y: 0, z: 0 }
    const lower = String(label || '').toLowerCase()
    const isLeft = /left/.test(lower)
    const isRight = /right/.test(lower)
    const side = isLeft ? 1 : isRight ? -1 : 1
    const isShoulder = /shoulder/.test(lower)
    const isUpperArm = /upperarm/.test(lower)
    const isLowerArm = /lowerarm/.test(lower)
    const isHand = /hand|wrist/.test(lower)
    const isTorso = /torso|chest|spine|hips|pelvis|body/.test(lower)
    const isHead = /head/.test(lower)
    const isNeck = /neck/.test(lower)
    const isEye = /eye/.test(lower)

    for (const directive of directives) {
      if (!labelTargetsMotionPart(label, directive.part)) continue
      const amp = directive.intensity * directive.envelope
      const swing = Math.sin(directive.progress * Math.PI * (directive.action === 'wave' ? 4.5 : 2.0))
      const halfSwing = Math.sin(directive.progress * Math.PI * 2)
      if (directive.action === 'wave') {
        if (isShoulder) { rotation.z += side * 0.42 * amp; rotation.x += -0.12 * amp }
        if (isUpperArm) { rotation.z += side * 0.92 * amp; rotation.x += -0.38 * amp }
        if (isLowerArm) { rotation.z += side * 0.22 * amp; rotation.x += -0.92 * amp }
        if (isHand) { rotation.y += side * 0.72 * amp * swing; rotation.z += side * 0.22 * amp * halfSwing }
        if (isHead || isNeck) rotation.x += 0.12 * amp
        if (isTorso) rotation.y += -0.08 * side * amp
      } else if (directive.action === 'raise') {
        if (isShoulder) rotation.z += side * 0.28 * amp
        if (isUpperArm) rotation.z += side * 0.44 * amp
      } else if (directive.action === 'point') {
        if (isShoulder) { rotation.z += side * 0.24 * amp; rotation.x += -0.1 * amp }
        if (isUpperArm) { rotation.z += side * 0.65 * amp; rotation.x += -0.3 * amp }
        if (isLowerArm) rotation.x += -0.42 * amp
        if (isHand) { rotation.y += side * 0.22 * amp; rotation.z += side * 0.12 * amp }
        if (isHead || isNeck) rotation.y += -side * 0.1 * amp
      } else if (directive.action === 'bow') {
        if (isTorso) rotation.x += 0.42 * amp
        if (isNeck) rotation.x += 0.16 * amp
        if (isHead) rotation.x += 0.26 * amp
      } else if (directive.action === 'peek-around') {
        if (isTorso) { rotation.y += side * 0.2 * amp; rotation.z += side * 0.18 * amp }
        if (isNeck) rotation.y += side * 0.28 * amp
        if (isHead) { rotation.y += side * 0.34 * amp; rotation.z += side * 0.08 * amp }
        if (isEye) rotation.y += side * 0.14 * amp
      } else if (directive.action === 'nod') {
        if (isHead) rotation.x += 0.34 * amp * Math.sin(directive.progress * Math.PI * 2)
        if (isNeck) rotation.x += 0.14 * amp * Math.sin(directive.progress * Math.PI * 2)
      } else if (directive.action === 'lean') {
        if (isTorso) { rotation.z += side * 0.16 * amp; rotation.x += -0.08 * amp }
        if (isHead || isNeck) rotation.z += side * 0.06 * amp
      } else if (directive.action === 'look') {
        if (isHead || isNeck || isEye) rotation.y += side * 0.18 * amp
      } else if (directive.action === 'gesture') {
        if (isShoulder) rotation.z += side * 0.12 * amp
        if (isUpperArm) rotation.z += side * 0.2 * amp
        if (isLowerArm) rotation.x += -0.18 * amp
        if (isHand) rotation.y += side * 0.18 * amp * swing
        if (isHead) rotation.x += 0.06 * amp
      }
    }
    return rotation
  }


  const updateMotionPlanEnvelope = () => {
    if (!motionPlanState.active) return motionPlanState.current
    const elapsed = performance.now() - motionPlanState.startedAtMs
    const next = { body: 0.75, head: 0.75, arms: 0.75, hands: 0.75, hair: 1, eyes: 0.75 }
    let activeCue = null
    for (const cue of motionPlanState.cues) {
      const envelope = cueEnvelopeAt(elapsed, cue)
      if (envelope <= 0) continue
      activeCue = cue
      for (const key of Object.keys(next)) next[key] = Math.max(next[key], 0.75 + ((cue.parts?.[key] ?? 1) * envelope))
    }
    const activeMovements = collectActiveMovementDirectives(elapsed)
    motionPlanState.current = next
    motionPlanState.snapshot = {
      active: true,
      cueCount: motionPlanState.cues.length,
      movementCueCount: activeMovements.length,
      elapsedMs: Math.round(elapsed),
      totalDurationMs: motionPlanState.totalDurationMs,
      activeText: activeCue?.text || '',
      activeMood: activeCue?.mood || currentMood,
      current: { ...next },
      activeMovements: activeMovements.map(({ part, action, intensity, progress }) => ({ part, action, intensity: Number(intensity.toFixed(2)), progress: Number(progress.toFixed(2)) })),
      source: 'github-gpt-motion-plan-json',
    }
    if (activeCue?.mood && activeCue.mood !== currentMood) currentMood = activeCue.mood
    if (elapsed > motionPlanState.totalDurationMs + 350) {
      motionPlanState.active = false
      motionPlanState.snapshot = { ...motionPlanState.snapshot, active: false, source: 'completed' }
    }
    return next
  }

  const partMotionMultiplier = (label = '') => {
    const plan = updateMotionPlanEnvelope()
    if (/hair|bang|fringe|tail|braid|ribbon|ahoge|antenna/i.test(label)) return plan.hair || 1
    if (/Hand/i.test(label)) return plan.hands || 1
    if (/Arm|Shoulder/i.test(label)) return plan.arms || 1
    if (/head|neck/i.test(label)) return plan.head || 1
    return plan.body || 1
  }

  const applyHairMotion = () => {
    if (!hairRig.bones.length) return
    const moodWeight = proceduralMoodWeight()
    const planHair = partMotionMultiplier('hair')
    const speechPulse = currentMood === 'speaking' ? 1 + currentMouthOpen * 0.9 : 1
    for (const entry of hairRig.bones) {
      const flutter = Math.sin(motionSeconds * 2.35 + entry.phase)
      const sway = Math.sin(motionSeconds * 1.15 + entry.phase * 0.7)
      const rotation = {
        x: entry.amp.x * flutter * 0.55 * moodWeight * planHair,
        y: entry.amp.y * sway * 0.55 * moodWeight * planHair,
        z: entry.amp.z * Math.cos(motionSeconds * 1.7 + entry.phase) * 0.7 * moodWeight * planHair * speechPulse,
      }
      entry.euler.set(rotation.x, rotation.y, rotation.z)
      entry.quaternion.setFromEuler(entry.euler)
      entry.bone.position.copy(entry.basePosition)
      entry.bone.quaternion.copy(entry.baseQuaternion).multiply(entry.quaternion)
      rememberProceduralPeak(`hair:${entry.label}`, rotation)
    }
    currentAvatarScene?.updateMatrixWorld?.(true)
  }


  const applyEyeBoneMotion = () => {
    if (!eyeRig.bones.length) return
    const planEyes = partMotionMultiplier('eyes')
    const moodWeight = currentMood === 'speaking' ? 1 : currentMood === 'listening' ? 0.72 : 0.42
    const x = Math.sin(motionSeconds * 0.82) * THREE.MathUtils.degToRad(2.1) * moodWeight * planEyes
    const y = Math.sin(motionSeconds * 0.57 + 0.6) * THREE.MathUtils.degToRad(3.0) * moodWeight * planEyes
    for (const entry of eyeRig.bones) {
      const side = /right/i.test(entry.label) ? -1 : 1
      const rotation = { x, y: y + side * THREE.MathUtils.degToRad(0.35), z: 0 }
      entry.euler.set(rotation.x, rotation.y, rotation.z)
      entry.quaternion.setFromEuler(entry.euler)
      entry.bone.quaternion.copy(entry.baseQuaternion).multiply(entry.quaternion)
      rememberProceduralPeak(`eye:${entry.label}`, rotation)
    }
    currentAvatarScene?.updateMatrixWorld?.(true)
  }

  const applyVrmProceduralBodyMotion = () => {
    if (!armRig.bones.length || armMotionState.active) return
    const weight = proceduralMoodWeight()
    const breathe = Math.sin(motionSeconds * 2.1)
    const elapsed = performance.now() - motionPlanState.startedAtMs
    const activeDirectives = motionPlanState.active ? collectActiveMovementDirectives(elapsed) : []
    for (const bone of armRig.bones) {
      const partBoost = /Hand|LowerArm|UpperArm|Shoulder/i.test(bone.label) ? 1 : /head/i.test(bone.label) ? 0.72 : 0.42
      const planBoost = partMotionMultiplier(bone.label)
      const explicit = sumMotionDirectiveRotation(bone.label, activeDirectives)
      const rotation = {
        x: bone.rotation.x * 0.2 * weight * partBoost * planBoost * Math.sin(motionSeconds * 1.35 + bone.phase) + (bone.label === 'chest' ? breathe * 0.018 * weight * planBoost : 0) + explicit.x,
        y: bone.rotation.y * 0.18 * weight * partBoost * planBoost * Math.sin(motionSeconds * 0.95 + bone.phase) + explicit.y,
        z: bone.rotation.z * 0.22 * weight * partBoost * planBoost * Math.cos(motionSeconds * 1.1 + bone.phase) + explicit.z,
      }
      bone.euler.set(rotation.x, rotation.y, rotation.z)
      bone.quaternion.setFromEuler(bone.euler)
      bone.node.quaternion.copy(bone.baseQuaternion).multiply(bone.quaternion)
      rememberProceduralPeak(bone.label, rotation)
    }
  }

  const applyGenericProceduralBodyMotion = () => {
    if (!bodyPartRig.bones.length || bodyPartMotionState.active) return
    const weight = proceduralMoodWeight()
    const elapsed = performance.now() - motionPlanState.startedAtMs
    const activeDirectives = motionPlanState.active ? collectActiveMovementDirectives(elapsed) : []
    for (const entry of bodyPartRig.bones) {
      const partBoost = /Hand|Arm|Shoulder/i.test(entry.part) ? 1 : /head|neck/i.test(entry.part) ? 0.65 : 0.36
      const planBoost = partMotionMultiplier(entry.part)
      const explicit = sumMotionDirectiveRotation(entry.part, activeDirectives)
      const rotation = {
        x: entry.amplitude.x * 0.32 * weight * partBoost * planBoost * Math.sin(motionSeconds * 1.25 + entry.phase) + explicit.x,
        y: entry.amplitude.y * 0.26 * weight * partBoost * planBoost * Math.sin(motionSeconds * 0.85 + entry.phase) + explicit.y,
        z: entry.amplitude.z * 0.28 * weight * partBoost * planBoost * Math.cos(motionSeconds * 1.05 + entry.phase) + explicit.z,
      }
      entry.euler.set(rotation.x, rotation.y, rotation.z)
      entry.quaternion.setFromEuler(entry.euler)
      entry.bone.position.copy(entry.basePosition)
      entry.bone.quaternion.copy(entry.baseQuaternion).multiply(entry.quaternion)
      rememberProceduralPeak(entry.part, rotation)
    }
    currentAvatarScene?.updateMatrixWorld?.(true)
  }

  const applyArmMotion = () => {
    if (!armRig.bones.length) return

    if (!armMotionState.active) return

    const elapsedMs = performance.now() - armMotionState.startedAtMs
    const progress = clamp(elapsedMs / armMotionState.durationMs, 0, 1)
    const fadeIn = smoothstep(clamp(progress / 0.18, 0, 1))
    const fadeOut = 1 - smoothstep(clamp((progress - 0.78) / 0.22, 0, 1))
    const envelope = clamp(fadeIn * fadeOut, 0, 1)
    const oscillation = elapsedMs / 1000 * Math.PI * 2 * armMotionState.cycleHz

    for (const bone of armRig.bones) {
      const primary = clamp(Math.sin(oscillation + bone.phase), -1, 1)
      const secondary = clamp(Math.sin(oscillation * 0.5 + bone.phase), -1, 1)
      const tertiary = clamp(Math.cos(oscillation * 0.75 + bone.phase), -1, 1)
      const rotation = {
        x: clamp(bone.rotation.x * primary * envelope, -bone.clamp.x, bone.clamp.x),
        y: clamp(bone.rotation.y * secondary * envelope, -bone.clamp.y, bone.clamp.y),
        z: clamp(bone.rotation.z * tertiary * envelope, -bone.clamp.z, bone.clamp.z),
      }

      bone.euler.set(rotation.x, rotation.y, rotation.z)
      bone.quaternion.setFromEuler(bone.euler)
      bone.node.quaternion.copy(bone.baseQuaternion).multiply(bone.quaternion)

      armMotionState.peak[bone.label] = {
        x: Math.max(Math.abs(toDegrees(rotation.x)), armMotionState.peak[bone.label]?.x ?? 0),
        y: Math.max(Math.abs(toDegrees(rotation.y)), armMotionState.peak[bone.label]?.y ?? 0),
        z: Math.max(Math.abs(toDegrees(rotation.z)), armMotionState.peak[bone.label]?.z ?? 0),
      }
    }

    armMotionState.snapshot = {
      active: true,
      availableBoneLabels: armRig.availableBoneLabels,
      animatedBoneCount: armRig.bones.length,
      durationMs: armMotionState.durationMs,
      mode: 'running',
      peakDegrees: armMotionState.peak,
    }

    if (progress >= 1) {
      finalizeArmMotionState(armMotionState, armRig)
      console.log('Arm motion proof animation settled', armMotionState.snapshot)
    }
  }


  const applyBodyPartMotion = () => {
    if (!bodyPartRig.bones.length) return
    if (!bodyPartMotionState.active) return

    const elapsedMs = performance.now() - bodyPartMotionState.startedAtMs
    const progress = clamp(elapsedMs / bodyPartMotionState.durationMs, 0, 1)
    const fadeIn = smoothstep(clamp(progress / 0.15, 0, 1))
    const fadeOut = 1 - smoothstep(clamp((progress - 0.82) / 0.18, 0, 1))
    const envelope = clamp(fadeIn * fadeOut, 0, 1)
    const cycle = elapsedMs / 1000 * Math.PI * 2 * bodyPartMotionState.cycleHz

    for (const entry of bodyPartRig.bones) {
      const primary = Math.sin(cycle + entry.phase)
      const secondary = Math.sin(cycle * 0.5 + entry.phase)
      const tertiary = Math.cos(cycle * 0.7 + entry.phase)
      const rotation = {
        x: entry.amplitude.x * primary * envelope,
        y: entry.amplitude.y * secondary * envelope,
        z: entry.amplitude.z * tertiary * envelope,
      }
      entry.euler.set(rotation.x, rotation.y, rotation.z)
      entry.quaternion.setFromEuler(entry.euler)
      entry.bone.position.copy(entry.basePosition)
      entry.bone.quaternion.copy(entry.baseQuaternion).multiply(entry.quaternion)
      bodyPartMotionState.peak[entry.part] = {
        x: Math.max(Math.abs(toDegrees(rotation.x)), bodyPartMotionState.peak[entry.part]?.x ?? 0),
        y: Math.max(Math.abs(toDegrees(rotation.y)), bodyPartMotionState.peak[entry.part]?.y ?? 0),
        z: Math.max(Math.abs(toDegrees(rotation.z)), bodyPartMotionState.peak[entry.part]?.z ?? 0),
      }
    }
    currentAvatarScene?.updateMatrixWorld?.(true)
    bodyPartMotionState.snapshot = {
      active: true,
      mode: 'running',
      availableParts: bodyPartRig.availableParts,
      animatedPartCount: bodyPartRig.bones.length,
      durationMs: bodyPartMotionState.durationMs,
      peakDegrees: bodyPartMotionState.peak,
      rootMotionGuard: 'root-transform-stays-fixed',
    }
    if (progress >= 1) {
      bodyPartMotionState.active = false
      for (const entry of bodyPartRig.bones) {
        entry.bone.position.copy(entry.basePosition)
        entry.bone.quaternion.copy(entry.baseQuaternion)
      }
      bodyPartMotionState.snapshot = {
        ...bodyPartMotionState.snapshot,
        active: false,
        mode: 'completed',
      }
      currentAvatarScene?.updateMatrixWorld?.(true)
      console.log('Sketchfab body-part proof animation settled', bodyPartMotionState.snapshot)
    }
  }

  const resetArmRig = (mode = 'not-run') => {
    armRig = { bones: [], availableBoneLabels: [] }
    armMotionState.active = false
    armMotionState.snapshot = {
      active: false,
      availableBoneLabels: [],
      animatedBoneCount: 0,
      durationMs: 0,
      mode,
      peakDegrees: {},
    }
  }

  const stopAnimationPlayback = () => {
    if (currentAnimationAction) {
      currentAnimationAction.stop()
      currentAnimationAction = null
    }
    if (currentAnimationMixer) {
      currentAnimationMixer.stopAllAction()
      currentAnimationMixer.uncacheRoot(currentAvatarScene || currentGenericScene || scene)
      currentAnimationMixer = null
    }
    animationProofActive = false
  }

  const recordRenderLoopSample = ({ delta, mixerUpdated, vrmUpdated }) => {
    const action = currentAnimationAction
    const actionState = action ? {
      clipName: action.getClip?.()?.name || null,
      enabled: !!action.enabled,
      paused: !!action.paused,
      weight: Number((action.getEffectiveWeight?.() ?? action.weight ?? 0).toFixed(4)),
      timeScale: Number((action.getEffectiveTimeScale?.() ?? action.timeScale ?? 0).toFixed(4)),
      time: Number((action.time ?? 0).toFixed(4)),
    } : null
    renderLoopSamples.push({
      tick: renderLoopTick += 1,
      atMs: Math.round(performance.now()),
      delta: Number((delta || 0).toFixed(6)),
      mixerUpdated: !!mixerUpdated,
      vrmUpdated: !!vrmUpdated,
      animationProofActive: !!animationProofActive,
      currentMood,
      currentMouthOpen: Number((currentMouthOpen || 0).toFixed(4)),
      targetMouthOpen: Number((targetMouthOpen || 0).toFixed(4)),
      targetMouthViseme,
      currentAvatarFormat: currentVrm ? 'VRM' : (currentGenericScene ? 'GLB/glTF' : 'none'),
      actionState,
    })
    if (renderLoopSamples.length > 180) renderLoopSamples.splice(0, renderLoopSamples.length - 180)
  }

  const disposeCurrentAvatar = () => {
    stopAnimationPlayback()
    if (currentAvatarScene) {
      scene.remove(currentAvatarScene)
      VRMUtils.deepDispose(currentAvatarScene)
    }
    currentVrm = null
    currentAvatarScene = null
    currentGenericScene = null
    currentAvatarDiagnostics = null
    currentAnimationClips = []
    currentVrmBasePosition.set(0, BASE_Y, 0)
    currentVrmBaseScale = 1
    currentVrmBaseYaw = 0
    resetArmRig('not-run')
    bodyPartRig = { bones: [], availableParts: [] }
    bodyPartMotionState.active = false
    bodyPartMotionState.snapshot = { active: false, mode: 'not-run', availableParts: [], animatedPartCount: 0, durationMs: 0, peakDegrees: {}, rootMotionGuard: 'root-transform-stays-fixed' }
  }

  const frameSceneForPreview = (object3d) => {
    object3d.position.set(0, BASE_Y, 0)
    object3d.rotation.set(0, 0, 0)
    object3d.scale.setScalar(1)
    const box = new THREE.Box3().setFromObject(object3d)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    if (Number.isFinite(size.length()) && size.length() > 0) {
      const maxAxis = Math.max(size.x, size.y, size.z)
      const scale = clamp(1.65 / maxAxis, 0.15, 3.2)
      object3d.scale.setScalar(scale)
      object3d.position.x = -center.x * scale
      object3d.position.z = -center.z * scale
      object3d.position.y = BASE_Y - box.min.y * scale
    }
  }

  const frameCameraForPreview = (object3d) => {
    const box = new THREE.Box3().setFromObject(object3d)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const fitDistanceForVerticalSpan = (span, fill = 0.72, min = 0.9, max = 3.2) => {
      // Three.js portrait framing: distance is driven by the vertical span we want visible,
      // not by full-model width. This avoids T-pose arm span and skirt/thigh bounds dragging
      // Sketchfab characters into a thigh-only crop.
      const safeSpan = Math.max(0.22, span)
      const fovRad = THREE.MathUtils.degToRad(camera.fov)
      return clamp((safeSpan * 0.5) / (Math.tan(fovRad * 0.5) * fill) + size.z * 0.28, min, max)
    }
    if (Number.isFinite(size.length()) && size.length() > 0) {
      // Lock the creator preview to a portrait / upper-body framing.
      // VRM mesh bounds can sit around the skirt/thigh mesh while humanoid bones
      // are much higher, so VRMs are framed from real humanoid bones first.
      const humanoid = currentVrm?.humanoid
      const getBoneWorld = (boneName) => {
        const node = humanoid?.getNormalizedBoneNode?.(boneName)
        if (!node) return null
        const world = new THREE.Vector3()
        node.getWorldPosition(world)
        return world
      }
      const head = getBoneWorld(VRMHumanBoneName.Head)
      const neck = getBoneWorld(VRMHumanBoneName.Neck)
      const leftEye = getBoneWorld(VRMHumanBoneName.LeftEye)
      const rightEye = getBoneWorld(VRMHumanBoneName.RightEye)
      const chest = getBoneWorld(VRMHumanBoneName.Chest) || getBoneWorld(VRMHumanBoneName.UpperChest) || getBoneWorld(VRMHumanBoneName.Spine)
      const hips = getBoneWorld(VRMHumanBoneName.Hips)
      const leftFoot = getBoneWorld(VRMHumanBoneName.LeftFoot)
      const rightFoot = getBoneWorld(VRMHumanBoneName.RightFoot)
      if (head && (chest || hips)) {
        const torso = chest || hips
        const feet = [leftFoot, rightFoot].filter(Boolean)
        const footY = feet.length ? Math.min(...feet.map((foot) => foot.y)) : box.min.y
        const bodyHeight = Math.max(0.8, head.y - footY)
        const eyePoints = [leftEye, rightEye].filter(Boolean)
        const eyeCenter = eyePoints.length
          ? eyePoints.reduce((acc, point) => acc.add(point), new THREE.Vector3()).multiplyScalar(1 / eyePoints.length)
          : null
        // User-facing portrait framing: anchor the camera to the actual face/head bones,
        // not the full mesh bounds. Bounds on VRMs often include skirt/legs and drag the
        // camera toward thighs. Eyes/head define the target; chest only informs zoom.
        const faceAnchor = eyeCenter || head
        const neckAnchor = neck || torso
        const focusX = faceAnchor.x * 0.78 + neckAnchor.x * 0.22
        const focusY = faceAnchor.y * 0.82 + neckAnchor.y * 0.18
        const focusZ = faceAnchor.z * 0.78 + neckAnchor.z * 0.22
        const headToChest = Math.max(0.28, Math.abs(head.y - torso.y))
        const portraitTop = head.y + headToChest * 0.32
        const portraitBottom = torso.y - headToChest * 0.38
        const portraitSpan = Math.max(0.42, portraitTop - portraitBottom)
        const portraitCenterY = (portraitTop + portraitBottom) * 0.5
        const distance = fitDistanceForVerticalSpan(portraitSpan, 0.74, 1.05, 2.35)
        previewLookAt.set(focusX, portraitCenterY * 0.86 + focusY * 0.14, focusZ)
        camera.position.set(focusX, previewLookAt.y + bodyHeight * 0.01, focusZ + distance)
      } else {
        const bones = currentAvatarDiagnostics?.raw?.bones || []
        const boneWorldEntries = bones
          .map((bone) => {
            const world = new THREE.Vector3()
            bone.getWorldPosition(world)
            const token = normalizeBoneToken(bone.name || '')
            return { bone, world, token, name: String(bone.name || '') }
          })
          .filter((entry) => Number.isFinite(entry.world.y) && !/(finger|thumb|toe|weapon|sword|skirt|cloth|cape|coat|hair|twintail|pony|accessory)/i.test(entry.name))
        const named = (rules, tokens = []) => bones.find((bone) => {
          const name = String(bone.name || '')
          const token = normalizeBoneToken(name)
          return rules.some((rule) => rule.test(name)) || tokens.some((part) => token.includes(part))
        }) || null
        const upperNamedBone = boneWorldEntries
          .filter((entry) => entry.world.y > box.min.y + size.y * 0.55)
          .sort((a, b) => b.world.y - a.world.y)[0]?.bone || null
        const genericHead = named([/(^|[^a-z])head([^a-z]|$)/i, /face/i], ['head', 'face']) || upperNamedBone
        const genericNeck = named([/(^|[^a-z])neck([^a-z]|$)/i], ['neck'])
        const genericChest = named([/upper.?chest/i, /chest/i, /spine2/i, /spine_?02/i, /spine/i], ['upperchest', 'chest', 'spine2', 'spine02', 'spine'])
        const genericHips = named([/(^|[^a-z])hips?([^a-z]|$)/i, /pelvis/i], ['hips', 'hip', 'pelvis'])
        if (genericHead && (genericNeck || genericChest || genericHips)) {
          const worldOf = (node) => {
            const v = new THREE.Vector3()
            node.getWorldPosition(v)
            return v
          }
          const faceAnchor = worldOf(genericHead)
          const supportAnchor = worldOf(genericNeck || genericChest || genericHips)
          const torsoAnchor = worldOf(genericChest || genericHips || genericNeck)
          // Generic Sketchfab rigs frequently arrive in a T-pose, so full width is dominated by
          // outstretched arms. Bias the portrait crop toward face/eyes/chest instead of the full
          // body box so the camera lands on a head+upper-torso composition rather than thighs.
          const focusX = faceAnchor.x * 0.92 + supportAnchor.x * 0.08
          const focusZ = faceAnchor.z * 0.88 + supportAnchor.z * 0.12
          const headToTorso = Math.max(0.24, Math.abs(faceAnchor.y - torsoAnchor.y))
          const portraitTop = Math.min(box.max.y, faceAnchor.y + headToTorso * 0.18)
          const portraitBottom = Math.max(box.min.y + size.y * 0.52, torsoAnchor.y - headToTorso * 0.14)
          const portraitSpan = Math.max(0.34, portraitTop - portraitBottom)
          const focusY = faceAnchor.y * 0.7 + torsoAnchor.y * 0.3
          const distance = fitDistanceForVerticalSpan(portraitSpan, 0.86, 0.92, 1.45)
          previewLookAt.set(focusX, focusY, focusZ)
          camera.position.set(focusX, focusY + Math.max(0.004, portraitSpan * 0.012), focusZ + distance)
        } else {
          // Last-resort portrait crop for unclassified uploaded models: make a virtual portrait
          // rectangle from the top of the model to roughly the waist/chest area. The previous
          // target-at-92%-height + close-distance approach could cut off the head and leave only
          // skirt/thighs visible on Sketchfab characters.
          const portraitTop = box.max.y
          const portraitBottom = box.min.y + size.y * 0.48
          const portraitSpan = Math.max(0.5, portraitTop - portraitBottom)
          const focusY = (portraitTop + portraitBottom) * 0.5
          const distance = fitDistanceForVerticalSpan(portraitSpan, 0.68, 1.15, 3.0)
          previewLookAt.set(center.x, focusY, center.z)
          camera.position.set(center.x, focusY + size.y * 0.006, center.z + distance)
        }
      }
    } else {
      previewLookAt.set(0, 1.38, 0)
      camera.position.set(0, 1.42, 2.8)
    }
    camera.lookAt(previewLookAt)
  }

  const nodeLooksLikeRoot = (node) => {
    if (!node) return true
    const raw = String(node.name || '').trim().toLowerCase()
    return node === currentAvatarScene
      || node === currentGenericScene
      || raw === ''
      || raw === 'root'
      || raw === 'scene'
      || raw === 'armature'
  }

  const reverseMorphName = (mesh, propertyIndex) => {
    const dictionary = mesh?.morphTargetDictionary || {}
    const numericIndex = Number(propertyIndex)
    return Object.entries(dictionary).find(([, index]) => Number(index) == numericIndex)?.[0] || String(propertyIndex)
  }

  const safeParseTrackName = (trackName) => {
    try {
      return THREE.PropertyBinding.parseTrackName(trackName)
    } catch {
      return null
    }
  }

  const resolveTrackBinding = (clip, track, clipIndex, trackIndex) => {
    const parsed = safeParseTrackName(track.name)
    const root = currentAvatarScene
    const node = parsed?.nodeName ? THREE.PropertyBinding.findNode(root, parsed.nodeName) : root
    const propertyName = parsed?.propertyName || null
    const propertyIndex = parsed?.propertyIndex ?? null
    const targetKind = node?.isBone
      ? 'bone'
      : node?.isSkinnedMesh
        ? 'skinnedMesh'
        : node?.isMesh
          ? 'mesh'
          : node?.type || 'unknown'
    const morphName = propertyName === 'morphTargetInfluences' ? reverseMorphName(node, propertyIndex) : null
    return {
      clipIndex,
      clipName: clip.name || `(unnamed clip ${clipIndex})`,
      clipDuration: Number((clip.duration || 0).toFixed(4)),
      trackIndex,
      trackName: track.name,
      valueType: track.ValueTypeName || track.constructor?.name || 'unknown',
      parsedNodeName: parsed?.nodeName || null,
      parsedObjectName: parsed?.objectName || null,
      propertyName,
      propertyIndex,
      resolvedNodeName: node?.name || null,
      targetKind,
      isRootLike: nodeLooksLikeRoot(node),
      morphName,
      track,
      node,
    }
  }

  const inspectAnimationBindings = () => {
    if (!currentAvatarScene) throw new Error('No avatar scene loaded')
    return currentAnimationClips.map((clip, clipIndex) => ({
      clipIndex,
      clipName: clip.name || `(unnamed clip ${clipIndex})`,
      duration: Number((clip.duration || 0).toFixed(4)),
      trackCount: clip.tracks.length,
      tracks: clip.tracks.map((track, trackIndex) => {
        const resolved = resolveTrackBinding(clip, track, clipIndex, trackIndex)
        return {
          clipIndex: resolved.clipIndex,
          clipName: resolved.clipName,
          clipDuration: resolved.clipDuration,
          trackIndex: resolved.trackIndex,
          trackName: resolved.trackName,
          valueType: resolved.valueType,
          parsedNodeName: resolved.parsedNodeName,
          parsedObjectName: resolved.parsedObjectName,
          propertyName: resolved.propertyName,
          propertyIndex: resolved.propertyIndex,
          resolvedNodeName: resolved.resolvedNodeName,
          targetKind: resolved.targetKind,
          isRootLike: resolved.isRootLike,
          morphName: resolved.morphName,
        }
      }),
    }))
  }

  const projectWorldToScreen = (worldPosition) => {
    const projected = worldPosition.clone().project(camera)
    return {
      x: Number((((projected.x + 1) / 2) * renderer.domElement.width).toFixed(2)),
      y: Number((((1 - projected.y) / 2) * renderer.domElement.height).toFixed(2)),
      ndcZ: Number(projected.z.toFixed(4)),
    }
  }

  const samplePixelProbe = (screen, radius = 6) => {
    const gl = renderer.getContext()
    const width = renderer.domElement.width
    const height = renderer.domElement.height
    const centerX = clamp(Math.round(screen.x), 0, width - 1)
    const centerY = clamp(Math.round(screen.y), 0, height - 1)
    const left = clamp(centerX - radius, 0, width - 1)
    const top = clamp(centerY - radius, 0, height - 1)
    const sampleWidth = Math.max(1, Math.min(width - left, radius * 2 + 1))
    const sampleHeight = Math.max(1, Math.min(height - top, radius * 2 + 1))
    const readY = Math.max(0, height - top - sampleHeight)
    const pixels = new Uint8Array(sampleWidth * sampleHeight * 4)
    gl.readPixels(left, readY, sampleWidth, sampleHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let lumaSum = 0
    let alphaSum = 0
    let rgbaSum = 0
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      const a = pixels[i + 3]
      rgbaSum += r + g + b + a
      lumaSum += r * 0.2126 + g * 0.7152 + b * 0.0722
      alphaSum += a
    }
    return {
      centerX,
      centerY,
      width: sampleWidth,
      height: sampleHeight,
      rgbaSum: Number(rgbaSum.toFixed(2)),
      lumaSum: Number(lumaSum.toFixed(2)),
      alphaSum: Number(alphaSum.toFixed(2)),
    }
  }

  const pixelProbeDelta = (before, after) => ({
    rgbaDelta: Number((after.rgbaSum - before.rgbaSum).toFixed(2)),
    lumaDelta: Number((after.lumaSum - before.lumaSum).toFixed(2)),
    alphaDelta: Number((after.alphaSum - before.alphaSum).toFixed(2)),
  })


  const chooseStrongestMorphVertex = (mesh, index) => {
    const position = mesh.geometry?.attributes?.position
    const morph = mesh.geometry?.morphAttributes?.position?.[Number(index)]
    if (!position || !morph) return null
    const ranked = []
    for (let i = 0; i < position.count; i += 1) {
      const dx = morph.getX(i)
      const dy = morph.getY(i)
      const dz = morph.getZ(i)
      const magnitude = Math.hypot(dx, dy, dz)
      if (magnitude <= 0) continue
      ranked.push({
        vertexIndex: i,
        morphDeltaLocal: [Number(dx.toFixed(6)), Number(dy.toFixed(6)), Number(dz.toFixed(6))],
        magnitude: Number(magnitude.toFixed(6)),
      })
    }
    ranked.sort((a, b) => b.magnitude - a.magnitude)
    const top = ranked.slice(0, 80)
    let bestVisible = null
    for (const candidate of top) {
      const state = sampleSkinnedVertexState(mesh, candidate.vertexIndex)
      const alpha = state.pixelProbe?.alphaSum || 0
      const visibleScore = alpha > 0 ? alpha + candidate.magnitude * 1000 : candidate.magnitude
      const enriched = { ...candidate, beforePixelAlpha: alpha, beforeScreen: state.screen, beforeWorldPosition: state.worldPosition, beforeLocalPosition: state.localPosition, visibleScore: Number(visibleScore.toFixed(6)) }
      if (!bestVisible || enriched.visibleScore > bestVisible.visibleScore) bestVisible = enriched
    }
    return bestVisible || ranked[0] || null
  }

  const estimateBoneTipLocal = (bone) => {
    const childPositions = bone.children
      .filter((child) => child?.position && child.position.lengthSq() > 1e-6)
      .map((child) => child.position.clone())
      .sort((a, b) => b.lengthSq() - a.lengthSq())
    if (childPositions.length) return childPositions[0]
    if (bone.parent?.isBone && bone.position.lengthSq() > 1e-6) {
      return bone.position.clone().normalize().multiplyScalar(Math.max(0.08, bone.position.length() * 0.65))
    }
    return new THREE.Vector3(0, 0.18, 0)
  }


  const chooseTransformProbe = (node) => {
    const originLocal = new THREE.Vector3(0, 0, 0)
    const fallbackTip = node.isBone ? estimateBoneTipLocal(node) : originLocal.clone()
    const inverse = node.matrixWorld.clone().invert()
    let best = {
      label: node.isBone ? `${node.name || '(unnamed)'}:tip` : `${node.name || '(unnamed)'}:origin`,
      localPoint: fallbackTip.clone(),
      distance: fallbackTip.length(),
      source: node.isBone ? 'bone-tip' : 'origin',
    }

    node.traverse((child) => {
      if (!child || child === node) return
      if (child.isBone) {
        const world = child.getWorldPosition(new THREE.Vector3())
        const local = world.clone().applyMatrix4(inverse)
        const distance = local.length()
        if (distance > best.distance) {
          best = {
            label: `${child.name || '(unnamed bone)'}:origin`,
            localPoint: local,
            distance,
            source: 'descendant-bone-origin',
          }
        }
        const tip = child.localToWorld(estimateBoneTipLocal(child).clone()).applyMatrix4(inverse)
        const tipDistance = tip.length()
        if (tipDistance > best.distance) {
          best = {
            label: `${child.name || '(unnamed bone)'}:tip`,
            localPoint: tip,
            distance: tipDistance,
            source: 'descendant-bone-tip',
          }
        }
      } else if (child.isMesh) {
        const sphere = child.geometry?.boundingSphere || (child.geometry?.computeBoundingSphere?.(), child.geometry?.boundingSphere)
        if (sphere?.center) {
          const world = child.localToWorld(sphere.center.clone())
          const local = world.clone().applyMatrix4(inverse)
          const distance = local.length()
          if (distance > best.distance) {
            best = {
              label: `${child.name || '(unnamed mesh)'}:surface-center`,
              localPoint: local,
              distance,
              source: 'descendant-mesh-center',
            }
          }
        }
      }
    })

    return best
  }

  const chooseMorphProbe = (mesh, index) => {
    const position = mesh.geometry?.attributes?.position
    const morph = mesh.geometry?.morphAttributes?.position?.[Number(index)]
    if (!position || !morph) {
      const sphere = mesh.geometry?.boundingSphere || (mesh.geometry?.computeBoundingSphere?.(), mesh.geometry?.boundingSphere)
      const localPoint = sphere?.center?.clone?.() || new THREE.Vector3()
      return {
        label: `${mesh.name || '(unnamed mesh)'}:center`,
        localPoint,
        displacement: 0,
        source: 'bounding-sphere-center',
      }
    }
    const relative = !!mesh.geometry.morphTargetsRelative
    let bestIndex = 0
    let bestMagnitudeSq = -1
    for (let i = 0; i < position.count; i += 1) {
      const dx = morph.getX(i)
      const dy = morph.getY(i)
      const dz = morph.getZ(i)
      const magSq = dx * dx + dy * dy + dz * dz
      if (magSq > bestMagnitudeSq) {
        bestMagnitudeSq = magSq
        bestIndex = i
      }
    }
    const base = new THREE.Vector3(position.getX(bestIndex), position.getY(bestIndex), position.getZ(bestIndex))
    const disp = new THREE.Vector3(morph.getX(bestIndex), morph.getY(bestIndex), morph.getZ(bestIndex))
    const localPoint = relative ? base.clone().add(disp) : disp.clone()
    return {
      label: `${mesh.name || '(unnamed mesh)'}:vertex-${bestIndex}`,
      localPoint,
      displacement: Number(Math.sqrt(Math.max(bestMagnitudeSq, 0)).toFixed(6)),
      source: 'morph-vertex-max-displacement',
      vertexIndex: bestIndex,
      basePosition: base.toArray().map((value) => Number(value.toFixed(4))),
      morphDisplacement: disp.toArray().map((value) => Number(value.toFixed(4))),
    }
  }

  const buildAnimationSampleTimes = (clip, binding, proofDuration, options = {}) => {
    const times = new Set([0, proofDuration])
    const trackTimes = Array.from(binding.track?.times || [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= proofDuration)
      .sort((a, b) => a - b)
    trackTimes.forEach((value) => times.add(Number(value.toFixed(4))))
    for (let i = 0; i < trackTimes.length - 1; i += 1) {
      const mid = (trackTimes[i] + trackTimes[i + 1]) / 2
      times.add(Number(mid.toFixed(4)))
    }
    const uniformSteps = Math.max(6, Math.min(48, options.stepCount ?? 18))
    for (let step = 1; step <= uniformSteps; step += 1) {
      const sampleTime = proofDuration * (step / uniformSteps)
      times.add(Number(sampleTime.toFixed(4)))
    }
    return [...times]
      .filter((value) => value >= 0 && value <= proofDuration)
      .sort((a, b) => a - b)
  }

  const collectDominantSkinVertices = (skinnedMesh, targetBoneNames, limit = 20, minInfluenceScore = 0.25) => {
    const skinIndex = skinnedMesh.geometry?.attributes?.skinIndex
    const skinWeight = skinnedMesh.geometry?.attributes?.skinWeight
    if (!skinIndex || !skinWeight || !skinnedMesh.skeleton) return []

    const wanted = new Set(targetBoneNames.filter(Boolean))
    const idx = new THREE.Vector4()
    const wt = new THREE.Vector4()
    const rows = []

    for (let i = 0; i < skinIndex.count; i += 1) {
      idx.fromBufferAttribute(skinIndex, i)
      wt.fromBufferAttribute(skinWeight, i)
      let influenceScore = 0
      const components = []
      for (let c = 0; c < 4; c += 1) {
        const boneIndex = idx.getComponent(c)
        const weight = wt.getComponent(c)
        const bone = skinnedMesh.skeleton.bones[boneIndex]
        if (bone && wanted.has(bone.name || '')) influenceScore += weight
        if (bone && weight > 0) {
          components.push({ boneName: bone.name || `(bone-${boneIndex})`, weight: Number(weight.toFixed(4)) })
        }
      }
      if (influenceScore >= minInfluenceScore) {
        rows.push({
          vertexIndex: i,
          influenceScore: Number(influenceScore.toFixed(4)),
          components: components.sort((a, b) => b.weight - a.weight),
        })
      }
    }

    return rows.sort((a, b) => b.influenceScore - a.influenceScore).slice(0, limit)
  }

  const sampleSkinnedVertexState = (skinnedMesh, vertexIndex) => {
    const local = skinnedMesh.getVertexPosition(vertexIndex, new THREE.Vector3())
    const world = local.clone().applyMatrix4(skinnedMesh.matrixWorld)
    const screen = projectWorldToScreen(world)
    return {
      vertexIndex,
      localPosition: local.toArray().map((value) => Number(value.toFixed(6))),
      worldPosition: world.toArray().map((value) => Number(value.toFixed(6))),
      screen,
      pixelProbe: samplePixelProbe(screen),
    }
  }

  const sampleManualMorphVertexState = (mesh, vertexIndex, morphIndex, influenceOverride) => {
    const geometry = mesh.geometry
    const position = geometry?.attributes?.position
    if (!position) return null
    const target = new THREE.Vector3().fromBufferAttribute(position, vertexIndex)
    const morphPosition = geometry?.morphAttributes?.position
    const morphTargetsRelative = !!geometry?.morphTargetsRelative
    const influences = mesh.morphTargetInfluences || []
    if (morphPosition && Number.isInteger(morphIndex) && morphPosition[morphIndex]) {
      const influence = influenceOverride ?? Number(influences[morphIndex] || 0)
      const morphValue = new THREE.Vector3().fromBufferAttribute(morphPosition[morphIndex], vertexIndex)
      if (morphTargetsRelative) {
        target.addScaledVector(morphValue, influence)
      } else {
        target.addScaledVector(morphValue.sub(target.clone()), influence)
      }
    }
    if (mesh.isSkinnedMesh && mesh.skeleton?.bones?.length) {
      const skinIndex = geometry.attributes.skinIndex
      const skinWeight = geometry.attributes.skinWeight
      if (skinIndex && skinWeight) {
        const indices = new THREE.Vector4().fromBufferAttribute(skinIndex, vertexIndex)
        const weights = new THREE.Vector4().fromBufferAttribute(skinWeight, vertexIndex)
        const basePosition = target.clone().applyMatrix4(mesh.bindMatrix)
        const accum = new THREE.Vector3(0, 0, 0)
        const temp = new THREE.Vector3()
        const mat = new THREE.Matrix4()
        for (let i = 0; i < 4; i += 1) {
          const weight = weights.getComponent(i)
          if (!weight) continue
          const boneIndex = indices.getComponent(i)
          const bone = mesh.skeleton.bones[boneIndex]
          const inv = mesh.skeleton.boneInverses[boneIndex]
          if (!bone || !inv) continue
          mat.multiplyMatrices(bone.matrixWorld, inv)
          accum.addScaledVector(temp.copy(basePosition).applyMatrix4(mat), weight)
        }
        target.copy(accum.applyMatrix4(mesh.bindMatrixInverse))
      }
    }
    const world = target.clone().applyMatrix4(mesh.matrixWorld)
    const screen = projectWorldToScreen(world)
    return {
      vertexIndex,
      localPosition: target.toArray().map((value) => Number(value.toFixed(6))),
      worldPosition: world.toArray().map((value) => Number(value.toFixed(6))),
      screen,
      pixelProbe: samplePixelProbe(screen),
    }
  }

  const sampleMaxDisplacementVertex = (mesh, beforePositions, step = 1) => {
    const position = mesh.geometry?.attributes?.position
    if (!position) return null
    let best = null
    for (let i = 0; i < position.count; i += step) {
      const before = beforePositions[i]
      if (!before) continue
      const after = sampleSkinnedVertexState(mesh, i)
      const worldDelta = new THREE.Vector3(...before.worldPosition).distanceTo(new THREE.Vector3(...after.worldPosition))
      const pixelDelta = pixelProbeDelta(before.pixelProbe, after.pixelProbe)
      const visibleBoost = ((after.pixelProbe?.alphaSum || 0) > 0 || (before.pixelProbe?.alphaSum || 0) > 0) ? 500 : 0
      const score = worldDelta * 1000 + Math.hypot((after.screen.x - before.screen.x), (after.screen.y - before.screen.y)) * 4 + Math.abs(pixelDelta.rgbaDelta) * 0.03 + Math.abs(pixelDelta.lumaDelta) * 0.03 + visibleBoost
      if (!best || score > best.score) {
        best = { vertexIndex: i, before, after, worldDelta: Number(worldDelta.toFixed(6)), pixelDelta, score }
      }
    }
    return best
  }

  const collectMeshVertexSnapshots = (mesh, step = 1) => {
    const position = mesh.geometry?.attributes?.position
    if (!position) return []
    const rows = []
    for (let i = 0; i < position.count; i += step) {
      rows[i] = sampleSkinnedVertexState(mesh, i)
    }
    return rows
  }

  const summarizeSkinnedVertexDelta = (before, after) => ({
    beforeWorldPosition: before.worldPosition,
    afterWorldPosition: after.worldPosition,
    beforeLocalPosition: before.localPosition,
    afterLocalPosition: after.localPosition,
    localDelta: Number(new THREE.Vector3(...before.localPosition).distanceTo(new THREE.Vector3(...after.localPosition)).toFixed(6)),
    worldDelta: Number(new THREE.Vector3(...before.worldPosition).distanceTo(new THREE.Vector3(...after.worldPosition)).toFixed(6)),
    beforeScreen: before.screen,
    afterScreen: after.screen,
    screenDeltaPx: {
      x: Number((after.screen.x - before.screen.x).toFixed(2)),
      y: Number((after.screen.y - before.screen.y).toFixed(2)),
    },
    pixelProbeBefore: before.pixelProbe,
    pixelProbeAfter: after.pixelProbe,
    pixelProbeDelta: pixelProbeDelta(before.pixelProbe, after.pixelProbe),
  })

  const collectSkinnedSurfaceCandidates = (binding, options = {}) => {
    if (!binding.node?.isBone) return []
    const targetBoneNames = new Set([binding.resolvedNodeName || binding.node.name || null].filter(Boolean))
    binding.node.traverse((child) => {
      if (child?.isBone && child.name) targetBoneNames.add(child.name)
    })

    const results = []
    currentAvatarScene?.traverse?.((node) => {
      if (!node?.isSkinnedMesh || !node.skeleton?.bones?.length) return
      const meshBoneNames = new Set(node.skeleton.bones.map((bone) => bone?.name).filter(Boolean))
      const overlap = [...targetBoneNames].filter((name) => meshBoneNames.has(name))
      if (!overlap.length) return
      const vertices = collectDominantSkinVertices(node, overlap, options.maxVerticesPerMesh ?? 8, options.minInfluenceScore ?? 0.25)
      vertices.forEach((vertex) => {
        results.push({
          mesh: node,
          meshName: node.name || node.uuid,
          targetBoneNames: overlap,
          vertexIndex: vertex.vertexIndex,
          influenceScore: vertex.influenceScore,
          vertexComponents: vertex.components,
        })
      })
    })

    return results.sort((a, b) => b.influenceScore - a.influenceScore)
  }

  const sampleBoneDeltaDegrees = (binding, beforeState, afterState) => {
    if (binding.propertyName !== 'quaternion') return 0
    const beforeQuat = new THREE.Quaternion(...beforeState.quaternion)
    const afterQuat = new THREE.Quaternion(...afterState.quaternion)
    return Number(THREE.MathUtils.radToDeg(beforeQuat.angleTo(afterQuat)).toFixed(4))
  }

  const scoreSurfaceProof = (surfaceSummary, quaternionAngleDeltaDeg = 0, influenceDelta = 0) => {
    const screen = Math.hypot(surfaceSummary.screenDeltaPx?.x || 0, surfaceSummary.screenDeltaPx?.y || 0)
    const pixel = Math.abs(surfaceSummary.pixelProbeDelta?.rgbaDelta || 0) + Math.abs(surfaceSummary.pixelProbeDelta?.lumaDelta || 0)
    return (surfaceSummary.worldDelta || 0) * 1000 + screen * 4 + pixel * 0.03 + Math.abs(quaternionAngleDeltaDeg || 0) + Math.abs(influenceDelta || 0) * 50
  }

  const sampleBoneMotionState = (bone, localTip) => {
    const pivotWorld = bone.getWorldPosition(new THREE.Vector3())
    const tipWorld = bone.localToWorld(localTip.clone())
    const pivotScreen = projectWorldToScreen(pivotWorld)
    const tipScreen = projectWorldToScreen(tipWorld)
    return {
      boneName: bone.name || '(unnamed bone)',
      quaternion: bone.quaternion.toArray().map((value) => Number(value.toFixed(4))),
      worldPosition: pivotWorld.toArray().map((value) => Number(value.toFixed(4))),
      tipWorldPosition: tipWorld.toArray().map((value) => Number(value.toFixed(4))),
      pivotScreen,
      tipScreen,
      tipPixelProbe: samplePixelProbe(tipScreen),
      worldAxes: worldAxesForBone(bone),
    }
  }


  const findHipsNode = () => {
    if (currentVrm?.humanoid?.getNormalizedBoneNode) {
      return currentVrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Hips) || null
    }
    if (!currentAvatarScene?.traverse) return null
    let match = null
    currentAvatarScene.traverse((node) => {
      if (match || !node?.isBone) return
      const name = String(node.name || '')
      if (/(^|[_.:\-])(hips?|pelvis)([_.:\-]|$)/i.test(name)) match = node
    })
    return match
  }

  const sampleNodeTransformState = (node) => {
    if (!node) return null
    const worldPosition = node.getWorldPosition(new THREE.Vector3())
    const worldQuaternion = node.getWorldQuaternion(new THREE.Quaternion())
    const screen = projectWorldToScreen(worldPosition)
    return {
      name: node.name || '(unnamed node)',
      worldPosition: worldPosition.toArray().map((value) => Number(value.toFixed(6))),
      worldQuaternion: worldQuaternion.toArray().map((value) => Number(value.toFixed(6))),
      screen,
      pixelProbe: samplePixelProbe(screen),
    }
  }

  const summarizeBoneMotionDelta = (before, after) => {
    const beforeQuat = new THREE.Quaternion(...before.quaternion)
    const afterQuat = new THREE.Quaternion(...after.quaternion)
    const worldDistanceDelta = new THREE.Vector3(...before.worldPosition).distanceTo(new THREE.Vector3(...after.worldPosition))
    const tipWorldDistanceDelta = new THREE.Vector3(...before.tipWorldPosition).distanceTo(new THREE.Vector3(...after.tipWorldPosition))
    return {
      proofType: 'generic-arm-bone',
      beforeQuaternion: before.quaternion,
      afterQuaternion: after.quaternion,
      quaternionAngleDeltaDeg: Number(THREE.MathUtils.radToDeg(beforeQuat.angleTo(afterQuat)).toFixed(4)),
      beforeWorldPosition: before.worldPosition,
      afterWorldPosition: after.worldPosition,
      worldDistanceDelta: Number(worldDistanceDelta.toFixed(4)),
      beforeTipWorldPosition: before.tipWorldPosition,
      afterTipWorldPosition: after.tipWorldPosition,
      tipWorldDistanceDelta: Number(tipWorldDistanceDelta.toFixed(4)),
      beforePivotScreen: before.pivotScreen,
      afterPivotScreen: after.pivotScreen,
      pivotScreenDeltaPx: {
        x: Number((after.pivotScreen.x - before.pivotScreen.x).toFixed(2)),
        y: Number((after.pivotScreen.y - before.pivotScreen.y).toFixed(2)),
      },
      beforeTipScreen: before.tipScreen,
      afterTipScreen: after.tipScreen,
      tipScreenDeltaPx: {
        x: Number((after.tipScreen.x - before.tipScreen.x).toFixed(2)),
        y: Number((after.tipScreen.y - before.tipScreen.y).toFixed(2)),
      },
      beforeTipPixelProbe: before.tipPixelProbe,
      afterTipPixelProbe: after.tipPixelProbe,
      tipPixelProbeDelta: pixelProbeDelta(before.tipPixelProbe, after.tipPixelProbe),
      beforeWorldAxes: before.worldAxes,
      afterWorldAxes: after.worldAxes,
    }
  }

  const sampleBindingState = (binding) => {
    const node = binding.node
    if (!node) throw new Error(`Track binding target could not be resolved: ${binding.trackName}`)

    if (binding.propertyName === 'morphTargetInfluences') {
      const mesh = node
      const index = Number(binding.propertyIndex)
      const influence = Number(mesh.morphTargetInfluences?.[index] || 0)
      const probe = chooseMorphProbe(mesh, index)
      const worldPoint = mesh.localToWorld(probe.localPoint.clone())
      const screen = projectWorldToScreen(worldPoint)
      return {
        mode: 'morph',
        influence: Number(influence.toFixed(4)),
        worldPosition: worldPoint.toArray().map((value) => Number(value.toFixed(4))),
        screen,
        pixelProbe: samplePixelProbe(screen),
        probeLabel: probe.label,
        probeSource: probe.source,
        probeLocalPoint: probe.localPoint.toArray().map((value) => Number(value.toFixed(4))),
        probeVertexIndex: probe.vertexIndex ?? null,
        probeDisplacement: probe.displacement ?? 0,
        probeBasePosition: probe.basePosition ?? null,
        probeMorphDisplacement: probe.morphDisplacement ?? null,
      }
    }

    const worldPosition = node.getWorldPosition(new THREE.Vector3())
    const screen = projectWorldToScreen(worldPosition)
    const probe = chooseTransformProbe(node)
    const probeWorld = node.localToWorld(probe.localPoint.clone())
    const probeScreen = projectWorldToScreen(probeWorld)
    return {
      mode: 'transform',
      quaternion: node.quaternion.toArray().map((value) => Number(value.toFixed(4))),
      localPosition: node.position.toArray().map((value) => Number(value.toFixed(4))),
      localScale: node.scale.toArray().map((value) => Number(value.toFixed(4))),
      worldPosition: worldPosition.toArray().map((value) => Number(value.toFixed(4))),
      screen,
      pixelProbe: samplePixelProbe(screen),
      probeLabel: probe.label,
      probeSource: probe.source,
      probeLocalPoint: probe.localPoint.toArray().map((value) => Number(value.toFixed(4))),
      probeWorldPosition: probeWorld.toArray().map((value) => Number(value.toFixed(4))),
      probeScreen,
      probePixelProbe: samplePixelProbe(probeScreen),
      worldAxes: node.isBone ? worldAxesForBone(node) : null,
    }
  }

  const scoreBindingDelta = (binding, before, after) => {
    if (binding.propertyName === 'morphTargetInfluences') {
      return Math.abs((after.influence || 0) - (before.influence || 0))
    }

    const beforeQuat = new THREE.Quaternion(...before.quaternion)
    const afterQuat = new THREE.Quaternion(...after.quaternion)
    const beforeWorld = new THREE.Vector3(...before.worldPosition)
    const afterWorld = new THREE.Vector3(...after.worldPosition)
    const beforeProbeWorld = new THREE.Vector3(...(before.probeWorldPosition || before.worldPosition))
    const afterProbeWorld = new THREE.Vector3(...(after.probeWorldPosition || after.worldPosition))
    const screenDx = (after.probeScreen?.x ?? after.screen?.x ?? 0) - (before.probeScreen?.x ?? before.screen?.x ?? 0)
    const screenDy = (after.probeScreen?.y ?? after.screen?.y ?? 0) - (before.probeScreen?.y ?? before.screen?.y ?? 0)
    return THREE.MathUtils.radToDeg(beforeQuat.angleTo(afterQuat))
      + beforeWorld.distanceTo(afterWorld) * 25
      + beforeProbeWorld.distanceTo(afterProbeWorld) * 175
      + Math.hypot(screenDx, screenDy) * 0.35
      + Math.abs((after.probePixelProbe?.rgbaSum || after.pixelProbe?.rgbaSum || 0) - (before.probePixelProbe?.rgbaSum || before.pixelProbe?.rgbaSum || 0)) * 0.001
  }

  const summarizeBindingDelta = (binding, before, after) => {
    if (binding.propertyName === 'morphTargetInfluences') {
      return {
        proofType: 'clip-morph',
        morphName: binding.morphName,
        beforeInfluence: before.influence,
        afterInfluence: after.influence,
        influenceDelta: Number((after.influence - before.influence).toFixed(4)),
        beforeScreen: before.screen,
        afterScreen: after.screen,
        pixelProbeBefore: before.pixelProbe,
        pixelProbeAfter: after.pixelProbe,
        pixelProbeDelta: pixelProbeDelta(before.pixelProbe, after.pixelProbe),
        probeLabel: before.probeLabel || null,
        probeSource: before.probeSource || null,
        probeVertexIndex: before.probeVertexIndex ?? null,
        probeDisplacement: before.probeDisplacement ?? 0,
        probeBasePosition: before.probeBasePosition ?? null,
        probeMorphDisplacement: before.probeMorphDisplacement ?? null,
      }
    }

    const beforeQuat = new THREE.Quaternion(...before.quaternion)
    const afterQuat = new THREE.Quaternion(...after.quaternion)
    const beforeWorld = new THREE.Vector3(...before.worldPosition)
    const afterWorld = new THREE.Vector3(...after.worldPosition)
    const beforeProbeWorld = new THREE.Vector3(...(before.probeWorldPosition || before.worldPosition))
    const afterProbeWorld = new THREE.Vector3(...(after.probeWorldPosition || after.worldPosition))
    return {
      proofType: 'clip-transform',
      beforeQuaternion: before.quaternion,
      afterQuaternion: after.quaternion,
      quaternionAngleDeltaDeg: Number(THREE.MathUtils.radToDeg(beforeQuat.angleTo(afterQuat)).toFixed(4)),
      beforeWorldPosition: before.worldPosition,
      afterWorldPosition: after.worldPosition,
      worldDistanceDelta: Number(beforeWorld.distanceTo(afterWorld).toFixed(4)),
      beforeProbeWorldPosition: before.probeWorldPosition || before.worldPosition,
      afterProbeWorldPosition: after.probeWorldPosition || after.worldPosition,
      probeWorldDistanceDelta: Number(beforeProbeWorld.distanceTo(afterProbeWorld).toFixed(4)),
      beforeScreen: before.screen,
      afterScreen: after.screen,
      screenDeltaPx: {
        x: Number((((after.probeScreen?.x ?? after.screen?.x ?? 0) - (before.probeScreen?.x ?? before.screen?.x ?? 0))).toFixed(2)),
        y: Number((((after.probeScreen?.y ?? after.screen?.y ?? 0) - (before.probeScreen?.y ?? before.screen?.y ?? 0))).toFixed(2)),
      },
      pixelProbeBefore: before.probePixelProbe || before.pixelProbe,
      pixelProbeAfter: after.probePixelProbe || after.pixelProbe,
      pixelProbeDelta: pixelProbeDelta(before.probePixelProbe || before.pixelProbe, after.probePixelProbe || after.pixelProbe),
      beforeWorldAxes: before.worldAxes,
      afterWorldAxes: after.worldAxes,
      probeLabel: before.probeLabel || null,
      probeSource: before.probeSource || null,
      probeLocalPoint: before.probeLocalPoint || null,
    }
  }

  const chooseAnimationProofCandidate = (bindings) => {
    const ordered = bindings.filter((binding) => binding.node && !binding.isRootLike)
    return ordered.find((binding) => binding.propertyName === 'quaternion' && binding.node?.isBone)
      || ordered.find((binding) => binding.propertyName === 'position' && binding.node?.isBone)
      || ordered.find((binding) => binding.propertyName === 'scale' && binding.node?.isBone)
      || ordered.find((binding) => binding.propertyName === 'morphTargetInfluences')
      || null
  }

  const mountVrm = (vrm, fallbackName) => {
    if (!vrm) throw new Error('Loaded asset did not expose a VRM avatar')
    disposeCurrentAvatar()
    proceduralPartPeak = {}
    VRMUtils.rotateVRM0(vrm)
    currentVrm = vrm
    currentAvatarScene = vrm.scene
    currentAnimationClips = []
    currentAvatarDiagnostics = collectAvatarDiagnostics(vrm.scene, [])
    frameSceneForPreview(currentVrm.scene)
    currentVrm.scene.position.y -= 0.42
    currentVrm.scene.rotation.set(0, Math.PI, 0)
    frameCameraForPreview(currentVrm.scene)
    currentVrmBasePosition.copy(currentVrm.scene.position)
    currentVrmBaseScale = currentVrm.scene.scale.x || 1
    currentVrmBaseYaw = currentVrm.scene.rotation.y || 0
    if (gazeTarget) scene.remove(gazeTarget)
    gazeTarget = new THREE.Object3D()
    gazeTarget.position.set(0, 1.45, 0.9)
    scene.add(gazeTarget)
    if (currentVrm.lookAt) currentVrm.lookAt.target = gazeTarget
    armRig = captureArmBones(currentVrm)
    hairRig = captureHairRig(currentVrm.scene, currentVrm.springBoneManager)
    eyeRig = captureEyeRig(currentVrm, currentVrm.scene)
    armMotionState.active = false
    armMotionState.snapshot = {
      active: false,
      availableBoneLabels: armRig.availableBoneLabels,
      animatedBoneCount: armRig.bones.length,
      durationMs: 0,
      mode: 'ready',
      peakDegrees: {},
    }
    applyExpressionState()
    scene.add(currentVrm.scene)
    return summarizeVrm(vrm, fallbackName)
  }

  const mountGenericGltf = (gltf, fallbackName) => {
    if (!gltf?.scene) throw new Error('Loaded glTF/GLB did not include a scene')
    disposeCurrentAvatar()
    proceduralPartPeak = {}
    currentGenericScene = gltf.scene
    currentAvatarScene = gltf.scene
    currentAnimationClips = gltf?.animations || []
    currentAvatarDiagnostics = collectAvatarDiagnostics(gltf.scene, currentAnimationClips)
    frameSceneForPreview(currentGenericScene)
    currentGenericScene.position.y -= 0.42
    frameCameraForPreview(currentGenericScene)
    scene.add(currentGenericScene)
    resetArmRig('generic-gltf-ready')
    bodyPartRig = captureGenericBodyPartRig(currentAvatarDiagnostics)
      hairRig = captureHairRig(currentGenericScene)
    bodyPartMotionState.active = false
    bodyPartMotionState.snapshot = { active: false, mode: bodyPartRig.bones.length ? 'generic-body-parts-ready' : 'generic-body-parts-unavailable', availableParts: bodyPartRig.availableParts, animatedPartCount: bodyPartRig.bones.length, durationMs: 0, peakDegrees: {}, rootMotionGuard: 'root-transform-stays-fixed' }
    return { ...summarizeGltf(gltf, fallbackName), bodyPartCount: bodyPartRig.bones.length, bodyPartNames: bodyPartRig.availableParts }
  }

  const render = () => {
    raf = requestAnimationFrame(render)
    const delta = clock.getDelta()
    motionSeconds += delta
    let mixerUpdated = false
    let vrmUpdated = false
    if (currentAnimationMixer && !animationProofActive) {
      currentAnimationMixer.update(delta)
      mixerUpdated = true
    }
    if (currentVrm) {
      const pose = MOOD_POSES[currentMood] || MOOD_POSES.idle
      const breathe = (Math.sin(motionSeconds * 2.6) + 1) / 2
      // Do not fake speech by bobbling/rotating the whole avatar root.
      // Visible speech now comes from VRM mouth expressions; body root stays planted.
      currentVrm.scene.position.copy(currentVrmBasePosition)
      currentVrm.scene.rotation.set(0, currentVrmBaseYaw, 0)
      currentVrm.scene.scale.setScalar(currentVrmBaseScale)
      if (gazeTarget) {
        const desiredGaze = new THREE.Vector3(Math.sin(motionSeconds * 0.32) * 0.055, 1.42 + Math.sin(motionSeconds * 0.41) * 0.025, 0.9)
        smoothedGazeTarget.lerp(desiredGaze, 1 - Math.exp(-2.8 * delta))
        gazeTarget.position.copy(smoothedGazeTarget)
      }
      applyVrmProceduralBodyMotion()
      applyHairMotion()
      applyEyeBoneMotion()
      applyArmMotion()
      updateSmoothedMouth(delta)
      applyExpressionState()
      applyNonVrmVisemeState()
      currentVrm.update(delta)
      vrmUpdated = true
    } else if (currentGenericScene) {
      updateSmoothedMouth(delta)
      applyNonVrmVisemeState()
      // Do not fake Sketchfab movement by shaking, bobbing, or spinning the entire model root.
      // Body motion proof rotates detected skeleton bones independently and leaves the root planted.
      currentGenericScene.rotation.set(0, 0, 0)
      applyGenericProceduralBodyMotion()
      applyHairMotion()
      applyEyeBoneMotion()
      applyBodyPartMotion()
    }
    recordRenderLoopSample({ delta, mixerUpdated, vrmUpdated })
    renderer.render(scene, camera)
  }

  const resize = () => {
    const width = canvas.clientWidth || 640
    const height = canvas.clientHeight || 360
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    camera.lookAt(previewLookAt)
    renderer.setSize(width, height, false)
  }

  window.addEventListener('resize', resize)
  resize()
  render()

  return {
    async loadFile(file) {
      const kind = inferImportKind(file?.name)
      if (kind === 'unknown' && file?.name?.toLowerCase?.().endsWith('.zip')) {
        throw new Error('Zip uploads are not unpacked in the browser yet. Unzip the Sketchfab download, then use “Choose Sketchfab folder” and select the folder that contains scene.gltf/bin/textures — or upload the .glb file if Sketchfab provided one.')
      }
      if (kind === 'fbx') {
        throw new Error('FBX import is not browser-previewed yet. Export or convert the Sketchfab original to bundled GLB first, then upload that file here.')
      }
      if (kind === 'usdz') {
        throw new Error('USDZ import is not browser-previewed yet. Use the Sketchfab GLB download or convert USDZ to bundled GLB before uploading.')
      }
      if (kind === 'gltf') {
        console.info('AvatarLink glTF note: embedded/single-file glTF can preview; multi-file glTF folders should be exported as GLB for browser upload.')
      }
      if (!['vrm', 'glb', 'gltf', 'unknown'].includes(kind)) {
        throw new Error('Unsupported avatar file. Try .vrm, bundled .glb, or embedded .gltf for direct preview; convert .fbx/.usdz or multi-file glTF folders to GLB first.')
      }
      const loader = createLoader()
      const url = URL.createObjectURL(file)
      try {
        const gltf = await loader.loadAsync(url)
        if (gltf.userData?.vrm) return mountVrm(gltf.userData.vrm, file.name)
        return mountGenericGltf(gltf, file.name)
      } finally {
        URL.revokeObjectURL(url)
      }
    },
    async loadFileBundle(files) {
      const list = Array.from(files || [])
      const entry = pickBundleEntry(list)
      if (!entry) {
        throw new Error('No previewable avatar found in that folder. Select the unzipped Sketchfab folder that contains a .glb, .vrm, or .gltf plus its .bin/textures.')
      }
      const kind = inferImportKind(entry.name)
      if (['fbx', 'usdz'].includes(kind)) {
        throw new Error('That folder only contains FBX/USDZ for the main model. Convert/export the Sketchfab asset to GLB first, then upload the GLB or unzipped GLB folder.')
      }
      const { loader, objectUrls } = createBundleLoader(list)
      const rel = entry.webkitRelativePath || entry.name
      const entryUrl = objectUrls[list.indexOf(entry)] || URL.createObjectURL(entry)
      try {
        const gltf = await loader.loadAsync(entryUrl)
        if (gltf.userData?.vrm) return mountVrm(gltf.userData.vrm, rel)
        return mountGenericGltf(gltf, rel)
      } finally {
        objectUrls.forEach((url) => URL.revokeObjectURL(url))
      }
    },
    async loadUrl(url) {
      const loader = createLoader()
      const gltf = await loader.loadAsync(url)
      if (gltf.userData?.vrm) return mountVrm(gltf.userData.vrm, url)
      return mountGenericGltf(gltf, url)
    },
    setMouthOpen(value, viseme = 'aa') {
      const clamped = Math.min(1, Math.max(0, value))
      if (['aa', 'ih', 'ou', 'ee', 'oh', 'fv', 'mpb'].includes(viseme)) targetMouthViseme = viseme
      if (clamped > 0.001) {
        targetMouthOpen = clamped
        mouthReleaseAnchor = clamped
        mouthReleaseUntilMs = 0
      } else {
        mouthReleaseAnchor = Math.max(currentMouthOpen, targetMouthOpen, mouthReleaseAnchor)
        targetMouthOpen = 0
        mouthReleaseUntilMs = performance.now() + MOUTH_GRACEFUL_CLOSE_MS
      }
      applyExpressionState()
    },
    setAvatarMood(mood) {
      currentMood = MOOD_POSES[mood] ? mood : 'idle'
      applyExpressionState()
    },
    setVrmExpressionValue(expressionKey, weight = 0) {
      if (!currentVrm?.expressionManager) throw new Error('No VRM expression manager loaded')
      const key = String(expressionKey || 'aa')
      const preset = VISEME_PRESET_MAP[key] || VRMExpressionPresetName[key.charAt(0).toUpperCase() + key.slice(1)] || null
      safeSetExpression(currentVrm.expressionManager, preset, key, clamp(weight, 0, 1))
      currentVrm.update?.(0)
      currentAvatarScene?.updateMatrixWorld?.(true)
      renderer.render(scene, camera)
      return {
        expressionKey: key,
        weight: Number(clamp(weight, 0, 1).toFixed(4)),
        availableExpressionKeys: Object.keys(currentVrm?.expressionManager?.expressionMap || {}),
      }
    },
    getMouthTimelineDebugState() {
      const visemeMap = currentAvatarDiagnostics ? getNonVrmVisemeMap(currentAvatarDiagnostics) : {}
      const appliedMorphInfluences = {}
      for (const [slot, entry] of Object.entries(visemeMap || {})) {
        const mesh = entry?.mesh
        const morphName = entry?.morphName
        const idx = mesh?.morphTargetDictionary?.[morphName]
        appliedMorphInfluences[slot] = Number.isInteger(idx) && mesh?.morphTargetInfluences
          ? Number((mesh.morphTargetInfluences[idx] || 0).toFixed(4))
          : null
      }
      return {
        targetMouthOpen: Number(targetMouthOpen.toFixed(4)),
        currentMouthOpen: Number(currentMouthOpen.toFixed(4)),
        targetMouthViseme,
        currentMouthWeights: JSON.parse(JSON.stringify(currentMouthWeights)),
        targetMouthWeights: JSON.parse(JSON.stringify(targetMouthWeights)),
        appliedMorphInfluences,
        gracefulCloseActive: mouthReleaseUntilMs > performance.now(),
        gracefulCloseRemainingMs: Math.max(0, Math.round(mouthReleaseUntilMs - performance.now())),
        availableExpressionKeys: Object.keys(currentVrm?.expressionManager?.expressionMap || {}),
        availableEyeBones: eyeRig.availableEyeBones || [],
      }
    },
    getProceduralBodyMotionSnapshot() {
      return {
        currentMood,
        rootMotionGuard: 'root-transform-stays-fixed',
        availableVrmBones: armRig.availableBoneLabels || [],
        availableGenericParts: bodyPartRig.availableParts || [],
        availableHairBones: hairRig.availableHairBones || [],
        availableEyeBones: eyeRig.availableEyeBones || [],
        motionPlan: motionPlanState.snapshot,
        proceduralPeakDegrees: JSON.parse(JSON.stringify(proceduralPartPeak)),
      }
    },
    applyMotionPlan(plan = {}, spokenText = '') {
      const normalized = normalizeMotionPlan(plan, spokenText)
      motionPlanState.active = true
      motionPlanState.startedAtMs = performance.now()
      motionPlanState.totalDurationMs = normalized.totalDurationMs
      motionPlanState.cues = normalized.cues
      motionPlanState.current = { body: 1, head: 1, arms: 1, hands: 1, hair: 1.25, eyes: 1 }
      motionPlanState.snapshot = {
        active: true,
        cueCount: normalized.cues.length,
        movementCueCount: normalized.movementCues?.length || 0,
        totalDurationMs: normalized.totalDurationMs,
        current: { ...motionPlanState.current },
        source: 'github-gpt-motion-plan-json',
      }
      return motionPlanState.snapshot
    },
    getHairMotionSnapshot() {
      return {
        availableHairBones: hairRig.availableHairBones || [],
        hairBoneCount: hairRig.bones.length,
        rootMotionGuard: 'root-transform-stays-fixed',
        proceduralPeakDegrees: Object.fromEntries(Object.entries(proceduralPartPeak).filter(([key]) => key.startsWith('hair:'))),
      }
    },
    runArmMotionProof(options = {}) {
      if (currentVrm && armRig.bones.length && !options.forceGeneric) {
        const summary = startArmMotionProof(armMotionState, armRig, options)
        console.log('Arm motion proof started', summary)
        return summary
      }
      if (!currentAvatarScene) {
        throw new Error('No avatar scene loaded')
      }

      currentAvatarDiagnostics = collectAvatarDiagnostics(currentAvatarScene, currentAnimationClips)
      const candidate = pickGenericArmBone(currentAvatarDiagnostics.raw.bones, options.side || 'right')
      if (!candidate) {
        throw new Error(`BLOCKED: no generic ${(options.side || 'right')} hand/arm bone detected on current avatar. boneCount=${currentAvatarDiagnostics.boneCount}`)
      }

      const bone = candidate.bone
      const localTip = estimateBoneTipLocal(bone)
      const rotationAxisOrder = options.axes || ['z', 'x', 'y', '-z', '-x', '-y']
      const deltaRad = options.deltaRad ?? THREE.MathUtils.degToRad(18)
      const originalRotation = bone.rotation.clone()
      let best = null

      for (const axisToken of rotationAxisOrder) {
        bone.rotation.copy(originalRotation)
        const negative = String(axisToken).startsWith('-')
        const axis = negative ? String(axisToken).slice(1) : String(axisToken)
        bone.rotation[axis] += negative ? -deltaRad : deltaRad
        bone.updateMatrixWorld(true)
        currentAvatarScene.updateMatrixWorld(true)
        renderer.render(scene, camera)
        const after = sampleBoneMotionState(bone, localTip)
        bone.rotation.copy(originalRotation)
        bone.updateMatrixWorld(true)
        currentAvatarScene.updateMatrixWorld(true)
        renderer.render(scene, camera)
        const before = sampleBoneMotionState(bone, localTip)
        const summary = summarizeBoneMotionDelta(before, after)
        const screenDistance = Math.hypot(summary.tipScreenDeltaPx.x, summary.tipScreenDeltaPx.y)
        const pixelMagnitude = Math.abs(summary.tipPixelProbeDelta.rgbaDelta) + Math.abs(summary.tipPixelProbeDelta.lumaDelta)
        const score = screenDistance + (summary.quaternionAngleDeltaDeg * 0.2) + (summary.tipWorldDistanceDelta * 100) + (pixelMagnitude * 0.002)
        if (!best || score > best.score) {
          best = { axis, negative, score, before, after, summary }
        }
      }

      if (!best) {
        throw new Error(`BLOCKED: could not compute a generic arm proof attempt for ${candidate.boneName}`)
      }

      bone.rotation.copy(originalRotation)
      bone.rotation[best.axis] += best.negative ? -deltaRad : deltaRad
      bone.updateMatrixWorld(true)
      currentAvatarScene.updateMatrixWorld(true)
      renderer.render(scene, camera)
      const appliedAfter = sampleBoneMotionState(bone, localTip)
      const finalSummary = summarizeBoneMotionDelta(best.before, appliedAfter)
      const tipScreenDistance = Math.hypot(finalSummary.tipScreenDeltaPx.x, finalSummary.tipScreenDeltaPx.y)
      const pixelMagnitude = Math.abs(finalSummary.tipPixelProbeDelta.rgbaDelta) + Math.abs(finalSummary.tipPixelProbeDelta.lumaDelta)
      if (finalSummary.quaternionAngleDeltaDeg < 0.25 || tipScreenDistance < 2) {
        throw new Error(`BLOCKED: generic arm proof found bone ${candidate.boneName} but visible motion stayed too small. quaternionAngleDeltaDeg=${finalSummary.quaternionAngleDeltaDeg} tipScreenDistance=${Number(tipScreenDistance.toFixed(2))} pixelMagnitude=${Number(pixelMagnitude.toFixed(2))}`)
      }

      return {
        selectedBoneName: candidate.boneName,
        selectedSide: candidate.side,
        selectedPart: candidate.part,
        detectionReason: candidate.reason,
        appliedAxis: `${best.negative ? '-' : '+'}${best.axis}`,
        appliedDeltaDeg: Number(THREE.MathUtils.radToDeg(deltaRad).toFixed(2)),
        localTip: localTip.toArray().map((value) => Number(value.toFixed(4))),
        ...finalSummary,
      }
    },
    runBodyPartMotionProof(options = {}) {
      if (!currentAvatarScene) throw new Error('No avatar scene loaded')
      if (!currentGenericScene) throw new Error('Body-part proof is for Sketchfab/GLB/glTF skeletons; VRM uses normalized humanoid hands/arms proof')
      currentAvatarDiagnostics = collectAvatarDiagnostics(currentAvatarScene, currentAnimationClips)
      bodyPartRig = captureGenericBodyPartRig(currentAvatarDiagnostics)
      hairRig = captureHairRig(currentGenericScene)
      if (!bodyPartRig.bones.length) {
        throw new Error(`BLOCKED: no named skeleton body parts detected. This Sketchfab model may be static mesh-only or has unnamed bones. boneCount=${currentAvatarDiagnostics.boneCount}`)
      }
      const summary = startBodyPartMotionProof(bodyPartMotionState, bodyPartRig, options)
      console.log('Sketchfab body-part motion proof started', summary)
      return summary
    },
    getBodyPartMotionSnapshot() {
      return {
        ...bodyPartMotionState.snapshot,
        availableParts: [...(bodyPartMotionState.snapshot.availableParts || [])],
        peakDegrees: JSON.parse(JSON.stringify(bodyPartMotionState.snapshot.peakDegrees || {})),
      }
    },
    captureCurrentBodyPartFrame(parts = []) {
      const selected = Array.isArray(parts) && parts.length
        ? bodyPartRig.bones.filter((entry) => parts.includes(entry.part))
        : bodyPartRig.bones
      return selected.map((entry) => {
        const localTip = estimateBoneTipLocal(entry.bone)
        const state = sampleBoneMotionState(entry.bone, localTip)
        const baseQuat = entry.baseQuaternion || entry.bone.quaternion
        const currentQuat = new THREE.Quaternion(...state.quaternion)
        return {
          part: entry.part,
          boneName: entry.bone.name || entry.part,
          beforeQuaternion: baseQuat.toArray().map((value) => Number(value.toFixed(4))),
          afterQuaternion: state.quaternion,
          quaternionAngleDeltaDeg: Number(THREE.MathUtils.radToDeg(baseQuat.angleTo(currentQuat)).toFixed(4)),
          worldPosition: state.worldPosition,
          tipWorldPosition: state.tipWorldPosition,
          pivotScreen: state.pivotScreen,
          tipScreen: state.tipScreen,
          tipPixelProbe: state.tipPixelProbe,
          worldAxes: state.worldAxes,
        }
      })
    },
    getArmMotionSnapshot() {
      return {
        ...armMotionState.snapshot,
        availableBoneLabels: [...(armMotionState.snapshot.availableBoneLabels || [])],
        peakDegrees: JSON.parse(JSON.stringify(armMotionState.snapshot.peakDegrees || {})),
      }
    },
    captureCurrentArmBoneFrame(labels = []) {
      const selected = Array.isArray(labels) && labels.length
        ? armRig.bones.filter((bone) => labels.includes(bone.label))
        : armRig.bones
      return selected.map((bone) => {
        const localTip = estimateBoneTipLocal(bone.node)
        const state = sampleBoneMotionState(bone.node, localTip)
        const baseQuat = bone.baseQuaternion || bone.node.quaternion
        const currentQuat = new THREE.Quaternion(...state.quaternion)
        return {
          label: bone.label,
          boneName: bone.node.name || bone.label,
          beforeQuaternion: baseQuat.toArray().map((value) => Number(value.toFixed(4))),
          afterQuaternion: state.quaternion,
          quaternionAngleDeltaDeg: Number(THREE.MathUtils.radToDeg(baseQuat.angleTo(currentQuat)).toFixed(4)),
          worldPosition: state.worldPosition,
          tipWorldPosition: state.tipWorldPosition,
          pivotScreen: state.pivotScreen,
          tipScreen: state.tipScreen,
          tipPixelProbe: state.tipPixelProbe,
          worldAxes: state.worldAxes,
        }
      })
    },

    getAvatarStabilityFrame() {
      if (!currentAvatarScene) throw new Error('No avatar scene loaded')
      currentAvatarScene.updateMatrixWorld?.(true)
      const root = sampleNodeTransformState(currentAvatarScene)
      const hipsNode = findHipsNode()
      const hips = sampleNodeTransformState(hipsNode)
      return {
        root,
        hips,
        rootMotionGuard: 'root-transform-stays-fixed',
      }
    },
    inspectCurrentAvatar() {
      if (!currentAvatarScene) throw new Error('No avatar scene loaded')
      currentAvatarDiagnostics = collectAvatarDiagnostics(currentAvatarScene, currentAnimationClips)
      return {
        avatarName: currentVrm?.meta?.name || 'loaded-avatar',
        format: currentVrm ? 'VRM' : 'GLB/glTF',
        skinnedMeshCount: currentAvatarDiagnostics.skinnedMeshCount,
        skeletonCount: currentAvatarDiagnostics.skeletonCount,
        boneCount: currentAvatarDiagnostics.boneCount,
        boneNames: [...currentAvatarDiagnostics.boneNames],
        morphTargetCount: currentAvatarDiagnostics.morphTargetCount,
        morphTargetNames: [...currentAvatarDiagnostics.morphTargetNames],
        morphMeshes: JSON.parse(JSON.stringify(currentAvatarDiagnostics.morphMeshes)),
        animationClipCount: currentAvatarDiagnostics.animationClipCount,
        animationClipNames: [...currentAvatarDiagnostics.animationClipNames],
        jawBoneNames: [...currentAvatarDiagnostics.jawBoneNames],
        headBoneNames: [...currentAvatarDiagnostics.headBoneNames],
        mouthMorphCandidates: JSON.parse(JSON.stringify(currentAvatarDiagnostics.mouthMorphCandidates)),
      }
    },
    inspectAnimationBindings() {
      return inspectAnimationBindings()
    },
    getRenderLoopDebugState(limit = 60) {
      const max = Math.max(1, Math.min(180, Number(limit) || 60))
      return {
        sampleCount: renderLoopSamples.length,
        samples: renderLoopSamples.slice(-max).map((sample) => JSON.parse(JSON.stringify(sample))),
      }
    },
    runVrmExpressionSurfaceProof(options = {}) {
      if (!currentVrm?.expressionManager) throw new Error('No VRM expression manager loaded')
      currentAvatarDiagnostics = collectAvatarDiagnostics(currentAvatarScene, currentAnimationClips)
      const diagnostics = currentAvatarDiagnostics
      const manager = currentVrm.expressionManager
      const expressionKey = String(options.expressionKey || 'aa')
      const targetWeight = clamp(options.weight ?? 1, 0, 1)
      const keepApplied = !!options.keepApplied
      const morphMeshes = diagnostics.raw.morphMeshes.map((entry) => ({ mesh: entry.mesh, meshName: entry.meshName })).filter((entry) => entry.mesh)
      if (!morphMeshes.length) throw new Error('No morph meshes found for VRM surface proof')
      const step = Math.max(1, options.vertexStep || 2)
      const beforeRows = morphMeshes.map((entry) => ({ mesh: entry.mesh, meshName: entry.meshName, rows: collectMeshVertexSnapshots(entry.mesh, step) }))
      const preset = VISEME_PRESET_MAP[expressionKey] || VRMExpressionPresetName[expressionKey.charAt(0).toUpperCase() + expressionKey.slice(1)] || null
      const availableExpressionKeys = Object.keys(currentVrm?.expressionManager?.expressionMap || {})
      const resetKeys = [...new Set([...Object.keys(VISEME_PRESET_MAP), 'blink', expressionKey])]
      resetKeys.forEach((key) => safeSetExpression(manager, VISEME_PRESET_MAP[key] || VRMExpressionPresetName[key.charAt(0).toUpperCase() + key.slice(1)] || null, key, key === expressionKey ? targetWeight : 0))
      currentVrm.update?.(0)
      currentAvatarScene.updateMatrixWorld(true)
      renderer.render(scene, camera)
      const candidates = beforeRows.map((entry) => ({
        meshName: entry.meshName,
        best: sampleMaxDisplacementVertex(entry.mesh, entry.rows, step),
      })).filter((entry) => entry.best)
      if (!keepApplied) {
        resetKeys.forEach((key) => safeSetExpression(manager, VISEME_PRESET_MAP[key] || VRMExpressionPresetName[key.charAt(0).toUpperCase() + key.slice(1)] || null, key, 0))
        currentVrm.update?.(0)
        currentAvatarScene.updateMatrixWorld(true)
        renderer.render(scene, camera)
      }
      const best = candidates.sort((a, b) => (b.best?.score || 0) - (a.best?.score || 0))[0]
      if (!best) throw new Error(`No surface displacement candidate found for VRM expression ${expressionKey}`)
      const summary = summarizeSkinnedVertexDelta(best.best.before, best.best.after)
      return {
        proofType: 'vrmExpressionSurface',
        expressionKey,
        requestedWeight: Number(targetWeight.toFixed(4)),
        availableExpressionKeys,
        selectedMeshName: best.meshName,
        selectedVertexIndex: best.best.vertexIndex,
        beforeWeight: 0,
        afterWeight: Number(targetWeight.toFixed(4)),
        weightDelta: Number(targetWeight.toFixed(4)),
        worldDelta: summary.worldDelta,
        localDelta: summary.localDelta,
        beforeScreen: summary.beforeScreen,
        afterScreen: summary.afterScreen,
        screenDeltaPx: summary.screenDeltaPx,
        pixelProbeDelta: summary.pixelProbeDelta,
        beforeWorldPosition: summary.beforeWorldPosition,
        afterWorldPosition: summary.afterWorldPosition,
        beforeLocalPosition: summary.beforeLocalPosition,
        afterLocalPosition: summary.afterLocalPosition,
      }
    },
    runSkinnedSurfaceVertexProof(options = {}) {
      if (!currentAvatarScene) throw new Error('No avatar scene loaded')
      if (!currentAnimationClips.length) {
        throw new Error('BLOCKED: current avatar exposes no embedded animation clips to prove')
      }

      const resolvedBindings = currentAnimationClips.flatMap((clip, clipIndex) =>
        clip.tracks.map((track, trackIndex) => resolveTrackBinding(clip, track, clipIndex, trackIndex))
      )
      const clipRegex = options.preferredClipRegex ? new RegExp(options.preferredClipRegex, 'i') : null
      const trackRegex = options.preferredTrackRegex ? new RegExp(options.preferredTrackRegex, 'i') : null
      const candidateBindings = resolvedBindings
        .filter((binding) => binding.node && !binding.isRootLike)
        .filter((binding) => (!clipRegex || clipRegex.test(binding.clipName)))
        .filter((binding) => (!trackRegex || trackRegex.test(binding.trackName)))

      if (!candidateBindings.length) {
        throw new Error(`BLOCKED: no skinned-surface candidate bindings matched clip=${options.preferredClipRegex || '*'} track=${options.preferredTrackRegex || '*'}`)
      }

      const attempts = []
      for (const candidate of candidateBindings.slice(0, options.maxCandidateChecks ?? 24)) {
        if (candidate.propertyName === 'morphTargetInfluences') {
          stopAnimationPlayback()
          animationProofActive = true
          currentAnimationMixer = new THREE.AnimationMixer(currentAvatarScene)
          const clip = currentAnimationClips[candidate.clipIndex]
          currentAnimationAction = currentAnimationMixer.clipAction(clip)
          currentAnimationAction.reset()
          currentAnimationAction.enabled = true
          currentAnimationAction.clampWhenFinished = true
          currentAnimationAction.setLoop(THREE.LoopOnce, 1)
          currentAnimationAction.play()
          currentAnimationMixer.setTime(0)
          currentAvatarScene.updateMatrixWorld(true)
          renderer.render(scene, camera)

          const beforeBinding = sampleBindingState(candidate)
          const before = sampleBindingState(candidate)
          const proofDuration = Math.min(Math.max(options.maxSeconds ?? clip.duration, 0.35), clip.duration || 2)
          const sampleTimes = buildAnimationSampleTimes(clip, candidate, proofDuration, options)
          let best = { time: 0, state: before, bindingState: beforeBinding, score: -Infinity }
          for (const sampleTime of sampleTimes) {
            if (sampleTime <= 0) continue
            currentAnimationMixer.setTime(sampleTime)
            currentAvatarScene.updateMatrixWorld(true)
            renderer.render(scene, camera)
            const state = sampleBindingState(candidate)
            const influenceDelta = Number(((state.influence || 0) - (before.influence || 0)).toFixed(4))
            const summary = summarizeBindingDelta(candidate, before, state)
            const score = scoreSurfaceProof({ worldDelta: 0, screenDeltaPx: { x: 0, y: 0 }, pixelProbeDelta: summary.pixelProbeDelta }, 0, influenceDelta)
            if (score > best.score) best = { time: sampleTime, state, bindingState: state, score }
          }
          const after = best.state
          const summary = summarizeBindingDelta(candidate, before, after)
          const pixelMagnitude = Math.abs(summary.pixelProbeDelta?.rgbaDelta || 0) + Math.abs(summary.pixelProbeDelta?.lumaDelta || 0)
          const screenMagnitude = Math.hypot(summary.screenDeltaPx?.x || 0, summary.screenDeltaPx?.y || 0)
          const meaningful = Math.abs(summary.influenceDelta || 0) >= (options.minMorphInfluenceDelta ?? 0.05) && (screenMagnitude >= (options.minScreenDeltaPx ?? 3) || pixelMagnitude >= (options.minPixelDelta ?? 25))
          attempts.push({
            clipName: candidate.clipName,
            trackName: candidate.trackName,
            resolvedNodeName: candidate.resolvedNodeName,
            proofType: 'skinned-surface-morph',
            vertexIndex: summary.probeVertexIndex ?? null,
            influenceScore: summary.probeDisplacement ?? 0,
            morphName: candidate.morphName,
            influenceDelta: summary.influenceDelta ?? 0,
            worldDelta: null,
            screenDeltaPx: summary.screenDeltaPx,
            pixelProbeDelta: summary.pixelProbeDelta,
            quaternionAngleDeltaDeg: null,
            selectedMeshName: candidate.resolvedNodeName,
            selectedBoneNames: [],
            meaningful,
          })
          if (meaningful) {
            return {
              selectedClip: candidate.clipName,
              selectedTrack: candidate.trackName,
              selectedNode: candidate.resolvedNodeName,
              selectedMeshName: candidate.resolvedNodeName,
              selectedBoneNames: [],
              proofType: 'skinned-surface-morph',
              selectedVertexIndex: summary.probeVertexIndex ?? null,
              influenceScore: summary.probeDisplacement ?? 0,
              quaternionAngleDeltaDeg: null,
              worldDelta: null,
              screenDeltaPx: summary.screenDeltaPx,
              pixelProbeDelta: summary.pixelProbeDelta,
              influenceDelta: summary.influenceDelta ?? 0,
              probeLabel: summary.probeLabel,
              attempts,
            }
          }
          continue
        }

        const surfaceCandidates = collectSkinnedSurfaceCandidates(candidate, options)
        if (!surfaceCandidates.length) {
          attempts.push({
            clipName: candidate.clipName,
            trackName: candidate.trackName,
            resolvedNodeName: candidate.resolvedNodeName,
            proofType: 'skinned-surface-vertex',
            error: 'no influenced vertices found',
          })
          continue
        }

        for (const vertexCandidate of surfaceCandidates.slice(0, options.maxVerticesPerBinding ?? 6)) {
          stopAnimationPlayback()
          animationProofActive = true
          currentAnimationMixer = new THREE.AnimationMixer(currentAvatarScene)
          const clip = currentAnimationClips[candidate.clipIndex]
          currentAnimationAction = currentAnimationMixer.clipAction(clip)
          currentAnimationAction.reset()
          currentAnimationAction.enabled = true
          currentAnimationAction.clampWhenFinished = true
          currentAnimationAction.setLoop(THREE.LoopOnce, 1)
          currentAnimationAction.play()
          currentAnimationMixer.setTime(0)
          currentAvatarScene.updateMatrixWorld(true)
          renderer.render(scene, camera)

          const beforeBinding = sampleBindingState(candidate)
          const before = sampleSkinnedVertexState(vertexCandidate.mesh, vertexCandidate.vertexIndex)
          const proofDuration = Math.min(Math.max(options.maxSeconds ?? clip.duration, 0.35), clip.duration || 2)
          const sampleTimes = buildAnimationSampleTimes(clip, candidate, proofDuration, options)
          let best = { time: 0, state: before, bindingState: beforeBinding, score: -Infinity }
          for (const sampleTime of sampleTimes) {
            if (sampleTime <= 0) continue
            currentAnimationMixer.setTime(sampleTime)
            currentAvatarScene.updateMatrixWorld(true)
            vertexCandidate.mesh.skeleton?.update?.()
            renderer.render(scene, camera)
            const state = sampleSkinnedVertexState(vertexCandidate.mesh, vertexCandidate.vertexIndex)
            const bindingState = sampleBindingState(candidate)
            const surfaceSummary = summarizeSkinnedVertexDelta(before, state)
            const quaternionAngleDeltaDeg = sampleBoneDeltaDegrees(candidate, beforeBinding, bindingState)
            const score = scoreSurfaceProof(surfaceSummary, quaternionAngleDeltaDeg, 0)
            if (score > best.score) best = { time: sampleTime, state, bindingState, score }
          }

          const after = best.state
          const afterBinding = best.bindingState
          const surfaceSummary = summarizeSkinnedVertexDelta(before, after)
          const quaternionAngleDeltaDeg = sampleBoneDeltaDegrees(candidate, beforeBinding, afterBinding)
          const pixelMagnitude = Math.abs(surfaceSummary.pixelProbeDelta?.rgbaDelta || 0) + Math.abs(surfaceSummary.pixelProbeDelta?.lumaDelta || 0)
          const screenMagnitude = Math.hypot(surfaceSummary.screenDeltaPx?.x || 0, surfaceSummary.screenDeltaPx?.y || 0)
          const meaningful = (surfaceSummary.worldDelta >= (options.minWorldDelta ?? 0.003) || screenMagnitude >= (options.minScreenDeltaPx ?? 2) || pixelMagnitude >= (options.minPixelDelta ?? 25))
          const attempt = {
            clipName: candidate.clipName,
            trackName: candidate.trackName,
            resolvedNodeName: candidate.resolvedNodeName,
            selectedMeshName: vertexCandidate.meshName,
            selectedBoneNames: vertexCandidate.targetBoneNames,
            vertexIndex: vertexCandidate.vertexIndex,
            influenceScore: vertexCandidate.influenceScore,
            vertexComponents: vertexCandidate.vertexComponents,
            proofType: 'skinned-surface-vertex',
            quaternionAngleDeltaDeg,
            worldDelta: surfaceSummary.worldDelta,
            screenDeltaPx: surfaceSummary.screenDeltaPx,
            pixelProbeDelta: surfaceSummary.pixelProbeDelta,
            meaningful,
          }
          attempts.push(attempt)
          if (meaningful) {
            return {
              selectedClip: candidate.clipName,
              selectedTrack: candidate.trackName,
              selectedNode: candidate.resolvedNodeName,
              selectedMeshName: vertexCandidate.meshName,
              selectedBoneNames: vertexCandidate.targetBoneNames,
              selectedVertexIndex: vertexCandidate.vertexIndex,
              influenceScore: vertexCandidate.influenceScore,
              vertexComponents: vertexCandidate.vertexComponents,
              proofType: 'skinned-surface-vertex',
              quaternionAngleDeltaDeg,
              worldDelta: surfaceSummary.worldDelta,
              screenDeltaPx: surfaceSummary.screenDeltaPx,
              pixelProbeDelta: surfaceSummary.pixelProbeDelta,
              beforeWorldPosition: surfaceSummary.beforeWorldPosition,
              afterWorldPosition: surfaceSummary.afterWorldPosition,
              proofSampleTimeSec: Number(best.time.toFixed(4)),
              attempts,
            }
          }
        }
      }

      throw new Error(`BLOCKED: skinned-surface proof found no meaningful vertex/morph movement. Attempts=${JSON.stringify(attempts)}`)
    },

    runEmbeddedAnimationProof(options = {}) {
      if (!currentAvatarScene) throw new Error('No avatar scene loaded')
      if (!currentAnimationClips.length) {
        throw new Error('BLOCKED: current avatar exposes no embedded animation clips to prove')
      }

      const clipReports = inspectAnimationBindings()
      const resolvedBindings = currentAnimationClips.flatMap((clip, clipIndex) =>
        clip.tracks.map((track, trackIndex) => resolveTrackBinding(clip, track, clipIndex, trackIndex))
      )
      const clipRegex = options.preferredClipRegex ? new RegExp(options.preferredClipRegex, 'i') : null
      const trackRegex = options.preferredTrackRegex ? new RegExp(options.preferredTrackRegex, 'i') : null
      const nodeRegex = options.preferredNodeRegex ? new RegExp(options.preferredNodeRegex, 'i') : null
      const targetRegex = options.preferredTargetKindRegex ? new RegExp(options.preferredTargetKindRegex, 'i') : null
      const minScreenDeltaPx = options.minScreenDeltaPx ?? 3
      const minPixelDelta = options.minPixelDelta ?? 25
      const minWorldDelta = options.minWorldDelta ?? 0.002
      const minQuaternionDeltaDeg = options.minQuaternionDeltaDeg ?? 0.25
      const minMorphInfluenceDelta = options.minMorphInfluenceDelta ?? 0.05

      const candidateBindings = resolvedBindings
        .filter((binding) => binding.node && !binding.isRootLike)
        .filter((binding) => (!clipRegex || clipRegex.test(binding.clipName)))
        .filter((binding) => (!trackRegex || trackRegex.test(binding.trackName)))
        .filter((binding) => (!nodeRegex || nodeRegex.test(binding.resolvedNodeName || '')))
        .filter((binding) => (!targetRegex || targetRegex.test(binding.targetKind || '')))
        .sort((a, b) => {
          const rank = (binding) => {
            if (binding.propertyName === 'quaternion' && binding.node?.isBone) return 0
            if (binding.propertyName === 'position' && binding.node?.isBone) return 1
            if (binding.propertyName === 'scale' && binding.node?.isBone) return 2
            if (binding.propertyName === 'morphTargetInfluences') return 3
            return 9
          }
          return rank(a) - rank(b)
        })

      if (!candidateBindings.length) {
        throw new Error(`BLOCKED: found ${resolvedBindings.length} embedded tracks but none matched filters clip=${options.preferredClipRegex || '*'} track=${options.preferredTrackRegex || '*'} node=${options.preferredNodeRegex || '*'} target=${options.preferredTargetKindRegex || '*'}`)
      }

      const attempts = []
      for (const candidate of candidateBindings.slice(0, options.maxCandidateChecks ?? 24)) {
        stopAnimationPlayback()
        animationProofActive = true
        if (currentGenericScene) {
          currentGenericScene.rotation.set(0, 0, 0)
        }

        currentAnimationMixer = new THREE.AnimationMixer(currentAvatarScene)
        const clip = currentAnimationClips[candidate.clipIndex]
        currentAnimationAction = currentAnimationMixer.clipAction(clip)
        currentAnimationAction.reset()
        currentAnimationAction.enabled = true
        currentAnimationAction.clampWhenFinished = true
        currentAnimationAction.setLoop(THREE.LoopOnce, 1)
        currentAnimationAction.play()
        currentAnimationMixer.setTime(0)
        currentAvatarScene.updateMatrixWorld(true)
        renderer.render(scene, camera)

        const before = sampleBindingState(candidate)
        const proofDuration = Math.min(Math.max(options.maxSeconds ?? clip.duration, 0.35), clip.duration || 2)
        const sampleTimes = buildAnimationSampleTimes(clip, candidate, proofDuration, options)
        let best = { time: 0, state: before, score: -Infinity }

        for (const sampleTime of sampleTimes) {
          if (sampleTime <= 0) continue
          currentAnimationMixer.setTime(sampleTime)
          currentAvatarScene.updateMatrixWorld(true)
          renderer.render(scene, camera)
          const state = sampleBindingState(candidate)
          const score = scoreBindingDelta(candidate, before, state)
          if (score > best.score) {
            best = { time: sampleTime, state, score }
          }
        }

        currentAnimationMixer.setTime(best.time)
        currentAvatarScene.updateMatrixWorld(true)
        renderer.render(scene, camera)
        const after = sampleBindingState(candidate)
        const deltaSummary = summarizeBindingDelta(candidate, before, after)
        const pixelDeltaMagnitude = Math.abs(deltaSummary.pixelProbeDelta?.rgbaDelta || 0) + Math.abs(deltaSummary.pixelProbeDelta?.lumaDelta || 0)
        const screenDeltaMagnitude = Math.hypot(deltaSummary.screenDeltaPx?.x || 0, deltaSummary.screenDeltaPx?.y || 0)
        const meaningful = deltaSummary.proofType === 'clip-transform'
          ? ((deltaSummary.quaternionAngleDeltaDeg >= minQuaternionDeltaDeg || deltaSummary.worldDistanceDelta >= minWorldDelta || deltaSummary.probeWorldDistanceDelta >= minWorldDelta) && (screenDeltaMagnitude >= minScreenDeltaPx || pixelDeltaMagnitude >= minPixelDelta))
          : (Math.abs(deltaSummary.influenceDelta) >= minMorphInfluenceDelta && (screenDeltaMagnitude >= minScreenDeltaPx || pixelDeltaMagnitude >= minPixelDelta))

        attempts.push({
          clipName: candidate.clipName,
          trackName: candidate.trackName,
          propertyName: candidate.propertyName,
          resolvedNodeName: candidate.resolvedNodeName,
          targetKind: candidate.targetKind,
          proofSampleTimeSec: Number(best.time.toFixed(4)),
          proofType: deltaSummary.proofType,
          quaternionAngleDeltaDeg: deltaSummary.quaternionAngleDeltaDeg ?? null,
          worldDistanceDelta: deltaSummary.worldDistanceDelta ?? null,
          probeWorldDistanceDelta: deltaSummary.probeWorldDistanceDelta ?? null,
          influenceDelta: deltaSummary.influenceDelta ?? null,
          screenDeltaPx: deltaSummary.screenDeltaPx,
          pixelProbeDelta: deltaSummary.pixelProbeDelta,
          probeLabel: deltaSummary.probeLabel ?? null,
          probeSource: deltaSummary.probeSource ?? null,
          meaningful,
        })

        if (meaningful) {
          if (currentAnimationAction) currentAnimationAction.paused = true
          animationProofActive = true
          return {
            clipReports,
            attempts,
            selectedClip: candidate.clipName,
            selectedTrack: candidate.trackName,
            selectedTrackIndex: candidate.trackIndex,
            selectedProperty: candidate.propertyName,
            selectedNode: candidate.resolvedNodeName,
            selectedTargetKind: candidate.targetKind,
            selectedMorphName: candidate.morphName,
            proofSampleTimeSec: Number(best.time.toFixed(4)),
            ...deltaSummary,
          }
        }
      }

      throw new Error(`BLOCKED: clip bindings were resolved, but none of the first ${attempts.length} candidate tracks produced a meaningful node/morph delta. Attempts=${JSON.stringify(attempts)}`)
    },
    runActualMouthMotionProof(options = {}) {
      if (!currentAvatarScene) throw new Error('No avatar scene loaded')
      currentAvatarDiagnostics = collectAvatarDiagnostics(currentAvatarScene, currentAnimationClips)
      const diagnostics = currentAvatarDiagnostics
      const targetMorphRegex = options.targetMorphRegex ? new RegExp(options.targetMorphRegex, 'i') : null
      const candidateRegex = targetMorphRegex || MOUTH_MORPH_REGEX
      const allMorphCandidates = diagnostics.raw.morphMeshes
        .flatMap((entry) => entry.morphNames.filter((name) => candidateRegex.test(name)).map((name) => ({ mesh: entry.mesh, meshName: entry.meshName, morphName: name })))
      const nonVrmVisemeMap = getNonVrmVisemeMap(diagnostics)
      const targetSlot = options.targetVisemeSlot || null
      const slotRegex = targetSlot ? new RegExp(buildMorphRegexFromSlot(targetSlot, nonVrmVisemeMap) || '$.^', 'i') : null
      const morphCandidates = allMorphCandidates.filter((candidate) => {
        if (targetMorphRegex && !targetMorphRegex.test(candidate.morphName)) return false
        if (slotRegex && !slotRegex.test(candidate.morphName)) return false
        return true
      })

      if (morphCandidates.length) {
        const step = Math.max(1, options.vertexStep || 5)
        const morphDelta = clamp(options.morphDelta ?? 0.75, 0.05, 1)
        let bestMorphProof = null
        for (const morphCandidate of morphCandidates) {
          const idx = morphCandidate.mesh.morphTargetDictionary?.[morphCandidate.morphName]
          const influences = morphCandidate.mesh.morphTargetInfluences
          if (!Number.isInteger(idx) || !influences) continue
          const strongestVertex = chooseStrongestMorphVertex(morphCandidate.mesh, idx)
          const baseline = collectMeshVertexSnapshots(morphCandidate.mesh, step)
          const strongestBefore = strongestVertex ? sampleSkinnedVertexState(morphCandidate.mesh, strongestVertex.vertexIndex) : null
          const before = Number(influences[idx] || 0)
          const target = clamp(before + morphDelta, 0, 1)
          influences[idx] = target
          morphCandidate.mesh.geometry?.computeBoundingBox?.()
          morphCandidate.mesh.skeleton?.update?.()
          morphCandidate.mesh.updateMatrixWorld?.(true)
          currentAvatarScene.updateMatrixWorld(true)
          renderer.render(scene, camera)
          const after = Number(influences[idx] || 0)
          if (Math.abs(after - target) > 0.001) {
            throw new Error(`FAIL: morph influence did not stay applied; target=${target} after=${after}`)
          }
          const strongestAfter = strongestVertex ? sampleSkinnedVertexState(morphCandidate.mesh, strongestVertex.vertexIndex) : null
          const strongestSurfaceSummary = strongestBefore && strongestAfter ? summarizeSkinnedVertexDelta(strongestBefore, strongestAfter) : null
          const strongestManualBefore = strongestVertex ? sampleManualMorphVertexState(morphCandidate.mesh, strongestVertex.vertexIndex, idx, before) : null
          const strongestManualAfter = strongestVertex ? sampleManualMorphVertexState(morphCandidate.mesh, strongestVertex.vertexIndex, idx, target) : null
          const strongestManualSummary = strongestManualBefore && strongestManualAfter ? summarizeSkinnedVertexDelta(strongestManualBefore, strongestManualAfter) : null
          const bestSurface = sampleMaxDisplacementVertex(morphCandidate.mesh, baseline, step)
          if (!options.keepApplied) {
            influences[idx] = before
            morphCandidate.mesh.skeleton?.update?.()
            morphCandidate.mesh.updateMatrixWorld?.(true)
            currentAvatarScene.updateMatrixWorld(true)
            renderer.render(scene, camera)
          }
          const sampledSurfaceSummary = bestSurface ? summarizeSkinnedVertexDelta(bestSurface.before, bestSurface.after) : null
          const manualHasMovement = strongestManualSummary && (strongestManualSummary.worldDelta > 0 || strongestManualSummary.localDelta > 0 || Math.abs(strongestManualSummary.screenDeltaPx.x) > 0 || Math.abs(strongestManualSummary.screenDeltaPx.y) > 0)
          const apiHasMovement = strongestSurfaceSummary && (strongestSurfaceSummary.worldDelta > 0 || strongestSurfaceSummary.localDelta > 0 || Math.abs(strongestSurfaceSummary.screenDeltaPx.x) > 0 || Math.abs(strongestSurfaceSummary.screenDeltaPx.y) > 0)
          const preferredSummary = apiHasMovement ? strongestSurfaceSummary : (manualHasMovement ? strongestManualSummary : sampledSurfaceSummary)
          const score = (preferredSummary?.worldDelta || 0) * 1000 + (preferredSummary?.localDelta || 0) * 1000 + Math.hypot(preferredSummary?.screenDeltaPx?.x || 0, preferredSummary?.screenDeltaPx?.y || 0) * 4 + Math.abs(preferredSummary?.pixelProbeDelta?.rgbaDelta || 0) * 0.02 + Math.abs(after - before) * 100 + (strongestVertex?.magnitude || 0) * 100
          const proof = {
            proofType: 'morphSurface',
            meshName: morphCandidate.meshName,
            morphName: morphCandidate.morphName,
            selectedVertexIndex: strongestVertex?.vertexIndex ?? bestSurface?.vertexIndex ?? null,
            morphDeltaLocal: strongestVertex?.morphDeltaLocal || null,
            morphDeltaMagnitude: strongestVertex?.magnitude || null,
            beforeInfluence: Number(before.toFixed(4)),
            afterInfluence: Number(after.toFixed(4)),
            delta: Number((after - before).toFixed(4)),
            influenceApplied: target,
            targetVisemeSlot: targetSlot,
            nonVrmVisemeMap,
            summarySource: apiHasMovement ? 'mesh.getVertexPosition' : (manualHasMovement ? 'manualMorphVertexState' : (sampledSurfaceSummary ? 'sampleMaxDisplacementVertex' : 'none')),
            strongestApiSummary: strongestSurfaceSummary,
            strongestManualSummary: strongestManualSummary,
            ...(preferredSummary || {}),
            score: Number(score.toFixed(4)),
          }
          if (!bestMorphProof || proof.score > bestMorphProof.score) bestMorphProof = proof
        }
        if (bestMorphProof) {
          delete bestMorphProof.score
          return bestMorphProof
        }
      }

      const vrmExpressionKeys = Object.keys(currentVrm?.expressionManager?.expressionMap || {})
      const vrmViseme = ['aa', 'ih', 'ou', 'ee', 'oh'].find((key) => vrmExpressionKeys.includes(key)) || null
      if (currentVrm?.expressionManager && vrmViseme) {
        const manager = currentVrm.expressionManager
        const morphMeshes = diagnostics.raw.morphMeshes.map((entry) => entry.mesh).filter(Boolean)
        const step = Math.max(1, options.vertexStep || 1)
        const baseline = morphMeshes.map((mesh) => ({ mesh, meshName: mesh.name || mesh.uuid, beforeRows: collectMeshVertexSnapshots(mesh, step) }))
        const presetMap = {
          aa: VRMExpressionPresetName.Aa,
          ih: VRMExpressionPresetName.Ih,
          ou: VRMExpressionPresetName.Ou,
          ee: VRMExpressionPresetName.Ee,
          oh: VRMExpressionPresetName.Oh,
        }
        ;['aa', 'ih', 'ou', 'ee', 'oh'].forEach((key) => safeSetExpression(manager, presetMap[key], key, key === vrmViseme ? 1 : 0))
        currentVrm.update?.(0)
        currentAvatarScene.updateMatrixWorld(true)
        renderer.render(scene, camera)
        const candidates = baseline.map((entry) => ({
          mesh: entry.mesh,
          meshName: entry.meshName,
          best: sampleMaxDisplacementVertex(entry.mesh, entry.beforeRows, step),
        })).filter((entry) => entry.best)
        ;['aa', 'ih', 'ou', 'ee', 'oh'].forEach((key) => safeSetExpression(manager, presetMap[key], key, 0))
        currentVrm.update?.(0)
        currentAvatarScene.updateMatrixWorld(true)
        renderer.render(scene, camera)
        const best = candidates.sort((a, b) => (b.best?.score || 0) - (a.best?.score || 0))[0]
        if (best) {
          const summary = summarizeSkinnedVertexDelta(best.best.before, best.best.after)
          return {
            proofType: 'vrmExpressionSurface',
            expressionPreset: vrmViseme,
            selectedMeshName: best.meshName,
            selectedVertexIndex: best.best.vertexIndex,
            worldDelta: summary.worldDelta,
            screenDeltaPx: summary.screenDeltaPx,
            pixelProbeDelta: summary.pixelProbeDelta,
            beforeWorldPosition: summary.beforeWorldPosition,
            afterWorldPosition: summary.afterWorldPosition,
            availableExpressionKeys: vrmExpressionKeys,
            nonVrmVisemeMap,
          }
        }
      }

      const mouthController = pickMouthController(diagnostics)
      if (mouthController.type === 'unsupportedHeadOnly') {
        return {
          proofType: 'unsupportedHeadOnly',
          reason: mouthController.reason,
          headBoneNames: mouthController.headBoneNames,
          mouthMorphCandidates: diagnostics.mouthMorphCandidates,
          jawBoneNames: diagnostics.jawBoneNames,
          nonVrmVisemeMap,
        }
      }

      const bone = mouthController.bone
      const beforeQuaternion = bone.quaternion.clone()
      const beforeRotationX = bone.rotation.x
      const beforeAxes = worldAxesForBone(bone)
      bone.rotation.x += options.boneDeltaRad ?? THREE.MathUtils.degToRad(8)
      bone.updateMatrixWorld(true)
      currentAvatarScene.updateMatrixWorld(true)
      const afterQuaternion = bone.quaternion.clone()
      const afterRotationX = bone.rotation.x
      const afterAxes = worldAxesForBone(bone)
      const angleDeltaDeg = THREE.MathUtils.radToDeg(beforeQuaternion.angleTo(afterQuaternion))
      return {
        proofType: 'jawBone',
        fallbackReason: mouthController.reason,
        boneName: bone.name || bone.uuid,
        beforeRotationX: Number(beforeRotationX.toFixed(4)),
        afterRotationX: Number(afterRotationX.toFixed(4)),
        angleDeltaDeg: Number(angleDeltaDeg.toFixed(4)),
        beforeAxes,
        afterAxes,
      }
    },

    setMorphTargetValue(meshName, morphName, value = 0) {
      if (!currentAvatarScene) throw new Error('No avatar scene loaded')
      currentAvatarDiagnostics = collectAvatarDiagnostics(currentAvatarScene, currentAnimationClips)
      const meshEntry = currentAvatarDiagnostics?.raw?.morphMeshes?.find((entry) => entry.meshName === meshName || entry.mesh?.name === meshName)
      const fallbackEntry = currentAvatarDiagnostics?.raw?.morphMeshes?.find((entry) => Number.isInteger(entry.mesh?.morphTargetDictionary?.[morphName]))
      const mesh = meshEntry?.mesh || fallbackEntry?.mesh || currentAvatarScene.getObjectByName?.(meshName)
      const idx = mesh?.morphTargetDictionary?.[morphName]
      if (!mesh || !Number.isInteger(idx) || !mesh.morphTargetInfluences) throw new Error(`Morph not found: ${meshName} / ${morphName}`)
      const targetValue = clamp(value, 0, 1)
      mesh.morphTargetInfluences[idx] = targetValue
      mesh.skeleton?.update?.()
      mesh.updateMatrixWorld?.(true)
      currentAvatarScene.updateMatrixWorld(true)
      renderer.render(scene, camera)
      const applied = Number(mesh.morphTargetInfluences[idx] || 0)
      if (Math.abs(applied - targetValue) > 0.001) throw new Error(`FAIL: morph influence did not stay applied; target=${targetValue} after=${applied}`)
      return { meshName, morphName, value: Number(applied.toFixed(4)) }
    },
    getNonVrmVisemeMap() {
      if (!currentAvatarScene) throw new Error('No avatar scene loaded')
      currentAvatarDiagnostics = collectAvatarDiagnostics(currentAvatarScene, currentAnimationClips)
      return getNonVrmVisemeMap(currentAvatarDiagnostics)
    },
    captureCurrentNonVrmVisemeFrame(slot) {
      if (!currentAvatarScene) throw new Error('No avatar scene loaded')
      currentAvatarDiagnostics = collectAvatarDiagnostics(currentAvatarScene, currentAnimationClips)
      const visemeMap = getNonVrmVisemeMap(currentAvatarDiagnostics)
      const entry = visemeMap?.[slot]
      if (!entry?.mesh || !entry?.morphName) throw new Error(`Missing non-VRM viseme slot ${slot}`)
      const idx = entry.mesh.morphTargetDictionary?.[entry.morphName]
      if (!Number.isInteger(idx) || !entry.mesh.morphTargetInfluences) throw new Error(`Morph not found for non-VRM viseme slot ${slot}: ${entry.meshName} / ${entry.morphName}`)
      const strongestVertex = chooseStrongestMorphVertex(entry.mesh, idx)
      if (!strongestVertex) throw new Error(`No strongest morph vertex for non-VRM viseme slot ${slot}: ${entry.meshName} / ${entry.morphName}`)
      entry.mesh.skeleton?.update?.()
      entry.mesh.updateMatrixWorld?.(true)
      currentAvatarScene.updateMatrixWorld(true)
      renderer.render(scene, camera)
      const sampled = sampleSkinnedVertexState(entry.mesh, strongestVertex.vertexIndex)
      return {
        slot,
        meshName: entry.meshName,
        morphName: entry.morphName,
        vertexIndex: strongestVertex.vertexIndex,
        morphDeltaLocal: strongestVertex.morphDeltaLocal || null,
        morphDeltaMagnitude: strongestVertex.magnitude || null,
        influence: Number((entry.mesh.morphTargetInfluences[idx] || 0).toFixed(4)),
        localPosition: sampled.localPosition,
        worldPosition: sampled.worldPosition,
        screen: sampled.screen,
        pixelProbe: sampled.pixelProbe,
      }
    },
    getCameraFramingSnapshot() {
      if (!currentAvatarScene) throw new Error('No avatar scene loaded')
      currentAvatarScene.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(currentAvatarScene)
      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(center)
      const boneProjection = {}
      if (currentVrm?.humanoid?.getNormalizedBoneNode) {
        const labels = [
          ['head', VRMHumanBoneName.Head],
          ['chest', VRMHumanBoneName.Chest],
          ['spine', VRMHumanBoneName.Spine],
          ['hips', VRMHumanBoneName.Hips],
          ['leftUpperLeg', VRMHumanBoneName.LeftUpperLeg],
          ['leftFoot', VRMHumanBoneName.LeftFoot],
        ]
        labels.forEach(([label, boneName]) => {
          const node = currentVrm.humanoid.getNormalizedBoneNode(boneName)
          if (!node) return
          const world = new THREE.Vector3()
          node.getWorldPosition(world)
          boneProjection[label] = {
            world: world.toArray().map((value) => Number(value.toFixed(4))),
            projected: world.clone().project(camera).toArray().map((value) => Number(value.toFixed(4))),
          }
        })
      }
      return {
        boneProjection,
        boxMin: box.min.toArray().map((value) => Number(value.toFixed(4))),
        boxMax: box.max.toArray().map((value) => Number(value.toFixed(4))),
        size: size.toArray().map((value) => Number(value.toFixed(4))),
        center: center.toArray().map((value) => Number(value.toFixed(4))),
        lookAt: previewLookAt.toArray().map((value) => Number(value.toFixed(4))),
        cameraPosition: camera.position.toArray().map((value) => Number(value.toFixed(4))),
        fov: camera.fov,
        projected: {
          bottom: box.min.clone().project(camera).toArray().map((value) => Number(value.toFixed(4))),
          center: center.clone().project(camera).toArray().map((value) => Number(value.toFixed(4))),
          top: box.max.clone().project(camera).toArray().map((value) => Number(value.toFixed(4))),
        },
      }
    },
    destroy() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      disposeCurrentAvatar()
      renderer.dispose()
    },
  }
}
