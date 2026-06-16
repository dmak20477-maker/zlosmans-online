const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Отдаем клиенту файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// База данных комнат в оперативной памяти
const rooms = {};

io.on('connection', (socket) => {
    console.log(`🔌 Подключился игрок: ${socket.id}`);

    // Игрок создает или заходит в комнату
    socket.on('join_room', ({ roomId, playerName }) => {
        socket.join(roomId);
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                board: ["", "", "", "", "", "", "", "", ""],
                turn: "X",
                active: true
            };
        }

        const room = rooms[roomId];
        
        // В крестиках-ноликах только 2 места
        if (room.players.length < 2) {
            const symbol = room.players.length === 0 ? "X" : "O";
            room.players.push({ id: socket.id, name: playerName, symbol: symbol });
            socket.emit('assigned_symbol', symbol);
        } else {
            // Если комната полная, заходит как зритель
            socket.emit('assigned_symbol', "Spectator");
        }

        // Отправляем всем в комнате текущее состояние
        io.to(roomId).emit('update_game', {
            players: room.players,
            board: room.board,
            turn: room.turn,
            active: room.active
        });
    });

    // Игрок делает ход
    socket.on('make_move', ({ roomId, index, symbol }) => {
        const room = rooms[roomId];
        if (room && room.active && room.turn === symbol && room.board[index] === "") {
            room.board[index] = symbol;
            
            // Проверка победы
            if (checkWin(room.board)) {
                room.active = false;
                io.to(roomId).emit('game_over', { winner: symbol, board: room.board });
            } else if (!room.board.includes("")) {
                room.active = false;
                io.to(roomId).emit('game_over', { winner: "Draw", board: room.board });
            } else {
                // Смена хода
                room.turn = room.turn === "X" ? "O" : "X";
                io.to(roomId).emit('update_game', {
                    players: room.players,
                    board: room.board,
                    turn: room.turn,
                    active: room.active
                });
            }
        }
    });

    // Перезапуск игры в комнате
    socket.on('restart_game', (roomId) => {
        if (rooms[roomId]) {
            rooms[roomId].board = ["", "", "", "", "", "", "", "", ""];
            rooms[roomId].turn = "X";
            rooms[roomId].active = true;
            io.to(roomId).emit('update_game', {
                players: rooms[roomId].players,
                board: rooms[roomId].board,
                turn: rooms[roomId].turn,
                active: rooms[roomId].active
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`❌ Отключился: ${socket.id}`);
        // В будущем добавим очистку пустых комнат
    });
});

function checkWin(board) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return wins.some(combo => board[combo[0]] !== "" && board[combo[0]] === board[combo[1]] && board[combo[0]] === board[combo[2]]);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер ZLOSMANS запущен на порту ${PORT}`);
});
