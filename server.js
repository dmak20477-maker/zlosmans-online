const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

// --- ГЕНЕРАЦИЯ КОЛОДЫ ДЛЯ ДУРАКА ---
const suits = ['♠', '♣', '♥', '♦'];
const ranks = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
    let deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ suit, rank, color: (suit === '♥' || suit === '♦') ? 'red' : 'black', id: Math.random() });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// --- ОСНОВНАЯ ЛОГИКА СЕРВЕРА ---
io.on('connection', (socket) => {
    
    socket.on('join_room', ({ roomId, playerName, gameType }) => {
        socket.join(roomId);
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                gameType: gameType,
                players: [],
                active: false,
                board: ["", "", "", "", "", "", "", "", ""],
                turn: "X",
                deck: [],
                trump: null,
                table: []
            };
        }

        const room = rooms[roomId];
        
        if (room.players.length < 2) {
            const symbol = room.players.length === 0 ? "X" : "O";
            room.players.push({ id: socket.id, name: playerName, symbol: symbol, hand: [] });
            socket.emit('assigned_symbol', symbol);
        }

        // Запуск Дурака, если зашли двое
        if (room.players.length === 2 && room.gameType === 'durak' && !room.active) {
            room.active = true;
            room.deck = createDeck();
            room.trump = room.deck.pop(); 
            
            room.players[0].hand = room.deck.splice(-6);
            room.players[1].hand = room.deck.splice(-6);
            room.turn = room.players[0].id; // Ходит первый
        }

        updateRoomState(roomId);
    });

    // --- КРЕСТИКИ-НОЛИКИ ---
    socket.on('make_move', ({ roomId, index, symbol }) => {
        const room = rooms[roomId];
        if (room && room.gameType === 'tictactoe' && room.board[index] === "" && room.turn === symbol) {
            room.board[index] = symbol;
            room.turn = room.turn === "X" ? "O" : "X";
            updateRoomState(roomId);
        }
    });

    // --- ДУРАК: КИДАТЬ КАРТУ НА СТОЛ ---
    socket.on('play_card', ({ roomId, cardIndex }) => {
        const room = rooms[roomId];
        if (room && room.gameType === 'durak') {
            const player = room.players.find(p => p.id === socket.id);
            if (player && player.hand[cardIndex]) {
                const playedCard = player.hand.splice(cardIndex, 1)[0];
                room.table.push(playedCard);
                updateRoomState(roomId);
            }
        }
    });

    // --- ДУРАК: КНОПКА "БИТО" ---
    socket.on('durak_bito', (roomId) => {
        const room = rooms[roomId];
        if (room && room.gameType === 'durak') {
            room.table = []; // Очищаем стол
            dealCards(room); // Добираем карты из колоды
            updateRoomState(roomId);
        }
    });

    // --- ДУРАК: КНОПКА "БЕРУ" ---
    socket.on('durak_take', (roomId) => {
        const room = rooms[roomId];
        if (room && room.gameType === 'durak') {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                // Игрок забирает все карты со стола в руку
                player.hand = player.hand.concat(room.table);
                room.table = [];
                dealCards(room);
                updateRoomState(roomId);
            }
        }
    });

    // Добор карт из колоды до 6 штук
    function dealCards(room) {
        room.players.forEach(p => {
            while (p.hand.length < 6 && room.deck.length > 0) {
                p.hand.push(room.deck.pop());
            }
        });
        // Если колода пуста, забираем козырь
        room.players.forEach(p => {
            if (p.hand.length < 6 && room.trump) {
                p.hand.push(room.trump);
                room.trump = null;
            }
        });
    }

    function updateRoomState(roomId) {
        const room = rooms[roomId];
        if (!room) return;

        room.players.forEach(player => {
            const opponent = room.players.find(p => p.id !== player.id);
            io.to(player.id).emit('update_game', {
                gameType: room.gameType,
                board: room.board,
                turn: room.turn,
                active: room.active,
                myHand: player.hand,
                opponentCardsCount: opponent ? opponent.hand.length : 0,
                table: room.table,
                trump: room.trump,
                cardsLeft: room.deck ? room.deck.length : 0
            });
        });
    }

    socket.on('disconnect', () => {
        console.log(`Отключился: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер работает на порту ${PORT}`));
