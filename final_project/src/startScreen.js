// startScreen.js - Start screen functionality

class StartScreen {
    constructor() {
        this.isVisible = true;
        this.init();
    }

    init() {
        this.createStars();
        this.setupEventListeners();
        
        // Debug: verifica che tutti gli elementi HTML esistano
        const requiredElements = ['start-screen', 'loading'];
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            if (!element) {
                console.error(`Missing HTML element: #${id}`);
            } else {
                console.log(`Found element: #${id}`);
            }
        });
    }

    // Create animated stars background
    createStars() {
        const starsContainer = document.getElementById('stars-container');
        if (!starsContainer) return;

        const numStars = 50;

        for (let i = 0; i < numStars; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            
            // Random position
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            
            // Random size
            const size = Math.random() * 3 + 1;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            
            // Random animation delay
            star.style.animationDelay = Math.random() * 3 + 's';
            
            starsContainer.appendChild(star);
        }
    }

    setupEventListeners() {
        // Start button click
        const startButton = document.querySelector('.start-button');
        if (startButton) {
            startButton.addEventListener('click', () => this.startGame());
        }

        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            if ((event.code === 'Enter' || event.code === 'Space') && this.isVisible) {
                event.preventDefault();
                this.startGame();
            }
        });
    }

    startGame() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        
        // Hide start screen
        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.classList.add('hidden');
        }
        
        // Show loading - with safety check
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'block';
            loading.innerHTML = 'Loading...'; // Reset text in case of previous errors
            loading.style.color = 'white'; // Reset color
        } else {
            console.warn('Loading element not found');
        }
        
        // Show game UI after a delay
        setTimeout(() => {
            this.showGameUI();
        }, 300);
        
        // Remove start screen and initialize game
        setTimeout(() => {
            if (startScreen) {
                startScreen.style.display = 'none';
            }
            
            // Initialize the actual game
            try {
                if (typeof init === 'function') {
                    console.log('Calling game init function...');
                    init();
                    
                } else {
                    console.error('Game init function not found!');
                    // Show error to user
                    if (loading) {
                        loading.innerHTML = 'Error: Game failed to load!';
                        loading.style.color = '#ff4444';
                    }
                }
            } catch (error) {
                console.error('Error initializing game:', error);
                if (loading) {
                    loading.innerHTML = 'Error: ' + error.message;
                    loading.style.color = '#ff4444';
                }
            }
            
        }, 800);
    }

    showGameUI() {
        const elements = [
            'player-health-ui',
            'score-ui', 
            'spell-ui'
        ];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('active');
            }
        });
    }
}

// Global function for onclick in HTML
function startGame() {
    if (window.startScreen) {
        window.startScreen.startGame();
    }
}

// Initialize start screen when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.startScreen = new StartScreen();
});