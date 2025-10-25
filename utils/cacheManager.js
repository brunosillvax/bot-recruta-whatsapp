// FILE: utils/cacheManager.js
// Gerenciador de cache avançado com TTL e invalidação inteligente

const logger = require('./logger');

/**
 * Classe para gerenciar cache em memória com TTL
 */
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
        
        // Cleanup periódico de entradas expiradas (a cada 1 minuto para usar menos memória)
        this.cleanupInterval = setInterval(() => this.cleanup(), 1 * 60 * 1000);
        
        // Cleanup mais agressivo se memória estiver alta (a cada 15 segundos)
        this.memoryCleanupInterval = setInterval(() => {
            const memUsage = process.memoryUsage();
            const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            
            if (heapUsedPercent > 75) {
                logger.debug(`Memória alta (${heapUsedPercent.toFixed(2)}%), executando cleanup agressivo`);
                this.cleanup();
                
                // Limpeza progressiva conforme memória aumenta
                if (heapUsedPercent > 80) {
                    this.deletePattern(/^(ranking|status):/);
                    logger.debug('Cache de ranking/status limpo devido a memória alta');
                }
                
                if (heapUsedPercent > 85) {
                    this.deletePattern(/^(hall_of_fame|players:list):/);
                    logger.debug('Cache de hall_of_fame e lista de jogadores limpo devido a memória alta');
                }
                
                if (heapUsedPercent > 90) {
                    // Limpeza extrema - remove quase tudo exceto dados críticos
                    this.deletePattern(/^(group|player):/);
                    logger.debug('Limpeza extrema executada - cache de grupo e jogadores limpo');
                }
            }
        }, 15 * 1000);
    }
    
    /**
     * Obtém uma entrada do cache
     * @param {string} key - Chave do cache
     * @returns {any|null} - Valor do cache ou null se não existir/expirado
     */
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            logger.debug(`Cache MISS: ${key}`);
            return null;
        }
        
        // Verifica se expirou
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            this.stats.evictions++;
            logger.debug(`Cache EXPIRED: ${key}`);
            return null;
        }
        
        this.stats.hits++;
        logger.debug(`Cache HIT: ${key}`);
        return entry.value;
    }
    
    /**
     * Define uma entrada no cache
     * @param {string} key - Chave do cache
     * @param {any} value - Valor a ser armazenado
     * @param {number} ttlMs - Time to live em milissegundos (opcional)
     */
    set(key, value, ttlMs = null) {
        const entry = {
            value,
            createdAt: Date.now(),
            expiresAt: ttlMs ? Date.now() + ttlMs : null
        };
        
        this.cache.set(key, entry);
        this.stats.sets++;
        logger.debug(`Cache SET: ${key} (TTL: ${ttlMs ? `${ttlMs}ms` : 'infinity'})`);
    }
    
    /**
     * Remove uma entrada do cache
     * @param {string} key - Chave do cache
     * @returns {boolean} - true se a entrada foi removida
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.deletes++;
            logger.debug(`Cache DELETE: ${key}`);
        }
        return deleted;
    }
    
    /**
     * Remove múltiplas entradas do cache por padrão
     * @param {RegExp|string} pattern - Padrão para match das chaves
     * @returns {number} - Número de entradas removidas
     */
    deletePattern(pattern) {
        let deletedCount = 0;
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deletedCount++;
            }
        }
        
        this.stats.deletes += deletedCount;
        logger.debug(`Cache DELETE PATTERN: ${pattern} (${deletedCount} entradas removidas)`);
        return deletedCount;
    }
    
    /**
     * Verifica se uma chave existe no cache (e não está expirada)
     * @param {string} key - Chave do cache
     * @returns {boolean}
     */
    has(key) {
        const value = this.get(key);
        return value !== null;
    }
    
    /**
     * Limpa todas as entradas do cache
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        logger.info(`Cache limpo completamente (${size} entradas removidas)`);
    }
    
    /**
     * Remove entradas expiradas do cache
     * @returns {number} - Número de entradas removidas
     */
    cleanup() {
        let cleaned = 0;
        const now = Date.now();
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this.stats.evictions += cleaned;
            logger.debug(`Cache cleanup: ${cleaned} entradas expiradas removidas`);
        }
        
        return cleaned;
    }
    
    /**
     * Obtém estatísticas do cache
     * @returns {object}
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;
        
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: `${hitRate}%`,
            totalRequests: total
        };
    }
    
    /**
     * Reseta as estatísticas do cache
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
        logger.debug('Estatísticas do cache resetadas');
    }
    
    /**
     * Obtém ou define um valor no cache (pattern get-or-set)
     * @param {string} key - Chave do cache
     * @param {Function} fetchFn - Função para buscar o valor se não estiver no cache
     * @param {number} ttlMs - TTL em milissegundos
     * @returns {Promise<any>}
     */
    async getOrSet(key, fetchFn, ttlMs = null) {
        // Tenta obter do cache primeiro
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }
        
        // Se não está no cache, busca com a função fornecida
        logger.debug(`Cache getOrSet: buscando valor para ${key}`);
        const value = await fetchFn();
        
        // Armazena no cache
        this.set(key, value, ttlMs);
        
        return value;
    }
    
    /**
     * Destrói o cache manager (limpa interval)
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        clearInterval(this.memoryCleanupInterval);
        this.clear();
        logger.debug('Cache manager destruído');
    }
}

// Instância global do cache manager
const globalCache = new CacheManager();

// TTLs padrão para diferentes tipos de dados (em milissegundos)
// Muito reduzidos para usar o mínimo de memória possível
const TTL = {
    GROUP_METADATA: 10 * 1000,      // 10 segundos (muito reduzido)
    PLAYER_LIST: 20 * 1000,          // 20 segundos (muito reduzido)
    PLAYER_DATA: 10 * 1000,          // 10 segundos (muito reduzido)
    RANKING: 30 * 1000,              // 30 segundos (muito reduzido)
    STATUS: 20 * 1000,               // 20 segundos (muito reduzido)
    HALL_OF_FAME: 60 * 1000,         // 1 minuto (muito reduzido)
    SHORT: 10 * 1000,                // 10 segundos (muito reduzido)
    MEDIUM: 30 * 1000,               // 30 segundos (muito reduzido)
    LONG: 2 * 60 * 1000              // 2 minutos (muito reduzido)
};

/**
 * Helpers específicos para tipos de dados comuns
 */
