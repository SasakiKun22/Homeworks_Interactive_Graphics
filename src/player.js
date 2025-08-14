// player.js - Gestione del giocatore con FSM (Finite State Machine)

// Enum per gli stati del giocatore
const PlayerStates = {
    IDLE: 'idle',
    WALKING: 'walking',
    RUNNING: 'running',
    ATTACKING: 'attacking',
    HURT: 'hurt',
    DEAD: 'dead'
};

// Classe per gestire la macchina a stati
class StateMachine {
    constructor(initialState) {
        this.currentState = initialState;
        this.previousState = null;
        this.stateTime = 0;
    }
    
    changeState(newState) {
        if (this.currentState === newState) return false;
        
        this.previousState = this.currentState;
        this.currentState = newState;
        this.stateTime = 0;
        return true;
    }
    
    update(deltaTime) {
        this.stateTime += deltaTime;
    }
    
    isState(state) {
        return this.currentState === state;
    }
    
    getState() {
        return this.currentState;
    }
    
    getStateTime() {
        return this.stateTime;
    }
}

class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Riferimenti al modello
        this.model = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;

        // Root bone per gestire il root motion
        this.rootBone = null;
        this.rootBoneInitialPosition = null;
        
        // Macchina a stati
        this.stateMachine = new StateMachine(PlayerStates.IDLE);
        
        // Proprietà fisiche
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.targetRotation = 0;
        
        // Configurazione movimento
        this.config = {
            walkSpeed: 5,
            runSpeed: 10,
            acceleration: 15,
            deceleration: 10,
            rotationSpeed: 8,
            health: 100,
            maxHealth: 100,
            attackCooldown: 1.43,     // Durata dell'animazione di attacco
            attackDamage: 25,
            attackRange: 3,          // Raggio d'azione dell'attacco
            attackComboWindow: 0.5,  // Finestra per concatenare attacchi
        };
        
        // Input
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            run: false,
            attack: false,
            moveVector: new THREE.Vector2(0, 0)
        };
        
        // Timers
        this.attackTimer = 0;
        
        // Setup
        this.setupControls();
        this.clock = new THREE.Clock();
        this.loadModel();
    }
    
    // ========== CARICAMENTO MODELLO ==========
    
    loadModel() {
        if (typeof THREE.FBXLoader === 'undefined') {
            console.error('FBXLoader non trovato!');
            this.createPlaceholderModel();
            return;
        }
        
        this.loader = new THREE.FBXLoader();
        
        this.loader.load(
            '../models/paladin/Paladin_Sword.fbx',
            (fbx) => this.onModelLoaded(fbx),
            (progress) => this.onLoadProgress(progress),
            (error) => this.onLoadError(error)
        );
    }
    
    onModelLoaded(fbx) {
        console.log('Modello caricato con successo!');
        
        this.model = fbx;
        this.model.scale.set(0.02, 0.02, 0.02);
        this.model.position.copy(this.position);
        
        // Abilita ombre
        this.model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
            // Cerca il bone principale (solitamente chiamato "mixamorigHips" o "Hips")
            if (child.isBone && (child.name.toLowerCase().includes('hips') || 
                                 child.name.toLowerCase().includes('root') ||
                                 child.name === 'mixamorigHips')) {
                this.rootBone = child;
                this.rootBoneInitialPosition = child.position.clone();
                console.log('Root bone trovato:', child.name);
            }
        });
        
        this.setupAnimations(fbx);
        this.scene.add(this.model);
        this.setupCamera();
    }
    
    setupAnimations(fbx) {
        this.mixer = new THREE.AnimationMixer(fbx);
        
        if (fbx.animations && fbx.animations.length > 0) {
            console.log(`Trovate ${fbx.animations.length} animazioni nel modello`);
            
            // Per animazioni Mixamo
            if (fbx.animations[0].name === 'mixamo.com') {
                const action = this.mixer.clipAction(fbx.animations[0]);
                this.animations[PlayerStates.IDLE] = action;
                console.log('Animazione Mixamo trovata, assegnata come idle');
                this.loadSeparateAnimations();
            }
        } else {
            console.log('Nessuna animazione incorporata');
            this.loadSeparateAnimations();
        }
    }
    
    loadSeparateAnimations() {
        const animationFiles = {
            [PlayerStates.IDLE]: '../models/paladin/Idle.fbx',
            [PlayerStates.WALKING]: '../models/paladin/Walk.fbx',
            [PlayerStates.RUNNING]: '../models/paladin/Run.fbx',
            [PlayerStates.ATTACKING]: '../models/paladin/Slash.fbx',
        };
        
        let loadedCount = 0;
        const totalAnimations = Object.keys(animationFiles).length;
        
        Object.entries(animationFiles).forEach(([state, path]) => {
            this.loader.load(
                path,
                (fbx) => {
                    if (fbx.animations && fbx.animations.length > 0) {
                        const clip = fbx.animations[0];
                        clip.name = state;
                        
                        // Log info sull'animazione
                        console.log(`Animazione ${state}: durata ${clip.duration}s, tracks: ${clip.tracks.length}`);
                        
                        // Se è l'animazione di attacco, verifica i frame
                        if (state === PlayerStates.ATTACKING) {
                            const fps = clip.tracks[0]?.times ? 
                                clip.tracks[0].times.length / clip.duration : 30;
                            console.log(`Animazione attacco: ~${Math.round(fps)} FPS, ~${Math.round(clip.duration * fps)} frames`);
                            
                            // Aggiorna la durata dell'attacco basandosi sulla clip reale
                            this.config.attackCooldown = clip.duration;
                        }
                        
                        const action = this.mixer.clipAction(clip, this.model);
                        this.animations[state] = action;
                        console.log(`Animazione ${state} caricata da ${path}`);
                        
                        // Se è idle, avviala immediatamente
                        if (state === PlayerStates.IDLE) {
                            console.log('Avvio immediato animazione idle');
                            this.playAnimation(PlayerStates.IDLE);
                        }
                        
                        loadedCount++;
                    }
                },
                (progress) => {
                    if (progress.lengthComputable) {
                        const percentComplete = progress.loaded / progress.total * 100;
                        console.log(`Caricamento ${state}: ${Math.round(percentComplete)}%`);
                    }
                },
                (error) => {
                    console.warn(`Errore caricamento ${state} da ${path}:`, error);
                    loadedCount++;
                }
            );
        });
    }

    
    onLoadProgress(progress) {
        if (progress.lengthComputable) {
            const percentComplete = progress.loaded / progress.total * 100;
            console.log(`Caricamento: ${Math.round(percentComplete)}%`);
        }
    }
    
    onLoadError(error) {
        console.error('Errore caricamento modello:', error);
        this.createPlaceholderModel();
    }
    
    createPlaceholderModel() {
        const group = new THREE.Group();
        
        const bodyGeometry = new THREE.BoxGeometry(1, 2, 0.5);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1;
        body.castShadow = true;
        group.add(body);
        
        const headGeometry = new THREE.SphereGeometry(0.4);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDBBD });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 2.3;
        head.castShadow = true;
        group.add(head);
        
        this.model = group;
        this.scene.add(this.model);
        this.setupCamera();
    }
    
    // ========== CONTROLLI ==========
    
    setupControls() {
        // Keyboard
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Mouse
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        window.addEventListener('contextmenu', (e) => e.preventDefault()); // Previeni menu contestuale
    }

    onMouseDown(e) {
        if (e.button === 0) { // Tasto sinistro del mouse
            this.input.attack = true;
            console.log('Mouse sinistro premuto - attacco!');
        }
    }
    
    onMouseUp(e) {
        if (e.button === 0) { // Tasto sinistro del mouse
            this.input.attack = false;
        }
    }
    
    onKeyDown(e) {
        const key = e.key.toLowerCase();
        
        switch(key) {
            case 'w':
            case 'arrowup':
                this.input.forward = true;
                break;
            case 's':
            case 'arrowdown':
                this.input.backward = true;
                break;
            case 'a':
            case 'arrowleft':
                this.input.left = true;
                break;
            case 'd':
            case 'arrowright':
                this.input.right = true;
                break;
            case 'shift':
                this.input.run = true;
                break;
            case ' ':
            case 'enter':
                this.input.attack = true;
                break;
        }
    }
    
    onKeyUp(e) {
        const key = e.key.toLowerCase();
        
        switch(key) {
            case 'w':
            case 'arrowup':
                this.input.forward = false;
                break;
            case 's':
            case 'arrowdown':
                this.input.backward = false;
                break;
            case 'a':
            case 'arrowleft':
                this.input.left = false;
                break;
            case 'd':
            case 'arrowright':
                this.input.right = false;
                break;
            case 'shift':
                this.input.run = false;
                break;
            case ' ':
            case 'enter':
                this.input.attack = false;
                break;
        }
    }
    
    // ========== CAMERA ==========
    
    setupCamera() {
        // Camera fissa dall'alto
        this.cameraOffset = new THREE.Vector3(0, 8, 10);
        this.cameraLookOffset = new THREE.Vector3(0, 0, 0);
    }
    
    updateCamera() {
        if (!this.camera || !this.model) return;
        
        // Camera segue esattamente il modello senza lag
        this.camera.position.x = this.position.x + this.cameraOffset.x;
        this.camera.position.y = this.position.y + this.cameraOffset.y;
        this.camera.position.z = this.position.z + this.cameraOffset.z;
        
        const lookAt = new THREE.Vector3(
            this.position.x + this.cameraLookOffset.x,
            this.position.y + this.cameraLookOffset.y,
            this.position.z + this.cameraLookOffset.z
        );
        this.camera.lookAt(lookAt);
    }
    
    // ========== UPDATE PRINCIPALE ==========
    
    update(deltaTime) {
        if (!this.model) return;
        
        // Update input
        this.updateInput();
        
        // Update stato
        this.updateStateMachine(deltaTime);
        
        // Update in base allo stato corrente
        switch (this.stateMachine.getState()) {
            case PlayerStates.IDLE:
                this.updateIdle(deltaTime);
                break;
            case PlayerStates.WALKING:
                this.updateWalking(deltaTime);
                break;
            case PlayerStates.RUNNING:
                this.updateRunning(deltaTime);
                break;
            case PlayerStates.ATTACKING:
                this.updateAttacking(deltaTime);
                break;
            case PlayerStates.HURT:
                this.updateHurt(deltaTime);
                break;
            case PlayerStates.DEAD:
                this.updateDead(deltaTime);
                break;
        }
        
        // Update fisica
        this.updatePhysics(deltaTime);
        
        // Update modello
        this.updateModel(deltaTime);
        
        // Update animazioni
        if (this.mixer) {
            this.mixer.update(deltaTime);
            
            // IMPORTANTE: Resetta la posizione del root bone dopo l'update dell'animazione
            // Questo rimuove il root motion dall'animazione
            if (this.rootBone && this.rootBoneInitialPosition) {
                // Mantieni solo l'animazione verticale (Y) se presente, blocca X e Z
                this.rootBone.position.x = this.rootBoneInitialPosition.x;
                this.rootBone.position.z = this.rootBoneInitialPosition.z;
                // Opzionale: se vuoi bloccare anche il movimento verticale
                // this.rootBone.position.y = this.rootBoneInitialPosition.y;
            }
        }
        
        // Update camera
        this.updateCamera();
        
        // Update timers
        this.updateTimers(deltaTime);
    }
    
    // ========== INPUT ==========
    
    updateInput() {
        // Calcola il vettore di movimento normalizzato
        let moveX = 0;
        let moveZ = 0;
        
        if (this.input.forward) moveZ -= 1;
        if (this.input.backward) moveZ += 1;
        if (this.input.left) moveX -= 1;
        if (this.input.right) moveX += 1;
        
        // Normalizza per movimento diagonale
        if (moveX !== 0 && moveZ !== 0) {
            moveX *= 0.707;
            moveZ *= 0.707;
        }
        
        this.input.moveVector.set(moveX, moveZ);
    }
    
    // ========== MACCHINA A STATI ==========
    
    updateStateMachine(deltaTime) {
        this.stateMachine.update(deltaTime);
        
        const state = this.stateMachine.getState();
        const hasMovement = this.input.moveVector.length() > 0;
        
        // Transizioni di stato
        switch (state) {
            case PlayerStates.IDLE:
                if (this.input.attack && this.attackTimer <= 0) {
                    this.changeState(PlayerStates.ATTACKING);
                } else if (hasMovement) {
                    if (this.input.run) {
                        this.changeState(PlayerStates.RUNNING);
                    } else {
                        this.changeState(PlayerStates.WALKING);
                    }
                }
                break;
                
            case PlayerStates.WALKING:
                if (this.input.attack && this.attackTimer <= 0) {
                    this.changeState(PlayerStates.ATTACKING);
                } else if (!hasMovement) {
                    this.changeState(PlayerStates.IDLE);
                } else if (this.input.run) {
                    this.changeState(PlayerStates.RUNNING);
                }
                break;
                
            case PlayerStates.RUNNING:
                if (this.input.attack && this.attackTimer <= 0) {
                    this.changeState(PlayerStates.ATTACKING);
                } else if (!hasMovement) {
                    this.changeState(PlayerStates.IDLE);
                } else if (!this.input.run) {
                    this.changeState(PlayerStates.WALKING);
                }
                break;
                
            case PlayerStates.ATTACKING:
                // L'attacco finisce dopo un certo tempo
                if (this.stateMachine.getStateTime() > this.config.attackCooldown) {
                    if (hasMovement) {
                        this.changeState(this.input.run ? PlayerStates.RUNNING : PlayerStates.WALKING);
                    } else {
                        this.changeState(PlayerStates.IDLE);
                    }
                }
                break;
                
            case PlayerStates.HURT:
                // Recupera dopo essere stato colpito
                if (this.stateMachine.getStateTime() > 0.5) {
                    this.changeState(PlayerStates.IDLE);
                }
                break;
        }
    }
    
    changeState(newState) {
        if (this.stateMachine.changeState(newState)) {
            console.log(`Stato cambiato: ${this.stateMachine.previousState} -> ${newState}`);
            this.onStateEnter(newState);
        }
    }
    
    onStateEnter(state) {
        console.log(`Entrato nello stato: ${state}`);
        
        // Cambia animazione quando entra in un nuovo stato
        if (this.animations[state]) {
            // Per l'attacco, non fare loop
            if (state === PlayerStates.ATTACKING) {
                this.playAnimation(state, false); // false = no loop
            } else {
                this.playAnimation(state, true);  // true = loop
            }
        } else {
            console.warn(`Nessuna animazione disponibile per lo stato ${state}`);
            // Se non c'è animazione per questo stato, prova a usare idle come fallback
            if (state !== PlayerStates.IDLE && this.animations[PlayerStates.IDLE]) {
                console.log('Uso idle come fallback');
                this.playAnimation(PlayerStates.IDLE);
            }
        }
        
        // Azioni specifiche per stato
        switch (state) {
            case PlayerStates.ATTACKING:
                this.attackTimer = this.config.attackCooldown;
                this.performAttack(); // Esegui la logica dell'attacco
                break;
        }
    }
    
    // Metodo per eseguire l'attacco (danno ai nemici, effetti, ecc.)
    performAttack() {
        console.log('Eseguo attacco!');
        
        // Qui puoi aggiungere:
        // - Controllo collisioni con nemici
        // - Applicazione danni
        // - Effetti particellari
        // - Suoni
        
        // Effetto visivo dell'attacco
        if (this.model) {
            // Crea un effetto "swoosh" per l'attacco
            const attackEffect = new THREE.Group();
            
            // Arco semi-trasparente per mostrare il raggio d'attacco
            // Invertito l'angolo per correggere la direzione
            const geometry = new THREE.RingGeometry(2, 3, 8, 1, 0, Math.PI);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x00ffff, 
                transparent: true, 
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            const arc = new THREE.Mesh(geometry, material);
            arc.rotation.x = -Math.PI / 2;
            arc.rotation.z = Math.PI; // Ruota di 180 gradi per correggere la direzione
            arc.position.y = 1;
            arc.position.z = -0.5; // Sposta leggermente in avanti
            
            attackEffect.add(arc);
            attackEffect.position.copy(this.position);
            attackEffect.rotation.y = this.model.rotation.y;
            
            this.scene.add(attackEffect);
            
            // Animazione fade out dell'effetto
            const fadeOutDuration = 300;
            const startTime = Date.now();
            
            const fadeOut = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / fadeOutDuration;
                
                if (progress < 1) {
                    material.opacity = 0.3 * (1 - progress);
                    requestAnimationFrame(fadeOut);
                } else {
                    this.scene.remove(attackEffect);
                }
            };
            
            fadeOut();
        }
    }
    
    // ========== UPDATE DEGLI STATI ==========
    
    updateIdle(deltaTime) {
        // Decelera gradualmente
        this.velocity.lerp(new THREE.Vector3(0, 0, 0), this.config.deceleration * deltaTime);
    }
    
    updateWalking(deltaTime) {
        const targetVelocity = new THREE.Vector3(
            this.input.moveVector.x * this.config.walkSpeed,
            0,
            this.input.moveVector.y * this.config.walkSpeed
        );
        
        this.velocity.lerp(targetVelocity, this.config.acceleration * deltaTime);
    }
    
    updateRunning(deltaTime) {
        const targetVelocity = new THREE.Vector3(
            this.input.moveVector.x * this.config.runSpeed,
            0,
            this.input.moveVector.y * this.config.runSpeed
        );
        
        this.velocity.lerp(targetVelocity, this.config.acceleration * deltaTime);
    }
    
    updateAttacking(deltaTime) {
        // Rallenta movimento durante l'attacco ma permetti una leggera mobilità
        const attackMoveSpeed = this.config.walkSpeed * 0.3; // 30% della velocità normale
        
        if (this.input.moveVector.length() > 0) {
            const targetVelocity = new THREE.Vector3(
                this.input.moveVector.x * attackMoveSpeed,
                0,
                this.input.moveVector.y * attackMoveSpeed
            );
            this.velocity.lerp(targetVelocity, this.config.acceleration * deltaTime * 0.5);
        } else {
            // Decelera più velocemente durante l'attacco
            this.velocity.lerp(new THREE.Vector3(0, 0, 0), this.config.deceleration * 2 * deltaTime);
        }
        
        // Controlla se l'animazione di attacco è finita
        if (this.currentAction) {
            const clipDuration = this.currentAction.getClip().duration;
            const currentTime = this.currentAction.time;
            
            // Se siamo negli ultimi frame dell'animazione e c'è input di attacco, concatena
            if (currentTime > clipDuration * 0.7 && this.input.attack) {
                // Reset per combo
                this.currentAction.reset();
                this.currentAction.play();
                this.attackTimer = this.config.attackCooldown;
                console.log('Combo attacco!');
            }
        }
    }
    
    updateHurt(deltaTime) {
        // Piccolo knockback
        this.velocity.lerp(new THREE.Vector3(0, 0, 0), this.config.deceleration * deltaTime);
    }
    
    updateDead(deltaTime) {
        this.velocity.set(0, 0, 0);
    }
    
    // ========== FISICA ==========
    
    updatePhysics(deltaTime) {
        // Applica velocità alla posizione
        this.position.x += this.velocity.x * deltaTime;
        this.position.z += this.velocity.z * deltaTime;
        
        // Limiti del mondo
        const worldLimit = 98;
        this.position.x = Math.clamp(this.position.x, -worldLimit, worldLimit);
        this.position.z = Math.clamp(this.position.z, -worldLimit, worldLimit);
    }
    
    // ========== MODELLO ==========
    
    updateModel(deltaTime) {
        if (!this.model) return;
        
        // Aggiorna posizione del modello
        this.model.position.copy(this.position);
        
        // Aggiorna rotazione se in movimento
        if (this.velocity.length() > 0.1) {
            this.targetRotation = Math.atan2(-this.velocity.x, -this.velocity.z) + Math.PI;
            
            // Interpola la rotazione
            let diff = this.targetRotation - this.model.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            
            this.model.rotation.y += diff * this.config.rotationSpeed * deltaTime;
        }
    }
    
    // ========== ANIMAZIONI ==========
    
    playAnimation(name, loop = true) {
        const newAction = this.animations[name];
        
        if (!newAction) {
            console.warn(`Animazione '${name}' non trovata. Animazioni disponibili:`, Object.keys(this.animations));
            return;
        }
        
        // Se è la stessa animazione e sta già girando, non fare nulla
        if (this.currentAction === newAction && newAction.isRunning()) {
            return;
        }
        
        console.log(`Cambio animazione a: ${name}`);
        
        // Transizione smooth
        if (this.currentAction && this.currentAction !== newAction) {
            this.currentAction.fadeOut(0.2);
        }
        
        newAction.reset();
        newAction.fadeIn(0.2);
        
        if (loop) {
            newAction.setLoop(THREE.LoopRepeat);
        } else {
            newAction.setLoop(THREE.LoopOnce);
            newAction.clampWhenFinished = true;
        }
        
        newAction.play();
        this.currentAction = newAction;
        
        console.log(`Animazione ${name} avviata con successo`);
    }
    
    // ========== TIMERS ==========
    
    updateTimers(deltaTime) {
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
        }
    }
    
    // ========== COMBAT ==========
    
    takeDamage(amount) {
        if (this.stateMachine.isState(PlayerStates.DEAD)) return;
        
        this.config.health -= amount;
        this.config.health = Math.max(0, this.config.health);
        
        if (this.config.health <= 0) {
            this.changeState(PlayerStates.DEAD);
        } else {
            this.changeState(PlayerStates.HURT);
        }
        
        // Flash rosso
        if (this.model) {
            this.model.traverse((child) => {
                if (child.isMesh && child.material) {
                    const originalColor = child.material.color.clone();
                    child.material.color.setHex(0xff0000);
                    setTimeout(() => {
                        child.material.color.copy(originalColor);
                    }, 100);
                }
            });
        }
    }
    
    // ========== GETTERS ==========
    
    getPosition() {
        return this.position.clone();
    }
    
    getHealth() {
        return this.config.health;
    }
    
    getMaxHealth() {
        return this.config.maxHealth;
    }
    
    getCurrentState() {
        return this.stateMachine.getState();
    }
    
    isAlive() {
        return !this.stateMachine.isState(PlayerStates.DEAD);
    }
    
    isAttacking() {
        return this.stateMachine.isState(PlayerStates.ATTACKING);
    }
    
    getAttackRange() {
        return this.config.attackRange;
    }
    
    getAttackDamage() {
        return this.config.attackDamage;
    }
}

// Utility per clamp
Math.clamp = function(value, min, max) {
    return Math.min(Math.max(value, min), max);
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
}