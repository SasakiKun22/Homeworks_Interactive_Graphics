// Variabili globali
let scene, camera, renderer;
let world = {};
let player = null;
let enemies = [];
let treeLoader = null;
let spawnedTrees = [];
let treesSpawnedCount = 0;
let totalTreesToSpawn = 0;
let occupiedTreePositions = [];
let willOWisps = null;
let clock = new THREE.Clock();

// Game state
let gameInitialized = false;
let gameStarted = false;

// Configurazione -
const config = {
    world: {
        size: 200,
        tileSize: 2,
        grassTexturePath: '../resources/grass_tile_0.png',
        groundColorMultiplier: 0.7, 
        groundEmissive: 0x002244,  
        groundEmissiveIntensity: 0.25
    },

    camera: {
        fov: 75,
        near: 0.1,
        far: 1000,
        position: { x: 30, y: 30, z: 30 }
    },

    // Configurazione ambiente notturno
    environment: {
        skyColor: 0x1a1a3a,         
        fogColor: 0x2a2a4e,          
        fogNear: 40,                
        fogFar: 120,                
        
        // Illuminazione notturna
        lighting: {
            ambient: {
                color: 0x6060a0,
                intensity: 0.25
            },
            moonLight: {
                color: 0xc0d0e0,
                intensity: 0.5,
                position: { x: -50, y: 100, z: 30 },
                shadowCameraSize: 0.6,
                shadowMapSize: 4096,
                shadowBias: -0.0005
            },
            hemisphere: {
                skyColor: 0x4040a0,
                groundColor: 0x202060,
                intensity: 0.3
            },
            fillLight: {
                color: 0x6060c0,
                intensity: 0.2,
                position: { x: 30, y: 50, z: -30 }
            },
            backLight: {
                color: 0x4040b0,
                intensity: 0.15,
                position: { x: -30, y: 40, z: 30 }
            }
        },

        // Elementi atmosferici notturni
        atmosphere: {
            stars: {
                count: 150,
                radius: { min: 150, max: 250 },
                brightness: { min: 0.5, max: 2.0 }
            },
            moon: {
                size: 5,
                color: 0xf0f0f0,
                emissive: 0x444444,
                position: { x: -60, y: 80, z: 40 },
                halo: {
                    size: 8,
                    opacity: 0.1
                }
            },
            willOWisps: {
                count: 30,
                enabled: true,
                lightIntensity: 0.3,
                minHeight: 1.8,
                regenerateOnTreeLoad: true,
            }
        }
    },

    // Configurazione materiali notturni
    materials: {
        trees: {
            colorMultiplier: 0.75,    
            emissive: 0x003366,       
            emissiveIntensity: 0.2   
        },
        grass: {
            colorVariation: { min: 0.15, max: 0.25 }, 
            baseColor: { r: 0.15, g: 0.5, b: 0.15 }  
        }
    }
};

const spawnConfig = {
    // Distanze per la "ciambella" di spawn
    minSpawnDistance: 25,   
    maxSpawnDistance: 45,    
    
    // Numero di nemici 
    maxEnemies: 5,      
    
    // Controllo spawn su terreno valido
    checkTerrainRadius: 2, 
};

const treeSpawnConfig = {
    totalTrees: 60,
    spawnWeights: {
        tree: 40,    
        pine: 35,   
        old_tree: 25  
    },
    clustering: {
        enabled: true,
        clusterChance: 0.3,
        clusterSize: { min: 2, max: 4 },
        clusterRadius: 8
    },
    placement: {
        minDistanceFromCenter: 20,
        minDistanceFromEdge: 5,
        minDistanceBetweenTrees: 4,
        maxAttempts: 50
    }
};

// Inizializzazione
function init() {
    
    if (gameInitialized) {
        startGameLoop();
        return;
    }

    // Create scene con configurazione notturna
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.environment.skyColor);
    scene.fog = new THREE.Fog(
        config.environment.fogColor, 
        config.environment.fogNear, 
        config.environment.fogFar
    );
    
    // Setup camera
    camera = new THREE.PerspectiveCamera(
        config.camera.fov,
        window.innerWidth / window.innerHeight,
        config.camera.near,
        config.camera.far
    );
    camera.position.set(
        config.camera.position.x,
        config.camera.position.y,
        config.camera.position.z
    );
    camera.lookAt(0, 0, 0);
    
    // Setup renderer con colore di sfondo notturno
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(config.environment.skyColor);
    
    if (!document.querySelector('canvas')) {
        document.body.appendChild(renderer.domElement);
    }
    
    // Crea il mondo di gioco
    createNightWorld();
    
    // Crea il player
    if (typeof Player !== 'undefined') {
        player = new Player(scene, camera);
        console.log('Player created successfully');
        window.player = player;
    } else {
        console.error('Player class not found! Make sure to include player.js');
        return;
    }

    setupScoreSystem();

    // 
    for (let i = 0; i < spawnConfig.maxEnemies; i++) {
        spawnEnemy();
    }
    
    window.addEventListener('resize', onWindowResize);
    
    gameInitialized = true;
    
    // Nasconde lo start screen e carica il gioco
    setTimeout(() => {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        startGameLoop();
    }, 2500);
}

