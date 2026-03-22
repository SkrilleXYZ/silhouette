const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const GameLogic = require('./game/gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 10000,
  pingInterval: 5000,
});

app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

const game = new GameLogic();
const ROLE_REVEAL_DELAY_MS = 6000;

setInterval(() => game.cleanupOldRooms(), 10 * 60 * 1000);

const socketMap = new Map();

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('create-room', ({ username, avatarIndex }, callback) => {
    const room = game.createRoom(socket.id, username, avatarIndex);
    if (room.error) {
      callback({ success: false, error: room.error });
      return;
    }
    socketMap.set(socket.id, { code: room.code, playerId: socket.id });
    socket.join(room.code);
    const publicData = game.getRoomPublicData(room.code);
    callback({ success: true, room: publicData, playerId: socket.id });
  });

  socket.on('join-room', ({ code, username, avatarIndex }, callback) => {
    const result = game.joinRoom(code.toUpperCase(), socket.id, username, avatarIndex);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    socketMap.set(socket.id, { code: code.toUpperCase(), playerId: socket.id });
    socket.join(code.toUpperCase());
    const publicData = game.getRoomPublicData(code.toUpperCase());
    io.to(code.toUpperCase()).emit('room-updated', publicData);
    callback({ success: true, room: publicData, playerId: socket.id });
  });

  socket.on('leave-room', (callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false });
      return;
    }
    const result = game.leaveRoom(mapping.code, socket.id);
    socket.leave(mapping.code);
    socketMap.delete(socket.id);
    if (result && !result.deleted) {
      const publicData = game.getRoomPublicData(mapping.code);
      io.to(mapping.code).emit('room-updated', publicData);
      if (result.newHostId) {
        io.to(mapping.code).emit('host-changed', { newHostId: result.newHostId });
      }
    }
    if (callback) callback({ success: true });
  });

  socket.on('start-game', (callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }
    const result = game.startGame(mapping.code, socket.id);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    const revealEndsAt = Date.now() + ROLE_REVEAL_DELAY_MS;
    result.room.roleRevealEndsAt = revealEndsAt;
    for (const [playerId] of result.room.players) {
      const playerData = game.getPlayerData(mapping.code, playerId);
      io.to(playerId).emit('game-started', {
        player: playerData,
        room: game.getRoomPublicData(mapping.code),
        revealEndsAt,
        revealDurationMs: ROLE_REVEAL_DELAY_MS
      });
    }
    const revealTimer = setTimeout(() => {
      const room = game.getRoom(mapping.code);
      roleRevealTimers.delete(mapping.code);
      if (!room || room.state !== 'night') return;
      room.roleRevealEndsAt = 0;
      io.to(mapping.code).emit('phase-changed', {
        phase: 'night',
        nightCount: room.nightCount,
        room: game.getRoomPublicData(mapping.code)
      });
      startNightTimer(mapping.code);
    }, ROLE_REVEAL_DELAY_MS);
    roleRevealTimers.set(mapping.code, revealTimer);
    callback({ success: true });
  });

  socket.on('update-room-settings', ({ anonymousVotes, anonymousEjects, hiddenRoleList }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = game.updateRoomSettings(mapping.code, socket.id, { anonymousVotes, anonymousEjects, hiddenRoleList });
    if (result.error) {
      if (callback) callback({ success: false, error: result.error });
      return;
    }

    const publicData = game.getRoomPublicData(mapping.code);
    io.to(mapping.code).emit('room-updated', publicData);
    if (callback) callback({ success: true, room: publicData });
  });

  socket.on('night-action', ({ action, targetId }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }
    const result = game.submitNightAction(mapping.code, socket.id, action, targetId);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    const room = game.getRoom(mapping.code);
    const publicNightMessage = game.getNightActionSummaryLine(mapping.code, action);
    if (publicNightMessage) {
      const chatMessage = game.appendToPhaseSummary(mapping.code, publicNightMessage);
      if (chatMessage) io.to(mapping.code).emit('chat-message-updated', { message: chatMessage });
    }
    const playerData = game.getPlayerData(mapping.code, socket.id);
    socket.emit('player-updated', { player: playerData });
    callback({ success: true });
    if (game.checkAllNightActionsSubmitted(mapping.code)) {
      resolveNightPhase(mapping.code);
    }
  });

  socket.on('skip-night', (callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }
    const result = game.skipNightAction(mapping.code, socket.id);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    const playerData = game.getPlayerData(mapping.code, socket.id);
    socket.emit('player-updated', { player: playerData });
    callback({ success: true });
    if (game.checkAllNightActionsSubmitted(mapping.code)) {
      resolveNightPhase(mapping.code);
    }
  });

  socket.on('vote', ({ targetId }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }
    const result = game.submitVote(mapping.code, socket.id, targetId);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    const room = game.getRoom(mapping.code);
    if (room && !room.anonymousVotes) {
      const voter = room.players.get(socket.id);
      let voteText = `${voter.name} skipped their vote.`;
      if (targetId !== 'skip') {
        const target = room.players.get(targetId);
        voteText = `${voter.name} voted for ${target.name}.`;
      }
      const chatMessage = game.appendToPhaseSummary(mapping.code, voteText);
      if (chatMessage) io.to(mapping.code).emit('chat-message-updated', { message: chatMessage });
    }
    const playerData = game.getPlayerData(mapping.code, socket.id);
    socket.emit('player-updated', { player: playerData });
    io.to(mapping.code).emit('vote-update', {
      voterId: socket.id,
      voterName: game.getRoom(mapping.code).players.get(socket.id).name,
      votesCast: Object.keys(game.getRoom(mapping.code).votes).length,
      totalAlive: game.getAlivePlayers(mapping.code).length
    });
    callback({ success: true });
    if (game.checkAllVotesSubmitted(mapping.code)) {
      resolveVotingPhase(mapping.code);
    }
  });

  socket.on('request-player-data', (callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      callback({ success: false });
      return;
    }
    const playerData = game.getPlayerData(mapping.code, socket.id);
    const roomData = game.getRoomPublicData(mapping.code);
    callback({ success: true, player: playerData, room: roomData });
  });

  socket.on('send-chat-message', ({ text }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = game.addChatMessage(mapping.code, socket.id, text);
    if (result.error) {
      if (callback) callback({ success: false, error: result.error });
      return;
    }

    io.to(mapping.code).emit('chat-message', { message: result.message });
    if (callback) callback({ success: true, message: result.message });
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    const mapping = socketMap.get(socket.id);
    if (mapping) {
      const room = game.getRoom(mapping.code);
      if (room) {
        if (room.state === 'lobby') {
          const result = game.leaveRoom(mapping.code, socket.id);
          if (result && !result.deleted) {
            const publicData = game.getRoomPublicData(mapping.code);
            io.to(mapping.code).emit('room-updated', publicData);
            if (result.newHostId) {
              io.to(mapping.code).emit('host-changed', { newHostId: result.newHostId });
            }
          }
        } else {
  const disconnectResult = game.disconnectPlayer(mapping.code, socket.id);
  const publicData = game.getRoomPublicData(mapping.code);
  io.to(mapping.code).emit('room-updated', publicData);
  if (disconnectResult && disconnectResult.winner) {
    clearAllTimers(mapping.code);
    const allPlayers = game.getAllPlayersWithRoles(mapping.code);
    io.to(mapping.code).emit('game-over', {
      winner: disconnectResult.winner,
      players: allPlayers
    });
  }
}
      }
      socketMap.delete(socket.id);
    }
  });
});

