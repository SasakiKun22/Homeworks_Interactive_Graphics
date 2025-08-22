// enemy.js - Sistema nemici con macchina a stati finiti

// Stati del nemico
const EnemyStates = {
    IDLE: 'idle',
    WANDERING: 'wandering',
    CHASING: 'chasing',
    ATTACKING: 'attacking',
    HURT: 'hurt',
    DEAD: 'dead'
};

// Classe StateMachine per i nemici
class EnemyStateMachine {
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

class Enemy {
    constructor(scene, position, type = 'goblin') {
        this.scene = scene;
        this.type = type;
        this.id = 'enemy_' + Math.random().toString(36).substr(2, 9);
        
        // Modello e mesh
        this.model = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.isModelLoaded = false;
        
        // Root bone per gestire il root motion
        this.rootBone = null;
        this.rootBoneInitialPosition = null;
        
        // Macchina a stati
        this.stateMachine = new EnemyStateMachine(EnemyStates.IDLE);
        
        // Proprietà fisiche
        this.position = position.clone();
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.targetRotation = 0;

        // Proprietà di combattimento
        this.chasingSpeedMultiplier = 1;
        this.hasDealtDamage = false;
        this.originalColor = null;
        
        // Target per movimento
        this.targetPosition = null;
        this.wanderTarget = null;
        this.player = null;
        
        // Configurazione in base al tipo
        this.config = this.getConfigByType(type);
        
        // Timers
        this.idleTimer = 0;
        this.wanderTimer = 0;
        this.attackTimer = 0;
        this.decisionTimer = 0;
        
        // Loader per FBX
        this.loader = null;
        
        // Carica il modello appropriato
        if (this.config.modelPath && typeof THREE.FBXLoader !== 'undefined') {
            this.loadFBXModel();
        } else {
            this.createPlaceholderModel();
        }
    }
    
    // Configurazioni per diversi tipi di nemici
    getConfigByType(type) {
        const configs = {
            goblin: {
                health: 50,
                maxHealth: 50,
                speed: 2,
                attackDamage: 10,
                attackRange: 2,
                attackCooldown: 1.5,
                detectionRange: 15,
                wanderRadius: 10,
                size: 1,
                color: 0xff0000,
                idleTime: { min: 2, max: 5 },
                wanderTime: { min: 3, max: 8 },
                modelPath: null,
                modelScale: 1,
                collisionRadius: 0.7,
                animationPaths: {}
            },
            orc: {
                health: 100,
                maxHealth: 100,
                speed: 1.2,
                attackDamage: 20,
                attackRange: 2.5,
                attackCooldown: 2,
                detectionRange: 12,
                wanderRadius: 8,
                size: 3,
                color: 0x00ff00,
                idleTime: { min: 3, max: 6 },
                wanderTime: { min: 4, max: 10 },
                modelPath: '../models/enemies/orc/Orc.fbx',
                modelScale: 0.025,
                collisionRadius: 1.2,
                animationPaths: {
                    [EnemyStates.IDLE]: '../models/enemies/orc/Idle.fbx',
                    [EnemyStates.WANDERING]: '../models/enemies/orc/Walk.fbx',
                    [EnemyStates.ATTACKING]: '../models/enemies/orc/Attack.fbx',
                    // [EnemyStates.HURT]: 'models/enemies/orc/Hit.fbx',
                    [EnemyStates.DEAD]: '../models/enemies/orc/Death.fbx',
                }
            },
            vampire: {
                health: 30,
                maxHealth: 30,
                speed: 2,
                attackDamage: 15,
                attackRange: 2,
                attackCooldown: 3,
                detectionRange: 20,
                wanderRadius: 15,
                size: 1.5,
                color: 0xcccccc,
                idleTime: { min: 1, max: 3 },
                wanderTime: { min: 2, max: 5 },
                modelPath: '../models/enemies/vampire/Vampire.fbx',
                modelScale: 0.015,
                collisionRadius: 0.9,
                animationPaths: {
                    [EnemyStates.IDLE]: '../models/enemies/vampire/Idle.fbx',
                    [EnemyStates.WANDERING]: '../models/enemies/vampire/Walk.fbx',
                    [EnemyStates.ATTACKING]: '../models/enemies/vampire/Bite.fbx',
                    [EnemyStates.DEAD]: '../models/enemies/vampire/Death.fbx',
                    // Aggiungi altre animazioni del vampiro qui
                }
            }
        };
        
        return configs[type] || configs.goblin;
    }
    
