// FILE: utils/playerUtils.js

const { db, FieldValue } = require('../config');
const config = require('../config');
const logger = require('./logger'); // Importa o logger
const { withFirebaseRetry } = require('./retryHelper'); // Sistema de retry
const { CacheHelpers } = require('./cacheManager'); // Sistema de cache

// ##### FUNÇÃO PARA BUSCAR JOGADOR PELO ID DO WHATSAPP (AGORA CORRIGIDA) #####
/**
 * Encontra um jogador no banco de dados usando o ID do WhatsApp (whatsappId).
 * @param {string} waId O ID do usuário do WhatsApp (ex: '4016...').
 * @returns {Promise<{status: string, data?: object}>} Objeto com status e dados do jogador.
 */
async function findPlayerByWaId(waId) {
    try {
        // Tenta obter do cache primeiro
        const cached = CacheHelpers.player.get(waId);
        if (cached) {
            logger.debug(`Player ${waId} obtido do cache`);
            return { status: 'found', data: cached };
        }
        
        // Se não está no cache, busca do Firebase com retry
        return await withFirebaseRetry(async () => {
            const playersQuery = db.collection('players').where('whatsappId', '==', waId).limit(1);
            const snapshot = await playersQuery.get();

            if (snapshot.empty) {
                return { status: 'not_found' };
            }

            const playerData = snapshot.docs[0].data();
            const playerId = snapshot.docs[0].id;
            const player = { id: playerId, ...playerData };
            
            // Armazena no cache
            CacheHelpers.player.set(playerId, player);

            return { status: 'found', data: player };
        }, `Buscar jogador por WhatsApp ID: ${waId}`);

    } catch (error) {
        logger.error("❌ Erro ao buscar jogador pelo waId:", error);
        throw error;
    }
}
// ##### FIM DA FUNÇÃO CORRIGIDA #####

/**
 * Adiciona um novo jogador ao banco de dados.
 * @param {string} whatsappId O ID do WhatsApp do jogador.
 * @param {string} name O nome do jogador.
 * @returns {Promise<object>} Os dados do jogador adicionado.
 */
async function addPlayer(whatsappId, name) {
    try {
        const initialDailyPoints = getInitialDailyPoints();
        const newPlayerData = {
            whatsappId: whatsappId,
            name: name,
            sanitizedName: sanitizeName(name), // Mantém o nome sanitizado para buscas
            name_lowercase: name.toLowerCase(), // NOVO: Adiciona o nome em minúsculas para ordenação
            dailyPoints: initialDailyPoints,
            navalDefensePoints: 0, // Usa o nome do campo do banco de dados
            warnings: 0,
            lastWarPoints: 0,
            lastNavalPoints: 0,
            isActive: true,
            registeredAt: FieldValue.serverTimestamp(),
        };

        await withFirebaseRetry(async () => {
            await db.collection('players').doc(whatsappId).set(newPlayerData);
        }, `Adicionar jogador: ${name}`);
        
        logger.debug(`Jogador ${name} (${whatsappId}) adicionado com sucesso.`);
        
        // Invalida cache da lista de jogadores e adiciona o novo jogador ao cache
        CacheHelpers.playerList.invalidate();
        const player = { id: whatsappId, ...newPlayerData };
        CacheHelpers.player.set(whatsappId, player);
        
        return player;
    } catch (error) {
        logger.error(`❌ Erro ao adicionar jogador ${name} (${whatsappId}):`, error);
        throw error;
    }
}

/**
 * Atualiza os pontos de um jogador (guerra ou naval).
 * @param {string} playerId O ID do documento do jogador no Firestore (geralmente o whatsappId).
 * @param {string} type O tipo de pontos a atualizar ('war' ou 'naval').
 * @param {string} mode O modo de atualização ('add' para somar, 'set' para definir).
 * @param {number} value O valor dos pontos.
 * @param {number} dayIndex O índice do dia da semana (0-3 para Qui-Dom) se type for 'war'.
 * @returns {Promise<void>}
 */
