const { db } = require('../../config');
const {} = require('../playerUtils');
const logger = require('../logger'); // Importa o logger

async function handleEditConfirmation(context) {
    const { reply, currentState, commandMessage, cancelAndExit } = context;

    if (commandMessage === 'sim') {
        const { oldName, newName } = currentState;
        try {
            const playerDoc = await db.collection('players').where('name', '==', oldName).get();
            if (playerDoc.empty) return cancelAndExit(`❌ O jogador *${oldName}* não foi encontrado.`);
            await playerDoc.docs[0].ref.update({ name: newName, name_lowercase: newName.toLowerCase() });
            cancelAndExit(`✅ Sucesso! *${oldName}* foi renomeado para *${newName}*.`);
        } catch (error) {
            logger.error("❌ Erro ao confirmar edição de nome:", error); // Usando logger.error
            cancelAndExit("❌ Ocorreu um erro ao renomear o jogador.");
        }
    } else {
        cancelAndExit("Ok, a renomeação foi cancelada.");
    }
}

module.exports = handleEditConfirmation;