function createNightWorld() {
    
    // Setup illuminazione notturna
    setupNightLighting();
    
    // Crea il terreno con materiali notturni
    createNightTerrain();
    
    // Crea elementi atmosferici
    createAtmosphericElements();
    
    // Aggiungi alberi con materiali notturni
    createNightTrees();
    
    // Aggiungi dettagli notturni
    createNightGrassDetails();
    
    // Bordi del mondo
    createWorldBorders();
}

// Setup illuminazione notturna unificata
function setupNightLighting() {
    const lighting = config.environment.lighting;
    
    // Luce ambientale
    const ambientLight = new THREE.AmbientLight(
        lighting.ambient.color, 
        lighting.ambient.intensity
    );
    scene.add(ambientLight);
    
    // Luce lunare principale
    const moonLight = new THREE.DirectionalLight(
        lighting.moonLight.color, 
        lighting.moonLight.intensity
    );
    moonLight.position.set(
        lighting.moonLight.position.x,
        lighting.moonLight.position.y,
        lighting.moonLight.position.z
    );
    moonLight.castShadow = true;
    
    // Configurazione shadow camera ottimizzata
    const shadowCameraSize = config.world.size * lighting.moonLight.shadowCameraSize;
    moonLight.shadow.camera.left = -shadowCameraSize;
    moonLight.shadow.camera.right = shadowCameraSize;
    moonLight.shadow.camera.top = shadowCameraSize;
    moonLight.shadow.camera.bottom = -shadowCameraSize;
    moonLight.shadow.camera.near = 0.1;
    moonLight.shadow.camera.far = 300;
    
    moonLight.shadow.mapSize.width = lighting.moonLight.shadowMapSize;
    moonLight.shadow.mapSize.height = lighting.moonLight.shadowMapSize;
    moonLight.shadow.bias = lighting.moonLight.shadowBias;
    
    scene.add(moonLight);
    
    // Luce emisferica notturna
    const nightHemisphereLight = new THREE.HemisphereLight(
        lighting.hemisphere.skyColor,
        lighting.hemisphere.groundColor,
        lighting.hemisphere.intensity
    );
    scene.add(nightHemisphereLight);
    
    // Fill light
    const fillLight = new THREE.DirectionalLight(
        lighting.fillLight.color, 
        lighting.fillLight.intensity
    );
    fillLight.position.set(
        lighting.fillLight.position.x,
        lighting.fillLight.position.y,
        lighting.fillLight.position.z
    );
    scene.add(fillLight);
    
    // Back light
    const backLight = new THREE.DirectionalLight(
        lighting.backLight.color, 
        lighting.backLight.intensity
    );
    backLight.position.set(
        lighting.backLight.position.x,
        lighting.backLight.position.y,
        lighting.backLight.position.z
    );
    scene.add(backLight);
    
    // Salva i riferimenti
    world.moonLight = moonLight;
    world.nightHemisphere = nightHemisphereLight;
}

// Terreno con configurazione notturna integrata
function createNightTerrain() {
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load(
        config.world.grassTexturePath,
        (texture) => {
            console.log('Night terrain texture loaded');
        },
        undefined,
        (error) => {
            console.error('Errore nel caricamento della texture:', error);
        }
    );
    
    // Configura la texture
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    const repeatCount = config.world.size / config.world.tileSize;
    grassTexture.repeat.set(repeatCount, repeatCount);
    grassTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    grassTexture.minFilter = THREE.LinearMipMapLinearFilter;
    grassTexture.magFilter = THREE.LinearFilter;
    
    // Terreno con materiale notturno
    const groundGeometry = new THREE.PlaneGeometry(config.world.size, config.world.size);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
        map: grassTexture,
        side: THREE.DoubleSide
    });
    
    // Applica effetti notturni al materiale
    groundMaterial.color.multiplyScalar(config.world.groundColorMultiplier);
    groundMaterial.emissive = new THREE.Color(config.world.groundEmissive);
    groundMaterial.emissiveIntensity = config.world.groundEmissiveIntensity;
    
    world.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    world.ground.rotation.x = -Math.PI / 2;
    world.ground.receiveShadow = true;
    scene.add(world.ground);
}

