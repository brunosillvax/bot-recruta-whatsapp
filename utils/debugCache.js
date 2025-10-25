// FILE: utils/debugCache.js
// Utilitário para debug do cache e memória

const { cache } = require('./cacheManager');
const logger = require('./logger');

function debugMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    console.log('\n=== DEBUG DE MEMÓRIA ===');
    console.log(`Heap Usado: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
    console.log(`Heap Usado: ${heapUsedPercent.toFixed(2)}%`);
    console.log(`RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
    console.log(`External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
    
    console.log('\n=== ESTATÍSTICAS DO CACHE ===');
    const cacheStats = cache.getStats();
    console.log(`Tamanho do Cache: ${cacheStats.size} entradas`);
    console.log(`Hit Rate: ${cacheStats.hitRate}`);
    console.log(`Total Requests: ${cacheStats.totalRequests}`);
    console.log(`Sets: ${cacheStats.sets}`);
    console.log(`Deletes: ${cacheStats.deletes}`);
    console.log(`Evictions: ${cacheStats.evictions}`);
    
    console.log('\n=== TOP 10 MAIORES ENTRADAS DO CACHE ===');
    const entries = Array.from(cache.cache.entries());
    entries.sort((a, b) => JSON.stringify(b[1].value).length - JSON.stringify(a[1].value).length);
    
    entries.slice(0, 10).forEach(([key, entry], index) => {
        const size = JSON.stringify(entry.value).length;
        console.log(`${index + 1}. ${key}: ${size} bytes`);
    });
    
    return {
        memory: memUsage,
        heapUsedPercent,
        cacheStats
    };
}

function clearLargeCacheEntries() {
    console.log('\n=== LIMPANDO CACHE GRANDE ===');
    
    // Limpa cache de ranking e status que podem ser grandes
    cache.deletePattern(/^(ranking|status):/);
    
    // Limpa cache de lista de jogadores se for muito grande
    const playerListCache = cache.get('players:list');
    if (playerListCache && JSON.stringify(playerListCache).length > 100000) {
        cache.delete('players:list');
        console.log('Cache de lista de jogadores limpo (muito grande)');
    }
    
    // Força garbage collection se disponível
    if (global.gc) {
        global.gc();
        console.log('Garbage collection executado');
    }
    
    console.log('Cache limpo com sucesso');
    return debugMemoryUsage();
}

module.exports = {
    debugMemoryUsage,
    clearLargeCacheEntries
};
