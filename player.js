import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Player {
    constructor(isLocal) {
        this.isLocal = isLocal;
        
        // Input state
        this.keys = {};
        this.joystick = { x: 0, y: 0 };
        this.inputVelocity = new THREE.Vector3();
        this.wantsToJump = false;

        // Player constants
        this.speed = 15;
        this.jumpForce = 15;
        this.moveForce = 400;
        
        // Create a wacky character model
        const head = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        head.position.y = 1;
        
        const bodyMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 1.5, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x0000ff })
        );
        bodyMesh.position.y = 0;
        
        this.mesh = new THREE.Group();
        this.mesh.add(head);
        this.mesh.add(bodyMesh);
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
            angularDamping: 1.0,
            linearDamping: 0.1, // Adds some friction
            fixedRotation: true, // Prevents player from tipping over
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
        const maxJoystickDist = joystickContainer.clientWidth / 2;

        joystickContainer.addEventListener('touchstart', (e) => {
            if (joystickTouchId === null) {
                e.preventDefault();
                const touch = e.changedTouches[0];
                joystickTouchId = touch.identifier;
                const rect = joystickContainer.getBoundingClientRect();
                joystickStartPos.x = rect.left + rect.width / 2;
                joystickStartPos.y = rect.top + rect.height / 2;
                this.updateJoystick(touch, joystick, joystickStartPos, maxJoystickDist);
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (joystickTouchId !== null) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.identifier === joystickTouchId) {
                         e.preventDefault();
                        this.updateJoystick(touch, joystick, joystickStartPos, maxJoystickDist);
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
            this.wantsToJump = true;
        }, { passive: false });
        jumpButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.wantsToJump = false;
        }, { passive: false });
    }

    updateJoystick(touch, joystickEl, startPos, maxDist) {
        const dx = touch.clientX - startPos.x;
        const dy = touch.clientY - startPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(distance, maxDist);
        
        const angle = Math.atan2(dy, dx);
        const stickX = clampedDist * Math.cos(angle);
        const stickY = clampedDist * Math.sin(angle);

        joystickEl.style.transform = `translate(-50%, -50%) translate(${stickX}px, ${stickY}px)`;

        // Update joystick state for analog movement
        this.joystick.x = stickX / maxDist;
        this.joystick.y = - (stickY / maxDist); // Invert Y for forward movement
    }
    
    update(deltaTime, presenceState) {
        if (this.isLocal) {
            this.handleMovement(deltaTime);
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
            // We use physics for remote players now too, for collisions.
            this.body.position.copy(this.mesh.position);
            // Slerping quaternion can be visually jarring with physics, so we just copy it for now.
            // A better solution would involve physics-based turning.
            this.mesh.quaternion.slerp(this.networkQuaternion, 0.2);
            this.body.quaternion.copy(this.mesh.quaternion);
            
        } else { // Fallback for remote players if no presence yet
             this.mesh.position.copy(this.body.position);
             this.mesh.quaternion.copy(this.body.quaternion);
        }

        if (this.isLocal) {
            // Always sync mesh to physics body for local player
            this.mesh.position.copy(this.body.position);
            this.mesh.quaternion.copy(this.body.quaternion);
        }
    }

    processInput() {
        let moveX = 0;
        let moveZ = 0;

        // Keyboard input
        if (this.keys['w'] || this.keys['arrowup']) moveZ = -1;
        if (this.keys['s'] || this.keys['arrowdown']) moveZ = 1;
        if (this.keys['a'] || this.keys['arrowleft']) moveX = -1;
        if (this.keys['d'] || this.keys['arrowright']) moveX = 1;

        // Mobile analog input overrides keyboard
        if (Math.abs(this.joystick.x) > 0.1 || Math.abs(this.joystick.y) > 0.1) {
            moveX = this.joystick.x;
            moveZ = -this.joystick.y;
        }

        this.inputVelocity.set(moveX, 0, moveZ).normalize().multiplyScalar(this.speed);

        if (this.keys[' '] && !this.wantsToJump) {
             this.wantsToJump = true;
        }
        if(!this.keys[' ']) {
             this.wantsToJump = false;
        }
    }
    
    handleMovement(deltaTime) {
        const force = new CANNON.Vec3(
            this.inputVelocity.x * this.moveForce * deltaTime,
            0,
            this.inputVelocity.z * this.moveForce * deltaTime
        );

        // Apply force to move
        this.body.applyForce(force);

        // Cap velocity
        const currentVelocity = this.body.velocity;
        const horizontalVelocity = new THREE.Vector2(currentVelocity.x, currentVelocity.z);
        if (horizontalVelocity.length() > this.speed) {
            horizontalVelocity.normalize().multiplyScalar(this.speed);
            this.body.velocity.x = horizontalVelocity.x;
            this.body.velocity.z = horizontalVelocity.y;
        }

        // Jump
        if (this.wantsToJump && this.canJump()) {
           this.body.velocity.y = this.jumpForce;
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