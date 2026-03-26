class GameLogic {
  constructor() {
    this.rooms = new Map();
    this.avatarCount = 24;
    this.roleCatalog = {
      Crew: {
        Info: ['Villager', 'Investigator', 'Tracker', 'Stalker', 'Redflag', 'Traplord'],
        Protection: ['Vitalist', 'Mirror Caster', 'Warden', 'Oracle'],
        Killing: ['Sheriff', 'Veteran'],
        Chaos: ['Teleporter', 'Swapper', 'Magician', 'Scientist', 'Silencer'],
        Unbound: ['Narcissist', 'Inquisitor', 'Alturist', 'The Vessel', 'Karma'],
      },
      Assassin: {
        Power: ['Assassin', 'Sniper', 'Tetherhex'],
        Concealing: ['Hypnotic', 'Blackout', 'Blackmailer', 'The Purge'],
        Support: ['Disruptor', 'Manipulator', 'Prophet'],
      },
      Neutral: {
        Evil: ['Jester', 'Executioner'],
        Benign: ['Amnesiac', 'Guardian Angel', 'Survivalist', 'Imitator'],
        Killing: ['Overload', 'Arsonist', 'Wither'],
      },
    };
  }

  normalizePlayerName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
  }

  sanitizeAvatarIndex(avatarIndex) {
    return Number.isInteger(avatarIndex) && avatarIndex >= 0
      ? avatarIndex % this.avatarCount
      : this.assignAvatarIndex({ players: new Map() });
  }

  sanitizePlayerColorHex(colorHex) {
    const normalized = String(colorHex || '').trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) return null;
    return normalized.toUpperCase();
  }

  resolveUniquePlayerName(room, requestedName) {
    const baseName = this.normalizePlayerName(requestedName);
    if (!baseName) return '';

    const takenNames = new Set();
    for (const [, player] of room.players) {
      takenNames.add(player.name.toLowerCase());
    }

    if (!takenNames.has(baseName.toLowerCase())) return baseName;

    let suffix = 2;
    while (true) {
      const suffixText = `-${suffix}`;
      const stem = baseName.slice(0, Math.max(1, 16 - suffixText.length));
      const candidate = `${stem}${suffixText}`;
      if (!takenNames.has(candidate.toLowerCase())) return candidate;
      suffix++;
    }
  }

  assignAvatarIndex(room) {
    const usedIndexes = new Set();
    for (const [, player] of room.players) {
      if (Number.isInteger(player.avatarIndex)) usedIndexes.add(player.avatarIndex);
    }

    const availableIndexes = [];
    for (let index = 0; index < this.avatarCount; index++) {
      if (!usedIndexes.has(index)) availableIndexes.push(index);
    }

    if (availableIndexes.length) {
      return availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    }

    return Math.floor(Math.random() * this.avatarCount);
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

  createRoom(hostId, hostName, avatarIndex = null, colorHex = null) {
    const code = this.generateRoomCode();
    const room = {
      code,
      hostId,
      creatorHostId: hostId,
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
      assassinChatMessages: [],
      currentPhaseSummaryId: null,
      anonymousVotes: false,
      anonymousEjects: false,
      hiddenRoleList: false,
      disableVillagerRole: false,
      useClassicFivePlayerSetup: false,
      sheriffKillsCrewTarget: false,
      sheriffKillsNeutralEvil: false,
      playerOrder: [],
      lastAction: Date.now(),
      lastMedicTarget: null,
      lastWardenTargets: {},
      lastMagicianTargets: {},
      lastMirrorTargets: {},
      lastInvestigatorTargets: {},
      lastTrackerTargets: {},
      lastStalkerTargets: {},
      lastTetherhexTargets: {},
      lastSilencerTargets: {},
      lastHypnoticTargets: {},
      lastOverloadTargets: {},
      lastBlackoutFlashNight: {},
      blackmailedPlayers: {},
      silencedPlayers: {},
      recentKillers: [],
      pendingLongshots: [],
      roleRevealEndsAt: 0,
    };

    const normalizedHostName = this.normalizePlayerName(hostName);
    if (normalizedHostName.length < 2) return { error: 'Name must be at least 2 characters' };

    room.players.set(hostId, {
      id: hostId,
      name: normalizedHostName,
      avatarIndex: Number.isInteger(avatarIndex) ? this.sanitizeAvatarIndex(avatarIndex) : this.assignAvatarIndex(room),
      colorHex: this.sanitizePlayerColorHex(colorHex),
      role: null,
      faction: null,
      veteranUsesRemaining: 4,
      mirrorUsesRemaining: 4,
      guardianAngelUsesRemaining: 4,
      survivalistUsesRemaining: 4,
      blackoutFlashUsesRemaining: 3,
      purgeFascismUsesRemaining: 1,
      prophetGospelUsesRemaining: 2,
      executionerTargetId: null,
      guardianAngelTargetId: null,
      wardenGuardedTargetId: null,
      oracleEvilEyeUsesRemaining: 3,
      oraclePurifyUsesRemaining: 2,
      oracleMarkedTargetId: null,
      oraclePurifiedTargetId: null,
      inquisitorExiledTargetId: null,
      inquisitorExileUsed: false,
      disruptorVetoUsesRemaining: 1,
      disruptorVetoUsed: false,
      manipulatorSurpriseUsesRemaining: 2,
      manipulatorSurpriseUsed: false,
      alturistReviveTargetId: null,
      scientistExperimentUsesRemaining: 1,
      scientistSwapTargetIds: [],
      vesselAwakened: false,
      arsonistDousedTargetIds: [],
      witherInfected: false,
      imitatorCopiedRole: null,
      imitatorCopiedSourceId: null,
      imitatorCycleTargetIds: [],
      alive: true,
      connected: true
    });

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code, playerId, playerName, avatarIndex = null, colorHex = null) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.state !== 'lobby') return { error: 'Game already in progress' };
    if (room.players.size >= 16) return { error: 'Room is full' };
    const resolvedName = this.resolveUniquePlayerName(room, playerName);
    if (resolvedName.length < 2) return { error: 'Name must be at least 2 characters' };

    room.players.set(playerId, {
      id: playerId,
      name: resolvedName,
      avatarIndex: Number.isInteger(avatarIndex) ? this.sanitizeAvatarIndex(avatarIndex) : this.assignAvatarIndex(room),
      colorHex: this.sanitizePlayerColorHex(colorHex),
      role: null,
      faction: null,
      veteranUsesRemaining: 4,
      mirrorUsesRemaining: 4,
      guardianAngelUsesRemaining: 4,
      survivalistUsesRemaining: 4,
      blackoutFlashUsesRemaining: 3,
      purgeFascismUsesRemaining: 1,
      prophetGospelUsesRemaining: 2,
      executionerTargetId: null,
      guardianAngelTargetId: null,
      wardenGuardedTargetId: null,
      oracleEvilEyeUsesRemaining: 3,
      oraclePurifyUsesRemaining: 2,
      oracleMarkedTargetId: null,
      oraclePurifiedTargetId: null,
      inquisitorExiledTargetId: null,
      inquisitorExileUsed: false,
      disruptorVetoUsesRemaining: 1,
      disruptorVetoUsed: false,
      manipulatorSurpriseUsesRemaining: 2,
      manipulatorSurpriseUsed: false,
      alturistReviveTargetId: null,
      scientistExperimentUsesRemaining: 1,
      scientistSwapTargetIds: [],
      vesselAwakened: false,
      arsonistDousedTargetIds: [],
      witherInfected: false,
      alive: true,
      connected: true
    });

    return { room };
  }

  reconnectPlayer(code, playerId, playerName = null, avatarIndex = null, colorHex = null) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };

    const player = room.players.get(playerId);
    if (!player) return { error: 'Player not found' };

    const normalizedName = this.normalizePlayerName(playerName);
    if (normalizedName.length >= 2) {
      player.name = normalizedName;
    }
    if (Number.isInteger(avatarIndex)) {
      player.avatarIndex = this.sanitizeAvatarIndex(avatarIndex);
    }
    if (colorHex) {
      player.colorHex = this.sanitizePlayerColorHex(colorHex);
    }

    player.connected = true;
    let newHostId = null;
    if (room.state === 'lobby' && room.creatorHostId === playerId && room.hostId !== playerId) {
      room.hostId = playerId;
      newHostId = playerId;
    }
    room.lastAction = Date.now();
    return { room, player, newHostId };
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
    room.lastAction = Date.now();
    return { room };
  }

  pickRandomRole(roles) {
    if (!Array.isArray(roles) || !roles.length) return null;
    return roles[Math.floor(Math.random() * roles.length)];
  }

  getAssignedRoleNames(room) {
    if (!room?.players) return new Set();
    return new Set(
      Array.from(room.players.values())
        .map((player) => player?.role)
        .filter(Boolean)
    );
  }

  getRolePoolForRoom(room, faction, subfaction) {
    const basePool = this.roleCatalog?.[faction]?.[subfaction] || [];
    if (!Array.isArray(basePool)) return [];
    const assignedRoles = this.getAssignedRoleNames(room);
    if (room?.disableVillagerRole && faction === 'Crew' && subfaction === 'Info') {
      return basePool.filter((role) => role !== 'Villager' && !assignedRoles.has(role));
    }
    return basePool.filter((role) => !assignedRoles.has(role));
  }

  pickRoleForSlot(room, faction, subfaction) {
    const pool = this.getRolePoolForRoom(room, faction, subfaction);
    return this.pickRandomRole(pool);
  }

  assignRoleFromSlot(room, playerId, faction, subfaction) {
    const player = room.players.get(playerId);
    if (!player) return false;

    const role = this.pickRoleForSlot(room, faction, subfaction);
    if (!role) return false;

    player.role = role;
    player.faction = faction;
    return true;
  }

  assignRoleFromPool(room, playerId, faction, roles) {
    const player = room.players.get(playerId);
    if (!player) return false;

    const assignedRoles = this.getAssignedRoleNames(room);
    const availableRoles = Array.isArray(roles)
      ? roles.filter((role) => role && !assignedRoles.has(role))
      : [];
    const role = this.pickRandomRole(availableRoles);
    if (!role) return false;

    player.role = role;
    player.faction = faction;
    return true;
  }

  assignSpecificRole(room, playerId, roleName) {
    const player = room.players.get(playerId);
    if (!player) return false;

    for (const [faction, subfactions] of Object.entries(this.roleCatalog || {})) {
      for (const roles of Object.values(subfactions || {})) {
        if (Array.isArray(roles) && roles.includes(roleName)) {
          player.role = roleName;
          player.faction = faction;
          return true;
        }
      }
    }

    return false;
  }

  assignFallbackCrewRole(room, playerId) {
    const fallbackPool = [
      ...this.getRolePoolForRoom(room, 'Crew', 'Info'),
      ...this.getRolePoolForRoom(room, 'Crew', 'Protection'),
      ...this.getRolePoolForRoom(room, 'Crew', 'Killing'),
      ...this.getRolePoolForRoom(room, 'Crew', 'Chaos'),
      ...this.getRolePoolForRoom(room, 'Crew', 'Unbound'),
    ];
    const role = this.pickRandomRole(fallbackPool);
    if (!role) return false;
    const player = room.players.get(playerId);
    if (!player) return false;
    player.role = role;
    player.faction = 'Crew';
    return true;
  }

  assignExecutionerTargets(room) {
    if (!room) return;

    const players = Array.from(room.players.values());
    const restrictAssassinTargets = players.length <= 6;
    const executioners = players.filter((player) => player.role === 'Executioner');

    for (const executioner of executioners) {
      let possibleTargets = players.filter((player) => player.id !== executioner.id);
      if (restrictAssassinTargets) {
        possibleTargets = possibleTargets.filter((player) => player.faction !== 'Assassin');
      }
      if (possibleTargets.length === 0) {
        possibleTargets = players.filter((player) => player.id !== executioner.id);
      }
      const target = this.pickRandomRole(possibleTargets);
      executioner.executionerTargetId = target?.id || null;
    }
  }

  assignGuardianAngelTargets(room) {
    if (!room) return;

    const players = Array.from(room.players.values());
    const guardianAngels = players.filter((player) => player.role === 'Guardian Angel');

    for (const guardianAngel of guardianAngels) {
      let possibleTargets = players.filter((player) => player.id !== guardianAngel.id && player.role !== 'The Vessel');
      if (possibleTargets.length === 0) {
        possibleTargets = players.filter((player) => player.id !== guardianAngel.id);
      }
      const target = this.pickRandomRole(possibleTargets);
      guardianAngel.guardianAngelTargetId = target?.id || null;
    }
  }

  convertExecutionerToAmnesiac(room, playerId) {
    const player = room?.players?.get(playerId);
    if (!player || player.role !== 'Executioner') return false;

    player.role = 'Amnesiac';
    player.faction = 'Neutral';
    player.executionerTargetId = null;
    player.guardianAngelTargetId = null;
    player.wardenGuardedTargetId = null;
    return true;
  }

  convertGuardianAngelToAmnesiac(room, playerId) {
    const player = room?.players?.get(playerId);
    if (!player || player.role !== 'Guardian Angel') return false;

    player.role = 'Amnesiac';
    player.faction = 'Neutral';
    player.guardianAngelTargetId = null;
    player.wardenGuardedTargetId = null;
    return true;
  }

  getEffectiveNightRole(player) {
    if (!player) return null;
    if (player.role === 'Imitator' && player.imitatorCopiedRole) return player.imitatorCopiedRole;
    return player.role;
  }

  canUseNightPublicChat(player) {
    return this.getEffectiveNightRole(player) === 'Inquisitor';
  }

  hasSubmittedAssassinKill(room, excludePlayerId = null) {
    if (!room?.nightActions) return false;
    return Object.entries(room.nightActions).some(([actorId, actionState]) => {
      if (!actionState || actorId === excludePlayerId || (actionState.action !== 'kill' && actionState.action !== 'longshot')) return false;
      const actor = room.players.get(actorId);
      return !!actor && actor.alive && actor.faction === 'Assassin';
    });
  }

  clearImitatorMimic(player) {
    if (!player) return;
    player.imitatorCopiedRole = null;
    player.imitatorCopiedSourceId = null;
  }

  getImitatorAvailableTargetIds(room, playerId) {
    if (!room) return [];
    const player = room.players.get(playerId);
    if (!player || player.role !== 'Imitator') return [];

    const aliveTargetIds = Array.from(room.players.values())
      .filter((candidate) => candidate.alive && candidate.id !== playerId)
      .map((candidate) => candidate.id);
    const cycleTargetIds = Array.isArray(player.imitatorCycleTargetIds) ? player.imitatorCycleTargetIds : [];
    const availableTargetIds = aliveTargetIds.filter((candidateId) => !cycleTargetIds.includes(candidateId));
    return availableTargetIds.length > 0 ? availableTargetIds : aliveTargetIds;
  }

  getImitatorCopiedSource(room, player) {
    if (!room || !player || player.role !== 'Imitator' || !player.imitatorCopiedSourceId) return null;
    return room.players.get(player.imitatorCopiedSourceId) || null;
  }

  getGuardianBlessTargetId(room, player) {
    if (!player) return null;
    if (player.role === 'Guardian Angel') return player.guardianAngelTargetId || null;
    if (player.role === 'Imitator' && player.imitatorCopiedRole === 'Guardian Angel') {
      const sourcePlayer = this.getImitatorCopiedSource(room, player);
      return sourcePlayer?.guardianAngelTargetId || null;
    }
    return null;
  }

  assignNeutralSpecialRole(room, playerId, categories = ['Evil']) {
    const player = room.players.get(playerId);
    if (!player) return false;

    const assignedRoles = this.getAssignedRoleNames(room);
    const pool = categories
      .flatMap((category) => this.roleCatalog?.Neutral?.[category] || [])
      .filter((role) => !assignedRoles.has(role));
    const role = this.pickRandomRole(pool);
    if (!role) return false;

    player.role = role;
    player.faction = 'Neutral';
    return true;
  }

  inheritDeadRole(room, playerId, targetId) {
    const player = room.players.get(playerId);
    const target = room.players.get(targetId);
    if (!player || !target || target.alive) return { error: 'Invalid target' };

    player.role = target.role;
    player.faction = target.faction;
    player.executionerTargetId = target.role === 'Executioner' ? (target.executionerTargetId || null) : null;
    player.guardianAngelTargetId = target.role === 'Guardian Angel' ? (target.guardianAngelTargetId || null) : null;
    player.veteranUsesRemaining = target.role === 'Veteran' ? (target.veteranUsesRemaining ?? 4) : 4;
    player.mirrorUsesRemaining = target.role === 'Mirror Caster' ? (target.mirrorUsesRemaining ?? 4) : 4;
    player.guardianAngelUsesRemaining = target.role === 'Guardian Angel' ? (target.guardianAngelUsesRemaining ?? 4) : 4;
    player.survivalistUsesRemaining = target.role === 'Survivalist' ? (target.survivalistUsesRemaining ?? 4) : 4;
    player.blackoutFlashUsesRemaining = target.role === 'Blackout' ? (target.blackoutFlashUsesRemaining ?? 3) : 3;
    player.purgeFascismUsesRemaining = target.role === 'The Purge' ? (target.purgeFascismUsesRemaining ?? 1) : 1;
    player.prophetGospelUsesRemaining = target.role === 'Prophet' ? (target.prophetGospelUsesRemaining ?? 2) : 2;
    player.inquisitorExileUsed = target.role === 'Inquisitor' ? !!target.inquisitorExileUsed : false;
    player.manipulatorSurpriseUsesRemaining = target.role === 'Manipulator' ? (target.manipulatorSurpriseUsesRemaining ?? 2) : 2;
    player.manipulatorSurpriseUsed = target.role === 'Manipulator' ? !!target.manipulatorSurpriseUsed : false;
    player.arsonistDousedTargetIds = target.role === 'Arsonist' ? (Array.isArray(target.arsonistDousedTargetIds) ? [...target.arsonistDousedTargetIds] : []) : [];

    return { success: true, player };
  }

  getScientistRoleState(player) {
    if (!player) return null;
    return {
      role: player.role,
      faction: player.faction,
      veteranUsesRemaining: player.veteranUsesRemaining ?? 4,
      mirrorUsesRemaining: player.mirrorUsesRemaining ?? 4,
      guardianAngelUsesRemaining: player.guardianAngelUsesRemaining ?? 4,
      survivalistUsesRemaining: player.survivalistUsesRemaining ?? 4,
      blackoutFlashUsesRemaining: player.blackoutFlashUsesRemaining ?? 3,
      purgeFascismUsesRemaining: player.purgeFascismUsesRemaining ?? 1,
      prophetGospelUsesRemaining: player.prophetGospelUsesRemaining ?? 2,
      executionerTargetId: player.executionerTargetId || null,
      guardianAngelTargetId: player.guardianAngelTargetId || null,
      wardenGuardedTargetId: player.wardenGuardedTargetId || null,
      oracleEvilEyeUsesRemaining: player.oracleEvilEyeUsesRemaining ?? 3,
      oraclePurifyUsesRemaining: player.oraclePurifyUsesRemaining ?? 2,
      oracleMarkedTargetId: player.oracleMarkedTargetId || null,
      oraclePurifiedTargetId: player.oraclePurifiedTargetId || null,
      inquisitorExiledTargetId: player.inquisitorExiledTargetId || null,
      inquisitorExileUsed: !!player.inquisitorExileUsed,
      disruptorVetoUsesRemaining: player.disruptorVetoUsesRemaining ?? 1,
      disruptorVetoUsed: !!player.disruptorVetoUsed,
      manipulatorSurpriseUsesRemaining: player.manipulatorSurpriseUsesRemaining ?? 2,
      manipulatorSurpriseUsed: !!player.manipulatorSurpriseUsed,
      alturistReviveTargetId: player.alturistReviveTargetId || null,
      scientistExperimentUsesRemaining: player.scientistExperimentUsesRemaining ?? 1,
      scientistSwapTargetIds: Array.isArray(player.scientistSwapTargetIds) ? [...player.scientistSwapTargetIds] : [],
      swapperSwapTargetIds: Array.isArray(player.swapperSwapTargetIds) ? [...player.swapperSwapTargetIds] : [],
      vesselAwakened: !!player.vesselAwakened,
      arsonistDousedTargetIds: Array.isArray(player.arsonistDousedTargetIds) ? [...player.arsonistDousedTargetIds] : [],
      imitatorCopiedRole: player.imitatorCopiedRole || null,
      imitatorCopiedSourceId: player.imitatorCopiedSourceId || null,
      imitatorCycleTargetIds: Array.isArray(player.imitatorCycleTargetIds) ? [...player.imitatorCycleTargetIds] : [],
    };
  }

  setScientistRoleState(player, roleState) {
    if (!player || !roleState) return;
    Object.assign(player, {
      role: roleState.role,
      faction: roleState.faction,
      veteranUsesRemaining: roleState.veteranUsesRemaining,
      mirrorUsesRemaining: roleState.mirrorUsesRemaining,
      guardianAngelUsesRemaining: roleState.guardianAngelUsesRemaining,
      survivalistUsesRemaining: roleState.survivalistUsesRemaining,
      blackoutFlashUsesRemaining: roleState.blackoutFlashUsesRemaining,
      purgeFascismUsesRemaining: roleState.purgeFascismUsesRemaining,
      prophetGospelUsesRemaining: roleState.prophetGospelUsesRemaining,
      executionerTargetId: roleState.executionerTargetId,
      guardianAngelTargetId: roleState.guardianAngelTargetId,
      wardenGuardedTargetId: roleState.wardenGuardedTargetId,
      oracleEvilEyeUsesRemaining: roleState.oracleEvilEyeUsesRemaining,
      oraclePurifyUsesRemaining: roleState.oraclePurifyUsesRemaining,
      oracleMarkedTargetId: roleState.oracleMarkedTargetId,
      oraclePurifiedTargetId: roleState.oraclePurifiedTargetId,
      inquisitorExiledTargetId: roleState.inquisitorExiledTargetId,
      inquisitorExileUsed: !!roleState.inquisitorExileUsed,
      disruptorVetoUsesRemaining: roleState.disruptorVetoUsesRemaining,
      disruptorVetoUsed: !!roleState.disruptorVetoUsed,
      manipulatorSurpriseUsesRemaining: roleState.manipulatorSurpriseUsesRemaining,
      manipulatorSurpriseUsed: !!roleState.manipulatorSurpriseUsed,
      alturistReviveTargetId: roleState.alturistReviveTargetId,
      scientistExperimentUsesRemaining: roleState.scientistExperimentUsesRemaining,
      scientistSwapTargetIds: Array.isArray(roleState.scientistSwapTargetIds) ? [...roleState.scientistSwapTargetIds] : [],
      swapperSwapTargetIds: Array.isArray(roleState.swapperSwapTargetIds) ? [...roleState.swapperSwapTargetIds] : [],
      vesselAwakened: !!roleState.vesselAwakened,
      arsonistDousedTargetIds: Array.isArray(roleState.arsonistDousedTargetIds) ? [...roleState.arsonistDousedTargetIds] : [],
      imitatorCopiedRole: roleState.imitatorCopiedRole,
      imitatorCopiedSourceId: roleState.imitatorCopiedSourceId,
      imitatorCycleTargetIds: Array.isArray(roleState.imitatorCycleTargetIds) ? [...roleState.imitatorCycleTargetIds] : [],
    });
  }

  swapScientistRolePackages(room, firstPlayerId, secondPlayerId) {
    const firstPlayer = room.players.get(firstPlayerId);
    const secondPlayer = room.players.get(secondPlayerId);
    if (!firstPlayer || !secondPlayer) return false;

    const firstState = this.getScientistRoleState(firstPlayer);
    const secondState = this.getScientistRoleState(secondPlayer);
    this.setScientistRoleState(firstPlayer, secondState);
    this.setScientistRoleState(secondPlayer, firstState);

    const swapRoomMapEntries = (mapObject) => {
      if (!mapObject || typeof mapObject !== 'object') return;
      const firstValue = Object.prototype.hasOwnProperty.call(mapObject, firstPlayerId) ? mapObject[firstPlayerId] : undefined;
      const secondValue = Object.prototype.hasOwnProperty.call(mapObject, secondPlayerId) ? mapObject[secondPlayerId] : undefined;

      if (secondValue === undefined) delete mapObject[firstPlayerId];
      else mapObject[firstPlayerId] = Array.isArray(secondValue) ? [...secondValue] : secondValue;

      if (firstValue === undefined) delete mapObject[secondPlayerId];
      else mapObject[secondPlayerId] = Array.isArray(firstValue) ? [...firstValue] : firstValue;
    };

    swapRoomMapEntries(room.lastWardenTargets);
    swapRoomMapEntries(room.lastMagicianTargets);
    swapRoomMapEntries(room.lastMirrorTargets);
    swapRoomMapEntries(room.lastInvestigatorTargets);
    swapRoomMapEntries(room.lastTrackerTargets);
    swapRoomMapEntries(room.lastStalkerTargets);
    swapRoomMapEntries(room.lastTetherhexTargets);
    swapRoomMapEntries(room.lastSilencerTargets);
    swapRoomMapEntries(room.lastHypnoticTargets);
    swapRoomMapEntries(room.lastOverloadTargets);
    swapRoomMapEntries(room.lastBlackoutFlashNight);

    const firstNightAction = room.nightActions?.[firstPlayerId];
    const secondNightAction = room.nightActions?.[secondPlayerId];
    if (room.nightActions) {
      if (secondNightAction === undefined) delete room.nightActions[firstPlayerId];
      else room.nightActions[firstPlayerId] = secondNightAction;

      if (firstNightAction === undefined) delete room.nightActions[secondPlayerId];
      else room.nightActions[secondPlayerId] = firstNightAction;
    }

    return true;
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

    for (const playerId of shuffled) {
      const player = room.players.get(playerId);
      if (!player) continue;
      player.veteranUsesRemaining = 4;
      player.mirrorUsesRemaining = 4;
      player.guardianAngelUsesRemaining = 4;
      player.survivalistUsesRemaining = 4;
      player.blackoutFlashUsesRemaining = 3;
      player.purgeFascismUsesRemaining = 1;
      player.prophetGospelUsesRemaining = 2;
      player.executionerTargetId = null;
      player.guardianAngelTargetId = null;
      player.wardenGuardedTargetId = null;
      player.inquisitorExileUsed = false;
      player.swapperSwapTargetIds = [];
      player.alturistReviveTargetId = null;
      player.vesselAwakened = false;
    }

    let index = 0;

    if (count === 5) {
      if (room.useClassicFivePlayerSetup) {
        this.assignSpecificRole(room, shuffled[index], 'Sheriff');
        index++;
        this.assignSpecificRole(room, shuffled[index], 'Vitalist');
        index++;
        this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Info');
        index++;
        this.assignSpecificRole(room, shuffled[index], 'Assassin');
        index++;
        this.assignSpecificRole(room, shuffled[index], 'Jester');

        room.playerOrder = shuffled;
        this.assignExecutionerTargets(room);
        this.assignGuardianAngelTargets(room);
        return room;
      }

      const slotPlan = [
        { faction: 'Crew', subfaction: 'Info' },
        { faction: 'Crew', subfaction: 'Protection' },
        { faction: 'Crew', subfaction: 'Killing' },
        { faction: 'Assassin', subfaction: 'Power' },
      ];

      for (const slot of slotPlan) {
        this.assignRoleFromSlot(room, shuffled[index], slot.faction, slot.subfaction);
        index++;
      }

      this.assignNeutralSpecialRole(room, shuffled[index], ['Evil']);
      index++;

      room.playerOrder = shuffled;
      this.assignExecutionerTargets(room);
      this.assignGuardianAngelTargets(room);
      return room;
    }

    if (count === 7) {
      const slotPlan = [
        { faction: 'Crew', subfaction: 'Info' },
        { faction: 'Crew', subfaction: 'Protection' },
        { faction: 'Crew', subfaction: 'Killing' },
        { faction: 'Assassin', subfaction: 'Power' },
      ];

      for (const slot of slotPlan) {
        this.assignRoleFromSlot(room, shuffled[index], slot.faction, slot.subfaction);
        index++;
      }

      this.assignRoleFromPool(
        room,
        shuffled[index],
        'Assassin',
        [
          ...this.getRolePoolForRoom(room, 'Assassin', 'Concealing'),
          ...this.getRolePoolForRoom(room, 'Assassin', 'Support'),
        ]
      );
      index++;

      this.assignRoleFromPool(
        room,
        shuffled[index],
        'Crew',
        [
          ...this.getRolePoolForRoom(room, 'Crew', 'Unbound'),
          ...this.getRolePoolForRoom(room, 'Crew', 'Chaos'),
        ]
      );
      index++;

      this.assignNeutralSpecialRole(room, shuffled[index], ['Evil', 'Benign', 'Killing']);
      room.playerOrder = shuffled;
      this.assignExecutionerTargets(room);
      this.assignGuardianAngelTargets(room);
      return room;
    }

    if (count === 6) {
      this.assignRoleFromSlot(room, shuffled[index], 'Assassin', 'Power');
      index++;

      this.assignNeutralSpecialRole(room, shuffled[index], ['Evil', 'Benign', 'Killing']);
      index++;

      this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Killing');
      index++;

      this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Protection');
      index++;

      this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Info');
      index++;

      this.assignRoleFromPool(
        room,
        shuffled[index],
        'Crew',
        [
          ...this.getRolePoolForRoom(room, 'Crew', 'Unbound'),
          ...this.getRolePoolForRoom(room, 'Crew', 'Chaos'),
        ]
      );

      room.playerOrder = shuffled;
      this.assignExecutionerTargets(room);
      this.assignGuardianAngelTargets(room);
      return room;
    }

    for (let i = 0; i < assassinCount; i++) {
      if (i === 0) {
        this.assignRoleFromSlot(room, shuffled[index], 'Assassin', 'Power');
      } else if (i === 1) {
        this.assignRoleFromPool(
          room,
          shuffled[index],
          'Assassin',
          [
            ...this.getRolePoolForRoom(room, 'Assassin', 'Concealing'),
            ...this.getRolePoolForRoom(room, 'Assassin', 'Support'),
          ]
        );
      } else {
        this.assignRoleFromPool(
          room,
          shuffled[index],
          'Assassin',
          [
            ...this.getRolePoolForRoom(room, 'Assassin', 'Power'),
            ...this.getRolePoolForRoom(room, 'Assassin', 'Concealing'),
            ...this.getRolePoolForRoom(room, 'Assassin', 'Support'),
          ]
        );
      }
      index++;
    }

    if (index < shuffled.length) {
      this.assignNeutralSpecialRole(room, shuffled[index], ['Evil', 'Benign', 'Killing']);
      index++;
    }

    if (count === 10 && index < shuffled.length) {
      this.assignNeutralSpecialRole(room, shuffled[index], ['Evil', 'Benign', 'Killing']);
      index++;
    }

    this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Killing');
    index++;

    this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Protection');
    index++;

    if (index < shuffled.length) {
      this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Info');
      index++;
    }

    if (index < shuffled.length) {
      this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Unbound');
      index++;
    }

    if (index < shuffled.length) {
      this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Chaos');
      index++;
    }

    while (index < shuffled.length) {
      const playerId = shuffled[index];
      if (room.disableVillagerRole) {
        this.assignFallbackCrewRole(room, playerId);
      } else {
        const player = room.players.get(playerId);
        player.role = 'Villager';
        player.faction = 'Crew';
      }
      index++;
    }

    room.playerOrder = shuffled;
    this.assignExecutionerTargets(room);
    this.assignGuardianAngelTargets(room);
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
    room.assassinChatMessages = [];
    room.currentPhaseSummaryId = null;
    room.lastMedicTarget = null;
    room.lastWardenTargets = {};
    room.lastMagicianTargets = {};
    room.lastMirrorTargets = {};
    room.lastInvestigatorTargets = {};
    room.lastTrackerTargets = {};
    room.lastStalkerTargets = {};
    room.lastTetherhexTargets = {};
    room.lastSilencerTargets = {};
    room.lastHypnoticTargets = {};
    room.lastOverloadTargets = {};
    room.lastBlackoutFlashNight = {};
    room.blackmailedPlayers = {};
    room.silencedPlayers = {};
    room.roleRevealEndsAt = 0;
    room.pendingLongshots = [];

    this.beginPhaseSummary(code, 'Night 1 has begun. Chat is locked until morning.');

    return { room };
  }

  resetRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };

    for (const [, player] of room.players) {
      player.role = null;
      player.faction = null;
      player.veteranUsesRemaining = 4;
      player.mirrorUsesRemaining = 4;
      player.guardianAngelUsesRemaining = 4;
      player.survivalistUsesRemaining = 4;
      player.blackoutFlashUsesRemaining = 3;
      player.purgeFascismUsesRemaining = 1;
      player.prophetGospelUsesRemaining = 2;
      player.executionerTargetId = null;
      player.guardianAngelTargetId = null;
      player.wardenGuardedTargetId = null;
      player.oracleEvilEyeUsesRemaining = 3;
      player.oraclePurifyUsesRemaining = 2;
      player.oracleMarkedTargetId = null;
      player.oraclePurifiedTargetId = null;
      player.inquisitorExiledTargetId = null;
      player.inquisitorExileUsed = false;
      player.disruptorVetoUsesRemaining = 1;
      player.disruptorVetoUsed = false;
      player.manipulatorSurpriseUsesRemaining = 2;
      player.manipulatorSurpriseUsed = false;
      player.alturistReviveTargetId = null;
      player.scientistExperimentUsesRemaining = 1;
      player.scientistSwapTargetIds = [];
      player.vesselAwakened = false;
      player.witherInfected = false;
      player.imitatorCopiedRole = null;
      player.imitatorCopiedSourceId = null;
      player.imitatorCycleTargetIds = [];
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
    room.assassinChatMessages = [];
    room.currentPhaseSummaryId = null;
    room.playerOrder = [];
    room.lastAction = Date.now();
    room.lastMedicTarget = null;
    room.lastWardenTargets = {};
    room.lastMagicianTargets = {};
    room.lastMirrorTargets = {};
    room.lastInvestigatorTargets = {};
    room.lastTrackerTargets = {};
    room.lastStalkerTargets = {};
    room.lastTetherhexTargets = {};
    room.lastSilencerTargets = {};
    room.lastHypnoticTargets = {};
    room.lastOverloadTargets = {};
    room.lastBlackoutFlashNight = {};
    room.blackmailedPlayers = {};
    room.silencedPlayers = {};
    room.recentKillers = [];
    room.pendingLongshots = [];
    room.roleRevealEndsAt = 0;

    return { room };
  }

  returnRoomToLobby(code, playerId) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };

    const player = room.players.get(playerId);
    if (!player) return { error: 'Player not found' };

    let newHostId = null;

    if (room.state === 'ended') {
      const resetResult = this.resetRoom(code);
      if (resetResult.error) return resetResult;
      const preferredHostId = room.players.has(room.creatorHostId) ? room.creatorHostId : playerId;
      room.hostId = preferredHostId;
      newHostId = preferredHostId;
      return { room, newHostId, reset: true };
    }

    if (room.state === 'lobby' && room.creatorHostId === playerId && room.hostId !== playerId) {
      room.hostId = playerId;
      room.lastAction = Date.now();
      newHostId = playerId;
    }

    return { room, newHostId, reset: false };
  }

  submitNightAction(code, playerId, action, targetId, targetIds = null) {
    const room = this.rooms.get(code);
    if (!room || room.state !== 'night') return { error: 'Not in night phase' };
    if (room.roleRevealEndsAt && Date.now() < room.roleRevealEndsAt) {
      return { error: 'Night actions unlock after the role reveal.' };
    }

    const player = room.players.get(playerId);
    if (!player || !player.alive) return { error: 'Invalid player' };
    const activeRole = this.getEffectiveNightRole(player);

    if (player.role === 'Imitator' && !player.imitatorCopiedRole) {
      const target = room.players.get(targetId);
      if (!target || !target.alive || target.id === playerId) return { error: 'Invalid target' };
      if (action !== 'mimic') return { error: 'Invalid action for Imitator' };
      const availableTargetIds = this.getImitatorAvailableTargetIds(room, playerId);
      if (!availableTargetIds.includes(targetId)) {
        return { error: 'You cannot target the same player again until there is no one left' };
      }

      player.imitatorCopiedRole = target.role;
      player.imitatorCopiedSourceId = target.id;
      const cycleTargetIds = Array.isArray(player.imitatorCycleTargetIds) ? [...player.imitatorCycleTargetIds] : [];
      if (!cycleTargetIds.includes(targetId)) cycleTargetIds.push(targetId);
      const aliveOtherTargetIds = Array.from(room.players.values())
        .filter((candidate) => candidate.alive && candidate.id !== playerId)
        .map((candidate) => candidate.id);
      player.imitatorCycleTargetIds = aliveOtherTargetIds.every((candidateId) => cycleTargetIds.includes(candidateId))
        ? []
        : cycleTargetIds;

      const passiveRoles = new Set(['Villager', 'Jester', 'Executioner', 'Amnesiac', 'Redflag', 'Imitator', 'Karma', 'Narcissist', 'Inquisitor', 'Alturist', 'The Vessel']);
      if (passiveRoles.has(player.imitatorCopiedRole)) {
        room.nightActions[playerId] = { action: 'skip', targetId: null };
      } else {
        delete room.nightActions[playerId];
      }

      return { success: true, room, player: this.getPlayerData(code, playerId), transformed: true };
    }

    if (activeRole === 'Sheriff') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'shoot' && action !== 'search') return { error: 'Invalid action for Sheriff' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else if (activeRole === 'Investigator') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'examine') return { error: 'Invalid action for Investigator' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      const recentTargets = room.lastInvestigatorTargets[playerId] || [];
      if (recentTargets.length >= 2 && recentTargets[recentTargets.length - 1] === targetId && recentTargets[recentTargets.length - 2] === targetId) {
        return { error: 'You cannot target the same player 3 times in a row' };
      }
    } else if (activeRole === 'Tracker') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'track') return { error: 'Invalid action for Tracker' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (room.lastTrackerTargets[playerId] === targetId) {
        return { error: 'You cannot target the same player twice in a row' };
      }
    } else if (activeRole === 'Stalker') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'stalk') return { error: 'Invalid action for Stalker' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (room.lastStalkerTargets[playerId] === targetId) {
        return { error: 'You cannot target the same player twice in a row' };
      }
    } else if (activeRole === 'Traplord') {
      if (action !== 'trap') return { error: 'Invalid action for Traplord' };
      if (!Array.isArray(targetIds)) return { error: 'Invalid targets' };
      const normalizedTargetIds = [...new Set(targetIds.map((id) => String(id || '').trim()).filter(Boolean))];
      if (normalizedTargetIds.length < 3) return { error: 'Choose at least 3 players' };
      for (const selectedTargetId of normalizedTargetIds) {
        const target = room.players.get(selectedTargetId);
        if (!target || !target.alive) return { error: 'Invalid target' };
        if (selectedTargetId === playerId) return { error: 'Cannot target yourself' };
      }
    } else if (activeRole === 'Teleporter') {
      if (action !== 'teleport') return { error: 'Invalid action for Teleporter' };
      if (!Array.isArray(targetIds)) return { error: 'Invalid targets' };
      const normalizedTargetIds = [...new Set(targetIds.map((id) => String(id || '').trim()).filter(Boolean))];
      if (normalizedTargetIds.length !== 2) return { error: 'Choose exactly 2 players' };
      for (const selectedTargetId of normalizedTargetIds) {
        const target = room.players.get(selectedTargetId);
        if (!target || !target.alive) return { error: 'Invalid target' };
      }
    } else if (activeRole === 'Magician') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'abracadabra') return { error: 'Invalid action for Magician' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (room.lastMagicianTargets[playerId] === targetId) {
        return { error: 'You cannot target the same player twice in a row' };
      }
    } else if (activeRole === 'Silencer') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'quietus') return { error: 'Invalid action for Silencer' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (room.lastSilencerTargets[playerId] === targetId) {
        return { error: 'You cannot target the same player twice in a row' };
      }
    } else if (activeRole === 'Alturist') {
      const target = room.players.get(targetId);
      if (!target || target.alive) return { error: 'Invalid target' };
      if (action !== 'sacrifice') return { error: 'Invalid action for Alturist' };
      player.alive = false;
      target.alive = true;
      room.nightActions[playerId] = { action: 'skip', targetId: null, queuedTargetId: null };
      room.lastAction = Date.now();
      return {
        success: true,
        room,
        player: this.getPlayerData(code, playerId),
        immediateAlturistRevive: true,
        revivedPlayerId: targetId,
      };
    } else if (activeRole === 'The Vessel') {
      const target = room.players.get(targetId);
      if (!player.vesselAwakened) return { error: 'Your Kill is still locked' };
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'kill') return { error: 'Invalid action for The Vessel' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else if (activeRole === 'Warden') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'guard') return { error: 'Invalid action for Warden' };
      if (room.lastWardenTargets[playerId] === targetId) {
        return { error: 'You cannot target the same player in a row' };
      }
    } else if (activeRole === 'Oracle') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'evil-eye') return { error: 'Invalid action for Oracle' };
      if ((player.oracleEvilEyeUsesRemaining ?? 3) <= 0) return { error: 'You have no Evil Eye uses remaining' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else if (activeRole === 'Vitalist') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'protect') return { error: 'Invalid action for Vitalist' };
      if (targetId === room.lastMedicTarget) {
        return { error: 'You cannot protect the same player two nights in a row' };
      }
    } else if (activeRole === 'Mirror Caster') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'mirror') return { error: 'Invalid action for Mirror Caster' };
      if ((player.mirrorUsesRemaining ?? 4) <= 0) return { error: 'You have no Mirror uses remaining' };
      if (room.lastMirrorTargets[playerId] === targetId) {
        return { error: 'You cannot target the same player twice in a row' };
      }
    } else if (activeRole === 'Guardian Angel') {
      const target = room.players.get(this.getGuardianBlessTargetId(room, player));
      if (!target || !target.alive) return { error: 'Your target is no longer alive' };
      if (action !== 'bless') return { error: 'Invalid action for Guardian Angel' };
      if ((player.guardianAngelUsesRemaining ?? 4) <= 0) return { error: 'You have no Blessing uses remaining' };
    } else if (activeRole === 'Survivalist') {
      if (action !== 'lifeguard') return { error: 'Invalid action for Survivalist' };
      if ((player.survivalistUsesRemaining ?? 4) <= 0) return { error: 'You have no Lifeguard uses remaining' };
    } else if (activeRole === 'Amnesiac') {
      const target = room.players.get(targetId);
      if (!target || target.alive) return { error: 'Invalid target' };
      if (action !== 'inherit') return { error: 'Invalid action for Amnesiac' };

      const inheritResult = this.inheritDeadRole(room, playerId, targetId);
      if (inheritResult.error) return inheritResult;

      const passiveRoles = new Set(['Villager', 'Jester', 'Executioner', 'Amnesiac', 'Redflag', 'Karma', 'Narcissist', 'Inquisitor', 'Alturist', 'The Vessel']);
      if (passiveRoles.has(inheritResult.player.role)) {
        room.nightActions[playerId] = { action: 'skip', targetId: null };
      } else {
        delete room.nightActions[playerId];
      }

      return { success: true, room, player: this.getPlayerData(code, playerId), transformed: true };
    } else if (activeRole === 'Veteran') {
      if (action !== 'instinct') return { error: 'Invalid action for Veteran' };
      if ((player.veteranUsesRemaining ?? 4) <= 0) return { error: 'You have no Instinct uses remaining' };
    } else if (activeRole === 'Assassin' || activeRole === 'Disruptor' || activeRole === 'Manipulator') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'kill') return { error: `Invalid action for ${activeRole}` };
      if (this.hasSubmittedAssassinKill(room, playerId)) return { error: 'Another assassin has already chosen the kill tonight' };
      if (player.faction === 'Assassin' && target.faction === 'Assassin') return { error: 'Cannot kill teammates' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else if (activeRole === 'Prophet') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'kill' && action !== 'gospel') return { error: 'Invalid action for Prophet' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (action === 'gospel') {
        if ((player.prophetGospelUsesRemaining ?? 2) <= 0) return { error: 'You have no Gospel uses remaining' };
      } else {
        if (this.hasSubmittedAssassinKill(room, playerId)) return { error: 'Another assassin has already chosen the kill tonight' };
        if (target.faction === 'Assassin') return { error: 'Cannot kill teammates' };
      }
    } else if (activeRole === 'Sniper') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'longshot') return { error: 'Invalid action for Sniper' };
      if (this.hasSubmittedAssassinKill(room, playerId)) return { error: 'Another assassin has already chosen the kill tonight' };
      if (player.faction === 'Assassin' && target.faction === 'Assassin') return { error: 'Cannot shoot teammates' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else if (activeRole === 'Tetherhex') {
      const existingAction = room.nightActions[playerId] || {};
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'interlinked' && action !== 'kill') return { error: 'Invalid action for Tetherhex' };
      if (action === 'kill') {
        if (this.hasSubmittedAssassinKill(room, playerId)) return { error: 'Another assassin has already chosen the kill tonight' };
        if (player.faction === 'Assassin' && target.faction === 'Assassin') return { error: 'Cannot kill teammates' };
        if (targetId === playerId) return { error: 'Cannot target yourself' };
        if (existingAction.action === 'kill' && existingAction.targetId === targetId) {
          return { error: 'You already chose that kill target tonight' };
        }
      } else {
        if (targetId === playerId) return { error: 'Cannot target yourself' };
        const recentTargets = room.lastTetherhexTargets[playerId] || [];
        if (recentTargets.length >= 2 && recentTargets[recentTargets.length - 1] === targetId && recentTargets[recentTargets.length - 2] === targetId) {
          return { error: 'You cannot target the same player 3 times in a row' };
        }
        if (existingAction.interlinkedUsedThisNight && existingAction.interlinkedTargetId === targetId) {
          return { error: 'You already linked with that player tonight' };
        }
      }
    } else if (activeRole === 'Hypnotic') {
      const existingAction = room.nightActions[playerId] || {};
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (player.faction === 'Assassin' && target.faction === 'Assassin') return { error: 'Cannot target teammates' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (action !== 'trance' && action !== 'kill') return { error: 'Invalid action for Hypnotic' };
      if (action === 'trance') {
        if (existingAction.tranceUsedThisNight) return { error: 'You already used Trance tonight' };
        if (room.lastHypnoticTargets[playerId] === targetId) {
          return { error: 'You cannot target the same player twice in a row' };
        }
      } else if (existingAction.action === 'kill' && existingAction.targetId === targetId) {
        return { error: 'You already chose that kill target tonight' };
      } else if (this.hasSubmittedAssassinKill(room, playerId)) {
        return { error: 'Another assassin has already chosen the kill tonight' };
      }
    } else if (activeRole === 'Overload') {
      const existingAction = room.nightActions[playerId] || {};
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (action !== 'malware' && action !== 'kill') return { error: 'Invalid action for Overload' };
      if (action === 'malware') {
        if (existingAction.malwareUsedThisNight) return { error: 'You already used Malware tonight' };
        if (room.lastOverloadTargets[playerId] === targetId) {
          return { error: 'You cannot target the same player twice in a row' };
        }
      } else if (existingAction.action === 'kill' && existingAction.targetId === targetId) {
        return { error: 'You already chose that kill target tonight' };
      }
    } else if (activeRole === 'Arsonist') {
      const existingAction = room.nightActions[playerId] || {};
      const currentDousedTargetIds = Array.isArray(player.arsonistDousedTargetIds) ? player.arsonistDousedTargetIds : [];
      if (action === 'douse') {
        const target = room.players.get(targetId);
        if (!target || !target.alive) return { error: 'Invalid target' };
        if (targetId === playerId) return { error: 'Cannot target yourself' };
        if (currentDousedTargetIds.includes(targetId)) {
          return { error: 'Cannot douse an already doused player' };
        }
      } else if (action === 'ignite') {
        if (existingAction.action === 'ignite') return { error: 'You already chose Ignite tonight' };
        if (currentDousedTargetIds.length === 0) return { error: 'You need at least 1 doused player to ignite' };
      } else {
        return { error: 'Invalid action for Arsonist' };
      }
    } else if (activeRole === 'Wither') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'infect') return { error: 'Invalid action for Wither' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (target.witherInfected) return { error: 'That player is already infected' };
    } else if (activeRole === 'Pestilence') {
      const existingAction = room.nightActions[playerId] || {};
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'kill') return { error: 'Invalid action for Pestilence' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (existingAction.action === 'kill' && existingAction.targetId === targetId) {
        return { error: 'You already chose that kill target tonight' };
      }
    } else if (activeRole === 'Blackout') {
      const existingAction = room.nightActions[playerId] || {};
      if (action === 'flash') {
        if ((player.blackoutFlashUsesRemaining ?? 3) <= 0) return { error: 'You have no Flash uses remaining' };
        if (existingAction.flashUsedThisNight) return { error: 'You already used Flash tonight' };
        if (room.lastBlackoutFlashNight[playerId] === room.nightCount - 1) {
        return { error: 'You cannot use Flash twice in a row' };
        }
      } else if (action === 'kill') {
        const target = room.players.get(targetId);
        if (!target || !target.alive) return { error: 'Invalid target' };
        if (this.hasSubmittedAssassinKill(room, playerId)) return { error: 'Another assassin has already chosen the kill tonight' };
        if (player.faction === 'Assassin' && target.faction === 'Assassin') return { error: 'Cannot kill teammates' };
        if (targetId === playerId) return { error: 'Cannot target yourself' };
        if (existingAction.action === 'kill' && existingAction.targetId === targetId) {
          return { error: 'You already chose that kill target tonight' };
        }
      } else {
        return { error: 'Invalid action for Blackout' };
      }
    } else if (activeRole === 'Blackmailer') {
      const existingAction = room.nightActions[playerId] || {};
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (player.faction === 'Assassin' && target.faction === 'Assassin') return { error: 'Cannot target teammates' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (action !== 'blackmail' && action !== 'kill') return { error: 'Invalid action for Blackmailer' };
      if (action === 'blackmail') {
        if (existingAction.blackmailUsedThisNight) return { error: 'You already used Blackmail tonight' };
      } else if (existingAction.action === 'kill' && existingAction.targetId === targetId) {
        return { error: 'You already chose that kill target tonight' };
      } else if (this.hasSubmittedAssassinKill(room, playerId)) {
        return { error: 'Another assassin has already chosen the kill tonight' };
      }
    } else if (activeRole === 'The Purge') {
      const existingAction = room.nightActions[playerId] || {};
      if (action === 'fascism') {
        if ((player.purgeFascismUsesRemaining ?? 1) <= 0) return { error: 'You have no Fascism uses remaining' };
        if (existingAction.fascismUsedThisNight) return { error: 'You already used Fascism tonight' };
      } else if (action === 'kill') {
        const target = room.players.get(targetId);
        if (!target || !target.alive) return { error: 'Invalid target' };
        if (this.hasSubmittedAssassinKill(room, playerId)) return { error: 'Another assassin has already chosen the kill tonight' };
        if (player.faction === 'Assassin' && target.faction === 'Assassin') return { error: 'Cannot kill teammates' };
        if (targetId === playerId) return { error: 'Cannot target yourself' };
        if (existingAction.action === 'kill' && existingAction.targetId === targetId) {
          return { error: 'You already chose that kill target tonight' };
        }
      } else {
        return { error: 'Invalid action for The Purge' };
      }
    } else {
      return { error: 'You have no night abilities' };
    }

    if (activeRole === 'Tetherhex') {
      const existingAction = room.nightActions[playerId] || {};
      room.nightActions[playerId] = {
        ...existingAction,
        interlinkedUsedThisNight: action === 'interlinked' ? true : !!existingAction.interlinkedUsedThisNight,
        interlinkedTargetId: action === 'interlinked' ? targetId : (existingAction.interlinkedTargetId || null),
        action: action === 'kill' ? 'kill' : (existingAction.action || null),
        targetId: action === 'kill' ? targetId : (existingAction.targetId || null),
        queuedTargetId: null,
      };
    } else if (activeRole === 'Hypnotic') {
      const existingAction = room.nightActions[playerId] || {};
      const submittedAt = Date.now();
      room.nightActions[playerId] = {
        ...existingAction,
        tranceUsedThisNight: action === 'trance' ? true : !!existingAction.tranceUsedThisNight,
        tranceTargetId: action === 'trance' ? targetId : (existingAction.tranceTargetId || null),
        tranceSubmittedAt: action === 'trance' ? submittedAt : (existingAction.tranceSubmittedAt || null),
        action: action === 'kill' ? 'kill' : (existingAction.action || null),
        targetId: action === 'kill' ? targetId : (existingAction.targetId || null),
        submittedAt: action === 'kill' ? submittedAt : (existingAction.submittedAt || null),
        queuedTargetId: null,
      };
    } else if (activeRole === 'Overload') {
      const existingAction = room.nightActions[playerId] || {};
      const submittedAt = Date.now();
      room.nightActions[playerId] = {
        ...existingAction,
        malwareUsedThisNight: action === 'malware' ? true : !!existingAction.malwareUsedThisNight,
        malwareTargetId: action === 'malware' ? targetId : (existingAction.malwareTargetId || null),
        malwareSubmittedAt: action === 'malware' ? submittedAt : (existingAction.malwareSubmittedAt || null),
        action: action === 'kill' ? 'kill' : (existingAction.action || null),
        targetId: action === 'kill' ? targetId : (existingAction.targetId || null),
        submittedAt: action === 'kill' ? submittedAt : (existingAction.submittedAt || null),
        queuedTargetId: null,
      };
    } else if (activeRole === 'Arsonist') {
      const submittedAt = Date.now();
      const currentDousedTargetIds = Array.isArray(player.arsonistDousedTargetIds) ? [...player.arsonistDousedTargetIds] : [];
      room.nightActions[playerId] = {
        action,
        targetId: action === 'douse' ? targetId : null,
        targetIds: [],
        igniteTargetIds: action === 'ignite' ? currentDousedTargetIds : [],
        submittedAt,
        queuedTargetId: null,
      };
    } else if (activeRole === 'Wither') {
      room.nightActions[playerId] = {
        action,
        targetId,
        queuedTargetId: null,
      };
    } else if (activeRole === 'Pestilence') {
      room.nightActions[playerId] = {
        action,
        targetId,
        submittedAt: Date.now(),
        queuedTargetId: null,
      };
    } else if (activeRole === 'Silencer') {
      const submittedAt = Date.now();
      room.nightActions[playerId] = {
        action,
        targetId,
        submittedAt,
        quietusSubmittedAt: action === 'quietus' ? submittedAt : null,
        queuedTargetId: null,
      };
    } else if (activeRole === 'Alturist') {
      room.nightActions[playerId] = {
        action,
        targetId,
        queuedTargetId: null,
      };
    } else if (activeRole === 'The Vessel') {
      room.nightActions[playerId] = {
        action,
        targetId,
        queuedTargetId: null,
      };
    } else if (activeRole === 'Warden') {
      room.nightActions[playerId] = {
        action,
        targetId,
        queuedTargetId: null,
      };
    } else if (activeRole === 'Oracle') {
      room.nightActions[playerId] = {
        action,
        targetId,
        queuedTargetId: null,
      };
    } else if (activeRole === 'Blackmailer') {
      const existingAction = room.nightActions[playerId] || {};
      const submittedAt = Date.now();
      room.nightActions[playerId] = {
        ...existingAction,
        blackmailUsedThisNight: action === 'blackmail' ? true : !!existingAction.blackmailUsedThisNight,
        blackmailTargetId: action === 'blackmail' ? targetId : (existingAction.blackmailTargetId || null),
        action: action === 'kill' ? 'kill' : (existingAction.action || null),
        targetId: action === 'kill' ? targetId : (existingAction.targetId || null),
        submittedAt: action === 'kill' ? submittedAt : (existingAction.submittedAt || null),
        queuedTargetId: null,
      };
    } else if (activeRole === 'Blackout') {
      const existingAction = room.nightActions[playerId] || {};
      room.nightActions[playerId] = {
        ...existingAction,
        flashUsedThisNight: action === 'flash' ? true : !!existingAction.flashUsedThisNight,
        action: action === 'kill' ? 'kill' : (existingAction.action || null),
        targetId: action === 'kill' ? targetId : (existingAction.targetId || null),
        queuedTargetId: null,
      };
    } else if (activeRole === 'The Purge') {
      const existingAction = room.nightActions[playerId] || {};
      room.nightActions[playerId] = {
        ...existingAction,
        fascismUsedThisNight: action === 'fascism' ? true : !!existingAction.fascismUsedThisNight,
        action: action === 'kill' ? 'kill' : (existingAction.action || null),
        targetId: action === 'kill' ? targetId : (existingAction.targetId || null),
        queuedTargetId: null,
      };
    } else if (activeRole === 'Traplord') {
      room.nightActions[playerId] = {
        action,
        targetId: null,
        targetIds: [...new Set(targetIds.map((id) => String(id || '').trim()).filter(Boolean))],
        queuedTargetId: null,
      };
    } else if (activeRole === 'Teleporter') {
      room.nightActions[playerId] = {
        action,
        targetId: null,
        targetIds: [...new Set(targetIds.map((id) => String(id || '').trim()).filter(Boolean))],
        queuedTargetId: null,
      };
    } else if (activeRole === 'Magician') {
      const submittedAt = Date.now();
      room.nightActions[playerId] = {
        action,
        targetId,
        submittedAt,
        abracadabraSubmittedAt: action === 'abracadabra' ? submittedAt : null,
        queuedTargetId: null,
      };
    } else {
      const submittedAt = Date.now();
      room.nightActions[playerId] = {
        action,
        targetId: action === 'instinct' || action === 'bless' || action === 'lifeguard' || action === 'longshot' ? null : targetId,
        submittedAt,
        queuedTargetId: action === 'longshot' ? targetId : null,
      };
    }

    return { success: true, room };
  }

  skipNightAction(code, playerId) {
    const room = this.rooms.get(code);
    if (!room || room.state !== 'night') return { error: 'Not in night phase' };
    if (room.roleRevealEndsAt && Date.now() < room.roleRevealEndsAt) {
      return { error: 'Night actions unlock after the role reveal.' };
    }

    const player = room.players.get(playerId);
    if (!player || !player.alive) return { error: 'Invalid player' };
    const activeRole = this.getEffectiveNightRole(player);

    if (activeRole === 'Tetherhex') {
      const existingAction = room.nightActions[playerId] || {};
      room.nightActions[playerId] = {
        ...existingAction,
        action: existingAction.action || 'skip',
        targetId: existingAction.targetId || null,
        queuedTargetId: null,
        skippedAfterInterlinked: !!existingAction.interlinkedUsedThisNight || existingAction.skippedAfterInterlinked === true,
      };
    } else if (activeRole === 'Hypnotic') {
      const existingAction = room.nightActions[playerId] || {};
      room.nightActions[playerId] = {
        ...existingAction,
        action: existingAction.action || 'skip',
        targetId: existingAction.targetId || null,
        queuedTargetId: null,
        skippedAfterTrance: !!existingAction.tranceUsedThisNight || existingAction.skippedAfterTrance === true,
      };
    } else if (activeRole === 'Overload') {
      const existingAction = room.nightActions[playerId] || {};
      room.nightActions[playerId] = {
        ...existingAction,
        action: existingAction.action || 'skip',
        targetId: existingAction.targetId || null,
        queuedTargetId: null,
        skippedAfterMalware: !!existingAction.malwareUsedThisNight || existingAction.skippedAfterMalware === true,
      };
    } else if (activeRole === 'Blackmailer') {
      const existingAction = room.nightActions[playerId] || {};
      room.nightActions[playerId] = {
        ...existingAction,
        action: existingAction.action || 'skip',
        targetId: existingAction.targetId || null,
        queuedTargetId: null,
        skippedAfterBlackmail: !!existingAction.blackmailUsedThisNight || existingAction.skippedAfterBlackmail === true,
      };
    } else if (activeRole === 'Blackout') {
      const existingAction = room.nightActions[playerId] || {};
      room.nightActions[playerId] = {
        ...existingAction,
        action: existingAction.action || 'skip',
        targetId: existingAction.targetId || null,
        queuedTargetId: null,
        skippedAfterFlash: !!existingAction.flashUsedThisNight || existingAction.skippedAfterFlash === true,
      };
    } else if (activeRole === 'The Purge') {
      const existingAction = room.nightActions[playerId] || {};
      room.nightActions[playerId] = {
        ...existingAction,
        action: existingAction.action || 'skip',
        targetId: existingAction.targetId || null,
        queuedTargetId: null,
        skippedAfterFascism: !!existingAction.fascismUsedThisNight || existingAction.skippedAfterFascism === true,
      };
    } else {
      room.nightActions[playerId] = { action: 'skip', targetId: null };
    }
    return { success: true, room };
  }

  checkAllNightActionsSubmitted(code) {
    const room = this.rooms.get(code);
    if (!room) return false;

    for (const [id, player] of room.players) {
      if (!player.alive) continue;
      const activeRole = this.getEffectiveNightRole(player);
      if (player.role === 'Imitator' && !player.imitatorCopiedRole) {
        const availableTargetIds = this.getImitatorAvailableTargetIds(room, id);
        if (availableTargetIds.length === 0) continue;
        return false;
      }
      if (activeRole === 'Villager') continue;
      if (activeRole === 'Jester') continue;
      if (activeRole === 'Executioner') continue;
      if (activeRole === 'Redflag') continue;
      if (activeRole === 'Karma') continue;
      if (activeRole === 'Inquisitor') continue;
      if (activeRole === 'Scientist') continue;
      if (activeRole === 'Swapper') continue;
      if (activeRole === 'Narcissist') continue;
      if (activeRole === 'The Vessel' && !player.vesselAwakened) continue;
      if (activeRole === 'Alturist') {
        const hasDeadTargets = Array.from(room.players.values()).some((candidate) => !candidate.alive && candidate.id !== id);
        if (!hasDeadTargets) continue;
      }
      if (activeRole === 'Tetherhex') {
        const tetherhexAction = room.nightActions[id];
        if (!tetherhexAction) return false;
        if (tetherhexAction.action === 'kill' || tetherhexAction.action === 'skip' || tetherhexAction.skippedAfterInterlinked === true) continue;
        return false;
      }
      if (activeRole === 'Silencer') {
        if (!room.nightActions[id]) return false;
        continue;
      }
      if (activeRole === 'Blackmailer') {
        const blackmailerAction = room.nightActions[id];
        if (!blackmailerAction) return false;
        if (blackmailerAction.action === 'kill' || blackmailerAction.action === 'skip' || blackmailerAction.skippedAfterBlackmail === true) continue;
        return false;
      }
      if (activeRole === 'Hypnotic') {
        const hypnoticAction = room.nightActions[id];
        if (!hypnoticAction) return false;
        if (hypnoticAction.action === 'kill' || hypnoticAction.action === 'skip' || hypnoticAction.skippedAfterTrance === true) continue;
        return false;
      }
      if (activeRole === 'Overload') {
        const overloadAction = room.nightActions[id];
        if (!overloadAction) return false;
        if (overloadAction.action === 'kill' || overloadAction.action === 'skip' || overloadAction.skippedAfterMalware === true) continue;
        return false;
      }
      if (activeRole === 'Blackout') {
        const blackoutAction = room.nightActions[id];
        if (!blackoutAction) return false;
        if (blackoutAction.action === 'kill' || blackoutAction.action === 'skip' || blackoutAction.skippedAfterFlash === true) continue;
        return false;
      }
      if (activeRole === 'The Purge') {
        const purgeAction = room.nightActions[id];
        if (!purgeAction) return false;
        if (purgeAction.action === 'kill' || purgeAction.action === 'skip' || purgeAction.skippedAfterFascism === true) continue;
        return false;
      }
      if (activeRole === 'Teleporter') {
        if (!room.nightActions[id]) return false;
        continue;
      }
      if (activeRole === 'Sniper') {
        if (!room.nightActions[id]) return false;
        continue;
      }
      if (activeRole === 'Guardian Angel' && (player.guardianAngelUsesRemaining ?? 4) <= 0) continue;
      if (activeRole === 'Oracle' && (player.oracleEvilEyeUsesRemaining ?? 3) <= 0) continue;
      if (activeRole === 'Survivalist' && (player.survivalistUsesRemaining ?? 4) <= 0) continue;
      if (activeRole === 'Amnesiac') {
        const hasDeadTargets = Array.from(room.players.values()).some((candidate) => !candidate.alive && candidate.id !== id);
        if (!hasDeadTargets) continue;
      }
      if (activeRole === 'Veteran' && (player.veteranUsesRemaining ?? 4) <= 0) continue;
      if (activeRole === 'Mirror Caster' && (player.mirrorUsesRemaining ?? 4) <= 0) continue;
      if (!room.nightActions[id]) return false;
    }
    return true;
  }

  resolveNight(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const messages = [];
    const killed = new Set();
    const revivedTonight = new Set();
    const protected_ = new Set();
    const blessedTargets = new Set();
    const lifeguardedTargets = new Set();
    const searchResults = {};
    const privateMessages = {};
    const killersThisNight = new Set();
    const killAttributions = new Map();
    const recentKillers = new Set((room.recentKillers || []).flat());
    const veteranAlertIds = new Set();
    const mirroredTargets = new Map();
    const hypnotizedTargets = new Set();
    const overloadedTargets = new Set();
    const silencedTargets = new Set();
    const blackoutFlashActive = new Set();
    const blackmailedTargets = new Set();
    const tetheredVictims = new Set();
    const guardedTargets = new Set();
    const spoofedTargets = new Set();
    const nextPendingLongshots = [];
    const resolvingLongshots = [];
    const wardenBlockedActors = new Set();
    const veteranCounterKilledActors = new Set();
    const registerKillAttribution = (victimId, killerId) => {
      if (!victimId || !killerId) return;
      killAttributions.set(victimId, killerId);
    };
    const markVeteranCounterKill = (actorId) => {
      if (!actorId || veteranCounterKilledActors.has(actorId)) return;
      veteranCounterKilledActors.add(actorId);
      killed.add(actorId);
    };
    const pushWardenBlockedMessage = (actorId) => {
      if (!actorId || wardenBlockedActors.has(actorId)) return;
      wardenBlockedActors.add(actorId);
      if (!privateMessages[actorId]) privateMessages[actorId] = [];
      privateMessages[actorId].push(
        this.createPrivateSystemMessage(code, 'This player was guarded by the Warden.', 'Warden')
      );
    };
    const getDisableActionEntries = () => Object.entries(room.nightActions)
      .flatMap(([playerId, action]) => {
        const player = room.players.get(playerId);
        const activeRole = this.getEffectiveNightRole(player);
        if (!player || isSuppressedByPurge(player)) return [];

        const entries = [];
        if (activeRole === 'Magician' && action.action === 'abracadabra' && action.targetId && action.abracadabraSubmittedAt) {
          entries.push({
            playerId,
            role: activeRole,
            kind: 'spoof',
            targetId: action.targetId,
            submittedAt: action.abracadabraSubmittedAt,
          });
        }
        if (activeRole === 'Hypnotic' && action.tranceUsedThisNight && action.tranceTargetId && action.tranceSubmittedAt) {
          entries.push({
            playerId,
            role: activeRole,
            kind: 'hypnotize',
            targetId: action.tranceTargetId,
            submittedAt: action.tranceSubmittedAt,
          });
        }
        if (activeRole === 'Overload' && action.malwareUsedThisNight && action.malwareTargetId && action.malwareSubmittedAt) {
          entries.push({
            playerId,
            role: activeRole,
            kind: 'overload',
            targetId: action.malwareTargetId,
            submittedAt: action.malwareSubmittedAt,
          });
        }
        if (activeRole === 'Silencer' && action.action === 'quietus' && action.targetId && action.quietusSubmittedAt) {
          entries.push({
            playerId,
            role: activeRole,
            kind: 'silence',
            targetId: action.targetId,
            submittedAt: action.quietusSubmittedAt,
          });
        }
        return entries;
      })
      .sort((left, right) => {
        if (left.submittedAt !== right.submittedAt) return left.submittedAt - right.submittedAt;
        return left.playerId.localeCompare(right.playerId);
      });
    const getInteractionTargetIds = (nightAction) => {
      if (!nightAction) return [];
      const targetIds = [];
      if (nightAction.targetId) targetIds.push(nightAction.targetId);
      if (Array.isArray(nightAction.targetIds)) targetIds.push(...nightAction.targetIds);
      if (nightAction.tranceUsedThisNight && nightAction.tranceTargetId) targetIds.push(nightAction.tranceTargetId);
      if (nightAction.malwareUsedThisNight && nightAction.malwareTargetId) targetIds.push(nightAction.malwareTargetId);
      if (nightAction.blackmailUsedThisNight && nightAction.blackmailTargetId) targetIds.push(nightAction.blackmailTargetId);
      if (nightAction.interlinkedUsedThisNight && nightAction.interlinkedTargetId) targetIds.push(nightAction.interlinkedTargetId);
      if (Array.isArray(nightAction.igniteTargetIds)) targetIds.push(...nightAction.igniteTargetIds);
      return [...new Set(targetIds)];
    };
    const teleportSwaps = [];
    const remapTeleportedTargetId = (targetId) => {
      let resolvedTargetId = targetId;
      if (!resolvedTargetId) return resolvedTargetId;
      for (const [firstId, secondId] of teleportSwaps) {
        if (resolvedTargetId === firstId) resolvedTargetId = secondId;
        else if (resolvedTargetId === secondId) resolvedTargetId = firstId;
      }
      return resolvedTargetId;
    };

    // Track who the medic protected this night
    let medicTargetThisNight = null;
    const nextWardenTargets = {};
    const nextMagicianTargets = {};
    const nextMirrorTargets = {};
    const nextTetherhexTargets = {};
    const nextSilencerTargets = {};
    const nextHypnoticTargets = {};
    const nextOverloadTargets = {};
    const nextOracleTargets = {};

    room.blackmailedPlayers = {};
    room.silencedPlayers = {};

    const purgeFascismActive = new Set();
    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'The Purge') continue;
      if (!action.fascismUsedThisNight) continue;
      purgeFascismActive.add(playerId);
      player.purgeFascismUsesRemaining = Math.max(0, (player.purgeFascismUsesRemaining ?? 1) - 1);
    }
    const fascismActive = purgeFascismActive.size > 0;
    const isSuppressedByPurge = (player) => fascismActive && player?.faction !== 'Assassin';
    if (fascismActive) {
      messages.push({ type: 'purge', text: 'The Purge has seized the night.' });
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Teleporter') continue;
      if (isSuppressedByPurge(player)) continue;
      const teleportTargetIds = Array.isArray(action.targetIds) ? [...new Set(action.targetIds.filter(Boolean))] : [];
      if (action.action !== 'teleport' || teleportTargetIds.length !== 2) continue;
      teleportSwaps.push([teleportTargetIds[0], teleportTargetIds[1]]);
      for (const teleportedPlayerId of teleportTargetIds) {
        if (teleportedPlayerId === playerId) continue;
        const otherTeleportedPlayerId = teleportTargetIds.find((candidateId) => candidateId !== teleportedPlayerId);
        const otherTeleportedPlayer = room.players.get(otherTeleportedPlayerId);
        if (!otherTeleportedPlayer) continue;
        if (!privateMessages[teleportedPlayerId]) privateMessages[teleportedPlayerId] = [];
        privateMessages[teleportedPlayerId].push(
          this.createPrivateSystemMessage(code, `You have been teleported with ${otherTeleportedPlayer.name}.`, 'Teleporter')
        );
      }
    }

    for (const action of Object.values(room.nightActions)) {
      if (!action) continue;
      if (action.targetId) action.targetId = remapTeleportedTargetId(action.targetId);
      if (action.queuedTargetId) action.queuedTargetId = remapTeleportedTargetId(action.queuedTargetId);
      if (action.tranceTargetId) action.tranceTargetId = remapTeleportedTargetId(action.tranceTargetId);
      if (action.malwareTargetId) action.malwareTargetId = remapTeleportedTargetId(action.malwareTargetId);
      if (action.blackmailTargetId) action.blackmailTargetId = remapTeleportedTargetId(action.blackmailTargetId);
      if (action.interlinkedTargetId) action.interlinkedTargetId = remapTeleportedTargetId(action.interlinkedTargetId);
      if (Array.isArray(action.targetIds)) {
        action.targetIds = action.targetIds.map((targetId) => remapTeleportedTargetId(targetId));
      }
      if (Array.isArray(action.igniteTargetIds)) {
        action.igniteTargetIds = action.igniteTargetIds.map((targetId) => remapTeleportedTargetId(targetId));
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Warden') continue;
      if (isSuppressedByPurge(player)) continue;
      if (action.action === 'guard' && action.targetId) {
        guardedTargets.add(action.targetId);
        nextWardenTargets[playerId] = action.targetId;
        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        privateMessages[playerId].push(
          this.createPrivateSystemMessage(code, 'You protected the chosen player.', 'Warden')
        );
      } else {
        nextWardenTargets[playerId] = null;
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Alturist') continue;
      if (isSuppressedByPurge(player)) continue;
      if (action.action !== 'sacrifice' || !action.targetId) continue;
      player.alturistReviveTargetId = action.targetId;
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player) continue;
      if (isSuppressedByPurge(player)) continue;
      if (activeRole === 'Warden' && action.action === 'guard') continue;

      if (action.targetId && guardedTargets.has(action.targetId)) {
        pushWardenBlockedMessage(playerId);
        action.targetId = null;
        if (action.action === 'trap') {
          action.targetIds = [];
        }
      }
      if (action.action !== 'longshot' && action.queuedTargetId && guardedTargets.has(action.queuedTargetId)) {
        pushWardenBlockedMessage(playerId);
        action.queuedTargetId = null;
      }
      if (action.tranceTargetId && guardedTargets.has(action.tranceTargetId)) {
        pushWardenBlockedMessage(playerId);
        action.tranceTargetId = null;
        action.tranceUsedThisNight = false;
      }
      if (action.malwareTargetId && guardedTargets.has(action.malwareTargetId)) {
        pushWardenBlockedMessage(playerId);
        action.malwareTargetId = null;
        action.malwareUsedThisNight = false;
      }
      if (action.blackmailTargetId && guardedTargets.has(action.blackmailTargetId)) {
        pushWardenBlockedMessage(playerId);
        action.blackmailTargetId = null;
        action.blackmailUsedThisNight = false;
      }
      if (action.interlinkedTargetId && guardedTargets.has(action.interlinkedTargetId)) {
        pushWardenBlockedMessage(playerId);
        action.interlinkedTargetId = null;
        action.interlinkedUsedThisNight = false;
      }
      if (Array.isArray(action.targetIds) && action.targetIds.length) {
        const filteredTargetIds = action.targetIds.filter((targetId) => !guardedTargets.has(targetId));
        if (filteredTargetIds.length !== action.targetIds.length) {
          pushWardenBlockedMessage(playerId);
          action.targetIds = filteredTargetIds;
        }
      }
      if (Array.isArray(action.igniteTargetIds) && action.igniteTargetIds.length) {
        const filteredIgniteTargetIds = action.igniteTargetIds.filter((targetId) => !guardedTargets.has(targetId));
        if (filteredIgniteTargetIds.length !== action.igniteTargetIds.length) {
          pushWardenBlockedMessage(playerId);
          action.igniteTargetIds = filteredIgniteTargetIds;
        }
      }
      const guardianTargetId = this.getGuardianBlessTargetId(room, player);
      if (activeRole === 'Guardian Angel' && action.action === 'bless' && guardianTargetId && guardedTargets.has(guardianTargetId)) {
        pushWardenBlockedMessage(playerId);
        action.blessBlockedByWarden = true;
      }
    }

    const applySpoofBlocks = () => {
      for (const [playerId, action] of Object.entries(room.nightActions)) {
        const player = room.players.get(playerId);
        const activeRole = this.getEffectiveNightRole(player);
        if (!player) continue;
        if (isSuppressedByPurge(player)) continue;
        if (activeRole === 'Magician' && action.action === 'abracadabra') continue;

        if (action.targetId && spoofedTargets.has(action.targetId)) {
          action.targetId = null;
          if (action.action === 'trap') {
            action.targetIds = [];
          }
        }
        if (action.queuedTargetId && spoofedTargets.has(action.queuedTargetId)) {
          action.queuedTargetId = null;
        }
        if (action.tranceTargetId && spoofedTargets.has(action.tranceTargetId)) {
          action.tranceTargetId = null;
          action.tranceUsedThisNight = false;
        }
        if (action.malwareTargetId && spoofedTargets.has(action.malwareTargetId)) {
          action.malwareTargetId = null;
          action.malwareUsedThisNight = false;
        }
        if (action.blackmailTargetId && spoofedTargets.has(action.blackmailTargetId)) {
          action.blackmailTargetId = null;
          action.blackmailUsedThisNight = false;
        }
        if (action.interlinkedTargetId && spoofedTargets.has(action.interlinkedTargetId)) {
          action.interlinkedTargetId = null;
          action.interlinkedUsedThisNight = false;
        }
        if (Array.isArray(action.targetIds) && action.targetIds.length) {
          action.targetIds = action.targetIds.filter((targetId) => !spoofedTargets.has(targetId));
        }
        if (Array.isArray(action.igniteTargetIds) && action.igniteTargetIds.length) {
          action.igniteTargetIds = action.igniteTargetIds.filter((targetId) => !spoofedTargets.has(targetId));
        }
        const guardianTargetId = this.getGuardianBlessTargetId(room, player);
        if (activeRole === 'Guardian Angel' && action.action === 'bless' && guardianTargetId && spoofedTargets.has(guardianTargetId)) {
          action.blessBlockedBySpoof = true;
        }
      }
    };

    for (const disableAction of getDisableActionEntries()) {
      if (spoofedTargets.has(disableAction.playerId) || hypnotizedTargets.has(disableAction.playerId) || overloadedTargets.has(disableAction.playerId) || silencedTargets.has(disableAction.playerId) || veteranCounterKilledActors.has(disableAction.playerId)) {
        continue;
      }
      if (guardedTargets.has(disableAction.targetId)) continue;
      if (spoofedTargets.has(disableAction.targetId)) continue;

      if (disableAction.kind === 'spoof') {
        spoofedTargets.add(disableAction.targetId);
        nextMagicianTargets[disableAction.playerId] = disableAction.targetId;
        if (!privateMessages[disableAction.targetId]) privateMessages[disableAction.targetId] = [];
        privateMessages[disableAction.targetId].push(
          this.createPrivateSystemMessage(code, 'You have been spoofed by the Magician.', 'Magician')
        );
        applySpoofBlocks();
        continue;
      }

      if (disableAction.kind === 'hypnotize') {
        hypnotizedTargets.add(disableAction.targetId);
        nextHypnoticTargets[disableAction.playerId] = disableAction.targetId;
        if (!privateMessages[disableAction.targetId]) privateMessages[disableAction.targetId] = [];
        privateMessages[disableAction.targetId].push(
          this.createPrivateSystemMessage(code, 'You have been hypnotised by the Hypnotic.', 'Hypnotic')
        );
        continue;
      }

      if (disableAction.kind === 'overload') {
        overloadedTargets.add(disableAction.targetId);
        nextOverloadTargets[disableAction.playerId] = disableAction.targetId;
        if (!privateMessages[disableAction.targetId]) privateMessages[disableAction.targetId] = [];
        privateMessages[disableAction.targetId].push(
          this.createPrivateSystemMessage(code, 'You have been hacked by the Overload.', 'Overload')
        );
        continue;
      }

      if (disableAction.kind === 'silence') {
        silencedTargets.add(disableAction.targetId);
        room.silencedPlayers[disableAction.targetId] = true;
        nextSilencerTargets[disableAction.playerId] = disableAction.targetId;
        if (!privateMessages[disableAction.targetId]) privateMessages[disableAction.targetId] = [];
        privateMessages[disableAction.targetId].push(
          this.createPrivateSystemMessage(code, 'You have been silenced by the Silencer.', 'Silencer')
        );
      }
    }

    const disabledByAbilityTargets = new Set([...hypnotizedTargets, ...overloadedTargets, ...silencedTargets, ...spoofedTargets]);

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Veteran') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledByAbilityTargets.has(playerId)) {
        if (action.action === 'instinct') {
          player.veteranUsesRemaining = Math.max(0, (player.veteranUsesRemaining ?? 4) - 1);
        }
        continue;
      }
      if (action.action !== 'instinct') continue;
      veteranAlertIds.add(playerId);
      player.veteranUsesRemaining = Math.max(0, (player.veteranUsesRemaining ?? 4) - 1);
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player) continue;
      if (isSuppressedByPurge(player)) continue;
      if (activeRole === 'Veteran' && action.action === 'instinct') continue;

      const interactionTargetIds = getInteractionTargetIds(action);
      if (action.action === 'longshot' && action.queuedTargetId) {
        interactionTargetIds.push(action.queuedTargetId);
      }
      const guardianTargetId = this.getGuardianBlessTargetId(room, player);
      if (activeRole === 'Guardian Angel' && action.action === 'bless' && guardianTargetId && !action.blessBlockedByWarden && !action.blessBlockedBySpoof) {
        interactionTargetIds.push(remapTeleportedTargetId(guardianTargetId));
      }

      if (interactionTargetIds.some((targetId) => veteranAlertIds.has(targetId))) {
        markVeteranCounterKill(playerId);
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Tetherhex') continue;
      if (isSuppressedByPurge(player)) continue;
      if (spoofedTargets.has(playerId) || veteranCounterKilledActors.has(playerId)) continue;
      const previousTargets = room.lastTetherhexTargets[playerId] || [];
      if (action.interlinkedUsedThisNight && action.interlinkedTargetId) {
        nextTetherhexTargets[playerId] = [...previousTargets.slice(-1), action.interlinkedTargetId];
      } else {
        nextTetherhexTargets[playerId] = [];
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Blackmailer') continue;
      if (spoofedTargets.has(playerId) || veteranCounterKilledActors.has(playerId)) continue;
      if (action.blackmailUsedThisNight && action.blackmailTargetId) {
        blackmailedTargets.add(action.blackmailTargetId);
        room.blackmailedPlayers[action.blackmailTargetId] = true;
        if (!privateMessages[action.blackmailTargetId]) privateMessages[action.blackmailTargetId] = [];
        privateMessages[action.blackmailTargetId].push(
          this.createPrivateSystemMessage(code, 'You have been blackmailed.', 'Blackmailer')
        );
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Oracle') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledByAbilityTargets.has(playerId) || veteranCounterKilledActors.has(playerId)) continue;
      if (action.action === 'evil-eye' && action.targetId) {
        nextOracleTargets[playerId] = action.targetId;
        player.oracleMarkedTargetId = action.targetId;
        player.oracleEvilEyeUsesRemaining = Math.max(0, (player.oracleEvilEyeUsesRemaining ?? 3) - 1);
      } else {
        nextOracleTargets[playerId] = null;
        player.oracleMarkedTargetId = null;
      }
    }

    const disabledAbilityTargets = new Set([...disabledByAbilityTargets, ...veteranCounterKilledActors]);
    const infectedAlivePlayerIds = new Set(
      Array.from(room.players.entries())
        .filter(([, player]) => player?.alive && player.witherInfected)
        .map(([playerId]) => playerId)
    );
    const infectionGraph = new Map();
    const addInfectionEdge = (firstPlayerId, secondPlayerId) => {
      if (!firstPlayerId || !secondPlayerId || firstPlayerId === secondPlayerId) return;
      const firstPlayer = room.players.get(firstPlayerId);
      const secondPlayer = room.players.get(secondPlayerId);
      if (!firstPlayer?.alive || !secondPlayer?.alive) return;
      if (!infectionGraph.has(firstPlayerId)) infectionGraph.set(firstPlayerId, new Set());
      if (!infectionGraph.has(secondPlayerId)) infectionGraph.set(secondPlayerId, new Set());
      infectionGraph.get(firstPlayerId).add(secondPlayerId);
      infectionGraph.get(secondPlayerId).add(firstPlayerId);
    };

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || !player.alive) continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledByAbilityTargets.has(playerId)) continue;

      if ((activeRole === 'Wither' || activeRole === 'Pestilence') && action.action === 'infect' && action.targetId) {
        const infectedTarget = room.players.get(action.targetId);
        if (infectedTarget?.alive) {
          infectedAlivePlayerIds.add(action.targetId);
        }
      }

      if (activeRole === 'Wither' || activeRole === 'Pestilence') continue;

      const interactionTargetIds = getInteractionTargetIds(action);
      if (action.action === 'longshot' && action.queuedTargetId) {
        interactionTargetIds.push(action.queuedTargetId);
      }
      const guardianTargetId = this.getGuardianBlessTargetId(room, player);
      if (activeRole === 'Guardian Angel' && action.action === 'bless' && guardianTargetId && !action.blessBlockedByWarden && !action.blessBlockedBySpoof) {
        interactionTargetIds.push(remapTeleportedTargetId(guardianTargetId));
      }

      for (const targetId of [...new Set(interactionTargetIds.filter(Boolean))]) {
        const target = room.players.get(targetId);
        const targetActiveRole = this.getEffectiveNightRole(target);
        if (!target?.alive) continue;
        if (targetActiveRole === 'Wither' || targetActiveRole === 'Pestilence') continue;
        addInfectionEdge(playerId, targetId);
      }
    }

    const infectionQueue = [...infectedAlivePlayerIds];
    while (infectionQueue.length) {
      const playerId = infectionQueue.shift();
      const linkedPlayerIds = infectionGraph.get(playerId);
      if (!linkedPlayerIds) continue;
      for (const linkedPlayerId of linkedPlayerIds) {
        if (infectedAlivePlayerIds.has(linkedPlayerId)) continue;
        infectedAlivePlayerIds.add(linkedPlayerId);
        infectionQueue.push(linkedPlayerId);
      }
    }

    for (const [playerId, player] of room.players) {
      if (!player?.alive) continue;
      if (!infectedAlivePlayerIds.has(playerId)) continue;
      player.witherInfected = true;
    }

    for (const [, player] of room.players) {
      if (!player?.alive || player.role !== 'Wither') continue;
      const otherAlivePlayers = Array.from(room.players.values()).filter((candidate) => candidate.alive && candidate.id !== player.id);
      if (!otherAlivePlayers.length) continue;
      if (otherAlivePlayers.every((candidate) => candidate.witherInfected)) {
        player.role = 'Pestilence';
        messages.push({
          type: 'system',
          text: 'Pestilence became all powerful.',
          source: 'Pestilence',
          public: true,
        });
      }
    }

    const consumeLimitedNightUse = (player, activeRole, action) => {
      if (!player) return;

      if (activeRole === 'Veteran' && action.action === 'instinct') {
        player.veteranUsesRemaining = Math.max(0, (player.veteranUsesRemaining ?? 4) - 1);
      }
      if (activeRole === 'Oracle' && action.action === 'evil-eye' && action.targetId) {
        player.oracleMarkedTargetId = null;
        player.oracleEvilEyeUsesRemaining = Math.max(0, (player.oracleEvilEyeUsesRemaining ?? 3) - 1);
      }
      if (activeRole === 'Prophet' && action.action === 'gospel' && action.targetId) {
        player.prophetGospelUsesRemaining = Math.max(0, (player.prophetGospelUsesRemaining ?? 2) - 1);
      }
      if (activeRole === 'Mirror Caster' && action.action === 'mirror' && action.targetId) {
        player.mirrorUsesRemaining = Math.max(0, (player.mirrorUsesRemaining ?? 4) - 1);
      }
      const guardianTargetId = this.getGuardianBlessTargetId(room, player);
      if (activeRole === 'Guardian Angel' && action.action === 'bless' && guardianTargetId) {
        player.guardianAngelUsesRemaining = Math.max(0, (player.guardianAngelUsesRemaining ?? 4) - 1);
      }
      if (activeRole === 'Survivalist' && action.action === 'lifeguard') {
        player.survivalistUsesRemaining = Math.max(0, (player.survivalistUsesRemaining ?? 4) - 1);
      }
      if (activeRole === 'Blackout' && action.flashUsedThisNight) {
        player.blackoutFlashUsesRemaining = Math.max(0, (player.blackoutFlashUsesRemaining ?? 3) - 1);
        room.lastBlackoutFlashNight[playerId] = room.nightCount;
      }
    };

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player) continue;
      if (!isSuppressedByPurge(player)) continue;
      consumeLimitedNightUse(player, activeRole, action);
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player) continue;
      if (isSuppressedByPurge(player)) continue;
      if (!disabledByAbilityTargets.has(playerId)) continue;
      consumeLimitedNightUse(player, activeRole, action);
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player) continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;
      if (action.action === 'instinct' && activeRole === 'Veteran') {
        continue;
      }
      if (action.action === 'protect' && action.targetId) {
        protected_.add(action.targetId);
        medicTargetThisNight = action.targetId;
      }
      if (action.action === 'mirror' && action.targetId && activeRole === 'Mirror Caster') {
        mirroredTargets.set(action.targetId, playerId);
        nextMirrorTargets[playerId] = action.targetId;
        player.mirrorUsesRemaining = Math.max(0, (player.mirrorUsesRemaining ?? 4) - 1);
      }
      const guardianTargetId = this.getGuardianBlessTargetId(room, player);
      if (action.action === 'bless' && activeRole === 'Guardian Angel' && guardianTargetId && !action.blessBlockedByWarden && !action.blessBlockedBySpoof) {
        blessedTargets.add(remapTeleportedTargetId(guardianTargetId));
        player.guardianAngelUsesRemaining = Math.max(0, (player.guardianAngelUsesRemaining ?? 4) - 1);
      }
      if (action.action === 'lifeguard' && activeRole === 'Survivalist') {
        lifeguardedTargets.add(playerId);
        player.survivalistUsesRemaining = Math.max(0, (player.survivalistUsesRemaining ?? 4) - 1);
      }
      if (activeRole === 'Blackout' && action.flashUsedThisNight) {
        blackoutFlashActive.add(playerId);
        player.blackoutFlashUsesRemaining = Math.max(0, (player.blackoutFlashUsesRemaining ?? 3) - 1);
        room.lastBlackoutFlashNight[playerId] = room.nightCount;
      }
      if (action.action === 'longshot' && activeRole === 'Sniper' && action.queuedTargetId) {
        nextPendingLongshots.push({
          shooterId: playerId,
          targetId: action.queuedTargetId,
          roundsRemaining: 2,
        });
      }
    }

    for (const shot of room.pendingLongshots || []) {
      if (!shot?.targetId) continue;
      const target = room.players.get(shot.targetId);
      if (!target || !target.alive) continue;
      if ((shot.roundsRemaining ?? 0) <= 1) {
        resolvingLongshots.push(shot);
      } else {
        nextPendingLongshots.push({
          ...shot,
          roundsRemaining: shot.roundsRemaining - 1,
        });
      }
    }

    // Update lastMedicTarget for next night
    if (medicTargetThisNight !== null) {
      room.lastMedicTarget = medicTargetThisNight;
    } else {
      // If medic skipped, clear the restriction so they can protect anyone next night
      room.lastMedicTarget = null;
    }
    room.lastWardenTargets = nextWardenTargets;
    room.lastMagicianTargets = nextMagicianTargets;
    room.lastMirrorTargets = nextMirrorTargets;
    room.lastTetherhexTargets = nextTetherhexTargets;
    room.lastSilencerTargets = nextSilencerTargets;
    room.lastHypnoticTargets = nextHypnoticTargets;
    room.lastOverloadTargets = nextOverloadTargets;
    room.lastOracleTargets = nextOracleTargets;
    room.pendingLongshots = nextPendingLongshots;

    for (const [playerId, player] of room.players) {
      if (!Array.isArray(player.arsonistDousedTargetIds)) {
        player.arsonistDousedTargetIds = [];
      }
      player.arsonistDousedTargetIds = player.arsonistDousedTargetIds.filter((targetId) => room.players.get(targetId)?.alive);

      const action = room.nightActions[playerId];
      const activeRole = this.getEffectiveNightRole(player);
      if (!action || activeRole !== 'Arsonist') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'douse') {
        const nextDousedTargetIds = action.targetId && room.players.get(action.targetId)?.alive
          ? [action.targetId]
          : [];
        player.arsonistDousedTargetIds = [...new Set([...player.arsonistDousedTargetIds, ...nextDousedTargetIds])];
      } else if (action.action === 'ignite') {
        const igniteTargetIds = Array.isArray(action.igniteTargetIds)
          ? action.igniteTargetIds.filter((targetId) => room.players.get(targetId)?.alive)
          : [];
        action.igniteTargetIds = igniteTargetIds;
        player.arsonistDousedTargetIds = player.arsonistDousedTargetIds.filter((targetId) => !igniteTargetIds.includes(targetId));
      }
    }

    const nightSummaryLines = this.getNightActionSummaryLines(code);
    nightSummaryLines.forEach((line) => this.appendToPhaseSummary(code, line));

    for (const shot of resolvingLongshots) {
      const target = room.players.get(shot.targetId);
      if (!target || !target.alive) continue;
      if (spoofedTargets.has(shot.targetId)) continue;
      if (veteranAlertIds.has(shot.targetId)) {
        killed.add(shot.shooterId);
      } else if (mirroredTargets.has(shot.targetId)) {
        killed.add(shot.shooterId);
        if (!privateMessages[shot.targetId]) {
          privateMessages[shot.targetId] = [];
        }
        privateMessages[shot.targetId].push(
          this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
        );
      } else if (!protected_.has(shot.targetId) && !blessedTargets.has(shot.targetId) && !lifeguardedTargets.has(shot.targetId)) {
        killed.add(shot.targetId);
        registerKillAttribution(shot.targetId, shot.shooterId);
      } else if (protected_.has(shot.targetId)) {
        if (!privateMessages[shot.targetId]) {
          privateMessages[shot.targetId] = [];
        }
        privateMessages[shot.targetId].push(
          this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
        );
      } else if (lifeguardedTargets.has(shot.targetId)) {
        if (!privateMessages[shot.targetId]) {
          privateMessages[shot.targetId] = [];
        }
        privateMessages[shot.targetId].push(
          this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
        );
      } else {
        if (!privateMessages[shot.targetId]) {
          privateMessages[shot.targetId] = [];
        }
        privateMessages[shot.targetId].push(
          this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
        );
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Arsonist') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;
      if (action.action !== 'ignite') continue;

      const igniteTargetIds = Array.isArray(action.igniteTargetIds) ? action.igniteTargetIds.filter(Boolean) : [];
      for (const igniteTargetId of igniteTargetIds) {
        if (mirroredTargets.has(igniteTargetId)) {
          killed.add(playerId);
          if (!privateMessages[igniteTargetId]) {
            privateMessages[igniteTargetId] = [];
          }
          privateMessages[igniteTargetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(igniteTargetId) && !blessedTargets.has(igniteTargetId) && !lifeguardedTargets.has(igniteTargetId)) {
          killed.add(igniteTargetId);
          killersThisNight.add(playerId);
          registerKillAttribution(igniteTargetId, playerId);
        } else if (protected_.has(igniteTargetId)) {
          if (!privateMessages[igniteTargetId]) {
            privateMessages[igniteTargetId] = [];
          }
          privateMessages[igniteTargetId].push(
            this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
          );
        } else if (lifeguardedTargets.has(igniteTargetId)) {
          if (!privateMessages[igniteTargetId]) {
            privateMessages[igniteTargetId] = [];
          }
          privateMessages[igniteTargetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[igniteTargetId]) {
            privateMessages[igniteTargetId] = [];
          }
          privateMessages[igniteTargetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Pestilence') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'kill' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
          registerKillAttribution(action.targetId, playerId);
        } else if (protected_.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
          );
        } else if (lifeguardedTargets.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player) continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'kill' && activeRole === 'Assassin' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
          registerKillAttribution(action.targetId, playerId);
        } else if (protected_.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [
              this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
            ];
          }
        } else if (lifeguardedTargets.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Sheriff') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'shoot' && action.targetId) {
        const target = room.players.get(action.targetId);
        const isCrewTarget = target?.faction === 'Crew';
        const isNeutralEvilTarget = target?.faction === 'Neutral' && (this.roleCatalog?.Neutral?.Evil || []).includes(target?.role);
        const isNeutralBenignTarget = target?.faction === 'Neutral' && (this.roleCatalog?.Neutral?.Benign || []).includes(target?.role);
        const sheriffCanKillNeutralEvil = room.sheriffKillsNeutralEvil && isNeutralEvilTarget;
        const sheriffTradeEnabled = !!room.sheriffKillsCrewTarget;
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (sheriffCanKillNeutralEvil || ((isCrewTarget || isNeutralBenignTarget) && sheriffTradeEnabled)) {
          killed.add(playerId);
          if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
            killed.add(action.targetId);
            killersThisNight.add(playerId);
            registerKillAttribution(action.targetId, playerId);
          } else if (protected_.has(action.targetId)) {
            if (!privateMessages[action.targetId]) {
              privateMessages[action.targetId] = [
                this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
              ];
            }
          } else if (lifeguardedTargets.has(action.targetId)) {
            if (!privateMessages[action.targetId]) {
              privateMessages[action.targetId] = [];
            }
            privateMessages[action.targetId].push(
              this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
            );
          } else {
            if (!privateMessages[action.targetId]) {
              privateMessages[action.targetId] = [];
            }
            privateMessages[action.targetId].push(
              this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
            );
          }
        } else if (isCrewTarget || isNeutralBenignTarget || isNeutralEvilTarget) {
          killed.add(playerId);
        } else if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
          registerKillAttribution(action.targetId, playerId);
        } else if (protected_.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [
              this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
            ];
          }
        } else if (lifeguardedTargets.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      } else if (action.action === 'search' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
          continue;
        }
        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        if (blackoutFlashActive.size > 0) {
          privateMessages[playerId].push(
            this.createPrivateSystemMessage(code, 'You couldn\'t see anything last night.', 'Blackout')
          );
        } else {
          const target = room.players.get(action.targetId);
          searchResults[playerId] = {
            targetId: action.targetId,
            targetName: target.name,
            role: target.role,
            faction: target.faction
          };
          privateMessages[playerId].push(
            this.createPrivateSystemMessage(code, `Your investigation found that ${target.name} is the ${target.role}.`, 'Sheriff')
          );
        }
      }
    }

    const nextInvestigatorTargets = {};
    const killHistoryForInvestigators = new Set([...recentKillers, ...killersThisNight]);
    const nextTrackerTargets = {};
    const nextStalkerTargets = {};
    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Investigator') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      const previousTargets = room.lastInvestigatorTargets[playerId] || [];
      if (action.action === 'examine' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
          nextInvestigatorTargets[playerId] = [...previousTargets.slice(-1), action.targetId];
          continue;
        }
        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        if (blackoutFlashActive.size > 0) {
          privateMessages[playerId].push(
            this.createPrivateSystemMessage(code, 'You couldn\'t see anything last night.', 'Blackout')
          );
        } else {
          const target = room.players.get(action.targetId);
          const hasKilledRecently = killHistoryForInvestigators.has(action.targetId);
          searchResults[playerId] = {
            targetId: action.targetId,
            targetName: target.name,
            resultType: 'kill-check',
            hasKilledRecently,
            roundsChecked: 2,
          };
          privateMessages[playerId].push(
            this.createPrivateSystemMessage(
              code,
              hasKilledRecently
                ? `${target.name} has killed someone in the last 2 rounds.`
                : `${target.name} has not killed anyone in the last 2 rounds.`,
              'Investigator'
            )
          );
        }
        nextInvestigatorTargets[playerId] = [...previousTargets.slice(-1), action.targetId];
      } else {
        nextInvestigatorTargets[playerId] = [];
      }
    }
    room.lastInvestigatorTargets = nextInvestigatorTargets;

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Tracker') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'track' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
          nextTrackerTargets[playerId] = action.targetId;
          continue;
        }
        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        if (blackoutFlashActive.size > 0) {
          privateMessages[playerId].push(
            this.createPrivateSystemMessage(code, 'You couldn\'t see anything last night.', 'Blackout')
          );
        } else {
          const trackedPlayer = room.players.get(action.targetId);
          const trackedAction = room.nightActions[action.targetId];
          const interactionTargetIds = disabledAbilityTargets.has(action.targetId)
            ? []
            : getInteractionTargetIds(trackedAction);
          const interactedTarget = interactionTargetIds.length > 0
            ? room.players.get(interactionTargetIds[0])
            : null;
          const interactedWithPlayer = interactedTarget !== undefined && interactedTarget !== null;

          searchResults[playerId] = {
            targetId: action.targetId,
            targetName: trackedPlayer?.name || 'Unknown',
            resultType: 'track',
            interactedWithId: interactedWithPlayer ? interactedTarget.id : null,
            interactedWithName: interactedWithPlayer ? interactedTarget.name : null,
          };

          privateMessages[playerId].push(
            this.createPrivateSystemMessage(
              code,
              interactedWithPlayer
                ? `${trackedPlayer.name} interacted with ${interactedTarget.name} tonight.`
                : `${trackedPlayer.name} did not interact with anyone tonight.`,
              'Tracker'
            )
          );
        }

        nextTrackerTargets[playerId] = action.targetId;
      } else {
        nextTrackerTargets[playerId] = null;
      }
    }
    room.lastTrackerTargets = nextTrackerTargets;

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Stalker') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'stalk' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
          nextStalkerTargets[playerId] = action.targetId;
          continue;
        }
        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        if (blackoutFlashActive.size > 0) {
          privateMessages[playerId].push(
            this.createPrivateSystemMessage(code, 'You couldn\'t see anything last night.', 'Blackout')
          );
        } else {
          const stalkedPlayer = room.players.get(action.targetId);
          const visitors = Object.entries(room.nightActions)
            .filter(([visitorId, visitorAction]) => (
              visitorId !== playerId
              && !disabledAbilityTargets.has(visitorId)
              && getInteractionTargetIds(visitorAction).includes(action.targetId)
            ))
            .map(([visitorId]) => room.players.get(visitorId))
            .filter(Boolean);

          searchResults[playerId] = {
            targetId: action.targetId,
            targetName: stalkedPlayer?.name || 'Unknown',
            resultType: 'stalk',
            visitorIds: visitors.map((visitor) => visitor.id),
            visitorNames: visitors.map((visitor) => visitor.name),
          };

          privateMessages[playerId].push(
            this.createPrivateSystemMessage(
              code,
              visitors.length
                ? `${stalkedPlayer.name} was interacted by ${visitors.map((visitor) => visitor.name).join(', ')} tonight.`
                : `${stalkedPlayer.name} was not interacted by anyone tonight.`,
              'Stalker'
            )
          );
        }

        nextStalkerTargets[playerId] = action.targetId;
      } else {
        nextStalkerTargets[playerId] = null;
      }
    }
    room.lastStalkerTargets = nextStalkerTargets;

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Traplord') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      const trapTargetIds = Array.isArray(action.targetIds) ? action.targetIds.filter(Boolean) : [];
      if (action.action !== 'trap' || trapTargetIds.length < 3) continue;

      if (trapTargetIds.some((selectedTargetId) => veteranAlertIds.has(selectedTargetId))) {
        killed.add(playerId);
        continue;
      }

      if (!privateMessages[playerId]) privateMessages[playerId] = [];
      if (blackoutFlashActive.size > 0) {
        privateMessages[playerId].push(
          this.createPrivateSystemMessage(code, 'You couldn\'t see anything last night.', 'Blackout')
        );
        continue;
      }

      const shuffledRoles = trapTargetIds
        .map((selectedTargetId) => room.players.get(selectedTargetId)?.role)
        .filter(Boolean)
        .sort(() => Math.random() - 0.5);

      privateMessages[playerId].push(
        this.createPrivateSystemMessage(
          code,
          `Your trap uncovered these roles: ${shuffledRoles.join(', ')}.`,
          'Traplord'
        )
      );
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Vitalist') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;
      if (action.action === 'protect' && action.targetId && veteranAlertIds.has(action.targetId)) {
        killed.add(playerId);
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Warden') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;
      if (action.action === 'guard' && action.targetId && veteranAlertIds.has(action.targetId)) {
        killed.add(playerId);
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Mirror Caster') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;
      if (action.action === 'mirror' && action.targetId && veteranAlertIds.has(action.targetId)) {
        killed.add(playerId);
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Guardian Angel') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;
      const guardianTargetId = this.getGuardianBlessTargetId(room, player);
      if (action.action === 'bless' && guardianTargetId && veteranAlertIds.has(guardianTargetId)) {
        killed.add(playerId);
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Hypnotic') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'kill' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
          registerKillAttribution(action.targetId, playerId);
        } else if (protected_.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
          );
        } else if (lifeguardedTargets.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'The Vessel') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;
      if (!player.vesselAwakened) continue;

      if (action.action === 'kill' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
          registerKillAttribution(action.targetId, playerId);
        } else if (protected_.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
          );
        } else if (lifeguardedTargets.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Overload') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'kill' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
          registerKillAttribution(action.targetId, playerId);
        } else if (protected_.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
          );
        } else if (lifeguardedTargets.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Blackout') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'kill' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
          registerKillAttribution(action.targetId, playerId);
        } else if (protected_.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
          );
        } else if (lifeguardedTargets.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'The Purge') continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'kill' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
          registerKillAttribution(action.targetId, playerId);
        } else if (protected_.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
          );
        } else if (lifeguardedTargets.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Blackmailer') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'kill' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
          registerKillAttribution(action.targetId, playerId);
        } else if (protected_.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
          );
        } else if (lifeguardedTargets.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Tetherhex') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'kill' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(action.targetId) && !blessedTargets.has(action.targetId) && !lifeguardedTargets.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
          registerKillAttribution(action.targetId, playerId);
        } else if (protected_.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
          );
        } else if (lifeguardedTargets.has(action.targetId)) {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'You protected yourself from death during the night.', 'Survivalist')
          );
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A Guardian Angel blessed you through the night.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Tetherhex') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;
      if (!action.interlinkedUsedThisNight || !action.interlinkedTargetId) continue;
      if (!killed.has(playerId)) continue;
      const linkedTarget = room.players.get(action.interlinkedTargetId);
      if (!linkedTarget || !linkedTarget.alive) continue;
      killed.add(action.interlinkedTargetId);
      tetheredVictims.add(action.interlinkedTargetId);
    }

    for (const deadId of Array.from(killed)) {
      const deadPlayer = room.players.get(deadId);
      if (!deadPlayer || deadPlayer.role !== 'Pestilence') continue;
      killed.delete(deadId);
      killAttributions.delete(deadId);
    }

    let karmaTriggered = true;
    while (karmaTriggered) {
      karmaTriggered = false;
      for (const deadId of Array.from(killed)) {
        const deadPlayer = room.players.get(deadId);
        if (!deadPlayer || deadPlayer.role !== 'Karma') continue;
        const killerId = killAttributions.get(deadId);
        if (!killerId || killed.has(killerId)) continue;
        const killer = room.players.get(killerId);
        if (!killer || !killer.alive) continue;
        killed.add(killerId);
        karmaTriggered = true;
      }
    }

    for (const deadId of Array.from(killed)) {
      const deadPlayer = room.players.get(deadId);
      const killerId = killAttributions.get(deadId);
      if (!deadPlayer || deadPlayer.role !== 'The Vessel' || deadPlayer.vesselAwakened || !killerId) continue;
      killed.delete(deadId);
      deadPlayer.vesselAwakened = true;
      if (!privateMessages[deadId]) privateMessages[deadId] = [];
      privateMessages[deadId].push(
        this.createPrivateSystemMessage(code, 'It is over when i say it is', 'The Vessel')
      );
    }

    for (const deadId of killed) {
      const deadPlayer = room.players.get(deadId);
      if (deadPlayer) {
        const killerId = killAttributions.get(deadId);
        const killer = killerId ? room.players.get(killerId) : null;
        if (killer) {
          if (!privateMessages[deadId]) privateMessages[deadId] = [];
          privateMessages[deadId].push(
            this.createPrivateSystemMessage(
              code,
              this.getEffectiveNightRole(killer) === 'Arsonist'
                ? 'You have been burnt to crisp by the Arsonist.'
                : `You have been killed by ${killer.name}.`,
              'Death'
            )
          );
        }
        deadPlayer.alive = false;
        const deathText = tetheredVictims.has(deadId)
          ? `${deadPlayer.name} has been Tethered.`
          : room.anonymousEjects
            ? `${deadPlayer.name} was found dead.`
            : `${deadPlayer.name} was found dead. They were a ${deadPlayer.role}.`;
        messages.push({
          type: tetheredVictims.has(deadId) ? 'tethered' : 'death',
          text: deathText,
          playerId: deadId,
          role: deadPlayer.role,
          faction: deadPlayer.faction,
          source: tetheredVictims.has(deadId) ? 'Tetherhex' : null,
          public: true
        });
        if (deadPlayer.role === 'Redflag') {
          const killerId = killAttributions.get(deadId);
          const killer = killerId ? room.players.get(killerId) : null;
          if (killer) {
            messages.push({
              type: 'system',
              text: `${killer.name} confesses to murdering ${deadPlayer.name}.`,
              playerId: killerId,
              targetId: deadId,
              source: 'Redflag',
              public: true
            });
          }
        }

        for (const [, oraclePlayer] of room.players) {
          if (oraclePlayer.role !== 'Oracle') continue;
          if (oraclePlayer.oracleMarkedTargetId !== deadId) continue;
          const killerId = killAttributions.get(deadId);
          const killer = killerId ? room.players.get(killerId) : null;
          if (!killer) continue;
          messages.push({
            type: 'system',
            text: `${deadPlayer.name} was killed by ${killer.name}.`,
            playerId: killerId,
            targetId: deadId,
            source: 'Oracle',
            public: true
          });
        }
      }
    }

    for (const [, player] of room.players) {
      if (player.role !== 'Executioner') continue;
      if (player.executionerTargetId && killed.has(player.executionerTargetId)) {
        this.convertExecutionerToAmnesiac(room, player.id);
        if (player.alive) {
          if (!privateMessages[player.id]) privateMessages[player.id] = [];
          privateMessages[player.id].push(
            this.createPrivateSystemMessage(code, 'Your target has died. You have become an Amnesiac.', 'Executioner')
          );
        }
      }
    }

    for (const [, player] of room.players) {
      if (player.role !== 'Guardian Angel') continue;
      if (player.guardianAngelTargetId && killed.has(player.guardianAngelTargetId)) {
        this.convertGuardianAngelToAmnesiac(room, player.id);
        if (player.alive) {
          if (!privateMessages[player.id]) privateMessages[player.id] = [];
          privateMessages[player.id].push(
            this.createPrivateSystemMessage(code, 'Your target has died. You have become an Amnesiac.', 'Guardian Angel')
          );
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || !player.alive || activeRole !== 'Alturist') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;
      if (action.action !== 'sacrifice' || !action.targetId) continue;
      const revivedPlayer = room.players.get(action.targetId);
      if (!revivedPlayer || revivedPlayer.alive) continue;

      revivedPlayer.alive = true;
      revivedTonight.add(revivedPlayer.id);
      killed.add(playerId);
      registerKillAttribution(playerId, revivedPlayer.id);
      messages.push({
        type: 'system',
        text: `${player.name} sacrificed themselves to revive ${revivedPlayer.name}.`,
        playerId,
        targetId: revivedPlayer.id,
        source: 'Alturist',
        public: true
      });
    }

    if (revivedTonight.size > 0) {
      for (const revivedPlayerId of revivedTonight) {
        const revivedPlayer = room.players.get(revivedPlayerId);
        if (!revivedPlayer) continue;
        revivedPlayer.alive = true;
      }
    }

    if (killed.size === 0 && messages.length === 0) {
      messages.push({
        type: 'peaceful',
        text: 'The night passed peacefully. No one was harmed.',
        public: true
      });
    }

    for (const [, player] of room.players) {
      if (!Array.isArray(player.arsonistDousedTargetIds)) continue;
      player.arsonistDousedTargetIds = player.arsonistDousedTargetIds.filter((targetId) => room.players.get(targetId)?.alive);
    }

    for (const [, player] of room.players) {
      this.clearImitatorMimic(player);
      if (player.role === 'Alturist') {
        player.alturistReviveTargetId = null;
      }
    }

    room.morningMessages = messages;
    const alivePlayers = Array.from(room.players.values()).filter(p => p.alive).map(p => p.name);
    const morningLines = messages.filter((msg) => msg.public).map((msg) => msg.text);
    morningLines.push(`Alive players: ${alivePlayers.join(', ') || 'No one'}.`);
    room.state = 'morning';
    this.beginPhaseSummary(code, `Morning ${room.nightCount} begins.`, morningLines);
    room.searchResults = searchResults;
    room.recentKillers = [...(room.recentKillers || []), Array.from(killersThisNight)].slice(-2);
    room.nightActions = {};

    const winCheck = this.checkWinCondition(code);
    if (winCheck) {
      room.state = 'ended';
      room.winner = winCheck;
    }

    return { room, messages, searchResults, privateMessages, winner: room.winner };
  }

  submitVote(code, voterId, targetId) {
    const room = this.rooms.get(code);
    if (!room || room.state !== 'voting') return { error: 'Not in voting phase' };

    const voter = room.players.get(voterId);
    if (!voter || !voter.alive) return { error: 'Invalid voter' };
    if (room.blackmailedPlayers?.[voterId]) return { error: 'You have been blackmailed and cannot vote today' };

    if (targetId !== 'skip') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (targetId === voterId) return { error: 'Cannot vote for yourself' };
    }

    room.votes[voterId] = targetId;

    return { success: true, room };
  }

  submitVotingAbility(code, playerId, action, targetId, targetIds = null) {
    const room = this.rooms.get(code);
    if (!room || room.state !== 'voting') return { error: 'Not in voting phase' };

    const player = room.players.get(playerId);
    if (!player || !player.alive) return { error: 'Invalid player' };

    if (player.role === 'Oracle') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (action !== 'purify') return { error: 'Invalid action for Oracle' };
      if ((player.oraclePurifyUsesRemaining ?? 2) <= 0) return { error: 'You have no Purify uses remaining' };
      player.oraclePurifiedTargetId = targetId;
      player.oraclePurifyUsesRemaining = Math.max(0, (player.oraclePurifyUsesRemaining ?? 2) - 1);
      return { success: true, room };
    }

    if (player.role === 'Inquisitor') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (action !== 'exile') return { error: 'Invalid action for Inquisitor' };
      if (player.inquisitorExileUsed) return { error: 'You have already used Exile' };
      player.inquisitorExiledTargetId = targetId;
      player.inquisitorExileUsed = true;
      return { success: true, room, resolveNow: true };
    }

    if (player.role === 'Disruptor') {
      if (action !== 'veto') return { error: 'Invalid action for Disruptor' };
      if ((player.disruptorVetoUsesRemaining ?? 1) <= 0 || player.disruptorVetoUsed) {
        return { error: 'You have no Veto uses remaining' };
      }
      player.disruptorVetoUsesRemaining = 0;
      player.disruptorVetoUsed = true;
      return { success: true, room, resolveNow: true };
    }

    if (player.role === 'Manipulator') {
      if (action !== 'surprise') return { error: 'Invalid action for Manipulator' };
      if ((player.manipulatorSurpriseUsesRemaining ?? 2) <= 0 || player.manipulatorSurpriseUsed) {
        return { error: 'You have no Surprise uses remaining' };
      }
      player.manipulatorSurpriseUsesRemaining = Math.max(0, (player.manipulatorSurpriseUsesRemaining ?? 2) - 1);
      player.manipulatorSurpriseUsed = true;
      return { success: true, room };
    }

    if (player.role === 'Scientist') {
      if (action !== 'experiment') return { error: 'Invalid action for Scientist' };
      if ((player.scientistExperimentUsesRemaining ?? 1) <= 0) return { error: 'You have no Experiment uses remaining' };
      if (!Array.isArray(targetIds)) return { error: 'Invalid targets' };
      const normalizedTargetIds = [...new Set(targetIds.map((id) => String(id || '').trim()).filter(Boolean))];
      if (normalizedTargetIds.length !== 2) return { error: 'Choose exactly 2 players' };
      if (normalizedTargetIds.includes(playerId)) return { error: 'Cannot target yourself' };
      for (const selectedTargetId of normalizedTargetIds) {
        const target = room.players.get(selectedTargetId);
        if (!target || !target.alive) return { error: 'Invalid target' };
      }
      player.scientistSwapTargetIds = normalizedTargetIds;
      player.scientistExperimentUsesRemaining = 0;
      return { success: true, room };
    }

    if (player.role === 'Swapper') {
      if (action !== 'swap') return { error: 'Invalid action for Swapper' };
      if (!Array.isArray(targetIds)) return { error: 'Invalid targets' };
      const normalizedTargetIds = [...new Set(targetIds.map((id) => String(id || '').trim()).filter(Boolean))];
      if (normalizedTargetIds.length !== 2) return { error: 'Choose exactly 2 players' };
      if (normalizedTargetIds.includes(playerId)) return { error: 'Cannot target yourself' };
      for (const selectedTargetId of normalizedTargetIds) {
        const target = room.players.get(selectedTargetId);
        if (!target || !target.alive) return { error: 'Invalid target' };
      }
      player.swapperSwapTargetIds = normalizedTargetIds;
      return { success: true, room };
    }

    return { error: 'You have no voting ability' };
  }

  updateRoomSettings(code, requesterId, settings) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== requesterId) return { error: 'Only the host can change settings' };
    if (room.state !== 'lobby') return { error: 'Settings can only be changed in the lobby' };

    if (typeof settings.anonymousVotes === 'boolean') {
      room.anonymousVotes = settings.anonymousVotes;
    }
    if (typeof settings.anonymousEjects === 'boolean') {
      room.anonymousEjects = settings.anonymousEjects;
    }
    if (typeof settings.hiddenRoleList === 'boolean') {
      room.hiddenRoleList = settings.hiddenRoleList;
    }
    if (typeof settings.disableVillagerRole === 'boolean') {
      room.disableVillagerRole = settings.disableVillagerRole;
    }
    if (typeof settings.useClassicFivePlayerSetup === 'boolean') {
      room.useClassicFivePlayerSetup = settings.useClassicFivePlayerSetup;
    }
    if (typeof settings.sheriffKillsCrewTarget === 'boolean') {
      room.sheriffKillsCrewTarget = settings.sheriffKillsCrewTarget;
    }
    if (typeof settings.sheriffKillsNeutralEvil === 'boolean') {
      room.sheriffKillsNeutralEvil = settings.sheriffKillsNeutralEvil;
    }

    room.lastAction = Date.now();
    return { success: true, room };
  }

  checkAllVotesSubmitted(code) {
    const room = this.rooms.get(code);
    if (!room) return false;

    for (const [id, player] of room.players) {
      if (!player.alive) continue;
      if (room.blackmailedPlayers?.[id]) continue;
      if (!room.votes[id]) return false;
    }
    return true;
  }

  resolveVotes(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const getSwapperVoteState = () => {
      const swapper = Array.from(room.players.values()).find((candidate) => (
        candidate.role === 'Swapper'
        && candidate.alive
        && Array.isArray(candidate.swapperSwapTargetIds)
        && candidate.swapperSwapTargetIds.length === 2
      ));

      if (!swapper) {
        return {
          remapTargetId: (targetId) => targetId,
          message: null,
        };
      }

      const [firstPlayerId, secondPlayerId] = swapper.swapperSwapTargetIds;
      swapper.swapperSwapTargetIds = [];

      const firstPlayer = room.players.get(firstPlayerId);
      const secondPlayer = room.players.get(secondPlayerId);
      if (!firstPlayer || !secondPlayer || !firstPlayer.alive || !secondPlayer.alive) {
        return {
          remapTargetId: (targetId) => targetId,
          message: null,
        };
      }

      return {
        remapTargetId: (targetId) => {
          if (targetId === firstPlayerId) return secondPlayerId;
          if (targetId === secondPlayerId) return firstPlayerId;
          return targetId;
        },
        message: `${firstPlayer.name} and ${secondPlayer.name} had their places swapped by the Swapper.`,
      };
    };

    const applyScientistExperiment = () => {
      const scientist = Array.from(room.players.values()).find((candidate) => (
        candidate.role === 'Scientist'
        && candidate.alive
        && Array.isArray(candidate.scientistSwapTargetIds)
        && candidate.scientistSwapTargetIds.length === 2
      ));

      if (!scientist) return null;
      const [firstPlayerId, secondPlayerId] = scientist.scientistSwapTargetIds;
      scientist.scientistSwapTargetIds = [];

      const firstPlayer = room.players.get(firstPlayerId);
      const secondPlayer = room.players.get(secondPlayerId);
      if (!firstPlayer || !secondPlayer || !firstPlayer.alive || !secondPlayer.alive) return null;

      this.swapScientistRolePackages(room, firstPlayerId, secondPlayerId);
      return `${firstPlayer.name} and ${secondPlayer.name} had their roles switched by the Scientist.`;
    };

    const manipulatorSurprise = Array.from(room.players.values()).find((candidate) => (
      candidate.role === 'Manipulator'
      && candidate.alive
      && candidate.manipulatorSurpriseUsed
    ));

    const { remapTargetId: remapVoteTargetId, message: swapperMessage } = getSwapperVoteState();
    const appendVotingPreResolutionLines = () => {
      if (swapperMessage) this.appendToPhaseSummary(code, swapperMessage);
      if (manipulatorSurprise) this.appendToPhaseSummary(code, 'The Manipulator has played with the results.');
    };

    const inquisitorExile = Array.from(room.players.values()).find((candidate) => (
      candidate.role === 'Inquisitor'
      && candidate.alive
      && candidate.inquisitorExiledTargetId
      && room.players.get(remapVoteTargetId(candidate.inquisitorExiledTargetId))?.alive
    ));

    if (inquisitorExile) {
      const eliminated = remapVoteTargetId(inquisitorExile.inquisitorExiledTargetId);
      const player = room.players.get(eliminated);
      player.alive = false;

      const message = {
        type: 'eliminated',
        text: `${player.name} was exiled by the Inquisitor.`,
        playerId: eliminated,
        role: player.role,
        faction: player.faction,
        source: 'Inquisitor',
        public: true
      };

      room.eliminatedToday = eliminated;
      room.votes = {};
      appendVotingPreResolutionLines();
      for (const [, candidate] of room.players) {
        candidate.oraclePurifiedTargetId = null;
        candidate.inquisitorExiledTargetId = null;
        candidate.manipulatorSurpriseUsed = false;
        candidate.swapperSwapTargetIds = [];
      }
      this.appendToPhaseSummary(code, message.text);

      for (const [, candidate] of room.players) {
        if (candidate.role !== 'Guardian Angel') continue;
        if (candidate.guardianAngelTargetId === eliminated) {
          this.convertGuardianAngelToAmnesiac(room, candidate.id);
        }
      }

      const executionerWinner = Array.from(room.players.values()).find((candidate) => (
        candidate.role === 'Executioner'
        && candidate.executionerTargetId === eliminated
      ));

      if (executionerWinner) {
        room.state = 'ended';
        room.winner = this.withNeutralBenignCoWinners(room, this.withGuardianAngelCoWinners(room, {
          winner: 'Executioner',
          reason: `${executionerWinner.name} got their target voted out. Everyone else loses.`,
        }));

        return {
          room,
          message,
          voteCounts: {},
          eliminated,
          winner: room.winner
        };
      }

      if (player.role === 'Jester') {
        room.state = 'ended';
        room.winner = this.withNeutralBenignCoWinners(room, this.withGuardianAngelCoWinners(room, {
          winner: 'Jester',
          reason: 'Jester tricked the town into voting them out. Everyone else loses.',
        }));

        return {
          room,
          message,
          voteCounts: {},
          eliminated,
          winner: room.winner
        };
      }

      const scientistMessage = applyScientistExperiment();
      if (scientistMessage) {
        this.appendToPhaseSummary(code, scientistMessage);
      }
      for (const [, candidate] of room.players) {
        candidate.scientistSwapTargetIds = [];
      }

      const winCheck = this.checkWinCondition(code);
      if (winCheck) {
        room.state = 'ended';
        room.winner = winCheck;
      } else {
        room.state = 'night';
        room.nightCount++;
        room.nightActions = {};
        room.blackmailedPlayers = {};
        room.silencedPlayers = {};
        this.beginPhaseSummary(code, `Night ${room.nightCount} begins. Chat is locked until morning.`);
      }

      return {
        room,
        message,
        voteCounts: {},
        eliminated,
        winner: room.winner
      };
    }

    const disruptorVeto = Array.from(room.players.values()).find((candidate) => (
      candidate.role === 'Disruptor'
      && candidate.alive
      && candidate.disruptorVetoUsed
    ));

    if (disruptorVeto) {
      const message = {
        type: 'system',
        text: 'The Disruptor has veto\'d the voting.',
        source: 'Disruptor',
        public: true
      };

      room.eliminatedToday = null;
      room.votes = {};
      appendVotingPreResolutionLines();
      for (const [, candidate] of room.players) {
        candidate.oraclePurifiedTargetId = null;
        candidate.inquisitorExiledTargetId = null;
        candidate.disruptorVetoUsed = false;
        candidate.manipulatorSurpriseUsed = false;
        candidate.swapperSwapTargetIds = [];
      }
      this.appendToPhaseSummary(code, message.text);

      const scientistMessage = applyScientistExperiment();
      if (scientistMessage) {
        this.appendToPhaseSummary(code, scientistMessage);
      }
      for (const [, candidate] of room.players) {
        candidate.scientistSwapTargetIds = [];
      }

      const winCheck = this.checkWinCondition(code);
      if (winCheck) {
        room.state = 'ended';
        room.winner = winCheck;
      } else {
        room.state = 'night';
        room.nightCount++;
        room.nightActions = {};
        room.blackmailedPlayers = {};
        room.silencedPlayers = {};
        this.beginPhaseSummary(code, `Night ${room.nightCount} begins. Chat is locked until morning.`);
      }

      return {
        room,
        message,
        voteCounts: {},
        eliminated: null,
        winner: room.winner
      };
    }

    const voteCounts = {};
    let skipVotes = 0;

    const boostedAssassinVoterIds = manipulatorSurprise
      ? new Set(
        Array.from(room.players.values())
          .filter((candidate) => candidate.alive && candidate.faction === 'Assassin')
          .map((candidate) => candidate.id)
      )
      : null;

    for (const [voterId, targetId] of Object.entries(room.votes)) {
      const voteWeight = boostedAssassinVoterIds?.has(voterId) ? 2 : 1;
      if (targetId === 'skip') {
        skipVotes += voteWeight;
      } else {
        const remappedTargetId = remapVoteTargetId(targetId);
        voteCounts[remappedTargetId] = (voteCounts[remappedTargetId] || 0) + voteWeight;
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      const activeRole = this.getEffectiveNightRole(player);
      if (!player || activeRole !== 'Prophet') continue;
      if (isSuppressedByPurge(player)) continue;
      if (disabledAbilityTargets.has(playerId)) continue;

      if (action.action === 'gospel' && action.targetId) {
        player.prophetGospelUsesRemaining = Math.max(0, (player.prophetGospelUsesRemaining ?? 2) - 1);
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
          continue;
        }
        const target = room.players.get(action.targetId);
        if (!target) continue;
        searchResults[playerId] = {
          targetId: action.targetId,
          targetName: target.name,
          role: target.role,
          faction: target.faction
        };
        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        privateMessages[playerId].push(
          this.createPrivateSystemMessage(code, `Your gospel revealed that ${target.name} is the ${target.role}.`, 'Prophet')
        );
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
      const oracleProtector = Array.from(room.players.values()).find((candidate) => (
        candidate.role === 'Oracle'
        && candidate.alive
        && remapVoteTargetId(candidate.oraclePurifiedTargetId) === eliminated
      ));

      if (oracleProtector) {
        message = {
          type: 'protected',
          text: 'The exiled player was protected by the Oracle.',
          playerId: eliminated,
          source: 'Oracle',
          public: true
        };
        eliminated = null;
      } else {
        player.alive = false;
        const eliminationText = room.anonymousEjects
          ? `${player.name} was eliminated by vote.`
          : `${player.name} was eliminated by vote. They were a ${player.role}.`;
        message = {
          type: 'eliminated',
          text: eliminationText,
          playerId: eliminated,
          role: player.role,
          faction: player.faction,
          public: true
        };
      }

      const executionerWinner = eliminated ? Array.from(room.players.values()).find((candidate) => (
        candidate.role === 'Executioner'
        && candidate.executionerTargetId === eliminated
      )) : null;

      if (executionerWinner) {
        room.eliminatedToday = eliminated;
        room.votes = {};
        this.appendToPhaseSummary(code, message.text);
        room.state = 'ended';
        room.winner = this.withNeutralBenignCoWinners(room, this.withGuardianAngelCoWinners(room, {
          winner: 'Executioner',
          reason: `${executionerWinner.name} got their target voted out. Everyone else loses.`,
        }));

        return {
          room,
          message,
          voteCounts,
          eliminated,
          winner: room.winner
        };
      }

      if (eliminated && player.role === 'Jester') {
        room.eliminatedToday = eliminated;
        room.votes = {};
        this.appendToPhaseSummary(code, message.text);
        room.state = 'ended';
        room.winner = this.withNeutralBenignCoWinners(room, this.withGuardianAngelCoWinners(room, {
          winner: 'Jester',
          reason: 'Jester tricked the town into voting them out. Everyone else loses.',
        }));

        return {
          room,
          message,
          voteCounts,
          eliminated,
          winner: room.winner
        };
      }
    }

    room.eliminatedToday = eliminated;
    room.votes = {};
    appendVotingPreResolutionLines();
    for (const [, candidate] of room.players) {
      candidate.oraclePurifiedTargetId = null;
      candidate.inquisitorExiledTargetId = null;
      candidate.disruptorVetoUsed = false;
      candidate.manipulatorSurpriseUsed = false;
      candidate.swapperSwapTargetIds = [];
    }
    this.appendToPhaseSummary(code, message.text);

    for (const [, candidate] of room.players) {
      if (candidate.role !== 'Guardian Angel') continue;
      if (candidate.guardianAngelTargetId === eliminated) {
        this.convertGuardianAngelToAmnesiac(room, candidate.id);
      }
    }

    const scientistMessage = applyScientistExperiment();
    if (scientistMessage) {
      this.appendToPhaseSummary(code, scientistMessage);
    }
    for (const [, candidate] of room.players) {
      candidate.scientistSwapTargetIds = [];
    }

    const winCheck = this.checkWinCondition(code);
    if (winCheck) {
      room.state = 'ended';
      room.winner = winCheck;
    } else {
      room.state = 'night';
      room.nightCount++;
      room.nightActions = {};
      room.blackmailedPlayers = {};
      room.silencedPlayers = {};
      this.beginPhaseSummary(code, `Night ${room.nightCount} begins. Chat is locked until morning.`);
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
    for (const [, player] of room.players) {
      player.manipulatorSurpriseUsed = false;
    }
    this.beginPhaseSummary(code, 'Voting has started.');
    return room;
  }

  checkWinCondition(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    let aliveCrewCount = 0;
    let aliveAssassinCount = 0;
    let aliveNeutralEvilCount = 0;
    let aliveNeutralKillingCount = 0;
    let aliveNeutralKillingRoles = [];
    let totalAliveCount = 0;

    for (const [, player] of room.players) {
      if (!player.alive) continue;
      totalAliveCount++;
      if (player.faction === 'Crew') aliveCrewCount++;
      else if (player.faction === 'Assassin') aliveAssassinCount++;
      else if (player.faction === 'Neutral' && this.roleCatalog?.Neutral?.Evil?.includes(player.role)) aliveNeutralEvilCount++;
      else if (player.faction === 'Neutral' && (this.roleCatalog?.Neutral?.Killing?.includes(player.role) || player.role === 'Pestilence')) {
        aliveNeutralKillingCount++;
        aliveNeutralKillingRoles.push(player.role);
      }
    }

    if (totalAliveCount === 1) {
      const soleSurvivor = Array.from(room.players.values()).find((player) => player.alive);
      if (soleSurvivor?.role === 'Pestilence') {
        return { winner: 'Pestilence', reason: 'Pestilence is the last one standing.' };
      }
      if (soleSurvivor?.role === 'Wither') {
        return { winner: 'Nobody', reason: 'Wither outlived everyone, but never became Pestilence.' };
      }
    }

    // If the last remaining real contenders wipe each other out at once,
    // nobody wins. This covers cases like Sheriff trading with a Neutral Killer.
    if (aliveCrewCount === 0 && aliveAssassinCount === 0 && aliveNeutralKillingCount === 0 && totalAliveCount === 0) {
      return { winner: 'Nobody', reason: 'The last contenders wiped each other out. No one wins.' };
    }

    // Neutral killers still win even if a living Guardian Angel is tied to them.
    // That Guardian Angel is treated as a co-winner, not a blocker the killer has to eliminate.
    if (aliveNeutralKillingCount > 0 && aliveCrewCount === 0 && aliveAssassinCount === 0 && aliveNeutralEvilCount === 0) {
      if (aliveNeutralKillingRoles.every((role) => role === 'Wither')) {
        return { winner: 'Nobody', reason: 'Wither never became Pestilence before everyone else fell.' };
      }
      const neutralKillingWinner = aliveNeutralKillingRoles[0] || 'Overload';
      return this.withNarcissistCoWinners(room, this.withNeutralBenignCoWinners(room, this.withGuardianAngelCoWinners(room, { winner: neutralKillingWinner, reason: `${neutralKillingWinner} has outlived everyone else!` })));
    }

    if (aliveAssassinCount === 0 && aliveNeutralKillingCount === 0) {
      return this.withNarcissistCoWinners(room, this.withNeutralBenignCoWinners(room, this.withGuardianAngelCoWinners(room, { winner: 'Crew', reason: 'All hostile factions have been eliminated!' })));
    }

    if (aliveAssassinCount >= aliveCrewCount) {
      return this.withNarcissistCoWinners(room, this.withNeutralBenignCoWinners(room, this.withGuardianAngelCoWinners(room, { winner: 'Assassin', reason: 'Assassins have taken control!' })));
    }

    return null;
  }

  withGuardianAngelCoWinners(room, winner) {
    if (!room || !winner) return winner;

    const baseWinner = String(winner.winner || '').trim();
    if (!baseWinner) return winner;

    const guardianAngelWinnerIds = Array.from(room.players.values())
      .filter((player) => player.role === 'Guardian Angel' && player.guardianAngelTargetId)
      .filter((player) => {
        const target = room.players.get(player.guardianAngelTargetId);
        if (!target || !target.alive) return false;
        if (baseWinner === 'Crew') return target.faction === 'Crew';
        if (baseWinner === 'Assassin') return target.faction === 'Assassin';
        return target.role === baseWinner;
      })
      .map((player) => player.id);

    if (!guardianAngelWinnerIds.length) return winner;

    return {
      ...winner,
      guardianAngelWinnerIds,
    };
  }

  withNeutralBenignCoWinners(room, winner) {
    if (!room || !winner) return winner;

    const survivalistWinnerIds = Array.from(room.players.values())
      .filter((player) => (player.role === 'Survivalist' || player.role === 'Imitator') && player.alive && String(winner.winner || '') !== 'Nobody')
      .map((player) => player.id);

    if (!survivalistWinnerIds.length) return winner;

    return {
      ...winner,
      survivalistWinnerIds,
    };
  }

  withNarcissistCoWinners(room, winner) {
    if (!room || !winner) return winner;

    const baseWinner = String(winner.winner || '').trim();
    if (!baseWinner || baseWinner === 'Crew' || baseWinner === 'Nobody') return winner;

    const narcissistWinnerIds = Array.from(room.players.values())
      .filter((player) => player.role === 'Narcissist' && player.alive)
      .map((player) => player.id);

    if (!narcissistWinnerIds.length) return winner;

    return {
      ...winner,
      narcissistWinnerIds,
    };
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
        avatarIndex: player.avatarIndex,
        colorHex: player.colorHex ?? null,
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
      winner: room.winner || null,
      nightCount: room.nightCount,
      roleRevealEndsAt: room.roleRevealEndsAt || 0,
      playerCount: room.players.size,
      aliveCount: players.filter(p => p.alive).length,
      chatMessages: room.chatMessages.slice(-150),
      anonymousVotes: room.anonymousVotes,
      anonymousEjects: room.anonymousEjects,
      hiddenRoleList: room.hiddenRoleList,
      disableVillagerRole: room.disableVillagerRole,
      useClassicFivePlayerSetup: room.useClassicFivePlayerSetup,
      sheriffKillsCrewTarget: room.sheriffKillsCrewTarget,
      sheriffKillsNeutralEvil: room.sheriffKillsNeutralEvil,
      votingEligibleCount: players.filter((p) => p.alive && !room.blackmailedPlayers?.[p.id]).length,
    };
  }

  addSystemChatMessage(code, text) {
    const room = this.rooms.get(code);
    if (!room || !text) return null;

    const message = this.createChatMessage('system', 'SYSTEM', text, null, room.state);

    room.chatMessages.push(message);
    if (room.chatMessages.length > 150) room.chatMessages = room.chatMessages.slice(-150);
    room.lastAction = Date.now();
    return message;
  }

  getNightActionSummaryLine(code, action, playerId = null) {
    const room = this.rooms.get(code);
    if (!room || !action) return null;
    const actor = playerId ? room.players.get(playerId) : null;
    const activeRole = actor ? this.getEffectiveNightRole(actor) : null;

    if (room.hiddenRoleList) {
      if (action === 'skip') return null;
      return 'A player used their ability.';
    }

    if (action === 'shoot') return 'Sheriff has used their gun.';
    if (action === 'search') return 'Sheriff is investigating someone.';
    if (action === 'examine') return 'Investigator is examining someone.';
    if (action === 'track') return 'Tracker is following someone.';
    if (action === 'stalk') return 'Stalker is shadowing someone.';
    if (action === 'trap') return 'Traplord is setting traps.';
    if (action === 'teleport') return 'Teleporter is bending the room.';
    if (action === 'abracadabra') return 'Magician has made a player disappear.';
    if (action === 'guard') return 'Warden has locked down a player.';
    if (action === 'sacrifice') return 'Alturist is preparing a sacrifice.';
    if (action === 'mimic') return 'Imitator has shifted abilities.';
    if (action === 'inherit') return 'Amnesiac has claimed a forgotten role.';
    if (action === 'evil-eye') return 'Oracle has marked someone with the Evil Eye.';
    if (action === 'infect') return 'A sickness has taken hold in the night.';
    if (action === 'douse' || action === 'ignite') return 'Arsonist is playing with fire.';
    if (action === 'protect') return 'Vitalist has protected someone.';
    if (action === 'quietus') return 'Silencer has hushed someone.';
    if (action === 'bless') return 'Guardian Angel has blessed their target.';
    if (action === 'trance') return 'Hypnotic has cast a trance over someone.';
    if (action === 'malware') return 'Someone has been hacked by the Overload.';
    if (action === 'flash') return 'Blackout has blinded the room.';
    if (action === 'fascism') return 'A crushing force has settled over the night.';
    if (action === 'blackmail') return 'Blackmailer has silenced someone.';
    if (action === 'lifeguard') return 'Survivalist has prepared to survive the night.';
    if (action === 'mirror') return 'Mirror Caster has woven a reflective shield.';
    if (action === 'instinct') return 'Veteran is standing watch.';
    if (action === 'gospel') return 'Prophet has unveiled someone\'s role.';
    if (action === 'longshot') return 'Sniper has lined up a distant shot.';
    if (action === 'interlinked') return 'Tetherhex has forged a lethal bond.';
    if (action === 'kill') {
      if (activeRole === 'The Vessel') return 'The Vessel has taken revenge.';
      return 'An Assassin has moved through the shadows.';
    }
    return null;
  }

  getNightActionSummaryLines(code) {
    const room = this.rooms.get(code);
    if (!room) return [];

    const lines = [];
    const seen = new Set();

    for (const [playerId, { action }] of Object.entries(room.nightActions)) {
      const line = this.getNightActionSummaryLine(code, action, playerId);
      if (!line || seen.has(line)) continue;
      seen.add(line);
      lines.push(line);
    }

    const currentSummary = room.chatMessages.find((entry) => entry.id === room.currentPhaseSummaryId);
    const existingLines = new Set(currentSummary?.summaryLines || []);
    return lines.filter((line) => !existingLines.has(line));
  }

  beginPhaseSummary(code, title, lines = []) {
    const room = this.rooms.get(code);
    if (!room || !title) return null;

    const message = this.createChatMessage(
      'system',
      'SYSTEM',
      this.formatPhaseSummary(title, lines),
      null,
      room.state
    );

    message.summaryTitle = title;
    message.summaryLines = [...lines];
    room.chatMessages.push(message);
    room.currentPhaseSummaryId = message.id;
    if (room.chatMessages.length > 150) room.chatMessages = room.chatMessages.slice(-150);
    room.lastAction = Date.now();
    return message;
  }

  appendToPhaseSummary(code, line) {
    const room = this.rooms.get(code);
    if (!room || !line) return null;

    const message = room.chatMessages.find((entry) => entry.id === room.currentPhaseSummaryId);
    if (!message) {
      return this.beginPhaseSummary(code, line);
    }

    message.summaryTitle = message.summaryTitle || message.text;
    message.summaryLines = [...(message.summaryLines || []), line];
    message.text = this.formatPhaseSummary(message.summaryTitle, message.summaryLines);
    message.createdAt = Date.now();
    room.lastAction = Date.now();
    return message;
  }

  formatPhaseSummary(title, lines = []) {
    const cleanTitle = String(title || '').trim();
    const cleanLines = lines
      .map((line) => String(line || '').trim())
      .filter(Boolean);

    if (!cleanLines.length) return cleanTitle;
    return `${cleanTitle}\n\n${cleanLines.map((line) => `- ${line}`).join('\n')}`;
  }

  createPrivateSystemMessage(code, text, senderName = 'SYSTEM') {
    const room = this.rooms.get(code);
    if (!room || !text) return null;
    return {
      ...this.createChatMessage('system', senderName, text, null, room.state),
      private: true,
    };
  }

  createChatMessage(type, senderName, text, senderId = null, phase = null) {
    let senderAlive = null;
    if (senderId) {
      for (const room of this.rooms.values()) {
        const sender = room.players.get(senderId);
        if (sender) {
          senderAlive = sender.alive;
          break;
        }
      }
    }
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      senderId,
      senderName,
      senderAlive,
      text,
      createdAt: Date.now(),
      phase,
    };
  }

  addChatMessage(code, playerId, text) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    const player = room.players.get(playerId);
    if (!player) return { error: 'Player not found' };
    const canChatThisPhase = room.state === 'lobby'
      || room.state === 'morning'
      || room.state === 'voting'
      || (room.state === 'night' && this.canUseNightPublicChat(player));
    if (!canChatThisPhase) {
      return { error: 'Chat is only available in lobby, morning, and voting' };
    }
    if (room.blackmailedPlayers?.[playerId]) return { error: 'You have been blackmailed' };
    if (room.silencedPlayers?.[playerId]) return { error: 'You have been silenced' };

    const cleanText = String(text || '').trim().replace(/\s+/g, ' ');
    if (!cleanText) return { error: 'Message cannot be empty' };
    if (cleanText.length > 280) return { error: 'Message is too long' };

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'player',
      senderId: playerId,
      senderName: player.name,
      senderAlive: player.alive,
      text: cleanText,
      createdAt: Date.now(),
      phase: room.state,
    };

    room.chatMessages.push(message);
    if (room.chatMessages.length > 150) room.chatMessages = room.chatMessages.slice(-150);
    room.lastAction = Date.now();

    return { success: true, message };
  }

  addAssassinChatMessage(code, playerId, text) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.state === 'lobby' || room.state === 'ended') {
      return { error: 'Assassin chat is only available during the game' };
    }

    const player = room.players.get(playerId);
    if (!player) return { error: 'Player not found' };
    if (!player.alive) return { error: 'Dead players cannot use assassin chat' };
    if (player.faction !== 'Assassin') return { error: 'Only assassins can use assassin chat' };
    if (room.blackmailedPlayers?.[playerId]) return { error: 'You have been blackmailed' };
    if (room.silencedPlayers?.[playerId]) return { error: 'You have been silenced' };

    const cleanText = String(text || '').trim().replace(/\s+/g, ' ');
    if (!cleanText) return { error: 'Message cannot be empty' };
    if (cleanText.length > 280) return { error: 'Message is too long' };

    const message = {
      ...this.createChatMessage('player', player.name, cleanText, playerId, room.state),
      team: 'assassin',
    };

    room.assassinChatMessages.push(message);
    if (room.assassinChatMessages.length > 120) {
      room.assassinChatMessages = room.assassinChatMessages.slice(-120);
    }
    room.lastAction = Date.now();

    return { success: true, message };
  }

  getAssassinChatMessagesForPlayer(code, playerId) {
    const room = this.rooms.get(code);
    if (!room) return [];

    const player = room.players.get(playerId);
    if (!player || player.faction !== 'Assassin' || !player.alive) return [];

    return room.assassinChatMessages.slice(-120);
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

    const activeRole = this.getEffectiveNightRole(player);
    const guardianTargetId = this.getGuardianBlessTargetId(room, player);
    const imitatorAvailableTargetIds = player.role === 'Imitator' && !player.imitatorCopiedRole
      ? this.getImitatorAvailableTargetIds(room, playerId)
      : [];
    const witherKnownInfectedIds = activeRole === 'Wither'
      ? Array.from(room.players.values())
        .filter((candidate) => candidate.alive && candidate.id !== playerId && candidate.witherInfected)
        .map((candidate) => candidate.id)
      : [];

    return {
      ...player,
      teammates,
      hasSubmittedAction: activeRole === 'Tetherhex'
        ? !!(room.nightActions[playerId] && (room.nightActions[playerId].action === 'kill' || room.nightActions[playerId].action === 'skip' || room.nightActions[playerId].skippedAfterInterlinked === true))
        : activeRole === 'Hypnotic'
        ? !!(room.nightActions[playerId] && (room.nightActions[playerId].action === 'kill' || room.nightActions[playerId].action === 'skip' || room.nightActions[playerId].skippedAfterTrance === true))
        : activeRole === 'Overload'
        ? !!(room.nightActions[playerId] && (room.nightActions[playerId].action === 'kill' || room.nightActions[playerId].action === 'skip' || room.nightActions[playerId].skippedAfterMalware === true))
        : activeRole === 'Blackmailer'
        ? !!(room.nightActions[playerId] && (room.nightActions[playerId].action === 'kill' || room.nightActions[playerId].action === 'skip' || room.nightActions[playerId].skippedAfterBlackmail === true))
        : activeRole === 'Blackout'
          ? !!(room.nightActions[playerId] && (room.nightActions[playerId].action === 'kill' || room.nightActions[playerId].action === 'skip' || room.nightActions[playerId].skippedAfterFlash === true))
          : !!room.nightActions[playerId],
      hasVoted: !!room.votes[playerId],
      isBlackmailed: !!room.blackmailedPlayers?.[playerId],
      isSilenced: !!room.silencedPlayers?.[playerId],
      executionerTargetId: player.role === 'Executioner' ? (player.executionerTargetId || null) : null,
      executionerTargetName: player.role === 'Executioner' && player.executionerTargetId
        ? (room.players.get(player.executionerTargetId)?.name || null)
        : null,
      guardianAngelTargetId: activeRole === 'Guardian Angel' ? guardianTargetId : null,
      guardianAngelTargetName: activeRole === 'Guardian Angel' && guardianTargetId
        ? (room.players.get(guardianTargetId)?.name || null)
        : null,
      oracleMarkedTargetId: activeRole === 'Oracle' ? (player.oracleMarkedTargetId || null) : null,
      prophetGospelUsesRemaining: activeRole === 'Prophet' ? (player.prophetGospelUsesRemaining ?? 2) : null,
      oracleMarkedTargetName: activeRole === 'Oracle' && player.oracleMarkedTargetId
        ? (room.players.get(player.oracleMarkedTargetId)?.name || null)
        : null,
      oraclePurifiedTargetId: player.role === 'Oracle' ? (player.oraclePurifiedTargetId || null) : null,
      oraclePurifiedTargetName: player.role === 'Oracle' && player.oraclePurifiedTargetId
        ? (room.players.get(player.oraclePurifiedTargetId)?.name || null)
        : null,
      inquisitorExiledTargetId: player.role === 'Inquisitor' ? (player.inquisitorExiledTargetId || null) : null,
      inquisitorExileUsed: player.role === 'Inquisitor' ? !!player.inquisitorExileUsed : false,
      inquisitorExiledTargetName: player.role === 'Inquisitor' && player.inquisitorExiledTargetId
        ? (room.players.get(player.inquisitorExiledTargetId)?.name || null)
        : null,
      disruptorVetoUsesRemaining: player.role === 'Disruptor' ? (player.disruptorVetoUsesRemaining ?? 1) : null,
      disruptorVetoUsed: player.role === 'Disruptor' ? !!player.disruptorVetoUsed : false,
      manipulatorSurpriseUsesRemaining: player.role === 'Manipulator' ? (player.manipulatorSurpriseUsesRemaining ?? 2) : null,
      manipulatorSurpriseUsed: player.role === 'Manipulator' ? !!player.manipulatorSurpriseUsed : false,
      scientistExperimentUsesRemaining: player.role === 'Scientist' ? (player.scientistExperimentUsesRemaining ?? 1) : null,
      scientistSwapTargetIds: player.role === 'Scientist' ? (Array.isArray(player.scientistSwapTargetIds) ? [...player.scientistSwapTargetIds] : []) : [],
      swapperSwapTargetIds: player.role === 'Swapper' ? (Array.isArray(player.swapperSwapTargetIds) ? [...player.swapperSwapTargetIds] : []) : [],
      alturistReviveTargetId: activeRole === 'Alturist' ? (player.alturistReviveTargetId || null) : null,
      alturistReviveTargetName: activeRole === 'Alturist' && player.alturistReviveTargetId
        ? (room.players.get(player.alturistReviveTargetId)?.name || null)
        : null,
      vesselAwakened: player.role === 'The Vessel' ? !!player.vesselAwakened : false,
      lastWardenTarget: activeRole === 'Warden' ? (room.lastWardenTargets[playerId] || null) : null,
      lastMagicianTarget: activeRole === 'Magician' ? (room.lastMagicianTargets[playerId] || null) : null,
      lastMedicTarget: activeRole === 'Vitalist' ? room.lastMedicTarget : null,
      lastMirrorTarget: activeRole === 'Mirror Caster' ? (room.lastMirrorTargets[playerId] || null) : null,
      lastInvestigatorTargets: activeRole === 'Investigator' ? (room.lastInvestigatorTargets[playerId] || []) : [],
      lastTrackerTarget: activeRole === 'Tracker' ? (room.lastTrackerTargets[playerId] || null) : null,
      lastStalkerTarget: activeRole === 'Stalker' ? (room.lastStalkerTargets[playerId] || null) : null,
      lastTetherhexTargets: activeRole === 'Tetherhex' ? (room.lastTetherhexTargets[playerId] || []) : [],
      lastSilencerTarget: activeRole === 'Silencer' ? (room.lastSilencerTargets[playerId] || null) : null,
      lastHypnoticTarget: activeRole === 'Hypnotic' ? (room.lastHypnoticTargets[playerId] || null) : null,
      hypnoticTranceUsedThisNight: activeRole === 'Hypnotic' ? !!room.nightActions[playerId]?.tranceUsedThisNight : false,
      lastOverloadTarget: activeRole === 'Overload' ? (room.lastOverloadTargets[playerId] || null) : null,
      overloadMalwareUsedThisNight: activeRole === 'Overload' ? !!room.nightActions[playerId]?.malwareUsedThisNight : false,
      blackmailerBlackmailUsedThisNight: activeRole === 'Blackmailer' ? !!room.nightActions[playerId]?.blackmailUsedThisNight : false,
      tetherhexInterlinkedUsedThisNight: activeRole === 'Tetherhex' ? !!room.nightActions[playerId]?.interlinkedUsedThisNight : false,
      lastBlackoutFlashNight: activeRole === 'Blackout' ? (room.lastBlackoutFlashNight[playerId] || null) : null,
      veteranUsesRemaining: activeRole === 'Veteran' ? (player.veteranUsesRemaining ?? 4) : null,
      mirrorUsesRemaining: activeRole === 'Mirror Caster' ? (player.mirrorUsesRemaining ?? 4) : null,
      guardianAngelUsesRemaining: activeRole === 'Guardian Angel' ? (player.guardianAngelUsesRemaining ?? 4) : null,
      oracleEvilEyeUsesRemaining: activeRole === 'Oracle' ? (player.oracleEvilEyeUsesRemaining ?? 3) : null,
      oraclePurifyUsesRemaining: player.role === 'Oracle' ? (player.oraclePurifyUsesRemaining ?? 2) : null,
      survivalistUsesRemaining: activeRole === 'Survivalist' ? (player.survivalistUsesRemaining ?? 4) : null,
      witherKnownInfectedIds,
      arsonistDousedTargetIds: activeRole === 'Arsonist' ? (Array.isArray(player.arsonistDousedTargetIds) ? [...player.arsonistDousedTargetIds] : []) : [],
      arsonistDouseTargetCount: activeRole === 'Arsonist' ? 1 : null,
      blackoutFlashUsesRemaining: activeRole === 'Blackout' ? (player.blackoutFlashUsesRemaining ?? 3) : null,
      blackoutFlashUsedThisNight: activeRole === 'Blackout' ? !!room.nightActions[playerId]?.flashUsedThisNight : false,
      purgeFascismUsesRemaining: activeRole === 'The Purge' ? (player.purgeFascismUsesRemaining ?? 1) : null,
      purgeFascismUsedThisNight: activeRole === 'The Purge' ? !!room.nightActions[playerId]?.fascismUsedThisNight : false,
      imitatorCopiedRole: player.role === 'Imitator' ? (player.imitatorCopiedRole || null) : null,
      imitatorCopiedSourceId: player.role === 'Imitator' ? (player.imitatorCopiedSourceId || null) : null,
      imitatorAvailableTargetIds,
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

  getEligibleVoterCount(code) {
    const room = this.rooms.get(code);
    if (!room) return 0;
    return Array.from(room.players.entries()).filter(([id, player]) => player.alive && !room.blackmailedPlayers?.[id]).length;
  }

  getAllPlayersWithRoles(code) {
    const room = this.rooms.get(code);
    if (!room) return [];

    const players = [];
    for (const [id, player] of room.players) {
      players.push({
        id,
        name: player.name,
        colorHex: player.colorHex ?? null,
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
