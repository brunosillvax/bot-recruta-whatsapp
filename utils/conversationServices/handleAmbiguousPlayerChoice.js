const handlePunir = require('../../commands/punir');
const handleEdit = require('../../commands/edit');
const handleRemove = require('../../commands/remover');

async function handleAmbiguousPlayerChoice(context) {
    const { userMessage, reply, currentState, cancelAndExit } = context;
    const commandMessage = userMessage.toLowerCase();

    const choiceNumber = parseInt(commandMessage, 10);
    const choiceIndex = choiceNumber - 1;
    if (isNaN(choiceIndex) || !currentState.suggestions[choiceIndex]) {
        return reply("Opção inválida. Por favor, digite um dos números da lista ou /cancelar.");
    }
    const selectedPlayer = currentState.suggestions[choiceIndex];
    
    context.isAdmin = currentState.isAdmin; // Preserva o status de admin do contexto original

    if (currentState.step === 'awaiting_ambiguous_choice_punir') {
        cancelAndExit();
        await reply(`${choiceNumber} escolhido: *${selectedPlayer.name}*. Continuando a punição...`);
        // Reconstrói a mensagem original com o nome desambiguado
        const originalCommandBase = currentState.originalMessage.split(' ')[0]; // Ex: /punir
        context.userMessage = `${originalCommandBase} ${selectedPlayer.name}`; 
        return handlePunir.handler(context); // Chama o handler do comando punir
    }
    if (currentState.step === 'awaiting_ambiguous_choice_edit') {
        cancelAndExit();
        await reply(`${choiceNumber} escolhido: *${selectedPlayer.name}*. Continuando a edição...`);
        // Reconstrói a mensagem original com o nome desambiguado e o novo nome
        const originalCommandBase = currentState.originalMessage.split(' ')[0]; // Ex: /edit
        // Assumindo que o formato é "/edit [oldName] para [newName]"
        context.userMessage = `${originalCommandBase} ${selectedPlayer.name} para ${currentState.newNameForEdit}`;
        return handleEdit.handler(context); // Chama o handler do comando edit
    }
    if (currentState.step === 'awaiting_ambiguous_choice_remove') {
        cancelAndExit();
        await reply(`${choiceNumber} escolhido: *${selectedPlayer.name}*. Continuando a remoção...`);
        // Reconstrói a mensagem original com o nome desambiguado
        const originalCommandBase = currentState.originalMessage.split(' ')[0]; // Ex: /remover
        context.userMessage = `${originalCommandBase} ${selectedPlayer.name}`;
        return handleRemove.handler(context); // Chama o handler do comando remover
    }
}

module.exports = handleAmbiguousPlayerChoice;
