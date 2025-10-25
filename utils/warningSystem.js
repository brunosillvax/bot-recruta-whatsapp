// FILE: utils/warningSystem.js (VERSÃO FINAL COM AS DUAS CORREÇÕES)

const { db, FieldValue } = require('../config');
const {} = require('./playerUtils');
const config = require('../config');
const logger = require('./logger'); // Importa o logger

// ===== CORREÇÃO 2: FUNÇÃO DE PAUSA PARA EVITAR RATE-LIMIT =====
// Adicionamos esta função auxiliar no início do arquivo.
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Função sendWarningNotification (sem alterações)
async function sendWarningNotification(player, newWarnings, reason, context) {
    // ... (esta função permanece exatamente igual)
    const { sock, from, reply } = context;
    const canMention = player.whatsappId && player.whatsappId.includes('@');
    const mentionId = canMention ? player.whatsappId.split('@')[0] : player.name;
    const leaderMention = `@${config.leaderJid.split('@')[0]}`;

    if (newWarnings >= 5) {
        let kickMessage = `🚨 @${mentionId} (Nick: *${player.name}*) foi advertido(a) por *${reason}*.\n\n`;
        kickMessage += `📵 ATINGIU 5 ADVERTÊNCIAS E FOI REMOVIDO(A) DA LISTA 📵`;
        await sock.sendMessage(from, { text: kickMessage, mentions: canMention ? [player.whatsappId] : [] });
        return;
    }
    if (newWarnings === 4) {
        let finalWarningMessage = `☠️ *SENTENÇA FINAL - EXPULSÃO IMINENTE* ☠️\n\n`;
        finalWarningMessage += `@${mentionId} (Nick: *${player.name}*), sua permanência no clã está por um fio. Você atingiu **4/5 advertências**.\n\n`;
        finalWarningMessage += `*NÃO HÁ MAIS MARGEM PARA ERROS.*\n\n`;
        finalWarningMessage += `Considere esta a sua notificação final. A próxima infração, não importa qual seja, resultará na sua *remoção imediata e definitiva*. Sem negociação. Sem segundas chances.\n\n`;
        finalWarningMessage += `Sua única e última esperança é contatar o líder ${leaderMention} *AGORA* e justificar por que você deve permanecer. A decisão dele será final.`;
        const mentions = [config.leaderJid];
        if (canMention) mentions.push(player.whatsappId);
        await sock.sendMessage(from, { text: finalWarningMessage, mentions });
        return;
    }
    if (newWarnings === 3) {
        let alertMessage = `🔥 *ATENÇÃO: ZONA DE ALERTA* 🔥\n\n`;
        alertMessage += `@${mentionId} (Nick: *${player.name}*), você atingiu **3/5 advertências**.\n\n`;
        alertMessage += `Este é um aviso sério. Para evitar futuras penalidades, você precisa agir.\n\n`;
        alertMessage += `*Sua missão:*\n`;
        alertMessage += `1. Converse com o líder ${leaderMention} para entender como melhorar.\n`;
        alertMessage += `2. Adote a TAG oficial do clã: \`《☆》ᴿᶻ\`\n\n`;
        alertMessage += `Ao fazer isso, a liderança poderá reavaliar seu caso. Não deixe para depois!`;
        const mentions = [config.leaderJid];
        if (canMention) mentions.push(player.whatsappId);
        await sock.sendMessage(from, { text: alertMessage, mentions });
        return;
    }
    if (newWarnings === 2) {
        const riskMessage = `🔥 @${mentionId} (Nick: *${player.name}*) entrou na *ZONA DE RISCO*. Total agora: ${newWarnings}/5.`;
        await sock.sendMessage(from, { text: riskMessage, mentions: canMention ? [player.whatsappId] : [] });
        return;
    }
    if (newWarnings === 1) {
        if (reason === "advertência manual") {
            await reply(`✅ Advertência manual aplicada a *${player.name}*. Total agora: ${newWarnings}/5.`);
        } else {
            const warningMessage = `🚨 @${mentionId} (Nick: *${player.name}*) foi advertido(a) por *${reason}*. Total agora: ${newWarnings}/5.`;
            await sock.sendMessage(from, { text: warningMessage, mentions: canMention ? [player.whatsappId] : [] });
        }
    }
}

