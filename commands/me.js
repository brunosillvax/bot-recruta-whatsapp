const { db } = require('../config');
const config = require('../config');
const { findPlayerByName, findPlayerByWaId } = require('../utils/playerUtils');
const logger = require('../utils/logger');

async function handleMe({ reply, userId, userMessage, sock }) {
    try {
        const playersRef = db.collection('players');
        const allPlayersSnapshot = await playersRef.get(); 

        if (allPlayersSnapshot.empty) {
            return reply("A lista de jogadores está vazia.");
        }

        let targetPlayer = null;
        let targetUserId = userId;

        // Verificar se é uma consulta de outro jogador
        const messageParts = userMessage.trim().split(' ');
        
        if (messageParts.length > 1) {
            // Modo 2: Por menção ou Modo 3: Por nome
            const searchTerm = messageParts.slice(1).join(' ').trim();
            
            if (searchTerm.startsWith('@')) {
                // Modo 2: Buscar por menção
                const mentionedJid = searchTerm.substring(1);
                const userIdentifier = mentionedJid.split('@')[0].split(':')[0];
                
                for (const doc of allPlayersSnapshot.docs) {
                    const playerData = doc.data();
                    if (playerData.whatsappId && playerData.whatsappId.startsWith(userIdentifier)) {
                        targetPlayer = playerData;
                        targetUserId = playerData.whatsappId;
                        break;
                    }
                }
            } else {
                // Modo 3: Buscar por nome
                const findResult = await findPlayerByName(searchTerm);
                if (findResult.status === 'exact' || findResult.status === 'similar') {
                    targetPlayer = findResult.data;
                    targetUserId = findResult.data.whatsappId;
                } else {
                    return reply(`❌ Jogador "${searchTerm}" não encontrado.`);
                }
            }
        } else {
            // Modo 1: Próprio perfil
            const userIdentifier = userId.split('@')[0].split(':')[0]; 
            
            for (const doc of allPlayersSnapshot.docs) {
                const playerData = doc.data();
                if (playerData.whatsappId && playerData.whatsappId.startsWith(userIdentifier)) {
                    targetPlayer = playerData;
                    break;
                }
            }
        }

        if (!targetPlayer) {
            return reply("ℹ️ Seu número de WhatsApp não está registrado. Use */nome [seu nick no jogo]* para se registrar.");
        }
        
        const { name, dailyPoints, navalDefensePoints, warnings, levelXP, kingTower, trophies } = targetPlayer;
        const points = dailyPoints || [-1, -1, -1, -1];
        const dayNames = config.dayNames.map(d => d.split('-')[0]);

        // 1. Lógica para criar a lista detalhada da guerra
        let warStatusDetails = '';
        points.forEach((p, index) => {
            let statusEmoji = '';
            let statusText = '';
            if (p === -1) {
                statusEmoji = '⚫';
                statusText = '(Aguardando)';
            } else if (p === 0) {
                statusEmoji = '🔴';
                statusText = '(Não atacou)';
            } else {
                statusEmoji = '✅';
                statusText = `(${p} pts)`;
            }
            warStatusDetails += ` › ${dayNames[index]}: ${statusEmoji} ${statusText}\n`;
        });

        // 2. Lógica para o status da conduta
        let warningsText = '';
        const warningsCount = warnings || 0;
        if (warningsCount === 0) {
            warningsText = '- *Limpa*';
        } else if (warningsCount <= 2) {
            warningsText = '- *Requer Atenção*';
        } else {
            warningsText = '- *Em Risco*';
        }

        // 3. Monta a resposta final
        let response = `👤 *Status de Batalha: ${name}*\n\n`;
        
        // Adicionar seção de informações do jogador
        response += `📝 *Informações do Jogador:*\n`;
        response += ` › Nível XP: ${levelXP || 'Não informado'}\n`;
        response += ` › Torre Rei: ${kingTower || 'Não informado'}\n`;
        response += ` › Troféus: ${trophies || 'Não informado'}\n\n`;
        
        response += `*Desempenho na Guerra:*\n${warStatusDetails}\n`;
        response += `⚓ *Defesa Naval:* ${navalDefensePoints || 0} pontos\n`;
        response += `⚠️ *Conduta:* ${warningsCount}/5 Advertências ${warningsText}`;
        
        return reply(response);

    } catch (error) {
        logger.error("❌ Erro no comando /me:", error);
        return reply("❌ Ocorreu um erro ao buscar o status.");
    }
}

module.exports = {
    name: 'me',
    handler: handleMe,
    isAdminCommand: false
};

