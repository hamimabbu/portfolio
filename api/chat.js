// Vercel runs this file as the /api/chat address. All the work is in the _bot folder.
const { createHandler } = require("./_bot/app");

module.exports = createHandler();
