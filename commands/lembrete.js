// FILE: commands/lembrete.js

const { db } = require('../config');
const config = require('../config');
const logger = require('../utils/logger'); // Importa o logger

const handleLembrete = async ({ reply, userMessage }) => {
    const target = userMessage.substring('/lembrete'.length).trim().toLowerCase();
    const validWarTargets = ['quinta', 'sexta', 'sabado', 'domingo', 'quinta-feira', 'sexta-feira', 'sábado'];

    if (!target) {
        return reply("Uso incorreto. Especifique o dia ou 'naval'.\nEx: */lembrete quinta*");
    }

    try {
        const playersSnapshot = await db.collection('players').orderBy('name').get();
        if (playersSnapshot.empty) {
            return reply("Nenhum jogador na lista para verificar.");
        }

        const pendingPlayers = [];
        let checkTitle = '';

        if (target === 'naval') {
            checkTitle = 'Defesa Naval';
            playersSnapshot.docs.forEach(doc => {
                const player = doc.data();
                if (!player.navalDefensePoints || player.navalDefensePoints === 0) {
                    pendingPlayers.push(player.name);
                }
            });
        } else if (validWarTargets.includes(target)) {
            const dayIndex = config.dayMap[target.replace('-feira', '')];
            checkTitle = config.dayNames[dayIndex];
            playersSnapshot.docs.forEach(doc => {
                const player = doc.data();
                if (!player.dailyPoints || player.dailyPoints[dayIndex] === 0) {
                    pendingPlayers.push(player.name);
                }
            });
        } else {
            return reply("Opção inválida. Use 'quinta', 'sexta', 'sabado', 'domingo' ou 'naval'.");
        }

        if (pendingPlayers.length === 0) {
            return reply(`🎉 Todos já registraram os pontos para *${checkTitle}*!`);
        }

        let response = `🚨 *Jogadores com pontuação pendente para ${checkTitle}:*\n\n`;
        pendingPlayers.forEach(name => {
            response += `• ${name}\n`;
        });
        response += `\n*Não esqueçam de lançar os pontos!*`;
        await reply(response);
    } catch (error) {
        logger.error("❌ Erro ao gerar lembrete:", error); // Usando logger.error
        await reply("❌ Ocorreu um erro ao buscar a lista de pendentes.");
    }
};

module.exports = {
    name: 'lembrete',
    handler: handleLembrete,
    isAdminCommand: false
};