// Elementi atmosferici notturni
function createAtmosphericElements() {
    // Stelle
    createStarryNight();
    
    // Luna
    createMoon();
    
    // Will O' Wisps
    createWillOWispsDelayed();
}

// Cielo stellato con configurazione
function createStarryNight() {
    const starGroup = new THREE.Group();
    const starGeometry = new THREE.SphereGeometry(0.1, 4, 4);
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const starConfig = config.environment.atmosphere.stars;
    
    for (let i = 0; i < starConfig.count; i++) {
        const star = new THREE.Mesh(starGeometry, starMaterial);
        
        // Posiziona le stelle
        const radius = starConfig.radius.min + Math.random() * (starConfig.radius.max - starConfig.radius.min);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.5 + Math.PI * 0.25;
        
        star.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
        
        // Scala random
        const scale = starConfig.brightness.min + Math.random() * (starConfig.brightness.max - starConfig.brightness.min);
        star.scale.setScalar(scale);
        
        starGroup.add(star);
    }
    
    world.stars = starGroup;
    scene.add(starGroup);
}

// Luna con configurazione
function createMoon() {
    const moonConfig = config.environment.atmosphere.moon;
    
    const moonGeometry = new THREE.SphereGeometry(moonConfig.size, 20, 20);
    const moonMaterial = new THREE.MeshLambertMaterial({ 
        color: moonConfig.color,
        emissive: moonConfig.emissive
    });
    
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.set(
        moonConfig.position.x,
        moonConfig.position.y,
        moonConfig.position.z
    );
    
    // Alone luminoso
    const haloGeometry = new THREE.SphereGeometry(moonConfig.halo.size, 16, 16);
    const haloMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: moonConfig.halo.opacity
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.position.copy(moon.position);
    
    world.moon = moon;
    world.moonHalo = halo;
    scene.add(moon);
    scene.add(halo);
}

// Alberi con materiali notturni
function createNightTrees() {
    console.log('Inizializzando sistema alberi notturni...');
    
    if (!treeLoader) {
        treeLoader = new TreeLoader();
    }
    
    // Reset variabili
    spawnedTrees = [];
    occupiedTreePositions = [];
    treesSpawnedCount = 0;
    totalTreesToSpawn = treeSpawnConfig.totalTrees;
    
    startNightTreeSpawning();
}

// Spawn alberi con materiali notturni applicati
function startNightTreeSpawning() {
    let treesPlanned = 0;
    let attempts = 0;
    const maxTotalAttempts = treeSpawnConfig.totalTrees * 3;
    
    console.log(`Iniziando spawn di ${treeSpawnConfig.totalTrees} alberi notturni...`);
    
    while (treesPlanned < treeSpawnConfig.totalTrees && attempts < maxTotalAttempts) {
        attempts++;
        
        const treeType = selectTreeType();
        const position = findValidTreePosition();
        
        if (position) {
            spawnNightTree(position, treeType);
            treesPlanned++;
            
            if (treeSpawnConfig.clustering.enabled && 
                Math.random() < treeSpawnConfig.clustering.clusterChance) {
                createNightTreeCluster(position, treeType);
            }
        }
    }
    
    const treeGroup = new THREE.Group();
    world.trees = treeGroup;
    scene.add(treeGroup);
    
    const checkCompletion = () => {
        if (treesSpawnedCount >= totalTreesToSpawn) {
            console.log(`✅ Sistema alberi notturni completato! ${spawnedTrees.length} alberi totali`);
        } else {
            setTimeout(checkCompletion, 100);
        }
    };
    
    setTimeout(checkCompletion, 100);
}

// Spawn singolo albero con materiali notturni
function spawnNightTree(position, treeType, onComplete = null) {
    treeLoader.createInstance(treeType, position, (tree) => {
        // Applica materiali notturni
        applyNightMaterialsToTree(tree);
        
        scene.add(tree);
        spawnedTrees.push(tree);
        
        occupiedTreePositions.push({
            position: position.clone(),
            radius: treeSpawnConfig.placement.minDistanceBetweenTrees
        });
        
        treesSpawnedCount++;
        
        if (treesSpawnedCount % 10 === 0 || treesSpawnedCount === totalTreesToSpawn) {
            console.log(`Alberi notturni spawnati: ${treesSpawnedCount}/${totalTreesToSpawn}`);
        }
        
        if (onComplete) {
            onComplete(tree);
        }
    });
}

