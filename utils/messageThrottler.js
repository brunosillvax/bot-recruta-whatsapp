// FILE: utils/messageThrottler.js
// Throttling e Rate Limiting para mensagens do WhatsApp

const logger = require('./logger');
const config = require('../config');

// Prioridades de mensagens
const PRIORITY = {
    HIGH: 3,      // Respostas a comandos do usuário
    MEDIUM: 2,    // Notificações importantes
    LOW: 1        // Mensagens informativas, lembretes
};

/**
 * Classe para gerenciar fila de mensagens com throttling
 */
class MessageThrottler {
    constructor(options = {}) {
        this.rateLimit = options.rateLimit || config.performance.messageThrottling.rateLimit || 20; // mensagens por minuto
        this.intervalMs = 60000 / this.rateLimit; // Intervalo entre mensagens em ms
        
        this.queue = [];
        this.sentCount = 0;
        this.lastSentTime = 0;
        this.isProcessing = false;
        
        // Estatísticas
        this.stats = {
            totalQueued: 0,
            totalSent: 0,
            totalFailed: 0,
            currentQueueSize: 0,
            averageWaitTime: 0
        };
        
        // Inicia o processamento da fila
        this.startProcessing();
    }
    
    /**
     * Adiciona uma mensagem à fila
     * @param {Function} sendFunction - Função assíncrona para enviar a mensagem
     * @param {number} priority - Prioridade da mensagem
     * @param {string} description - Descrição para logging
     * @returns {Promise<any>}
     */
    async enqueue(sendFunction, priority = PRIORITY.MEDIUM, description = 'Mensagem') {
        if (!config.performance.messageThrottling.enabled) {
            // Se throttling está desabilitado, envia direto
            return await sendFunction();
        }
        
        return new Promise((resolve, reject) => {
            const message = {
                sendFunction,
                priority,
                description,
                queuedAt: Date.now(),
                resolve,
                reject
            };
            
            this.queue.push(message);
            this.stats.totalQueued++;
            this.stats.currentQueueSize = this.queue.length;
            
            // Ordena a fila por prioridade (maior prioridade primeiro)
            this.queue.sort((a, b) => b.priority - a.priority);
            
            logger.debug(`Message Throttler: Mensagem enfileirada (${description}). Fila: ${this.queue.length}, Prioridade: ${priority}`);
        });
    }
    
    /**
     * Inicia o processamento da fila
     */
    startProcessing() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.processQueue();
    }
    
    /**
     * Processa a fila de mensagens
     */
    async processQueue() {
        while (this.isProcessing) {
            // Se a fila está vazia, aguarda um pouco antes de verificar novamente
            if (this.queue.length === 0) {
                await this.sleep(1000);
                continue;
            }
            
            // Calcula quanto tempo precisa esperar antes de enviar a próxima mensagem
            const now = Date.now();
            const timeSinceLastSent = now - this.lastSentTime;
            const waitTime = Math.max(0, this.intervalMs - timeSinceLastSent);
            
            if (waitTime > 0) {
                logger.debug(`Message Throttler: Aguardando ${waitTime}ms antes de enviar próxima mensagem`);
                await this.sleep(waitTime);
            }
            
            // Pega a próxima mensagem da fila (maior prioridade)
            const message = this.queue.shift();
            this.stats.currentQueueSize = this.queue.length;
            
            if (!message) continue;
            
            // Calcula tempo de espera
            const waitedTime = Date.now() - message.queuedAt;
            this.updateAverageWaitTime(waitedTime);
            
            try {
                logger.debug(`Message Throttler: Enviando mensagem (${message.description}). Aguardou: ${waitedTime}ms`);
                
                // Envia a mensagem
                const result = await message.sendFunction();
                
                this.lastSentTime = Date.now();
                this.sentCount++;
                this.stats.totalSent++;
                
                // Resolve a promise
                message.resolve(result);
                
            } catch (error) {
                logger.error(`Message Throttler: Erro ao enviar mensagem (${message.description}):`, error);
                this.stats.totalFailed++;
                
                // Rejeita a promise
                message.reject(error);
            }
        }
    }
    
    /**
     * Para o processamento da fila
     */
    stopProcessing() {
        this.isProcessing = false;
        logger.info('Message Throttler: Processamento parado');
    }
    
    /**
     * Aguarda um determinado tempo
     * @param {number} ms - Milissegundos
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Atualiza média de tempo de espera
     * @param {number} waitTime - Tempo de espera em ms
     */
    updateAverageWaitTime(waitTime) {
        const totalSent = this.stats.totalSent || 1;
        this.stats.averageWaitTime = ((this.stats.averageWaitTime * (totalSent - 1)) + waitTime) / totalSent;
    }
    
    /**
     * Retorna estatísticas
     * @returns {object}
     */
    getStats() {
        return {
            ...this.stats,
            rateLimit: `${this.rateLimit} mensagens/min`,
            intervalMs: this.intervalMs,
            averageWaitTimeMs: Math.round(this.stats.averageWaitTime),
            successRate: this.stats.totalQueued > 0 
                ? `${((this.stats.totalSent / this.stats.totalQueued) * 100).toFixed(2)}%` 
                : '0%'
        };
    }
    
    /**
     * Limpa a fila (cancela mensagens pendentes)
     */
    clear() {
        const clearedCount = this.queue.length;
        
        // Rejeita todas as mensagens pendentes
        this.queue.forEach(message => {
            message.reject(new Error('Fila limpa - mensagem cancelada'));
        });
        
        this.queue = [];
        this.stats.currentQueueSize = 0;
        
        logger.info(`Message Throttler: Fila limpa (${clearedCount} mensagens canceladas)`);
    }
    
    /**
     * Destrói o throttler
     */
    destroy() {
        this.stopProcessing();
        this.clear();
        logger.debug('Message Throttler destruído');
    }
}

// Instância global do throttler
const globalThrottler = new MessageThrottler();

/**
 * Envia uma mensagem através do throttler
 * @param {Function} sendFunction - Função de envio
 * @param {number} priority - Prioridade
 * @param {string} description - Descrição
 * @returns {Promise<any>}
 */
async function sendWithThrottling(sendFunction, priority = PRIORITY.MEDIUM, description = 'Mensagem') {
    return await globalThrottler.enqueue(sendFunction, priority, description);
}

module.exports = {
    MessageThrottler,
    throttler: globalThrottler,
    sendWithThrottling,
    PRIORITY
};

