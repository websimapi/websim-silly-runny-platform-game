import Game from './game.js';

const loadingScreen = document.getElementById('loading-screen');
const playerListElement = document.getElementById('player-list');

async function main() {
    const room = new WebsimSocket();
    await room.initialize();

    const game = new Game();
    game.init();

    loadingScreen.style.display = 'none';

    // Add the local player
    game.addPlayer(room.clientId, true);

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


    // Main game loop
    let lastTime = 0;
    function animate(time) {
        requestAnimationFrame(animate);
        const deltaTime = (time - (lastTime || time)) / 1000;
        lastTime = time;

        const localPlayer = game.players[room.clientId];
        if (localPlayer) {
            const { position, quaternion } = localPlayer.getSyncData();
            room.updatePresence({ position, quaternion });
        }
        
        game.update(deltaTime, room.presence);
    }

    animate();
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

