const commandDetails = require('./commandData');
const logger = require('./utils/logger'); // Importa o logger

// --- DICIONÁRIO DE INTENÇÕES ATUALIZADO COM PRIORIDADES ---
// Esta é a versão mais completa que criamos.
const commandKeywords = {
    // --- Comandos de Ação (Maior Prioridade) ---
    'lista': {
        keywords: ['lançar', 'lançamento', 'adicionar pontos', 'colocar meus pontos', 'como lança', 'como coloco meus pontos', 'pontuar', 'registrar ataque', 'lançar pt', 'lançar pts', 'botar os pontos', 'quero adicionar pontos'],
        priority: 3
    },
    'nome': {
        keywords: ['registrar', 'registro', 'adiciono meu nome', 'entrar na lista', 'cadastrar', 'novo membro', 'cadastrar nome', 'bot n tem meu nome', 'sou novo'],
        priority: 3
    },
    'edit': {
        keywords: ['mudar nome', 'corrigir nome', 'editar nome', 'arrumar meu nome', 'meu nome ta errado', 'alterar nome', 'troca o nome', 'edita o nome', 'nome errado', 'arrumar nick'],
        priority: 3
    },
    'punir': {
        keywords: ['punir', 'dar advertência', 'aplicar advertência', 'como punir', 'dar adv', 'punir o cara', 'aplicar punição'],
        priority: 3
    },
    'lembrete': {
        keywords: ['lembrete', 'quem falta', 'quem não atacou', 'quem não fez', 'cobrar', 'falta atacar', 'quem n atacou', 'cobrança', 'zerado'],
        priority: 2
    },

    // --- Comandos de Consulta (Prioridade Média) ---
    'ranking': {
        keywords: ['ranking', 'rank', 'ranquin', 'classificação', 'quem ta ganhando', 'quem ganhou', 'primeiro lugar', 'top 3', 'pódio', 'quem ta na frente', 'top players'],
        priority: 2
    },
    'me': {
        keywords: ['meu status', 'minha pontuação', 'ver meus pontos', 'como eu to', 'minhas adv', 'quantos adv eu tenho', 'meus pts', 'como estou', 'to com quantas adv', 'tenho quantos adv'],
        priority: 2
    },
    'adv': {
        keywords: ['advertência', 'advertencias', 'avisos', 'lista de adv', 'quem tem adv', 'ver advs', 'lista de punidos', 'adv'],
        priority: 2
    },
    'ajuda': {
        keywords: ['ajuda', 'socorro', 'help', 'comandos', 'cmd', 'o que você faz', 'como funciona', 'não sei o que fazer', 'quais os comandos'],
        priority: 2
    },

    // --- Assuntos Gerais (Menor Prioridade) ---
    'status': {
        keywords: ['pontos', 'pts', 'placar', 'pontuação', 'ver os pontos', 'quem já fez', 'como tá a guerra', 'guerra', 'placar da guerra'],
        priority: 1
    }
};

const COOLDOWN_TIME = 60 * 1000; // 1 minuto
const groupCooldowns = new Map();

module.exports = async (context) => {
    const { userMessage, reply, from, userId, userStates, setUserTimeout } = context; // NOVO: Adicionado userStates, setUserTimeout
    const messageLower = userMessage.toLowerCase();

    if (groupCooldowns.has(from)) {
        logger.debug(`Cooldown ativo para ${from}. Ignorando mensagem.`);
        return;
    }

    logger.debug(`Passive Handler: Mensagem recebida: ${userMessage} do usuário ${userId}.`);

    // <<< LÓGICA ATUALIZADA PARA O SISTEMA DE "MELHOR RESPOSTA COM PRIORIDADE" >>>
    let bestMatch = null; 

    for (const commandName in commandKeywords) {
        const { keywords, priority } = commandKeywords[commandName];
        
        for (const keyword of keywords) {
            if (messageLower.includes(keyword)) {
                // A nova correspondência ganha se:
                // 1. For a primeira encontrada (!bestMatch).
                // 2. Tiver prioridade MAIOR que a melhor correspondência atual.
                // 3. Tiver a MESMA prioridade, mas for uma palavra-chave MAIS LONGA.
                if (!bestMatch || 
                    priority > bestMatch.priority || 
                   (priority === bestMatch.priority && keyword.length > bestMatch.keyword.length)) {
                    bestMatch = { commandName, keyword, priority };
                }
            }
        }
    }
    
    // Depois de verificar todas as palavras, respondemos com a melhor correspondência encontrada
    if (bestMatch) {
        const details = commandDetails[bestMatch.commandName];
        if (details) {
            let response = `Olá! 👋 Parece que você falou sobre "*${bestMatch.keyword}*".\n\n`;
            response += `Acho que posso ajudar! Se a sua intenção é "${details.description.toLowerCase().replace('.', '')}", o comando é:\n\n➡️ *${details.usage}*`;

            await reply(response);
            groupCooldowns.set(from, true);
            setTimeout(() => {
                groupCooldowns.delete(from);
            }, COOLDOWN_TIME);
        }
    }
};