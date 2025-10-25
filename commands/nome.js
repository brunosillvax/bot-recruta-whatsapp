const { db } = require('../config');
const { findPlayerByWaId } = require('../utils/playerUtils');
const logger = require('../utils/logger');

async function handleNome({ reply, userMessage, userId, userStates, setUserTimeout }) {
    const nome = userMessage.substring('/nome'.length).trim();
    
    if (!nome) {
        return reply("Por favor, digite seu nome. Ex: */nome Mestre Yoda*");
    }

    try {
        // Verificar se o jogador já está registrado
        const findResult = await findPlayerByWaId(userId);
        
        if (findResult.status === 'found') {
            const playerData = findResult.data;
            return reply(
                `ℹ️ Você já está cadastrado como *${playerData.name}*!\n\n` +
                'Use */cadastro* para atualizar suas informações.'
            );
        }

        // Verificar se o nome já existe
        const playersRef = db.collection('players');
        const snapshot = await playersRef.where('name_lowercase', '==', nome.toLowerCase()).get();
        
        if (!snapshot.empty) {
            const existingName = snapshot.docs[0].data().name;
            return reply(`❌ O nome *${existingName}* já está na lista!`);
        }

        // Inicializar sessão de conversação para registro completo
        userStates.set(userId, {
            step: 'awaiting_new_player_name',
            playerData: { name: nome }
        });

        setUserTimeout(userId);

        return reply(
            `👋 *Bem-vindo! Vamos fazer seu cadastro completo.*\n\n` +
            `✅ Nome: *${nome}*\n\n` +
            `Agora digite seu *Nível XP*:`
        );

    } catch (error) {
        logger.error("❌ Erro no comando /nome:", error);
        return reply("❌ Ocorreu um erro ao processar seu cadastro. Tente novamente.");
    }
}

module.exports = {
    name: 'nome',
    handler: handleNome,
    isAdminCommand: false
};