// Applica materiali notturni agli alberi
function applyNightMaterialsToTree(tree) {
    const treeConfig = config.materials.trees;
    
    tree.traverse((child) => {
        if (child.material) {
            // Scurisci il materiale
            if (child.material.color) {
                child.material.color.multiplyScalar(treeConfig.colorMultiplier);
            }
            
            // Aggiungi emissione blu
            child.material.emissive = new THREE.Color(treeConfig.emissive);
            child.material.emissiveIntensity = treeConfig.emissiveIntensity;
        }
    });
}

// Cluster di alberi notturni
function createNightTreeCluster(centerPosition, baseTreeType) {
    const clusterSize = THREE.MathUtils.randInt(
        treeSpawnConfig.clustering.clusterSize.min,
        treeSpawnConfig.clustering.clusterSize.max
    );
    
    for (let i = 0; i < clusterSize; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * treeSpawnConfig.clustering.clusterRadius;
        
        const clusterPosition = new THREE.Vector3(
            centerPosition.x + Math.sin(angle) * distance,
            0,
            centerPosition.z + Math.cos(angle) * distance
        );
        
        if (isTreePositionValid(clusterPosition)) {
            const treeType = Math.random() < 0.7 ? baseTreeType : selectTreeType();
            spawnNightTree(clusterPosition, treeType);
            totalTreesToSpawn++;
        }
    }
}

// Dettagli erba notturni
function createNightGrassDetails() {
    const grassGroup = new THREE.Group();
    const grassConfig = config.materials.grass;
    
    for (let i = 0; i < 500; i++) {
        const grassGeometry = new THREE.ConeGeometry(0.1, 0.5, 4);
        
        // Colori più scuri per la modalità notturna
        const grassMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color(
                grassConfig.baseColor.r + Math.random() * grassConfig.colorVariation.min,
                grassConfig.baseColor.g + Math.random() * grassConfig.colorVariation.max,
                grassConfig.baseColor.b
            )
        });
        
        const grass = new THREE.Mesh(grassGeometry, grassMaterial);
        
        grass.position.set(
            (Math.random() - 0.5) * config.world.size,
            0.25,
            (Math.random() - 0.5) * config.world.size
        );
        
        grass.rotation.z = (Math.random() - 0.5) * 0.3;
        const scale = 0.5 + Math.random() * 1;
        grass.scale.set(scale, scale, scale);
        
        grassGroup.add(grass);
    }
    
    world.grassDetails = grassGroup;
    scene.add(grassGroup);
}

// NEW: Separate function to start the game loop
function startGameLoop() {
    if (gameStarted) return;
    
    console.log('Starting night game loop...');
    gameStarted = true;
    
    // Reset clock to avoid big delta time jump
    clock.getDelta();
    
    // Start animation loop
    animate();
}

// Versione migliorata della funzione setupScoreSystem
function setupScoreSystem() {
    window.onEnemyKilled = function(enemy) {
        if (!window.player || !window.player.addScore) {
            console.error('Player not found or addScore method not available');
            return;
        }
        
        const pointsPerEnemy = {
            goblin: 100,
            orc: 200,
            vampire: 100,
        };
        
        const points = pointsPerEnemy[enemy.getType()] || 100;
        window.player.addScore(points);
        
        console.log(`Enemy ${enemy.getType()} defeated! +${points} points`);
        
        const index = enemies.indexOf(enemy);
        if (index > -1) {
            enemies.splice(index, 1);
            console.log(`Enemies remaining: ${enemies.length}`);
        }
    };
}

function resetGame() {
    console.log('Resetting game state...');
    
    // Pause the game loop
    window.gamePaused = true;
    
    // Cancel animation frame
    if (window.animationFrameId) {
        cancelAnimationFrame(window.animationFrameId);
        window.animationFrameId = null;
    }
    
    // Clean up player ONLY
    if (player && player.model && scene) {
        scene.remove(player.model);
        console.log('Player model removed from scene');
    }
    player = null;
    window.player = null;
    
    // Clean up enemies ONLY
    if (enemies && Array.isArray(enemies)) {
        enemies.forEach(enemy => {
            if (enemy.mesh && scene) {
                scene.remove(enemy.mesh);
            }
            if (typeof enemy.dispose === 'function') {
                enemy.dispose();
            }
        });
    }
    enemies = [];
    window.enemies = [];
    
    // Reset only game state flags
    gameStarted = false;
    window.gameStarted = false;
    window.gamePaused = false;
    
    // Reset clock but don't recreate it
    if (clock) {
        clock.getDelta(); // Just reset the delta
    }
    
    console.log('Game reset complete - world preserved');
}