// Função applyAutomaticWarning (sem alterações)
async function applyAutomaticWarning(player, reason, context) {
    // ... (esta função permanece exatamente igual)
    if (!player || !player.id) {
        logger.error("❌ Erro Crítico: Tentativa de punir um jogador inválido."); // Usando logger.error
        return player.warnings || 0;
    }
    const playerRef = db.collection('players').doc(player.id);
    const newWarnings = (player.warnings || 0) + 1;

    if (newWarnings >= 5) {
        await sendWarningNotification(player, newWarnings, reason, context);
        if (player.whatsappId) {
            const allGroups = await context.sock.groupFetchAllParticipating();
            for (const groupId in allGroups) {
                try { await context.sock.groupParticipantsUpdate(groupId, [player.whatsappId], 'remove'); } catch (e) { }
            }
        }
        await playerRef.delete();
    } else {
        await playerRef.update({ warnings: newWarnings });
        await sendWarningNotification(player, newWarnings, reason, context);
    }
    return newWarnings;
}

// Função runPostScoreChecks (sem alterações)
async function runPostScoreChecks(playerId, userId, updateInfo, sock, from) {
    // ... (esta função permanece exatamente igual)
    const context = { sock, from, reply: (text) => sock.sendMessage(from, { text }) };
    try {
        const playerRef = db.collection('players').doc(playerId);
        let playerDocSnap = await playerRef.get();
        if (!playerDocSnap.exists) return;
        let playerData = { id: playerDocSnap.id, ...playerDocSnap.data() };

        if (updateInfo.type === 'war' && updateInfo.points > 0 && updateInfo.points < 550) {
            const reason = "pontuação abaixo do mínimo (550)";
            await applyAutomaticWarning(playerData, reason, context);
        }
    } catch (error) {
        logger.error("❌ Erro crítico em 'runPostScoreChecks':", error); // Usando logger.error
    }
}

/**
 * Verifica os dias anteriores de um jogador em busca de faltas não advertidas e aplica advertências.
 * Esta função é chamada quando um jogador lança pontos para o dia atual.
 * @param {object} player O objeto do jogador (com id, dailyPoints, warnedAbsences, etc.).
 * @param {number} currentDayIndex O índice do dia da semana para o qual os pontos estão sendo lançados (0=Qui, 1=Sex, etc.).
 * @param {object} context O contexto do bot (sock, from, reply).
 * @returns {Promise<void>}
 */
async function checkPreviousAbsencesAndWarnForPlayer(player, currentDayIndex, context) {
    const playerRef = db.collection('players').doc(player.id);
    let currentPlayerData = { ...player };

    logger.debug(`Iniciando verificação de faltas anteriores para ${currentPlayerData.name} até o dia ${config.dayNames[currentDayIndex]}.`);

    for (let dayIndex = 0; dayIndex < currentDayIndex; dayIndex++) {
        // Se o jogador foi removido por advertências anteriores, paramos aqui
        if (!currentPlayerData || currentPlayerData.warnings >= 5) {
            logger.debug(`Jogador ${currentPlayerData?.name || player.name} removido ou com advertências máximas. Parando verificação de faltas anteriores.`);
            break;
        }

        const dailyPoints = currentPlayerData.dailyPoints || [-1, -1, -1, -1];
        const warnedAbsences = currentPlayerData.warnedAbsences || [];

        // Verifica se houve falta (0 pontos) e se já não foi advertido para aquele dia
        if (dailyPoints[dayIndex] === 0 && !warnedAbsences.includes(dayIndex)) {
            const reason = `não participar da guerra de ${config.dayNames[dayIndex]} (advertência tardia)`;
            
            logger.warn(`Aplicando advertência atrasada para ${currentPlayerData.name} por falta em ${config.dayNames[dayIndex]}.`);

            // Adiciona o dia à lista de faltas advertidas
            await playerRef.update({ warnedAbsences: FieldValue.arrayUnion(dayIndex) });

            // Recarrega os dados do jogador para garantir que temos as informações mais recentes para aplicar a advertência
            const updatedPlayerDoc = await playerRef.get();
            if (updatedPlayerDoc.exists) {
                currentPlayerData = { id: updatedPlayerDoc.id, ...updatedPlayerDoc.data() };
                // Aplica a advertência
                await applyAutomaticWarning(currentPlayerData, reason, context);
                
                // Recarrega os dados novamente, caso a advertência tenha levado à expulsão
                const finalCheckDoc = await playerRef.get();
                if (!finalCheckDoc.exists) {
                   currentPlayerData = null; // Marca como nulo se o jogador foi expulso
                } else {
                   currentPlayerData = { id: finalCheckDoc.id, ...finalCheckDoc.data() };
                }
            } else {
                currentPlayerData = null; // Se o jogador não existe mais por algum motivo
            }
        }
    }
    logger.debug(`Verificação de faltas anteriores para ${player.name} concluída.`);
    return currentPlayerData; // Retorna os dados atualizados do jogador
}

