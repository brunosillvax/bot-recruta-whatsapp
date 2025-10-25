// FILE: commands/help.js (VERSÃO CORRIGIDA)

// 1. IMPORTA A LISTA UNIFICADA DE COMANDOS
const commandDetails = require('../commandData');
const logger = require('../utils/logger'); // Importa o logger

// A função recebe o 'context' completo para ter acesso a tudo que precisa
const handleHelp = async (context) => {
    const { userMessage, reply, isAdmin } = context;
    const parts = userMessage.toLowerCase().split(' ');
    const specificCommand = parts.length > 1 ? parts[1].replace('/', '') : null;

    // --- O objeto com os detalhes dos comandos foi REMOVIDO DAQUI ---

    // Lógica para ajuda específica de um comando
    if (specificCommand && commandDetails[specificCommand]) {
        const details = commandDetails[specificCommand];
        let helpText = `*Detalhes do Comando: /${specificCommand}* 🧐\n\n`;
        helpText += `*O que faz:*\n${details.description}\n\n`;
        helpText += `*Como usar:*\n${details.usage}\n\n`;
        helpText += `*Exemplo:*\n${details.example}`;
        if (details.admin) {
            helpText += `\n\n*Nota: Este é um comando apenas para administradores.*`;
        }
        return await reply(helpText);
    }

    // Lógica para a ajuda geral
    let generalHelp = `*Guia de Comandos do Bot* 🤖\n\nAqui está o que você pode fazer:\n`;
    generalHelp += `\n*➡️ Comandos para Todos:*\n`;
    generalHelp += `*/me* - Vê o seu status pessoal.\n`;
    generalHelp += `*/nome* - Se registra na lista.\n`;
    generalHelp += `*/cadastro* - Atualiza suas informações pessoais (nível XP, torre do rei, etc.).\n`;
    generalHelp += `*/edit* - Corrige seu próprio nome na lista. Admins podem usar */edit [nome_antigo] para [novo_nome]* para outros jogadores.\n`; // Atualizado
    generalHelp += `*/lista* - Lança seus pontos com um guia de conversa interativo.\n`; // Atualizado
    generalHelp += `*/status* - Vê o placar da semana.\n`;
    generalHelp += `*/ranking* - Vê o ranking de pontos da guerra.\n`;
    generalHelp += `*/campeoes* - Vê o Hall da Fama dos campeões.\n`;
    generalHelp += `*/lembrete* - Vê quem ainda não pontuou.\n`;
    generalHelp += `*/adv* - Mostra a lista de advertências.\n`;
    generalHelp += `*/sair* - Cancela uma operação.\n`;

    // Adicionando os comandos rápidos aqui
    generalHelp += `\n*⚡ Comandos Rápidos de Lançamento de Pontos:*\n`;
    generalHelp += `*/[pontos] [dia]* - Lança pontos de guerra diretamente (ex: \`/980 quinta\`).\n`; // Corrigido
    generalHelp += `*/[pontos]* - Lança pontos de guerra para o dia atual (ex: \`/980\`).\n`; // Corrigido
    generalHelp += `*👑 /[nome_do_jogador] [pontos] [dia]* - (Admin) Lança pontos para outro jogador (ex: \`/Mestre Yoda 980 sexta\`).\n`; // Corrigido
    generalHelp += `*👑 /[nome_do_jogador] [pontos]* - (Admin) Lança pontos para outro jogador para o dia atual (ex: \`/Mestre Yoda 980\`).\n`; // Corrigido

    if (isAdmin) {
        generalHelp += `\n*👑 Comandos de Administrador:*\n`;
        generalHelp += `*/punir* - Aplica uma advertência (remove com 5).\n`;
        generalHelp += `*/remover* - Remove um jogador da lista.\n`;
        generalHelp += `*/verificar* - Verifica membros não registrados.\n`;
        generalHelp += `*/resetar_advs* - Zera todas as advertências.\n`;
        generalHelp += `*/nova_guerra* - Zera todos os pontos.\n`;
        generalHelp += `*/restaurar_backup* - Restaura a lista de jogadores.\n`;
    }

    generalHelp += `\nPara saber mais detalhes, digite \`/ajuda [comando]\`\n(ex: \`/ajuda status\`)`;

    await reply(generalHelp);
};

module.exports = {
    name: 'ajuda',
    handler: handleHelp,
    isAdminCommand: false // Comandos de ajuda não são exclusivos de admin
};