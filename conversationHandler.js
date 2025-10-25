// FILE: conversationHandler.js (VERSÃO CORRIGIDA)

const { db, FieldValue } = require('./config');
const config = require('./config');
const { runPostScoreChecks } = require('./utils/warningSystem');
// MODIFICAÇÃO AQUI: Importa a função 'getInitialDailyPoints' da sua fonte original
const { findPlayerByName, getInitialDailyPoints } = require('./utils/playerUtils');
// Remove a importação de playerCommands, pois o arquivo commands/player.js foi removido
// const playerCommands = require('./commands/player');

const handleNewMemberRegistration = require('./utils/conversationServices/handleNewMemberRegistration');
const handleNewPlayerRegistration = require('./utils/conversationServices/handleNewPlayerRegistration');
const handlePlayerUpdate = require('./utils/conversationServices/handlePlayerUpdate');
const handlePointsLaunch = require('./utils/conversationServices/handlePointsLaunch');
const handleAmbiguousPlayerChoice = require('./utils/conversationServices/handleAmbiguousPlayerChoice');
const handlePointsConfirmation = require('./utils/conversationServices/handlePointsConfirmation');
const handleEditConfirmation = require('./utils/conversationServices/handleEditConfirmation');
const handleRemoveConfirmation = require('./utils/conversationServices/handleRemoveConfirmation');
const logger = require('./utils/logger'); // Importa o logger centralizado

// A função duplicada 'getInitialDailyPoints' foi REMOVIDA daqui para evitar inconsistências.

const conversationHandler = async (context) => {
    const { sock, from, userId, userMessage, reply, currentState, userStates, setUserTimeout, clearUserTimeout } = context;
    const commandMessage = userMessage.toLowerCase();
    const cancelAndExit = (message) => {
        if (message) reply(message);
        clearUserTimeout(userId);
        userStates.delete(userId);
    };

    // Adiciona cancelAndExit ao contexto para as novas funções de serviço
    context.cancelAndExit = cancelAndExit;
    context.commandMessage = commandMessage;

    switch (currentState.step) {


        case 'awaiting_new_player_name':
        case 'awaiting_new_player_level':
        case 'awaiting_new_player_tower':
        case 'awaiting_new_player_trophies':
        case 'awaiting_new_player_naval':
            return handleNewPlayerRegistration(context);

        case 'awaiting_update_level':
        case 'awaiting_update_tower':
        case 'awaiting_update_trophies':
        case 'awaiting_update_naval':
            return handlePlayerUpdate(context);

        case 'awaiting_player_choice':
        case 'awaiting_menu_choice':
        case 'awaiting_day_choice':
        case 'awaiting_points_input':
            return handlePointsLaunch(context);

        case 'awaiting_ambiguous_choice_punir':
        case 'awaiting_ambiguous_choice_edit':
        case 'awaiting_ambiguous_choice_remove': 
            return handleAmbiguousPlayerChoice(context);

        case 'awaiting_edit_confirmation':
            return handleEditConfirmation(context);

        case 'awaiting_remove_confirmation':
            return handleRemoveConfirmation(context);

        case 'awaiting_confirmation':
            return handlePointsConfirmation(context);
            
        default:
            cancelAndExit("🤔 Estado de conversa inválido. A operação foi cancelada para segurança.");
            logger.warn(`Estado de conversa inválido para userId ${userId}: ${currentState.step}`); // Log de aviso
            break;
    }
};

module.exports = conversationHandler;