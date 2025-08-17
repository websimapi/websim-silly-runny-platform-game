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
            angularDamping: 1.0,
            fixedRotation: true // Prevent the player from rotating randomly
        });
        this.body.addShape(shape);
        this.body.position.set(Math.random() * 10 - 5, 5, 0);

        // Movement state tracking
        this.movementState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };

        // For smoothing remote player movement
        this.networkPosition = new THREE.Vector3();
        this.networkQuaternion = new THREE.Quaternion();

        if (this.isLocal) {
            this.setupControls();
            // Delay test until physics is ready
            setTimeout(() => this.testMovement(), 200);
        }
    }

    testMovement() {
        console.log('🧪 Testing movement system...');
        
        // Test physics body creation
        if (!this.body) {
            console.error('❌ Physics body not created');
            return false;
        }
        console.log('✅ Physics body created, mass:', this.body.mass);

        // Test world connection
        if (!this.body.world) {
            console.error('❌ Physics body not added to world');
            return false;
        }
        console.log('✅ Physics body added to world');

        // Test initial position
        const initialPos = this.body.position;
        console.log('✅ Initial position:', initialPos.x.toFixed(2), initialPos.y.toFixed(2), initialPos.z.toFixed(2));

        // Test velocity application directly
        console.log('🧪 Testing direct velocity application...');
        this.body.velocity.set(0, 0, -5); // Move forward
        console.log('✅ Velocity set to:', this.body.velocity.x, this.body.velocity.y, this.body.velocity.z);

        // Reset after a moment
        setTimeout(() => {
            this.body.velocity.set(0, 0, 0);
            console.log('✅ Velocity reset');
        }, 100);

        // Test key input simulation
        console.log('🧪 Testing key input simulation...');
        this.movementState.forward = true;
        this.applyMovement();
        
        if (Math.abs(this.body.velocity.z) > 0) {
            console.log('✅ Movement input test passed, velocity Z:', this.body.velocity.z);
        } else {
            console.error('❌ Movement input test failed, velocity Z:', this.body.velocity.z);
        }
        
        this.movementState.forward = false;
        this.body.velocity.set(0, 0, 0);

        console.log('✅ Movement system test complete');
        return true;
    }

    setupControls() {
        // Keyboard controls with better event handling
        this.keydownHandler = (e) => {
            const key = e.key.toLowerCase();
            console.log('Key down:', key); // Debug log
            
            switch(key) {
                case 'w':
                case 'arrowup':
                    e.preventDefault();
                    this.keys['w'] = true;
                    this.movementState.forward = true;
                    break;
                case 's':
                case 'arrowdown':
                    e.preventDefault();
                    this.keys['s'] = true;
                    this.movementState.backward = true;
                    break;
                case 'a':
                case 'arrowleft':
                    e.preventDefault();
                    this.keys['a'] = true;
                    this.movementState.left = true;
                    break;
                case 'd':
                case 'arrowright':
                    e.preventDefault();
                    this.keys['d'] = true;
                    this.movementState.right = true;
                    break;
                case ' ':
                    e.preventDefault();
                    this.keys[' '] = true;
                    this.movementState.jump = true;
                    break;
            }
        };
        
        this.keyupHandler = (e) => {
            const key = e.key.toLowerCase();
            console.log('Key up:', key); // Debug log
            
            switch(key) {
                case 'w':
                case 'arrowup':
                    e.preventDefault();
                    this.keys['w'] = false;
                    this.movementState.forward = false;
                    break;
                case 's':
                case 'arrowdown':
                    e.preventDefault();
                    this.keys['s'] = false;
                    this.movementState.backward = false;
                    break;
                case 'a':
                case 'arrowleft':
                    e.preventDefault();
                    this.keys['a'] = false;
                    this.movementState.left = false;
                    break;
                case 'd':
                case 'arrowright':
                    e.preventDefault();
                    this.keys['d'] = false;
                    this.movementState.right = false;
                    break;
                case ' ':
                    e.preventDefault();
                    this.keys[' '] = false;
                    this.movementState.jump = false;
                    break;
            }
        };
        
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        
        // Touch controls
        if ('ontouchstart' in window) {
            this.setupTouchControls();
        }

        console.log('✅ Controls setup complete');
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
                this.movementState.forward = false;
                this.movementState.backward = false;
                this.movementState.left = false;
                this.movementState.right = false;
            }
        };
        
        document.addEventListener('touchend', endJoystick);
        document.addEventListener('touchcancel', endJoystick);

        // Jump button
        jumpButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.movementState.jump = true;
        }, { passive: false });
        
        jumpButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.movementState.jump = false;
        }, { passive: false });
    }

    updateJoystick(touch, joystickEl, startPos, maxDist, deadzone) {
        const dx = touch.clientX - startPos.x;
        const dy = touch.clientY - startPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < deadzone) {
            this.moveVector.set(0, 0);
            joystickEl.style.transform = `translate(-50%, -50%)`;
            this.movementState.forward = false;
            this.movementState.backward = false;
            this.movementState.left = false;
            this.movementState.right = false;
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

        // Update movement state based on joystick
        const threshold = 0.3;
        this.movementState.forward = this.moveVector.y > threshold;
        this.movementState.backward = this.moveVector.y < -threshold;
        this.movementState.left = this.moveVector.x < -threshold;
        this.movementState.right = this.moveVector.x > threshold;
    }

    applyMovement() {
        if (!this.body || !this.body.world) {
            console.warn('Cannot apply movement: physics not ready');
            return;
        }

        const speed = 15;
        let moveX = 0;
        let moveZ = 0;

        // Use either joystick or keyboard input
        if (Math.abs(this.moveVector.x) > 0.1 || Math.abs(this.moveVector.y) > 0.1) {
            // Use joystick input
            moveX = this.moveVector.x * speed;
            moveZ = this.moveVector.y * speed;
        } else {
            // Use movement state
            if (this.movementState.left) moveX = -speed;
            if (this.movementState.right) moveX = speed;
            if (this.movementState.forward) moveZ = -speed;
            if (this.movementState.backward) moveZ = speed;
        }

        // Apply movement with direct velocity setting
        this.body.velocity.x = moveX;
        this.body.velocity.z = moveZ;

        // Debug log for movement
        if (moveX !== 0 || moveZ !== 0) {
            console.log('Applying movement - X:', moveX, 'Z:', moveZ, 'Current velocity:', this.body.velocity.x, this.body.velocity.z);
        }

        // Jump
        if (this.movementState.jump && this.isGrounded && this.jumpCooldown <= 0) {
            const jumpForce = 18;
            this.body.velocity.y = jumpForce;
            this.jumpCooldown = 0.2;
            this.isGrounded = false;
            console.log('Jumping with force:', jumpForce);
        }
    }
    
    update(deltaTime, presenceState) {
        if (this.jumpCooldown > 0) {
            this.jumpCooldown -= deltaTime;
        }

        if (this.isLocal) {
            this.applyMovement();
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