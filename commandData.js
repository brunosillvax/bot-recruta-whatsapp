// FILE: commandData.js (VERSÃO CORRIGIDA E COMPLETA)

// Este objeto agora é a ÚNICA fonte de verdade para todos os comandos do bot.
const commandDetails = {
    'me': {
        description: 'Mostra o seu status pessoal de forma privada.',
        usage: '`/me`',
        example: 'Mostra seus pontos de Guerra, Naval e advertências atuais.',
        admin: false
    },
    'nome': {
        description: 'Registra um novo jogador na lista.',
        usage: '`/nome [Seu Nome Completo]`',
        example: '`Ex: /nome Mestre Yoda`',
        admin: false
    },
    'cadastro': {
        description: 'Atualiza suas informações pessoais (nível XP, torre do rei, troféus, pontos navais).',
        usage: '`/cadastro`',
        example: 'Inicia um guia interativo para atualizar suas informações.',
        admin: false
    },
    'edit': {
        description: 'Corrige o nome de um jogador. Membros comuns só podem editar o próprio nome.',
        usage: '`/edit [Nome Antigo] x [Nome Novo]`',
        example: '`Ex: /edit Yado x Yoda`',
        admin: false
    },
    'lista': {
        description: 'Inicia o guia para lançar seus pontos.',
        usage: '`/lista`',
        example: 'Basta digitar o comando.',
        admin: false
    },
    'campeoes': {
        description: 'Mostra o Hall da Fama com os maiores campeões.',
        usage: '`/campeoes`',
        example: 'Exibe um ranking de quem mais venceu guerras.',
        admin: false
    },
    'status': {
        description: 'Mostra o placar de pontos da semana.',
        usage: '`/status`',
        example: 'Mostra os pontos de Guerra e Naval de todos.',
        admin: false
    },
    'ranking': {
        description: 'Mostra o ranking de pontos da Guerra.',
        usage: '`/ranking`',
        example: 'Exibe a lista ordenada por pontos.',
        admin: false
    },
    'lembrete': {
        description: 'Vê quem ainda não registrou pontos.',
        usage: '`/lembrete [dia|naval]`',
        example: '`/lembrete sexta` ou `/lembrete naval`',
        admin: false
    },
    'adv': {
        description: 'Mostra a lista de jogadores com advertências.',
        usage: '`/adv`',
        example: 'Exibe a lista de advertências.',
        admin: false
    },
    'sair': {
        description: 'Cancela qualquer operação em andamento.',
        usage: '`/sair` ou `/cancelar`',
        example: 'Cancela um lançamento de pontos.',
        admin: false
    },
    'punir': {
        description: 'Aplica 1 advertência. Com 5, o jogador é removido.',
        usage: '`/punir [Nome do Jogador]`',
        example: '`/punir Mestre Yoda`',
        admin: true
    },
    'remover': {
        description: '⚠️ Remove um jogador da lista e de todos os grupos do bot.',
        usage: '`/remover [Nome Exato]`',
        example: '`Ex: /remover Mestre Yoda`',
        admin: true
    },
    'verificar': {
        description: 'Compara a lista de membros do grupo com a lista do bot.',
        usage: '`/verificar`',
        example: 'Gera um relatório de quem está no grupo e não está no bot, e vice-versa.',
        admin: true
    },
    'resetar_advs': {
        description: '🚨 ZERA as advertências de TODOS os jogadores.',
        usage: '`/resetar_advs`',
        example: 'Use para começar uma nova contagem.',
        admin: true
    },
    'nova_guerra': {
        description: '🚨 ZERA todos os pontos de TODOS os jogadores.',
        usage: '`/nova_guerra`',
        example: 'Use no início de uma nova guerra.',
        admin: true
    },
    'restaurar_backup': {
        description: '🚨 Restaura a lista de jogadores do último backup.',
        usage: '`/restaurar_backup`',
        example: 'Use em caso de perda de dados.',
        admin: true
    },
};

module.exports = commandDetails;