// NEW: Restart game function - SIMPLIFIED VERSION
function restartGame() {
    console.log('Restarting game...');
    
    // Reset only player and enemies
    resetGame();
    
    // Small delay before restart
    setTimeout(() => {
        // Create new player (scene and camera already exist)
        if (typeof Player !== 'undefined' && scene && camera) {
            player = new Player(scene, camera);
            window.player = player;
            console.log('New player created');
            
            // Initialize player UI
            setTimeout(() => {
                if (player.healthUI && player.healthUI.container) {
                    player.healthUI.container.classList.add('active');
                }
                if (player.scoreUI && player.scoreUI.container) {
                    player.scoreUI.container.classList.add('active');
                }
                const spellUI = document.getElementById('spell-ui');
                if (spellUI) {
                    spellUI.classList.add('active');
                }
            }, 500);
            
        } else {
            console.error('Cannot create player - missing dependencies');
            return;
        }
        
        // Reset enemies array and spawn new ones
        enemies = [];
        window.enemies = enemies;
        
        // Spawn initial enemies
        for (let i = 0; i < 5; i++) {
            spawnEnemy();
        }
        
        // Setup score system again
        setupScoreSystem();
        
        // Start game loop
        startGameLoop();
        
        console.log('Game restarted successfully');
        
    }, 200);
}

function selectTreeType() {
    const random = Math.random() * 100;
    let currentWeight = 0;
    
    for (const [type, weight] of Object.entries(treeSpawnConfig.spawnWeights)) {
        currentWeight += weight;
        if (random <= currentWeight) {
            return type;
        }
    }
    
    // Fallback
    return 'oak';
}

// Trova posizione valida per albero
function findValidTreePosition() {
    const worldSize = config.world.size;
    
    for (let attempt = 0; attempt < treeSpawnConfig.placement.maxAttempts; attempt++) {
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * (worldSize - treeSpawnConfig.placement.minDistanceFromEdge * 2),
            0,
            (Math.random() - 0.5) * (worldSize - treeSpawnConfig.placement.minDistanceFromEdge * 2)
        );
        
        // Verifica distanza dal centro
        if (position.length() < treeSpawnConfig.placement.minDistanceFromCenter) {
            continue;
        }
        
        // Verifica distanza da altri alberi
        if (isTreePositionValid(position)) {
            return position;
        }
    }
    
    return null;
}

// Verifica se posizione è valida
function isTreePositionValid(position) {
    for (const occupied of occupiedTreePositions) {
        const distance = position.distanceTo(occupied.position);
        if (distance < occupied.radius) {
            return false;
        }
    }
    return true;
}

function checkTreeCollision(position, radius = 1) {
    if (!spawnedTrees || spawnedTrees.length === 0) return null;
    
    const collisions = [];
    
    spawnedTrees.forEach(tree => {
        if (!tree || !tree.position) return;
        
        // METODO MIGLIORATO: Usa il raggio specifico salvato nell'userData
        let treeRadius = 1.5; // Raggio base di fallback
        
        if (tree.userData && tree.userData.collisionRadius) {
            // Usa il raggio specifico calcolato al momento della creazione
            treeRadius = tree.userData.collisionRadius;
        } else if (tree.userData && tree.userData.treeType) {
            // Fallback: calcola basandosi sul tipo di albero
            const treeType = tree.userData.treeType;
            const treeLoader = window.treeLoader; // Assicurati che sia accessibile
            
            if (treeLoader) {
                const config = treeLoader.getTypeConfig(treeType);
                if (config && config.collisionRadius) {
                    const scale = tree.userData.scale || 1;
                    treeRadius = config.collisionRadius * (scale / config.baseScale);
                }
            }
        } else {
            // Ultimo fallback: usa la scala visiva (metodo precedente)
            if (tree.userData && tree.userData.scale) {
                treeRadius = 1.5 * tree.userData.scale;
            } else if (tree.scale) {
                const avgScale = (tree.scale.x + tree.scale.z) / 2;
                treeRadius = 1.5 * avgScale;
            }
        }
        
        // Calcola distanza 2D (ignora Y)
        const distance = Math.sqrt(
            Math.pow(position.x - tree.position.x, 2) + 
            Math.pow(position.z - tree.position.z, 2)
        );
        
        const minDistance = radius + treeRadius;
        
        if (distance < minDistance) {
            // C'è collisione
            const overlap = minDistance - distance;
            const direction = new THREE.Vector3(
                position.x - tree.position.x,
                0,
                position.z - tree.position.z
            );
            
            // Se sono esattamente nella stessa posizione, usa direzione random
            if (direction.length() === 0) {
                direction.set(Math.random() - 0.5, 0, Math.random() - 0.5);
            }
            
            direction.normalize();
            
            collisions.push({
                tree: tree,
                overlap: overlap,
                pushDirection: direction,
                distance: distance,
                treeRadius: treeRadius
            });
        }
    });
    
    return collisions.length > 0 ? collisions : null;
}

