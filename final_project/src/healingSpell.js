// HealingSpell.js - Sistema di spell di cura con particelle WebGL

class HealingSpell {
    constructor(scene) {
        this.scene = scene;
        this.activeSpells = [];
        this.clock = new THREE.Clock();
        
        // Carica texture per le particelle
        this.textureLoader = new THREE.TextureLoader();
        this.healTexture = this.createHealTexture();
        this.sparkleTexture = this.createSparkleTexture();
        
        console.log('✅ HealingSpell inizializzato');
    }

    // Crea texture procedurale per le particelle di cura
    createHealTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Gradiente radiale per simulare energia curativa
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(100, 255, 100, 1)');     // Centro verde brillante
        gradient.addColorStop(0.3, 'rgba(80, 220, 80, 0.9)');   // Verde intenso
        gradient.addColorStop(0.6, 'rgba(60, 180, 60, 0.7)');   // Verde medio
        gradient.addColorStop(0.8, 'rgba(40, 140, 40, 0.4)');   // Verde scuro
        gradient.addColorStop(1, 'rgba(20, 100, 20, 0)');       // Bordo verde scuro
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        // Aggiungi pattern a croce per simbolo di cura
        ctx.strokeStyle = 'rgba(200, 255, 200, 0.6)';
        ctx.lineWidth = 3;
        // Croce orizzontale
        ctx.beginPath();
        ctx.moveTo(16, 32);
        ctx.lineTo(48, 32);
        ctx.stroke();
        // Croce verticale
        ctx.beginPath();
        ctx.moveTo(32, 16);
        ctx.lineTo(32, 48);
        ctx.stroke();
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // Crea texture per scintille di guarigione
    createSparkleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(150, 255, 150, 1)');     // Centro verde chiaro
        gradient.addColorStop(0.5, 'rgba(100, 220, 100, 0.8)'); // Medio verde
        gradient.addColorStop(1, 'rgba(50, 180, 50, 0)');       // Bordo verde
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // Metodo principale per creare l'effetto di cura
    createHealingEffect(playerPosition, config) {
        const healingId = 'HealingSpell_' + Date.now();
        
        const healingSpell = {
            id: healingId,
            startTime: Date.now(),
            duration: config.duration || 2000, // 2 secondi di durata
            radius: config.radius || 2,
            height: config.height || 4,
            playerPosition: playerPosition.clone(),
            
            // Sistemi di particelle
            spiralParticles: null,
            burstParticles: null,
            
            // Cleanup
            disposed: false
        };

        // Crea i sistemi di particelle
        this.createSpiralParticleSystem(healingSpell);
        this.createBurstParticleSystem(healingSpell);
        
        // Aggiungi alla lista degli spell attivi
        this.activeSpells.push(healingSpell);
        
        console.log(`💚 Effetto di cura creato: ${healingId}`);
        
        return healingId;
    }

