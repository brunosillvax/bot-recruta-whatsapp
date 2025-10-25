// FILE: utils/healthCheck.js
// Sistema de Health Check e Monitoramento

const logger = require('./logger');
const config = require('../config');
const { db } = require('../config');
const axios = require('axios');
const FormData = require('form-data');

/**
 * Classe para gerenciar health checks
 */
class HealthCheckManager {
    constructor(options = {}) {
        this.intervalMs = options.intervalMs || config.performance.healthCheck.intervalMs || 300000; // 5 minutos
        this.isRunning = false;
        this.checkInterval = null;
        
        // Estado de saúde dos serviços
        this.health = {
            firebase: {
                status: 'unknown',
                lastCheck: null,
                lastSuccess: null,
                consecutiveFailures: 0,
                responseTime: null
            },
            whatsapp: {
                status: 'unknown',
                lastCheck: null,
                lastSuccess: null,
                consecutiveFailures: 0
            },
            overall: {
                status: 'unknown',
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage()
            }
        };
        
        // Histórico de checks (últimos 10)
        this.history = [];
    }
    
    /**
     * Inicia o health check periódico
     */
    start() {
        if (this.isRunning) {
            logger.warn('Health Check: Já está em execução');
            return;
        }
        
        if (!config.performance.healthCheck.enabled) {
            logger.info('Health Check: Desabilitado por configuração');
            return;
        }
        
        logger.debug(`Health Check: Iniciando monitoramento (intervalo: ${this.intervalMs}ms)`);
        this.isRunning = true;
        
        // Executa o primeiro check imediatamente
        this.performChecks();
        
        // Agenda checks periódicos
        this.checkInterval = setInterval(() => {
            this.performChecks();
        }, this.intervalMs);
    }
    
