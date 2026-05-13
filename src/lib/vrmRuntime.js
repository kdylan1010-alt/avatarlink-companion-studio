import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName, VRMHumanBoneName } from '@pixiv/three-vrm'

function createLoader() {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))
  return loader
}

function summarizeVrm(vrm, fallbackName = 'unknown.vrm') {
  const humanoidBones = Object.keys(vrm?.humanoid?.humanBones ?? {})
  const expressionKeys = Object.keys(vrm?.expressionManager?.expressionMap ?? {})
  return {
    avatarName: vrm?.meta?.name || fallbackName,
    specVersion: vrm?.meta?.metaVersion || vrm?.meta?.specVersion || 'unknown',
    sceneChildren: vrm?.scene?.children?.length ?? 0,
    humanoidBoneCount: humanoidBones.length,
    expressionCount: expressionKeys.length,
    expressionKeys,
  }
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

export async function createVrmPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(canvas.clientWidth || 640, canvas.clientHeight || 360, false)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0f131c')

  const camera = new THREE.PerspectiveCamera(30, (canvas.clientWidth || 640) / (canvas.clientHeight || 360), 0.1, 100)
  camera.position.set(0, 1.3, 3.1)

  const hemi = new THREE.HemisphereLight('#ffffff', '#1d2230', 1.5)
  scene.add(hemi)

  const dir = new THREE.DirectionalLight('#ffffff', 1.8)
  dir.position.set(1.5, 2.5, 2.5)
  scene.add(dir)

  const grid = new THREE.GridHelper(6, 12, '#92f0c3', '#2b3040')
  grid.position.y = BASE_Y
  scene.add(grid)

  let currentVrm = null
  let currentMouthOpen = 0
  let currentMood = 'idle'
  let raf = 0
  let motionSeconds = 0
  let armRig = { bones: [], availableBoneLabels: [] }
  const armMotionState = createArmMotionState()
  const clock = new THREE.Clock()

  const applyExpressionState = () => {
    const manager = currentVrm?.expressionManager
    if (!manager) return

    const blinkPulse = Math.max(0, Math.sin(motionSeconds * 2.4)) ** 24
    manager.setValue(VRMExpressionPresetName.Aa, currentMouthOpen)
    manager.setValue(VRMExpressionPresetName.Blink, blinkPulse)
    manager.setValue(VRMExpressionPresetName.Relaxed, currentMood === 'listening' ? 0.28 : 0)
    manager.setValue(VRMExpressionPresetName.Happy, currentMood === 'celebrate' ? 0.55 : 0)
    manager.setValue(VRMExpressionPresetName.Surprised, currentMood === 'speaking' ? 0.18 : 0)
  }

  const applyArmMotion = () => {
    if (!armRig.bones.length) return

    if (!armMotionState.active) {
      if (armMotionState.snapshot.mode === 'completed') {
        for (const bone of armRig.bones) {
          bone.node.quaternion.copy(bone.baseQuaternion)
        }
      }
      return
    }

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

  const mountVrm = (vrm, fallbackName) => {
    if (!vrm) throw new Error('Loaded asset did not expose a VRM avatar')
    if (currentVrm) {
      scene.remove(currentVrm.scene)
      VRMUtils.deepDispose(currentVrm.scene)
    }
    VRMUtils.rotateVRM0(vrm)
    currentVrm = vrm
    currentVrm.scene.position.set(0, BASE_Y, 0)
    currentVrm.scene.rotation.set(0, 0, 0)
    currentVrm.scene.scale.setScalar(1)
    armRig = captureArmBones(currentVrm)
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

  const render = () => {
    raf = requestAnimationFrame(render)
    const delta = clock.getDelta()
    motionSeconds += delta
    if (currentVrm) {
      const pose = MOOD_POSES[currentMood] || MOOD_POSES.idle
      const breathe = (Math.sin(motionSeconds * 2.6) + 1) / 2
      currentVrm.scene.position.y = BASE_Y + Math.sin(motionSeconds * 1.8) * pose.bob
      currentVrm.scene.rotation.y = Math.sin(motionSeconds * pose.turnSpeed) * pose.sway
      currentVrm.scene.rotation.z = Math.sin(motionSeconds * 1.25) * pose.tilt
      currentVrm.scene.scale.setScalar(1 + breathe * pose.breathScale)
      applyArmMotion()
      applyExpressionState()
      currentVrm.update(delta)
    }
    renderer.render(scene, camera)
  }

  const resize = () => {
    const width = canvas.clientWidth || 640
    const height = canvas.clientHeight || 360
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  window.addEventListener('resize', resize)
  resize()
  render()

  return {
    async loadFile(file) {
      const loader = createLoader()
      const url = URL.createObjectURL(file)
      try {
        const gltf = await loader.loadAsync(url)
        return mountVrm(gltf.userData.vrm, file.name)
      } finally {
        URL.revokeObjectURL(url)
      }
    },
    async loadUrl(url) {
      const loader = createLoader()
      const gltf = await loader.loadAsync(url)
      return mountVrm(gltf.userData.vrm, url)
    },
    setMouthOpen(value) {
      currentMouthOpen = Math.min(1, Math.max(0, value))
      applyExpressionState()
    },
    setAvatarMood(mood) {
      currentMood = MOOD_POSES[mood] ? mood : 'idle'
      applyExpressionState()
    },
    runArmMotionProof(options = {}) {
      if (!currentVrm) {
        throw new Error('Load a VRM before running the hands/arms proof')
      }
      if (!armRig.bones.length) {
        throw new Error('Current VRM exposes no normalized shoulder/arm/hand bones for proof')
      }
      const summary = startArmMotionProof(armMotionState, armRig, options)
      console.log('Arm motion proof started', summary)
      return summary
    },
    getArmMotionSnapshot() {
      return {
        ...armMotionState.snapshot,
        availableBoneLabels: [...(armMotionState.snapshot.availableBoneLabels || [])],
        peakDegrees: JSON.parse(JSON.stringify(armMotionState.snapshot.peakDegrees || {})),
      }
    },
    destroy() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      if (currentVrm) {
        scene.remove(currentVrm.scene)
        VRMUtils.deepDispose(currentVrm.scene)
      }
      renderer.dispose()
    },
  }
}
