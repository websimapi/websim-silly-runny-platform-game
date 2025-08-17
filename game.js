import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Player from './player.js';

class Game {
    constructor() {
        this.players = {};
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 0, 500);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);
        
        // Physics World
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -20, 0)
        });
        
        // Create the running platform
        this.createCourse();
        
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    createCourse() {
        const groundMaterial = new CANNON.Material('ground');
        
        // Ground platform
        const groundShape = new CANNON.Box(new CANNON.Vec3(10, 1, 500));
        const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
        groundBody.addShape(groundShape);
        groundBody.position.set(0, -1, -500);
        this.world.addBody(groundBody);
        
        const groundMesh = new THREE.Mesh(
            new THREE.BoxGeometry(20, 2, 1000),
            new THREE.MeshStandardMaterial({ color: 0x228B22 })
        );
        groundMesh.position.copy(groundBody.position);
        groundMesh.receiveShadow = true;
        this.scene.add(groundMesh);

        // Add some obstacles
        for (let i = 0; i < 20; i++) {
            const size = Math.random() * 4 + 2;
            const posX = (Math.random() - 0.5) * 18;
            const posZ = -20 - i * 40;

            const boxShape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
            const boxBody = new CANNON.Body({ mass: 0 });
            boxBody.addShape(boxShape);
            boxBody.position.set(posX, size / 2, posZ);
            this.world.addBody(boxBody);

            const boxMesh = new THREE.Mesh(
                new THREE.BoxGeometry(size, size, size),
                new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })
            );
            boxMesh.position.copy(boxBody.position);
            boxMesh.castShadow = true;
            this.scene.add(boxMesh);
        }
    }
    
    addPlayer(id, isLocal) {
        const player = new Player(isLocal);
        this.players[id] = player;
        this.scene.add(player.mesh);
        this.world.addBody(player.body);
    }
    
    removePlayer(id) {
        if (!this.players[id]) return;
        const player = this.players[id];
        this.scene.remove(player.mesh);
        this.world.removeBody(player.body);
        player.dispose();
        delete this.players[id];
    }
    
    update(deltaTime, presence) {
        this.world.step(1 / 60, deltaTime);
        
        for (const id in this.players) {
            const player = this.players[id];
            const presenceState = presence[id];
            
            player.update(deltaTime, presenceState);
        }
        
        const localPlayer = Object.values(this.players).find(p => p.isLocal);
        if (localPlayer) {
            this.updateCamera(localPlayer);
        }

        this.renderer.render(this.scene, this.camera);
    }

    updateCamera(localPlayer) {
        const playerPosition = localPlayer.mesh.position;
        const offset = new THREE.Vector3(0, 5, 10);
        this.camera.position.lerp(playerPosition.clone().add(offset), 0.1);
        this.camera.lookAt(playerPosition);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

export default Game;

