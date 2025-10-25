// FILE: commands/status.js (VERSÃO CORRIGIDA)

const { db } = require('../config');
const logger = require('../utils/logger'); // Importa o logger
const { CacheHelpers } = require('../utils/cacheManager'); // Sistema de cache
const { withFirebaseRetry } = require('../utils/retryHelper'); // Sistema de retry

const handleStatus = async ({ reply }) => {
    try {
        // Tenta obter do cache primeiro
        const cachedStatus = CacheHelpers.status.get();
        if (cachedStatus) {
            logger.debug('Status obtido do cache');
            return await reply(cachedStatus);
        }
        
        // Se não está no cache, busca do Firebase com retry
        const playersSnapshot = await withFirebaseRetry(async () => {
            return await db.collection('players').orderBy('name_lowercase').get();
        }, 'Buscar jogadores para status');

        if (playersSnapshot.empty) {
            return reply("Nenhum jogador na lista. Use */nome [seu nome]* para se registrar.");
        }

        let response = `*📊 Status de Pontos da Guerra 📊*\n\n`;
        playersSnapshot.docs.forEach(doc => {
            const player = doc.data();
            const warPoints = player.dailyPoints || [0, 0, 0, 0];
            const navalPoints = player.navalDefensePoints || 0;
            const warPointsDisplay = warPoints.join(' | ');

            response += `*${player.name}*\n`;
            response += ` ⚔️ Guerra: ${warPointsDisplay}\n`;
            response += ` 🛡️ Def. Naval: ${navalPoints}\n`;
            response += `--------------------\n`;
        });
        
        // Armazena no cache
        CacheHelpers.status.set(response);
        
        await reply(response);

    } catch (error) {
        logger.error("❌ Erro ao gerar status:", error); // Usando logger.error
        await reply("❌ Ocorreu um erro ao buscar o status dos jogadores.");
    }
};

module.exports = {
    name: 'status',
    handler: handleStatus,
    isAdminCommand: false
};