// Funzione per risolvere collisioni multiple
function resolveTreeCollisions(position, radius, collisions) {
    if (!collisions || collisions.length === 0) return new THREE.Vector3();
    
    const totalPush = new THREE.Vector3();
    
    collisions.forEach(collision => {
        const push = collision.pushDirection.clone().multiplyScalar(collision.overlap);
        totalPush.add(push);
    });
    
    // Se ci sono collisioni multiple, normalizza il push risultante
    if (collisions.length > 1) {
        totalPush.multiplyScalar(1 / collisions.length);
    }
    
    return totalPush;
}

// Funzione per trovare posizione libera vicina
function findNearestFreePosition(startPosition, radius = 1, maxAttempts = 16) {
    // Prima controlla se la posizione iniziale è già libera
    const initialCollisions = checkTreeCollision(startPosition, radius);
    if (!initialCollisions) {
        return startPosition.clone();
    }
    
    // Prova posizioni in cerchi concentrici
    for (let radiusStep = 2; radiusStep <= 8; radiusStep += 2) {
        for (let i = 0; i < maxAttempts; i++) {
            const angle = (i / maxAttempts) * Math.PI * 2;
            const testPosition = new THREE.Vector3(
                startPosition.x + Math.cos(angle) * radiusStep,
                startPosition.y,
                startPosition.z + Math.sin(angle) * radiusStep
            );
            
            const collisions = checkTreeCollision(testPosition, radius);
            if (!collisions) {
                return testPosition;
            }
        }
    }
    
    // Se non trova nessuna posizione libera, restituisce quella originale
    console.warn('Impossibile trovare posizione libera per entity');
    return startPosition.clone();
}

// Creazione bordi del mondo (rimane uguale)
function createWorldBorders() {
    const borderGroup = new THREE.Group();
    const borderMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x444444,
        transparent: true,
        opacity: 0.3
    });
    
    const borderHeight = 10;
    const borderThickness = 1;
    
    // Muro Nord
    const northWall = new THREE.Mesh(
        new THREE.BoxGeometry(config.world.size, borderHeight, borderThickness),
        borderMaterial
    );
    northWall.position.set(0, borderHeight/2, -config.world.size/2);
    borderGroup.add(northWall);
    
    // Muro Sud
    const southWall = new THREE.Mesh(
        new THREE.BoxGeometry(config.world.size, borderHeight, borderThickness),
        borderMaterial
    );
    southWall.position.set(0, borderHeight/2, config.world.size/2);
    borderGroup.add(southWall);
    
    // Muro Est
    const eastWall = new THREE.Mesh(
        new THREE.BoxGeometry(borderThickness, borderHeight, config.world.size),
        borderMaterial
    );
    eastWall.position.set(config.world.size/2, borderHeight/2, 0);
    borderGroup.add(eastWall);
    
    // Muro Ovest
    const westWall = new THREE.Mesh(
        new THREE.BoxGeometry(borderThickness, borderHeight, config.world.size),
        borderMaterial
    );
    westWall.position.set(-config.world.size/2, borderHeight/2, 0);
    borderGroup.add(westWall);
    
    world.borders = borderGroup;
    scene.add(borderGroup);
}