const nightTimers = new Map();
const votingTimers = new Map();
const morningTimers = new Map();
const roleRevealTimers = new Map();

function emitTimerStart(code, phase, duration, endsAt = Date.now() + duration * 1000) {
  io.to(code).emit('timer-start', { phase, duration, endsAt });
  return endsAt;
}

function startNightTimer(code) {
  clearAllTimers(code);
  const endsAt = Date.now() + 60000;
  const timer = setTimeout(() => {
    const room = game.getRoom(code);
    if (!room || room.state !== 'night') return;
    for (const [id, player] of room.players) {
      if (!player.alive) continue;
      if (player.role === 'Villager') continue;
      if (!room.nightActions[id]) {
        game.skipNightAction(code, id);
      }
    }
    resolveNightPhase(code);
  }, Math.max(0, endsAt - Date.now()));
  nightTimers.set(code, timer);
  emitTimerStart(code, 'night', 60, endsAt);
}

function startVotingTimer(code) {
  clearAllTimers(code);
  const endsAt = Date.now() + 60000;
  const timer = setTimeout(() => {
    const room = game.getRoom(code);
    if (!room || room.state !== 'voting') return;
    for (const [id, player] of room.players) {
      if (!player.alive) continue;
      if (!room.votes[id]) {
        game.submitVote(code, id, 'skip');
      }
    }
    resolveVotingPhase(code);
  }, Math.max(0, endsAt - Date.now()));
  votingTimers.set(code, timer);
  emitTimerStart(code, 'voting', 60, endsAt);
}

