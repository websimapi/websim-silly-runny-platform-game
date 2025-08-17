import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Player {
    constructor(isLocal) {
        this.isLocal = isLocal;
        this.keys = {};
        this.joystick = { x: 0, y: 0 }; // For analog mobile controls
        
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
            this.setupControls();
        }
    }

    setupControls() {
        // Keyboard controls
        this.keydownHandler = (e) => this.keys[e.key.toLowerCase()] = true;
        this.keyupHandler = (e) => this.keys[e.key.toLowerCase()] = false;
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        
        // Touch controls
        if ('ontouchstart' in window) {
            this.setupTouchControls();
        }
    }

    setupTouchControls() {
        const joystick = document.getElementById('joystick');
        const joystickContainer = document.getElementById('joystick-container');
        const jumpButton = document.getElementById('jump-button');

        let joystickTouchId = null;
        let joystickStartPos = { x: 0, y: 0 };
        const joystickThreshold = 10;
        const maxJoystickDist = joystickContainer.clientWidth / 2;

        joystickContainer.addEventListener('touchstart', (e) => {
            if (joystickTouchId === null) {
                e.preventDefault();
                joystickTouchId = e.changedTouches[0].identifier;
                const rect = joystickContainer.getBoundingClientRect();
                joystickStartPos.x = rect.left + rect.width / 2;
                joystickStartPos.y = rect.top + rect.height / 2;
                this.updateJoystick(e.changedTouches[0], joystick, joystickStartPos, maxJoystickDist, joystickThreshold);
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (joystickTouchId !== null) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joystickTouchId) {
                         e.preventDefault();
                        this.updateJoystick(e.changedTouches[i], joystick, joystickStartPos, maxJoystickDist, joystickThreshold);
                    }
                }
            }
        }, { passive: false });

        const resetJoystick = (e) => {
             if (joystickTouchId !== null) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joystickTouchId) {
                        joystickTouchId = null;
                        joystick.style.transform = `translate(-50%, -50%)`;
                        this.keys['w'] = this.keys['s'] = this.keys['a'] = this.keys['d'] = false;
                        this.joystick.x = 0;
                        this.joystick.y = 0;
                    }
                }
            }
        };
        document.addEventListener('touchend', resetJoystick);
        document.addEventListener('touchcancel', resetJoystick);

        jumpButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys[' '] = true;
        }, { passive: false });
        jumpButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys[' '] = false;
        }, { passive: false });
    }

    updateJoystick(touch, joystickEl, startPos, maxDist, threshold) {
        const dx = touch.clientX - startPos.x;
        const dy = touch.clientY - startPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let clampedDx = Math.min(Math.max(dx / maxDist, -1), 1);
        let clampedDy = Math.min(Math.max(dy / maxDist, -1), 1);
        
        if (distance < threshold) {
            clampedDx = 0;
            clampedDy = 0;
        }

        const stickX = clampedDx * maxDist;
        const stickY = clampedDy * maxDist;

        joystickEl.style.transform = `translate(-50%, -50%) translate(${stickX}px, ${stickY}px)`;

        // Update joystick state for analog movement
        this.joystick.x = clampedDx;
        this.joystick.y = -clampedDy; // Invert Y for forward movement

        // Update keys for compatibility, though analog values are preferred
        this.keys['w'] = this.joystick.y > 0.1;
        this.keys['s'] = this.joystick.y < -0.1;
        this.keys['a'] = this.joystick.x < -0.1;
        this.keys['d'] = this.joystick.x > 0.1;
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
        
        let moveX = 0;
        let moveZ = 0;

        // Keyboard input
        if (this.keys['w']) moveZ = -1;
        if (this.keys['s']) moveZ = 1;
        if (this.keys['a']) moveX = -1;
        if (this.keys['d']) moveX = 1;
        
        // Mobile analog input overrides keyboard
        if (Math.abs(this.joystick.x) > 0.1 || Math.abs(this.joystick.y) > 0.1) {
            moveX = this.joystick.x;
            moveZ = -this.joystick.y;
        }

        // Apply velocities
        if (Math.abs(moveZ) > 0) {
            this.body.velocity.z = moveZ * speed;
        } else {
             this.body.velocity.z *= 0.9; // damping
        }

        if (Math.abs(moveX) > 0) {
            this.body.velocity.x = moveX * speed;
        } else {
            this.body.velocity.x *= 0.9; // damping
        }
        
        // Jump
        if (this.keys[' '] && this.canJump()) {
           this.body.velocity.y = jumpForce;
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
             document.removeEventListener('keydown', this.keydownHandler);
             document.removeEventListener('keyup', this.keyupHandler);
        }
    }
}

export default Player;