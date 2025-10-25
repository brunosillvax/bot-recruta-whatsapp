const { db } = require('../config');
const { findPlayerByWaId } = require('../utils/playerUtils');
const logger = require('../utils/logger');

/**
 * Comando /cadastro - Permite jogadores já registrados atualizarem suas informações
 * Verifica se o jogador está registrado e inicia fluxo interativo de atualização
 */
async function handleCadastro({ reply, userId, userStates, setUserTimeout }) {
    try {
        // Verificar se o jogador está registrado
        const findResult = await findPlayerByWaId(userId);
        
        if (findResult.status === 'not_found') {
            return reply(
                '❌ Você não está cadastrado no sistema!\n\n' +
                'Use */nome* para fazer seu primeiro cadastro com todas as informações.'
            );
        }

        const playerData = findResult.data;
        
        // Inicializar sessão de conversação para atualização
        userStates.set(userId, {
            step: 'awaiting_update_level',
            playerId: playerData.id,
            updateData: {
                levelXP: playerData.levelXP || 0,
                kingTower: playerData.kingTower || 0,
                trophies: playerData.trophies || 0,
                navalDefensePoints: playerData.navalDefensePoints || 0
            }
        });

        setUserTimeout(userId);

        const currentLevel = playerData.levelXP || 'Não informado';
        
        return reply(
            `📝 *Vamos atualizar suas informações, ${playerData.name}!*\n\n` +
            `*Nível XP* (atual: ${currentLevel})\n` +
            `Digite o novo valor ou "." para manter:`
        );

    } catch (error) {
        logger.error('❌ Erro no comando /cadastro:', error);
        return reply('❌ Ocorreu um erro ao verificar seu cadastro. Tente novamente.');
    }
}

module.exports = {
    name: 'cadastro',
    handler: handleCadastro,
    isAdminCommand: false
};
