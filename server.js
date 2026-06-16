const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

const quizQuestions = [
    { q: "Какой бренд использует бриллианты в логотипе?", a: ["ПЛОВЦЕНТР", "Mercedes", "Rolex", "BMW"], right: 0 },
    { q: "Что нужно для создания WebApp онлайна при выключенном ПК?", a: ["Хостинг/Render", "Блокнот", "HTML", "Интернет"], right: 0 },
    { q: "Какая библиотека отвечает за онлайн (Сокеты)?", a: ["Socket.io", "Telegraf", "Express", "React"], right: 0 }
];

const suits = ['♠', '♣', '♥', '♦'];
function createDeck(size) {
    let deck = []; let ranks = [];
    if (size === 24) ranks = ['9', '10', 'J', 'Q', 'K', 'A'];
    else if (size === 52) ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    else ranks = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']; 
    for (let suit of suits) { for (let rank of ranks) { deck.push({ suit, rank, color: (suit === '♥' || suit === '♦') ? 'red' : 'black', id: Math.random() }); } }
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return deck;
}

function getPublicRooms() {
    const publicRooms = [];
    for (const roomId in rooms) { if (rooms[roomId].players.length === 1 && !rooms[roomId].active) publicRooms.push({ id: roomId, gameType: rooms[roomId].gameType, host: rooms[roomId].players[0].name }); }
    return publicRooms;
}

// ФУНКЦИЯ ЗАВЕРШЕНИЯ ИГРЫ
function finishGame(roomId, winnerName, reason) {
    if(!rooms[roomId]) return;
    rooms[roomId].active = false;
    io.to(roomId).emit('game_over', { winner: winnerName, reason: reason });
    if(rooms[roomId].pongInterval) clearInterval(rooms[roomId].pongInterval);
}

