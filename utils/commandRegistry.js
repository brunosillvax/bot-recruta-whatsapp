const commands = new Map();

const registerCommand = (name, handler, isAdminCommand = false) => {
    commands.set(name.toLowerCase(), { name, handler, isAdminCommand });
};

const getCommand = (name) => {
    return commands.get(name.toLowerCase());
};

const getAllCommands = () => {
    return Array.from(commands.values());
};

module.exports = { registerCommand, getCommand, getAllCommands };

