const { db } = require('../../config');
const logger = require('../logger');

/**
 * Handler para o fluxo de atualização de informações de jogador via /cadastro
 * Permite atualização seletiva digitando "." para manter valores atuais
 * Sequência: Nível XP → Torre Rei → Troféus → Defesa Naval
 */
async function handlePlayerUpdate(context) {
    const { userMessage, reply, userId, currentState, cancelAndExit, setUserTimeout, commandMessage } = context;

    // Permitir cancelamento
    if (commandMessage === 'cancelar') {
        return cancelAndExit('❌ Atualização cancelada.');
    }

    try {
        const playerRef = db.collection('players').doc(currentState.playerId);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            return cancelAndExit('❌ Erro: Jogador não encontrado no banco de dados.');
        }

        const playerData = playerDoc.data();
        const input = userMessage.trim();

        switch (currentState.step) {
            case 'awaiting_update_level': {
                let newLevel = playerData.levelXP || 0;

                if (input !== '.' && input !== 'pular') {
                    const level = parseInt(input, 10);
                    if (isNaN(level) || level < 1) {
                        return reply('❌ Por favor, digite um número válido para o Nível XP ou "." para manter o atual:');
                    }
                    newLevel = level;
                }

                currentState.updateData.levelXP = newLevel;
                currentState.step = 'awaiting_update_tower';
                setUserTimeout(userId);

                const emoji = newLevel !== (playerData.levelXP || 0) ? '✅' : '⏭️';
                const currentTower = playerData.kingTower || 'Não informado';
                
                return reply(
                    `${emoji} Nível XP: ${newLevel === (playerData.levelXP || 0) ? `mantido (${newLevel})` : newLevel}\n\n` +
                    `*Torre Rei* (atual: ${currentTower})\n` +
                    `Digite o novo valor ou "." para manter:`
                );
            }

            case 'awaiting_update_tower': {
                let newTower = playerData.kingTower || 0;

                if (input !== '.' && input !== 'pular') {
                    const tower = parseInt(input, 10);
                    if (isNaN(tower) || tower < 1) {
                        return reply('❌ Por favor, digite um número válido para a Torre Rei ou "." para manter o atual:');
                    }
                    newTower = tower;
                }

                currentState.updateData.kingTower = newTower;
                currentState.step = 'awaiting_update_trophies';
                setUserTimeout(userId);

                const emoji = newTower !== (playerData.kingTower || 0) ? '✅' : '⏭️';
                const currentTrophies = playerData.trophies || 'Não informado';
                
                return reply(
                    `${emoji} Torre Rei: ${newTower === (playerData.kingTower || 0) ? `mantida (${newTower})` : newTower}\n\n` +
                    `*Troféus* (atual: ${currentTrophies})\n` +
                    `Digite o novo valor ou "." para manter:`
                );
            }

            case 'awaiting_update_trophies': {
                let newTrophies = playerData.trophies || 0;

                if (input !== '.' && input !== 'pular') {
                    const trophies = parseInt(input, 10);
                    if (isNaN(trophies) || trophies < 0) {
                        return reply('❌ Por favor, digite um número válido para os Troféus ou "." para manter o atual:');
                    }
                    newTrophies = trophies;
                }

                currentState.updateData.trophies = newTrophies;
                currentState.step = 'awaiting_update_naval';
                setUserTimeout(userId);

                const emoji = newTrophies !== (playerData.trophies || 0) ? '✅' : '⏭️';
                const currentNaval = playerData.navalDefensePoints || 0;
                
                return reply(
                    `${emoji} Troféus: ${newTrophies === (playerData.trophies || 0) ? `mantidos (${newTrophies})` : newTrophies}\n\n` +
                    `*Defesa Naval* (atual: ${currentNaval})\n` +
                    `Digite o novo valor ou "." para manter:`
                );
            }

            case 'awaiting_update_naval': {
                let newNaval = playerData.navalDefensePoints || 0;

                if (input !== '.' && input !== 'pular') {
                    const naval = parseInt(input, 10);
                    if (isNaN(naval) || naval < 0) {
                        return reply('❌ Por favor, digite um número válido para a Defesa Naval ou "." para manter o atual:');
                    }
                    newNaval = naval;
                }

                currentState.updateData.navalDefensePoints = newNaval;

                // Atualizar apenas os campos modificados
                const updateFields = {};
                let hasChanges = false;

                if (currentState.updateData.levelXP !== (playerData.levelXP || 0)) {
                    updateFields.levelXP = currentState.updateData.levelXP;
                    hasChanges = true;
                }
                if (currentState.updateData.kingTower !== (playerData.kingTower || 0)) {
                    updateFields.kingTower = currentState.updateData.kingTower;
                    hasChanges = true;
                }
                if (currentState.updateData.trophies !== (playerData.trophies || 0)) {
                    updateFields.trophies = currentState.updateData.trophies;
                    hasChanges = true;
                }
                if (currentState.updateData.navalDefensePoints !== (playerData.navalDefensePoints || 0)) {
                    updateFields.navalDefensePoints = currentState.updateData.navalDefensePoints;
                    hasChanges = true;
                }

                if (hasChanges) {
                    await playerRef.update(updateFields);
                    logger.debug(`Jogador ${playerData.name} (${currentState.playerId}) atualizou suas informações`);
                }

                const navalEmoji = newNaval !== (playerData.navalDefensePoints || 0) ? '✅' : '⏭️';

                const successMessage = `${navalEmoji} Defesa Naval: ${newNaval === (playerData.navalDefensePoints || 0) ? `mantida (${newNaval})` : newNaval}\n\n` +
                    `✅ *Informações ${hasChanges ? 'atualizadas' : 'verificadas'} com sucesso!*\n\n` +
                    `📝 Nível XP: ${currentState.updateData.levelXP}${currentState.updateData.levelXP === (playerData.levelXP || 0) ? ' (mantido)' : ' ✨'}\n` +
                    `📝 Torre Rei: ${currentState.updateData.kingTower}${currentState.updateData.kingTower === (playerData.kingTower || 0) ? ' (mantida)' : ' ✨'}\n` +
                    `📝 Troféus: ${currentState.updateData.trophies}${currentState.updateData.trophies === (playerData.trophies || 0) ? ' (mantidos)' : ' ✨'}\n` +
                    `⚓ Defesa Naval: ${currentState.updateData.navalDefensePoints}${currentState.updateData.navalDefensePoints === (playerData.navalDefensePoints || 0) ? ' (mantida)' : ' ✨'}`;

                return cancelAndExit(successMessage);
            }

            default:
                return cancelAndExit('❌ Estado de conversa inválido. Atualização cancelada.');
        }
    } catch (error) {
        logger.error('❌ Erro na atualização de jogador:', error);
        return cancelAndExit('❌ Ocorreu um erro ao atualizar suas informações. Tente novamente.');
    }
}

module.exports = handlePlayerUpdate;

