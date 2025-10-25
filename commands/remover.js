const { db } = require('../config');
const { findPlayerByName } = require('../utils/playerUtils');

async function handleRemove(context) { 
    if (!context.isAdmin) { 
        return context.reply("❌ Apenas administradores."); 
    } 
    const { reply, userMessage, userId, userStates, setUserTimeout, from } = context; 
    const nomeParaRemover = userMessage.substring('/remover'.length).trim(); 
    if (!nomeParaRemover) return reply("Digite o nome a remover."); 
    try { 
        const result = await findPlayerByName(nomeParaRemover); 
        switch (result.status) { 
            case 'not_found': 
                if (result.suggestions && result.suggestions.length > 0) { 
                    let msg = `❌ Jogador *${nomeParaRemover}* não encontrado.\n\nVocê quis dizer?\n`; 
                    const suggestionObjects = result.suggestions.map(name => ({ name })); 
                    suggestionObjects.forEach((p, index) => { msg += `${index + 1} - ${p.name}\n`; }); 
                    msg += `\n(Digite o número ou /cancelar)`; 
                    userStates.set(userId, { 
                        step: 'awaiting_ambiguous_choice_remove', 
                        suggestions: suggestionObjects,
                        originalMessage: userMessage, // Salva a mensagem original
                        playerNameToRemove: nomeParaRemover // Salva o nome que se tentou remover
                    }); 
                    setUserTimeout(userId, from); 
                    return reply(msg); 
                } else { 
                    return reply(`❌ Jogador *${nomeParaRemover}* não encontrado.`); 
                } 
            case 'ambiguous': 
                let responseText = `Qual destes para remover?\n\n`; 
                result.suggestions.forEach((p, index) => { responseText += `${index + 1} - ${p.name}\n`; }); 
                responseText += `\n(Digite o número ou /cancelar)`; 
                userStates.set(userId, { 
                    step: 'awaiting_ambiguous_choice_remove', 
                    suggestions: result.suggestions,
                    originalMessage: userMessage, // Salva a mensagem original
                    playerNameToRemove: nomeParaRemover // Salva o nome que se tentou remover
                }); 
                setUserTimeout(userId, from); 
                return reply(responseText); 
            case 'exact': 
            case 'similar': 
                const playerToRemove = result.data; 
                userStates.set(userId, { step: 'awaiting_remove_confirmation', playerToRemoveName: playerToRemove.name }); 
                setUserTimeout(userId, from); 
                let confirmMsg = `Remover *${playerToRemove.name}* da lista e dos grupos?\n\nResponda *sim*.`; 
                if (result.status === 'similar') { 
                    confirmMsg = `Nome próximo: *${playerToRemove.name}*. Remover?\n\nResponda *sim*.`; 
                } 
                return reply(confirmMsg); 
            case 'empty_list': 
                return reply("A lista está vazia."); 
        } 
    } catch (error) { 
        console.error("❌ Erro no /remover:", error); 
        return reply("❌ Ocorreu um erro ao remover."); 
    }
}

module.exports = {
    name: 'remover',
    handler: handleRemove,
    isAdminCommand: true
};
