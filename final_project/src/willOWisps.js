// WillOWisps.js - Sistema di fuochi fatui statici viola con controllo alberi
class WillOWisps {
    isPositionValidFromOtherWisps(position) {
        // Controlla distanza da altri fuochi fatui già piazzati
        for (const existingWisp of this.wisps) {
            if (existingWisp.position && existingWisp.active) {
                const distance = position.distanceTo(existingWisp.position);
                if (distance < this.config.minDistanceBetweenWisps) {
                    return false;
                }
            }
        }
        return true;
    }
    constructor(scene, count = 25) {
        this.scene = scene;
        this.count = count;
        this.wisps = [];
        this.particleSystem = null;
        this.time = 0;
        
        // Configurazione
        this.config = {
            // Aspetto visivo
            minSize: 0.4,              // Dimensione minima
            maxSize: 1.0,              // Dimensione massima
            pulseSpeed: 0.8,           // Velocità pulsazione lenta
            
            // Distribuzione
            spawnRadius: 100,          // Raggio spawn aumentato
            minSpawnDistance: 5,      // Distanza minima dal centro
            minHeight: 1.8,            // Altezza minima sollevata dal terreno
            maxHeight: 4.5,            // Altezza massima aumentata
            
            // Luce
            lightIntensity: 0.3,       // Intensità ridotta
            lightDistance: 8,          // Distanza luce ridotta
            
            // Controllo spawn
            minDistanceFromTrees: 3,   // Distanza minima dagli alberi
            minDistanceBetweenWisps: 8, // Distanza minima tra fuochi fatui
            maxSpawnAttempts: 80,      // Più tentativi per trovare posizioni
            
            // Colori viola
            colors: [
                { r: 0.6, g: 0.3, b: 0.9 },  // Viola brillante
                { r: 0.5, g: 0.2, b: 0.8 },  // Viola medio
                { r: 0.7, g: 0.4, b: 1.0 },  // Viola chiaro
                { r: 0.4, g: 0.1, b: 0.7 },  // Viola scuro
                { r: 0.8, g: 0.5, b: 0.9 },  // Viola pastello
                { r: 0.5, g: 0.1, b: 0.9 },  // Viola intenso
            ]
        };
        
        this.init();
    }
    
    init() {
        this.createParticleSystem();
        this.createWispInstances();
    }
    
