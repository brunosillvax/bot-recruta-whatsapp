// FILE: commands/resetarAdvs.js

const { db } = require('../config');
const logger = require('../utils/logger'); // Importa o logger

async function handleResetarAdvs({ reply }) {
    try {
        const playersRef = db.collection('players');
        const snapshot = await playersRef.get();
        if (snapshot.empty) return reply("Nenhum jogador na lista.");

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { warnings: 0 });
        });
        await batch.commit();
        await reply(`✅ Todas as advertências foram zeradas com sucesso.`);
    } catch (error) {
        logger.error("❌ Erro no comando /resetar_advs:", error);
        return reply("❌ Ocorreu um erro ao resetar as advertências.");
    }
}

module.exports = {
    name: 'resetar_advs',
    handler: handleResetarAdvs,
    isAdminCommand: true
};