// Funzione aggiornata per spawnare nemici a ciambella
function spawnEnemy() {
    if (!player || enemies.length >= spawnConfig.maxEnemies) {
        return;
    }
    
    // Prova diversi modi per ottenere la posizione del player
    let playerPosition;
    if (typeof player.getPosition === 'function') {
        playerPosition = player.getPosition();
    } else if (player.mesh && player.mesh.position) {
        playerPosition = player.mesh.position;
    } else if (player.position) {
        playerPosition = player.position;
    } else {
        console.warn('Impossibile ottenere la posizione del player per lo spawn');
        return;
    }
    
    const spawnPosition = getValidSpawnPosition(playerPosition);
    
    if (!spawnPosition) {
        console.warn('Nessuna posizione valida trovata per lo spawn');
        return;
    }
    
    const types = ['vampire', 'orc', 'vampire'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const enemy = new Enemy(scene, spawnPosition, type);
    enemies.push(enemy);
    
    console.log(`Nemico ${type} spawnato a distanza ${playerPosition.distanceTo(spawnPosition).toFixed(1)} dal player`);
}

// Trova una posizione valida nella ciambella attorno al player
function getValidSpawnPosition(playerPosition) {
    const maxAttempts = 20; // Massimo numero di tentativi
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Genera angolo casuale
        const angle = Math.random() * Math.PI * 2;
        
        // Genera distanza casuale nella ciambella
        const distance = spawnConfig.minSpawnDistance + 
            Math.random() * (spawnConfig.maxSpawnDistance - spawnConfig.minSpawnDistance);
        
        // Calcola posizione
        const spawnPosition = new THREE.Vector3(
            playerPosition.x + Math.sin(angle) * distance,
            0,
            playerPosition.z + Math.cos(angle) * distance
        );
        
        // Verifica che la posizione sia valida
        if (isValidSpawnPosition(spawnPosition)) {
            return spawnPosition;
        }
    }
    
    return null; // Nessuna posizione valida trovata
}

// Verifica se una posizione è valida per lo spawn
function isValidSpawnPosition(position) {
    // Controlla se è dentro i confini del mondo
    const worldHalfSize = config.world.size / 2;
    if (Math.abs(position.x) > worldHalfSize - 5 || 
        Math.abs(position.z) > worldHalfSize - 5) {
        return false;
    }
    
    // Controlla collisioni con ostacoli
    if (hasObstacleNear(position)) {
        return false;
    }
    
    // Controlla che non sia troppo vicino ad altri nemici
    if (hasEnemyNear(position)) {
        return false;
    }
    
    return true;
}

// Controlla se c'è un ostacolo vicino alla posizione
function hasObstacleNear(position) {
    const checkRadius = spawnConfig.checkTerrainRadius;
    
    // Crea un raycaster per controllare ostacoli
    const raycaster = new THREE.Raycaster();
    const directions = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(1, 0, 1).normalize(),
        new THREE.Vector3(-1, 0, 1).normalize(),
        new THREE.Vector3(1, 0, -1).normalize(),
        new THREE.Vector3(-1, 0, -1).normalize(),
    ];
    
    // Lista degli oggetti da controllare
    const obstacles = [];
    if (world.trees) obstacles.push(...world.trees.children);
    
    // Controlla collisioni in tutte le direzioni
    for (const direction of directions) {
        raycaster.set(position, direction);
        const intersects = raycaster.intersectObjects(obstacles);
        
        if (intersects.length > 0 && intersects[0].distance < checkRadius) {
            return true;
        }
    }
    
    return false;
}

// Controlla se c'è un altro nemico troppo vicino
function hasEnemyNear(position) {
    const minDistance = 5; // Distanza minima tra nemici
    
    for (const enemy of enemies) {
        if (enemy.isDead && enemy.isDead() === false) {
            // Prova diversi modi per ottenere la posizione del nemico
            let enemyPosition;
            if (typeof enemy.getPosition === 'function') {
                enemyPosition = enemy.getPosition();
            } else if (enemy.mesh && enemy.mesh.position) {
                enemyPosition = enemy.mesh.position;
            } else if (enemy.position) {
                enemyPosition = enemy.position;
            } else {
                continue; // Salta questo nemico se non riusciamo a ottenere la posizione
            }
            
            if (enemyPosition.distanceTo(position) < minDistance) {
                return true;
            }
        }
    }
    
    return false;
}

// Sistema di gestione spawn automatico semplificato (senza despawn)
function manageEnemySpawning() {
    if (!player) return;
    
    // Filtra solo i nemici morti per rimuoverli dall'array
    enemies = enemies.filter(enemy => {
        if (enemy.isDead()) {
            return false;
        }
        return true;
    });
    
    // Spawna nuovi nemici se necessario
    const activeEnemies = enemies.length;
    if (activeEnemies < spawnConfig.maxEnemies) {
        spawnEnemy();
    }
}

