import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
// import * as dat from 'dat.gui'

// Debug
// const gui = new dat.GUI()

class Panorama {
    // States
    shiftDown = false
    activePanel = {}
    activeItems = []

    // Scene
    sizes: { width: number, height: number }
    canvas: HTMLElement
    scene: THREE.Scene
    txLoader: THREE.TextureLoader
    panoMesh: THREE.Mesh
    itemsGroup: THREE.Group
    panelsGroup: THREE.Group
    svgLoader: SVGLoader
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    raycaster: THREE.Raycaster
    pointer: THREE.Vector2
    renderer: THREE.WebGLRenderer
    clock: THREE.Clock

    // Panorama
    panoRadius = 1340
    panoHeight = 1643


    constructor() {
        this.sizes = {
            width: window.innerWidth,
            height: window.innerHeight
        }
        this.canvas = document.querySelector('canvas.webgl')
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
        })
        this.renderer.setSize(this.sizes.width, this.sizes.height)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

        this.scene = new THREE.Scene()
        this.txLoader = new THREE.TextureLoader()
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.clock = new THREE.Clock()

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, this.sizes.width / this.sizes.height, 0.01, 10000)
        this.camera.position.set(0,0,250)
        this.scene.add(this.camera)

        // Controls
        this.controls = new OrbitControls(this.camera, this.canvas)
        this.controls.enablePan = false
        this.controls.maxDistance = this.camera.position.z
        this.controls.minDistance = this.camera.position.z
        this.controls.rotateSpeed *= -0.25
        this.controls.minPolarAngle = Math.PI / 2
        this.controls.maxPolarAngle = Math.PI / 2
        this.controls.enableDamping = true

        // Panorama
        const panoTexture = this.txLoader.load('image.jpg')
        panoTexture.wrapS = THREE.RepeatWrapping
        panoTexture.repeat.x = -1
        const panoMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0xffffff),
            side: THREE.DoubleSide,
            map: panoTexture,
            opacity: 1,
            transparent: true,
        })
        const panoGeometry = new THREE.CylinderGeometry(this.panoRadius, this.panoRadius, this.panoHeight, 1024, 3, true)
        this.panoMesh = new THREE.Mesh(panoGeometry, panoMaterial)
        this.panoMesh.userData = { 'hitIgnore': true }
        this.panoMesh.rotation.set(0, Math.PI, 0)
        this.scene.add(this.panoMesh)

        // Active areas
        this.itemsGroup = new THREE.Group()
        this.panelsGroup = new THREE.Group()
        this.svgLoader = new SVGLoader()
        this.svgLoader.load('image.svg',
            (data) => {
                const items = data.paths.filter(item => item.userData?.node.dataset.type === 'item')
                const itemMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    visible: false,
                    side: THREE.DoubleSide
                })
                for (const item of items) {
                    const x = item.userData?.node.x.baseVal.value
                    const y = -item.userData?.node.y.baseVal.value
                    const nodeWidth = item.userData?.node.width.baseVal.value
                    const nodeHeight = item.userData?.node.height.baseVal.value
                    const angle = (x+(nodeWidth/2))/this.panoRadius + Math.PI
                    const geom = new THREE.CylinderGeometry(this.panoRadius-50, this.panoRadius-50, nodeHeight, 64, 2, true, -nodeWidth/this.panoRadius, nodeWidth/(this.panoRadius))
                    const mesh = new THREE.Mesh(geom, itemMat)
                    mesh.userData['id'] = item.userData?.node.id
                    mesh.rotation.set(0, -angle+(nodeWidth/this.panoRadius)/2, 0)
                    mesh.position.y = y+this.panoHeight/2-nodeHeight/2
                    this.itemsGroup.add(mesh)
                }
                this.scene.add(this.itemsGroup)

                const panels = data.paths.filter(item => item.userData?.node.dataset.type === 'panel')
                const panelMat = new THREE.MeshBasicMaterial({
                    color: 0xff00ff,
                    visible: false,
                    side: THREE.DoubleSide
                })
                for (const panel of panels) {
                    const x = panel.userData?.node.x.baseVal.value
                    const y = -panel.userData?.node.y.baseVal.value
                    const nodeWidth = panel.userData?.node.width.baseVal.value
                    const nodeHeight = panel.userData?.node.height.baseVal.value
                    const angle = (x + (nodeWidth / 2)) / this.panoRadius + Math.PI
                    const geom = new THREE.CylinderGeometry(this.panoRadius - 50, this.panoRadius - 50, nodeHeight, 64, 2, true, -nodeWidth / this.panoRadius, nodeWidth / (this.panoRadius))
                    const mesh = new THREE.Mesh(geom, panelMat)
                    mesh.userData['id'] = panel.userData?.node.id
                    mesh.rotation.set(0, -angle + (nodeWidth / this.panoRadius) / 2, 0)
                    mesh.position.y = y + (this.panoHeight - nodeHeight) / 2
                    this.panelsGroup.add(mesh)
                }
                this.scene.add(this.panelsGroup)
    
            },
            (xhr) => {  },
            (error) => { console.log('An error occurred', error) }
        )

        window.addEventListener('pointermove', this.onPointerMove.bind(this))
        window.addEventListener('pointerdown', this.onPointerDown.bind(this))
        window.addEventListener('resize', () => {
            this.sizes.width = window.innerWidth
            this.sizes.height = window.innerHeight
            this.camera.aspect = this.sizes.width / this.sizes.height
            this.camera.updateProjectionMatrix()
            this.renderer.setSize(this.sizes.width, this.sizes.height)
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        })
        // this.controls.addEventListener('change', e => { console.log('d'); this.dragging = true })
    }

    onPointerMove(event: PointerEvent) {
        this.pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        this.pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    }

    onPointerDown(event: PointerEvent) {
        this.raycaster.setFromCamera(this.pointer, this.camera)
        const results = this.raycaster.intersectObjects(this.itemsGroup.children, true)
        if (results.length === 0) return true
        const object = results[0].object
        if (object.userData.hitIgnore) return true
        
        // TODO: Add billboard plus sign to open detail view
        
        if (this.activeItems.map(i => i.userData.id).includes(results[0].object.userData.id)) {
            // Remove item from active set
            this.activeItems = this.activeItems.filter(i => i.userData.id !== results[0].object.userData.id)
        } else {
            this.activeItems.push({ userData: object.userData, position: object.position})
            
            // TODO: Fire request for item

        }
        console.log(this.activeItems)
        return true
    }

    loop() {
        const elapsedTime = this.clock.getElapsedTime()
        this.controls.update()
        this.controls.enabled = !this.shiftDown

        this.raycaster.setFromCamera(new THREE.Vector2(), this.camera)
        const result = this.raycaster.intersectObjects(this.panelsGroup.children, true)
        if (result.length > 0) {
            this.activePanel = result[0].object.userData

            // TODO: Fire request to highlight panel

        } else {
            this.activePanel = {}

            // TODO: Fire request to turn panel off

        }

        this.renderer.render(this.scene, this.camera)
        window.requestAnimationFrame(this.loop.bind(this))
    }
}

const pano = new Panorama()
pano.loop()