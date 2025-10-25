// FILE: commands/memory.js
// Comando para monitorar e gerenciar uso de memória

const { debugMemoryUsage, clearLargeCacheEntries } = require('../utils/debugCache');
const { autoMemoryManager } = require('../utils/autoMemoryManager');
const logger = require('../utils/logger');

const handleMemory = async ({ reply, userMessage, isAdmin }) => {
    try {
        // Só administradores podem usar este comando
        if (!isAdmin) {
            return reply('❌ Este comando é apenas para administradores.');
        }

        const parts = userMessage.toLowerCase().split(' ');
        const action = parts[1];

        if (action === 'status' || !action) {
            // Mostra status da memória
            const debug = debugMemoryUsage();
            
            let response = `🧠 *Status de Memória do Bot*\n\n`;
            response += `📊 *Uso de Memória:*\n`;
            response += `• Heap Usado: ${Math.round(debug.memory.heapUsed / 1024 / 1024)}MB\n`;
            response += `• Heap Total: ${Math.round(debug.memory.heapTotal / 1024 / 1024)}MB\n`;
            response += `• Heap Usado: ${debug.heapUsedPercent.toFixed(2)}%\n`;
            response += `• RSS: ${Math.round(debug.memory.rss / 1024 / 1024)}MB\n\n`;
            
            response += `💾 *Cache:*\n`;
            response += `• Entradas: ${debug.cacheStats.size}\n`;
            response += `• Hit Rate: ${debug.cacheStats.hitRate}\n`;
            response += `• Requests: ${debug.cacheStats.totalRequests}\n\n`;
            
            const autoMemoryStats = autoMemoryManager.getStats();
            response += `🧹 *Auto Memory Manager:*\n`;
            response += `• Status: ${autoMemoryStats.isRunning ? 'Ativo' : 'Inativo'}\n`;
            response += `• Limpezas executadas: ${autoMemoryStats.cleanupCount}\n`;
            
            if (debug.heapUsedPercent > 80) {
                response += `\n⚠️ *Atenção:* Uso de memória alto! Use \`/memory force\` para limpeza forçada.`;
            }
            
            return reply(response);

        } else if (action === 'clear') {
            // Limpa cache grande
            const before = debugMemoryUsage();
            const after = clearLargeCacheEntries();
            
            const freed = before.memory.heapUsed - after.memory.heapUsed;
            const percentReduction = ((before.heapUsedPercent - after.heapUsedPercent) / before.heapUsedPercent * 100);
            
            let response = `🧹 *Cache Limpo com Sucesso!*\n\n`;
            response += `📉 *Memória Liberada:*\n`;
            response += `• ${Math.round(freed / 1024 / 1024)}MB liberados\n`;
            response += `• Redução de ${percentReduction.toFixed(1)}%\n`;
            response += `• Antes: ${before.heapUsedPercent.toFixed(2)}%\n`;
            response += `• Depois: ${after.heapUsedPercent.toFixed(2)}%\n\n`;
            response += `💾 *Cache:*\n`;
            response += `• Entradas antes: ${before.cacheStats.size}\n`;
            response += `• Entradas depois: ${after.cacheStats.size}`;
            
            return reply(response);

        } else if (action === 'gc') {
            // Força garbage collection
            if (global.gc) {
                const before = debugMemoryUsage();
                global.gc();
                const after = debugMemoryUsage();
                
                const freed = before.memory.heapUsed - after.memory.heapUsed;
                
                let response = `🗑️ *Garbage Collection Executado*\n\n`;
                response += `📉 *Memória Liberada:*\n`;
                response += `• ${Math.round(freed / 1024 / 1024)}MB liberados\n`;
                response += `• Antes: ${before.heapUsedPercent.toFixed(2)}%\n`;
                response += `• Depois: ${after.heapUsedPercent.toFixed(2)}%`;
                
                return reply(response);
            } else {
                return reply('❌ Garbage collection não está disponível. Execute o bot com \`--expose-gc\` para habilitar.');
            }

        } else if (action === 'force') {
            // Limpeza forçada
            const result = autoMemoryManager.forceCleanup();
            
            let response = `🚀 *Limpeza Forçada Executada!*\n\n`;
            response += `📉 *Resultados:*\n`;
            response += `• ${result.freedMB}MB liberados\n`;
            response += `• Redução de ${result.heapReduction.toFixed(1)}%\n`;
            response += `• ${result.entriesRemoved} entradas removidas\n\n`;
            response += `🧹 Auto Memory Manager ativo e monitorando continuamente.`;

            return reply(response);

        } else {
            return reply(`❌ Ação inválida. Use:\n• \`/memory status\` - Ver status\n• \`/memory clear\` - Limpar cache\n• \`/memory gc\` - Garbage collection\n• \`/memory force\` - Limpeza forçada`);
        }

    } catch (error) {
        logger.error('❌ Erro no comando /memory:', error);
        return reply('❌ Ocorreu um erro ao executar o comando de memória.');
    }
};

module.exports = {
    name: 'memory',
    handler: handleMemory,
    isAdminCommand: true
};
