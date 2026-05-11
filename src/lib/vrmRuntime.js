import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName } from '@pixiv/three-vrm'

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
