// FILE: commands/restaurarBackup.js

const { db } = require('../config');
const {} = require('../utils/playerUtils'); // Remover a importação de updatePlayerBackup
const logger = require('../utils/logger'); // Importa o logger

async function handleRestaurarBackup({ reply }) {
    try {
        const backupRef = db.collection('backups').doc('player_list');
        const backupDoc = await backupRef.get();
        if (!backupDoc.exists) {
            return reply("❌ Nenhum backup encontrado para restaurar.");
        }
        const backupData = backupDoc.data();
        const playersToRestore = backupData.players || [];
        if (playersToRestore.length === 0) {
            return reply("⚠️ O backup está vazio. Nenhuma ação foi tomada.");
        }
        await reply("Restaurando a lista... Isso pode levar um momento.");
        const playersRef = db.collection('players');
        const currentPlayersSnapshot = await playersRef.get();
        const batch = db.batch();
        currentPlayersSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        playersToRestore.forEach(backupPlayer => {
            const newPlayerRef = playersRef.doc();
            batch.set(newPlayerRef, backupPlayer);
        });
        await batch.commit();
        return reply(`✅ Sucesso! A lista com os dados de *${playersToRestore.length}* jogadores foi restaurada.`);
    } catch (error) {
        logger.error("❌ Erro ao restaurar o backup:", error);
        return reply("❌ Ocorreu um erro crítico ao tentar restaurar o backup.");
    }
}

module.exports = {
    name: 'restaurar_backup',
    handler: handleRestaurarBackup,
    isAdminCommand: true
};

