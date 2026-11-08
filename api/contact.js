// Vercel runs this file as the /api/contact address. All the work is in the _bot folder.
const { createContactHandler } = require("./_bot/contact");

module.exports = createContactHandler();