async function updatePlayerPoints(playerId, type, mode, value, dayIndex = -1) {
    try {
        const playerRef = db.collection('players').doc(playerId);
        let updateData = {};

        if (type === 'naval') {
            updateData.navalDefensePoints = value;
        } else if (type === 'war' && dayIndex !== -1) {
            if (mode === 'add') {
                updateData[`dailyPoints.${dayIndex}`] = FieldValue.increment(value);
            } else if (mode === 'set') {
                updateData[`dailyPoints.${dayIndex}`] = value;
            }
        } else {
            logger.warn(`⚠️ Tentativa de atualizar pontos com tipo ou modo inválido: type=${type}, mode=${mode}, dayIndex=${dayIndex}`);
            throw new Error('Tipo ou modo de atualização de pontos inválido.');
        }

        await withFirebaseRetry(async () => {
            await playerRef.update(updateData);
        }, `Atualizar pontos ${type} do jogador ${playerId}`);
        
        logger.debug(`Pontos ${type} do jogador ${playerId} atualizados para ${value} (modo: ${mode}).`);
        
        // Invalida caches relacionados
        CacheHelpers.player.delete(playerId);
        CacheHelpers.playerList.invalidate();
        
    } catch (error) {
        logger.error(`❌ Erro ao atualizar pontos ${type} do jogador ${playerId}:`, error);
        throw error;
    }
}


// O RESTANTE DO ARQUIVO PERMANECE IGUAL
function getInitialDailyPoints() {
    const points = [0, 0, 0, 0]; // [Qui, Sex, Sab, Dom]
    const today = new Date().getDay(); // 0=Domingo, 1=Seg, ..., 6=Sábado

    if (today === 5) { // Sexta-feira
        points[0] = -1;
    } else if (today === 6) { // Sábado
        points[0] = -1;
        points[1] = -1;
    } else if (today === 0) { // Domingo
        points[0] = -1;
        points[1] = -1;
        points[2] = -1;
    }
    return points;
}

function levenshteinDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

function sanitizeName(name) {
    if (!name) return '';
    const characterMap = { 'ᴀ': 'a', 'À': 'a', 'Á': 'a', 'Ä': 'a', 'ᴬ': 'a', 'ᵃ': 'a', 'ʙ': 'b', 'ᴮ': 'b', 'ᵇ': 'b', 'ᴄ': 'c', 'Ç': 'c', 'ᶜ': 'c', 'ᴅ': 'd', 'ᴰ': 'd', 'ᵈ': 'd', 'ᴇ': 'e', 'È': 'e', 'É': 'e', 'Ë': 'e', 'ᴱ': 'e', 'ᵉ': 'e', 'ꜰ': 'f', 'ᶠ': 'f', 'ɢ': 'g', 'ᴳ': 'g', 'ᵍ': 'g', 'ʜ': 'h', 'ᴴ': 'h', 'ʰ': 'h', 'ɪ': 'i', 'Ì': 'i', 'Í': 'i', 'Ï': 'i', 'ᴵ': 'i', 'ⁱ': 'i', 'ᴊ': 'j', 'ᴶ': 'j', 'ʲ': 'j', 'ᴋ': 'k', 'ᴷ': 'k', 'ᵏ': 'k', 'ʟ': 'l', 'ᴸ': 'l', 'ˡ': 'l', 'ᴍ': 'm', 'ᴹ': 'm', 'ᵐ': 'm', 'ɴ': 'n', 'Ñ': 'n', 'ᴺ': 'n', 'ⁿ': 'n', 'ᴏ': 'o', 'Ò': 'o', 'Ó': 'o', 'Ö': 'o', 'ᴼ': 'o', 'ᵒ': 'o', 'ᴘ': 'p', 'ᴾ': 'p', 'ᵖ': 'p', 'ǫ': 'q', 'ʀ': 'r', 'ᴿ': 'r', 'ʳ': 'r', 'ꜱ': 's', 'ˢ': 's', 'ᴛ': 't', 'ᵀ': 't', 'ᵗ': 't', 'ᴜ': 'u', 'Ù': 'u', 'Ú': 'u', 'Ü': 'u', 'ᵁ': 'u', 'ᵘ': 'u', 'ᴠ': 'v', 'ⱽ': 'v', 'ᵛ': 'v', 'ᴡ': 'w', 'ᵂ': 'w', 'ʷ': 'w', 'x': 'x', 'ˣ': 'x', 'ʏ': 'y', 'ʸ': 'y', 'ᴢ': 'z', 'ᶻ': 'z' };
    let cleanedName = name.toLowerCase().split('').map(char => characterMap[char] || char).join('');
    return cleanedName.replace(/[^a-z0-9]/g, '');
}

