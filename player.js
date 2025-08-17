import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Player {
    constructor(isLocal) {
        this.isLocal = isLocal;
        this.keys = {};
        
        // Create a wacky character model
        const head = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        head.position.y = 1;
        
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 1.5, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x0000ff })
        );
        body.position.y = 0;
        
        this.mesh = new THREE.Group();
        this.mesh.add(head);
        this.mesh.add(body);
        this.mesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
            }
        });
        
        // Create physics body
        const shape = new CANNON.Sphere(1);
        this.body = new CANNON.Body({
            mass: 5,
            material: new CANNON.Material('player'),
            angularDamping: 1.0
        });
        this.body.addShape(shape, new CANNON.Vec3(0, 0, 0));
        this.body.position.set(Math.random() * 10 - 5, 5, 0);

        // For smoothing remote player movement
        this.networkPosition = new THREE.Vector3();
        this.networkQuaternion = new THREE.Quaternion();

        if (this.isLocal) {
            document.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
            document.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
        }
    }
    
    update(deltaTime, presenceState) {
        if (this.isLocal) {
            this.handleInput();
        } else if(presenceState) {
            this.networkPosition.set(
                presenceState.position.x,
                presenceState.position.y,
                presenceState.position.z
            );
             this.networkQuaternion.set(
                presenceState.quaternion.x,
                presenceState.quaternion.y,
                presenceState.quaternion.z,
                presenceState.quaternion.w
            );

            this.mesh.position.lerp(this.networkPosition, 0.2);
            this.mesh.quaternion.slerp(this.networkQuaternion, 0.2);
            return;
        }

        // Always sync mesh to physics body for local player
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
    }
    
    handleInput() {
        const speed = 20;
        const jumpForce = 20;
        
        // Forward/backward movement
        if (this.keys['w']) {
            this.body.velocity.z = -speed;
        } else if (this.keys['s']) {
            this.body.velocity.z = speed;
        } else {
            this.body.velocity.z *= 0.9; // damping
        }
        
        // Left/right movement
        if (this.keys['a']) {
            this.body.velocity.x = -speed;
        } else if (this.keys['d']) {
            this.body.velocity.x = speed;
        } else {
            this.body.velocity.x *= 0.9; // damping
        }

        // Jump
        if (this.keys[' ']) {
           if (this.canJump()) {
             this.body.velocity.y = jumpForce;
           }
        }
    }
    
    canJump() {
        const from = this.body.position;
        const to = new CANNON.Vec3(from.x, from.y - 1.1, from.z);
        const result = new CANNON.RaycastResult();
        this.body.world.raycastClosest(from, to, {}, result);
        return result.hasHit;
    }

    getSyncData() {
        return {
            position: { x: this.mesh.position.x, y: this.mesh.position.y, z: this.mesh.position.z },
            quaternion: { x: this.mesh.quaternion.x, y: this.mesh.quaternion.y, z: this.mesh.quaternion.z, w: this.mesh.quaternion.w }
        };
    }

    dispose() {
        if (this.isLocal) {
             document.removeEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
             document.removeEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
        }
    }
}

export default Player;

