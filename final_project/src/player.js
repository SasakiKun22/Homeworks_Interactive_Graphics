// player.js - Gestione del giocatore con FSM (Finite State Machine)

// Enum per gli stati del giocatore
const PlayerStates = {
    IDLE: 'idle',
    WALKING: 'walking',
    RUNNING: 'running',
    ATTACKING: 'attacking',
    CASTING_HEAL: 'heal',
    CASTING_SHIELD: 'shield',
    CASTING_ULTY: 'ulty',
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
            attackRange: 5,          // Raggio d'azione dell'attacco
            attackComboWindow: 0.5,  // Finestra per concatenare attacchi
            collisionRadius: 1,
            attackDamageTime: 0.5,

            healSpellCooldown: 1.2,        // Durata dell'animazione spell di cura
            healSpellAmount: 30,            // Quantità di vita curata
            healSpellCastTime: 0.5,         // Quando nell'animazione avviene la cura (60%)

            shieldCooldown: 1.2,
            shieldCastTime: 0.5,

            ultyCooldown: 1.2,         // Durata dell'animazione ultimate
            ultyDamage: 100,           // Danno dell'ultimate
            ultyRange: 15,             // Distanza che percorre il muro
            ultyCastTime: 0.5,         // Quando nell'animazione viene lanciata (50%)
        };

        this.score = 0;
        
        // Input
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            run: false,
            attack: false,
            healSpell: false,
            shieldSpell: false,
            ulty: false,
            moveVector: new THREE.Vector2(0, 0)
        };
        
        // Timers
        this.attackTimer = 0;
        
        this.killCount = 0; // Contatore totale nemici uccisi
        this.lastHealKills = -7;      // Nemici uccisi quando ho usato l'ultima cura
        this.lastShieldKills = -5;    // Nemici uccisi quando ho usato l'ultimo scudo
        this.lastFireWallKills = -10;  // Nemici uccisi quando ho usato l'ultimo muro di fuoco

        this.spellNotified = {
            shield: true,   // Se è già stata mostrata la notifica per lo scudo
            heal: true,     // Se è già stata mostrata la notifica per la cura
            fireWall: true  // Se è già stata mostrata la notifica per il muro di fuoco
        };

        this.spellKillRequirements = {
            shield: 5,    // Scudo si ricarica dopo 5 kill
            heal: 7,      // Cura si ricarica dopo 7 kill  
            fireWall: 10  // Muro di fuoco si ricarica dopo 10 kill
        };

        this.healingSpell = null;
        this.iceShield = null;
        this.isShieldActive = false;
        this.activeIceShields = [];
        this.fireWall = null;
        this.activeFireWalls = [];

        // Setup
        this.setupControls();
        this.initHealthUI();
        this.initScoreUI();
        this.initSpellCooldownUI();
        this.clock = new THREE.Clock();
        this.loadModel();
    }
    
    // ========== CARICAMENTO MODELLO ==========
    
    loadModel() {
        if (typeof THREE.FBXLoader === 'undefined') {
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
            }
        });
        
        this.setupAnimations(fbx);
        this.scene.add(this.model);
        this.setupCamera();
    }
    
    setupAnimations(fbx) {
        this.mixer = new THREE.AnimationMixer(fbx);
        
        if (fbx.animations && fbx.animations.length > 0) {
            
            // Per animazioni Mixamo
            if (fbx.animations[0].name === 'mixamo.com') {
                const action = this.mixer.clipAction(fbx.animations[0]);
                this.animations[PlayerStates.IDLE] = action;
                this.loadSeparateAnimations();
            }
        } else {
            this.loadSeparateAnimations();
        }
    }
    
    loadSeparateAnimations() {
        const animationFiles = {
            [PlayerStates.IDLE]: '../models/paladin/Idle.fbx',
            [PlayerStates.WALKING]: '../models/paladin/Walk.fbx',
            [PlayerStates.RUNNING]: '../models/paladin/Run.fbx',
            [PlayerStates.ATTACKING]: '../models/paladin/Slash.fbx',
            [PlayerStates.CASTING_HEAL]: '../models/paladin/Casting_1.fbx',
            [PlayerStates.CASTING_SHIELD]: '../models/paladin/Casting_1.fbx',
            [PlayerStates.CASTING_ULTY]: '../models/paladin/Casting_2.fbx',
            [PlayerStates.HURT]: '../models/paladin/Hurt.fbx',
            [PlayerStates.DEAD]: '../models/paladin/Death.fbx',
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
                                        
                        // Se è l'animazione di attacco, verifica i frame
                        if (state === PlayerStates.ATTACKING) {
                            const fps = clip.tracks[0]?.times ? 
                                clip.tracks[0].times.length / clip.duration : 30;                            
                            // Aggiorna la durata dell'attacco basandosi sulla clip reale
                            this.config.attackCooldown = clip.duration;
                        }
                        
                        const action = this.mixer.clipAction(clip, this.model);
                        this.animations[state] = action;

                        // Se è idle, avviala immediatamente
                        if (state === PlayerStates.IDLE) {
                            this.playAnimation(PlayerStates.IDLE);
                        }
                        
                        loadedCount++;
                    }
                },
                (progress) => {
                    if (progress.lengthComputable) {
                        const percentComplete = progress.loaded / progress.total * 100;
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
            case 'e':
                this.input.healSpell = true;
                break;
            case 'q':
                this.input.shieldSpell = true;
                break;
            case 'r':
                this.input.ulty = true;
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
            case 'e':
                this.input.healSpell = false;
                break;
            case 'q':
                this.input.shieldSpell = false;
                break;
            case 'r':
                this.input.ulty = false;
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
            case PlayerStates.CASTING_HEAL:
                this.updateCastingHealSpell(deltaTime);
                break;
            case PlayerStates.CASTING_SHIELD:
                this.updateCastingShieldSpell(deltaTime);
                break;
            case PlayerStates.CASTING_ULTY:
                this.updateCastingUlty(deltaTime);
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

        if (this.healingSpell) {
            this.healingSpell.update(deltaTime, this.position);
        }

        if (this.iceShield) {
            this.iceShield.update(deltaTime, this.position);
        }

        if (this.fireWall) {
            this.fireWall.update(deltaTime);
        }
        
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
                // Priorità: Ultimate > Cura > Attacco > Movimento
                if (this.input.ulty && this.canUseFireWall()) {
                    this.changeState(PlayerStates.CASTING_ULTY);
                } else if (this.input.healSpell &&  this.canUseHeal()) {
                    this.changeState(PlayerStates.CASTING_HEAL);
                } else if (this.input.shieldSpell && this.canUseShield()) {
                    this.changeState(PlayerStates.CASTING_SHIELD);
                } else if (this.input.attack && this.attackTimer <= 0) {
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
                if (this.input.ulty && this.canUseFireWall()) {
                    this.changeState(PlayerStates.CASTING_ULTY);
                } else if (this.input.healSpell && this.canUseHeal()) {
                    this.changeState(PlayerStates.CASTING_HEAL);
                } else if (this.input.shieldSpell && this.canUseShield()) {
                    this.changeState(PlayerStates.CASTING_SHIELD);
                } else if (this.input.attack && this.attackTimer <= 0) {
                    this.changeState(PlayerStates.ATTACKING);
                } else if (!hasMovement) {
                    this.changeState(PlayerStates.IDLE);
                } else if (this.input.run) {
                    this.changeState(PlayerStates.RUNNING);
                }
                break;
                
            case PlayerStates.RUNNING:
                if (this.input.ulty && this.canUseFireWall()) {
                    this.changeState(PlayerStates.CASTING_ULTY);
                } else if (this.input.healSpell && this.canUseHeal()) {
                    this.changeState(PlayerStates.CASTING_HEAL);
                } else if (this.input.shieldSpell && this.canUseShield()) {
                    this.changeState(PlayerStates.CASTING_SHIELD);
                } else if (this.input.attack && this.attackTimer <= 0) {
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
                
            case PlayerStates.CASTING_HEAL:
                // La spell di cura finisce dopo un certo tempo
                if (this.stateMachine.getStateTime() > this.config.healSpellCooldown) {
                    if (hasMovement) {
                        this.changeState(this.input.run ? PlayerStates.RUNNING : PlayerStates.WALKING);
                    } else {
                        this.changeState(PlayerStates.IDLE);
                    }
                }
                break;
            
            case PlayerStates.CASTING_SHIELD:
                // La spell di scudo finisce dopo un certo tempo
                if (this.stateMachine.getStateTime() > this.config.shieldCooldown) {
                    if (hasMovement) {
                        this.changeState(this.input.run ? PlayerStates.RUNNING : PlayerStates.WALKING);
                    } else {
                        this.changeState(PlayerStates.IDLE);
                    }
                }
                break;
            
            case PlayerStates.CASTING_ULTY:
                // L'ultimate finisce dopo un certo tempo
                if (this.stateMachine.getStateTime() > this.config.ultyCooldown) {
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
            this.onStateEnter(newState);
        }
    }
    
    onStateEnter(state) {        
        // Cambia animazione quando entra in un nuovo stato
        if (this.animations[state]) {
            // Per attacchi e spell, non fare loop
            if (state === PlayerStates.ATTACKING || 
                state === PlayerStates.CASTING_HEAL || 
                state === PlayerStates.CASTING_SHIELD ||
                state === PlayerStates.CASTING_ULTY || 
                state === PlayerStates.DEAD) {
                this.playAnimation(state, false); // false = no loop
            } else {
                this.playAnimation(state, true);  // true = loop
            }
        } else {
            console.warn(`Nessuna animazione disponibile per lo stato ${state}`);
            if (state !== PlayerStates.IDLE && this.animations[PlayerStates.IDLE]) {
                console.log('Uso idle come fallback');
                this.playAnimation(PlayerStates.IDLE);
            }
        }
        
        // Azioni specifiche per stato
        switch (state) {
            case PlayerStates.ATTACKING:
                this.attackTimer = this.config.attackCooldown;
                this.hasDealtDamage = false;
                break;
                
            case PlayerStates.CASTING_HEAL:
                this.lastHealKills = this.killCount;
                this.spellNotified.heal = false;
                this.hasPerformedHeal = false;
                this.updateSpellCooldownUI();
                console.log('Lancio spell di cura!');
                // Inizia immediatamente l'effetto visivo delle spirali
                this.startHealingSpirals();
                break;
            
            case PlayerStates.CASTING_SHIELD:
                this.isShieldActive = true;
                if (this.isShieldActive){
                    this.lastShieldKills = this.killCount;
                }
                this.spellNotified.shield = false;
                this.hasPerformedShield = false;
                this.updateSpellCooldownUI();
                console.log('Lancio scudo di ghiaccio!');
                this.startShieldCastEffect();
                break;
                
            case PlayerStates.CASTING_ULTY:
                this.lastFireWallKills = this.killCount;
                this.spellNotified.fireWall = false;
                this.hasDealtUltyDamage = false;
                this.updateSpellCooldownUI();
                console.log('Lancio ULTIMATE!');
                break;
        }
    }

    canUseShield() {
        
        if (this.isShieldActive) {
            return false;
        }
        
        const killsSinceLastUse = this.killCount - this.lastShieldKills;
        return killsSinceLastUse >= this.spellKillRequirements.shield;
    }

    canUseHeal() {
        const killsSinceLastUse = this.killCount - this.lastHealKills;
        return killsSinceLastUse >= this.spellKillRequirements.heal;
    }

    canUseFireWall() {
        const killsSinceLastUse = this.killCount - this.lastFireWallKills;
        return killsSinceLastUse >= this.spellKillRequirements.fireWall;
    }
    
    // Metodo per eseguire l'attacco (danno ai nemici, effetti, ecc.)
    performAttack() {
        // Controlla collisioni con nemici e applica danno
        if (window.enemies && window.enemies.length > 0) {
            const attackPosition = this.position.clone();
            const attackRange = this.config.attackRange;
            let enemiesHit = 0;
            
            window.enemies.forEach(enemy => {
                if (enemy && enemy.isAlive()) {
                    const enemyPosition = enemy.getPosition();
                    const distance = attackPosition.distanceTo(enemyPosition);
                    
                    // Controlla se il nemico è nel range
                    if (distance <= attackRange) {
                        // Calcola direzione verso il nemico
                        const toEnemy = new THREE.Vector3()
                            .subVectors(enemyPosition, attackPosition)
                            .normalize();
                        
                        // CORREZIONE: Usa la rotazione del modello invece di this.rotation
                        let playerRotation = 0;
                        if (this.model) {
                            playerRotation = this.model.rotation.y;
                        } else {
                            playerRotation = this.rotation || 0;
                        }
                        
                        // CORREZIONE: Formula corretta per la direzione in cui guarda il player
                        // Quando rotation.y = 0, il player guarda verso -Z
                        // Quando rotation.y = PI/2, il player guarda verso -X
                        // Quando rotation.y = PI, il player guarda verso +Z
                        // Quando rotation.y = -PI/2, il player guarda verso +X
                        const playerForward = new THREE.Vector3(
                            Math.sin(playerRotation),
                            0,
                            Math.cos(playerRotation)
                        );
                        
                        // Calcola l'angolo tra la direzione del player e il nemico
                        const dotProduct = playerForward.dot(toEnemy);
                        
                        // Se il nemico è nel cono frontale (circa 140 gradi = più generoso)
                        if (dotProduct > -0.2) { // cos(140°) ≈ -0.2, più permissivo di -0.5
                            // Applica danno al nemico
                            enemy.takeDamage(this.config.attackDamage, attackPosition);
                            enemiesHit++;
                            
                            // Effetto di impatto sul nemico
                            this.createHitEffect(enemyPosition);
                        } else {
                            console.log(`✗ Nemico fuori dal cono di attacco (dot: ${dotProduct.toFixed(2)})`);
                        }
                    } else {
                        console.log(`✗ Nemico troppo lontano (${distance.toFixed(2)} > ${attackRange})`);
                    }
                }
            });
            
            if (enemiesHit === 0) {
                console.log('⚠ Nessun nemico colpito');
            }
        } else {
            console.log('⚠ Nessun nemico trovato');
        }
    }
    
    // Effetto visivo quando colpisci un nemico
    createHitEffect(position) {
        // Crea particelle o flash per indicare l'impatto
        const hitGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const hitMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const hitFlash = new THREE.Mesh(hitGeometry, hitMaterial);
        hitFlash.position.copy(position);
        hitFlash.position.y = 1;
        
        this.scene.add(hitFlash);
        
        // Animazione espansione e fade
        const animateHit = () => {
            hitFlash.scale.multiplyScalar(1.1);
            hitMaterial.opacity *= 0.9;
            
            if (hitMaterial.opacity > 0.01) {
                requestAnimationFrame(animateHit);
            } else {
                this.scene.remove(hitFlash);
                hitGeometry.dispose();
                hitMaterial.dispose();
            }
        };
        
        animateHit();
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
        
        // Calcola quando applicare il danno basandosi sul tempo dell'animazione
        const attackProgress = this.stateMachine.getStateTime() / this.config.attackCooldown;
        const damageTimingPercent = this.config.attackDamageTime; // Usa il valore configurabile
        
        // Applica il danno solo una volta al momento giusto dell'animazione
        if (attackProgress >= damageTimingPercent && !this.hasDealtDamage) {
            console.log(`Danno applicato al ${(damageTimingPercent * 100).toFixed(0)}% dell'animazione`);
            this.performAttack();
            this.hasDealtDamage = true;
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
                this.hasDealtDamage = false; // Reset per il prossimo colpo
                console.log('Combo attacco!');
            }
        }
    }

    // Update della spell di cura
    updateCastingHealSpell(deltaTime) {
        // Quasi immobile durante il cast
        const castMoveSpeed = this.config.walkSpeed * 0.15; // 15% della velocità normale
        
        if (this.input.moveVector.length() > 0) {
            const targetVelocity = new THREE.Vector3(
                this.input.moveVector.x * castMoveSpeed,
                0,
                this.input.moveVector.y * castMoveSpeed
            );
            this.velocity.lerp(targetVelocity, this.config.acceleration * deltaTime * 0.3);
        } else {
            this.velocity.lerp(new THREE.Vector3(0, 0, 0), this.config.deceleration * 3 * deltaTime);
        }
        
        // Calcola quando applicare la cura
        const healProgress = this.stateMachine.getStateTime() / this.config.healSpellCooldown;
        
        if (healProgress >= this.config.healSpellCastTime && !this.hasPerformedHeal) {
            this.performHealSpell();
            this.hasPerformedHeal = true;
        }
    }

    updateCastingShieldSpell(deltaTime) {
        // Quasi immobile durante il cast
        const castMoveSpeed = this.config.walkSpeed * 0.1; // 10% della velocità normale
        
        if (this.input.moveVector.length() > 0) {
            const targetVelocity = new THREE.Vector3(
                this.input.moveVector.x * castMoveSpeed,
                0,
                this.input.moveVector.y * castMoveSpeed
            );
            this.velocity.lerp(targetVelocity, this.config.acceleration * deltaTime * 0.2);
        } else {
            this.velocity.lerp(new THREE.Vector3(0, 0, 0), this.config.deceleration * 4 * deltaTime);
        }
        
        // Calcola quando applicare lo scudo
        const shieldProgress = this.stateMachine.getStateTime() / this.config.shieldCooldown;
        
        if (shieldProgress >= this.config.shieldCastTime && !this.hasPerformedShield) {
            this.performShieldSpell();
            this.hasPerformedShield = true;
        }
    }


    updateCastingUlty(deltaTime) {
        // Quasi immobile durante il cast
        const castMoveSpeed = this.config.walkSpeed * 0.15;
        
        if (this.input.moveVector.length() > 0) {
            const targetVelocity = new THREE.Vector3(
                this.input.moveVector.x * castMoveSpeed,
                0,
                this.input.moveVector.y * castMoveSpeed
            );
            this.velocity.lerp(targetVelocity, this.config.acceleration * deltaTime * 0.3);
        } else {
            this.velocity.lerp(new THREE.Vector3(0, 0, 0), this.config.deceleration * 3 * deltaTime);
        }
        
        // Calcola quando lanciare l'ultimate
        const ultyProgress = this.stateMachine.getStateTime() / this.config.ultyCooldown;
        
        if (ultyProgress >= this.config.ultyCastTime && !this.hasDealtUltyDamage) {
            this.performUltimate();
            this.hasDealtUltyDamage = true;
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
        // Salva la posizione precedente
        const previousPosition = this.position.clone();
        
        // Applica velocità alla posizione
        this.position.x += this.velocity.x * deltaTime;
        this.position.z += this.velocity.z * deltaTime;
        
        // Controlla collisioni con i nemici
        if (window.enemies) {
            const playerRadius = 1; // Raggio di collisione del player
            
            window.enemies.forEach(enemy => {
                if (enemy.isAlive()) {
                    const enemyPos = enemy.getPosition();
                    const distance = this.position.distanceTo(enemyPos);
                    const enemyRadius = enemy.config.collisionRadius || enemy.config.size * 0.8;
                    const minDistance = playerRadius + enemyRadius;
                    
                    if (distance < minDistance && distance > 0) {
                        // Calcola la direzione di push
                        const pushDirection = new THREE.Vector3()
                            .subVectors(this.position, enemyPos)
                            .normalize();
                        
                        // Sposta SOLO il player, non il nemico
                        const overlap = minDistance - distance;
                        this.position.add(pushDirection.multiplyScalar(overlap));
                        
                        // Ferma completamente il movimento del player in quella direzione
                        // Questo crea una sensazione di "muro solido"
                        const velocityDot = this.velocity.dot(pushDirection.negate());
                        if (velocityDot > 0) {
                            // Il player sta andando verso il nemico, ferma quella componente
                            this.velocity.sub(pushDirection.negate().multiplyScalar(velocityDot));
                            
                            // Aggiungi un po' di "rimbalzo" per feedback
                            this.velocity.add(pushDirection.negate().multiplyScalar(-2));
                        }
                        
                        // Rallenta il player quando colpisce un nemico
                        this.velocity.multiplyScalar(0.3);
                    }
                }
            });
        }
        
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
    }

    // Esegue la spell di cura
    performHealSpell() {
        const previousHealth = this.config.health;
        this.config.health = Math.min(this.config.health + this.config.healSpellAmount, this.config.maxHealth);
        const actualHealed = this.config.health - previousHealth;
        
        if (actualHealed > 0) {
            console.log(`Curato di ${actualHealed} HP! Salute: ${this.config.health}/${this.config.maxHealth}`);
            
            // Aggiorna l'UI della salute
            this.updateHealthUI();
            
            // Crea popup verde per mostrare la cura
            this.createHealPopup(actualHealed);
            
        } else {
            console.log('Già a salute piena!');
        }
    }

    // Crea le spirali verdi che avvolgono il personaggio
    startHealingSpirals() {
        // Non serve più - ora usiamo il sistema WebGL
        console.log('💚 Avvio effetto di cura WebGL...');
        
        // Inizializza HealingSpell se non esiste
        if (!this.healingSpell) {
            this.initHealingSpell();
        }
        
        if (!this.healingSpell) {
            console.error('❌ HealingSpell non disponibile!');
            return;
        }
        
        // Configurazione dell'effetto di cura
        const healingConfig = {
            duration: this.config.healSpellCooldown * 1000, // Durata in millisecondi
            radius: 2,    // Raggio dell'effetto
            height: 4     // Altezza dell'effetto
        };
        
        // Crea l'effetto di cura WebGL
        const healingId = this.healingSpell.createHealingEffect( // ← QUI: chiama metodo createHealingEffect dal file HealingSpell.js
            this.position,
            healingConfig
        );
        
        // Crea il cerchio verde sotto al player
        this.createHealingCircleEffect();
        
        console.log(`💚 Effetto di cura WebGL ${healingId} creato!`);
    }

    createHealingCircleEffect() {
        if (!this.model) return;
        
        // Cerchio verde di cura intorno al player
        const circleGeometry = new THREE.RingGeometry(1.5, 2.5, 16);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0x22aa44, // Verde cura
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        const healCircle = new THREE.Mesh(circleGeometry, circleMaterial);
        
        healCircle.position.copy(this.position);
        healCircle.position.y = 0.1;
        healCircle.rotation.x = -Math.PI / 2;
        
        this.scene.add(healCircle);
        
        // Animazione del cerchio
        const startTime = Date.now();
        const animateCircle = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / (this.config.healSpellCooldown * 1000); // Durata della spell
            
            if (progress < 1) {
                const scale = 1 + progress * 0.4;
                healCircle.scale.set(scale, scale, scale);
                circleMaterial.opacity = 0.7 * (1 - progress);
                healCircle.rotation.z += 0.03; // Rotazione lenta in senso orario
                requestAnimationFrame(animateCircle);
            } else {
                this.scene.remove(healCircle);
                circleGeometry.dispose();
                circleMaterial.dispose();
            }
        };
        
        animateCircle();
    }

    // Crea popup per mostrare i punti vita curati
    createHealPopup(amount) {
        const popup = document.createElement('div');
        
        // Posiziona il popup sopra la barra della vita
        popup.style.cssText = `
            position: fixed;
            left: 160px;
            top: 35px;
            color: #00ff88;
            font-size: 22px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,255,136,0.5);
            z-index: 1001;
            pointer-events: none;
            animation: floatUp 2s ease-out forwards;
        `;
        popup.textContent = `+${amount} HP`;
        
        document.body.appendChild(popup);
        
        // Rimuovi dopo l'animazione (stesso tempo dell'effetto WebGL)
        setTimeout(() => {
            popup.remove();
        }, 2000);
    }

    performShieldSpell() {
        console.log('❄️ Creazione scudo di ghiaccio!');
        
        // Controlla se esiste già uno scudo attivo
        if (this.iceShield && this.iceShield.getActiveShieldsCount() > 0) {
            console.log('❄️ Scudo già attivo, impossibile crearne un altro');
            return;
        }
        
        // Inizializza IceShield se non esiste
        if (!this.iceShield) {
            this.initIceShield();
        }
        
        if (!this.iceShield) {
            console.error('❌ IceShield non disponibile!');
            return;
        }
        
        // Configurazione dello scudo (durata rimossa, persistente fino al danno)
        const shieldConfig = {
            radius: 3,      // Raggio di protezione
            height: 4       // Altezza dello scudo
        };
        
        // Crea lo scudo di ghiaccio
        const shieldId = this.iceShield.createIceShield( // ← QUI: chiama metodo createIceShield dal file IceShield.js
            this.position,
            shieldConfig
        );
        
        // Aggiungi alla lista degli scudi attivi
        this.activeIceShields.push({
            id: shieldId,
            startTime: Date.now()
        });
        
        console.log(`❄️ Scudo di ghiaccio ${shieldId} creato e rimarrà attivo fino al primo danno!`);
    }

    // 7. Aggiungi i metodi per gli effetti visivi del cast:
    startShieldCastEffect() {
        if (!this.model) return;
        
        // Cerchio di ghiaccio intorno al player
        const circleGeometry = new THREE.RingGeometry(1.5, 2.5, 12);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff, // Blu normale per l'effetto di cast
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const iceCircle = new THREE.Mesh(circleGeometry, circleMaterial);
        
        iceCircle.position.copy(this.position);
        iceCircle.position.y = 0.1;
        iceCircle.rotation.x = -Math.PI / 2;
        
        this.scene.add(iceCircle);
        
        // Animazione del cerchio
        const startTime = Date.now();
        const animateCircle = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 1500; // 1.5 secondi
            
            if (progress < 1) {
                const scale = 1 + progress * 0.3;
                iceCircle.scale.set(scale, scale, scale);
                circleMaterial.opacity = 0.6 * (1 - progress);
                iceCircle.rotation.z -= 0.05; // Rotazione opposta al fuoco
                requestAnimationFrame(animateCircle);
            } else {
                this.scene.remove(iceCircle);
                circleGeometry.dispose();
                circleMaterial.dispose();
            }
        };
        
        animateCircle();
        this.createShieldCastParticles();
    }

    createShieldCastParticles() {
        for (let i = 0; i < 25; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.15, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.6 + Math.random() * 0.1, 0.8, 0.7), // Blu-ciano normale per cast
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            const angle = (i / 25) * Math.PI * 2;
            const radius = 0.8 + Math.random() * 1.5;
            const height = Math.random() * 2.5;
            
            particle.position.set(
                this.position.x + Math.cos(angle) * radius,
                this.position.y + height,
                this.position.z + Math.sin(angle) * radius
            );
            
            const velocity = new THREE.Vector3(
                Math.cos(angle) * (1 + Math.random() * 2), // Movimento più lento
                1 + Math.random() * 3,
                Math.sin(angle) * (1 + Math.random() * 2)
            );
            
            this.scene.add(particle);
            
            const animateParticle = () => {
                particle.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.multiplyScalar(0.96); // Rallenta più velocemente
                velocity.y -= 0.05; // Meno gravità
                particleMaterial.opacity -= 0.015;
                
                if (particleMaterial.opacity > 0) {
                    requestAnimationFrame(animateParticle);
                } else {
                    this.scene.remove(particle);
                    particleGeometry.dispose();
                    particleMaterial.dispose();
                }
            };
            
            setTimeout(animateParticle, Math.random() * 300);
        }
    }

    createShieldBlockFeedback() {
        // Flash blu sul modello
        if (this.model) {
            this.model.traverse((child) => {
                if (child.isMesh && child.material) {
                    const originalColor = child.material.color.clone();
                    child.material.color.setHex(0x4488ff); // Blu ghiaccio
                    setTimeout(() => {
                        child.material.color.copy(originalColor);
                    }, 150);
                }
            });
        }
        
        // Popup di blocco
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            left: 50%;
            top: 40%;
            transform: translateX(-50%);
            color: #4488ff;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            z-index: 1001;
            pointer-events: none;
            animation: floatUp 1.5s ease-out forwards;
        `;
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            popup.remove();
        }, 1500);
    }
    
    performUltimate() {
        console.log('🔥 ULTIMATE: Muro di Fuoco lanciato!');
        
        // Inizializza FireWall se non esiste
        if (!this.fireWall) {
            this.initFireWall();
        }
        
        if (!this.fireWall) {
            console.error('❌ FireWall non disponibile!');
            return;
        }
        
        // Calcola la direzione in cui sta guardando il player
        let playerDirection;
        if (this.model) {
            const rotation = this.model.rotation.y;
            playerDirection = new THREE.Vector3(
                Math.sin(rotation),
                0,
                Math.cos(rotation)
            );
        } else {
            if (this.velocity.length() > 0.1) {
                playerDirection = this.velocity.clone().normalize();
                playerDirection.y = 0;
            } else {
                playerDirection = new THREE.Vector3(0, 0, -1);
            }
        }
        
        // Posizione di spawn del muro (leggermente davanti al player)
        const spawnDistance = 2;
        const spawnPosition = this.position.clone();
        spawnPosition.add(playerDirection.clone().multiplyScalar(spawnDistance));
        
        // Configurazione del muro di fuoco
        const fireWallConfig = {
            damage: this.config.ultyDamage,
            range: this.config.ultyRange,
            speed: 15,
            duration: 3000,
            width: 8,
            height: 4
        };
        
        // Crea il muro di fuoco
        const fireWallId = this.fireWall.createFireWall( // ← QUI: chiama metodo createFireWall dal file FireWall.js
            spawnPosition,
            playerDirection,
            fireWallConfig
        );
        
        // Aggiungi alla lista dei muri attivi
        this.activeFireWalls.push({
            id: fireWallId,
            startTime: Date.now()
        });
        
        // Effetto visivo sul player
        this.createUltimateStartEffect();
        
        console.log(`🔥 Muro di fuoco ${fireWallId} creato!`);
    }

    // 4. Aggiungi questi metodi DOPO performUltimate:
    createUltimateStartEffect() {
        if (!this.model) return;
        
        // Cerchio di fuoco intorno al player
        const circleGeometry = new THREE.RingGeometry(2, 3, 16);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const fireCircle = new THREE.Mesh(circleGeometry, circleMaterial);
        
        fireCircle.position.copy(this.position);
        fireCircle.position.y = 0.1;
        fireCircle.rotation.x = -Math.PI / 2;
        
        this.scene.add(fireCircle);
        
        // Animazione del cerchio
        const startTime = Date.now();
        const animateCircle = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 1000;
            
            if (progress < 1) {
                const scale = 1 + progress * 0.5;
                fireCircle.scale.set(scale, scale, scale);
                circleMaterial.opacity = 0.8 * (1 - progress);
                fireCircle.rotation.z += 0.1;
                requestAnimationFrame(animateCircle);
            } else {
                this.scene.remove(fireCircle);
                circleGeometry.dispose();
                circleMaterial.dispose();
            }
        };
        
        animateCircle();
        this.createUltimateCastParticles();
    }

    createUltimateCastParticles() {
        for (let i = 0; i < 30; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.2, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.1 + Math.random() * 0.1, 1, 0.5),
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            const angle = (i / 30) * Math.PI * 2;
            const radius = 1 + Math.random() * 2;
            const height = Math.random() * 3;
            
            particle.position.set(
                this.position.x + Math.cos(angle) * radius,
                this.position.y + height,
                this.position.z + Math.sin(angle) * radius
            );
            
            const velocity = new THREE.Vector3(
                Math.cos(angle) * (3 + Math.random() * 5),
                2 + Math.random() * 4,
                Math.sin(angle) * (3 + Math.random() * 5)
            );
            
            this.scene.add(particle);
            
            const animateParticle = () => {
                particle.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.multiplyScalar(0.98);
                velocity.y -= 0.1;
                particleMaterial.opacity -= 0.02;
                
                if (particleMaterial.opacity > 0) {
                    requestAnimationFrame(animateParticle);
                } else {
                    this.scene.remove(particle);
                    particleGeometry.dispose();
                    particleMaterial.dispose();
                }
            };
            
            setTimeout(animateParticle, Math.random() * 200);
        }
    }

    initHealingSpell() {
        if (!this.healingSpell && typeof HealingSpell !== 'undefined') {
            this.healingSpell = new HealingSpell(this.scene); // ← QUI: crea istanza della classe HealingSpell dal file HealingSpell.js
            console.log('✅ HealingSpell inizializzato');
        }
        return this.healingSpell;
    }

    initIceShield() {
        if (!this.iceShield && typeof IceShield !== 'undefined') {
            this.iceShield = new IceShield(this.scene); // ← QUI: crea istanza della classe IceShield dal file IceShield.js
            console.log('✅ IceShield inizializzato');
        }
        return this.iceShield;
    }

    initFireWall() {
        if (!this.fireWall && typeof FireWall !== 'undefined') {
            this.fireWall = new FireWall(this.scene); // ← QUI: crea istanza della classe FireWall dal file FireWall.js
            console.log('✅ FireWall inizializzato');
        }
        return this.fireWall;
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
        
        if (this.iceShield) {
            const protectingShield = this.iceShield.isPlayerProtected(this.position);
            if (protectingShield) {
                // Lo scudo blocca l'attacco
                this.iceShield.blockAttack(protectingShield.id);
                console.log('❄️ Attacco bloccato dallo scudo di ghiaccio!');
                
                // IMPORTANTE: Avvia il cooldown SOLO ORA che lo scudo è stato distrutto
                this.lastShieldKills = this.killCount;
                
                // IMPORTANTE: Lo scudo non è più attivo
                this.isShieldActive = false;
                console.log(`🛡️ Scudo distrutto! Flag attivo: ${this.isShieldActive}`);
                
                // RESETTA la notifica quando lo scudo viene consumato
                this.spellNotified.shield = false;
                console.log(`🛡️ Cooldown scudo avviato a kill: ${this.killCount}`);
                
                // Rimuovi lo scudo dalla lista degli scudi attivi del player
                this.activeIceShields = this.activeIceShields.filter(shield => shield.id !== protectingShield.id);
                
                // Aggiorna l'UI dei cooldown
                this.updateSpellCooldownUI();
                
                // Crea effetto visivo di blocco sul player
                this.createShieldBlockFeedback();
                return; // Non subire danno
            }
        }

        this.config.health -= amount;
        this.config.health = Math.max(0, this.config.health);
        
        // Aggiorna l'UI della salute
        this.updateHealthUI();
        
        // Effetto di shake quando subisce danno
        if (this.healthUI && this.healthUI.container) {
            this.healthUI.container.classList.add('damage-shake');
            setTimeout(() => {
                if (this.healthUI && this.healthUI.container) {
                    this.healthUI.container.classList.remove('damage-shake');
                }
            }, 300);
        }
        
        if (this.config.health <= 0) {
            this.changeState(PlayerStates.DEAD);
            
            // Rendi l'UI semi-trasparente quando muore
            if (this.healthUI && this.healthUI.container) {
                this.healthUI.container.style.opacity = '0.3';
            }
        } else {
            this.changeState(PlayerStates.HURT);
        }
        
        // Flash rosso sul modello
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
        
        console.log(`Player colpito! Danno: ${amount}, Salute: ${this.config.health}/${this.config.maxHealth}`);
    }

    initHealthUI() {
        // Prendi i riferimenti agli elementi HTML
        this.healthUI = {
            container: document.getElementById('player-health-ui'),
            bar: document.getElementById('player-health-bar'),
            text: document.getElementById('player-health-text')
        };
        
        // Mostra l'UI quando il gioco inizia
        if (this.healthUI.container) {
            setTimeout(() => {
                this.healthUI.container.classList.add('active');
            }, 500);
        }
        
        // Aggiorna l'UI iniziale
        this.updateHealthUI();
    }

    updateHealthUI() {
        if (!this.healthUI || !this.healthUI.bar) return;
        
        const healthPercent = Math.max(0, this.config.health / this.config.maxHealth);
        
        // Aggiorna la larghezza della barra
        this.healthUI.bar.style.width = `${healthPercent * 100}%`;
        
        // Aggiorna il testo
        if (this.healthUI.text) {
            this.healthUI.text.textContent = `${Math.ceil(this.config.health)}/${this.config.maxHealth}`;
        }
        
        // Rimuovi tutte le classi di stato precedenti
        this.healthUI.bar.classList.remove('high', 'medium', 'low', 'critical');
        
        // Aggiungi la classe appropriata in base alla percentuale di salute
        if (healthPercent > 0.6) {
            this.healthUI.bar.classList.add('high');
        } else if (healthPercent > 0.3) {
            this.healthUI.bar.classList.add('medium');
        } else if (healthPercent > 0.15) {
            this.healthUI.bar.classList.add('low');
        } else {
            this.healthUI.bar.classList.add('critical');
        }
    }

    // Inizializza l'UI del punteggio
    initScoreUI() {
        this.scoreUI = {
            container: document.getElementById('score-ui'),
            value: document.getElementById('score-value')
        };
        
        // Mostra l'UI del punteggio
        if (this.scoreUI.container) {
            setTimeout(() => {
                this.scoreUI.container.classList.add('active');
            }, 500);
        }
        
        // Inizializza il punteggio
        this.updateScoreUI();
    }

    // Aggiorna l'UI del punteggio
    updateScoreUI() {
        if (!this.scoreUI || !this.scoreUI.value) return;
        
        // Formatta il punteggio con separatori delle migliaia
        const formattedScore = this.score.toLocaleString();
        this.scoreUI.value.textContent = formattedScore;
        
        // Aggiungi animazione pop
        this.scoreUI.value.classList.remove('score-added');
        void this.scoreUI.value.offsetWidth; // Forza reflow
        this.scoreUI.value.classList.add('score-added');
        
        setTimeout(() => {
            if (this.scoreUI && this.scoreUI.value) {
                this.scoreUI.value.classList.remove('score-added');
            }
        }, 500);
    }
    
    // Aggiungi punti al punteggio
    addScore(points) {
        this.score += points;
        this.updateScoreUI();
        
        console.log(`+${points} punti! Punteggio totale: ${this.score}`);
        
        // Crea effetto floating text (opzionale)
        this.createScorePopup(points);
    }

    // Crea un popup dei punti che fluttua verso l'alto
    createScorePopup(points) {
        const popup = document.createElement('div');
        
        // Calcola la posizione centrale
        // Se hai l'UI del punteggio, posiziona sotto di essa
        let topPosition = '80px'; // Default sotto il punteggio principale
        
        if (this.scoreUI && this.scoreUI.container) {
            const scoreRect = this.scoreUI.container.getBoundingClientRect();
            topPosition = (scoreRect.bottom + 10) + 'px';
        }
        
        popup.style.cssText = `
            position: fixed;
            left: 50%;
            top: ${topPosition};
            transform: translateX(-50%);
            color: #ffd700;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            z-index: 1001;
            pointer-events: none;
            animation: floatUp 1.5s ease-out forwards;
        `;
        popup.textContent = `+${points}`;
        
        document.body.appendChild(popup);
        
        // Rimuovi dopo l'animazione
        setTimeout(() => {
            popup.remove();
        }, 1500);
    }

    initSpellCooldownUI() {
        // Crea subito l'UI quando il player viene creato
        setTimeout(() => {
            this.updateSpellCooldownUI();
            console.log('✅ UI Cooldown inizializzata - Tutte le spell disponibili!');
        }, 500); // Delay per assicurarsi che tutto sia caricato
    }

    addKill() {
        this.killCount++;
        console.log(`💀 Nemico ucciso! Kill totali: ${this.killCount}`);
        
        // Log dello stato delle spell
        console.log(`🛡️ Scudo: ${this.getShieldCooldownRemaining()} kill rimanenti`);
        console.log(`💚 Cura: ${this.getHealCooldownRemaining()} kill rimanenti`);
        console.log(`🔥 Fuoco: ${this.getFireWallCooldownRemaining()} kill rimanenti`);
        
        // Aggiorna l'UI se esiste
        this.updateSpellCooldownUI();
        
        // Controlla se qualche spell è appena diventata disponibile
        this.checkSpellUnlocks();
    }

    // 6b. Metodo per controllare e notificare quando le spell si sbloccano:
    checkSpellUnlocks() {
        const shieldReady = this.canUseShield();
        const healReady = this.canUseHeal();
        const fireWallReady = this.canUseFireWall();
        
        // Notifica SOLO se la spell è pronta E non è già stata notificata
        if (shieldReady && !this.spellNotified.shield && !this.isShieldActive) {
            this.spellNotified.shield = true; // Segna come notificata
        }
        
        if (healReady && !this.spellNotified.heal) {
            this.spellNotified.heal = true; // Segna come notificata
        }
        
        if (fireWallReady && !this.spellNotified.fireWall) {
            this.spellNotified.fireWall = true; // Segna come notificata
        }
    }

    // 7. Metodi per ottenere i kill rimanenti per ogni spell:
    getShieldCooldownRemaining() {
        const killsSinceLastUse = this.killCount - this.lastShieldKills;
        return Math.max(0, this.spellKillRequirements.shield - killsSinceLastUse);
    }

    getHealCooldownRemaining() {
        const killsSinceLastUse = this.killCount - this.lastHealKills;
        return Math.max(0, this.spellKillRequirements.heal - killsSinceLastUse);
    }

    getFireWallCooldownRemaining() {
        const killsSinceLastUse = this.killCount - this.lastFireWallKills;
        return Math.max(0, this.spellKillRequirements.fireWall - killsSinceLastUse);
    }

    initSpellCooldownUI() {
        // Crea subito l'UI quando il player viene creato
        setTimeout(() => {
            this.updateSpellCooldownUI();
            console.log('✅ UI Cooldown inizializzata - Tutte le spell disponibili!');
        }, 500); // Delay per assicurarsi che tutto sia caricato
    }

    updateSpellCooldownUI() {
        // Mostra l'UI se non è già visibile
        const spellUI = document.getElementById('spell-ui');
        if (spellUI && !spellUI.classList.contains('active')) {
            spellUI.classList.add('active');
        }
        
        // Aggiorna ogni spell
        this.updateHealCooldownUI();
        this.updateShieldCooldownUI();
        this.updateFireWallCooldownUI();
    }

    updateHealCooldownUI() {
        const element = document.getElementById('heal-spell');
        const counter = element?.querySelector('.spell-counter');
        
        if (!element) return;
        
        const remaining = this.getHealCooldownRemaining();
        
        // Rimuovi tutte le classi di stato
        element.classList.remove('spell-ready', 'spell-cooldown');
        
        if (remaining > 0) {
            // In cooldown
            element.classList.add('spell-cooldown');
            if (counter) {
                counter.textContent = remaining;
                counter.style.opacity = '1';
            }
        } else {
            // Pronta
            element.classList.add('spell-ready');
            if (counter) {
                counter.style.opacity = '0';
            }
        }
    }

    updateShieldCooldownUI() {
        const element = document.getElementById('shield-spell');
        const counter = element?.querySelector('.spell-counter');
        
        if (!element) return;
        
        // Rimuovi tutte le classi di stato
        element.classList.remove('spell-ready', 'spell-cooldown', 'spell-active');
        
        if (this.isShieldActive) {
            // Scudo attivo
            element.classList.add('spell-active');
            if (counter) {
                counter.style.opacity = '0';
            }
        } else {
            const remaining = this.getShieldCooldownRemaining();
            
            if (remaining > 0) {
                // In cooldown
                element.classList.add('spell-cooldown');
                if (counter) {
                    counter.textContent = remaining;
                    counter.style.opacity = '1';
                }
            } else {
                // Pronto
                element.classList.add('spell-ready');
                if (counter) {
                    counter.style.opacity = '0';
                }
            }
        }
    }

    updateFireWallCooldownUI() {
        const element = document.getElementById('firewall-spell');
        const counter = element?.querySelector('.spell-counter');
        
        if (!element) return;
        
        const remaining = this.getFireWallCooldownRemaining();
        
        // Rimuovi tutte le classi di stato
        element.classList.remove('spell-ready', 'spell-cooldown');
        
        if (remaining > 0) {
            // In cooldown
            element.classList.add('spell-cooldown');
            if (counter) {
                counter.textContent = remaining;
                counter.style.opacity = '1';
            }
        } else {
            // Pronta
            element.classList.add('spell-ready');
            if (counter) {
                counter.style.opacity = '0';
            }
        }
    }

    debugSpellSystem() {
        console.log('=== DEBUG SPELL SYSTEM ===');
        console.log('SpellEffects istanza:', this.spellEffects);
        console.log('Scene:', this.scene);
        console.log('Timer Ultimate:', this.ultyTimer);
        
        // Conta i muri di fuoco nella scena
        let fireWallCount = 0;
        this.scene.traverse(child => {
            if (child.name && child.name.startsWith('FireWall_')) {
                fireWallCount++;
                console.log('Trovato muro:', child.name, 'Posizione:', child.position);
            }
        });
        console.log('Muri di fuoco nella scena:', fireWallCount);
        
        // Prova a pulire manualmente
        if (this.spellEffects) {
            console.log('Eseguo pulizia manuale...');
            this.spellEffects.dispose();
        }
        
        // Ricrea SpellEffects
        console.log('Ricreo SpellEffects...');
        this.spellEffects = new SpellEffects(this.scene);
        console.log('SpellEffects ricreato:', this.spellEffects);
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

    getScore() {
        return this.score;
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