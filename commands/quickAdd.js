// FILE: commands/quickAdd.js

const config = require('../config');
const { db } = config;
const { findPlayerByName, findPlayerByWaId } = require('../utils/playerUtils'); // <-- Importa a nova função
const { runPostScoreChecks, checkPreviousAbsencesAndWarnForPlayer } = require('../utils/warningSystem');
const logger = require('../utils/logger'); // Importa o logger

module.exports = async (context) => {
    const { reply, userMessage, from, userId, sock } = context;

    try {
        const parts = userMessage.substring(1).trim().split(' ');
        if (parts.length === 0 || parts[0] === '') return;

        let playerData;
        let points;
        let dayIndexFound;

        // ---- NOVO: LÓGICA PARA DECIDIR ENTRE AUTO-LANÇAMENTO E LANÇAMENTO PARA TERCEIROS ----
        const firstPartIsNumber = !isNaN(parseInt(parts[0], 10));

        if (firstPartIsNumber) {
            // MODO DE AUTO-LANÇAMENTO (ex: /575 ou /575 sabado)
            const findResult = await findPlayerByWaId(userId);
            if (findResult.status === 'not_found') {
                return reply(`❌ Seu número não está cadastrado. Peça para um líder te adicionar ao banco de dados.`);
            }
            playerData = findResult.data;
            points = parseInt(parts[0], 10);
            
            if (parts.length > 1) {
                const dayPart = parts[1].toLowerCase();
                dayIndexFound = config.dayMap[dayPart.replace('-feira', '')];
            }

        } else {
            // MODO ANTIGO DE LANÇAMENTO PARA TERCEIROS (ex: /Jogador 575 sexta)
            const dayPart = parts[parts.length - 1].toLowerCase();
            const potentialDayIndex = config.dayMap[dayPart.replace('-feira', '')];
            let pointsPart, nameParts;

            if (potentialDayIndex !== undefined && parts.length > 2) {
                dayIndexFound = potentialDayIndex;
                pointsPart = parts[parts.length - 2];
                nameParts = parts.slice(0, -2);
            } else {
                pointsPart = parts[parts.length - 1];
                nameParts = parts.slice(0, -1);
            }
            const playerNameInput = nameParts.join(' ');
            points = parseInt(pointsPart, 10);

            const findResult = await findPlayerByName(playerNameInput);
            if (findResult.status !== 'exact' && findResult.status !== 'similar') {
                return reply(`Jogador "${playerNameInput}" não encontrado.`);
            }
            playerData = findResult.data;
        }
        // ---- FIM DA NOVA LÓGICA DE DECISÃO ----

        if (isNaN(points) || points < 0) return;

        const playerRef = db.collection('players').doc(playerData.id);

        if (points > 5000) { // Pontos de Defesa Naval
            await playerRef.update({ navalDefensePoints: points });
            await reply(`✅ *Defesa Naval* registrada para *${playerData.name}*: ${points} pontos.`);
            const updateInfo = { type: 'naval', points };
            await runPostScoreChecks(playerData.id, userId, updateInfo, sock, from);

        } else { // Pontos de Guerra
            const botDate = new Date();
            botDate.setHours(botDate.getHours() - 9); // 9h de tolerância + 3h de fuso UTC

            const jsDayOfWeek = botDate.getDay();
            
            const warDayMapForAuto = { 4: 0, 5: 1, 6: 2, 0: 3 }; // Para calcular o dia atual
            const warDayMapForBlock = { 4: 0, 5: 1, 6: 2, 0: 3, 1: 4, 2: 4, 3: 4 }; // Para a regra de bloqueio
            
            const autoCalculatedDayIndex = warDayMapForAuto[jsDayOfWeek];
            const currentWarDayIndex = warDayMapForBlock[jsDayOfWeek];

            let dayIndex = dayIndexFound;
            if (dayIndex === undefined) {
                dayIndex = autoCalculatedDayIndex;
                if (dayIndex === undefined) {
                    return reply("❌ Lançamento rápido sem dia só funciona durante os dias de guerra (de Quinta 06:00 a Segunda 05:59, horário do Brasil).");
                }
            }
            
            if (currentWarDayIndex !== undefined && dayIndex < currentWarDayIndex) {
                let todayMessage = (currentWarDayIndex > 3) 
                    ? "A semana de guerra já encerrou."
                    : `Hoje, para o bot, é *${config.dayNames[currentWarDayIndex]}*.`;
                return reply(`❌ O prazo para registrar pontos de *${config.dayNames[dayIndex]}* já encerrou. ${todayMessage}`);
            }
            
            // NOVO: Verificar faltas anteriores antes de continuar
            // Recarrega os dados do jogador para garantir que temos as informações mais recentes
            const playerDoc = await db.collection('players').doc(playerData.id).get();
            if (!playerDoc.exists) {
                return reply(`❌ O jogador *${playerData.name}* não foi encontrado no banco de dados. Lançamento cancelado.`);
            }
            let updatedPlayerData = { id: playerDoc.id, ...playerDoc.data() };

            // Passamos o contexto completo para a função de advertência
            const warningContext = { sock, from, reply };
            updatedPlayerData = await checkPreviousAbsencesAndWarnForPlayer(updatedPlayerData, dayIndex, warningContext);

            // Se o jogador foi removido durante a verificação de advertências, cancelamos o lançamento
            if (!updatedPlayerData || updatedPlayerData.warnings >= 5) {
                // NEW: Alterado de reply para logger.debug
                logger.debug(`Lançamento cancelado: O jogador ${playerData.name} foi removido devido a advertências acumuladas.`);
                return reply(`❌ Lançamento cancelado: O jogador *${playerData.name}* foi removido devido a advertências acumuladas.`);
            }
            // Continua com o lançamento de pontos usando os dados atualizados do jogador
            // No quickAdd, não precisamos atualizar o userStates, apenas usar updatedPlayerData
            
            const newDailyPoints = [...(updatedPlayerData.dailyPoints || [-1, -1, -1, -1])];
            newDailyPoints[dayIndex] = points;
            await playerRef.update({ dailyPoints: newDailyPoints });

            await reply(`✅ *Guerra* de *${config.dayNames[dayIndex]}* registrada para *${updatedPlayerData.name}*: ${points} pontos.`);
            const updateInfo = { type: 'war', dayIndex, points };
            await runPostScoreChecks(updatedPlayerData.id, userId, updateInfo, sock, from);
        }
    } catch (error) {
        logger.error("❌ Erro no comando rápido:", error); // Usando logger.error
        await reply("❌ Ocorreu um erro ao registrar os pontos.");
    }
};
