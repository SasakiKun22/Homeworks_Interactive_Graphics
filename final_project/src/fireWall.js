class FireWall {
    constructor(scene) {
        this.scene = scene;
        this.activeSpells = [];
        this.clock = new THREE.Clock();
        
        // Carica texture per le particelle
        this.textureLoader = new THREE.TextureLoader();
        this.fireTexture = this.createFireTexture();
        this.smokeTexture = this.createSmokeTexture();
        
    }

    // Crea texture procedurali per il fuoco
    createFireTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Gradiente radiale per simulare fiamma
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 200, 0, 1)');
        gradient.addColorStop(0.6, 'rgba(255, 100, 0, 0.8)');
        gradient.addColorStop(0.8, 'rgba(255, 50, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // Crea texture per il fumo
    createSmokeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(80, 80, 80, 0.95)');   // Centro più denso e scuro
        gradient.addColorStop(0.4, 'rgba(60, 60, 60, 0.8)');  // Medio più denso
        gradient.addColorStop(0.7, 'rgba(40, 40, 40, 0.6)');  // Più denso
        gradient.addColorStop(1, 'rgba(20, 20, 20, 0)');      // Bordo più scuro
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // Metodo principale per creare il muro di fuoco
    createFireWall(startPosition, direction, config) {
        const fireWallId = 'FireWall_' + Date.now();
        
        const fireWall = {
            id: fireWallId,
            startTime: Date.now(),
            duration: config.duration || 3000, 
            speed: config.speed || 15,
            range: config.range || 15,
            damage: config.damage || 100,
            width: config.width || 8, 
            height: config.height || 4, 
            
            position: startPosition.clone(),
            direction: direction.clone().normalize(),
            
            // Sistemi di particelle
            fireParticles: null,
            smokeParticles: null,
            
            // Mesh per collisioni
            collisionMesh: null,
            
            // Tracking per danni
            enemiesHit: new Set(),
            
            // Cleanup
            disposed: false
        };

        // Crea i sistemi di particelle
        this.createFireParticleSystem(fireWall);
        this.createSmokeParticleSystem(fireWall);
        this.createCollisionMesh(fireWall);
        
        // Aggiungi alla lista degli spell attivi
        this.activeSpells.push(fireWall);
        
        console.log(`🔥 Muro di fuoco creato: ${fireWallId}`);
        
        return fireWallId;
    }

    // Crea il sistema di particelle per il fuoco
    createFireParticleSystem(fireWall) {
        const particleCount = 1000; 
        
        // Geometria per le particelle
        const geometry = new THREE.BufferGeometry();
        
        // Array per posizioni, velocità, vita, dimensione
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const lifetimes = new Float32Array(particleCount);
        const maxLifetimes = new Float32Array(particleCount);
        const sizes = new Float32Array(particleCount);
        const colors = new Float32Array(particleCount * 3);
        
        // Inizializza le particelle
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Posizione iniziale (distribuita lungo la larghezza del muro)
            const widthOffset = (Math.random() - 0.5) * fireWall.width;
            const heightOffset = Math.random() * fireWall.height;
            const depthOffset = (Math.random() - 0.5) * 2;
            
            positions[i3] = fireWall.position.x + 
                          fireWall.direction.z * widthOffset + 
                          fireWall.direction.x * depthOffset;
            positions[i3 + 1] = fireWall.position.y + heightOffset;
            positions[i3 + 2] = fireWall.position.z - 
                              fireWall.direction.x * widthOffset + 
                              fireWall.direction.z * depthOffset;
            
            // Velocità (principalmente verso l'alto con un po' di randomness)
            velocities[i3] = (Math.random() - 0.5) * 2;
            velocities[i3 + 1] = 2 + Math.random() * 3;
            velocities[i3 + 2] = (Math.random() - 0.5) * 2;
            
            // Vita della particella
            maxLifetimes[i] = 0.5 + Math.random() * 1.5;
            lifetimes[i] = Math.random() * maxLifetimes[i];
            
            // Dimensione
            sizes[i] = 0.5 + Math.random() * 1;
            
            // Colore
            const fireIntensity = Math.random();
            const heightRatio = heightOffset / fireWall.height;
            
            // Gradiente dal rosso (basso) al giallo (alto)
            if (heightRatio < 0.3) {
                // Basso: Rosso puro
                colors[i3] = 1;
                colors[i3 + 1] = 0.1 + fireIntensity * 0.2; 
                colors[i3 + 2] = 0; 
            } else if (heightRatio < 0.7) {
                // Medio: Arancione
                colors[i3] = 1; 
                colors[i3 + 1] = 0.4 + fireIntensity * 0.3; 
                colors[i3 + 2] = 0;
            } else {
                // Alto: Giallo
                colors[i3] = 1;
                colors[i3 + 1] = 0.8 + fireIntensity * 0.2; 
                colors[i3 + 2] = 0; 
            }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        geometry.setAttribute('maxLifetime', new THREE.BufferAttribute(maxLifetimes, 1));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Shader material personalizzato per le particelle
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                fireTexture: { value: this.fireTexture },
                wallPosition: { value: fireWall.position },
                wallDirection: { value: fireWall.direction },
                wallSpeed: { value: fireWall.speed }
            },
            vertexShader: `
                attribute float lifetime;
                attribute float maxLifetime;
                attribute float size;
                attribute vec3 velocity;
                attribute vec3 color;
                
                uniform float time;
                uniform vec3 wallPosition;
                uniform vec3 wallDirection;
                uniform float wallSpeed;
                
                varying float vLifetime;
                varying vec3 vColor;
                varying float vOpacity;
                
                void main() {
                    vLifetime = lifetime;
                    
                    // Calcola la posizione con movimento del muro
                    vec3 worldPos = position;
                    worldPos += wallDirection * wallSpeed * time;
                    
                    // Aggiungi movimento delle particelle
                    worldPos += velocity * lifetime;
                    
                    // Usa il colore pre-calcolato invece di ricalcolarlo
                    vColor = color;
                    
                    // Calcola opacità basata sulla vita
                    float lifeRatio = lifetime / maxLifetime;
                    vOpacity = 1.0 - lifeRatio;
                    vOpacity *= smoothstep(0.0, 0.1, lifeRatio); // Fade in iniziale
                    
                    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Dimensione della particella
                    gl_PointSize = size * (300.0 / -mvPosition.z) * vOpacity;
                }
            `,
            fragmentShader: `
                uniform sampler2D fireTexture;
                
                varying float vLifetime;
                varying vec3 vColor;
                varying float vOpacity;
                
                void main() {
                    vec2 uv = gl_PointCoord;
                    vec4 textureColor = texture2D(fireTexture, uv);
                    
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
        
        // Crea il sistema di particelle
        const particles = new THREE.Points(geometry, material);
        particles.name = fireWall.id + '_fire';
        
        fireWall.fireParticles = particles;
        this.scene.add(particles);
    }

    // Crea il sistema di particelle per il fumo
    createSmokeParticleSystem(fireWall) {
        const particleCount = 450; 
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const lifetimes = new Float32Array(particleCount);
        const maxLifetimes = new Float32Array(particleCount);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Posizione iniziale più alta del fuoco
            const widthOffset = (Math.random() - 0.5) * fireWall.width;
            const heightOffset = fireWall.height * 0.7 + Math.random() * fireWall.height * 0.5;
            
            positions[i3] = fireWall.position.x + fireWall.direction.z * widthOffset;
            positions[i3 + 1] = fireWall.position.y + heightOffset;
            positions[i3 + 2] = fireWall.position.z - fireWall.direction.x * widthOffset;
            
            // Velocità del fumo (più lenta e verso l'alto)
            velocities[i3] = (Math.random() - 0.5) * 1;
            velocities[i3 + 1] = 1 + Math.random() * 2;
            velocities[i3 + 2] = (Math.random() - 0.5) * 1;
            
            // Vita più lunga per il fumo
            maxLifetimes[i] = 1 + Math.random() * 2;
            lifetimes[i] = Math.random() * maxLifetimes[i];
            
            // Dimensioni leggermente più grandi per il fumo più denso
            sizes[i] = 1.2 + Math.random() * 2.3;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        geometry.setAttribute('maxLifetime', new THREE.BufferAttribute(maxLifetimes, 1));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                smokeTexture: { value: this.smokeTexture },
                wallPosition: { value: fireWall.position },
                wallDirection: { value: fireWall.direction },
                wallSpeed: { value: fireWall.speed }
            },
            vertexShader: `
                attribute float lifetime;
                attribute float maxLifetime;
                attribute float size;
                attribute vec3 velocity;
                
                uniform float time;
                uniform vec3 wallPosition;
                uniform vec3 wallDirection;
                uniform float wallSpeed;
                
                varying float vLifetime;
                varying float vOpacity;
                
                void main() {
                    vLifetime = lifetime;
                    
                    vec3 worldPos = position;
                    worldPos += wallDirection * wallSpeed * time;
                    worldPos += velocity * lifetime;
                    
                    float lifeRatio = lifetime / maxLifetime;
                    vOpacity = (1.0 - lifeRatio) * 0.6; // Opacità aumentata da 0.3 a 0.6 per fumo più denso
                    
                    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    gl_PointSize = size * (400.0 / -mvPosition.z) * (0.5 + lifeRatio * 0.5);
                }
            `,
            fragmentShader: `
                uniform sampler2D smokeTexture;
                
                varying float vLifetime;
                varying float vOpacity;
                
                void main() {
                    vec2 uv = gl_PointCoord;
                    vec4 textureColor = texture2D(smokeTexture, uv);
                    
                    vec3 smokeColor = vec3(0.2, 0.2, 0.2); // Fumo più scuro (era 0.3, 0.3, 0.3)
                    float alpha = textureColor.a * vOpacity;
                    
                    gl_FragColor = vec4(smokeColor, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending
        });
        
        const smokeParticles = new THREE.Points(geometry, material);
        smokeParticles.name = fireWall.id + '_smoke';
        
        fireWall.smokeParticles = smokeParticles;
        this.scene.add(smokeParticles);
    }

    // Crea mesh invisibile per le collisioni
    createCollisionMesh(fireWall) {
        const geometry = new THREE.BoxGeometry(2, fireWall.height, fireWall.width);
        const material = new THREE.MeshBasicMaterial({ 
            visible: false // Invisibile ma presente per collisioni
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(fireWall.position);
        mesh.position.y += fireWall.height / 2;
        mesh.name = fireWall.id + '_collision';
        
        fireWall.collisionMesh = mesh;
        this.scene.add(mesh);
    }

    // Update principale del sistema
    update(deltaTime) {
        const currentTime = Date.now();
        
        for (let i = this.activeSpells.length - 1; i >= 0; i--) {
            const spell = this.activeSpells[i];
            
            if (spell.disposed) {
                this.activeSpells.splice(i, 1);
                continue;
            }
            
            const elapsed = currentTime - spell.startTime;
            const timeInSeconds = elapsed / 1000;
            
            // Aggiorna posizione del muro
            const moveDistance = spell.speed * deltaTime;
            const movement = spell.direction.clone().multiplyScalar(moveDistance);
            
            // Controlla se ha superato la distanza massima
            const totalDistance = spell.speed * timeInSeconds;
            if (totalDistance > spell.range) {
                this.disposeFireWall(spell);
                this.activeSpells.splice(i, 1);
                continue;
            }
            
            // Aggiorna mesh di collisione
            if (spell.collisionMesh) {
                spell.collisionMesh.position.add(movement);
                
                // Controlla collisioni con nemici
                this.checkFireWallCollisions(spell);
            }
            
            // Aggiorna shader uniforms
            if (spell.fireParticles) {
                spell.fireParticles.material.uniforms.time.value = timeInSeconds;
                this.updateFireParticles(spell, deltaTime);
            }
            
            if (spell.smokeParticles) {
                spell.smokeParticles.material.uniforms.time.value = timeInSeconds;
                this.updateSmokeParticles(spell, deltaTime);
            }
            
            // Controlla durata
            if (elapsed > spell.duration) {
                this.disposeFireWall(spell);
                this.activeSpells.splice(i, 1);
            }
        }
    }

    // Aggiorna particelle del fuoco
    updateFireParticles(fireWall, deltaTime) {
        const geometry = fireWall.fireParticles.geometry;
        const lifetimes = geometry.attributes.lifetime.array;
        const maxLifetimes = geometry.attributes.maxLifetime.array;
        const positions = geometry.attributes.position.array;
        const velocities = geometry.attributes.velocity.array;
        const colors = geometry.attributes.color.array;
        
        for (let i = 0; i < lifetimes.length; i++) {
            lifetimes[i] += deltaTime;
            
            // Rigenera particella se è morta
            if (lifetimes[i] > maxLifetimes[i]) {
                lifetimes[i] = 0;
                
                // Resetta posizione
                const i3 = i * 3;
                const widthOffset = (Math.random() - 0.5) * fireWall.width;
                const heightOffset = Math.random() * fireWall.height;
                
                // Posizione corrente del muro
                const currentPos = fireWall.collisionMesh.position;
                positions[i3] = currentPos.x + fireWall.direction.z * widthOffset;
                positions[i3 + 1] = currentPos.y - fireWall.height/2 + heightOffset;
                positions[i3 + 2] = currentPos.z - fireWall.direction.x * widthOffset;
                
                // Ricalcola colore basato sulla nuova altezza con logica semplificata
                const heightRatio = heightOffset / fireWall.height;
                const fireIntensity = Math.random();
                
                if (heightRatio < 0.3) {
                    // Basso: Rosso puro
                    colors[i3] = 1;
                    colors[i3 + 1] = 0.1 + fireIntensity * 0.2;
                    colors[i3 + 2] = 0;
                } else if (heightRatio < 0.7) {
                    // Medio: Arancione
                    colors[i3] = 1;
                    colors[i3 + 1] = 0.4 + fireIntensity * 0.3;
                    colors[i3 + 2] = 0;
                } else {
                    // Alto: Giallo
                    colors[i3] = 1;
                    colors[i3 + 1] = 0.8 + fireIntensity * 0.2;
                    colors[i3 + 2] = 0;
                }
            }
        }
        
        geometry.attributes.lifetime.needsUpdate = true;
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
    }

    // Aggiorna particelle del fumo
    updateSmokeParticles(fireWall, deltaTime) {
        const geometry = fireWall.smokeParticles.geometry;
        const lifetimes = geometry.attributes.lifetime.array;
        const maxLifetimes = geometry.attributes.maxLifetime.array;
        const positions = geometry.attributes.position.array;
        
        for (let i = 0; i < lifetimes.length; i++) {
            lifetimes[i] += deltaTime;
            
            if (lifetimes[i] > maxLifetimes[i]) {
                lifetimes[i] = 0;
                
                const i3 = i * 3;
                const widthOffset = (Math.random() - 0.5) * fireWall.width;
                const heightOffset = fireWall.height * 0.7 + Math.random() * fireWall.height * 0.5;
                
                const currentPos = fireWall.collisionMesh.position;
                positions[i3] = currentPos.x + fireWall.direction.z * widthOffset;
                positions[i3 + 1] = currentPos.y - fireWall.height/2 + heightOffset;
                positions[i3 + 2] = currentPos.z - fireWall.direction.x * widthOffset;
            }
        }
        
        geometry.attributes.lifetime.needsUpdate = true;
        geometry.attributes.position.needsUpdate = true;
    }

    // Controlla collisioni del muro di fuoco con i nemici
    checkFireWallCollisions(fireWall) {
        if (!window.enemies || !fireWall.collisionMesh) return;
        
        const wallPosition = fireWall.collisionMesh.position;
        const wallBox = new THREE.Box3().setFromObject(fireWall.collisionMesh);
        
        window.enemies.forEach(enemy => {
            if (!enemy || !enemy.isAlive()) return;
            
            const enemyId = enemy.id || enemy.getId?.() || enemy;
            if (fireWall.enemiesHit.has(enemyId)) return; // Già colpito
            
            const enemyPosition = enemy.getPosition();
            const enemyBox = new THREE.Box3().setFromCenterAndSize(
                enemyPosition,
                new THREE.Vector3(2, 3, 2) // Dimensioni approssimate nemico
            );
            
            if (wallBox.intersectsBox(enemyBox)) {
                // Applica danno
                if (typeof enemy.takeDamage === 'function') {
                    enemy.takeDamage(fireWall.damage, wallPosition);
                    console.log(`🔥 Muro di fuoco colpisce nemico per ${fireWall.damage} danni!`);
                }
                
                // Segna come colpito per evitare danni multipli
                fireWall.enemiesHit.add(enemyId);
                
                // Effetto visivo dell'impatto
                this.createImpactEffect(enemyPosition);
            }
        });
    }

    // Crea effetto visivo quando il muro colpisce un nemico
    createImpactEffect(position) {
        const particleCount = 20;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Posizione intorno al punto di impatto
            positions[i3] = position.x + (Math.random() - 0.5) * 2;
            positions[i3 + 1] = position.y + Math.random() * 2;
            positions[i3 + 2] = position.z + (Math.random() - 0.5) * 2;
            
            // Velocità radiale
            const angle = Math.random() * Math.PI * 2;
            const speed = 5 + Math.random() * 10;
            velocities[i3] = Math.cos(angle) * speed;
            velocities[i3 + 1] = Math.random() * 5;
            velocities[i3 + 2] = Math.sin(angle) * speed;
            
            // Colori del fuoco
            colors[i3] = 1;
            colors[i3 + 1] = 0.5 + Math.random() * 0.5;
            colors[i3 + 2] = Math.random() * 0.3;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.5,
            transparent: true,
            opacity: 1,
            vertexColors: true,
            blending: THREE.AdditiveBlending
        });
        
        const impactParticles = new THREE.Points(geometry, material);
        this.scene.add(impactParticles);
        
        // Anima l'effetto
        const startTime = Date.now();
        const animateImpact = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 1000; // 1 secondo di durata
            
            if (progress < 1) {
                // Aggiorna posizioni
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    positions[i3] += velocities[i3] * 0.016; // ~60fps
                    positions[i3 + 1] += velocities[i3 + 1] * 0.016;
                    positions[i3 + 2] += velocities[i3 + 2] * 0.016;
                    
                    // Rallenta le particelle
                    velocities[i3] *= 0.95;
                    velocities[i3 + 1] *= 0.95;
                    velocities[i3 + 2] *= 0.95;
                }
                
                geometry.attributes.position.needsUpdate = true;
                material.opacity = 1 - progress;
                
                requestAnimationFrame(animateImpact);
            } else {
                this.scene.remove(impactParticles);
                geometry.dispose();
                material.dispose();
            }
        };
        
        animateImpact();
    }

    // Pulisce un muro di fuoco specifico
    disposeFireWall(fireWall) {
        if (fireWall.disposed) return;
        
        fireWall.disposed = true;
        
        // Rimuovi particelle del fuoco
        if (fireWall.fireParticles) {
            this.scene.remove(fireWall.fireParticles);
            fireWall.fireParticles.geometry.dispose();
            fireWall.fireParticles.material.dispose();
            fireWall.fireParticles = null;
        }
        
        // Rimuovi particelle del fumo
        if (fireWall.smokeParticles) {
            this.scene.remove(fireWall.smokeParticles);
            fireWall.smokeParticles.geometry.dispose();
            fireWall.smokeParticles.material.dispose();
            fireWall.smokeParticles = null;
        }
        
        // Rimuovi mesh di collisione
        if (fireWall.collisionMesh) {
            this.scene.remove(fireWall.collisionMesh);
            fireWall.collisionMesh.geometry.dispose();
            fireWall.collisionMesh.material.dispose();
            fireWall.collisionMesh = null;
        }
        
    }

    // Pulisce tutti gli effetti
    dispose() {
        for (const spell of this.activeSpells) {
            this.disposeFireWall(spell);
        }
        this.activeSpells = [];
        
        // Pulisci texture
        if (this.fireTexture) {
            this.fireTexture.dispose();
        }
        if (this.smokeTexture) {
            this.smokeTexture.dispose();
        }
        
    }

    // Getter per debug
    getActiveSpellsCount() {
        return this.activeSpells.length;
    }

    getActiveSpells() {
        return this.activeSpells.map(spell => ({
            id: spell.id,
            age: Date.now() - spell.startTime,
            position: spell.collisionMesh?.position || spell.position
        }));
    }
}

// Export per compatibilità
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FireWall;
}