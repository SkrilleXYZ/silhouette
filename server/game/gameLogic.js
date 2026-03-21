class GameLogic {
  constructor() {
    this.rooms = new Map();
  }

  generateRoomCode() {
    let code;
    do {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      code = code.replace(/[^A-Z0-9]/g, '');
      while (code.length < 6) {
        code += Math.random().toString(36).substring(2, 3).toUpperCase();
      }
      code = code.substring(0, 6);
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostId, hostName) {
    const code = this.generateRoomCode();
    const room = {
      code,
      hostId,
      players: new Map(),
      state: 'lobby',
      phase: 0,
      nightActions: {},
      votes: {},
      nightResults: [],
      eliminatedToday: null,
      winner: null,
      nightCount: 0,
      votingTimer: null,
      nightTimer: null,
      morningMessages: [],
      chatMessages: [],
      playerOrder: [],
      lastAction: Date.now(),
      lastMedicTarget: null,
    };

    room.players.set(hostId, {
      id: hostId,
      name: hostName,
      role: null,
      faction: null,
      alive: true,
      connected: true
    });

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code, playerId, playerName) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.state !== 'lobby') return { error: 'Game already in progress' };
    if (room.players.size >= 15) return { error: 'Room is full' };

    for (const [, player] of room.players) {
      if (player.name.toLowerCase() === playerName.toLowerCase()) {
        return { error: 'Username already taken in this room' };
      }
    }

    room.players.set(playerId, {
      id: playerId,
      name: playerName,
      role: null,
      faction: null,
      alive: true,
      connected: true
    });

    return { room };
  }

  leaveRoom(code, playerId) {
    const room = this.rooms.get(code);
    if (!room) return null;

    room.players.delete(playerId);

    if (room.hostId === playerId) {
      if (room.players.size > 0) {
        const newHost = room.players.keys().next().value;
        room.hostId = newHost;
      } else {
        this.rooms.delete(code);
        return { deleted: true };
      }
    }

    return { room, newHostId: room.hostId };
  }

  disconnectPlayer(code, playerId) {
    const room = this.rooms.get(code);
    if (!room) return null;

    if (room.state === 'lobby') {
      return this.leaveRoom(code, playerId);
    }

    const player = room.players.get(playerId);
    if (!player) return { room };

    player.connected = false;
    if (player.alive) {
      player.alive = false;

      const winCheck = this.checkWinCondition(code);
      if (winCheck && room.state !== 'ended') {
        room.state = 'ended';
        room.winner = winCheck;
        return { room, winner: winCheck };
      }
    }

    return { room };
  }

  assignRoles(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const playerIds = Array.from(room.players.keys());
    const count = playerIds.length;

    let assassinCount;
    if (count <= 6) assassinCount = 1;
    else if (count <= 9) assassinCount = 2;
    else if (count <= 12) assassinCount = 3;
    else assassinCount = 4;

    const shuffled = [...playerIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let index = 0;

    for (let i = 0; i < assassinCount; i++) {
      const player = room.players.get(shuffled[index]);
      player.role = 'Agent';
      player.faction = 'Assassin';
      index++;
    }

    const sheriff = room.players.get(shuffled[index]);
    sheriff.role = 'Sheriff';
    sheriff.faction = 'Crew';
    index++;

    const medic = room.players.get(shuffled[index]);
    medic.role = 'Medic';
    medic.faction = 'Crew';
    index++;

    while (index < shuffled.length) {
      const player = room.players.get(shuffled[index]);
      player.role = 'Villager';
      player.faction = 'Crew';
      index++;
    }

    room.playerOrder = shuffled;
    return room;
  }

  startGame(code, requesterId) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== requesterId) return { error: 'Only the host can start the game' };
    if (room.players.size < 5) return { error: 'Need at least 5 players' };

    this.assignRoles(code);
    room.state = 'night';
    room.nightCount = 1;
    room.nightActions = {};
    room.morningMessages = [];
    room.chatMessages = [];
    room.lastMedicTarget = null;

    this.addSystemChatMessage(code, 'Night 1 has begun. Chat is locked until morning.');

    return { room };
  }

  resetRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };

    for (const [, player] of room.players) {
      player.role = null;
      player.faction = null;
      player.alive = true;
      player.connected = true;
    }

    room.state = 'lobby';
    room.phase = 0;
    room.nightActions = {};
    room.votes = {};
    room.nightResults = [];
    room.eliminatedToday = null;
    room.winner = null;
    room.nightCount = 0;
    room.morningMessages = [];
    room.chatMessages = [];
    room.playerOrder = [];
    room.lastAction = Date.now();
    room.lastMedicTarget = null;

    return { room };
  }

  submitNightAction(code, playerId, action, targetId) {
    const room = this.rooms.get(code);
    if (!room || room.state !== 'night') return { error: 'Not in night phase' };

    const player = room.players.get(playerId);
    if (!player || !player.alive) return { error: 'Invalid player' };

    const target = room.players.get(targetId);
    if (!target || !target.alive) return { error: 'Invalid target' };

    if (player.role === 'Sheriff') {
      if (action !== 'shoot' && action !== 'search') return { error: 'Invalid action for Sheriff' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else if (player.role === 'Medic') {
      if (action !== 'protect') return { error: 'Invalid action for Medic' };
      // Cannot protect the same player twice in a row
      if (targetId === room.lastMedicTarget) {
        return { error: 'You cannot protect the same player two nights in a row' };
      }
    } else if (player.role === 'Agent') {
      if (action !== 'kill') return { error: 'Invalid action for Agent' };
      if (target.faction === 'Assassin') return { error: 'Cannot kill teammates' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else {
      return { error: 'You have no night abilities' };
    }

    room.nightActions[playerId] = { action, targetId };

    return { success: true, room };
  }

  skipNightAction(code, playerId) {
    const room = this.rooms.get(code);
    if (!room || room.state !== 'night') return { error: 'Not in night phase' };

    const player = room.players.get(playerId);
    if (!player || !player.alive) return { error: 'Invalid player' };

    room.nightActions[playerId] = { action: 'skip', targetId: null };
    return { success: true, room };
  }

  checkAllNightActionsSubmitted(code) {
    const room = this.rooms.get(code);
    if (!room) return false;

    for (const [id, player] of room.players) {
      if (!player.alive) continue;
      if (player.role === 'Villager') continue;
      if (!room.nightActions[id]) return false;
    }
    return true;
  }

  resolveNight(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const messages = [];
    const killed = new Set();
    const protected_ = new Set();
    const searchResults = {};

    // Track who the medic protected this night
    let medicTargetThisNight = null;

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player) continue;
      if (action.action === 'protect' && action.targetId) {
        protected_.add(action.targetId);
        medicTargetThisNight = action.targetId;
      }
    }

    // Update lastMedicTarget for next night
    if (medicTargetThisNight !== null) {
      room.lastMedicTarget = medicTargetThisNight;
    } else {
      // If medic skipped, clear the restriction so they can protect anyone next night
      room.lastMedicTarget = null;
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player) continue;

      if (action.action === 'kill' && player.role === 'Agent' && action.targetId) {
        if (!protected_.has(action.targetId)) {
          killed.add(action.targetId);
        } else {
          messages.push({
            type: 'protected',
            text: 'Someone was saved by the Medic during the night.',
            public: true
          });
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player || player.role !== 'Sheriff') continue;

      if (action.action === 'shoot' && action.targetId) {
        if (!protected_.has(action.targetId)) {
          killed.add(action.targetId);
        } else {
          messages.push({
            type: 'protected',
            text: 'Someone was saved by the Medic during the night.',
            public: true
          });
        }
      } else if (action.action === 'search' && action.targetId) {
        const target = room.players.get(action.targetId);
        searchResults[playerId] = {
          targetId: action.targetId,
          targetName: target.name,
          role: target.role,
          faction: target.faction
        };
      }
    }

    for (const deadId of killed) {
      const deadPlayer = room.players.get(deadId);
      if (deadPlayer) {
        deadPlayer.alive = false;
        messages.push({
          type: 'death',
          text: `${deadPlayer.name} was found dead. They were a ${deadPlayer.role}.`,
          playerId: deadId,
          role: deadPlayer.role,
          faction: deadPlayer.faction,
          public: true
        });
      }
    }

    if (killed.size === 0 && messages.length === 0) {
      messages.push({
        type: 'peaceful',
        text: 'The night passed peacefully. No one was harmed.',
        public: true
      });
    }

    room.morningMessages = messages;
    this.addSystemChatMessage(code, `Morning ${room.nightCount} begins.`);
    messages.forEach((msg) => {
      if (msg.public) this.addSystemChatMessage(code, msg.text);
    });
    const alivePlayers = Array.from(room.players.values()).filter(p => p.alive).map(p => p.name);
    this.addSystemChatMessage(code, `Alive: ${alivePlayers.join(', ') || 'No one'}.`);
    room.searchResults = searchResults;
    room.nightActions = {};
    room.state = 'morning';

    const winCheck = this.checkWinCondition(code);
    if (winCheck) {
      room.state = 'ended';
      room.winner = winCheck;
    }

    return { room, messages, searchResults, winner: room.winner };
  }

  submitVote(code, voterId, targetId) {
    const room = this.rooms.get(code);
    if (!room || room.state !== 'voting') return { error: 'Not in voting phase' };

    const voter = room.players.get(voterId);
    if (!voter || !voter.alive) return { error: 'Invalid voter' };

    if (targetId !== 'skip') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (targetId === voterId) return { error: 'Cannot vote for yourself' };
    }

    room.votes[voterId] = targetId;

    return { success: true, room };
  }

  checkAllVotesSubmitted(code) {
    const room = this.rooms.get(code);
    if (!room) return false;

    for (const [id, player] of room.players) {
      if (!player.alive) continue;
      if (!room.votes[id]) return false;
    }
    return true;
  }

  resolveVotes(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const voteCounts = {};
    let skipVotes = 0;

    for (const [, targetId] of Object.entries(room.votes)) {
      if (targetId === 'skip') {
        skipVotes++;
      } else {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      }
    }

    let maxVotes = 0;
    let eliminated = null;
    let isTie = false;

    for (const [playerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = playerId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    }

    if (skipVotes >= maxVotes) {
      eliminated = null;
      isTie = false;
    }

    let message;
    if (isTie) {
      message = {
        type: 'tie',
        text: 'The vote resulted in a tie. No one was eliminated.',
        public: true
      };
      eliminated = null;
    } else if (!eliminated) {
      message = {
        type: 'skip',
        text: 'The town decided to skip the vote. No one was eliminated.',
        public: true
      };
    } else {
      const player = room.players.get(eliminated);
      player.alive = false;
      message = {
        type: 'eliminated',
        text: `${player.name} was eliminated by vote. They were a ${player.role}.`,
        playerId: eliminated,
        role: player.role,
        faction: player.faction,
        public: true
      };
    }

    room.eliminatedToday = eliminated;
    room.votes = {};
    this.addSystemChatMessage(code, message.text);

    const winCheck = this.checkWinCondition(code);
    if (winCheck) {
      room.state = 'ended';
      room.winner = winCheck;
    } else {
      room.state = 'night';
      room.nightCount++;
      room.nightActions = {};
      this.addSystemChatMessage(code, `Night ${room.nightCount} begins. Chat is locked until morning.`);
    }

    return {
      room,
      message,
      voteCounts,
      eliminated,
      winner: room.winner
    };
  }

  startVoting(code) {
    const room = this.rooms.get(code);
    if (!room) return null;
    room.state = 'voting';
    room.votes = {};
    return room;
  }

  checkWinCondition(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    let aliveCrewCount = 0;
    let aliveAssassinCount = 0;

    for (const [, player] of room.players) {
      if (!player.alive) continue;
      if (player.faction === 'Crew') aliveCrewCount++;
      else if (player.faction === 'Assassin') aliveAssassinCount++;
    }

    if (aliveAssassinCount === 0) {
      return { winner: 'Crew', reason: 'All Assassins have been eliminated!' };
    }

    if (aliveAssassinCount >= aliveCrewCount) {
      return { winner: 'Assassin', reason: 'Assassins have taken control!' };
    }

    return null;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  getRoomPublicData(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const players = [];
    for (const [id, player] of room.players) {
      players.push({
        id,
        name: player.name,
        alive: player.alive,
        connected: player.connected,
        isHost: id === room.hostId,
        role: player.role,
        faction: player.faction,
      });
    }

    return {
      code: room.code,
      hostId: room.hostId,
      players,
      state: room.state,
      nightCount: room.nightCount,
      playerCount: room.players.size,
      aliveCount: players.filter(p => p.alive).length,
      chatMessages: room.chatMessages.slice(-150),
    };
  }

  addSystemChatMessage(code, text) {
    const room = this.rooms.get(code);
    if (!room || !text) return null;

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'system',
      senderId: null,
      senderName: 'SYSTEM',
      text,
      createdAt: Date.now(),
      phase: room.state,
    };

    room.chatMessages.push(message);
    if (room.chatMessages.length > 150) room.chatMessages = room.chatMessages.slice(-150);
    room.lastAction = Date.now();
    return message;
  }

  addChatMessage(code, playerId, text) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.state !== 'morning' && room.state !== 'voting') {
      return { error: 'Chat is only available during morning and voting' };
    }

    const player = room.players.get(playerId);
    if (!player) return { error: 'Player not found' };

    const cleanText = String(text || '').trim().replace(/\s+/g, ' ');
    if (!cleanText) return { error: 'Message cannot be empty' };
    if (cleanText.length > 280) return { error: 'Message is too long' };

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'player',
      senderId: playerId,
      senderName: player.name,
      text: cleanText,
      createdAt: Date.now(),
      phase: room.state,
    };

    room.chatMessages.push(message);
    if (room.chatMessages.length > 150) room.chatMessages = room.chatMessages.slice(-150);
    room.lastAction = Date.now();

    return { success: true, message };
  }

  getPlayerData(code, playerId) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const player = room.players.get(playerId);
    if (!player) return null;

    let teammates = [];
    if (player.faction === 'Assassin' && room.state !== 'lobby') {
      for (const [id, p] of room.players) {
        if (id !== playerId && p.faction === 'Assassin') {
          teammates.push({ id, name: p.name, alive: p.alive });
        }
      }
    }

    return {
      ...player,
      teammates,
      hasSubmittedAction: !!room.nightActions[playerId],
      hasVoted: !!room.votes[playerId],
      lastMedicTarget: player.role === 'Medic' ? room.lastMedicTarget : null,
    };
  }

  getAlivePlayers(code) {
    const room = this.rooms.get(code);
    if (!room) return [];

    const players = [];
    for (const [id, player] of room.players) {
      if (player.alive) {
        players.push({ id, name: player.name });
      }
    }
    return players;
  }

  getAllPlayersWithRoles(code) {
    const room = this.rooms.get(code);
    if (!room) return [];

    const players = [];
    for (const [id, player] of room.players) {
      players.push({
        id,
        name: player.name,
        role: player.role,
        faction: player.faction,
        alive: player.alive
      });
    }
    return players;
  }

  cleanupOldRooms() {
    const now = Date.now();
    const timeout = 30 * 60 * 1000;
    for (const [code, room] of this.rooms) {
      if (now - room.lastAction > timeout) {
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = GameLogic;
