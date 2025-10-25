// FILE: commands/novaGuerra.js

const { db, FieldValue } = require('../config');
const { updatePlayerBackup } = require('../utils/playerUtils');
const { checkPreviousWarAbsences } = require('../utils/warningSystem');
const logger = require('../utils/logger'); // Importa o logger

async function handleNovaGuerra(context) {
    const { reply } = context;
    try {
        await reply("🚨 *Atenção!* Iniciando o processo de fechamento da semana...");

        // --- PASSO 1: CALCULAR E SALVAR O CAMPEÃO DA SEMANA ---
        await reply("1️⃣ Calculando o campeão da semana... 🏆");
        const playersRef = db.collection('players');
        const playersSnapshot = await playersRef.get();
        
        if (!playersSnapshot.empty) {
            const playersWithTotals = playersSnapshot.docs.map(doc => {
                const player = doc.data();
                const totalPoints = (player.dailyPoints || [0, 0, 0, 0]).reduce((sum, pts) => sum + pts, 0);
                return { name: player.name, totalPoints };
            });

            if (playersWithTotals.length > 0) {
                const maxScore = Math.max(...playersWithTotals.map(p => p.totalPoints));
                const winners = playersWithTotals.filter(p => p.totalPoints === maxScore);

                if (winners.length > 0 && maxScore > 0) {
                    let winnerMessage = '';
                    if (winners.length > 1) {
                        winnerMessage = `🏆 Tivemos um empate! Os campeões da semana com *${maxScore}* pontos são:\n`;
                        const winnerNames = winners.map(w => w.name);
                        winnerMessage += `*${winnerNames.join(' & ')}*`;
                    } else {
                        winnerMessage = `🏆 O grande campeão da semana é *${winners[0].name}* com *${maxScore}* pontos!`;
                    }
                    await reply(winnerMessage + "\n\nRegistrando no Hall da Fama...");

                    const batch = db.batch();
                    winners.forEach(winner => {
                        const winnerRef = db.collection('hall_of_fame').doc(winner.name);
                        batch.set(winnerRef, { 
                            name: winner.name, 
                            wins: FieldValue.increment(1) 
                        }, { merge: true });
                    });
                    await batch.commit();

                } else {
                    await reply("⚠️ Ninguém pontuou nesta guerra, então não há campeão esta semana.");
                }
            }
        }
        
        // --- PASSO 2: Chama a função para verificar todas as faltas e punir ---
        await reply("2️⃣ Realizando a verificação final de faltas da guerra anterior... Isso pode levar um momento.");
        await checkPreviousWarAbsences(context);
        
        // --- PASSO 3: Zera os pontos de todos, como antes ---
        await reply("3️⃣ Faltas verificadas! Agora, zerando os placares para a nova guerra...");
        const snapshot = await playersRef.get();
        if (snapshot.empty) {
            return reply("Nenhum jogador na lista para resetar.");
        }

        const batchReset = db.batch();
        snapshot.docs.forEach(doc => {
            const playerData = doc.data();
            const updateFields = {
                dailyPoints: [0, 0, 0, 0],
                warnedAbsences: []
            };

            // Garante que navalPoints exista e seja redefinido para 0
            if (playerData.navalPoints !== undefined) {
                updateFields.navalPoints = 0;
            } else {
                updateFields.navalPoints = 0; // Adiciona o campo se não existir
            }
            
            batchReset.update(doc.ref, updateFields);
        });
        await batchReset.commit();
        await updatePlayerBackup();
        
        await reply("✅ *Nova Guerra Iniciada!* O campeão foi coroado, as faltas foram aplicadas e todos os placares foram zerados.");
    } catch (error) {
        logger.error("❌ Erro ao executar /nova_guerra:", error);
        await reply("❌ Ocorreu um erro grave ao tentar iniciar a nova guerra.");
    }
}

module.exports = {
    name: 'nova_guerra',
    handler: handleNovaGuerra,
    isAdminCommand: true
};


