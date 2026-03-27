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
  pingTimeout: 60000,
  pingInterval: 25000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000,
    skipMiddlewares: true,
  },
});

app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

const game = new GameLogic();
const ROLE_REVEAL_DELAY_MS = 6000;

setInterval(() => game.cleanupOldRooms(), 10 * 60 * 1000);

const socketMap = new Map();

function getPlayerChannel(playerId) {
  return `player:${playerId}`;
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('create-room', ({ playerId, username, avatarIndex, colorHex }, callback) => {
    if (!playerId) {
      callback({ success: false, error: 'Missing player session' });
      return;
    }
    const room = game.createRoom(playerId, username, avatarIndex, colorHex);
    if (room.error) {
      callback({ success: false, error: room.error });
      return;
    }
    socketMap.set(socket.id, { code: room.code, playerId });
    socket.join(room.code);
    socket.join(getPlayerChannel(playerId));
    const publicData = game.getRoomPublicData(room.code);
    callback({ success: true, room: publicData, playerId });
  });

  socket.on('join-room', ({ code, playerId, username, avatarIndex, colorHex }, callback) => {
    if (!playerId) {
      callback({ success: false, error: 'Missing player session' });
      return;
    }
    const normalizedCode = code.toUpperCase();
    const result = game.joinRoom(normalizedCode, playerId, username, avatarIndex, colorHex);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    socketMap.set(socket.id, { code: normalizedCode, playerId });
    socket.join(normalizedCode);
    socket.join(getPlayerChannel(playerId));
    const publicData = game.getRoomPublicData(normalizedCode);
    io.to(normalizedCode).emit('room-updated', publicData);
    callback({ success: true, room: publicData, playerId });
  });

  socket.on('rejoin-room', ({ code, playerId, username, avatarIndex, colorHex }, callback) => {
    if (!playerId) {
      callback({ success: false, error: 'Missing player session' });
      return;
    }
    const normalizedCode = code.toUpperCase();
    const result = game.reconnectPlayer(normalizedCode, playerId, username, avatarIndex, colorHex);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }

    socketMap.set(socket.id, { code: normalizedCode, playerId });
    socket.join(normalizedCode);
    socket.join(getPlayerChannel(playerId));

    const publicData = game.getRoomPublicData(normalizedCode);
    io.to(normalizedCode).emit('room-updated', publicData);
    if (result.newHostId) {
      io.to(normalizedCode).emit('host-changed', { newHostId: result.newHostId });
    }
    callback({
      success: true,
      room: publicData,
      player: game.getPlayerData(normalizedCode, playerId),
      playerId,
      assassinChatMessages: game.getAssassinChatMessagesForPlayer(normalizedCode, playerId),
      jailChatMessages: game.getJailChatMessagesForPlayer(normalizedCode, playerId),
      abyssChatMessages: game.getAbyssChatMessagesForPlayer(normalizedCode, playerId),
      allPlayers: publicData.state === 'ended' ? game.getAllPlayersWithRoles(normalizedCode) : null,
      winner: result.room?.winner || null,
      timer: getActiveTimerState(normalizedCode),
    });
  });

  socket.on('leave-room', (callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false });
      return;
    }
    const result = game.leaveRoom(mapping.code, mapping.playerId);
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
    const result = game.startGame(mapping.code, mapping.playerId);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    const revealEndsAt = Date.now() + ROLE_REVEAL_DELAY_MS;
    result.room.roleRevealEndsAt = revealEndsAt;
    for (const [playerId] of result.room.players) {
      const playerData = game.getPlayerData(mapping.code, playerId);
      io.to(getPlayerChannel(playerId)).emit('game-started', {
        player: playerData,
        room: game.getRoomPublicData(mapping.code),
        assassinChatMessages: game.getAssassinChatMessagesForPlayer(mapping.code, playerId),
        jailChatMessages: game.getJailChatMessagesForPlayer(mapping.code, playerId),
        abyssChatMessages: game.getAbyssChatMessagesForPlayer(mapping.code, playerId),
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
    setTimerRecord(roleRevealTimers, mapping.code, revealTimer, 'role-reveal', revealEndsAt);
    callback({ success: true });
  });

  socket.on('return-to-lobby', (callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    clearAllTimers(mapping.code);
    const result = game.returnRoomToLobby(mapping.code, mapping.playerId);
    if (result.error) {
      if (callback) callback({ success: false, error: result.error });
      return;
    }

    const publicData = game.getRoomPublicData(mapping.code);
    io.to(mapping.code).emit('game-reset', { room: publicData });
    if (result.newHostId) {
      io.to(mapping.code).emit('host-changed', { newHostId: result.newHostId });
    }

    if (callback) callback({ success: true, room: publicData, newHostId: result.newHostId || publicData.hostId });
  });

  socket.on('update-room-settings', ({ anonymousVotes, anonymousEjects, anonymousKills, hiddenRoleList, disableVillagerRole, enableTraitor, useClassicFivePlayerSetup, sheriffKillsCrewTarget, sheriffKillsNeutralEvil, officerKillsNeutralEvil }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = game.updateRoomSettings(mapping.code, mapping.playerId, { anonymousVotes, anonymousEjects, anonymousKills, hiddenRoleList, disableVillagerRole, enableTraitor, useClassicFivePlayerSetup, sheriffKillsCrewTarget, sheriffKillsNeutralEvil, officerKillsNeutralEvil });
    if (result.error) {
      if (callback) callback({ success: false, error: result.error });
      return;
    }

    const publicData = game.getRoomPublicData(mapping.code);
    io.to(mapping.code).emit('room-updated', publicData);
    if (callback) callback({ success: true, room: publicData });
  });

  socket.on('night-action', ({ action, targetId, targetIds }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }
    const result = game.submitNightAction(mapping.code, mapping.playerId, action, targetId, targetIds);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    const room = game.getRoom(mapping.code);
    const publicNightMessage = game.getNightActionSummaryLine(mapping.code, action, mapping.playerId);
    if (publicNightMessage) {
      const chatMessage = game.appendToPhaseSummary(mapping.code, publicNightMessage);
      if (chatMessage) io.to(mapping.code).emit('chat-message-updated', { message: chatMessage });
    }
    const playerData = game.getPlayerData(mapping.code, mapping.playerId);
    socket.emit('player-updated', {
      player: playerData,
      assassinChatMessages: game.getAssassinChatMessagesForPlayer(mapping.code, mapping.playerId),
      jailChatMessages: game.getJailChatMessagesForPlayer(mapping.code, mapping.playerId),
      abyssChatMessages: game.getAbyssChatMessagesForPlayer(mapping.code, mapping.playerId),
    });
    if (result.immediateJailTargetId) {
      const publicData = game.getRoomPublicData(mapping.code);
      io.to(mapping.code).emit('room-updated', publicData);
      const jailedPlayerData = game.getPlayerData(mapping.code, result.immediateJailTargetId);
      io.to(getPlayerChannel(result.immediateJailTargetId)).emit('player-updated', {
        player: jailedPlayerData,
        assassinChatMessages: game.getAssassinChatMessagesForPlayer(mapping.code, result.immediateJailTargetId),
        jailChatMessages: game.getJailChatMessagesForPlayer(mapping.code, result.immediateJailTargetId),
        abyssChatMessages: game.getAbyssChatMessagesForPlayer(mapping.code, result.immediateJailTargetId),
      });
    }
    if (result.immediateAbyssActivated) {
      const currentRoom = game.getRoom(mapping.code);
      if (currentRoom) {
        for (const [otherPlayerId, otherPlayer] of currentRoom.players) {
          if (otherPlayerId === mapping.playerId) continue;
          if (otherPlayer.alive && otherPlayerId !== currentRoom.abyssActiveMediumId) continue;
          io.to(getPlayerChannel(otherPlayerId)).emit('player-updated', {
            player: game.getPlayerData(mapping.code, otherPlayerId),
            assassinChatMessages: game.getAssassinChatMessagesForPlayer(mapping.code, otherPlayerId),
            jailChatMessages: game.getJailChatMessagesForPlayer(mapping.code, otherPlayerId),
            abyssChatMessages: game.getAbyssChatMessagesForPlayer(mapping.code, otherPlayerId),
          });
        }
      }
    }
    if (result.immediateAlturistRevive) {
      const publicData = game.getRoomPublicData(mapping.code);
      io.to(mapping.code).emit('room-updated', publicData);
      if (result.revivedPlayerId) {
        const revivedPlayerData = game.getPlayerData(mapping.code, result.revivedPlayerId);
        io.to(getPlayerChannel(result.revivedPlayerId)).emit('player-updated', {
          player: revivedPlayerData,
          assassinChatMessages: game.getAssassinChatMessagesForPlayer(mapping.code, result.revivedPlayerId),
          jailChatMessages: game.getJailChatMessagesForPlayer(mapping.code, result.revivedPlayerId),
          abyssChatMessages: game.getAbyssChatMessagesForPlayer(mapping.code, result.revivedPlayerId),
        });
      }
    }
    callback({ success: true, player: playerData });
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
    const result = game.skipNightAction(mapping.code, mapping.playerId);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    const playerData = game.getPlayerData(mapping.code, mapping.playerId);
    socket.emit('player-updated', {
      player: playerData,
      assassinChatMessages: game.getAssassinChatMessagesForPlayer(mapping.code, mapping.playerId),
      jailChatMessages: game.getJailChatMessagesForPlayer(mapping.code, mapping.playerId),
      abyssChatMessages: game.getAbyssChatMessagesForPlayer(mapping.code, mapping.playerId),
    });
    if (result.immediateReleasedTargetId) {
      const publicData = game.getRoomPublicData(mapping.code);
      io.to(mapping.code).emit('room-updated', publicData);
      const releasedPlayerData = game.getPlayerData(mapping.code, result.immediateReleasedTargetId);
      io.to(getPlayerChannel(result.immediateReleasedTargetId)).emit('player-updated', {
        player: releasedPlayerData,
        assassinChatMessages: game.getAssassinChatMessagesForPlayer(mapping.code, result.immediateReleasedTargetId),
        jailChatMessages: game.getJailChatMessagesForPlayer(mapping.code, result.immediateReleasedTargetId),
        abyssChatMessages: game.getAbyssChatMessagesForPlayer(mapping.code, result.immediateReleasedTargetId),
      });
    }
    callback({ success: true, player: playerData });
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
    const result = game.submitVote(mapping.code, mapping.playerId, targetId);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    const room = game.getRoom(mapping.code);
    if (room && !room.anonymousVotes) {
      const voter = room.players.get(mapping.playerId);
      let voteText = `${voter.name} skipped their vote.`;
      if (targetId !== 'skip') {
        const target = room.players.get(targetId);
        voteText = `${voter.name} voted for ${target.name}.`;
      }
      const chatMessage = game.appendToPhaseSummary(mapping.code, voteText);
      if (chatMessage) io.to(mapping.code).emit('chat-message-updated', { message: chatMessage });
    }
    const playerData = game.getPlayerData(mapping.code, mapping.playerId);
    socket.emit('player-updated', {
      player: playerData,
      assassinChatMessages: game.getAssassinChatMessagesForPlayer(mapping.code, mapping.playerId),
      jailChatMessages: game.getJailChatMessagesForPlayer(mapping.code, mapping.playerId),
      abyssChatMessages: game.getAbyssChatMessagesForPlayer(mapping.code, mapping.playerId),
    });
    io.to(mapping.code).emit('vote-update', {
      voterId: mapping.playerId,
      voterName: game.getRoom(mapping.code).players.get(mapping.playerId).name,
      votesCast: game.getSubmittedVoteCount(mapping.code),
      totalAlive: game.getEligibleVoterCount(mapping.code)
    });
    callback({ success: true, player: playerData, room: game.getRoomPublicData(mapping.code) });
    if (game.checkAllVotesSubmitted(mapping.code)) {
      resolveVotingPhase(mapping.code);
    }
  });

  socket.on('voting-action', ({ action, targetId, targetIds }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = game.submitVotingAbility(mapping.code, mapping.playerId, action, targetId, targetIds);
    if (result.error) {
      if (callback) callback({ success: false, error: result.error });
      return;
    }

    const playerData = game.getPlayerData(mapping.code, mapping.playerId);
    const publicData = game.getRoomPublicData(mapping.code);
    socket.emit('player-updated', {
      player: playerData,
      assassinChatMessages: game.getAssassinChatMessagesForPlayer(mapping.code, mapping.playerId),
      jailChatMessages: game.getJailChatMessagesForPlayer(mapping.code, mapping.playerId),
      abyssChatMessages: game.getAbyssChatMessagesForPlayer(mapping.code, mapping.playerId),
    });
    io.to(mapping.code).emit('room-updated', publicData);
    if (callback) callback({ success: true, player: playerData, room: publicData });
    if (result.resolveNow) {
      resolveVotingPhase(mapping.code);
    }
  });

  socket.on('request-player-data', (callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      callback({ success: false });
      return;
    }
    const playerData = game.getPlayerData(mapping.code, mapping.playerId);
    const roomData = game.getRoomPublicData(mapping.code);
    callback({ success: true, player: playerData, room: roomData });
  });

  socket.on('send-chat-message', ({ text }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = game.addChatMessage(mapping.code, mapping.playerId, text);
    if (result.error) {
      if (callback) callback({ success: false, error: result.error });
      return;
    }

    io.to(mapping.code).emit('chat-message', { message: result.message });
    if (callback) callback({ success: true, message: result.message });
  });

  socket.on('send-assassin-chat-message', ({ text }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = game.addAssassinChatMessage(mapping.code, mapping.playerId, text);
    if (result.error) {
      if (callback) callback({ success: false, error: result.error });
      return;
    }

    const room = game.getRoom(mapping.code);
    if (room) {
      for (const [playerId, player] of room.players) {
        if (player.faction !== 'Assassin' || !player.alive) continue;
        io.to(getPlayerChannel(playerId)).emit('assassin-chat-message', { message: result.message });
      }
    }

    if (callback) callback({ success: true, message: result.message });
  });

  socket.on('send-jail-chat-message', ({ text }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = game.addJailChatMessage(mapping.code, mapping.playerId, text);
    if (result.error) {
      if (callback) callback({ success: false, error: result.error });
      return;
    }

    const room = game.getRoom(mapping.code);
    if (room?.jailedPlayerId) {
      io.to(getPlayerChannel(room.jailedPlayerId)).emit('jail-chat-message', { message: result.message });
    }
    if (room?.jailedOfficerId) {
      io.to(getPlayerChannel(room.jailedOfficerId)).emit('jail-chat-message', { message: result.message });
    }

    if (callback) callback({ success: true, message: result.message });
  });

  socket.on('send-abyss-chat-message', ({ text }, callback) => {
    const mapping = socketMap.get(socket.id);
    if (!mapping) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = game.addAbyssChatMessage(mapping.code, mapping.playerId, text);
    if (result.error) {
      if (callback) callback({ success: false, error: result.error });
      return;
    }

    const room = game.getRoom(mapping.code);
    if (room?.abyssActiveMediumId) {
      io.to(getPlayerChannel(room.abyssActiveMediumId)).emit('abyss-chat-message', { message: result.message });
      for (const [playerId, player] of room.players) {
        if (player.alive) continue;
        io.to(getPlayerChannel(playerId)).emit('abyss-chat-message', { message: result.message });
      }
    }

    if (callback) callback({ success: true, message: result.message });
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    const mapping = socketMap.get(socket.id);
    if (mapping) {
      const room = game.getRoom(mapping.code);
      if (room) {
        if (room.state === 'lobby') {
          const result = game.leaveRoom(mapping.code, mapping.playerId);
          if (result && !result.deleted) {
            const publicData = game.getRoomPublicData(mapping.code);
            io.to(mapping.code).emit('room-updated', publicData);
            if (result.newHostId) {
              io.to(mapping.code).emit('host-changed', { newHostId: result.newHostId });
            }
          }
        } else {
  const disconnectResult = game.disconnectPlayer(mapping.code, mapping.playerId);
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

function setTimerRecord(map, code, timeout, phase, endsAt) {
  map.set(code, { timeout, phase, endsAt });
}

function getActiveTimerState(code) {
  const sources = [roleRevealTimers, nightTimers, morningTimers, votingTimers];
  for (const source of sources) {
    const record = source.get(code);
    if (record) {
      return {
        phase: record.phase,
        endsAt: record.endsAt,
      };
    }
  }
  return null;
}

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
      if (player.role === 'Jester') continue;
      if (!room.nightActions[id]) {
        game.skipNightAction(code, id);
      }
    }
    resolveNightPhase(code);
  }, Math.max(0, endsAt - Date.now()));
  setTimerRecord(nightTimers, code, timer, 'night', endsAt);
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
      const voteState = room.votes[id];
      const finalized = voteState && typeof voteState === 'object' ? !!voteState.finalized : !!voteState;
      if (!finalized) {
        game.submitVote(code, id, 'skip');
      }
    }
    resolveVotingPhase(code);
  }, Math.max(0, endsAt - Date.now()));
  setTimerRecord(votingTimers, code, timer, 'voting', endsAt);
  emitTimerStart(code, 'voting', 60, endsAt);
}

