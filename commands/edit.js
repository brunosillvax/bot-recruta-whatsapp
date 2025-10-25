const { db } = require('../config');
const { findPlayerByName } = require('../utils/playerUtils'); // Adicionado findPlayerByName

async function handleEdit(context) {
    const { reply, userMessage, userId, userStates, setUserTimeout, from, isAdmin } = context; // Adicionado isAdmin
    const messageContent = userMessage.substring('/edit'.length).trim();

    // 1. Tentar parsear para edição de outro jogador por admin: "/edit [oldName] para [newName]"
    const adminEditMatch = messageContent.match(/^(.*?)\s+para\s+(.*)$/i);

    if (adminEditMatch && isAdmin) {
        const oldName = adminEditMatch[1].trim();
        const newName = adminEditMatch[2].trim();

        if (!oldName || !newName) {
            return reply("Formato incorreto para admins. Use: `/edit [nome_antigo] para [novo_nome]`");
        }

        try {
            const result = await findPlayerByName(oldName);

            switch (result.status) {
                case 'not_found':
                    if (result.suggestions && result.suggestions.length > 0) {
                        let msg = `❌ Jogador *${oldName}* não encontrado.\n\nVocê quis dizer?\n`;
                        const suggestionObjects = result.suggestions.map(name => ({ name }));
                        suggestionObjects.forEach((p, index) => { msg += `${index + 1} - ${p.name}\n`; });
                        msg += `\n(Digite o número ou /cancelar)`;
                        userStates.set(userId, { 
                            step: 'awaiting_ambiguous_choice_edit', 
                            suggestions: suggestionObjects,
                            originalMessage: userMessage, // Salva a mensagem original completa
                            playerNameToEdit: oldName, // Salva o nome que se tentou editar
                            newNameForEdit: newName // Salva o novo nome desejado
                        });
                        setUserTimeout(userId, from);
                        return reply(msg);
                    } else {
                        return reply(`❌ Jogador *${oldName}* não encontrado.`);
                    }
                case 'ambiguous':
                    let responseText = `Você quis dizer um destes?\n`;
                    result.suggestions.forEach((p, index) => { responseText += `${index + 1} - ${p.name}\n`; });
                    responseText += `\n(Digite o número ou /cancelar)`;
                    userStates.set(userId, { 
                        step: 'awaiting_ambiguous_choice_edit', 
                        suggestions: result.suggestions,
                        originalMessage: userMessage, // Salva a mensagem original completa
                        playerNameToEdit: oldName, // Salva o nome que se tentou editar
                        newNameForEdit: newName // Salva o novo nome desejado
                    });
                    setUserTimeout(userId, from);
                    return reply(responseText);
                case 'exact':
                case 'similar':
                    const playerToEdit = result.data;
                    if (result.status === 'similar') {
                        await reply(`Aviso: O nome mais próximo encontrado foi *${playerToEdit.name}*. Alterando nome.`);
                    }
                    // Confirmação para evitar edições acidentais
                    userStates.set(userId, { 
                        step: 'awaiting_edit_confirmation', 
                        oldName: playerToEdit.name, 
                        newName: newName 
                    });
                    setUserTimeout(userId, from);
                    return reply(`Confirma a alteração de nome de *${playerToEdit.name}* para *${newName}*? Responda *sim*.`);
                case 'empty_list':
                    return reply("A lista de jogadores está vazia.");
            }
        } catch (error) {
            console.error("❌ Erro no comando /edit (admin):", error);
            return reply("❌ Ocorreu um erro ao tentar alterar o nome do jogador.");
        }
    } 
    // 2. Edição do próprio nome pelo usuário normal: "/edit [newName]"
    else if (!adminEditMatch) { // Se não foi uma tentativa de edição de admin para outro jogador
        const newName = messageContent;
        if (!newName) {
            return reply("Formato incorreto. Use: `/edit [seu novo nome]` ou, se for admin, `/edit [nome_antigo] para [nome_novo]`");
        }
        try {
            const playersRef = db.collection('players');
            const snapshot = await playersRef.where('whatsappId', '==', userId).limit(1).get();
            if (snapshot.empty) {
                return reply("❌ Você não está na lista. Use `/nome [seu nick]` para se registrar.");
            }
            const playerDoc = snapshot.docs[0];
            await playerDoc.ref.update({
                name: newName,
                name_lowercase: newName.toLowerCase()
            });
            return reply(`✅ Seu nome foi alterado com sucesso para *${newName}*.`);
        } catch (error) {
            console.error("❌ Erro no comando /edit (próprio usuário):", error);
            return reply("❌ Ocorreu um erro ao tentar alterar seu nome.");
        }
    } else {
        return reply("Formato incorreto para o comando /edit. Verifique o uso correto.");
    }
}

module.exports = {
    name: 'edit',
    handler: handleEdit,
    isAdminCommand: false // Este comando pode ser usado por não-admins para editar o próprio nome. A parte admin é verificada internamente.
};
