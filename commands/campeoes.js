// FILE: commands/campeoes.js

const { db } = require('../config');
const logger = require('../utils/logger'); // Importa o logger

const handleCampeoes = async ({ reply }) => {
    try {
        const hallOfFameRef = db.collection('hall_of_fame');
        const snapshot = await hallOfFameRef.orderBy('wins', 'desc').get();

        if (snapshot.empty) {
            return reply("🏆 O Hall da Fama ainda está vazio. Seja o primeiro a conquistá-lo!");
        }

        let response = "🏆 *Hall da Fama - Maiores Campeões* 🏆\n\n";
        const medalhas = ['🥇', '🥈', '🥉'];

        snapshot.docs.forEach((doc, index) => {
            const player = doc.data();
            const medalha = medalhas[index] || '🏅';
            const vitoriaTexto = player.wins > 1 ? 'vitórias' : 'vitória';
            response += `${medalha} *${player.name}* - ${player.wins} ${vitoriaTexto}\n`;
        });

        await reply(response);
    } catch (error) {
        logger.error("❌ Erro ao gerar o Hall da Fama:", error); // Usando logger.error
        await reply("❌ Ocorreu um erro ao tentar buscar o Hall da Fama.");
    }
};

module.exports = {
    name: 'campeoes',
    handler: handleCampeoes,
    isAdminCommand: false
};