async function updatePlayerBackup() {
    try {
        const playersSnapshot = await db.collection('players').get();
        const playersData = playersSnapshot.docs.map(doc => doc.data());
        const backupRef = db.collection('backups').doc('player_list');
        await backupRef.set({
            players: playersData,
            lastUpdated: FieldValue.serverTimestamp()
        });
        logger.debug('🔄 Backup da lista de jogadores atualizado.'); // Usando logger.debug
    } catch (error) {
        logger.error("❌ Erro Crítico: Falha ao criar o backup da lista de jogadores:", error); // Usando logger.error
    }
}

async function findPlayerByName(nameInput) {
    try {
        // Tenta obter lista de jogadores do cache usando getOrSet
        const players = await CacheHelpers.playerList.get() || await withFirebaseRetry(async () => {
            const allPlayersSnapshot = await db.collection('players').get();
            if (allPlayersSnapshot.empty) {
                return null;
            }
            const playersList = allPlayersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Armazena no cache
            CacheHelpers.playerList.set(playersList);
            return playersList;
        }, 'Buscar lista de jogadores');
        
        if (!players || players.length === 0) {
            return { status: 'empty_list' };
        }

        const sanitizedInput = sanitizeName(nameInput);

        const playersWithDistance = players.map(player => {
            const distance = levenshteinDistance(sanitizedInput, sanitizeName(player.name || ''));
            return { ...player, distance };
        }).sort((a, b) => a.distance - b.distance);

        const bestMatch = playersWithDistance[0];

        const plausibleMatches = playersWithDistance.filter(p => p.distance <= 1);

        if (plausibleMatches.length > 1) {
            return { status: 'ambiguous', suggestions: plausibleMatches };
        }
        
        if (bestMatch.distance <= config.searchTolerance) {
            const status = bestMatch.distance === 0 ? 'exact' : 'similar';
            return { status: status, data: bestMatch };
        }

        const reasonableSuggestions = playersWithDistance.filter(p => p.distance < 5).map(p => p.name);
        return { status: 'not_found', suggestions: reasonableSuggestions.slice(0, 3) };

    } catch (error) {
        logger.error("❌ Erro ao buscar jogador no banco de dados:", error);
        throw error;
    }
}

async function findSimilarPlayerNames(nameInput) {
    const allPlayersSnapshot = await db.collection('players').get();
    if (allPlayersSnapshot.empty) {
        return [];
    }
    const sanitizedInput = sanitizeName(nameInput);
    let matches = [];

    allPlayersSnapshot.docs.forEach(doc => {
        const playerData = doc.data();
        if (playerData.name) {
            const originalName = playerData.name;
            const sanitizedDbName = sanitizeName(originalName);
            const distance = levenshteinDistance(sanitizedInput, sanitizedDbName);
            matches.push({ name: originalName, distance: distance });
        }
    });

    matches.sort((a, b) => a.distance - b.distance);
    return matches.slice(0, 3).map(m => m.name);
}

module.exports = {
    getInitialDailyPoints,
    findPlayerByName,
    updatePlayerBackup,
    findSimilarPlayerNames,
    findPlayerByWaId, // Exportando a função
    addPlayer, // NOVO: Exportando a função
    updatePlayerPoints, // NOVO: Exportando a função
};
