// FILE: commandHandler.js

const { db, FieldValue } = require('./config');
const { registerCommand, getCommand } = require('./utils/commandRegistry');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger'); // Importa o logger

// Cache para metadados do grupo (evita chamadas desnecessárias à API)
const groupMetadataCache = new Map();
const CACHE_DURATION = 30000; // 30 segundos

// Carrega dinamicamente todos os comandos
const loadCommands = () => {
    const commandsDir = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js') && file !== 'quickAdd.js'); // MODIFICAÇÃO AQUI

    for (const file of commandFiles) {
        const command = require(path.join(commandsDir, file));
        // Cada arquivo de comando deve exportar um objeto com 'name' e 'handler'
        // e opcionalmente 'isAdminCommand'.
        // Ex: module.exports = { name: 'help', handler: handleHelp };
        if (command.name && command.handler) {
            registerCommand(command.name, command.handler, command.isAdminCommand || false);
        } else {
            logger.warn(`⚠️ Aviso: O arquivo de comando ${file} não exporta 'name' e 'handler' corretamente.`); // Usando logger.warn
        }
    }
};

loadCommands(); // Carrega os comandos uma vez na inicialização

// Importar handleQuickAdd separadamente, pois é um caso especial de comando fallback
const handleQuickAdd = require('./commands/quickAdd');

// Função auxiliar para obter metadados do grupo com cache
async function getGroupMetadataWithCache(sock, groupId) {
    const now = Date.now();
    const cached = groupMetadataCache.get(groupId);
    
    // Verifica se o cache ainda é válido
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        logger.debug(`📋 Usando metadados do grupo em cache para ${groupId}`);
        return cached.metadata;
    }
    
    // Cache expirado ou não existe, busca novos dados
    logger.debug(`🔄 Buscando novos metadados do grupo para ${groupId}`);
    
    let retries = 3;
    let groupMetadata = null;
    
    while (retries > 0 && !groupMetadata) {
        try {
            groupMetadata = await sock.groupMetadata(groupId);
            logger.debug(`✅ Metadados do grupo obtidos com sucesso para ${groupId}`);
        } catch (e) {
            retries--;
            logger.warn(`⚠️ Tentativa de obter metadados do grupo falhou (${3 - retries}/3):`, e.message);
            if (retries > 0) {
                // Aguarda 1 segundo antes da próxima tentativa
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    if (groupMetadata) {
        // Armazena no cache
        groupMetadataCache.set(groupId, {
            metadata: groupMetadata,
            timestamp: now
        });
        return groupMetadata;
    }
    
    throw new Error(`Falha ao obter metadados do grupo ${groupId} após 3 tentativas`);
}

// Função para limpar o cache de metadados do grupo
function clearGroupMetadataCache(groupId = null) {
    if (groupId) {
        groupMetadataCache.delete(groupId);
        logger.debug(`🗑️ Cache de metadados limpo para o grupo ${groupId}`);
    } else {
        groupMetadataCache.clear();
        logger.debug(`🗑️ Cache de metadados limpo para todos os grupos`);
    }
}

// Exporta a função para uso em outros módulos
module.exports.clearGroupMetadataCache = clearGroupMetadataCache;

module.exports = async (context) => {
    const { sock, from, userId, userMessage, reply } = context;

    // --- Verificação de Admin (VERSÃO COM CACHE E ROBUSTA) ---
    let isAdmin = false;
    if (from.endsWith('@g.us')) {
        try {
            const groupMetadata = await getGroupMetadataWithCache(sock, from);
            const sender = groupMetadata.participants.find(p => p.id === userId);
            
            if (sender) {
                isAdmin = (sender.admin === 'superadmin' || sender.admin === 'admin');
                logger.debug(`🔍 Verificação de admin para ${userId}: ${isAdmin ? 'ADMIN' : 'USUÁRIO COMUM'} (tipo: ${sender.admin})`);
            } else {
                logger.warn(`⚠️ Participante ${userId} não encontrado na lista do grupo ${from}`);
            }
        } catch (e) { 
            logger.error("❌ Erro ao verificar admin:", e); 
        }
    }
    context.isAdmin = isAdmin;

    // --- ROTEADOR DE COMANDOS DINÂMICO ---
    const messageLower = userMessage.toLowerCase();
    const commandName = messageLower.split(' ')[0].replace('/', '');
    const command = getCommand(commandName);

    if (command) {
        if (command.isAdminCommand && !isAdmin) {
            return reply('❌ Você não tem permissão para usar este comando.');
        }
        return command.handler(context);
    } else if (messageLower.startsWith('/')) {
        // Se a mensagem começa com "/", mas não foi um comando registrado, tenta quickAdd
        return handleQuickAdd(context);
    }
    
    // Mensagens que não começam com "/" (e não são comandos) serão ignoradas.
};