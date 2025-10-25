const { db } = require('../config');
const { findPlayerByName } = require('../utils/playerUtils');
const { sendWarningNotification } = require('../utils/warningSystem');

async function handlePunir(context) { 
    if (!context.isAdmin) { 
        return context.reply("❌ Apenas administradores podem usar este comando."); 
    } 
    const { userMessage, reply, userStates, setUserTimeout, userId, from } = context; 
    const playerName = userMessage.substring('/punir'.length).trim(); 
    if (!playerName) return reply("Formato incorreto. Use: `/punir [nome]`"); 
    try { 
        const result = await findPlayerByName(playerName); 
        switch (result.status) { 
            case 'not_found': 
                if (result.suggestions && result.suggestions.length > 0) { 
                    let msg = `❌ Jogador *${playerName}* não encontrado.\n\nVocê quis dizer?\n`; 
                    const suggestionObjects = result.suggestions.map(name => ({ name })); 
                    suggestionObjects.forEach((p, index) => { msg += `${index + 1} - ${p.name}\n`; }); 
                    msg += `\n(Digite o número ou /cancelar)`; 
                    userStates.set(userId, { 
                        step: 'awaiting_ambiguous_choice_punir', 
                        suggestions: suggestionObjects,
                        originalMessage: userMessage, // Salva a mensagem original
                        playerNameToPunish: playerName // Salva o nome que se tentou punir
                    }); 
                    setUserTimeout(userId, from); 
                    return reply(msg); 
                } else { 
                    return reply(`❌ Jogador *${playerName}* não encontrado.`); 
                } 
            case 'ambiguous': 
                let responseText = `Você quis dizer um destes?\n`; 
                result.suggestions.forEach((p, index) => { responseText += `${index + 1} - ${p.name}\n`; }); 
                responseText += `\n(Digite o número ou /cancelar)`; 
                userStates.set(userId, { 
                    step: 'awaiting_ambiguous_choice_punir', 
                    suggestions: result.suggestions,
                    originalMessage: userMessage, // Salva a mensagem original
                    playerNameToPunish: playerName // Salva o nome que se tentou punir
                }); 
                setUserTimeout(userId, from); 
                return reply(responseText); 
            case 'exact': 
            case 'similar': 
                const playerToPunish = result.data; 
                if (result.status === 'similar') { 
                    await reply(`Aviso: O nome mais próximo encontrado foi *${playerToPunish.name}*. Aplicando punição.`); 
                } 
                const playerRef = db.collection('players').doc(playerToPunish.id); 
                const newWarnings = (playerToPunish.warnings || 0) + 1; 
                if (newWarnings >= 5) { 
                    await sendWarningNotification(playerToPunish, newWarnings, "advertência manual", context); 
                    if (playerToPunish.whatsappId) { 
                        try { 
                            const allGroups = await context.sock.groupFetchAllParticipating(); 
                            for (const groupId in allGroups) { 
                                await context.sock.groupParticipantsUpdate(groupId, [playerToPunish.whatsappId], 'remove'); 
                            } 
                        } catch (e) { 
                            console.error("Erro ao remover do grupo:", e); 
                        } 
                    } 
                    await playerRef.delete(); 
                } else { 
                    await playerRef.update({ warnings: newWarnings }); 
                    await sendWarningNotification(playerToPunish, newWarnings, "advertência manual", context); 
                } 
                break; 
            case 'empty_list': 
                return reply("A lista de jogadores está vazia."); 
        } 
    } catch (error) { 
        console.error("❌ Erro no /punir:", error); 
        return reply("❌ Ocorreu um erro ao aplicar a advertência."); 
    } 
}

module.exports = {
    name: 'punir',
    handler: handlePunir,
    isAdminCommand: true
};
