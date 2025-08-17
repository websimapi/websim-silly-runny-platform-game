import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Player {
    constructor(isLocal) {
        this.isLocal = isLocal;
        this.keys = {};
        this.moveVector = new THREE.Vector2(0, 0);
        this.isGrounded = false;
        this.jumpCooldown = 0;
        
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
        
        // Create physics body with better setup
        const shape = new CANNON.Sphere(0.8);
        this.body = new CANNON.Body({
            mass: 5,
            material: new CANNON.Material('player'),
            linearDamping: 0.4,
            angularDamping: 1.0
        });
        this.body.addShape(shape);
        this.body.position.set(Math.random() * 10 - 5, 5, 0);

        // For smoothing remote player movement
        this.networkPosition = new THREE.Vector3();
        this.networkQuaternion = new THREE.Quaternion();

        if (this.isLocal) {
            this.setupControls();
            this.testMovement();
        }
    }

    testMovement() {
        console.log('Testing movement system...');
        
        // Test physics body creation
        if (!this.body) {
            console.error('❌ Physics body not created');
            return false;
        }
        console.log('✅ Physics body created');

        // Test initial position
        const initialPos = this.body.position;
        console.log('✅ Initial position:', initialPos.x, initialPos.y, initialPos.z);

        // Test key input simulation
        this.keys['w'] = true;
        this.handleInput();
        if (Math.abs(this.body.velocity.z) > 0) {
            console.log('✅ Forward movement test passed');
        } else {
            console.error('❌ Forward movement test failed');
        }
        this.keys['w'] = false;

        // Reset velocity
        this.body.velocity.set(0, 0, 0);

        console.log('✅ Movement system test complete');
        return true;
    }

    setupControls() {
        // Keyboard controls with better event handling
        this.keydownHandler = (e) => {
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', ' '].includes(key)) {
                e.preventDefault();
                this.keys[key] = true;
            }
        };
        this.keyupHandler = (e) => {
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', ' '].includes(key)) {
                e.preventDefault();
                this.keys[key] = false;
            }
        };
        
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

        let isJoystickActive = false;
        let joystickStartPos = { x: 0, y: 0 };
        const joystickDeadzone = 15;
        const maxJoystickDist = 50;

        // Joystick touch handling
        joystickContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isJoystickActive = true;
            const rect = joystickContainer.getBoundingClientRect();
            joystickStartPos.x = rect.left + rect.width / 2;
            joystickStartPos.y = rect.top + rect.height / 2;
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (isJoystickActive) {
                e.preventDefault();
                const touch = e.touches[0];
                this.updateJoystick(touch, joystick, joystickStartPos, maxJoystickDist, joystickDeadzone);
            }
        }, { passive: false });

        const endJoystick = (e) => {
            if (isJoystickActive) {
                isJoystickActive = false;
                joystick.style.transform = `translate(-50%, -50%)`;
                this.moveVector.set(0, 0);
                this.keys['w'] = this.keys['s'] = this.keys['a'] = this.keys['d'] = false;
            }
        };
        
        document.addEventListener('touchend', endJoystick);
        document.addEventListener('touchcancel', endJoystick);

        // Jump button
        jumpButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys[' '] = true;
        }, { passive: false });
        
        jumpButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys[' '] = false;
        }, { passive: false });
    }

    updateJoystick(touch, joystickEl, startPos, maxDist, deadzone) {
        const dx = touch.clientX - startPos.x;
        const dy = touch.clientY - startPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < deadzone) {
            this.moveVector.set(0, 0);
            joystickEl.style.transform = `translate(-50%, -50%)`;
            this.keys['w'] = this.keys['s'] = this.keys['a'] = this.keys['d'] = false;
            return;
        }

        const clampedDistance = Math.min(distance, maxDist);
        const normalizedX = (dx / distance) * clampedDistance;
        const normalizedY = (dy / distance) * clampedDistance;

        joystickEl.style.transform = `translate(-50%, -50%) translate(${normalizedX}px, ${normalizedY}px)`;

        // Update move vector (normalized)
        this.moveVector.x = dx / maxDist;
        this.moveVector.y = -dy / maxDist; // Invert Y for forward/backward

        // Clamp to -1, 1 range
        this.moveVector.x = Math.max(-1, Math.min(1, this.moveVector.x));
        this.moveVector.y = Math.max(-1, Math.min(1, this.moveVector.y));

        // Update key states based on joystick
        const threshold = 0.3;
        this.keys['w'] = this.moveVector.y > threshold;
        this.keys['s'] = this.moveVector.y < -threshold;
        this.keys['a'] = this.moveVector.x < -threshold;
        this.keys['d'] = this.moveVector.x > threshold;
    }
    
    update(deltaTime, presenceState) {
        if (this.jumpCooldown > 0) {
            this.jumpCooldown -= deltaTime;
        }

        if (this.isLocal) {
            this.handleInput(deltaTime);
            this.checkGrounded();
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
    
    handleInput(deltaTime) {
        const speed = 15;
        const jumpForce = 18;
        
        // Get current velocity
        const velocity = this.body.velocity;
        
        // Calculate movement direction
        let moveX = 0;
        let moveZ = 0;

        // Use either joystick or keyboard input
        if (Math.abs(this.moveVector.x) > 0.1 || Math.abs(this.moveVector.y) > 0.1) {
            // Use joystick input
            moveX = this.moveVector.x * speed;
            moveZ = this.moveVector.y * speed;
        } else {
            // Use keyboard input
            if (this.keys['a']) moveX = -speed;
            if (this.keys['d']) moveX = speed;
            if (this.keys['w']) moveZ = -speed;
            if (this.keys['s']) moveZ = speed;
        }

        // Apply movement
        this.body.velocity.x = moveX;
        this.body.velocity.z = moveZ;

        // Jump
        if (this.keys[' '] && this.isGrounded && this.jumpCooldown <= 0) {
            this.body.velocity.y = jumpForce;
            this.jumpCooldown = 0.2; // Prevent double jumping
            this.isGrounded = false;
        }
    }
    
    checkGrounded() {
        const rayStart = new CANNON.Vec3().copy(this.body.position);
        const rayEnd = new CANNON.Vec3(rayStart.x, rayStart.y - 1.2, rayStart.z);
        
        const result = new CANNON.RaycastResult();
        this.body.world.raycastClosest(rayStart, rayEnd, {}, result);
        
        this.isGrounded = result.hasHit && result.distance < 1.2;
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