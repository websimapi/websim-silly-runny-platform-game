import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Player {
    constructor(isLocal, camera) {
        this.isLocal = isLocal;
        this.camera = camera; // Used for camera-relative movement
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
            angularDamping: 0.9,
            linearDamping: 0.9, // Add damping to slow down the player naturally
            fixedRotation: true, // Prevent player from tipping over
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

        const clampedDx = Math.min(Math.max(dx / maxDist, -1), 1);
        const clampedDy = Math.min(Math.max(dy / maxDist, -1), 1);

        const angle = Math.atan2(clampedDx, clampedDy);
        const stickX = Math.sin(angle) * Math.min(distance, maxDist);
        const stickY = Math.cos(angle) * Math.min(distance, maxDist);

        joystickEl.style.transform = `translate(-50%, -50%) translate(${stickX}px, ${stickY}px)`;

        // Update keys based on joystick position
        const forward = -clampedDy;
        const right = clampedDx;

        this.keys['w'] = forward > threshold / maxDist;
        this.keys['s'] = forward < -threshold / maxDist;
        this.keys['a'] = right < -threshold / maxDist;
        this.keys['d'] = right > threshold / maxDist;
    }
    
    update(deltaTime, presenceState) {
        if (this.isLocal) {
            this.handleInput(deltaTime);
        } else if(presenceState && presenceState.position) {
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
            // Also sync physics body for remote players for potential interactions
            if (this.body) {
                this.body.position.copy(this.mesh.position);
                this.body.quaternion.copy(this.mesh.quaternion);
            }
            return;
        }

        // Always sync mesh to physics body for local player
        if (this.body) {
            this.mesh.position.copy(this.body.position);
            this.mesh.quaternion.copy(this.body.quaternion);
        }
    }
    
    handleInput(deltaTime) {
        const speed = 2.5;
        const jumpForce = 100;
        
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        right.crossVectors(this.camera.up, forward).normalize();
        
        const impulse = new CANNON.Vec3(0, 0, 0);
        let appliedImpulse = false;

        // Forward/backward movement
        if (this.keys['w']) {
            impulse.x -= forward.x * speed;
            impulse.z -= forward.z * speed;
            appliedImpulse = true;
        }
        if (this.keys['s']) {
            impulse.x += forward.x * speed;
            impulse.z += forward.z * speed;
            appliedImpulse = true;
        }
        
        // Left/right movement
        if (this.keys['a']) {
            impulse.x += right.x * speed;
            impulse.z += right.z * speed;
            appliedImpulse = true;
        }
        if (this.keys['d']) {
            impulse.x -= right.x * speed;
            impulse.z -= right.z * speed;
            appliedImpulse = true;
        }
        
        if(appliedImpulse) {
             this.body.applyImpulse(impulse, this.body.position);
        }

        // Jump
        if (this.keys[' ']) {
           if (this.canJump()) {
             this.body.applyImpulse(new CANNON.Vec3(0, jumpForce, 0), this.body.position);
           }
           // Prevent continuous jumping by consuming the key press
           this.keys[' '] = false;
        }
    }
    
    canJump() {
        const from = this.body.position;
        const to = new CANNON.Vec3(from.x, from.y - 1.01, from.z); // Ray slightly longer than sphere radius
        const result = new CANNON.RaycastResult();
        // Use a temporary variable for the world if this.body.world is not guaranteed
        const world = this.body.world;
        if (world) {
             world.raycastClosest(from, to, {}, result);
             return result.hasHit;
        }
        return false;
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