/**
 * Realiza uma verificação final de faltas para todos os jogadores da guerra que acabou de terminar.
 * Esta função deve ser chamada no início de uma nova guerra (e.g., pelo comando /novaGuerra).
 * @param {object} context O contexto do bot (sock, from, reply).
 * @returns {Promise<void>}
 */
async function checkPreviousWarAbsences(context) {
    logger.debug('Iniciando verificação FINAL de faltas da guerra anterior para todos os jogadores...');
    const playersRef = db.collection('players');
    const allPlayersSnapshot = await playersRef.get();

    if (allPlayersSnapshot.empty) {
        logger.debug('Nenhum jogador na lista para verificar faltas da guerra anterior.');
        return;
    }

    for (const playerDoc of allPlayersSnapshot.docs) {
        try {
            let playerData = { id: playerDoc.id, ...playerDoc.data() };
            // Verificamos os 4 dias da semana de guerra (Qui, Sex, Sáb, Dom)
            for (let dayIndex = 0; dayIndex < 4; dayIndex++) {
                // Se o jogador já foi removido ou atingiu o limite de advertências, paramos aqui
                if (!playerData || playerData.warnings >= 5) {
                    logger.debug(`Jogador ${playerData?.name || playerDoc.id} já removido ou com advertências máximas. Pulando verificação de faltas anteriores.`);
                    break; 
                }

                const dailyPoints = playerData.dailyPoints || [-1, -1, -1, -1];
                const warnedAbsences = playerData.warnedAbsences || [];

                // Se houver 0 pontos e ainda não advertido para esse dia
                if (dailyPoints[dayIndex] === 0 && !warnedAbsences.includes(dayIndex)) {
                    const reason = `não participar da guerra de ${config.dayNames[dayIndex]} (verificação pós-guerra)`;
                    
                    logger.warn(`Aplicando advertência FINAL para ${playerData.name} por falta em ${config.dayNames[dayIndex]} da guerra anterior.`);

                    // Adiciona o dia à lista de faltas já advertidas
                    await playersRef.doc(playerData.id).update({ warnedAbsences: FieldValue.arrayUnion(dayIndex) });

                    // Recarrega os dados para aplicar a advertência com as infos mais recentes
                    const updatedPlayerDoc = await playersRef.doc(playerData.id).get();
                    if (updatedPlayerDoc.exists) {
                        playerData = { id: updatedPlayerDoc.id, ...updatedPlayerDoc.data() };
                        await applyAutomaticWarning(playerData, reason, context);
                        
                        // Recarrega novamente caso a advertência tenha levado à expulsão
                        const finalCheckDoc = await playersRef.doc(playerData.id).get();
                        if (!finalCheckDoc.exists) {
                           playerData = null;
                        } else {
                           playerData = { id: finalCheckDoc.id, ...finalCheckDoc.data() };
                        }
                    } else {
                        playerData = null;
                    }
                }
            }
        } catch (error) {
            logger.error(`❌ Erro ao processar faltas finais para o jogador ${playerDoc.data()?.name || 'ID INDEFINIDO'} (ID: ${playerDoc.id}):`, error);
        }
        // Pequena pausa para evitar rate-limit no Firebase se houver muitos jogadores
        const randomDelay = Math.floor(Math.random() * 500) + 200; // Pausa entre 200ms e 700ms
        await delay(randomDelay);
    }
    logger.debug('Verificação FINAL de faltas da guerra anterior concluída.');
}

module.exports = {
    runPostScoreChecks,
    sendWarningNotification,
    checkPreviousAbsencesAndWarnForPlayer,
    checkPreviousWarAbsences, // NOVO: Exporta a função de verificação pós-guerra
};
