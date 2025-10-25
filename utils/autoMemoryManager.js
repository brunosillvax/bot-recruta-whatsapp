// FILE: utils/autoMemoryManager.js
// Gerenciador automático de memória

const logger = require('./logger');
const { cache } = require('./cacheManager');

class AutoMemoryManager {
    constructor() {
        this.isRunning = false;
        this.cleanupInterval = null;
        this.lastCleanup = 0;
        this.cleanupCount = 0;
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        logger.debug('🧹 Auto Memory Manager iniciado');
        
        // Limpeza preventiva a cada 30 segundos
        this.cleanupInterval = setInterval(() => {
            this.performPreventiveCleanup();
        }, 30 * 1000);
        
        // Limpeza inicial
        this.performPreventiveCleanup();
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        logger.debug('🧹 Auto Memory Manager parado');
    }
    
    performPreventiveCleanup() {
        const memUsage = process.memoryUsage();
        const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        // Limpeza preventiva se memória > 70%
        if (heapUsedPercent > 70) {
            logger.debug(`Limpeza preventiva executada: ${heapUsedPercent.toFixed(2)}%`);
            
            // Limpa cache menos crítico preventivamente
            const beforeSize = cache.getStats().size;
            cache.deletePattern(/^(ranking|status|hall_of_fame):/);
            
            // Limpeza de entradas expiradas
            cache.cleanup();
            
            // Garbage collection se disponível
            if (global.gc) {
                global.gc();
            }
            
            const afterSize = cache.getStats().size;
            this.cleanupCount++;
            
            logger.debug(`Limpeza preventiva concluída: ${beforeSize} → ${afterSize} entradas (${this.cleanupCount} limpezas executadas)`);
        }
        
        this.lastCleanup = Date.now();
    }
    
    forceCleanup() {
        logger.debug('🧹 Executando limpeza forçada de memória');
        
        const before = process.memoryUsage();
        const beforeSize = cache.getStats().size;
        
        // Limpa tudo exceto dados críticos
        cache.deletePattern(/^(ranking|status|hall_of_fame|players:list):/);
        cache.cleanup();
        
        // Garbage collection
        if (global.gc) {
            global.gc();
        }
        
        const after = process.memoryUsage();
        const afterSize = cache.getStats().size;
        
        const freed = before.heapUsed - after.heapUsed;
        const heapReduction = ((before.heapUsed - after.heapUsed) / before.heapUsed * 100);
        
        logger.debug(`Limpeza forçada concluída: ${Math.round(freed / 1024 / 1024)}MB liberados (${heapReduction.toFixed(1)}%), ${beforeSize - afterSize} entradas removidas`);
        
        return {
            freedMB: Math.round(freed / 1024 / 1024),
            heapReduction: heapReduction,
            entriesRemoved: beforeSize - afterSize
        };
    }
    
    getStats() {
        const memUsage = process.memoryUsage();
        const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        return {
            isRunning: this.isRunning,
            cleanupCount: this.cleanupCount,
            lastCleanup: this.lastCleanup,
            currentHeapPercent: heapUsedPercent,
            memoryUsage: memUsage
        };
    }
}

// Instância global
const autoMemoryManager = new AutoMemoryManager();

module.exports = {
    AutoMemoryManager,
    autoMemoryManager
};
