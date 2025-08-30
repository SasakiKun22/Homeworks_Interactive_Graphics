// deathScreen.js - Death screen functionality

class DeathScreen {
    constructor() {
        this.isVisible = false;
        this.gameStats = {
            finalScore: 0,
            kills: 0
        };
    }

    // Called when player dies
    showDeathScreen(player) {
        if (this.isVisible) return;

        console.log('Showing death screen...');
        this.isVisible = true;

        // Calculate game stats
        this.calculateGameStats(player);
        
        // Show the death screen
        const deathScreen = document.getElementById('death-screen');
        if (deathScreen) {
            // Update stats in HTML
            this.updateDeathStats();
            
            // Create floating skulls animation
            this.createFloatingSkuls();
            
            // Show with fade in animation
            deathScreen.classList.add('visible');
        }

        // Hide game UI
        this.hideGameUI();

        // Stop the game loop (pause everything)
        this.pauseGame();
    }

    calculateGameStats(player) {
        // Get final score
        this.gameStats.finalScore = player ? player.getScore() : 0;
        
        // Get kill count
        this.gameStats.kills = player ? player.killCount : 0;

        console.log('Game stats calculated:', this.gameStats);
    }

    updateDeathStats() {
        // Update score
        const scoreElement = document.getElementById('death-final-score');
        if (scoreElement) {
            scoreElement.textContent = this.gameStats.finalScore.toLocaleString();
        }

        // Update kills
        const killsElement = document.getElementById('death-kills');
        if (killsElement) {
            killsElement.textContent = this.gameStats.kills.toLocaleString();
        }
    }

    createFloatingSkuls() {
        const container = document.getElementById('floating-skulls');
        if (!container) return;

        // Clear existing skulls
        container.innerHTML = '';

        // Create 8 floating skulls
        for (let i = 0; i < 8; i++) {
            const skull = document.createElement('div');
            skull.className = 'skull';
            skull.innerHTML = '💀'; // Skull emoji
            
            // Random horizontal position
            skull.style.left = Math.random() * 100 + '%';
            
            // Random animation delay
            skull.style.animationDelay = Math.random() * 15 + 's';
            
            // Random size variation
            const size = 1.5 + Math.random() * 1;
            skull.style.fontSize = size + 'rem';
            
            container.appendChild(skull);
        }
    }

    hideGameUI() {
        const gameUIElements = [
            'player-health-ui',
            'score-ui',
            'spell-ui'
        ];

        gameUIElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.remove('active');
                element.style.display = 'none';
            }
        });
    }

    showGameUI() {
        const gameUIElements = [
            'player-health-ui',
            'score-ui', 
            'spell-ui'
        ];

        gameUIElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'block';
                element.classList.add('active');
            }
        });
    }

    pauseGame() {
        // Set a global flag to pause the game loop
        window.gamePaused = true;
        
        // Stop any ongoing animations or timers if needed
        if (window.animationFrameId) {
            cancelAnimationFrame(window.animationFrameId);
        }
    }

    resumeGame() {
        // Resume the game loop
        window.gamePaused = false;
        
        // Restart the animation loop if it exists
        if (typeof animate === 'function') {
            animate();
        }
    }

    hideDeathScreen() {
        const deathScreen = document.getElementById('death-screen');
        if (deathScreen) {
            deathScreen.classList.remove('visible');
            
            // Hide completely after animation
            setTimeout(() => {
                deathScreen.style.display = 'none';
            }, 1500);
        }
        
        this.isVisible = false;
    }

    restartGame() {
        console.log('DeathScreen restartGame() called...');
        
        // Hide death screen
        this.hideDeathScreen();
        
        // Show loading
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'block';
            loading.innerHTML = 'Restarting...';
            loading.style.color = 'white';
        }
        
        // Show game UI
        this.showGameUI();
        
        // Use the centralized restart function from main.js
        setTimeout(() => {
            if (typeof window.restartGameMain === 'function') {
                console.log('Calling window.restartGameMain...');
                window.restartGameMain();
                
                // Hide loading after restart
                setTimeout(() => {
                    if (loading) {
                        loading.style.display = 'none';
                        console.log('Loading hidden after restart');
                    }
                }, 1000);
                
            } else {
                console.error('window.restartGameMain function not found!');
                console.log('Available functions:', Object.keys(window).filter(key => key.includes('restart')));
                if (loading) {
                    loading.innerHTML = 'Error: Restart function not available!';
                    loading.style.color = '#ff4444';
                }
            }
        }, 300);
    }

    resetGameState() {
        // Use centralized reset from main.js instead
        if (typeof window.resetGame === 'function') {
            window.resetGame();
        }
        
        // Reset local stats
        this.gameStats = {
            finalScore: 0,
            kills: 0
        };
        
        console.log('Death screen state reset complete');
    }

    // Remove this method - not needed anymore
    performRestart() {
        // This is now handled by main.js restartGame()
        console.log('performRestart deprecated - using main.js restartGame()');
    }

    // Remove this method - not needed anymore  
    initializeNewGame() {
        // This is now handled by main.js restartGame()
        console.log('initializeNewGame deprecated - using main.js restartGame()');
    }

    returnToMainMenu() {
        console.log('Returning to main menu...');
        
        // Hide death screen
        this.hideDeathScreen();
        
        // RADICAL RESET: Reload the entire page to avoid corruption
        // This ensures a completely clean state
        console.log('Performing full page reload for clean restart...');
        window.location.reload();
    }
}

// Global functions for button clicks
function restartGame() {
    console.log('HTML restartGame() called');
    if (window.deathScreen) {
        window.deathScreen.restartGame();
    } else {
        console.error('window.deathScreen not found!');
        // Fallback: try calling main.js restart directly
        if (typeof window.restartGame === 'function') {
            console.log('Calling main.js restartGame directly');
            window.restartGame();
        }
    }
}

function returnToMenu() {
    console.log('HTML returnToMenu() called');
    if (window.deathScreen) {
        window.deathScreen.returnToMainMenu();
    } else {
        console.error('window.deathScreen not found!');
        // Fallback: reload page
        window.location.reload();
    }
}

// Initialize death screen when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.deathScreen = new DeathScreen();
    console.log('Death screen initialized');
    
    // Add direct event listeners to buttons for more reliable handling
    setTimeout(() => {
        const restartBtn = document.querySelector('.restart-button');
        const menuBtn = document.querySelector('.menu-button');
        
        if (restartBtn) {
            restartBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Restart button clicked via event listener');
                if (window.deathScreen) {
                    window.deathScreen.restartGame();
                } else {
                    console.error('deathScreen not available');
                }
            });
            console.log('Restart button event listener added');
        }
        
        if (menuBtn) {
            menuBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Menu button clicked via event listener');
                if (window.deathScreen) {
                    window.deathScreen.returnToMainMenu();
                } else {
                    window.location.reload();
                }
            });
            console.log('Menu button event listener added');
        }
    }, 1000); // Wait for elements to be created
});