    /**
     * Para o health check
     */
    stop() {
        if (!this.isRunning) return;
        
        logger.debug('Health Check: Parando monitoramento');
        this.isRunning = false;
        
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    
    /**
     * Executa todos os health checks
     */
    async performChecks() {
        logger.debug('Health Check: Iniciando verificações...');
        
        const results = {
            timestamp: new Date().toISOString(),
            checks: {}
        };
        
        // Check do Firebase
        results.checks.firebase = await this.checkFirebase();
        
        // Check do WhatsApp (se sockInstance estiver disponível)
        results.checks.whatsapp = await this.checkWhatsApp();
        
        // Atualiza status geral
        this.updateOverallHealth();
        
        // Adiciona ao histórico
        this.addToHistory(results);
        
        // Verifica se precisa notificar sobre problemas
        await this.checkForAlerts();
        
        logger.debug('Health Check: Verificações concluídas', {
            firebase: results.checks.firebase.status,
            whatsapp: results.checks.whatsapp.status
        });
    }
    
    /**
     * Verifica saúde do Firebase
     * @returns {object}
     */
    async checkFirebase() {
        const startTime = Date.now();
        
        try {
            // Tenta fazer uma leitura simples do Firestore
            const testQuery = db.collection('players').limit(1);
            await testQuery.get();
            
            const responseTime = Date.now() - startTime;
            
            this.health.firebase = {
                status: 'healthy',
                lastCheck: new Date().toISOString(),
                lastSuccess: new Date().toISOString(),
                consecutiveFailures: 0,
                responseTime
            };
            
            return { status: 'healthy', responseTime };
            
        } catch (error) {
            this.health.firebase.consecutiveFailures++;
            this.health.firebase.lastCheck = new Date().toISOString();
            this.health.firebase.status = 'unhealthy';
            
            logger.error('Health Check: Firebase está unhealthy', {
                error: error.message,
                consecutiveFailures: this.health.firebase.consecutiveFailures
            });
            
            return {
                status: 'unhealthy',
                error: error.message,
                consecutiveFailures: this.health.firebase.consecutiveFailures
            };
        }
    }
    
    /**
     * Verifica saúde do WhatsApp
     * @returns {object}
     */
    async checkWhatsApp() {
        try {
            // TODO: Implementar verificação real quando sockInstance estiver disponível
            // Por enquanto, apenas marca como healthy se o processo está rodando
            
            this.health.whatsapp = {
                status: 'healthy',
                lastCheck: new Date().toISOString(),
                lastSuccess: new Date().toISOString(),
                consecutiveFailures: 0
            };
            
            return { status: 'healthy' };
            
        } catch (error) {
            this.health.whatsapp.consecutiveFailures++;
            this.health.whatsapp.lastCheck = new Date().toISOString();
            this.health.whatsapp.status = 'unhealthy';
            
            logger.error('Health Check: WhatsApp está unhealthy', {
                error: error.message,
                consecutiveFailures: this.health.whatsapp.consecutiveFailures
            });
            
            return {
                status: 'unhealthy',
                error: error.message,
                consecutiveFailures: this.health.whatsapp.consecutiveFailures
            };
        }
    }
    
    /**
     * Atualiza status geral de saúde
     */
    updateOverallHealth() {
        const firebaseHealthy = this.health.firebase.status === 'healthy';
        const whatsappHealthy = this.health.whatsapp.status === 'healthy';
        
        if (firebaseHealthy && whatsappHealthy) {
            this.health.overall.status = 'healthy';
        } else if (!firebaseHealthy && !whatsappHealthy) {
            this.health.overall.status = 'critical';
        } else {
            this.health.overall.status = 'degraded';
        }
        
        this.health.overall.uptime = process.uptime();
        this.health.overall.memoryUsage = process.memoryUsage();
    }
    
    /**
     * Adiciona resultado ao histórico
     * @param {object} results
     */
    addToHistory(results) {
        this.history.push(results);
        
        // Mantém apenas os últimos 10
        if (this.history.length > 10) {
            this.history.shift();
        }
    }
    
    /**
     * Verifica se precisa enviar alertas
     */
    async checkForAlerts() {
        // Alerta se Firebase está unhealthy por 3 checks consecutivos
        if (this.health.firebase.consecutiveFailures >= 3) {
            await this.sendAlert(
                `🚨 ALERTA CRÍTICO: Firebase está inacessível há ${this.health.firebase.consecutiveFailures} verificações consecutivas!`
            );
        }
        
        // Alerta se WhatsApp está unhealthy por 3 checks consecutivos
        if (this.health.whatsapp.consecutiveFailures >= 3) {
            await this.sendAlert(
                `🚨 ALERTA CRÍTICO: WhatsApp está inacessível há ${this.health.whatsapp.consecutiveFailures} verificações consecutivas!`
            );
        }
        
        // Limpeza automática se uso de memória está alto (sem alertas para Discord)
        const memUsage = this.health.overall.memoryUsage;
        const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        if (heapUsedPercent > 85) {
            logger.debug(`Memória heap alta detectada: ${heapUsedPercent.toFixed(2)}% - Executando limpeza automática`);
            
            // Importa e executa limpeza automática
            const { cache } = require('./cacheManager');
            
            // Limpa cache menos crítico
            const beforeSize = cache.getStats().size;
            cache.deletePattern(/^(ranking|status|hall_of_fame):/);
            
            // Força garbage collection se disponível
            if (global.gc) {
                global.gc();
            }
            
            // Log apenas - sem alertas para Discord
            const newMemUsage = process.memoryUsage();
            const newHeapPercent = (newMemUsage.heapUsed / newMemUsage.heapTotal) * 100;
            const freed = memUsage.heapUsed - newMemUsage.heapUsed;
            const afterSize = cache.getStats().size;
            
            logger.debug(`Limpeza de memória executada: ${heapUsedPercent.toFixed(2)}% → ${newHeapPercent.toFixed(2)}% (${Math.round(freed / 1024 / 1024)}MB liberados, ${beforeSize - afterSize} entradas removidas)`);
        }
    }
    
    /**
     * Envia alerta para o Discord
     * @param {string} message
     */
    async sendAlert(message) {
        try {
            logger.debug(`Health Check: Enviando alerta - ${message}`);
            
            const form = new FormData();
            form.append('content', `🤖 **Bot Health Check Alert**\n\n${message}\n\nTimestamp: ${new Date().toISOString()}`);
            
            await axios.post(config.discordWebhookUrl, form, { 
                headers: form.getHeaders(),
                timeout: 5000 
            });
            
        } catch (error) {
            logger.error('Health Check: Erro ao enviar alerta:', error.message);
        }
    }
    
    /**
     * Retorna o status atual de saúde
     * @returns {object}
     */
    getHealth() {
        return {
            ...this.health,
            overall: {
                ...this.health.overall,
                uptimeFormatted: this.formatUptime(this.health.overall.uptime),
                memoryUsageMB: {
                    heapUsed: Math.round(this.health.overall.memoryUsage.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(this.health.overall.memoryUsage.heapTotal / 1024 / 1024),
                    external: Math.round(this.health.overall.memoryUsage.external / 1024 / 1024),
                    rss: Math.round(this.health.overall.memoryUsage.rss / 1024 / 1024)
                }
            }
        };
    }
    
    /**
     * Retorna o histórico de checks
     * @returns {array}
     */
    getHistory() {
        return this.history;
    }
    
    /**
     * Formata uptime em formato legível
     * @param {number} seconds
     * @returns {string}
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    }
    
    /**
     * Destrói o health check manager
     */
    destroy() {
        this.stop();
        logger.debug('Health Check Manager destruído');
    }
}

// Instância global do health check manager
const globalHealthCheck = new HealthCheckManager();

module.exports = {
    HealthCheckManager,
    healthCheck: globalHealthCheck
};

