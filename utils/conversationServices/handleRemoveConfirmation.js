const { db } = require('../../config');
const { findPlayerByName } = require('../playerUtils');
const logger = require('../logger'); // Importa o logger

async function handleRemoveConfirmation(context) {
    const { sock, reply, currentState, commandMessage, cancelAndExit } = context;

    if (commandMessage === 'sim') {
        const { playerToRemoveName } = currentState;
        try {
            const findResult = await findPlayerByName(playerToRemoveName);
            if (findResult.status === 'not_found') return cancelAndExit(`❌ O jogador *${playerToRemoveName}* não foi encontrado.`);
            
            const player = findResult.data;
            let failedGroups = [];
            
            if (player.whatsappId) {
                try {
                    const allGroups = await sock.groupFetchAllParticipating();
                    for (const groupId in allGroups) {
                        try {
                            await sock.groupParticipantsUpdate(groupId, [player.whatsappId], 'remove');
                        } catch (e) {
                            logger.error(`Falha ao remover ${player.name} do grupo ${groupId}:`, e); // Usando logger.error
                            const groupMetadata = await sock.groupMetadata(groupId).catch(() => ({ subject: groupId }));
                            failedGroups.push(groupMetadata.subject);
                        }
                    }
                } catch (e) {
                    logger.error("Erro ao buscar a lista de grupos para remoção:", e); // Usando logger.error
                }
            }

            await db.collection('players').doc(player.id).delete();

            let finalMessage = `✅ Sucesso! *${player.name}* foi removido da lista.`;
            if (failedGroups.length > 0) {
                finalMessage += `\n\n⚠️ *Atenção:* Não foi possível remover o usuário dos seguintes grupos (verifique se o bot é admin):\n- ${failedGroups.join('\n- ')}`;
            }
            cancelAndExit(finalMessage);
        } catch (error) {
            logger.error("❌ Erro ao confirmar remoção:", error); // Usando logger.error
            cancelAndExit("❌ Ocorreu um erro ao remover o jogador.");
        }
    } else {
        cancelAndExit("Ok, remoção cancelada.");
    }
}

module.exports = handleRemoveConfirmation;
