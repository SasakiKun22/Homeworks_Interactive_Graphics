//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

//import Player from "./player";

// main.js - Versione aggiornata con integrazione Player

// Variabili globali
let scene, camera, renderer;
let world = {};
let player = null;
let clock = new THREE.Clock(); // Importante: clock per deltaTime

// Configurazione
const config = {
    world: {
        size: 200,  // Mondo più grande
        tileSize: 2, // Dimensione del tile per la texture ripetuta
        grassTexturePath: '../resources/grass_tile_0.png' // Percorso della tua texture
    },
    camera: {
        fov: 75,
        near: 0.1,
        far: 1000,
        position: { x: 30, y: 30, z: 30 }
    },
    fog: {
        color: 0x87CEEB,
        near: 80,
        far: 250
    }
};

// Inizializzazione
function init() {
    // Nascondi il loading
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    // Crea la scena
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(config.fog.color, config.fog.near, config.fog.far);
    
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
    
    // Setup renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(config.fog.color);
    document.body.appendChild(renderer.domElement);
    
    // Crea il mondo
    createWorld();
    
    // Setup luci
    setupLights();
    
    // Crea il player
    // IMPORTANTE: Assicurati che la classe Player sia caricata prima di questo punto
    if (typeof Player !== 'undefined') {
        player = new Player(scene, camera);
        console.log('Player creato con successo');
    } else {
        console.error('Classe Player non trovata! Assicurati di includere player.js');
    }
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    
    // Avvia il game loop
    animate();
}

// Creazione del mondo (aggiornata con texture)
function createWorld() {
    // Carica la texture dell'erba
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load(
        config.world.grassTexturePath,
        // Callback quando la texture è caricata
        (texture) => {
            console.log('Texture erba caricata');
        },
        // Progress callback (opzionale)
        undefined,
        // Error callback
        (error) => {
            console.error('Errore nel caricamento della texture:', error);
        }
    );
    
    // Configura la texture per ripetersi
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    // Calcola quante volte ripetere la texture basandosi sulla dimensione del tile
    const repeatCount = config.world.size / config.world.tileSize;
    grassTexture.repeat.set(repeatCount, repeatCount);
    
    // Opzionale: migliora la qualità della texture
    grassTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    grassTexture.minFilter = THREE.LinearMipMapLinearFilter;
    grassTexture.magFilter = THREE.LinearFilter;
    
    // Terreno principale con texture
    const groundGeometry = new THREE.PlaneGeometry(config.world.size, config.world.size);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
        map: grassTexture,
        side: THREE.DoubleSide
    });
    world.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    world.ground.rotation.x = -Math.PI / 2;
    world.ground.receiveShadow = true;
    scene.add(world.ground);
    
    // NON aggiungiamo più la griglia
    // Aggiungi alcuni alberi (aumentati per il mondo più grande)
    createTrees();
    
    // Aggiungi alcune rocce (aumentate per il mondo più grande)
    createRocks();
    
    // Aggiungi dettagli extra per rendere il mondo più vivo
    createGrassDetails();
    
    // Bordi del mondo (aggiornati per il mondo più grande)
    createWorldBorders();
}

// Creazione alberi (aumentati per mondo più grande)
function createTrees() {
    const treeGroup = new THREE.Group();
    
    for (let i = 0; i < 60; i++) {  // Raddoppiato il numero di alberi
        const tree = new THREE.Group();
        
        // Tronco
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 3);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);
        
        // Chioma
        const leavesGeometry = new THREE.ConeGeometry(2.5, 5, 8);
        const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x0d5f0d });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 5;
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        tree.add(leaves);
        
        // Posiziona l'albero randomly nel mondo più grande
        tree.position.set(
            (Math.random() - 0.5) * (config.world.size - 20),
            0,
            (Math.random() - 0.5) * (config.world.size - 20)
        );
        
        // Scala random per varietà
        const scale = 0.8 + Math.random() * 0.4;
        tree.scale.set(scale, scale, scale);
        
        // Rotazione random
        tree.rotation.y = Math.random() * Math.PI * 2;
        
        treeGroup.add(tree);
    }
    
    world.trees = treeGroup;
    scene.add(treeGroup);
}

// Creazione rocce (aumentate per mondo più grande)
function createRocks() {
    const rockGroup = new THREE.Group();
    
    for (let i = 0; i < 80; i++) {  // Raddoppiato il numero di rocce
        const rockGeometry = new THREE.DodecahedronGeometry(1);
        const rockMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x666666 
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        
        // Posizione random
        rock.position.set(
            (Math.random() - 0.5) * (config.world.size - 10),
            Math.random() * 0.3,
            (Math.random() - 0.5) * (config.world.size - 10)
        );
        
        // Scala random
        const scale = Math.random() * 0.8 + 0.2;
        rock.scale.set(
            scale * (Math.random() + 0.5),
            scale * (Math.random() + 0.5),
            scale * (Math.random() + 0.5)
        );
        
        // Rotazione random
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        
        rock.castShadow = true;
        rock.receiveShadow = true;
        
        rockGroup.add(rock);
    }
    
    world.rocks = rockGroup;
    scene.add(rockGroup);
}

// Nuova funzione per aggiungere dettagli di erba/vegetazione
function createGrassDetails() {
    const grassGroup = new THREE.Group();
    
    // Piccoli ciuffi d'erba o fiori
    for (let i = 0; i < 100; i++) {
        const grassGeometry = new THREE.ConeGeometry(0.1, 0.5, 4);
        const grassMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color(0.1 + Math.random() * 0.1, 0.4 + Math.random() * 0.2, 0.1)
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

// Setup illuminazione (rimane uguale)
function setupLights() {
    // Luce ambientale
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    // Luce direzionale (sole)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    
    // Configurazione ombre
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    
    scene.add(directionalLight);
    
    // Luce emisferica per dare più realismo
    const hemisphereLight = new THREE.HemisphereLight(
        0x87CEEB, // colore del cielo
        0x3a5f3a, // colore del terreno
        0.3
    );
    scene.add(hemisphereLight);
}

// Gestione resize finestra
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===== FUNZIONE ANIMATE AGGIORNATA =====
function animate() {
    requestAnimationFrame(animate);
    
    // Ottieni deltaTime dal clock
    const deltaTime = clock.getDelta();
    
    // Se il player esiste, aggiornalo
    if (player) {
        player.update(deltaTime);
        // La camera viene aggiornata automaticamente dal player
    } else {
        // Se non c'è il player, mantieni la rotazione della camera originale
        const time = Date.now() * 0.0005;
        camera.position.x = Math.cos(time) * 40;
        camera.position.z = Math.sin(time) * 40;
        camera.lookAt(0, 0, 0);
    }
    
    // Qui potrai aggiungere altri update del gioco
    // Per esempio:
    // - Update dei nemici
    // - Update del sistema di particelle
    // - Update della UI
    // - Controllo collisioni
    
    // Render della scena
    renderer.render(scene, camera);
}

// Avvia quando la pagina è caricata
window.addEventListener('load', init);