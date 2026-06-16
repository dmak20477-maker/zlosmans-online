const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

// --- БАЗА КВИЗА ---
const quizQuestions = [
    { q: "Какой бренд использует бриллианты в логотипе?", a: ["ZLOSMANS", "Mercedes", "Rolex", "BMW"], right: 0 },
    { q: "Что нужно для создания WebApp онлайна при выключенном ПК?", a: ["Хостинг", "Блокнот", "HTML", "Интернет"], right: 0 },
    { q: "Какая библиотека отвечает за онлайн (Сокеты)?", a: ["Socket.io", "Telegraf", "Express", "React"], right: 0 }
];

// --- ГЕНЕРАЦИЯ КОЛОДЫ (ДУРАК) ---
const suits = ['♠', '♣', '♥', '♦'];
const ranks = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
function createDeck() {
    let deck = [];
    for (let suit of suits) {
        for (let rank of ranks) deck.push({ suit, rank, color: (suit === '♥' || suit === '♦') ? 'red' : 'black', id: Math.random() });
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

io.on('connection', (socket) => {
    
    socket.on('join_room', ({ roomId, playerName, gameType }) => {
        socket.join(roomId);
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                gameType: gameType, players: [], active: false,
                board: ["", "", "", "", "", "", "", "", ""], turn: "X",
                deck: [], trump: null, table: []
            };
        }

        const room = rooms[roomId];
        
        if (room.players.length < 2) {
            const symbol = room.players.length === 0 ? "X" : "O";
            room.players.push({ id: socket.id, name: playerName, symbol: symbol, hand: [] });
            socket.emit('assigned_symbol', symbol);
        }

        // --- ЗАПУСК ДУРАКА ---
        if (room.players.length === 2 && room.gameType === 'durak' && !room.active) {
            room.active = true;
            room.deck = createDeck();
            room.trump = room.deck.pop(); 
            room.players[0].hand = room.deck.splice(-6);
            room.players[1].hand = room.deck.splice(-6);
            room.turn = room.players[0].id;
        }

        // --- ЗАПУСК ШАШЕК ---
        if (room.players.length === 2 && room.gameType === 'checkers' && !room.active) {
            room.active = true;
            room.chkBoard = [
                0,2,0,2,0,2,0,2, 2,0,2,0,2,0,2,0, 0,2,0,2,0,2,0,2, 
                0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 
                1,0,1,0,1,0,1,0, 0,1,0,1,0,1,0,1, 1,0,1,0,1,0,1,0
            ];
            room.turn = "X";
        }

        // --- ЗАПУСК МОРСКОГО БОЯ ---
        if (room.players.length === 2 && room.gameType === 'seabattle' && !room.active) {
            room.active = true;
            room.sea1 = Array(100).fill(0); room.sea2 = Array(100).fill(0);
            for(let i=0; i<4; i++) { room.sea1[Math.floor(Math.random()*100)] = 1; room.sea2[Math.floor(Math.random()*100)] = 1; }
            room.turn = room.players[0].id; 
        }

        // --- ЗАПУСК КВИЗА ---
        if (room.players.length === 2 && room.gameType === 'quiz' && !room.active) {
            room.active = true; room.quizIndex = 0; room.quizScores = {};
            room.quizScores[room.players[0].id] = 0; room.quizScores[room.players[1].id] = 0;
        }

        // --- ЗАПУСК ПИНГ-ПОНГА (REAL-TIME) ---
        if (room.players.length === 2 && room.gameType === 'pingpong' && !room.active) {
            room.active = true;
            room.pong = { p1Y: 40, p2Y: 40, bX: 50, bY: 50, dX: 2, dY: 2, s1: 0, s2: 0 };
            
            // Игровой цикл Пинг-Понга на сервере (30 кадров в сек)
            room.pongInterval = setInterval(() => {
                let p = room.pong;
                p.bX += p.dX; p.bY += p.dY;
                
                if(p.bY <= 0 || p.bY >= 100) p.dY *= -1; // Отскок от верха/низа
                // Отскок от ракеток
                if(p.bX <= 5 && p.bY >= p.p1Y && p.bY <= p.p1Y + 20) p.dX = Math.abs(p.dX);
                if(p.bX >= 95 && p.bY >= p.p2Y && p.bY <= p.p2Y + 20) p.dX = -Math.abs(p.dX);
                
                // Голы
                if(p.bX < 0) { p.s2++; p.bX=50; p.bY=50; p.dX=2; }
                if(p.bX > 100) { p.s1++; p.bX=50; p.bY=50; p.dX=-2; }

                io.to(roomId).emit('update_pong', p);
            }, 33);
        }

        updateRoomState(roomId);
    });

    // --- УПРАВЛЕНИЕ ПИНГ-ПОНГОМ ---
    socket.on('pong_move', ({ roomId, y, symbol }) => {
        const room = rooms[roomId];
        if (room && room.gameType === 'pingpong') {
            if (symbol === "X") room.pong.p1Y = y;
            if (symbol === "O") room.pong.p2Y = y;
        }
    });

    // --- КРЕСТИКИ-НОЛИКИ ---
    socket.on('make_move', ({ roomId, index, symbol }) => {
        const room = rooms[roomId];
        if (room && room.gameType === 'tictactoe' && room.board[index] === "" && room.turn === symbol) {
            room.board[index] = symbol; room.turn = room.turn === "X" ? "O" : "X";
            updateRoomState(roomId);
        }
    });

    // --- ШАШКИ ---
    socket.on('move_checker', ({ roomId, from, to, symbol }) => {
        const room = rooms[roomId];
        const piece = symbol === "X" ? 1 : 2;
        if (room && room.gameType === 'checkers' && room.turn === symbol) {
            if (room.chkBoard[from] === piece && room.chkBoard[to] === 0) {
                room.chkBoard[to] = piece; room.chkBoard[from] = 0;
                room.turn = room.turn === "X" ? "O" : "X";
                updateRoomState(roomId);
            }
        }
    });

    // --- МОРСКОЙ БОЙ ---
    socket.on('sea_shoot', ({ roomId, index }) => {
        const room = rooms[roomId];
        if (room && room.gameType === 'seabattle' && room.turn === socket.id && room.active) {
            const opponent = room.players.find(p => p.id !== socket.id);
            const targetField = opponent.symbol === "X" ? room.sea1 : room.sea2;
            if (targetField[index] === 0) { targetField[index] = 2; room.turn = opponent.id; } 
            else if (targetField[index] === 1) { targetField[index] = 3; if (!targetField.includes(1)) room.active = false; }
            updateRoomState(roomId);
        }
    });

    // --- КВИЗ ---
    socket.on('quiz_answer', ({ roomId, answerIndex }) => {
        const room = rooms[roomId];
        if (room && room.gameType === 'quiz' && room.active) {
            if (answerIndex === quizQuestions[room.quizIndex].right) room.quizScores[socket.id] += 10;
            room.quizIndex++;
            if (room.quizIndex >= quizQuestions.length) room.active = false;
            updateRoomState