    // Crea il sistema di particelle a spirale
    createSpiralParticleSystem(healingSpell) {
        const particleCount = 150;
        
        const geometry = new THREE.BufferGeometry();
        
        // Array per posizioni, velocità, vita, dimensione
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const lifetimes = new Float32Array(particleCount);
        const maxLifetimes = new Float32Array(particleCount);
        const sizes = new Float32Array(particleCount);
        const colors = new Float32Array(particleCount * 3);
        const spiralParams = new Float32Array(particleCount * 2); // [angolo_iniziale, raggio_iniziale]
        
        // Inizializza le particelle per movimento a spirale
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const i2 = i * 2;
            
            // Parametri della spirale
            spiralParams[i2] = (i / particleCount) * Math.PI * 4; // Angolo iniziale
            spiralParams[i2 + 1] = 0.3 + Math.random() * 0.5; // Raggio iniziale
            
            // Posizione iniziale alla base del player
            positions[i3] = healingSpell.playerPosition.x;
            positions[i3 + 1] = healingSpell.playerPosition.y + 0.2;
            positions[i3 + 2] = healingSpell.playerPosition.z;
            
            // Velocità verso l'alto con spirale
            velocities[i3] = 0;
            velocities[i3 + 1] = 1.5 + Math.random() * 1; // Velocità verticale
            velocities[i3 + 2] = 0;
            
            // Vita della particella
            maxLifetimes[i] = 1.5 + Math.random() * 1;
            lifetimes[i] = Math.random() * 0.5; // Partenza scaglionata
            
            // Dimensione
            sizes[i] = 0.4 + Math.random() * 0.6;
            
            // Colore (sfumature di verde curativo)
            const healIntensity = 0.7 + Math.random() * 0.3;
            colors[i3] = 0.2 * healIntensity; // Rosso basso
            colors[i3 + 1] = 1.0 * healIntensity; // Verde alto
            colors[i3 + 2] = 0.3 * healIntensity; // Blu basso
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        geometry.setAttribute('maxLifetime', new THREE.BufferAttribute(maxLifetimes, 1));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('spiralParam', new THREE.BufferAttribute(spiralParams, 2));
        
        // Shader material personalizzato per le particelle a spirale
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                healTexture: { value: this.healTexture },
                playerPosition: { value: healingSpell.playerPosition },
                effectRadius: { value: healingSpell.radius }
            },
            vertexShader: `
                attribute float lifetime;
                attribute float maxLifetime;
                attribute float size;
                attribute vec3 velocity;
                attribute vec3 color;
                attribute vec2 spiralParam;
                
                uniform float time;
                uniform vec3 playerPosition;
                uniform float effectRadius;
                
                varying float vLifetime;
                varying vec3 vColor;
                varying float vOpacity;
                
                void main() {
                    vLifetime = lifetime;
                    vColor = color;
                    
                    // Calcola la posizione a spirale
                    float lifeProgress = lifetime / maxLifetime;
                    float spiralAngle = spiralParam.x + lifeProgress * 6.28 * 3.0; // 3 giri completi
                    float spiralRadius = spiralParam.y * (1.0 - lifeProgress * 0.5); // Si restringe salendo
                    
                    vec3 worldPos = playerPosition;
                    worldPos.x += cos(spiralAngle) * spiralRadius * effectRadius;
                    worldPos.y += lifetime * velocity.y;
                    worldPos.z += sin(spiralAngle) * spiralRadius * effectRadius;
                    
                    // Calcola opacità basata sulla vita
                    vOpacity = 1.0 - lifeProgress;
                    vOpacity *= smoothstep(0.0, 0.2, lifeProgress); // Fade in iniziale
                    vOpacity *= 0.8; // Opacità generale
                    
                    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Dimensione della particella
                    gl_PointSize = size * (200.0 / -mvPosition.z) * vOpacity;
                }
            `,
            fragmentShader: `
                uniform sampler2D healTexture;
                
                varying float vLifetime;
                varying vec3 vColor;
                varying float vOpacity;
                
                void main() {
                    vec2 uv = gl_PointCoord;
                    vec4 textureColor = texture2D(healTexture, uv);
                    
                    // Mescola il colore della particella con la texture
                    vec3 finalColor = mix(vColor, textureColor.rgb, 0.5);
                    
                    float alpha = textureColor.a * vOpacity;
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        const particles = new THREE.Points(geometry, material);
        particles.name = healingSpell.id + '_spiral';
        particles.frustumCulled = false;
        
        healingSpell.spiralParticles = particles;
        this.scene.add(particles);
    }

    // Crea il sistema di particelle esplosive (burst)
    createBurstParticleSystem(healingSpell) {
        const particleCount = 80;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const lifetimes = new Float32Array(particleCount);
        const maxLifetimes = new Float32Array(particleCount);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Posizione iniziale al centro del player
            positions[i3] = healingSpell.playerPosition.x;
            positions[i3 + 1] = healingSpell.playerPosition.y + 1;
            positions[i3 + 2] = healingSpell.playerPosition.z;
            
            // Velocità radiale verso l'esterno
            const angle = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI; // Angolo verticale
            const speed = 2 + Math.random() * 3;
            
            velocities[i3] = Math.sin(phi) * Math.cos(angle) * speed;
            velocities[i3 + 1] = Math.cos(phi) * speed * 0.5; // Meno velocità verticale
            velocities[i3 + 2] = Math.sin(phi) * Math.sin(angle) * speed;
            
            // Vita più breve per l'effetto burst
            maxLifetimes[i] = 0.8 + Math.random() * 0.6;
            lifetimes[i] = Math.random() * 0.3;
            
            // Dimensioni varie
            sizes[i] = 0.3 + Math.random() * 0.5;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        geometry.setAttribute('maxLifetime', new THREE.BufferAttribute(maxLifetimes, 1));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                sparkleTexture: { value: this.sparkleTexture },
                playerPosition: { value: healingSpell.playerPosition }
            },
            vertexShader: `
                attribute float lifetime;
                attribute float maxLifetime;
                attribute float size;
                attribute vec3 velocity;
                
