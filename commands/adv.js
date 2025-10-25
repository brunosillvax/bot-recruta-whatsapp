const { db } = require('../config');

async function handleAdv({ reply }) { 
    try { 
        const playersSnapshot = await db.collection('players').get(); 
        const allWarnedPlayers = playersSnapshot.docs.map(doc => doc.data()).filter(player => player.warnings > 0); 
        if (allWarnedPlayers.length === 0) { 
            return reply("🎉 Ninguém possui advertências."); 
        } 
        const highRiskPlayers = allWarnedPlayers.filter(p => p.warnings >= 3).sort((a, b) => b.warnings - a.warnings); 
        const riskZonePlayers = allWarnedPlayers.filter(p => p.warnings === 2).sort((a, b) => a.name.localeCompare(b.name)); 
        const normalWarningPlayers = allWarnedPlayers.filter(p => p.warnings === 1).sort((a, b) => a.name.localeCompare(b.name)); 
        let response = "⚠ *Lista de Advertências* ⚠\n\n"; 
        if (highRiskPlayers.length > 0) { 
            response += "🚨 *RISCO MÁXIMO (3+ ADVs)* 🚨\n"; 
            highRiskPlayers.forEach(player => { 
                response += `📌 ${player.name} (${player.warnings}/5)\n`; 
            }); 
            response += "\n"; 
        } 
        if (riskZonePlayers.length > 0) { 
            response += "🔥 *ZONA DE RISCO (2 ADVs)* 🔥\n"; 
            riskZonePlayers.forEach(player => { 
                response += `📌 ${player.name} (2/5)\n`; 
            }); 
            response += "\n"; 
        } 
        if (normalWarningPlayers.length > 0) { 
            response += "⚠️ *1 Advertência*\n"; 
            normalWarningPlayers.forEach(player => { 
                response += `📌 ${player.name} (1/5)\n`; 
            }); 
        } 
        await reply(response); 
    } catch (error) { 
        console.error("❌ Erro no /adv:", error); 
        return reply("❌ Ocorreu um erro ao listar as advertências."); 
    } 
}

module.exports = {
    name: 'adv',
    handler: handleAdv,
    isAdminCommand: false
};

