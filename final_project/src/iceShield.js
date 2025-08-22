// IceShield.js - Sistema di scudo di ghiaccio con particelle WebGL

class IceShield {
    constructor(scene) {
        this.scene = scene;
        this.activeShields = [];
        this.clock = new THREE.Clock();
        
        // Carica texture per le particelle
        this.textureLoader = new THREE.TextureLoader();
        this.iceTexture = this.createIceTexture();
        this.sparkleTexture = this.createSparkleTexture();
        
        console.log('✅ IceShield inizializzato');
    }

    // Crea texture procedurale per il ghiaccio
    createIceTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Gradiente radiale per simulare cristallo di ghiaccio molto più scuro
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(60, 80, 120, 1)');       // Centro molto scuro
        gradient.addColorStop(0.3, 'rgba(40, 60, 100, 0.9)');   // Blu molto scuro
        gradient.addColorStop(0.6, 'rgba(30, 50, 90, 0.8)');    // Blu quasi nero
        gradient.addColorStop(0.8, 'rgba(20, 40, 80, 0.5)');    // Blu scurissimo
        gradient.addColorStop(1, 'rgba(10, 30, 70, 0)');        // Bordo quasi nero
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        // Aggiungi pattern cristallino molto più scuro
        ctx.strokeStyle = 'rgba(100, 120, 160, 0.3)'; // Linee molto più scure
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(32, 32);
            ctx.lineTo(32 + Math.cos(angle) * 30, 32 + Math.sin(angle) * 30);
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // Crea texture per scintille molto più scure
    createSparkleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(80, 100, 140, 1)');      // Centro molto più scuro
        gradient.addColorStop(0.5, 'rgba(50, 70, 110, 0.8)');   // Medio molto più scuro
        gradient.addColorStop(1, 'rgba(30, 50, 90, 0)');        // Bordo molto più scuro
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // Metodo principale per creare lo scudo di ghiaccio
    createIceShield(playerPosition, config) {
        const shieldId = 'IceShield_' + Date.now();
        
        const iceShield = {
            id: shieldId,
            startTime: Date.now(),
            duration: -1, // Durata infinita fino a quando non viene distrutto
            radius: config.radius || 3,
            height: config.height || 4,
            playerPosition: playerPosition.clone(),
            
            // Sistemi di particelle
            shieldParticles: null,
            sparkleParticles: null,
            
            // Mesh per collisioni e visualizzazione
            shieldMesh: null,
            
            // Stato dello scudo
            isActive: true,
            hasBlockedAttack: false,
            
            // Cleanup
            disposed: false
        };

        // Crea i sistemi di particelle
        this.createShieldParticleSystem(iceShield);
        this.createSparkleParticleSystem(iceShield);
        this.createShieldMesh(iceShield);
        
        // Aggiungi alla lista degli scudi attivi
        this.activeShields.push(iceShield);
        
        console.log(`❄️ Scudo di ghiaccio creato: ${shieldId}`);
        
        return shieldId;
    }

