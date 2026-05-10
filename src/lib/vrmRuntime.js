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
  grid.position.y = -1.15
  scene.add(grid)

  let currentVrm = null
  let currentMouthOpen = 0
  let raf = 0
  const clock = new THREE.Clock()

  const applyMouthOpen = () => {
    const manager = currentVrm?.expressionManager
    if (!manager) return
    manager.setValue(VRMExpressionPresetName.Aa, currentMouthOpen)
  }

  const mountVrm = (vrm, fallbackName) => {
    if (!vrm) throw new Error('Loaded asset did not expose a VRM avatar')
    if (currentVrm) {
      scene.remove(currentVrm.scene)
      VRMUtils.deepDispose(currentVrm.scene)
    }
    VRMUtils.rotateVRM0(vrm)
    currentVrm = vrm
    currentVrm.scene.position.set(0, -1.15, 0)
    applyMouthOpen()
    scene.add(currentVrm.scene)
    return summarizeVrm(vrm, fallbackName)
  }

  const render = () => {
    raf = requestAnimationFrame(render)
    const delta = clock.getDelta()
    if (currentVrm) {
      applyMouthOpen()
      currentVrm.update(delta)
      currentVrm.scene.rotation.y += delta * 0.35
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
      applyMouthOpen()
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
