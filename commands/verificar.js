// FILE: commands/verificar.js (VERSÃO ATUALIZADA)

const { db } = require('../config');
const logger = require('../utils/logger'); // Importa o logger

// A função principal do comando /verificar
async function handleVerificar(context) {
    const { sock, from, reply, isAdmin } = context;

    // Apenas administradores podem usar este comando
    if (!isAdmin) {
        return reply("❌ Apenas administradores do grupo podem usar este comando.");
    }

    try {
        await reply("🔎 Verificando a lista de membros... Isso pode levar um momento.");

        // --- PASSO 1: Obter todos os participantes do grupo do WhatsApp ---
        const groupMetadata = await sock.groupMetadata(from);
        const groupMembers = new Map(groupMetadata.participants.map(p => [p.id, p]));
        
        // --- PASSO 2: Obter todos os jogadores registrados no banco de dados (Firebase) ---
        const playersSnapshot = await db.collection('players').get();
        const registeredPlayers = new Map(playersSnapshot.docs.map(doc => {
            const data = doc.data();
            return [data.whatsappId, { name: data.name }];
        }));

        // =================================================================
        // ===== LÓGICA DE COMPARAÇÃO ATUALIZADA AQUI =======================
        // =================================================================
        const notRegisteredInBot = [];
        const notInGroup = [];
        const mentions = []; // Lista para guardar os JIDs a serem mencionados

        // Verifica quem está no grupo, mas não registrado no bot
        for (const [jid, participant] of groupMembers.entries()) {
            if (!registeredPlayers.has(jid)) {
                // Adiciona o texto da menção à lista de texto
                // O WhatsApp usará o pushName do participante para renderizar a menção
                const mentionText = `@${jid.split('@')[0]}`;
                notRegisteredInBot.push(mentionText);
                // Adiciona o JID completo para a menção funcionar
                mentions.push(jid); 
            }
        }
        
        // Verifica quem está registrado no bot, mas não está mais no grupo
        for (const [jid, playerData] of registeredPlayers.entries()) {
            // Adicionado um null check para segurança
            if (jid && !groupMembers.has(jid)) {
                notInGroup.push(playerData.name);
            }
        }
        // =================================================================
        // ===== FIM DA ATUALIZAÇÃO ========================================
        // =================================================================

        // --- PASSO 4: Montar a mensagem de resposta ---
        let response = "📋 *Relatório de Verificação de Membros* 📋\n\n";
        
        if (notRegisteredInBot.length > 0) {
            response += "*👤 Membros no grupo que NÃO estão registrados no bot:*\n";
            response += "(Devem usar o comando `/nome [nick]`)\n";
            // Apenas adiciona o texto, a lógica de menção já foi feita
            notRegisteredInBot.forEach(mention => {
                response += `- ${mention}\n`;
            });
        } else {
            response += "✅ Todos os membros do grupo estão registrados no bot.\n";
        }
        
        response += "\n--------------------\n\n";

        if (notInGroup.length > 0) {
            response += "*👋 Jogadores na lista do bot que NÃO estão mais no grupo:*\n";
            response += "(Considere usar `/remover [nome]` para limpar a lista)\n";
            notInGroup.forEach(name => {
                response += `- ${name}\n`;
            });
        } else {
            response += "✅ Todos os jogadores registrados no bot estão no grupo.\n";
        }

        // Envia a mensagem final, mencionando os usuários não registrados
        await sock.sendMessage(from, { text: response, mentions: mentions });

    } catch (error) {
        logger.error("❌ Erro no comando /verificar:", error); // Usando logger.error
        await reply("❌ Ocorreu um erro ao tentar verificar os membros.");
    }
}

// Exporta a função para ser usada no seu commandHandler principal
module.exports = {
    name: 'verificar',
    handler: handleVerificar,
    isAdminCommand: true // É um comando de admin
};
