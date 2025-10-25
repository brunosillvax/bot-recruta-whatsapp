const { db } = require('../../config');
const { findPlayerByName } = require('../playerUtils');
const { runPostScoreChecks } = require('../warningSystem');
const logger = require('../logger'); // Importa o logger

async function handlePointsConfirmation(context) {
    const { sock, from, userId, reply, currentState, commandMessage, cancelAndExit } = context;

    if (commandMessage === 'sim') {
        try {
            const { selectedPlayer, eventType, dayIndex, points, dayName } = currentState;
            let playerId;
            if (selectedPlayer.id) {
                playerId = selectedPlayer.id;
            } else {
                const playerResult = await findPlayerByName(selectedPlayer.name);
                if (playerResult.status !== 'exact' && playerResult.status !== 'similar') {
                    return cancelAndExit(`❌ Erro: Não consegui reencontrar o jogador ${selectedPlayer.name} para salvar os pontos.`);
                }
                playerId = playerResult.data.id;
            }
            const playerRef = db.collection('players').doc(playerId);

            if (eventType === 'Guerra') {
                const playerDoc = await playerRef.get();
                if (!playerDoc.exists) {
                   return cancelAndExit(`❌ Erro: O jogador ${selectedPlayer.name} não foi encontrado no banco de dados para salvar os pontos.`);
                }
                const playerData = playerDoc.data();
                const updatedDailyPoints = [...playerData.dailyPoints];
                updatedDailyPoints[dayIndex] = points;
                await playerRef.update({ dailyPoints: updatedDailyPoints });
            } else if (eventType === 'Defesa Naval') {
                await playerRef.update({ navalDefensePoints: points });
            } else if (eventType === 'Torre Rei') {
                await playerRef.update({ kingTower: points });
            } else if (eventType === 'Troféus') {
                await playerRef.update({ trophies: points });
            } else if (eventType === 'Nível XP') {
                await playerRef.update({ levelXP: points });
            }

            let successMessage = `✅ Sucesso! Pontos registrados para *${selectedPlayer.name}*.`;
            let tip = '';
            
            if (eventType === 'Guerra') {
                const shortDayName = dayName.split('-')[0].toLowerCase();
                tip = `\n\n*Dica:* Da próxima vez, use o comando rápido: \`/${points}\``;
            } else if (eventType === 'Defesa Naval') {
                tip = `\n\n*Dica:* Da próxima vez, use o comando rápido: \`/${points}\``;
            } else {
                tip = `\n\n*Dica:* Use */me* para verificar suas informações atualizadas!`;
            }

            await reply(successMessage + tip);
            
            // Só executar verificações pós-pontos para Guerra e Defesa Naval
            if (eventType === 'Guerra' || eventType === 'Defesa Naval') {
                const updateInfo = { type: eventType === 'Guerra' ? 'war' : 'naval', points, dayIndex };
                await runPostScoreChecks(playerId, userId, updateInfo, sock, from);
            }
        } catch (error) {
            logger.error("❌ Erro ao salvar pontos:", error); // Usando logger.error
            await reply("❌ Ocorreu um erro ao salvar os pontos.");
        } finally {
            cancelAndExit();
        }
    } else {
        cancelAndExit("Lançamento de pontos cancelado.");
    }
}

module.exports = handlePointsConfirmation;