    // Crea il sistema di particelle per lo scudo
    createShieldParticleSystem(iceShield) {
        const particleCount = 300;
        
        const geometry = new THREE.BufferGeometry();
        
        // Array per posizioni, velocità, vita, dimensione
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const lifetimes = new Float32Array(particleCount);
        const maxLifetimes = new Float32Array(particleCount);
        const sizes = new Float32Array(particleCount);
        const colors = new Float32Array(particleCount * 3);
        const angles = new Float32Array(particleCount); // Angolo intorno al player
        const heights = new Float32Array(particleCount); // Altezza sul cilindro
        
        // Inizializza le particelle in formazione cilindrica
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Distribuzione cilindrica intorno al player
            angles[i] = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5;
            heights[i] = Math.random() * iceShield.height;
            const radius = iceShield.radius + (Math.random() - 0.5) * 0.5;
            
            positions[i3] = iceShield.playerPosition.x + Math.cos(angles[i]) * radius;
            positions[i3 + 1] = iceShield.playerPosition.y + heights[i];
            positions[i3 + 2] = iceShield.playerPosition.z + Math.sin(angles[i]) * radius;
            
            // Velocità rotazionale lenta
            velocities[i3] = 0;
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.5; // Movimento verticale lento
            velocities[i3 + 2] = 0;
            
            // Vita della particella
            maxLifetimes[i] = 2 + Math.random() * 3;
            lifetimes[i] = Math.random() * maxLifetimes[i];
            
            // Dimensione più grande per maggiore visibilità
            sizes[i] = 0.5 + Math.random() * 1.0;
            
            // Colore (sfumature di ghiaccio molto più scure e visibili)
            const iceIntensity = 0.8 + Math.random() * 0.2; // Intensità alta per visibilità
            colors[i3] = 0.1 * iceIntensity; // Rosso molto basso
            colors[i3 + 1] = 0.2 * iceIntensity; // Verde basso  
            colors[i3 + 2] = 0.5 * iceIntensity; // Blu dominante ma scuro
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        geometry.setAttribute('maxLifetime', new THREE.BufferAttribute(maxLifetimes, 1));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
        geometry.setAttribute('height', new THREE.BufferAttribute(heights, 1));
        
        // Shader material personalizzato per le particelle di ghiaccio
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                iceTexture: { value: this.iceTexture },
                playerPosition: { value: iceShield.playerPosition },
                shieldRadius: { value: iceShield.radius },
                shieldHeight: { value: iceShield.height }
            },
            vertexShader: `
                attribute float lifetime;
                attribute float maxLifetime;
                attribute float size;
                attribute vec3 velocity;
                attribute vec3 color;
                attribute float angle;
                attribute float height;
                
                uniform float time;
                uniform vec3 playerPosition;
                uniform float shieldRadius;
                uniform float shieldHeight;
                
                varying float vLifetime;
                varying vec3 vColor;
                varying float vOpacity;
                
                void main() {
                    vLifetime = lifetime;
                    vColor = color;
                    
                    // Calcola la posizione rotante intorno al player
                    float currentAngle = angle + time * 0.2; // Rotazione lenta
                    float currentRadius = shieldRadius + sin(time * 2.0 + angle * 10.0) * 0.2; // Pulsazione
                    
                    vec3 worldPos = vec3(
                        playerPosition.x + cos(currentAngle) * currentRadius,
                        playerPosition.y + height + sin(time * 3.0 + angle * 5.0) * 0.1,
                        playerPosition.z + sin(currentAngle) * currentRadius
                    );
                    
                    // Aggiungi movimento delle particelle
                    worldPos += velocity * lifetime;
                    
                    // Calcola opacità basata sulla vita
                    float lifeRatio = lifetime / maxLifetime;
                    vOpacity = 1.0 - lifeRatio;
                    vOpacity *= smoothstep(0.0, 0.2, lifeRatio); // Fade in iniziale
                    vOpacity *= 0.9; // Opacità alta per maggiore visibilità
                    
                    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Dimensione della particella più grande
                    gl_PointSize = size * (250.0 / -mvPosition.z) * vOpacity;
                }
            `,
            fragmentShader: `
                uniform sampler2D iceTexture;
                
                varying float vLifetime;
                varying vec3 vColor;
                varying float vOpacity;
                
                void main() {
                    vec2 uv = gl_PointCoord;
                    vec4 textureColor = texture2D(iceTexture, uv);
                    
                    // Mescola il colore della particella con la texture per maggiore visibilità
                    vec3 finalColor = mix(vColor, textureColor.rgb, 0.4);
                    
                    float alpha = textureColor.a * vOpacity * 1.2; // Alpha aumentato per visibilità
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending
        });
        
        const particles = new THREE.Points(geometry, material);
        particles.name = iceShield.id + '_shield';
        
        iceShield.shieldParticles = particles;
        this.scene.add(particles);
    }

    // Crea il sistema di particelle per le scintille
    createSparkleParticleSystem(iceShield) {
        const particleCount = 100;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const lifetimes = new Float32Array(particleCount);
        const maxLifetimes = new Float32Array(particleCount);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Posizione random intorno al scudo
            const angle = Math.random() * Math.PI * 2;
            const radius = iceShield.radius + Math.random() * 1;
            const height = Math.random() * iceShield.height;
            
            positions[i3] = iceShield.playerPosition.x + Math.cos(angle) * radius;
            positions[i3 + 1] = iceShield.playerPosition.y + height;
            positions[i3 + 2] = iceShield.playerPosition.z + Math.sin(angle) * radius;
            
            // Velocità verso l'esterno
            velocities[i3] = Math.cos(angle) * 0.5;
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.3;
            velocities[i3 + 2] = Math.sin(angle) * 0.5;
            
            // Vita più breve per le scintille
            maxLifetimes[i] = 0.5 + Math.random() * 1;
            lifetimes[i] = Math.random() * maxLifetimes[i];
            
            // Dimensioni piccole per le scintille
            sizes[i] = 0.2 + Math.random() * 0.3;
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
                playerPosition: { value: iceShield.playerPosition }
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
                    vOpacity = (1.0 - lifeRatio) * 0.8;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    gl_PointSize = size * (150.0 / -mvPosition.z) * vOpacity;
                }
            `,
            fragmentShader: `
                uniform sampler2D sparkleTexture;
                
                varying float vLifetime;
                varying float vOpacity;
                
                void main() {
                    vec2 uv = gl_PointCoord;
                    vec4 textureColor = texture2D(sparkleTexture, uv);
                    
                    vec3 sparkleColor = vec3(0.4, 0.5, 0.7); // Colore scintille molto più scuro
                    float alpha = textureColor.a * vOpacity;
                    
                    gl_FragColor = vec4(sparkleColor, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        const sparkleParticles = new THREE.Points(geometry, material);
        sparkleParticles.name = iceShield.id + '_sparkles';
        sparkleParticles.frustumCulled = false; // IMPORTANTE: Disabilita frustum culling
        
        iceShield.sparkleParticles = sparkleParticles;
        this.scene.add(sparkleParticles);
    }

    // Crea mesh invisibile per le collisioni
    createShieldMesh(iceShield) {
        const geometry = new THREE.CylinderGeometry(
            iceShield.radius, 
            iceShield.radius, 
            iceShield.height, 
            16
        );
        const material = new THREE.MeshBasicMaterial({ 
            visible: false // Invisibile ma presente per collisioni
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(iceShield.playerPosition);
        mesh.position.y += iceShield.height / 2;
        mesh.name = iceShield.id + '_collision';
        
        iceShield.shieldMesh = mesh;
        this.scene.add(mesh);
    }

    // Update principale del sistema
    update(deltaTime, playerPosition) {
        const currentTime = Date.now();
        
        for (let i = this.activeShields.length - 1; i >= 0; i--) {
            const shield = this.activeShields[i];
            
            if (shield.disposed) {
                this.activeShields.splice(i, 1);
                continue;
            }
            
            const elapsed = currentTime - shield.startTime;
            const timeInSeconds = elapsed / 1000;
            
            // Aggiorna posizione dello scudo seguendo il player
            if (playerPosition) {
                shield.playerPosition.copy(playerPosition);
                
                if (shield.shieldMesh) {
                    shield.shieldMesh.position.copy(playerPosition);
                    shield.shieldMesh.position.y += shield.height / 2;
                }
            }
            
            // Aggiorna shader uniforms
            if (shield.shieldParticles) {
                shield.shieldParticles.material.uniforms.time.value = timeInSeconds;
                shield.shieldParticles.material.uniforms.playerPosition.value.copy(shield.playerPosition);
                this.updateShieldParticles(shield, deltaTime);
            }
            
            if (shield.sparkleParticles) {
                shield.sparkleParticles.material.uniforms.time.value = timeInSeconds;
                shield.sparkleParticles.material.uniforms.playerPosition.value.copy(shield.playerPosition);
                this.updateSparkleParticles(shield, deltaTime);
            }
            
            // Lo scudo rimane attivo finché non viene distrutto manualmente
            // Non c'è più controllo della durata automatica
            if (!shield.isActive) {
                this.disposeIceShield(shield);
                this.activeShields.splice(i, 1);
            }
        }
    }

    // Aggiorna particelle dello scudo
    updateShieldParticles(iceShield, deltaTime) {
        const geometry = iceShield.shieldParticles.geometry;
        const lifetimes = geometry.attributes.lifetime.array;
        const maxLifetimes = geometry.attributes.maxLifetime.array;
        const heights = geometry.attributes.height.array;
        const angles = geometry.attributes.angle.array;
        const positions = geometry.attributes.position.array;
        
        for (let i = 0; i < lifetimes.length; i++) {
            lifetimes[i] += deltaTime;
            
            // Rigenera particella se è morta
            if (lifetimes[i] > maxLifetimes[i]) {
                lifetimes[i] = 0;
                
                // Nuova posizione cilindrica
                angles[i] = Math.random() * Math.PI * 2;
                heights[i] = Math.random() * iceShield.height;
                
                // IMPORTANTE: Aggiorna anche la posizione nel buffer per evitare culling
                const i3 = i * 3;
                const radius = iceShield.radius + (Math.random() - 0.5) * 0.5;
                positions[i3] = iceShield.playerPosition.x + Math.cos(angles[i]) * radius;
                positions[i3 + 1] = iceShield.playerPosition.y + heights[i];
                positions[i3 + 2] = iceShield.playerPosition.z + Math.sin(angles[i]) * radius;
            }
        }
        
        geometry.attributes.lifetime.needsUpdate = true;
        geometry.attributes.angle.needsUpdate = true;
        geometry.attributes.height.needsUpdate = true;
        geometry.attributes.position.needsUpdate = true; // Aggiungi questo
        
        // FONDAMENTALE: Disabilita il frustum culling per questo oggetto
        iceShield.shieldParticles.frustumCulled = false;
    }

    // Aggiorna particelle delle scintille
    updateSparkleParticles(iceShield, deltaTime) {
        const geometry = iceShield.sparkleParticles.geometry;
        const lifetimes = geometry.attributes.lifetime.array;
        const maxLifetimes = geometry.attributes.maxLifetime.array;
        const positions = geometry.attributes.position.array;
        
        for (let i = 0; i < lifetimes.length; i++) {
            lifetimes[i] += deltaTime;
            
            if (lifetimes[i] > maxLifetimes[i]) {
                lifetimes[i] = 0;
                
                // Nuova posizione per la scintilla
                const i3 = i * 3;
                const angle = Math.random() * Math.PI * 2;
                const radius = iceShield.radius + Math.random() * 1;
                const height = Math.random() * iceShield.height;
                
                positions[i3] = iceShield.playerPosition.x + Math.cos(angle) * radius;
                positions[i3 + 1] = iceShield.playerPosition.y + height;
                positions[i3 + 2] = iceShield.playerPosition.z + Math.sin(angle) * radius;
            }
        }
        
        geometry.attributes.lifetime.needsUpdate = true;
        geometry.attributes.position.needsUpdate = true;
        
        // FONDAMENTALE: Disabilita il frustum culling anche per le scintille
        iceShield.sparkleParticles.frustumCulled = false;
    }

    // Controlla se il player è protetto da uno scudo attivo
    isPlayerProtected(playerPosition) {
        for (const shield of this.activeShields) {
            if (shield.isActive && !shield.disposed) {
                const distance = playerPosition.distanceTo(shield.playerPosition);
                if (distance <= shield.radius) {
                    return shield;
                }
            }
        }
        return null;
    }

    // Fa "bloccare" un attacco dal scudo
    blockAttack(shieldId) {
        const shield = this.activeShields.find(s => s.id === shieldId);
        if (shield && shield.isActive) {
            shield.hasBlockedAttack = true;
            this.createBlockEffect(shield);
            
            // Lo scudo si consuma dopo aver bloccato un attacco
            shield.isActive = false;
            
            console.log(`❄️ Scudo ${shieldId} ha bloccato un attacco!`);
            return true;
        }
        return false;
    }

    // Crea effetto visivo quando il scudo blocca un attacco
    createBlockEffect(shield) {
        const particleCount = 50;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Posizione intorno al scudo
            const angle = Math.random() * Math.PI * 2;
            const radius = shield.radius + Math.random() * 0.5;
            const height = Math.random() * shield.height;
            
            positions[i3] = shield.playerPosition.x + Math.cos(angle) * radius;
            positions[i3 + 1] = shield.playerPosition.y + height;
            positions[i3 + 2] = shield.playerPosition.z + Math.sin(angle) * radius;
            
            // Velocità radiale esplosiva
            const speed = 3 + Math.random() * 5;
            velocities[i3] = Math.cos(angle) * speed;
            velocities[i3 + 1] = (Math.random() - 0.5) * 3;
            velocities[i3 + 2] = Math.sin(angle) * speed;
            
            // Colori blu-bianchi brillanti
            colors[i3] = 0.7 + Math.random() * 0.3;
            colors[i3 + 1] = 0.8 + Math.random() * 0.2;
            colors[i3 + 2] = 1.0;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.7,
            transparent: true,
            opacity: 1,
            vertexColors: true,
            blending: THREE.AdditiveBlending
        });
        
        const blockParticles = new THREE.Points(geometry, material);
        this.scene.add(blockParticles);
        
        // Anima l'effetto
        const startTime = Date.now();
        const animateBlock = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 1500; // 1.5 secondi di durata
            
            if (progress < 1) {
                // Aggiorna posizioni
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    positions[i3] += velocities[i3] * 0.016;
                    positions[i3 + 1] += velocities[i3 + 1] * 0.016;
                    positions[i3 + 2] += velocities[i3 + 2] * 0.016;
                    
                    // Rallenta le particelle
                    velocities[i3] *= 0.97;
                    velocities[i3 + 1] *= 0.97;
                    velocities[i3 + 2] *= 0.97;
                }
                
                geometry.attributes.position.needsUpdate = true;
                material.opacity = Math.max(0, 1 - progress);
                
                requestAnimationFrame(animateBlock);
            } else {
                this.scene.remove(blockParticles);
                geometry.dispose();
                material.dispose();
            }
        };
        
        animateBlock();
    }

    // Pulisce uno scudo specifico
    disposeIceShield(iceShield) {
        if (iceShield.disposed) return;
        
        iceShield.disposed = true;
        
        // Rimuovi particelle dello scudo
        if (iceShield.shieldParticles) {
            this.scene.remove(iceShield.shieldParticles);
            iceShield.shieldParticles.geometry.dispose();
            iceShield.shieldParticles.material.dispose();
            iceShield.shieldParticles = null;
        }
        
        // Rimuovi particelle delle scintille
        if (iceShield.sparkleParticles) {
            this.scene.remove(iceShield.sparkleParticles);
            iceShield.sparkleParticles.geometry.dispose();
            iceShield.sparkleParticles.material.dispose();
            iceShield.sparkleParticles = null;
        }
        
        // Rimuovi mesh di collisione
        if (iceShield.shieldMesh) {
            this.scene.remove(iceShield.shieldMesh);
            iceShield.shieldMesh.geometry.dispose();
            iceShield.shieldMesh.material.dispose();
            iceShield.shieldMesh = null;
        }
        
        console.log(`🧹 Scudo di ghiaccio ${iceShield.id} rimosso`);
    }

    // Pulisce tutti gli scudi
    dispose() {
        for (const shield of this.activeShields) {
            this.disposeIceShield(shield);
        }
        this.activeShields = [];
        
        // Pulisci texture
        if (this.iceTexture) {
            this.iceTexture.dispose();
        }
        if (this.sparkleTexture) {
            this.sparkleTexture.dispose();
        }
        
        console.log('🧹 IceShield completamente pulito');
    }

    // Getter per debug
    getActiveShieldsCount() {
        return this.activeShields.length;
    }

    getActiveShields() {
        return this.activeShields.map(shield => ({
            id: shield.id,
            age: Date.now() - shield.startTime,
            position: shield.playerPosition,
            isActive: shield.isActive,
            hasBlocked: shield.hasBlockedAttack
        }));
    }
}

// Export per compatibilità
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IceShield;
}