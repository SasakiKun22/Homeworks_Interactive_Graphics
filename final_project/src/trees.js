// TreeLoader.js - Sistema di caricamento modelli senza async/await

class TreeLoader {
    constructor() {
        this.gltfLoader = null;
        this.loadedModels = new Map(); // Cache dei modelli caricati
        this.loadingCallbacks = new Map(); // Callback in attesa per ogni modello
        
        // Configurazione tipi di alberi
        this.treeTypes = {
            tree: {
                modelPath: '../models/trees/tree.glb',
                scale: { min: 0.8, max: 1.2 },
                baseScale: 2.5,
                collisionRadius: 1.2, 
                color: 0x4a5d23,
                placeholderHeight: 8
            },
            pine: {
                modelPath: '../models/trees/pine_tree.glb',
                scale: { min: 0.7, max: 1.4 },
                baseScale: 3.0,
                collisionRadius: 0.8, 
                color: 0x2d4a22,
                placeholderHeight: 10
            },
            old_tree: {
                modelPath: '../models/trees/old_tree.glb',
                scale: { min: 0.9, max: 1.1 },
                baseScale: 2.2,
                collisionRadius: 2.0, 
                color: 0x6b8e23,
                placeholderHeight: 7
            }
        };
        
        this.initLoader();
    }
    
    initLoader() {
        if (typeof THREE.GLTFLoader !== 'undefined') {
            this.gltfLoader = new THREE.GLTFLoader();
            console.log('TreeLoader: GLTFLoader inizializzato');
        } else {
            console.warn('TreeLoader: GLTFLoader non disponibile, userò placeholder');
        }
    }
    
    // Carica un modello con callback
    loadModel(treeType, onComplete, onError = null) {
        // Se è già caricato, chiama subito il callback
        if (this.loadedModels.has(treeType)) {
            const model = this.loadedModels.get(treeType);
            setTimeout(() => onComplete(model), 0);
            return;
        }
        
        // Se è già in caricamento, aggiungi il callback alla lista
        if (this.loadingCallbacks.has(treeType)) {
            this.loadingCallbacks.get(treeType).push({ onComplete, onError });
            return;
        }
        
        // Inizia il caricamento
        this.loadingCallbacks.set(treeType, [{ onComplete, onError }]);
        this._loadModelInternal(treeType);
    }
    
    _loadModelInternal(treeType) {
        const config = this.treeTypes[treeType];
        const callbacks = this.loadingCallbacks.get(treeType) || [];
        
        if (!config) {
            const error = new Error(`Tipo di albero sconosciuto: ${treeType}`);
            callbacks.forEach(cb => {
                if (cb.onError) cb.onError(error);
            });
            this.loadingCallbacks.delete(treeType);
            return;
        }
        
        if (!this.gltfLoader) {
            console.log(`TreeLoader: Creo placeholder per ${treeType}`);
            const placeholder = this.createPlaceholder(treeType);
            
            // Salva in cache e notifica tutti i callback
            this.loadedModels.set(treeType, placeholder);
            callbacks.forEach(cb => cb.onComplete(placeholder));
            this.loadingCallbacks.delete(treeType);
            return;
        }
        
        this.gltfLoader.load(
            config.modelPath,
            (gltf) => {
                console.log(`TreeLoader: Modello ${treeType} caricato con successo`);
                
                // Prepara il modello
                const model = gltf.scene.clone();
                this.prepareModel(model, treeType);
                
                // Salva in cache
                this.loadedModels.set(treeType, model);
                
                // Notifica tutti i callback in attesa
                callbacks.forEach(cb => cb.onComplete(model));
                this.loadingCallbacks.delete(treeType);
            },
            (progress) => {
                if (progress.lengthComputable) {
                    const percentComplete = progress.loaded / progress.total * 100;
                    // console.log(`TreeLoader: Caricamento ${treeType}: ${Math.round(percentComplete)}%`);
                }
            },
            (error) => {
                console.error(`TreeLoader: Errore caricamento ${treeType}:`, error);
                console.log(`TreeLoader: Creo placeholder per ${treeType}`);
                
                // Fallback a placeholder
                const placeholder = this.createPlaceholder(treeType);
                
                // Salva in cache
                this.loadedModels.set(treeType, placeholder);
                
                // Notifica callback (con successo perché abbiamo un placeholder)
                callbacks.forEach(cb => cb.onComplete(placeholder));
                this.loadingCallbacks.delete(treeType);
            }
        );
    }
    
