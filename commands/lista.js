// FILE: commands/lista.js (VERSÃO FINAL E MAIS ROBUSTA)

const { db } = require('../config');
const logger = require('../utils/logger'); // Importa o logger

async function handleLista(context) {
    const { from, userId, reply, userStates, setUserTimeout } = context;

    try {
        const playersRef = db.collection('players');
        const allPlayersSnapshot = await playersRef.get(); // Puxa TODOS os jogadores

        if (allPlayersSnapshot.empty) {
            return reply("A lista de jogadores está vazia.");
        }

        // --- LÓGICA DE BUSCA APRIMORADA (DIRETO NO CÓDIGO) ---
        const userIdentifier = userId.split('@')[0].split(':')[0]; // Pega a parte mais limpa possível do ID
        let foundPlayerDoc = null;

        // Procura na lista de jogadores que o bot baixou
        for (const doc of allPlayersSnapshot.docs) {
            const playerData = doc.data();
            if (playerData.whatsappId && playerData.whatsappId.startsWith(userIdentifier)) {
                foundPlayerDoc = doc;
                break; // Para a busca assim que encontra
            }
        }
        // --- FIM DA NOVA LÓGICA ---

        if (!foundPlayerDoc) {
            return reply("Seu número não está cadastrado no bot. Para começar, use o comando:\n\n*/nome SEU_NICK_NO_JOGO*");
        }

        const playerDoc = foundPlayerDoc;
        const selectedPlayer = {
            id: playerDoc.id,
            name: playerDoc.data().name,
        };

        userStates.set(userId, {
            step: 'awaiting_menu_choice',
            selectedPlayer: selectedPlayer
        });
        setUserTimeout(userId, from);

        const menuMessage = `Olá, *${selectedPlayer.name}*. Lançar pontos para qual evento?\n\n*1.* Guerra\n*2.* Defesa Naval\n*3.* Torre Rei\n*4.* Troféus\n*5.* Nível XP\n\n(Digite /sair para cancelar)`;
        await reply(menuMessage);

    } catch (error) {
        logger.error("❌ Erro no comando /lista:", error); // Usando logger.error
        return reply("❌ Ocorreu um erro ao processar sua solicitação.");
    }
}

module.exports = {
    name: 'lista',
    handler: handleLista,
    isAdminCommand: false
};
