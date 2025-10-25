// FILE: config.js (VERSÃO ATUALIZADA COM VALIDAÇÃO)

require('dotenv').config(); // Carrega as variáveis de ambiente do .env

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const logger = require('./utils/logger'); // Importa o logger

// ============================================
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
// ============================================

/**
 * Valida que uma variável de ambiente obrigatória está definida
 * @param {string} varName - Nome da variável
 * @param {string} defaultValue - Valor padrão (opcional)
 * @returns {string}
 */
function requireEnvVar(varName, defaultValue = null) {
    const value = process.env[varName] || defaultValue;
    if (!value) {
        logger.error(`❌ ERRO FATAL: Variável de ambiente obrigatória não definida: ${varName}`);
        logger.error(`Por favor, configure ${varName} no arquivo .env`);
        logger.error(`Consulte o arquivo .env.example para referência`);
        process.exit(1);
    }
    return value;
}

/**
 * Obtém uma variável de ambiente com valor padrão
 * @param {string} varName - Nome da variável
 * @param {any} defaultValue - Valor padrão
 * @returns {string}
 */
function getEnvVar(varName, defaultValue) {
    return process.env[varName] || defaultValue;
}

/**
 * Converte string para boolean
 * @param {string} value - Valor string
 * @param {boolean} defaultValue - Valor padrão
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return value === 'true' || value === '1';
}

/**
 * Converte string para número
 * @param {string} value - Valor string
 * @param {number} defaultValue - Valor padrão
 * @returns {number}
 */
function parseNumber(value, defaultValue) {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

logger.info('🔧 Carregando configurações do bot...');

// Carregue suas credenciais do Firebase aqui
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
        logger.info('Credenciais do Firebase carregadas da variável de ambiente.');
    } catch (error) {
        logger.error('❌ ERRO: Falha ao decodificar ou parsear FIREBASE_SERVICE_ACCOUNT_BASE64:', error);
        process.exit(1);
    }
} else {
    try {
        serviceAccount = require('./chave-admin.json'); 
        logger.warn('Credenciais do Firebase carregadas do arquivo local (chave-admin.json). Para produção, considere usar FIREBASE_SERVICE_ACCOUNT_BASE64.');
    } catch (error) {
        logger.error('❌ ERRO: Não foi possível carregar as credenciais do Firebase do arquivo local:', error);
        process.exit(1);
    }
}

// Inicialize o Firebase
initializeApp({
    credential: cert(serviceAccount)
});

// Exporte a instância do banco de dados e o FieldValue
const db = getFirestore();

module.exports = {
    // Exportações do Firebase
    db,
    FieldValue,

    // Suas configurações existentes (MANTIDAS)
    allowedGroupId: process.env.ALLOWED_GROUP_ID || '120363420675199775@g.us', // Exemplo de uso de variável de ambiente
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || 'https://discordapp.com/api/webhooks/1409233807160250500/koys4Zh0Bsl91tVkTlyhLz_nsM8_iZaX24XmZx8lNWAwDDFuX1ggWKoZmJkkjOgbY7xq', // Exemplo de uso de variável de ambiente
    searchTolerance: parseInt(process.env.SEARCH_TOLERANCE || '3', 10), // Convertido para número
    sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '5', 10), // Convertido para número
    dayMap: {
        'quinta': 0, 'quinta-feira': 0,
        'sexta': 1, 'sexta-feira': 1,
        'sabado': 2, 'sábado': 2,
        'domingo': 3
    },
    dayNames: ["Quinta-feira", "Sexta-feira", "Sábado", "Domingo"],
    leaderJid: process.env.LEADER_JID || '5527996419901@s.whatsapp.net', // Exemplo de uso de variável de ambiente

    // --- SEÇÃO ADICIONADA: Lembretes Automáticos ---
    autoReminder: {
        enabled: process.env.AUTO_REMINDER_ENABLED === 'true', // Convertido para booleano
        timezone: process.env.TIMEZONE || 'America/Sao_Paulo',
        schedule: {
            quinta: process.env.REMINDER_SCHEDULE_QUINTA || '0 21 * * 4',
            sexta: process.env.REMINDER_SCHEDULE_SEXTA || '0 21 * * 5',
            sabado: process.env.REMINDER_SCHEDULE_SABADO || '0 21 * * 6',
            domingo: process.env.REMINDER_SCHEDULE_DOMINGO || '0 20 * * 0'
        }
    },

    // --- SEÇÃO ADICIONADA: Divisões do Ranking ---
    rankingDivisions: [
        { name: 'DIVISÃO DE ELITE', emoji: '👑', minPoints: parseNumber(process.env.RANKING_ELITE_MIN_POINTS, 3000) },
        { name: 'ALTO DESEMPENHO', emoji: '🔥', minPoints: parseNumber(process.env.RANKING_HIGH_PERFORMANCE_MIN_POINTS, 2500) },
        { name: 'EM DIA', emoji: '✅', minPoints: parseNumber(process.env.RANKING_ON_TRACK_MIN_POINTS, 2000) },
        { name: 'ZONA DE ATENÇÃO', emoji: '⚠️', minPoints: parseNumber(process.env.RANKING_ATTENTION_ZONE_MIN_POINTS, 0) }
    ],

    // --- SEÇÃO ADICIONADA: Performance e Confiabilidade ---
    performance: {
        // Retry
        retry: {
            enabled: parseBoolean(process.env.RETRY_ENABLED, true),
            maxAttempts: parseNumber(process.env.RETRY_MAX_ATTEMPTS, 3),
            initialDelayMs: parseNumber(process.env.RETRY_INITIAL_DELAY_MS, 1000),
            maxDelayMs: parseNumber(process.env.RETRY_MAX_DELAY_MS, 10000)
        },
        
        // Cache
        cache: {
            enabled: parseBoolean(process.env.CACHE_ENABLED, true)
        },
        
        // Message Throttling
        messageThrottling: {
            enabled: parseBoolean(process.env.MESSAGE_THROTTLING_ENABLED, true),
            rateLimit: parseNumber(process.env.MESSAGE_RATE_LIMIT_PER_MINUTE, 20)
        },
        
        // Circuit Breaker
        circuitBreaker: {
            enabled: parseBoolean(process.env.CIRCUIT_BREAKER_ENABLED, true),
            failureThreshold: parseNumber(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD, 5),
            timeoutMs: parseNumber(process.env.CIRCUIT_BREAKER_TIMEOUT_MS, 60000)
        },
        
        // Health Check
        healthCheck: {
            enabled: parseBoolean(process.env.HEALTH_CHECK_ENABLED, true),
            intervalMs: parseNumber(process.env.HEALTH_CHECK_INTERVAL_MS, 300000)
        }
    }
};

logger.info('✅ Configurações carregadas com sucesso');