    // Prepara il modello appena caricato
    prepareModel(model, treeType) {
        // Configura ombre e materiali
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Applica effetti notturni ai materiali
                if (child.material) {
                    // Clona il materiale per non modificare l'originale
                    child.material = child.material.clone();
                    
                    // Scurisce per la notte
                    if (child.material.color) {
                        child.material.color.multiplyScalar(0.5);
                    }
                    
                    // Aggiungi emissione lunare
                    if (!child.material.emissive) {
                        child.material.emissive = new THREE.Color(0x002244);
                    }
                    if (child.material.emissiveIntensity !== undefined) {
                        child.material.emissiveIntensity = 0.1;
                    }
                }
            }
        });
        
        // Salva il tipo per riferimento
        model.userData.treeType = treeType;
    }
    
    // Crea una istanza del modello per lo spawn
    createInstance(treeType, position, onComplete, customScale = null, customRotation = null) {
        this.loadModel(
            treeType, 
            (baseModel) => {
                // Clona il modello per creare una nuova istanza
                const instance = baseModel.clone();
                
                const config = this.treeTypes[treeType];
                
                // Applica trasformazioni
                const scale = customScale || THREE.MathUtils.randFloat(
                    config.scale.min, 
                    config.scale.max
                ) * config.baseScale;
                
                const rotation = customRotation !== null ? customRotation : Math.random() * Math.PI * 2;
                
                instance.scale.setScalar(scale);
                instance.position.copy(position);
                instance.rotation.y = rotation;
                
                // Salva informazioni nell'userData
                instance.userData.treeType = treeType;
                instance.userData.isTree = true;
                instance.userData.scale = scale;
                instance.userData.baseRotation = rotation;
                instance.userData.collisionRadius = config.collisionRadius * (scale / config.baseScale);
                
                // Chiama il callback con l'istanza pronta
                onComplete(instance);
            },
            (error) => {
                console.error(`TreeLoader: Errore creazione istanza ${treeType}:`, error);
                
                // Fallback a placeholder
                const placeholderInstance = this.createPlaceholderInstance(
                    treeType, position, customScale, customRotation
                );
                onComplete(placeholderInstance);
            }
        );
    }
    
    // Crea placeholder quando il modello non si carica
    createPlaceholder(treeType) {
        const config = this.treeTypes[treeType];
        const tree = new THREE.Group();
        
        // Tronco
        const trunkGeometry = new THREE.CylinderGeometry(
            0.3, 0.5, config.placeholderHeight * 0.4, 8
        );
        const trunkMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x4a3429
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = config.placeholderHeight * 0.2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);
        
        // Chioma con più livelli
        const leafLevels = 2 + Math.floor(Math.random() * 2);
        
        for (let i = 0; i < leafLevels; i++) {
            const levelHeight = config.placeholderHeight * 0.6 + i * 1.5;
            const levelRadius = 2.5 - i * 0.4;
            const levelGeometry = new THREE.ConeGeometry(levelRadius, 3, 8);
            const levelMaterial = new THREE.MeshLambertMaterial({ 
                color: config.color
            });
            const level = new THREE.Mesh(levelGeometry, levelMaterial);
            level.position.y = levelHeight;
            level.castShadow = true;
            level.receiveShadow = true;
            tree.add(level);
        }
        
        // Applica effetti notturni
        tree.traverse((child) => {
            if (child.material) {
                child.material.color.multiplyScalar(0.5);
                if (!child.material.emissive) {
                    child.material.emissive = new THREE.Color(0x002244);
                    child.material.emissiveIntensity = 0.15;
                }
            }
        });
        
        tree.userData.treeType = treeType;
        tree.userData.isPlaceholder = true;
        
        return tree;
    }
    
    // Crea istanza placeholder
    createPlaceholderInstance(treeType, position, customScale = null, customRotation = null) {
        const placeholder = this.createPlaceholder(treeType);
        const config = this.treeTypes[treeType];
        
        // Applica trasformazioni
        const scale = customScale || THREE.MathUtils.randFloat(
            config.scale.min, 
            config.scale.max
        );
        const rotation = customRotation !== null ? customRotation : Math.random() * Math.PI * 2;
        
        placeholder.scale.setScalar(scale);
        placeholder.position.copy(position);
        placeholder.rotation.y = rotation;
        
        placeholder.userData.scale = scale;
        placeholder.userData.baseRotation = rotation;
        
        return placeholder;
    }
    
    // Precarica tutti i modelli (con callback di completamento)
    preloadAllModels(onComplete = null, onProgress = null) {
        console.log('TreeLoader: Precaricamento di tutti i modelli...');
        
        const types = Object.keys(this.treeTypes);
        let loadedCount = 0;
        const totalCount = types.length;
        
        const checkComplete = () => {
            loadedCount++;
            
            if (onProgress) {
                onProgress(loadedCount, totalCount);
            }
            
            if (loadedCount === totalCount) {
                console.log('TreeLoader: Tutti i modelli precaricati con successo');
                if (onComplete) {
                    onComplete();
                }
            }
        };
        
        types.forEach(type => {
            this.loadModel(type, checkComplete, checkComplete);
        });
    }
    
    // Verifica se un modello è già caricato
    isModelLoaded(treeType) {
        return this.loadedModels.has(treeType);
    }
    
    // Verifica se un modello è in caricamento
    isModelLoading(treeType) {
        return this.loadingCallbacks.has(treeType);
    }
    
    // Ottieni i tipi disponibili
    getAvailableTypes() {
        return Object.keys(this.treeTypes);
    }
    
    // Ottieni configurazione di un tipo
    getTypeConfig(treeType) {
        return this.treeTypes[treeType];
    }
    
    // Cleanup
    dispose() {
        // Cleanup modelli caricati
        this.loadedModels.forEach((model) => {
            model.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
        
        this.loadedModels.clear();
        this.loadingCallbacks.clear();
    }
}

// Export della classe
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TreeLoader;
}

// Rendi disponibile globalmente
window.TreeLoader = TreeLoader;