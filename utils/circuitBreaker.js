// FILE: utils/circuitBreaker.js
// Circuit Breaker para proteger contra falhas em cascata

const logger = require('./logger');
const config = require('../config');

// Estados do Circuit Breaker
const STATES = {
    CLOSED: 'CLOSED',     // Normal, operações passam
    OPEN: 'OPEN',         // Bloqueado, operações falham imediatamente
    HALF_OPEN: 'HALF_OPEN' // Testando, permite algumas operações
};

/**
 * Classe Circuit Breaker
 */
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || config.performance.circuitBreaker.failureThreshold || 5;
        this.timeoutMs = options.timeoutMs || config.performance.circuitBreaker.timeoutMs || 60000;
        this.monitoringPeriodMs = options.monitoringPeriodMs || 10000; // 10 segundos
        
        this.state = STATES.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        
        // Estatísticas
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            rejectedRequests: 0,
            stateChanges: []
        };
        
        // Monitoramento periódico
        this.monitoringInterval = setInterval(() => this.monitor(), this.monitoringPeriodMs);
    }
    
    /**
     * Executa uma operação através do circuit breaker
     * @param {Function} operation - Operação assíncrona a executar
     * @param {string} operationName - Nome da operação para logging
     * @returns {Promise<any>}
     */
    async execute(operation, operationName = 'Operação') {
        this.stats.totalRequests++;
        
        // Verifica o estado atual
        if (this.state === STATES.OPEN) {
            // Verifica se é hora de tentar novamente (HALF_OPEN)
            if (Date.now() >= this.nextAttemptTime) {
                logger.info(`Circuit Breaker: Transitando para HALF_OPEN (tentando recuperação)`);
                this.changeState(STATES.HALF_OPEN);
            } else {
                // Ainda bloqueado
                this.stats.rejectedRequests++;
                const error = new Error(`Circuit Breaker está OPEN. Próxima tentativa em ${Math.ceil((this.nextAttemptTime - Date.now()) / 1000)}s`);
                error.code = 'CIRCUIT_BREAKER_OPEN';
                logger.warn(`Circuit Breaker: Operação rejeitada (${operationName})`);
                throw error;
            }
        }
        
        try {
            // Executa a operação
            const result = await operation();
            
            // Sucesso
            this.onSuccess(operationName);
            return result;
            
        } catch (error) {
            // Falha
            this.onFailure(error, operationName);
            throw error;
        }
    }
    
    /**
     * Handler de sucesso
     * @param {string} operationName
     */
    onSuccess(operationName) {
        this.stats.successfulRequests++;
        this.failureCount = 0;
        
        if (this.state === STATES.HALF_OPEN) {
            // Recuperado com sucesso
            logger.info(`Circuit Breaker: Operação bem-sucedida em HALF_OPEN. Transitando para CLOSED.`);
            this.changeState(STATES.CLOSED);
            this.successCount = 0;
        }
    }
    
    /**
     * Handler de falha
     * @param {Error} error
     * @param {string} operationName
     */
    onFailure(error, operationName) {
        this.stats.failedRequests++;
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        logger.warn(`Circuit Breaker: Falha detectada (${operationName}). Contagem: ${this.failureCount}/${this.failureThreshold}`);
        
        if (this.state === STATES.HALF_OPEN) {
            // Falhou durante teste, volta para OPEN
            logger.warn(`Circuit Breaker: Falha em HALF_OPEN. Voltando para OPEN.`);
            this.changeState(STATES.OPEN);
            this.nextAttemptTime = Date.now() + this.timeoutMs;
            
        } else if (this.failureCount >= this.failureThreshold) {
            // Atingiu threshold, abre o circuit breaker
            logger.error(`Circuit Breaker: Threshold atingido (${this.failureCount}/${this.failureThreshold}). Abrindo circuit breaker!`);
            this.changeState(STATES.OPEN);
            this.nextAttemptTime = Date.now() + this.timeoutMs;
        }
    }
    
    /**
     * Muda o estado do circuit breaker
     * @param {string} newState
     */
    changeState(newState) {
        const oldState = this.state;
        this.state = newState;
        
        this.stats.stateChanges.push({
            from: oldState,
            to: newState,
            timestamp: new Date().toISOString(),
            failureCount: this.failureCount
        });
        
        // Mantém apenas as últimas 10 mudanças de estado
        if (this.stats.stateChanges.length > 10) {
            this.stats.stateChanges.shift();
        }
        
        logger.info(`Circuit Breaker: Estado mudou de ${oldState} para ${newState}`);
    }
    
    /**
     * Monitoramento periódico
     */
    monitor() {
        // Se está CLOSED e não houve falhas recentes, reseta contadores
        if (this.state === STATES.CLOSED && this.lastFailureTime) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure > this.monitoringPeriodMs * 2) {
                if (this.failureCount > 0) {
                    logger.debug(`Circuit Breaker: Resetando contador de falhas (${this.failureCount} -> 0)`);
                    this.failureCount = 0;
                }
            }
        }
    }
    
    /**
     * Retorna o estado atual
     * @returns {string}
     */
    getState() {
        return this.state;
    }
    
    /**
     * Verifica se o circuit breaker está disponível
     * @returns {boolean}
     */
    isAvailable() {
        return this.state === STATES.CLOSED || 
               (this.state === STATES.HALF_OPEN);
    }
    
    /**
     * Retorna estatísticas
     * @returns {object}
     */
    getStats() {
        const successRate = this.stats.totalRequests > 0 
            ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(2) 
            : 0;
            
        return {
            state: this.state,
            failureCount: this.failureCount,
            ...this.stats,
            successRate: `${successRate}%`,
            nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null
        };
    }
    
    /**
     * Reseta o circuit breaker manualmente
     */
    reset() {
        logger.info('Circuit Breaker: Reset manual executado');
        this.changeState(STATES.CLOSED);
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
    }
    
    /**
     * Destrói o circuit breaker
     */
    destroy() {
        clearInterval(this.monitoringInterval);
        logger.debug('Circuit Breaker destruído');
    }
}

// Instância global do circuit breaker para o Firebase
const firebaseCircuitBreaker = new CircuitBreaker({
    failureThreshold: config.performance.circuitBreaker.failureThreshold,
    timeoutMs: config.performance.circuitBreaker.timeoutMs
});

/**
 * Wrapper para executar operações do Firebase com circuit breaker
 * @param {Function} operation - Operação assíncrona
 * @param {string} operationName - Nome da operação
 * @returns {Promise<any>}
 */
async function withCircuitBreaker(operation, operationName = 'Operação Firebase') {
    if (!config.performance.circuitBreaker.enabled) {
        // Se circuit breaker está desabilitado, executa direto
        return await operation();
    }
    
    return await firebaseCircuitBreaker.execute(operation, operationName);
}

module.exports = {
    CircuitBreaker,
    firebaseCircuitBreaker,
    withCircuitBreaker,
    STATES
};

