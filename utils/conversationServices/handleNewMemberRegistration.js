const { db } = require('../../config');
const { getInitialDailyPoints } = require('../playerUtils');
const logger = require('../logger'); // Importa o logger

async function handleNewMemberRegistration(context) {
    const { userMessage, reply, userId, cancelAndExit } = context;
    try {
        const nome = userMessage;
        const playersRef = db.collection('players');
        const snapshot = await playersRef.where('name_lowercase', '==', nome.toLowerCase()).get();
        if (!snapshot.empty) {
            return cancelAndExit(`O nome *${nome}* já está na lista!`);
        }
        const initialPoints = getInitialDailyPoints();
        await playersRef.add({ 
            name: nome, 
            name_lowercase: nome.toLowerCase(),
            dailyPoints: initialPoints, 
            navalDefensePoints: 0, 
            warnings: 0, 
            whatsappId: userId, 
            warnedAbsences: [] 
        });
        cancelAndExit(`✅ Perfeito! Nick *${nome}* registrado com sucesso. Quando quiser, use o comando /lista para lançar seus pontos.`);
    } catch (error) {
        logger.error("❌ Erro no registro de novo membro:", error); // Usando logger.error
        cancelAndExit("❌ Ocorreu um erro ao registrar seu nome.");
    }
}

module.exports = handleNewMemberRegistration;