    createParticleSystem() {
        // Geometria per le particelle
        const geometry = new THREE.BufferGeometry();
        
        // Arrays per gli attributi
        const positions = new Float32Array(this.count * 3);
        const colors = new Float32Array(this.count * 3);
        const sizes = new Float32Array(this.count);
        const phases = new Float32Array(this.count); // Per variare la pulsazione
        
        // Inizializza gli attributi
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            
            // Posizione iniziale (sarà aggiornata durante la creazione)
            positions[i3] = 0;
            positions[i3 + 1] = 0;
            positions[i3 + 2] = 0;
            
            // Colore casuale dalla palette viola
            const colorIndex = Math.floor(Math.random() * this.config.colors.length);
            const color = this.config.colors[colorIndex];
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            // Dimensione casuale
            sizes[i] = this.config.minSize + Math.random() * (this.config.maxSize - this.config.minSize);
            
            // Fase di pulsazione casuale
            phases[i] = Math.random() * Math.PI * 2;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
        
        // Shader materiale personalizzato compatibile con Three.js r128
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                pointTexture: { value: this.createWispTexture() }
            },
            vertexShader: `
                attribute float size;
                attribute float phase;
                
                uniform float time;
                
                varying vec3 vColor;
                varying float vAlpha;
                
                void main() {
                    vColor = color;
                    
                    // Pulsazione lenta e delicata
                    float pulse = sin(time * 1.2 + phase) * 0.2 + 0.8;
                    vAlpha = pulse;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    
                    // Dimensione che varia leggermente con la pulsazione
                    float finalSize = size * (0.9 + pulse * 0.2) * 50.0;
                    gl_PointSize = finalSize * (300.0 / -mvPosition.z);
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                #ifdef GL_ES
                precision mediump float;
                #endif
                
                uniform sampler2D pointTexture;
                
                varying vec3 vColor;
                varying float vAlpha;
                
                void main() {
                    vec4 textureColor = texture2D(pointTexture, gl_PointCoord);
                    
                    // Combina texture e colore viola con effetto glow
                    vec3 finalColor = vColor * textureColor.rgb * 1.2;
                    float finalAlpha = textureColor.a * vAlpha * 0.9;
                    
                    // Effetto glow più intenso per i viola
                    float dist = length(gl_PointCoord - vec2(0.5));
                    float glow = smoothstep(0.5, 0.0, dist);
                    finalAlpha *= glow;
                    
                    // Intensifica i colori viola
                    finalColor = mix(finalColor, finalColor * 1.5, 0.3);
                    
                    gl_FragColor = vec4(finalColor, finalAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true
        });
        
        // Crea il sistema di particelle
        this.particleSystem = new THREE.Points(geometry, material);
        this.scene.add(this.particleSystem);
    }
    
    createWispTexture() {
        // Crea una texture procedurale per i fuochi fatui viola
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Gradiente radiale per effetto glow viola
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,220,255,0.9)');
        gradient.addColorStop(0.5, 'rgba(200,150,255,0.6)');
        gradient.addColorStop(0.8, 'rgba(150,100,200,0.2)');
        gradient.addColorStop(1, 'rgba(100,50,150,0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        return texture;
    }
    
    createWispInstances() {
        console.log('Generando posizioni per fuochi fatui...');
        let successfulSpawns = 0;
        
        // Crea istanze statiche dei fuochi fatui
        for (let i = 0; i < this.count; i++) {
            const position = this.findValidSpawnPosition();
            
            if (position) {
                const wisp = {
                    id: i,
                    position: position,
                    light: null,
                    active: true,
                    pulseOffset: Math.random() * Math.PI * 2, // Offset per pulsazione individuale
                };
                
                // Crea luce punto per questo fuoco fatuo
                this.createWispLight(wisp, i);
                
                // Aggiorna posizione della particella
                this.updateWispParticle(wisp, i);
                
                this.wisps.push(wisp);
                successfulSpawns++;
            } else {
                console.warn(`Impossibile trovare posizione valida per fuoco fatuo ${i}`);
            }
        }
        
        console.log(`✨ Creati ${successfulSpawns}/${this.count} fuochi fatui viola`);
        
        // Aggiorna le posizioni nel buffer
        if (this.particleSystem) {
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
        }
    }
    
    findValidSpawnPosition() {
        for (let attempt = 0; attempt < this.config.maxSpawnAttempts; attempt++) {
            // Genera posizione casuale
            const angle = Math.random() * Math.PI * 2;
            const radius = 15 + Math.random() * this.config.spawnRadius;
            
            const position = new THREE.Vector3(
                Math.sin(angle) * radius,
                this.config.minHeight + Math.random() * (this.config.maxHeight - this.config.minHeight),
                Math.cos(angle) * radius
            );
            
            // Verifica che non sia troppo vicina agli alberi
            if (this.isPositionValidFromTrees(position)) {
                return position;
            }
        }
        
        return null; // Nessuna posizione valida trovata
    }
    
    isPositionValidFromTrees(position) {
        // Usa la funzione globale checkTreeCollision se disponibile
        if (typeof window.checkTreeCollision === 'function') {
            const collision = window.checkTreeCollision(position, this.config.minDistanceFromTrees);
            return collision === null;
        }
        
        // Fallback: controlla manualmente gli alberi spawnati
        if (window.spawnedTrees && Array.isArray(window.spawnedTrees)) {
            for (const tree of window.spawnedTrees) {
                if (!tree || !tree.position) continue;
                
                const distance = position.distanceTo(tree.position);
                if (distance < this.config.minDistanceFromTrees) {
                    return false;
                }
            }
        }
        
        // Se non ci sono sistemi di controllo alberi, considera valida
        return true;
    }
    
    createWispLight(wisp, index) {
        // Colore della luce basato sul colore della particella
        const colorIndex = index % this.config.colors.length;
        const colorConfig = this.config.colors[colorIndex];
        
        const lightColor = new THREE.Color(colorConfig.r, colorConfig.g, colorConfig.b);
        
        const light = new THREE.PointLight(
            lightColor,
            this.config.lightIntensity,
            this.config.lightDistance
        );
        
        light.position.copy(wisp.position);
        wisp.light = light;
        this.scene.add(light);
    }
    
    updateWispParticle(wisp, index) {
        const positions = this.particleSystem.geometry.attributes.position;
        const i3 = index * 3;
        
        if (wisp.active && wisp.position) {
            positions.array[i3] = wisp.position.x;
            positions.array[i3 + 1] = wisp.position.y;
            positions.array[i3 + 2] = wisp.position.z;
        } else {
            // Nasconde la particella quando non attiva
            positions.array[i3] = -1000;
            positions.array[i3 + 1] = -1000;
            positions.array[i3 + 2] = -1000;
        }
    }
    
    update(deltaTime) {
        this.time += deltaTime;
        
        // Aggiorna uniform del tempo per gli shader (pulsazione)
        if (this.particleSystem && this.particleSystem.material.uniforms.time) {
            this.particleSystem.material.uniforms.time.value = this.time;
        }
        
        // Aggiorna solo l'intensità delle luci (pulsazione individuale)
        this.wisps.forEach(wisp => {
            if (wisp.light && wisp.active) {
                // Pulsazione lenta e individuale per ogni luce
                const pulse = Math.sin(this.time * this.config.pulseSpeed + wisp.pulseOffset) * 0.15 + 0.85;
                wisp.light.intensity = this.config.lightIntensity * pulse;
            }
        });
    }
    
    // Metodo per ottenere i fuochi fatui vicini a una posizione
    getNearbyWisps(position, radius = 5) {
        return this.wisps.filter(wisp => {
            if (!wisp.active) return false;
            return wisp.position.distanceTo(position) <= radius;
        });
    }
    
    // Metodo per ottenere tutti i fuochi fatui attivi
    getActiveWisps() {
        return this.wisps.filter(wisp => wisp.active);
    }
    
    // Metodo per abilitare/disabilitare specifici fuochi fatui
    setWispActive(index, active) {
        if (index >= 0 && index < this.wisps.length) {
            this.wisps[index].active = active;
            if (this.wisps[index].light) {
                this.wisps[index].light.visible = active;
            }
            this.updateWispParticle(this.wisps[index], index);
            
            if (this.particleSystem) {
                this.particleSystem.geometry.attributes.position.needsUpdate = true;
            }
        }
    }
    
    // Cleanup
    dispose() {
        if (this.particleSystem) {
            this.scene.remove(this.particleSystem);
            this.particleSystem.geometry.dispose();
            this.particleSystem.material.dispose();
            if (this.particleSystem.material.uniforms.pointTexture.value) {
                this.particleSystem.material.uniforms.pointTexture.value.dispose();
            }
        }
        
        // Rimuovi tutte le luci
        this.wisps.forEach(wisp => {
            if (wisp.light) {
                this.scene.remove(wisp.light);
            }
        });
        
        this.wisps = [];
    }
    
    // Metodi di utilità per debug/configurazione
    setIntensity(intensity) {
        this.config.lightIntensity = intensity;
        this.wisps.forEach(wisp => {
            if (wisp.light) {
                wisp.light.intensity = intensity;
            }
        });
    }
    
    // Ricrea i fuochi fatui con nuovo numero
    setCount(newCount) {
        if (newCount === this.count) return;
        
        this.dispose();
        this.count = newCount;
        this.wisps = [];
        this.init();
    }
    
    // Rigenera le posizioni (utile se cambiano gli alberi)
    regeneratePositions() {
        console.log('Rigenerando posizioni fuochi fatui...');
        
        // Rimuovi luci esistenti
        this.wisps.forEach(wisp => {
            if (wisp.light) {
                this.scene.remove(wisp.light);
            }
        });
        
        // Trova nuove posizioni valide
        let successfulSpawns = 0;
        
        this.wisps.forEach((wisp, index) => {
            const newPosition = this.findValidSpawnPosition();
            if (newPosition) {
                wisp.position.copy(newPosition);
                this.createWispLight(wisp, index);
                this.updateWispParticle(wisp, index);
                successfulSpawns++;
            } else {
                wisp.active = false;
                if (wisp.light) {
                    this.scene.remove(wisp.light);
                    wisp.light = null;
                }
            }
        });
        
        // Aggiorna buffer delle posizioni
        if (this.particleSystem) {
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
        }
        
        console.log(`✨ Riposizionati ${successfulSpawns}/${this.wisps.length} fuochi fatui`);
    }
}

// Esporta la classe
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WillOWisps;
} else {
    window.WillOWisps = WillOWisps;
}