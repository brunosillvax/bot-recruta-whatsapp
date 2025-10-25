const { db } = require('../../config');
const { getInitialDailyPoints } = require('../playerUtils');
const logger = require('../logger');

/**
 * Handler para o fluxo completo de registro de novo jogador via /nome
 * Sequência: Nome → Nível XP → Torre Rei → Troféus → Defesa Naval
 */
async function handleNewPlayerRegistration(context) {
    const { userMessage, reply, userId, currentState, userStates, cancelAndExit, setUserTimeout, commandMessage } = context;

    // Permitir cancelamento
    if (commandMessage === 'cancelar') {
        return cancelAndExit('❌ Registro cancelado.');
    }

    const playersRef = db.collection('players');

    try {
        switch (currentState.step) {
            case 'awaiting_new_player_name': {
                const nome = userMessage.trim();
                
                if (!nome || nome.length === 0) {
                    return reply('❌ Por favor, digite um nome válido:');
                }

                // Verificar se o nome já existe
                const snapshot = await playersRef.where('name_lowercase', '==', nome.toLowerCase()).get();
                if (!snapshot.empty) {
                    return cancelAndExit(`❌ O nome *${nome}* já está cadastrado na lista!`);
                }

                // Armazenar o nome e avançar para próximo passo
                currentState.playerData = { name: nome };
                currentState.step = 'awaiting_new_player_level';
                setUserTimeout(userId);

                return reply(`✅ Nome: *${nome}*\n\nAgora digite seu *Nível XP*:`);
            }

            case 'awaiting_new_player_level': {
                const level = parseInt(userMessage.trim(), 10);
                
                if (isNaN(level) || level < 1) {
                    return reply('❌ Por favor, digite um número válido para o Nível XP (número inteiro positivo):');
                }

                currentState.playerData.levelXP = level;
                currentState.step = 'awaiting_new_player_tower';
                setUserTimeout(userId);

                return reply(`✅ Nível XP: *${level}*\n\nAgora digite sua *Torre Rei*:`);
            }

            case 'awaiting_new_player_tower': {
                const tower = parseInt(userMessage.trim(), 10);
                
                if (isNaN(tower) || tower < 1) {
                    return reply('❌ Por favor, digite um número válido para a Torre Rei (número inteiro positivo):');
                }

                currentState.playerData.kingTower = tower;
                currentState.step = 'awaiting_new_player_trophies';
                setUserTimeout(userId);

                return reply(`✅ Torre Rei: *${tower}*\n\nAgora digite seus *Troféus*:`);
            }

            case 'awaiting_new_player_trophies': {
                const trophies = parseInt(userMessage.trim(), 10);
                
                if (isNaN(trophies) || trophies < 0) {
                    return reply('❌ Por favor, digite um número válido para os Troféus (número inteiro positivo ou zero):');
                }

                currentState.playerData.trophies = trophies;
                currentState.step = 'awaiting_new_player_naval';
                setUserTimeout(userId);

                return reply(`✅ Troféus: *${trophies}*\n\nPor último, digite seus pontos de *Defesa Naval* (ou 0 se não tiver):`);
            }

            case 'awaiting_new_player_naval': {
                const naval = parseInt(userMessage.trim(), 10);
                
                if (isNaN(naval) || naval < 0) {
                    return reply('❌ Por favor, digite um número válido para a Defesa Naval (número inteiro positivo ou zero):');
                }

                currentState.playerData.navalDefensePoints = naval;

                // Criar o jogador no banco de dados
                const initialPoints = getInitialDailyPoints();
                const newPlayerData = {
                    name: currentState.playerData.name,
                    name_lowercase: currentState.playerData.name.toLowerCase(),
                    dailyPoints: initialPoints,
                    navalDefensePoints: currentState.playerData.navalDefensePoints,
                    levelXP: currentState.playerData.levelXP,
                    kingTower: currentState.playerData.kingTower,
                    trophies: currentState.playerData.trophies,
                    warnings: 0,
                    whatsappId: userId,
                    warnedAbsences: []
                };

                await playersRef.add(newPlayerData);
                logger.debug(`Novo jogador registrado: ${newPlayerData.name} (${userId})`);

                const successMessage = `✅ *Cadastro concluído com sucesso!*\n\n` +
                    `👤 *${newPlayerData.name}*\n` +
                    `📝 Nível XP: ${newPlayerData.levelXP}\n` +
                    `📝 Torre Rei: ${newPlayerData.kingTower}\n` +
                    `📝 Troféus: ${newPlayerData.trophies}\n` +
                    `⚓ Defesa Naval: ${newPlayerData.navalDefensePoints} pontos\n\n` +
                    `Use */me* para ver seu status completo!`;

                return cancelAndExit(successMessage);
            }

            default:
                return cancelAndExit('❌ Estado de conversa inválido. Registro cancelado.');
        }
    } catch (error) {
        logger.error('❌ Erro no registro de novo jogador:', error);
        return cancelAndExit('❌ Ocorreu um erro ao registrar o jogador. Tente novamente.');
    }
}

module.exports = handleNewPlayerRegistration;