                uniform float time;
                uniform vec3 playerPosition;
                
                varying float vLifetime;
                varying float vOpacity;
                
                void main() {
                    vLifetime = lifetime;
                    
                    vec3 worldPos = position;
                    worldPos += velocity * lifetime;
                    
                    float lifeRatio = lifetime / maxLifetime;
                    vOpacity = (1.0 - lifeRatio) * 0.9;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    gl_PointSize = size * (180.0 / -mvPosition.z) * vOpacity;
                }
            `,
            fragmentShader: `
                uniform sampler2D sparkleTexture;
                
                varying float vLifetime;
                varying float vOpacity;
                
                void main() {
                    vec2 uv = gl_PointCoord;
                    vec4 textureColor = texture2D(sparkleTexture, uv);
                    
                    vec3 sparkleColor = vec3(0.6, 1.0, 0.6); // Verde sparkle
                    float alpha = textureColor.a * vOpacity;
                    
                    gl_FragColor = vec4(sparkleColor, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        const burstParticles = new THREE.Points(geometry, material);
        burstParticles.name = healingSpell.id + '_burst';
        burstParticles.frustumCulled = false;
        
        healingSpell.burstParticles = burstParticles;
        this.scene.add(burstParticles);
    }

    // Update principale del sistema
    update(deltaTime, playerPosition) {
        const currentTime = Date.now();
        
        for (let i = this.activeSpells.length - 1; i >= 0; i--) {
            const spell = this.activeSpells[i];
            
            if (spell.disposed) {
                this.activeSpells.splice(i, 1);
                continue;
            }
            
            const elapsed = currentTime - spell.startTime;
            const timeInSeconds = elapsed / 1000;
            
            // Aggiorna posizione dell'effetto seguendo il player
            if (playerPosition) {
                spell.playerPosition.copy(playerPosition);
            }
            
            // Aggiorna shader uniforms
            if (spell.spiralParticles) {
                spell.spiralParticles.material.uniforms.time.value = timeInSeconds;
                spell.spiralParticles.material.uniforms.playerPosition.value.copy(spell.playerPosition);
                this.updateSpiralParticles(spell, deltaTime);
            }
            
            if (spell.burstParticles) {
                spell.burstParticles.material.uniforms.time.value = timeInSeconds;
                spell.burstParticles.material.uniforms.playerPosition.value.copy(spell.playerPosition);
                this.updateBurstParticles(spell, deltaTime);
            }
            
            // Controlla durata
            if (elapsed > spell.duration) {
                this.disposeHealingSpell(spell);
                this.activeSpells.splice(i, 1);
            }
        }
    }

    // Aggiorna particelle a spirale
    updateSpiralParticles(healingSpell, deltaTime) {
        const geometry = healingSpell.spiralParticles.geometry;
        const lifetimes = geometry.attributes.lifetime.array;
        const maxLifetimes = geometry.attributes.maxLifetime.array;
        const spiralParams = geometry.attributes.spiralParam.array;
        
        for (let i = 0; i < lifetimes.length; i++) {
            lifetimes[i] += deltaTime;
            
            // Rigenera particella se è morta
            if (lifetimes[i] > maxLifetimes[i]) {
                lifetimes[i] = 0;
                
                // Nuovi parametri spirale
                const i2 = i * 2;
                spiralParams[i2] = Math.random() * Math.PI * 2;
                spiralParams[i2 + 1] = 0.3 + Math.random() * 0.5;
            }
        }
        
        geometry.attributes.lifetime.needsUpdate = true;
        geometry.attributes.spiralParam.needsUpdate = true;
    }

    // Aggiorna particelle burst
    updateBurstParticles(healingSpell, deltaTime) {
        const geometry = healingSpell.burstParticles.geometry;
        const lifetimes = geometry.attributes.lifetime.array;
        const maxLifetimes = geometry.attributes.maxLifetime.array;
        const positions = geometry.attributes.position.array;
        const velocities = geometry.attributes.velocity.array;
        
        for (let i = 0; i < lifetimes.length; i++) {
            lifetimes[i] += deltaTime;
            
            if (lifetimes[i] > maxLifetimes[i]) {
                lifetimes[i] = 0;
                
                // Nuova posizione e velocità
                const i3 = i * 3;
                positions[i3] = healingSpell.playerPosition.x;
                positions[i3 + 1] = healingSpell.playerPosition.y + 1;
                positions[i3 + 2] = healingSpell.playerPosition.z;
                
                const angle = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI;
                const speed = 2 + Math.random() * 3;
                
                velocities[i3] = Math.sin(phi) * Math.cos(angle) * speed;
                velocities[i3 + 1] = Math.cos(phi) * speed * 0.5;
                velocities[i3 + 2] = Math.sin(phi) * Math.sin(angle) * speed;
            }
        }
        
        geometry.attributes.lifetime.needsUpdate = true;
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.velocity.needsUpdate = true;
    }

    // Pulisce un effetto di cura specifico
    disposeHealingSpell(healingSpell) {
        if (healingSpell.disposed) return;
        
        healingSpell.disposed = true;
        
        // Rimuovi particelle a spirale
        if (healingSpell.spiralParticles) {
            this.scene.remove(healingSpell.spiralParticles);
            healingSpell.spiralParticles.geometry.dispose();
            healingSpell.spiralParticles.material.dispose();
            healingSpell.spiralParticles = null;
        }
        
        // Rimuovi particelle burst
        if (healingSpell.burstParticles) {
            this.scene.remove(healingSpell.burstParticles);
            healingSpell.burstParticles.geometry.dispose();
            healingSpell.burstParticles.material.dispose();
            healingSpell.burstParticles = null;
        }
        
        console.log(`🧹 Effetto di cura ${healingSpell.id} rimosso`);
    }

    // Pulisce tutti gli effetti
    dispose() {
        for (const spell of this.activeSpells) {
            this.disposeHealingSpell(spell);
        }
        this.activeSpells = [];
        
        // Pulisci texture
        if (this.healTexture) {
            this.healTexture.dispose();
        }
        if (this.sparkleTexture) {
            this.sparkleTexture.dispose();
        }
        
        console.log('🧹 HealingSpell completamente pulito');
    }

    // Getter per debug
    getActiveSpellsCount() {
        return this.activeSpells.length;
    }

    getActiveSpells() {
        return this.activeSpells.map(spell => ({
            id: spell.id,
            age: Date.now() - spell.startTime,
            position: spell.playerPosition
        }));
    }
}

// Export per compatibilità
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HealingSpell;
}