function createWillOWispsDelayed() {
    console.log('Programmando creazione fuochi fatui...');
    
    // Aspetta che gli alberi siano caricati prima di spawn
    const checkTreesAndSpawn = () => {
        // Controlla se ci sono alberi caricati
        const treesLoaded = spawnedTrees && spawnedTrees.length > 0;
        const treesCompleted = treesSpawnedCount >= totalTreesToSpawn;
        
        if (treesLoaded && treesCompleted) {
            console.log('Alberi caricati, creando fuochi fatui...');
            createWillOWisps();
        } else {
            console.log(`Aspettando alberi: ${treesSpawnedCount}/${totalTreesToSpawn} caricati`);
            // Ricontrolla tra 1 secondo
            setTimeout(checkTreesAndSpawn, 1000);
        }
    };
    
    // Avvia il controllo
    setTimeout(checkTreesAndSpawn, 2000); // Aspetta 2 secondi iniziali
}

function createWillOWisps() {
    
    if (willOWisps) {
        willOWisps.dispose();
    }
    
    willOWisps = new WillOWisps(scene, config.environment.atmosphere.willOWisps.count);
    
    // Salva riferimento globale per debugging
    window.willOWisps = willOWisps;
    
}

function animateNightEffects(deltaTime) {
    if (willOWisps) {
        willOWisps.update(deltaTime);
    }
    animateMoon(deltaTime);
    updateStars(deltaTime);
}

// Animazione della luna
function animateMoon(deltaTime) {
    if (!world.moon) return;
    
    const time = clock.elapsedTime;
    const moonConfig = config.environment.atmosphere.moon;
    
    // Movimento lento della luna nel cielo
    const newX = moonConfig.position.x + Math.sin(time * 0.1) * 10;
    const newZ = moonConfig.position.z + Math.cos(time * 0.1) * 5;
    
    world.moon.position.x = newX;
    world.moon.position.z = newZ;
    
    // Muovi anche l'alone se esiste
    if (world.moonHalo) {
        world.moonHalo.position.x = newX;
        world.moonHalo.position.z = newZ;
        
        // Effetto pulsante sull'alone
        const pulse = 0.8 + Math.sin(time * 0.5) * 0.2;
        world.moonHalo.scale.setScalar(pulse);
    }
}

// Effetto stelle scintillanti
function updateStars(deltaTime) {
    if (!world.stars) return;
    
    const time = clock.elapsedTime;
    
    world.stars.children.forEach((star, index) => {
        // Scintillio casuale
        const twinkle = Math.sin(time * 2 + index) * 0.3 + 0.7;
        star.material.opacity = twinkle;
        
        // Leggera rotazione
        star.rotation.y += deltaTime * 0.1;
    });
}

function getNearbyWillOWisps(position, radius = 8) {
    if (!willOWisps) return [];
    return willOWisps.getNearbyWisps(position, radius);
}

// Funzione per ottenere illuminazione aggiuntiva dai fuochi fatui vicini
function getWispLightBonus(position) {
    const nearbyWisps = getNearbyWillOWisps(position, 10);
    const bonus = nearbyWisps.length * 0.08; // 8% di bonus luce per ogni fuoco fatuo vicino
    return Math.min(bonus, 0.4); // Massimo 40% di bonus
}

// Funzione per ottenere l'atmosfera magica nell'area
function getWispMagicLevel(position) {
    const nearbyWisps = getNearbyWillOWisps(position, 15);
    return {
        count: nearbyWisps.length,
        intensity: Math.min(nearbyWisps.length / 5, 1.0), // Normalizzato 0-1
        hasStrongMagic: nearbyWisps.length >= 4
    };
}

// Funzione per ottenere statistiche alberi
function getTreeStats() {
    const stats = {
        total: spawnedTrees.length,
        byType: {}
    };
    
    spawnedTrees.forEach(tree => {
        const type = tree.userData.treeType || 'unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
    });
    
    return stats;
}

// Gestione resize finestra
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// FUNZIONE ANIMATE AGGIORNATA
function animate() {
    if (window.gamePaused) {
        return; // Don't continue animation loop when paused
    }

    const deltaTime = clock.getDelta();
    
    // Update player
    if (player) {
        player.update(deltaTime);
    }

    animateNightEffects(deltaTime);
    
    // Update enemies - IMPORTANTE: usa la stessa variabile
    if (Array.isArray(enemies)) {
        window.enemies = enemies.filter(enemy => {
            if (enemy.isDead && enemy.isDead()) {
                return false;
            }
            if (enemy.update && typeof enemy.update === 'function') {
                enemy.update(deltaTime, player);
            }
            return true;
        });
    }

    // Gestisci spawn nemici ogni secondo circa
    if (Math.floor(clock.elapsedTime * 2) % 2 === 0) {
        manageEnemySpawning();
    }
    
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Avvia quando la pagina è caricata
window.init = init;