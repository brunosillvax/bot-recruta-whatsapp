// FILE: utils/retryHelper.js
// Sistema de retry com backoff exponencial para operações críticas

const logger = require('./logger');

/**
 * Configuração padrão para retry
 */
const DEFAULT_CONFIG = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: ['UNAVAILABLE', 'DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED', 'INTERNAL', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
};

/**
 * Verifica se um erro é retryable (pode ser retentado)
 * @param {Error} error - O erro a ser verificado
 * @param {Array<string>} retryableErrors - Lista de códigos de erro que permitem retry
 * @returns {boolean}
 */
function isRetryableError(error, retryableErrors) {
    if (!error) return false;
    
    // Verifica código de erro do Firebase/gRPC
    if (error.code && retryableErrors.includes(error.code)) {
        return true;
    }
    
    // Verifica códigos de erro de rede
    if (error.errno && retryableErrors.includes(error.errno)) {
        return true;
    }
    
    // Verifica mensagens de erro comuns
    const errorMessage = error.message?.toLowerCase() || '';
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('network') || 
        errorMessage.includes('unavailable') ||
        errorMessage.includes('econnreset')) {
        return true;
    }
    
    return false;
}

/**
 * Calcula o delay para a próxima tentativa com backoff exponencial
 * @param {number} attempt - Número da tentativa atual (começando em 0)
 * @param {object} config - Configuração do retry
 * @returns {number} - Delay em milissegundos
 */
function calculateDelay(attempt, config) {
    const { initialDelayMs, maxDelayMs, backoffMultiplier, jitter } = config;
    
    // Calcula delay exponencial
    let delay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
    
    // Limita ao delay máximo
    delay = Math.min(delay, maxDelayMs);
    
    // Adiciona jitter (aleatoriedade) para evitar thundering herd
    if (jitter) {
        const jitterAmount = delay * 0.1; // 10% de jitter
        delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
    }
    
    return Math.floor(delay);
}

/**
 * Aguarda um determinado tempo
 * @param {number} ms - Milissegundos para aguardar
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executa uma operação com retry automático
 * @param {Function} operation - Função assíncrona a ser executada
 * @param {object} options - Opções de configuração do retry
 * @param {string} operationName - Nome da operação para logging
 * @returns {Promise<any>} - Resultado da operação
 * @throws {Error} - Lança erro se todas as tentativas falharem
 */
async function withRetry(operation, options = {}, operationName = 'Operação') {
    const config = { ...DEFAULT_CONFIG, ...options };
    let lastError;
    
    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        try {
            // Primeira tentativa ou retry
            if (attempt > 0) {
                const delay = calculateDelay(attempt - 1, config);
                logger.debug(`${operationName}: Tentativa ${attempt + 1}/${config.maxAttempts} após ${delay}ms`);
                await sleep(delay);
            } else {
                logger.debug(`${operationName}: Tentativa ${attempt + 1}/${config.maxAttempts}`);
            }
            
            // Executa a operação
            const result = await operation();
            
            // Sucesso
            if (attempt > 0) {
                logger.info(`${operationName}: Sucesso na tentativa ${attempt + 1}/${config.maxAttempts}`);
            }
            
            return result;
            
        } catch (error) {
            lastError = error;
            
            // Verifica se o erro é retryable
            if (!isRetryableError(error, config.retryableErrors)) {
                logger.warn(`${operationName}: Erro não-retryable detectado. Abortando retries.`, {
                    error: error.message,
                    code: error.code || error.errno
                });
                throw error;
            }
            
            // Última tentativa
            if (attempt === config.maxAttempts - 1) {
                logger.error(`${operationName}: Todas as ${config.maxAttempts} tentativas falharam.`, {
                    error: error.message,
                    code: error.code || error.errno
                });
                throw error;
            }
            
            // Log da falha
            logger.warn(`${operationName}: Tentativa ${attempt + 1}/${config.maxAttempts} falhou.`, {
                error: error.message,
                code: error.code || error.errno,
                willRetry: true
            });
        }
    }
    
    // Fallback (não deve chegar aqui, mas por segurança)
    throw lastError;
}

/**
 * Wrapper específico para operações do Firebase
 * @param {Function} operation - Função assíncrona do Firebase
 * @param {string} operationName - Nome da operação para logging
 * @returns {Promise<any>}
 */
async function withFirebaseRetry(operation, operationName = 'Operação Firebase') {
    return withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        retryableErrors: [
            'UNAVAILABLE',
            'DEADLINE_EXCEEDED',
            'RESOURCE_EXHAUSTED',
            'INTERNAL',
            'ABORTED',
            'CANCELLED'
        ]
    }, operationName);
}

/**
 * Wrapper específico para envio de mensagens do WhatsApp
 * @param {Function} operation - Função assíncrona de envio de mensagem
 * @param {string} operationName - Nome da operação para logging
 * @returns {Promise<any>}
 */
async function withWhatsAppRetry(operation, operationName = 'Envio de Mensagem WhatsApp') {
    return withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        retryableErrors: [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED',
            '500',
            '503',
            '504'
        ]
    }, operationName);
}

module.exports = {
    withRetry,
    withFirebaseRetry,
    withWhatsAppRetry,
    isRetryableError,
    calculateDelay
};