const CacheHelpers = {
    /**
     * Cache de metadados de grupo
     */
    groupMetadata: {
        get: (groupId) => globalCache.get(`group:${groupId}`),
        set: (groupId, metadata) => globalCache.set(`group:${groupId}`, metadata, TTL.GROUP_METADATA),
        delete: (groupId) => globalCache.delete(`group:${groupId}`)
    },
    
    /**
     * Cache de lista de jogadores
     */
    playerList: {
        get: () => globalCache.get('players:list'),
        set: (players) => globalCache.set('players:list', players, TTL.PLAYER_LIST),
        invalidate: () => {
            globalCache.delete('players:list');
            // Também invalida rankings e status que dependem da lista
            globalCache.deletePattern(/^(ranking|status):/);
        }
    },
    
    /**
     * Cache de dados de jogador individual
     */
    player: {
        get: (playerId) => globalCache.get(`player:${playerId}`),
        set: (playerId, playerData) => globalCache.set(`player:${playerId}`, playerData, TTL.PLAYER_DATA),
        delete: (playerId) => {
            globalCache.delete(`player:${playerId}`);
            // Invalida lista e rankings quando um jogador é atualizado
            CacheHelpers.playerList.invalidate();
        }
    },
    
    /**
     * Cache de ranking
     */
    ranking: {
        get: () => globalCache.get('ranking:current'),
        set: (rankingData) => globalCache.set('ranking:current', rankingData, TTL.RANKING),
        invalidate: () => globalCache.delete('ranking:current')
    },
    
    /**
     * Cache de status
     */
    status: {
        get: () => globalCache.get('status:current'),
        set: (statusData) => globalCache.set('status:current', statusData, TTL.STATUS),
        invalidate: () => globalCache.delete('status:current')
    },
    
    /**
     * Cache do Hall da Fama
     */
    hallOfFame: {
        get: () => globalCache.get('hall_of_fame:list'),
        set: (data) => globalCache.set('hall_of_fame:list', data, TTL.HALL_OF_FAME),
        invalidate: () => globalCache.delete('hall_of_fame:list')
    }
};

module.exports = {
    CacheManager,
    cache: globalCache,
    CacheHelpers,
    TTL
};