io.on('connection', (socket) => {
    socket.emit('update_room_list', getPublicRooms());

    socket.on('join_room', ({ roomId, playerName, gameType, durakDeckSize }) => {
        socket.join(roomId);
        if (!rooms[roomId]) rooms[roomId] = { gameType: gameType, players: [], active: false, board: ["", "", "", "", "", "", "", "", ""], turn: "X", deck: [], trump: null, table: [], settings: { deckSize: durakDeckSize || 36 } };
        const room = rooms[roomId];
        
        if (room.players.length < 2) {
            const symbol = room.players.length === 0 ? "X" : "O";
            room.players.push({ id: socket.id, name: playerName, symbol: symbol, hand: [] });
            socket.emit('assigned_symbol', symbol);
        }

        if (room.players.length === 2 && !room.active) {
            room.active = true;
            if (room.gameType === 'durak') {
                room.deck = createDeck(room.settings.deckSize); room.trump = room.deck.pop(); 
                room.players[0].hand = room.deck.splice(-6); room.players[1].hand = room.deck.splice(-6);
                room.turn = room.players[0].id;
            }
            if (room.gameType === 'checkers') { room.chkBoard = [0,2,0,2,0,2,0,2, 2,0,2,0,2,0,2,0, 0,2,0,2,0,2,0,2, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0]; room.turn = "X"; }
            if (room.gameType === 'seabattle') { room.sea1 = Array(100).fill(0); room.sea2 = Array(100).fill(0); for(let i=0; i<4; i++) { room.sea1[Math.floor(Math.random()*100)] = 1; room.sea2[Math.floor(Math.random()*100)] = 1; } room.turn = room.players[0].id; }
            if (room.gameType === 'quiz') { room.quizIndex = 0; room.quizScores = {}; room.quizScores[room.players[0].id] = 0; room.quizScores[room.players[1].id] = 0; }
            if (room.gameType === 'pingpong') {
                room.pong = { p1Y: 40, p2Y: 40, bX: 50, bY: 50, dX: 2, dY: 2, s1: 0, s2: 0 };
                room.pongInterval = setInterval(() => {
                    let p = room.pong; p.bX += p.dX; p.bY += p.dY;
                    if(p.bY <= 0 || p.bY >= 100) p.dY *= -1;
                    if(p.bX <= 5 && p.bY >= p.p1Y && p.bY <= p.p1Y + 20) p.dX = Math.abs(p.dX);
                    if(p.bX >= 95 && p.bY >= p.p2Y && p.bY <= p.p2Y + 20) p.dX = -Math.abs(p.dX);
                    if(p.bX < 0) { p.s2++; p.bX=50; p.bY=50; p.dX=2; } if(p.bX > 100) { p.s1++; p.bX=50; p.bY=50; p.dX=-2; }
                    io.to(roomId).emit('update_pong', p);

                    // ПОБЕДА В ПИНГ ПОНГЕ (ДО 5 ОЧКОВ)
                    if(p.s1 >= 5) finishGame(roomId, room.players[0].name, "Разгром всухую!");
                    if(p.s2 >= 5) finishGame(roomId, room.players[1].name, "Разгром всухую!");
                }, 33);
            }
        }
        updateRoomState(roomId); io.emit('update_room_list', getPublicRooms());
    });

    socket.on('pong_move', ({ roomId, y, symbol }) => { if (rooms[roomId] && rooms[roomId].gameType === 'pingpong') { symbol === "X" ? rooms[roomId].pong.p1Y = y : rooms[roomId].pong.p2Y = y; } });
    
    // ПРАВИЛА КРЕСТИКОВ
    socket.on('make_move', ({ roomId, index, symbol }) => { 
        let r = rooms[roomId]; 
        if (r && r.gameType === 'tictactoe' && r.board[index] === "" && r.turn === symbol) { 
            r.board[index] = symbol; r.turn = r.turn === "X" ? "O" : "X"; 
            updateRoomState(roomId); 
            
            const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
            for(let combo of wins) {
                if(r.board[combo[0]] && r.board[combo[0]] === r.board[combo[1]] && r.board[combo[0]] === r.board[combo[2]]) {
                    let winner = r.players.find(p => p.symbol === r.board[combo[0]]).name;
                    return finishGame(roomId, winner, "Крестики-Нолики");
                }
            }
            if(!r.board.includes("")) finishGame(roomId, "НИЧЬЯ", "Победила дружба");
        } 
    });
    
    // ПРАВИЛА ШАШЕК
    socket.on('move_checker', ({ roomId, from, to, symbol }) => { 
        let r = rooms[roomId]; const piece = symbol === "X" ? 1 : 2; 
        if (r && r.gameType === 'checkers' && r.turn === symbol) { 
            let r1 = Math.floor(from/8), c1 = from%8, r2 = Math.floor(to/8), c2 = to%8;
            let isNormal = Math.abs(r2-r1) === 1 && Math.abs(c2-c1) === 1;
            let isJump = Math.abs(r2-r1) === 2 && Math.abs(c2-c1) === 2;
            
            if (r.chkBoard[from] === piece && r.chkBoard[to] === 0) { 
                let moved = false;
                if (isNormal) { r.chkBoard[to] = piece; r.chkBoard[from] = 0; moved = true; } 
                else if (isJump) {
                    let mid = from + (to - from) / 2; let enemy = symbol === "X" ? 2 : 1;
                    if (r.chkBoard[mid] === enemy) { r.chkBoard[to] = piece; r.chkBoard[from] = 0; r.chkBoard[mid] = 0; moved = true; }
                }
                
                if (moved) {
                    r.turn = r.turn === "X" ? "O" : "X"; updateRoomState(roomId);
                    // ПРОВЕРКА ПОБЕДЫ В ШАШКАХ
                    if(!r.chkBoard.includes(1)) return finishGame(roomId, r.players.find(p=>p.symbol==="O").name, "Все шашки съедены!");
                    if(!r.chkBoard.includes(2)) return finishGame(roomId, r.players.find(p=>p.symbol==="X").name, "Все шашки съедены!");
                }
            } 
        } 
    });

    // ПРАВИЛА МОРСКОГО БОЯ
    socket.on('sea_shoot', ({ roomId, index }) => { 
        let r = rooms[roomId]; 
        if (r && r.gameType === 'seabattle' && r.turn === socket.id && r.active) { 
            const p = r.players.find(pl => pl.id === socket.id);
            const opp = r.players.find(pl => pl.id !== socket.id); 
            const tF = opp.symbol === "X" ? r.sea1 : r.sea2; 
            
            if (tF[index] === 0) { tF[index] = 2; r.turn = opp.id; } 
            else if (tF[index] === 1) { 
                tF[index] = 3; 
                // ПРОВЕРКА ПОБЕДЫ МОРСКОЙ БОЙ
                if (!tF.includes(1)) { updateRoomState(roomId); return finishGame(roomId, p.name, "Флот противника уничтожен!"); }
            } 
            updateRoomState(roomId); 
        } 
    });

    // ПРАВИЛА КВИЗА
    socket.on('quiz_answer', ({ roomId, answerIndex }) => { 
        let r = rooms[roomId]; 
        if (r && r.gameType === 'quiz' && r.active) { 
            if (answerIndex === quizQuestions[r.quizIndex].right) r.quizScores[socket.id] += 10; 
            r.quizIndex++; 
            if (r.quizIndex >= quizQuestions.length) {
                let p1 = r.players[0]; let p2 = r.players[1];
                let winner = "НИЧЬЯ";
                if (r.quizScores[p1.id] > r.quizScores[p2.id]) winner = p1.name;
                if (r.quizScores[p2.id] > r.quizScores[p1.id]) winner = p2.name;
                finishGame(roomId, winner, "Самый умный!");
            }
            updateRoomState(roomId); 
        } 
    });
    
    // ПРАВИЛА ДУРАКА
    socket.on('play_card', ({ roomId, cardIndex }) => { let r = rooms[roomId]; if (r && r.gameType === 'durak') { const p = r.players.find(pl => pl.id === socket.id); if (p && p.hand[cardIndex]) { r.table.push(p.hand.splice(cardIndex, 1)[0]); updateRoomState(roomId); checkDurakWin(r, roomId); } } });
    socket.on('durak_bito', (roomId) => { let r = rooms[roomId]; if (r && r.gameType === 'durak') { r.table = []; dealCards(r); updateRoomState(roomId); checkDurakWin(r, roomId); } });
    socket.on('durak_take', (roomId) => { let r = rooms[roomId]; if (r && r.gameType === 'durak') { const p = r.players.find(pl => pl.id === socket.id); if (p) { p.hand = p.hand.concat(r.table); r.table = []; dealCards(r); updateRoomState(roomId); checkDurakWin(r, roomId); } } });
    
    function dealCards(room) { room.players.forEach(p => { while (p.hand.length < 6 && room.deck.length > 0) p.hand.push(room.deck.pop()); }); room.players.forEach(p => { if (p.hand.length < 6 && room.trump) { p.hand.push(room.trump); room.trump = null; } }); }
    
    function checkDurakWin(room, roomId) {
        if (room.deck.length === 0 && !room.trump) {
            let p1 = room.players[0]; let p2 = room.players[1];
            if (p1.hand.length === 0 && p2.hand.length > 0) finishGame(roomId, p1.name, "Оставил в Дураках!");
            if (p2.hand.length === 0 && p1.hand.length > 0) finishGame(roomId, p2.name, "Оставил в Дураках!");
            if (p1.hand.length === 0 && p2.hand.length === 0) finishGame(roomId, "НИЧЬЯ", "Колода пуста");
        }
    }

    function updateRoomState(roomId) {
        if (!rooms[roomId]) return;
        rooms[roomId].players.forEach(player => {
            const opponent = rooms[roomId].players.find(p => p.id !== player.id);
            io.to(player.id).emit('update_game', { gameType: rooms[roomId].gameType, turn: rooms[roomId].turn, active: rooms[roomId].active, board: rooms[roomId].board, chkBoard: rooms[roomId].chkBoard, sea1: rooms[roomId].sea1, sea2: rooms[roomId].sea2, quizIndex: rooms[roomId].quizIndex, quizQuestion: quizQuestions[rooms[roomId].quizIndex] || null, quizScores: rooms[roomId].quizScores, myHand: player.hand, opponentCardsCount: opponent ? opponent.hand.length : 0, table: rooms[roomId].table, trump: rooms[roomId].trump, cardsLeft: rooms[roomId].deck ? rooms[roomId].deck.length : 0 });
        });
    }

    socket.on('disconnect', () => {
        for (let roomId in rooms) {
            const pIndex = rooms[roomId].players.findIndex(p => p.id === socket.id);
            if (pIndex !== -1) { rooms[roomId].players.splice(pIndex, 1); if (rooms[roomId].pongInterval) clearInterval(rooms[roomId].pongInterval); if (rooms[roomId].players.length === 0) delete rooms[roomId]; else { rooms[roomId].active = false; finishGame(roomId, "ПРОТИВНИК", "Враг сбежал с поля боя!"); } }
        }
        io.emit('update_room_list', getPublicRooms());
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 СЕРВЕР ПЛОВЦЕНТР УСПЕШНО ЗАПУЩЕН!`);
    console.log(`💎 Автор: Денис | Личка: @ekx888d`);
    console.log(`🔥 Порт: ${PORT}`);
    console.log(`=========================================`);

    try {
        const { exec } = require('child_process');
        const botProcess = exec('node bot.js', (err, stdout, stderr) => { if (err) return; });
        botProcess.stdout.on('data', (data) => console.log(`[BOT]: ${data.trim()}`));
    } catch (e) { console.error('Ошибка бота:', e); }
});
