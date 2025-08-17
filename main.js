import Game from './game.js';

const loadingScreen = document.getElementById('loading-screen');
const playerListElement = document.getElementById('player-list');

function isTouchDevice() {
    return (('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (navigator.msMaxTouchPoints > 0));
}

async function main() {
    console.log('🚀 Starting game initialization...');
    
    const room = new WebsimSocket();
    await room.initialize();
    console.log('✅ WebSocket connection established');

    if (isTouchDevice()) {
        document.body.classList.add('touch-enabled');
        console.log('✅ Touch controls enabled');
    }

    const game = new Game();
    game.init();
    console.log('✅ Game initialized');

    // Wait a moment for physics to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    loadingScreen.style.display = 'none';
    console.log('✅ Loading screen hidden');

    // Add the local player
    game.addPlayer(room.clientId, true);
    console.log('✅ Local player added');

    // Test movement after everything is loaded
    setTimeout(() => {
        const localPlayer = game.players[room.clientId];
        if (localPlayer && localPlayer.testMovement) {
            console.log('🧪 Running post-load movement test...');
            localPlayer.testMovement();
        }
    }, 500);

    // Initial presence
    room.updatePresence({
        position: { x: 0, y: 5, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        animation: 'idle'
    });

    // Handle presence updates (players joining, leaving, moving)
    room.subscribePresence(currentPresence => {
        // Add new players
        for (const id in currentPresence) {
            if (!game.players[id] && id !== room.clientId) {
                console.log('Player joined:', id);
                game.addPlayer(id, false);
            }
        }

        // Remove disconnected players
        for (const id in game.players) {
            if (!currentPresence[id]) {
                console.log('Player left:', id);
                game.removePlayer(id);
            }
        }
        updatePlayerListUI(room.peers);
    });
    updatePlayerListUI(room.peers);


    // Main game loop with error handling
    let lastTime = 0;
    function animate(time) {
        try {
            requestAnimationFrame(animate);
            const deltaTime = Math.min((time - (lastTime || time)) / 1000, 1/30); // Cap delta time
            lastTime = time;

            const localPlayer = game.players[room.clientId];
            if (localPlayer) {
                const { position, quaternion } = localPlayer.getSyncData();
                room.updatePresence({ position, quaternion });
            }
            
            game.update(deltaTime, room.presence);
        } catch (error) {
            console.error('Game loop error:', error);
        }
    }

    animate();
    console.log('✅ Game loop started');
}

function updatePlayerListUI(peers) {
    let listHTML = '<h3>Players</h3><ul>';
    for(const id in peers) {
        const peer = peers[id];
        listHTML += `<li><img src="${peer.avatarUrl}" alt="${peer.username}"> ${peer.username}</li>`;
    }
    listHTML += '</ul>';
    playerListElement.innerHTML = listHTML;
}


main().catch(console.error);