function clearAllTimers(code) {
  if (roleRevealTimers.has(code)) {
    clearTimeout(roleRevealTimers.get(code).timeout);
    roleRevealTimers.delete(code);
  }
  if (nightTimers.has(code)) {
    clearTimeout(nightTimers.get(code).timeout);
    nightTimers.delete(code);
  }
  if (votingTimers.has(code)) {
    clearTimeout(votingTimers.get(code).timeout);
    votingTimers.delete(code);
  }
  if (morningTimers.has(code)) {
    clearTimeout(morningTimers.get(code).timeout);
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
        io.to(getPlayerChannel(playerId)).emit('private-chat-message', { message });
      });
    }
  }

  if (result.traitorConvertedPlayerId) {
    const convertedPlayerId = result.traitorConvertedPlayerId;
    io.to(getPlayerChannel(convertedPlayerId)).emit('player-updated', {
      player: game.getPlayerData(code, convertedPlayerId),
      assassinChatMessages: game.getAssassinChatMessagesForPlayer(code, convertedPlayerId),
      jailChatMessages: game.getJailChatMessagesForPlayer(code, convertedPlayerId),
      abyssChatMessages: game.getAbyssChatMessagesForPlayer(code, convertedPlayerId),
    });
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
    setTimerRecord(morningTimers, code, timer, 'morning', endsAt);
    emitTimerStart(code, 'morning', 120, endsAt);
  }
}

function resolveVotingPhase(code) {
  clearAllTimers(code);
  const result = game.resolveVotes(code);
  if (!result) return;

  if (result.winner?.winner === 'Jester') {
    const allPlayers = game.getAllPlayersWithRoles(code);
    io.to(code).emit('game-over', {
      winner: result.winner,
      players: allPlayers
    });
    clearAllTimers(code);
    return;
  }

  io.to(code).emit('vote-result', {
    message: result.message,
    voteCounts: result.voteCounts,
    eliminated: result.eliminated,
    room: game.getRoomPublicData(code)
  });

  if (result.traitorConvertedPlayerId) {
    const convertedPlayerId = result.traitorConvertedPlayerId;
    io.to(getPlayerChannel(convertedPlayerId)).emit('player-updated', {
      player: game.getPlayerData(code, convertedPlayerId),
      assassinChatMessages: game.getAssassinChatMessagesForPlayer(code, convertedPlayerId),
      jailChatMessages: game.getJailChatMessagesForPlayer(code, convertedPlayerId),
      abyssChatMessages: game.getAbyssChatMessagesForPlayer(code, convertedPlayerId),
    });
  }

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