function clearAllTimers(code) {
  if (roleRevealTimers.has(code)) {
    clearTimeout(roleRevealTimers.get(code));
    roleRevealTimers.delete(code);
  }
  if (nightTimers.has(code)) {
    clearTimeout(nightTimers.get(code));
    nightTimers.delete(code);
  }
  if (votingTimers.has(code)) {
    clearTimeout(votingTimers.get(code));
    votingTimers.delete(code);
  }
  if (morningTimers.has(code)) {
    clearTimeout(morningTimers.get(code));
    morningTimers.delete(code);
  }
}

function resolveNightPhase(code) {
  clearAllTimers(code);
  const result = game.resolveNight(code);
  if (!result) return;

  io.to(code).emit('phase-changed', {
    phase: result.winner ? 'ended' : 'morning',
    nightCount: result.room.nightCount,
    messages: result.messages,
    room: game.getRoomPublicData(code)
  });

  if (result.privateMessages) {
    for (const [playerId, messages] of Object.entries(result.privateMessages)) {
      messages.forEach((message) => {
        io.to(playerId).emit('private-chat-message', { message });
      });
    }
  }

  if (result.winner) {
    const allPlayers = game.getAllPlayersWithRoles(code);
    io.to(code).emit('game-over', {
      winner: result.winner,
      players: allPlayers
    });
    clearAllTimers(code);
  } else {
    // Morning phase: 2 minutes (120 seconds)
    const endsAt = Date.now() + 120000;
    const timer = setTimeout(() => {
      game.startVoting(code);
      io.to(code).emit('phase-changed', {
        phase: 'voting',
        nightCount: result.room.nightCount,
        room: game.getRoomPublicData(code)
      });
      startVotingTimer(code);
    }, Math.max(0, endsAt - Date.now()));
    morningTimers.set(code, timer);
    emitTimerStart(code, 'morning', 120, endsAt);
  }
}

function resolveVotingPhase(code) {
  clearAllTimers(code);
  const result = game.resolveVotes(code);
  if (!result) return;

  io.to(code).emit('vote-result', {
    message: result.message,
    voteCounts: result.voteCounts,
    eliminated: result.eliminated,
    room: game.getRoomPublicData(code)
  });

  if (result.winner) {
    const allPlayers = game.getAllPlayersWithRoles(code);
    io.to(code).emit('game-over', {
      winner: result.winner,
      players: allPlayers
    });
    clearAllTimers(code);
  } else {
    const endsAt = Date.now() + 8000;
    setTimeout(() => {
      const room = game.getRoom(code);
      if (!room || room.state !== 'night') return;
      io.to(code).emit('phase-changed', {
        phase: 'night',
        nightCount: room.nightCount,
        room: game.getRoomPublicData(code)
      });
      startNightTimer(code);
    }, Math.max(0, endsAt - Date.now()));
    emitTimerStart(code, 'vote-result', 8, endsAt);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Silhouette server running on http://localhost:${PORT}`);
});
