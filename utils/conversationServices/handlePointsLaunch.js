const { db } = require('../../config');
const config = require('../../config');
const { findPlayerByName, updatePlayerBackup } = require('../playerUtils');
const { runPostScoreChecks, checkPreviousAbsencesAndWarnForPlayer } = require('../warningSystem');
const logger = require('../../utils/logger'); // Added logger import

async function handlePointsLaunch(context) {
    const { sock, from, userId, userMessage, reply, currentState, userStates, setUserTimeout, clearUserTimeout, commandMessage } = context;
    const cancelAndExit = (message) => {
        if (message) reply(message);
        clearUserTimeout(userId);
        userStates.delete(userId);
    };

    switch (currentState.step) {
        case 'awaiting_player_choice':
            const playerNumber = parseInt(commandMessage, 10);
            const selectedPlayer = currentState.playersList.find(p => p.number === playerNumber);
            if (selectedPlayer) {
                const menuMessage = `Certo, *${selectedPlayer.name}*. Lançar pontos para qual evento?\n\n*1.* Guerra\n*2.* Defesa Naval\n\n(Digite /sair para cancelar)`;
                userStates.set(userId, { ...currentState, step: 'awaiting_menu_choice', selectedPlayer });
                await reply(menuMessage);
            } else {
                await reply(`Opção inválida.`);
                let playerListMessage = 'Vamos tentar de novo. Escolha um jogador:\n\n';
                currentState.playersList.forEach(p => {
                    playerListMessage += `*${p.number}.* ${p.name}\n`;
                });
                await reply(playerListMessage);
            }
            break;

        case 'awaiting_menu_choice':
            if (commandMessage === '1') {
                const dayMessage = `Entendido, *Guerra*. Em qual dia?\n\n*Quinta-feira*\n*Sexta-feira*\n*Sábado*\n*Domingo*\n\n(Digite /sair para cancelar)`;
                userStates.set(userId, { ...currentState, step: 'awaiting_day_choice', eventType: 'Guerra' });
                await reply(dayMessage);
                return;
            }
            if (commandMessage === '2') {
                userStates.set(userId, { ...currentState, step: 'awaiting_points_input', eventType: 'Defesa Naval' });
                await reply(`Ok, *Defesa Naval*. Quantos pontos *${currentState.selectedPlayer.name}* fez?\n\n(Digite /sair para cancelar)`);
                return;
            }
            if (commandMessage === '3') {
                userStates.set(userId, { ...currentState, step: 'awaiting_points_input', eventType: 'Torre Rei' });
                await reply(`Ok, *Torre Rei*. Qual o nível da Torre de *${currentState.selectedPlayer.name}*?\n\n(Digite /sair para cancelar)`);
                return;
            }
            if (commandMessage === '4') {
                userStates.set(userId, { ...currentState, step: 'awaiting_points_input', eventType: 'Troféus' });
                await reply(`Ok, *Troféus*. Quantos troféus *${currentState.selectedPlayer.name}* tem?\n\n(Digite /sair para cancelar)`);
                return;
            }
            if (commandMessage === '5') {
                userStates.set(userId, { ...currentState, step: 'awaiting_points_input', eventType: 'Nível XP' });
                await reply(`Ok, *Nível XP*. Qual o nível de *${currentState.selectedPlayer.name}*?\n\n(Digite /sair para cancelar)`);
                return;
            }
            const invalidMenuMessage = `Opção inválida. Vamos tentar de novo: Lançar pontos para qual evento?\n\n*1.* Guerra\n*2.* Defesa Naval\n*3.* Torre Rei\n*4.* Troféus\n*5.* Nível XP\n\n(Digite /sair para cancelar)`;
            await reply(invalidMenuMessage);
            return;

        case 'awaiting_day_choice':
            const dayIndex = config.dayMap[commandMessage.replace('-feira', '')];
            if (dayIndex !== undefined) {
                
                const botDate = new Date();
                botDate.setHours(botDate.getHours() - 9); // Aplica 9h de tolerância para o fim do dia

                const jsDayOfWeek = botDate.getDay();
                const warDayMapForBlock = { 4: 0, 5: 1, 6: 2, 0: 3, 1: 4, 2: 4, 3: 4 }; // Mapeamento para bloqueio
                const currentWarDayIndex = warDayMapForBlock[jsDayOfWeek];

                if (currentWarDayIndex !== undefined && dayIndex < currentWarDayIndex) {
                    let todayMessage = (currentWarDayIndex > 3) 
                        ? "A semana de guerra já encerrou."
                        : `Hoje, para o bot, é *${config.dayNames[currentWarDayIndex]}*.`;
                    
                    return cancelAndExit(`❌ O prazo para registrar pontos de *${config.dayNames[dayIndex]}* já encerrou. ${todayMessage}`);
                }

                const dayName = config.dayNames[dayIndex];
                userStates.set(userId, { ...currentState, step: 'awaiting_points_input', dayIndex, dayName });
                await reply(`Ok, *${dayName}*. Quantos pontos de *Guerra* para *${currentState.selectedPlayer.name}*?\n\n(Digite /sair para cancelar)`);
            } else {
                await reply("Dia inválido.");
                const dayMessage = `Vamos tentar de novo: Em qual dia?\n\n*Quinta-feira*\n*Sexta-feira*\n*Sábado*\n*Domingo*\n\n(Digite /sair para cancelar)`;
                await reply(dayMessage);
            }
            break;

        case 'awaiting_points_input':
            const points = parseInt(commandMessage, 10);
            if (Number.isFinite(points) && points >= 0) {
                // NOVO: Verificar faltas anteriores antes de continuar
                if (currentState.eventType === 'Guerra') {
                    const playerDoc = await db.collection('players').doc(currentState.selectedPlayer.id).get();
                    if (!playerDoc.exists) {
                        return cancelAndExit(`❌ O jogador *${currentState.selectedPlayer.name}* não foi encontrado no banco de dados. Lançamento cancelado.`);
                    }
                    let playerData = { id: playerDoc.id, ...playerDoc.data() };

                    // Passamos o contexto completo para a função de advertência
                    const warningContext = { sock, from, reply };
                    playerData = await checkPreviousAbsencesAndWarnForPlayer(playerData, currentState.dayIndex, warningContext);

                    if (!playerData || playerData.warnings >= 5) {
                        // NEW: Alterado de reply para logger.debug
                        logger.debug(`Lançamento cancelado: O jogador ${currentState.selectedPlayer.name} foi removido devido a advertências acumuladas.`);
                        return cancelAndExit(`❌ Lançamento cancelado: O jogador *${currentState.selectedPlayer.name}* foi removido devido a advertências acumuladas.`);
                    }
                    // Atualiza o currentState com os dados mais recentes do jogador, caso algo tenha mudado (ex: warnings)
                    userStates.set(userId, { ...currentState, selectedPlayer: { ...currentState.selectedPlayer, ...playerData } });
                }

                let confMsg = `📝 *CONFIRMAÇÃO*\n\n`;
                confMsg += `*Jogador:* ${currentState.selectedPlayer.name}\n`;
                confMsg += `*Evento:* ${currentState.eventType}\n`;
                if (currentState.eventType === 'Guerra') confMsg += `*Dia:* ${currentState.dayName}\n`;
                confMsg += `*Pontos:* ${points}\n\n`;
                confMsg += `Está tudo certo? Responda com *sim* para salvar.\n\n(Digite /sair para cancelar)`;
                userStates.set(userId, { ...currentState, step: 'awaiting_confirmation', points });
                await reply(confMsg);
            } else {
                await reply("Valor inválido. Digite apenas números.");
                if (currentState.eventType === 'Guerra') {
                    await reply(`Vamos tentar de novo: Quantos pontos de *Guerra* para *${currentState.selectedPlayer.name}*?`);
                } else if (currentState.eventType === 'Defesa Naval') {
                    await reply(`Vamos tentar de novo: Quantos pontos de *Defesa Naval* para *${currentState.selectedPlayer.name}*?`);
                } else if (currentState.eventType === 'Torre Rei') {
                    await reply(`Vamos tentar de novo: Qual o nível da Torre de *${currentState.selectedPlayer.name}*?`);
                } else if (currentState.eventType === 'Troféus') {
                    await reply(`Vamos tentar de novo: Quantos troféus *${currentState.selectedPlayer.name}* tem?`);
                } else if (currentState.eventType === 'Nível XP') {
                    await reply(`Vamos tentar de novo: Qual o nível de *${currentState.selectedPlayer.name}*?`);
                }
            }
            break;
    }
}

module.exports = handlePointsLaunch;
