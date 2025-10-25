// FILE: index.js (VERSÃO CORRIGIDA E MELHORADA)

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const logger = require('./utils/logger'); // Importa o logger centralizado
const axios = require('axios');
const qrcode = require('qrcode');
const FormData = require('form-data');
const config = require('./config');
const commandHandler = require('./commandHandler');
const conversationHandler = require('./conversationHandler');
const passiveHandler = require('./passiveHandler');
const { healthCheck } = require('./utils/healthCheck');
const { autoMemoryManager } = require('./utils/autoMemoryManager');

// A variável global 'sockInstance' foi removida por não estar sendo utilizada.
// A instância do socket 'sock' é passada corretamente através do objeto de contexto.

// Estado global para graceful shutdown
let isShuttingDown = false;
let sockInstance = null;

// VIGIA DE ERROS GRAVES (MANTIDO, POIS É UMA BOA PRÁTICA)
process.on('uncaughtException', (error, origin) => {
    logger.error(`🚨 ERRO GRAVE NÃO CAPTURADO:`); // Usando logger.error
    logger.error(`Origem do erro:`, origin); // Usando logger.error
    logger.error(`Detalhes do Erro:\n`, error); // Usando logger.error
    process.exit(1); // Desliga para evitar comportamento inesperado
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

/**
 * Função para realizar shutdown gracioso
 * @param {string} signal - Sinal recebido (SIGTERM, SIGINT, etc)
 */
async function gracefulShutdown(signal) {
    if (isShuttingDown) {
        logger.warn('Shutdown já em andamento, ignorando sinal adicional');
        return;
    }
    
    isShuttingDown = true;
    logger.info(`\n🔴 Recebido sinal ${signal}. Iniciando shutdown gracioso...`);
    
    try {
        // 1. Parar de aceitar novas mensagens/conexões
        logger.info('1/5 - Parando de aceitar novas mensagens...');
        
        // 2. Limpar todos os timeouts de usuário
        logger.info('2/5 - Limpando timeouts de usuários...');
        for (const [userId, timeoutId] of userTimeouts.entries()) {
            clearTimeout(timeoutId);
        }
        userTimeouts.clear();
        logger.info(`   ✓ ${userTimeouts.size} timeouts limpos`);
        
        // 3. Parar health check e auto memory manager
        logger.debug('3/6 - Parando health check e auto memory manager...');
        healthCheck.stop();
        autoMemoryManager.stop();
        logger.debug('   ✓ Health check e auto memory manager parados');
        
        // 4. Limpar estados de usuário
        logger.info('4/6 - Limpando estados de conversa...');
        const stateCount = userStates.size;
        userStates.clear();
        logger.info(`   ✓ ${stateCount} estados limpos`);
        
        // 5. Notificar no Discord sobre o shutdown
        logger.info('5/6 - Notificando shutdown no Discord...');
        try {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('content', `🔴 Bot está sendo desligado (${signal}). Voltarei em breve!`);
            await axios.post(config.discordWebhookUrl, form, { 
                headers: form.getHeaders(),
                timeout: 5000 
            });
            logger.info('   ✓ Notificação enviada');
        } catch (error) {
            logger.warn('   ⚠ Falha ao enviar notificação de shutdown:', error.message);
        }
        
        // 6. Fechar conexão do WhatsApp graciosamente
        logger.info('6/6 - Fechando conexão do WhatsApp...');
        if (sockInstance) {
            try {
                await sockInstance.logout();
                logger.info('   ✓ Logout realizado com sucesso');
            } catch (error) {
                logger.warn('   ⚠ Erro ao fazer logout:', error.message);
            }
        }
        
        logger.info('✅ Shutdown gracioso concluído com sucesso!');
        process.exit(0);
        
    } catch (error) {
        logger.error('❌ Erro durante shutdown gracioso:', error);
        process.exit(1);
    }
}

// Registra handlers para sinais de término
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handler para erros não tratados de Promise (unhandledRejection)
process.on('unhandledRejection', (reason, promise) => {
    logger.error('🚨 Promise Rejection não tratada:', reason);
    logger.error('Promise:', promise);
    // Não fazer exit aqui, apenas logar para debugging
});

const userStates = new Map();
const userTimeouts = new Map();

async function connectToWhatsApp() {
    try {
        logger.debug('Debug: Iniciando useMultiFileAuthState...');
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        logger.debug('Debug: useMultiFileAuthState concluído.');

    // Usar versão específica estável do WhatsApp Web
    const version = [2, 3000, 1028716292];
    logger.info(`📱 [Bot] Using WA Web v${version.join(".")} (versão estável)`);

    logger.info('Iniciando o bot do WhatsApp...'); // Usando logger.info
    const sock = makeWASocket({ 
        logger: pino({ level: 'silent' }), 
        auth: state,
        version: version,
        // Melhorias na conexão para estabilidade
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 30_000,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 3,
        markOnlineOnConnect: false, // Melhora estabilidade
        syncFullHistory: false, // Melhora performance
        fireInitQueries: true,
        shouldSyncHistoryMessage: () => false, // Melhora performance
        generateHighQualityLinkPreview: false, // Melhora performance
        getMessage: async (key) => {
            return {
                conversation: 'Mensagem temporária'
            }
        }
    }); // Pino para WaSocket continua silent
    
    // Salva a instância do socket para graceful shutdown
    sockInstance = sock;

    // --- FUNÇÕES DE GERENCIAMENTO DE ESTADO E TIMEOUT ---
    const setUserTimeout = (userId, from) => {
        clearUserTimeout(userId);
        const timeoutId = setTimeout(() => {
            if (userStates.has(userId)) {
                userStates.delete(userId);
                try {
                    if (from) {
                        sock.sendMessage(from, { text: "Sua sessão expirou por inatividade." });
                    }
                } catch (error) {
                    logger.error(`⚠️ Erro ao enviar mensagem de timeout para ${from}:`, error); // Usando logger.error
                }
            }
        }, config.sessionTimeoutMinutes * 60000);
        userTimeouts.set(userId, timeoutId);
    };
    const clearUserTimeout = (userId) => {
        if (userTimeouts.has(userId)) {
            clearTimeout(userTimeouts.get(userId));
            userTimeouts.delete(userId);
        }
    };

    // --- HANDLER DE ATUALIZAÇÃO DE CONEXÃO ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        logger.debug(`Debug: connection.update recebido. Status: ${connection}`);
        if (lastDisconnect?.error) {
            logger.debug(`Debug: lastDisconnect error: ${lastDisconnect.error.message}`);
        }
        if (qr) {
            logger.info('QR Code gerado, enviando para o Discord...'); // Usando logger.info
            
            // Gerar QR code no terminal
            qrcode.toString(qr, { type: 'terminal', small: true }, (err, terminalQR) => {
                if (!err) {
                    console.log('\n' + '='.repeat(50));
                    console.log('📱 ESCANEIE O QR CODE ABAIXO COM SEU WHATSAPP:');
                    console.log('='.repeat(50));
                    console.log(terminalQR);
                    console.log('='.repeat(50) + '\n');
                }
            });
            
            // Enviar QR code para o Discord
            qrcode.toBuffer(qr, async (err, buffer) => {
                if (err) { logger.error('Erro ao gerar QR Code:', err); return; } // Usando logger.error
                const form = new FormData();
                form.append('file1', buffer, { filename: 'qrcode.png' });
                try {
                    await axios.post(config.discordWebhookUrl, form, { headers: form.getHeaders() });
                } catch (error) {
                    logger.error('❌ Erro ao enviar QR Code para o Discord:', error.message); // Usando logger.error
                }
            });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.warn(`Conexão fechada. Motivo: ${lastDisconnect.error?.message}. Tentando reconectar: ${shouldReconnect}`); // Usando logger.warn
            
            if (shouldReconnect) {
                // Delay progressivo para reconexão
                const delay = Math.min(1000 * Math.pow(2, 0), 30000); // Começa com 1s, máximo 30s
                logger.info(`Tentando reconectar em ${delay}ms...`);
                setTimeout(() => {
                    if (!isShuttingDown) {
                        connectToWhatsApp();
                    }
                }, delay);
            }
        } else if (connection === 'open') {
            logger.info('✅ Bot conectado e pronto para uso!'); // Usando logger.info
            
            // Inicia health check após conexão bem-sucedida
            if (config.performance.healthCheck.enabled) {
                healthCheck.start();
            }
            
            // Inicia auto memory manager
            autoMemoryManager.start();
        }
    });

    // --- HANDLER DE ATUALIZAÇÃO DE CREDENCIAIS ---
    sock.ev.on('creds.update', saveCreds);

    // --- HANDLER DE NOVOS PARTICIPANTES NO GRUPO ---
    sock.ev.on('group-participants.update', async (event) => {
        if (event.id !== config.allowedGroupId || event.action !== 'add') return;

        // MELHORIA: Itera sobre todos os novos participantes, tornando o código mais robusto.
        for (const newMemberId of event.participants) {
            const from = event.id;
            if (!from || !newMemberId) {
                logger.error('⚠️ Tentativa de boas-vindas falhou: ID do grupo ou do novo membro é inválido.', event); // Usando logger.error
                continue; // Pula para o próximo participante se houver erro
            }

            const welcomeText = `Olá, @${newMemberId.split('@')[0]}! Seja bem-vindo(a) ao nosso clã! 🥳\n\nEu sou o bot que registra os pontos da guerra. Vou fazer algumas perguntas para cadastrar você:\n\n📝 Nome no jogo\n📝 Nível XP\n📝 Torre Rei\n📝 Troféus\n⚓ Defesa Naval\n\nVamos começar! Qual é o seu *nick (nome de usuário) no jogo*?`;

            userStates.set(newMemberId, { 
                step: 'awaiting_new_player_name',
                playerData: {} 
            });
            setUserTimeout(newMemberId, from);

            try {
                await sock.sendMessage(from, { text: welcomeText, mentions: [newMemberId] });
            } catch (error) {
                logger.error(`⚠️ Erro ao enviar mensagem de boas-vindas para ${from}:`, error); // Usando logger.error
            }
        }
    });

    // --- HANDLER PRINCIPAL DE MENSAGENS ---
    sock.ev.on('messages.upsert', async (m) => {
        // Ignora mensagens durante shutdown
        if (isShuttingDown) {
            logger.debug('Bot em shutdown, ignorando mensagem');
            return;
        }
        
        const msg = m.messages[0];

        // Filtro para ignorar mensagens inválidas, do próprio bot ou de status
        if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') {
            return;
        }

        const from = msg.key.remoteJid;
        
        // Filtro para garantir que o bot só responda no grupo permitido
        if (from !== config.allowedGroupId) return;

        // Extração de informações essenciais da mensagem
        const userId = msg.key.participant || msg.key.remoteJid;
        const userMessage = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

        // Ignora mensagens sem texto (ex: apenas imagem, vídeo)
        if (!userMessage) return;

        // Função auxiliar para simplificar o envio de respostas
        const reply = async (text, quotedMessage = msg) => {
            if (!from) {
                logger.error(`⚠️ Erro CRÍTICO: Tentativa de resposta para um destinatário NULO.`); // Usando logger.error
                return;
            }
            try {
                return await sock.sendMessage(from, { text }, { quoted: quotedMessage });
            } catch (error) {
                logger.error(`⚠️ Erro ao enviar mensagem (reply) para ${from}:`, error); // Usando logger.error
            }
        };

        const currentState = userStates.get(userId);
        const context = { sock, msg, from, userId, userMessage, reply, userStates, setUserTimeout, clearUserTimeout, currentState };

        // Lógica para o comando de cancelamento de operação
        if (userMessage.toLowerCase() === '/sair' || userMessage.toLowerCase() === '/cancelar') {
            if (currentState) {
                clearUserTimeout(userId);
                userStates.delete(userId);
                return reply("Operação cancelada.");
            }
            return; // Ignora se não houver operação em andamento
        }

        // Roteamento da mensagem:
        
        // 1. Se o usuário está no meio de uma conversa, direciona para o 'conversationHandler'
        if (currentState) {
            setUserTimeout(userId, from); // Reseta o timeout a cada nova mensagem na conversa
            return conversationHandler(context);
        }

        // 2. Se não está em uma conversa, verifica o tipo de mensagem
        if (userMessage.startsWith('/')) {
            // Se começa com '/', é um comando, direciona para o 'commandHandler'
            return commandHandler(context);
        } else {
            // Se for uma mensagem normal, direciona para o 'passiveHandler'
            return passiveHandler(context);
        }
    });
    } catch (error) {
        logger.error('❌ Erro ao conectar com WhatsApp:', error);
        // Tenta reconectar após 5 segundos em caso de erro
        setTimeout(() => {
            if (!isShuttingDown) {
                connectToWhatsApp();
            }
        }, 5000);
    }
}

connectToWhatsApp();