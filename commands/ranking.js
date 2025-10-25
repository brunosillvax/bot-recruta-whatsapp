// FILE: commands/ranking.js (VERSÃO ATUALIZADA PARA O RANKING POR DIVISÕES)

const { db } = require('../config');
const config = require('../config'); // Importa o config para pegar as divisões
const logger = require('../utils/logger'); // Importa o logger
const { CacheHelpers } = require('../utils/cacheManager'); // Sistema de cache
const { withFirebaseRetry } = require('../utils/retryHelper'); // Sistema de retry

const handleRanking = async ({ reply }) => {
    try {
        // Tenta obter do cache primeiro
        const cachedRanking = CacheHelpers.ranking.get();
        if (cachedRanking) {
            logger.debug('Ranking obtido do cache');
            return await reply(cachedRanking);
        }
        
        // Se não está no cache, busca do Firebase com retry
        const playersSnapshot = await withFirebaseRetry(async () => {
            return await db.collection('players').get();
        }, 'Buscar jogadores para ranking');
        
        if (playersSnapshot.empty) {
            return reply("Nenhum jogador na lista para criar um ranking.");
        }

        // 1. Calcula os pontos totais para cada jogador, tratando -1 como 0
        const playersWithTotals = playersSnapshot.docs.map(doc => {
            const player = doc.data();
            const dailyPoints = player.dailyPoints || [0, 0, 0, 0];
            const totalPoints = dailyPoints
                .map(pts => (pts === -1 ? 0 : pts))
                .reduce((sum, pts) => sum + pts, 0);
            return { name: player.name, totalPoints };
        });

        const rankedPlayers = playersWithTotals.filter(p => p.totalPoints > 0);
        if (rankedPlayers.length === 0) {
            return reply("Ninguém pontuou na guerra ainda.");
        }
        
        // Ordena todos os jogadores uma vez, do maior para o menor
        rankedPlayers.sort((a, b) => b.totalPoints - a.totalPoints);

        // 2. Prepara as divisões a partir do config.js
        const divisions = config.rankingDivisions.map(div => ({
            ...div,
            players: [] // Adiciona uma lista vazia para cada divisão
        }));

        // 3. Distribui os jogadores nas divisões
        rankedPlayers.forEach(player => {
            // Encontra a primeira divisão que o jogador pertence (da maior para a menor)
            const division = divisions.find(div => player.totalPoints >= div.minPoints);
            if (division) {
                division.players.push(player);
            }
        });

        // 4. Monta a mensagem final
        let response = "🏆 *Ranking de Pontos de Guerra* 🏆\n";

        divisions.forEach(div => {
            // Só mostra a divisão se ela tiver jogadores
            if (div.players.length > 0) {
                response += `\n${div.emoji} *${div.name} (${div.minPoints}+)*\n`;
                div.players.forEach(player => {
                    response += `• ${player.name}: *${player.totalPoints} pts*\n`;
                });
            }
        });
        
        // Armazena o ranking no cache
        CacheHelpers.ranking.set(response);

        await reply(response);

    } catch (error) {
        logger.error("❌ Erro ao gerar ranking por divisões:", error);
        await reply("❌ Ocorreu um erro ao tentar gerar o ranking.");
    }
};

module.exports = {
    name: 'ranking',
    handler: handleRanking,
    isAdminCommand: false
};