    // Caricamento modello FBX
    loadFBXModel() {
        if (typeof THREE.FBXLoader === 'undefined') {
            this.createPlaceholderModel();
            return;
        }
        
        this.loader = new THREE.FBXLoader();
                
        this.loader.load(
            this.config.modelPath,
            (fbx) => this.onModelLoaded(fbx),
            (progress) => this.onLoadProgress(progress),
            (error) => this.onLoadError(error)
        );
    }
    
    onModelLoaded(fbx) {        
        this.model = fbx;
        this.model.scale.set(this.config.modelScale, this.config.modelScale, this.config.modelScale);
        this.model.position.copy(this.position);
        
        // Abilita ombre
        this.model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                if (child.material) {
                    child.material.side = THREE.FrontSide;
                }
            }
            
            // Cerca il bone principale
            if (child.isBone && (child.name.toLowerCase().includes('hips') || 
                                 child.name.toLowerCase().includes('root') ||
                                 child.name === 'mixamorigHips')) {
                this.rootBone = child;
                this.rootBoneInitialPosition = child.position.clone();
            }
        });
        
        // Setup animazioni
        this.setupAnimations(fbx);
        
        // Aggiungi alla scena
        this.scene.add(this.model);
        
        // Crea barra della salute
        this.createHealthBar();
        
        this.isModelLoaded = true;
    }
    
    setupAnimations(fbx) {
        this.mixer = new THREE.AnimationMixer(fbx);
        
        if (fbx.animations && fbx.animations.length > 0) {
            
            // Per animazioni Mixamo con nome generico
            if (fbx.animations[0].name === 'mixamo.com' || fbx.animations.length === 1) {
                // Assumiamo sia idle se nel file principale
                const action = this.mixer.clipAction(fbx.animations[0]);
                this.animations[EnemyStates.IDLE] = action;
            }
        }
        
        // Carica animazioni separate
        this.loadSeparateAnimations();
    }
    
    loadSeparateAnimations() {
        const animationFiles = this.config.animationPaths;
        
        if (!animationFiles || Object.keys(animationFiles).length === 0) {
            console.log(`[${this.id}] Nessuna animazione separata da caricare per ${this.type}`);
            return;
        }
        
        let loadedCount = 0;
        const totalAnimations = Object.keys(animationFiles).length;
        
        Object.entries(animationFiles).forEach(([state, path]) => {
            this.loader.load(
                path,
                (fbx) => {
                    if (fbx.animations && fbx.animations.length > 0) {
                        const clip = fbx.animations[0];
                        clip.name = state;
                                                
                        const action = this.mixer.clipAction(clip, this.model);
                        this.animations[state] = action;
                        
                        loadedCount++;
                        
                        // Se è idle, avviala immediatamente
                        if (state === EnemyStates.IDLE && !this.currentAction) {
                            this.playAnimation(EnemyStates.IDLE);
                        }
                    }
                },
                (progress) => {
                    if (progress.lengthComputable) {
                        const percentComplete = progress.loaded / progress.total * 100;
                        console.log(`[${this.id}] Caricamento ${state}: ${Math.round(percentComplete)}%`);
                    }
                },
                (error) => {
                    console.warn(`[${this.id}] Errore caricamento animazione ${state}:`, error);
                    loadedCount++;
                }
            );
        });
    }
    
    onLoadProgress(progress) {
        if (progress.lengthComputable) {
            const percentComplete = progress.loaded / progress.total * 100;
        }
    }
    
    onLoadError(error) {
        console.error(`[${this.id}] Errore caricamento modello:`, error);
        console.log(`[${this.id}] Creazione modello placeholder...`);
        this.createPlaceholderModel();
    }
    
    // Crea modello placeholder
    createPlaceholderModel() {
        const group = new THREE.Group();
        
        // Corpo
        const bodyGeometry = new THREE.SphereGeometry(
            this.config.size * 0.5,
            8,
            6
        );
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: this.config.color 
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = this.config.size;
        body.scale.y = 1.5;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        
        // Testa
        const headGeometry = new THREE.SphereGeometry(
            this.config.size * 0.35,
            8,
            6
        );
        const headMaterial = new THREE.MeshLambertMaterial({ 
            color: this.config.color 
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = this.config.size * 1.7;
        head.castShadow = true;
        group.add(head);
        
        // Occhi
        const eyeGeometry = new THREE.SphereGeometry(this.config.size * 0.1);
        const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(
            -this.config.size * 0.15,
            this.config.size * 1.8,
            this.config.size * 0.3
        );
        group.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(
            this.config.size * 0.15,
            this.config.size * 1.8,
            this.config.size * 0.3
        );
        group.add(rightEye);
        
        // Naso/indicatore direzione
        const noseGeometry = new THREE.ConeGeometry(
            this.config.size * 0.1,
            this.config.size * 0.3,
            4
        );
        const noseMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x000000 
        });
        const nose = new THREE.Mesh(noseGeometry, noseMaterial);
        nose.position.set(0, this.config.size * 1.7, this.config.size * 0.4);
        nose.rotation.x = Math.PI / 2;
        group.add(nose);
        
        this.model = group;
        this.model.position.copy(this.position);
        
        // Aggiungi alla scena
        this.scene.add(this.model);
        
        // Crea barra della salute
        this.createHealthBar();
        
        this.isModelLoaded = true;
    }
    
    // Crea barra della salute
    createHealthBar() {
        if (!this.model) return;
        
        const barWidth = this.config.size;
        const barHeight = 0.1;
        
        // Container della barra
        const healthBarContainer = new THREE.Group();
        
        // Background (rosso)
        const bgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
        const bgMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            side: THREE.DoubleSide
        });
        const bgBar = new THREE.Mesh(bgGeometry, bgMaterial);
        healthBarContainer.add(bgBar);
        
        // Barra della salute (verde)
        const healthGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
        const healthMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            side: THREE.DoubleSide
        });
        this.healthBar = new THREE.Mesh(healthGeometry, healthMaterial);
        this.healthBar.position.z = 0.01;
        healthBarContainer.add(this.healthBar);
        
        healthBarContainer.position.y = this.config.size * 2.5;
        this.model.add(healthBarContainer);
        
        this.healthBarContainer = healthBarContainer;
    }
    
    // ========== UPDATE PRINCIPALE ==========
    
    update(deltaTime, player) {
        if (!this.model || this.stateMachine.isState(EnemyStates.DEAD)) return;
        
        // Salva riferimento al player
        this.player = player;
        
        // Update stato
        this.updateStateMachine(deltaTime);
        
        // Update in base allo stato
        switch (this.stateMachine.getState()) {
            case EnemyStates.IDLE:
                this.updateIdle(deltaTime);
                break;
            case EnemyStates.WANDERING:
                this.updateWandering(deltaTime);
                break;
            case EnemyStates.CHASING:
                this.updateChasing(deltaTime);
                break;
            case EnemyStates.ATTACKING:
                this.updateAttacking(deltaTime);
                break;
            case EnemyStates.HURT:
                this.updateHurt(deltaTime);
                break;
            case EnemyStates.DEAD:
                this.updateDead(deltaTime);
                break;
        }
        
        // Update fisica
        this.updatePhysics(deltaTime);
        
        // Update modello
        this.updateModel(deltaTime);
        
        // Update animazioni se il mixer esiste
        if (this.mixer) {
            this.mixer.update(deltaTime);
            
            // Blocca root motion se necessario
            if (this.rootBone && this.rootBoneInitialPosition) {
                this.rootBone.position.x = this.rootBoneInitialPosition.x;
                this.rootBone.position.z = this.rootBoneInitialPosition.z;
            }
        }
        
        // Update barra salute
        this.updateHealthBar();
        
        // Update timers
        this.updateTimers(deltaTime);
    }
    
    // ========== MACCHINA A STATI ==========
    
    updateStateMachine(deltaTime) {
        this.stateMachine.update(deltaTime);
        
        const state = this.stateMachine.getState();
        
        // Controlla la distanza dal player per decidere se inseguire
        if (this.player && this.player.isAlive()) {
            const distanceToPlayer = this.position.distanceTo(this.player.getPosition());
            
            // Se il player è nel raggio di detection e non siamo già in stati di combattimento
            if (distanceToPlayer <= this.config.detectionRange && 
                !this.stateMachine.isState(EnemyStates.HURT) &&
                !this.stateMachine.isState(EnemyStates.DEAD)) {
                
                // Se siamo abbastanza vicini per attaccare
                if (distanceToPlayer <= this.config.attackRange) {
                    if (!this.stateMachine.isState(EnemyStates.ATTACKING) && this.attackTimer <= 0) {
                        this.changeState(EnemyStates.ATTACKING);
                    }
                } 
                // Altrimenti insegui
                else if (!this.stateMachine.isState(EnemyStates.CHASING)) {
                    this.changeState(EnemyStates.CHASING);
                }
            }
            // Se il player è fuori dal raggio e stavamo inseguendo
            else if (this.stateMachine.isState(EnemyStates.CHASING)) {
                this.changeState(EnemyStates.IDLE);
            }
        }
        
        // Stati normali quando non c'è inseguimento
        switch (state) {
            case EnemyStates.IDLE:
                // Dopo un po' di idle, inizia a vagare (solo se non c'è player vicino)
                if (this.idleTimer <= 0) {
                    const shouldWander = !this.player || 
                        this.position.distanceTo(this.player.getPosition()) > this.config.detectionRange;
                    
                    if (shouldWander) {
                        this.changeState(EnemyStates.WANDERING);
                    }
                }
                break;
                
            case EnemyStates.WANDERING:
                // Dopo aver vagato, torna idle
                if (this.wanderTimer <= 0 || this.hasReachedTarget()) {
                    this.changeState(EnemyStates.IDLE);
                }
                break;
                
            case EnemyStates.ATTACKING:
                // Dopo l'attacco, torna a inseguire o idle
                if (this.stateMachine.getStateTime() > this.config.attackCooldown) {
                    if (this.player && this.player.isAlive()) {
                        const distanceToPlayer = this.position.distanceTo(this.player.getPosition());
                        if (distanceToPlayer <= this.config.detectionRange) {
                            this.changeState(EnemyStates.CHASING);
                        } else {
                            this.changeState(EnemyStates.IDLE);
                        }
                    } else {
                        this.changeState(EnemyStates.IDLE);
                    }
                }
                break;
                
            case EnemyStates.HURT:
                // Recupera dopo essere stato colpito
                if (this.stateMachine.getStateTime() > 0.5) {
                    // Dopo essere stato colpito, insegui il player se è vicino
                    if (this.player && this.player.isAlive()) {
                        const distanceToPlayer = this.position.distanceTo(this.player.getPosition());
                        if (distanceToPlayer <= this.config.detectionRange) {
                            this.changeState(EnemyStates.CHASING);
                        } else {
                            this.changeState(EnemyStates.IDLE);
                        }
                    } else {
                        this.changeState(EnemyStates.IDLE);
                    }
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
        switch (state) {
            case EnemyStates.IDLE:
                // Imposta timer random per idle
                this.idleTimer = THREE.MathUtils.randFloat(
                    this.config.idleTime.min,
                    this.config.idleTime.max
                );
                this.velocity.set(0, 0, 0);
                
                // Avvia animazione idle se disponibile
                if (this.animations[EnemyStates.IDLE]) {
                    this.playAnimation(EnemyStates.IDLE);
                }
                break;
                
            case EnemyStates.WANDERING:
                // Scegli una destinazione random
                this.chooseWanderTarget();
                this.wanderTimer = THREE.MathUtils.randFloat(
                    this.config.wanderTime.min,
                    this.config.wanderTime.max
                );
                
                // Avvia animazione walk se disponibile
                if (this.animations[EnemyStates.WANDERING]) {
                    this.playAnimation(EnemyStates.WANDERING);
                }
                break;
                
            case EnemyStates.CHASING:                
                // Usa l'animazione di camminata anche per l'inseguimento
                if (this.animations[EnemyStates.WANDERING]) {
                    this.playAnimation(EnemyStates.WANDERING);
                } else if (this.animations[EnemyStates.CHASING]) {
                    // Se hai un'animazione specifica per la corsa, usala
                    this.playAnimation(EnemyStates.CHASING);
                }
                
                // Aumenta leggermente la velocità durante l'inseguimento
                this.chasingSpeedMultiplier = 1.3;
                break;
                
            case EnemyStates.ATTACKING:
                this.attackTimer = this.config.attackCooldown;
                this.hasDealtDamage = false;
                
                // Se hai un'animazione di attacco, usala
                if (this.animations[EnemyStates.ATTACKING]) {
                    this.playAnimation(EnemyStates.ATTACKING, false); // false = no loop
                }
                break;
                
            case EnemyStates.HURT:
                // Opzionale: suono o effetto quando viene colpito
                if (this.animations[EnemyStates.HURT]) {
                    this.playAnimation(EnemyStates.HURT, false);
                }
                break;

            case EnemyStates.DEAD:
                if (this.animations[EnemyStates.DEAD]){
                    this.playAnimation(EnemyStates.DEAD, false)
                }
        }
    }
    
    // Riproduce un'animazione
    playAnimation(name, loop = true) {
        if (!this.mixer) return;
        
        const newAction = this.animations[name];
        
        if (!newAction) {
            return;
        }
        
        // Se è la stessa animazione, non fare nulla
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
    
    // ========== UPDATE STATI ==========
    
    updateIdle(deltaTime) {
        // Fermo, nessun movimento
        this.velocity.lerp(new THREE.Vector3(0, 0, 0), 10 * deltaTime);
        
        // Ripristina colore originale se era in chasing
        if (this.originalColor && this.model && this.model.children[0] && this.model.children[0].material) {
            this.model.children[0].material.color.setHex(this.originalColor);
            this.originalColor = null;
        }
        
        // Guarda in giro occasionalmente
        if (Math.random() < 0.01) {
            this.targetRotation += (Math.random() - 0.5) * Math.PI;
        }
    }
    
    updateWandering(deltaTime) {
        if (!this.wanderTarget) return;
        
        // Calcola direzione verso il target
        const direction = new THREE.Vector3()
            .subVectors(this.wanderTarget, this.position)
            .normalize();
        
        // Applica velocità
        const targetVelocity = direction.multiplyScalar(this.config.speed);
        this.velocity.lerp(targetVelocity, 5 * deltaTime);
        
        // Rotazione verso la direzione del movimento
        if (this.velocity.length() > 0.1) {
            this.targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
        }
    }
    
    updateChasing(deltaTime) {
        if (!this.player || !this.player.isAlive()) {
            this.changeState(EnemyStates.IDLE);
            return;
        }
        
        const playerPosition = this.player.getPosition();
        const distanceToPlayer = this.position.distanceTo(playerPosition);
        
        // Se siamo troppo lontani, smetti di inseguire
        if (distanceToPlayer > this.config.detectionRange * 1.5) {
            this.changeState(EnemyStates.IDLE);
            return;
        }
        
        // Se siamo abbastanza vicini per attaccare
        if (distanceToPlayer <= this.config.attackRange && this.attackTimer <= 0) {
            this.changeState(EnemyStates.ATTACKING);
            return;
        }
        
        // Calcola direzione verso il player
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, this.position)
            .normalize();
        
        // Applica velocità verso il player (con boost di velocità)
        const chaseSpeed = this.config.speed * (this.chasingSpeedMultiplier || 1.3);
        const targetVelocity = direction.multiplyScalar(chaseSpeed);
        
        // Interpolazione più aggressiva per inseguimento
        this.velocity.lerp(targetVelocity, 8 * deltaTime);
        
        // Rotazione immediata verso il player
        if (this.velocity.length() > 0.1) {
            this.targetRotation = Math.atan2(direction.x, direction.z);
        }
        
        // Debug visivo opzionale: cambia colore durante inseguimento
        if (this.model && this.model.children[0] && this.model.children[0].material) {
            // Tinge leggermente di rosso durante l'inseguimento
            if (!this.originalColor) {
                this.originalColor = this.model.children[0].material.color.getHex();
            }
            // Mix tra colore originale e rosso
            const aggroColor = 0xff6666;
            this.model.children[0].material.color.setHex(aggroColor);
        }
    }
    
    updateAttacking(deltaTime) {
        if (!this.player || !this.player.isAlive()) {
            this.changeState(EnemyStates.IDLE);
            return;
        }
        
        // Rallenta movimento durante l'attacco
        this.velocity.lerp(new THREE.Vector3(0, 0, 0), 10 * deltaTime);
        
        // Guarda verso il player durante l'attacco
        const playerPosition = this.player.getPosition();
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, this.position)
            .normalize();
        this.targetRotation = Math.atan2(direction.x, direction.z);
        
        // Calcola quando applicare il danno basandosi sul tempo dell'animazione
        const attackProgress = this.stateMachine.getStateTime() / this.config.attackCooldown;
        const damageTimingPercent = 0.5; // Danno a metà animazione
        
        // Applica danno al player al momento giusto dell'animazione
        if (attackProgress >= damageTimingPercent && !this.hasDealtDamage) {
            const distanceToPlayer = this.position.distanceTo(playerPosition);
            
            if (distanceToPlayer <= this.config.attackRange * 1.2) {
                // Applica danno al player
                if (this.player.takeDamage) {
                    this.player.takeDamage(this.config.attackDamage);
                    console.log(`[${this.id}] ${this.type} infligge ${this.config.attackDamage} danni al player!`);
                }
                
                // Effetto visivo dell'attacco
                this.createAttackEffect();
            }
            
            this.hasDealtDamage = true;
        }
        
        // Reset dopo l'attacco
        if (this.stateMachine.getStateTime() > this.config.attackCooldown) {
            this.hasDealtDamage = false;
        }
    }

    // Effetto visivo dell'attacco
    createAttackEffect() {
        if (!this.model) return;
        
        // Crea un effetto slash davanti al nemico
        const slashGeometry = new THREE.RingGeometry(1, 2, 4, 1, 0, Math.PI/2);
        const slashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const slash = new THREE.Mesh(slashGeometry, slashMaterial);
        
        // Posiziona davanti al nemico
        slash.position.copy(this.position);
        slash.position.y = 1;
        slash.position.z = -0.5;
        slash.rotation.x = -Math.PI / 2;
        slash.rotation.z = Math.PI;
        
        this.scene.add(slash);
        
        // Rimuovi dopo poco
        setTimeout(() => {
            this.scene.remove(slash);
            slash.geometry.dispose();
            slash.material.dispose();
        }, 200);
    }
    
    updateHurt(deltaTime) {
        // Piccolo knockback
        this.velocity.lerp(new THREE.Vector3(0, 0, 0), 10 * deltaTime);
    }
    
    updateDead(deltaTime) {
        // Nessun movimento
        this.velocity.set(0, 0, 0);
    }
    
    // ========== FISICA ==========
    
    updatePhysics(deltaTime) {
        // Salva la posizione precedente per il rollback
        const previousPosition = this.position.clone();
        
        // Applica velocità
        this.position.add(
            this.velocity.clone().multiplyScalar(deltaTime)
        );
        
        // Controlla collisione con il player
        if (this.player && this.player.isAlive()) {
            const playerPos = this.player.getPosition();
            const distance = this.position.distanceTo(playerPos);
            const playerRadius = 1; // Raggio standard del player
            const minDistance = (this.config.collisionRadius || this.config.size * 0.8) + playerRadius;
            
            if (distance < minDistance && distance > 0) {
                // I nemici vengono spinti MOLTO POCO dal player
                // Questo li rende più "pesanti" e difficili da spostare
                const pushDirection = new THREE.Vector3()
                    .subVectors(this.position, playerPos)
                    .normalize();
                
                const overlap = minDistance - distance;
                
                // Sposta il nemico solo di una frazione minima (10% dell'overlap)
                // Questo fa sì che sia principalmente il player a essere bloccato
                this.position.add(pushDirection.multiplyScalar(overlap * 0.1));
                
                // Riduci anche la velocità del nemico quando viene colpito dal player
                // Ma non troppo se sta inseguendo
                if (!this.stateMachine.isState(EnemyStates.CHASING)) {
                    this.velocity.multiplyScalar(0.8);
                }
            }
        }

        // Controlla collisioni con altri nemici - SISTEMA MIGLIORATO
        if (window.enemies) {
            window.enemies.forEach(otherEnemy => {
                if (otherEnemy !== this && otherEnemy.isAlive()) {
                    const otherPos = otherEnemy.getPosition();
                    const distance = this.position.distanceTo(otherPos);
                    const thisRadius = this.config.collisionRadius || this.config.size * 0.6;
                    const otherRadius = otherEnemy.config.collisionRadius || otherEnemy.config.size * 0.6;
                    const minDistance = thisRadius + otherRadius;
                    
                    if (distance < minDistance && distance > 0.01) { // Evita divisione per zero
                        // Calcola la direzione di push
                        const pushDirection = new THREE.Vector3()
                            .subVectors(this.position, otherPos)
                            .normalize();
                        
                        const overlap = minDistance - distance;
                        
                        // Sposta ENTRAMBI i nemici equamente (50% ciascuno)
                        // Questo previene la compenetrazione
                        this.position.add(pushDirection.multiplyScalar(overlap * 0.5));
                        
                        // Sposta anche l'altro nemico nella direzione opposta
                        otherEnemy.position.sub(pushDirection.multiplyScalar(overlap * 0.5));
                        
                        // Se si stanno muovendo l'uno verso l'altro, fermali
                        const relativeVelocity = this.velocity.clone().sub(otherEnemy.velocity);
                        const velocityTowardsEachOther = relativeVelocity.dot(pushDirection.negate());
                        
                        if (velocityTowardsEachOther > 0) {
                            // Riduci la componente della velocità che li porta l'uno verso l'altro
                            const correction = pushDirection.multiplyScalar(velocityTowardsEachOther * 0.5);
                            this.velocity.sub(correction);
                            otherEnemy.velocity.add(correction);
                        }
                        
                        // Aggiungi una piccola forza di separazione per evitare che restino incastrati
                        // Specialmente importante quando inseguono lo stesso target
                        if (this.stateMachine.isState(EnemyStates.CHASING) && 
                            otherEnemy.stateMachine.isState(EnemyStates.CHASING)) {
                            // Forza laterale per separarli quando inseguono
                            const lateralPush = new THREE.Vector3(-pushDirection.z, 0, pushDirection.x);
                            this.velocity.add(lateralPush.multiplyScalar(1));
                            otherEnemy.velocity.sub(lateralPush.multiplyScalar(1));
                        }
                    } else if (distance === 0) {
                        // Se sono esattamente nella stessa posizione, separali
                        const randomDirection = new THREE.Vector3(
                            Math.random() - 0.5,
                            0,
                            Math.random() - 0.5
                        ).normalize();
                        this.position.add(randomDirection.multiplyScalar(thisRadius));
                        otherEnemy.position.sub(randomDirection.multiplyScalar(otherRadius));
                    }
                }
            });
        }
        
        // Limiti del mondo
        const worldLimit = 95;
        this.position.x = Math.max(-worldLimit, Math.min(worldLimit, this.position.x));
        this.position.z = Math.max(-worldLimit, Math.min(worldLimit, this.position.z));
        
        // Mantieni sul terreno
        this.position.y = 0;
    }
    
    updateModel(deltaTime) {
        if (!this.model) return;
        
        // Aggiorna posizione
        this.model.position.copy(this.position);
        
        // Rotazione smooth
        const rotationDiff = this.targetRotation - this.rotation;
        this.rotation += rotationDiff * 5 * deltaTime;
        this.model.rotation.y = this.rotation;
    }
    
    updateHealthBar() {
        if (!this.healthBar) return;
        
        // Scala la barra in base alla salute
        const healthPercent = this.config.health / this.config.maxHealth;
        this.healthBar.scale.x = Math.max(0, healthPercent);
        this.healthBar.position.x = -(1 - healthPercent) * this.config.size * 0.5;
        
        // Cambia colore in base alla salute
        if (healthPercent > 0.6) {
            this.healthBar.material.color.setHex(0x00ff00); // Verde
        } else if (healthPercent > 0.3) {
            this.healthBar.material.color.setHex(0xffff00); // Giallo
        } else {
            this.healthBar.material.color.setHex(0xff0000); // Rosso
        }
        
        // Fai guardare sempre la barra verso la camera
        if (this.healthBarContainer) {
            const camera = this.scene.getObjectByProperty('isCamera', true);
            if (camera) {
                this.healthBarContainer.lookAt(camera.position);
            }
        }
    }
    
    updateTimers(deltaTime) {
        this.idleTimer -= deltaTime;
        this.wanderTimer -= deltaTime;
        this.attackTimer -= deltaTime;
        this.decisionTimer -= deltaTime;
    }
    
    // ========== UTILITY ==========
    
    chooseWanderTarget() {
        // Scegli un punto random entro il raggio di wander
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.config.wanderRadius;
        
        this.wanderTarget = new THREE.Vector3(
            this.position.x + Math.sin(angle) * distance,
            0,
            this.position.z + Math.cos(angle) * distance
        );
        
        // Assicurati che sia nei limiti del mondo
        const worldLimit = 90;
        this.wanderTarget.x = Math.max(-worldLimit, Math.min(worldLimit, this.wanderTarget.x));
        this.wanderTarget.z = Math.max(-worldLimit, Math.min(worldLimit, this.wanderTarget.z));
    }
    
    hasReachedTarget() {
        if (!this.wanderTarget) return true;
        
        const distance = this.position.distanceTo(this.wanderTarget);
        return distance < 1;
    }
    
    // ========== COMBAT ==========
    
    takeDamage(amount, fromPosition) {
        if (this.stateMachine.isState(EnemyStates.DEAD)) return;
        
        this.config.health -= amount;
        this.config.health = Math.max(0, this.config.health);
        
        console.log(`[${this.id}] ${this.type} colpito! Danno: ${amount}, Salute: ${this.config.health}/${this.config.maxHealth}`);
        
        if (this.config.health <= 0) {
            this.changeState(EnemyStates.DEAD);
            this.onDeath();
            
            // Notifica globale per conteggio kill (opzionale)
            if (window.onEnemyKilled) {
                window.onEnemyKilled(this);
            }
        } else {
            // Cambia stato a HURT
            this.changeState(EnemyStates.HURT);
            
            // Knockback dal punto di impatto
            if (fromPosition) {
                const knockbackDirection = new THREE.Vector3()
                    .subVectors(this.position, fromPosition)
                    .normalize();
                
                // Knockback più forte
                this.velocity.add(knockbackDirection.multiplyScalar(8));
            }
            
            // Flash di danno
            //wadathis.flashDamage();
            
            // Dopo essere stato colpito, se il player è vicino, inizia a inseguirlo
            setTimeout(() => {
                if (this.isAlive() && this.player && this.player.isAlive()) {
                    const distanceToPlayer = this.position.distanceTo(this.player.getPosition());
                    if (distanceToPlayer <= this.config.detectionRange * 1.5) {
                        this.changeState(EnemyStates.CHASING);
                    }
                }
            }, 500);
        }
    }
    
    flashDamage() {
        if (!this.model) return;
        
        // Flash bianco per tutti i mesh del modello
        const flashColor = 0xffffff;
        const originalColors = [];
        
        this.model.traverse((child) => {
            if (child.isMesh && child.material) {
                // Salva il colore originale
                originalColors.push({
                    mesh: child,
                    color: child.material.color.clone(),
                    emissive: child.material.emissive ? child.material.emissive.clone() : null
                });
                
                // Applica il flash
                child.material.color.setHex(flashColor);
                if (child.material.emissive) {
                    child.material.emissive.setHex(0xff0000);
                }
            }
        });
        
        // Ripristina i colori originali dopo un breve delay
        setTimeout(() => {
            originalColors.forEach(item => {
                if (item.mesh.material) {
                    item.mesh.material.color.copy(item.color);
                    if (item.emissive && item.mesh.material.emissive) {
                        item.mesh.material.emissive.copy(item.emissive);
                    }
                }
            });
        }, 100);
    }
    
    onDeath() {
        console.log(`[${this.id}] Morto!`);
        
        // IMPORTANTE: Notifica al player che ha fatto un kill
        if (window.player && typeof window.player.addKill === 'function') {
            window.player.addKill();
            console.log(`💀 Kill registrato per ${this.type}!`);
        } else {
            console.warn('Player non trovato o metodo addKill non disponibile');
        }
        
        // Animazione morte (fade out e cade)
        if (this.model) {
            const fallDuration = 1000;
            const startTime = Date.now();
            
            const deathAnimation = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / fallDuration, 1);
                
                // Ruota e abbassa
                this.model.rotation.z = progress * Math.PI / 2;
                this.model.position.y = -progress * this.config.size;
                
                // Fade out
                this.model.traverse((child) => {
                    if (child.material) {
                        child.material.opacity = 1 - progress;
                        child.material.transparent = true;
                    }
                });
                
                if (progress < 1) {
                    requestAnimationFrame(deathAnimation);
                } else {
                    // Rimuovi dalla scena
                    this.destroy();
                }
            };
            
            deathAnimation();
        }
    }
    
    destroy() {
        if (this.model) {
            this.scene.remove(this.model);
            
            // Cleanup geometrie e materiali
            this.model.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
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
    
    isAlive() {
        return !this.stateMachine.isState(EnemyStates.DEAD);
    }
    
    isDead() {
        return this.stateMachine.isState(EnemyStates.DEAD);
    }
    
    getType() {
        return this.type;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Enemy
}