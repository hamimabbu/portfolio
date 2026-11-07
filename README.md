# Portfolio

Live site: https://hasibur-rahaman-hamim.vercel.app

Source of the portfolio site of Hasibur Rahaman Hamim, a final-year Computer Science student (cyber security major) at the University of Wollongong, graduating December 2026.

The pages are plain HTML and CSS with two small browser scripts. There is no build step, no framework, no cookies, no trackers and no third-party code. One small serverless function (api/chat.js) runs the assistant in the terminal, and it has no dependencies either.

## What is in it

- index.html: the home page with projects, skills, about and contact, plus a small terminal that answers questions about me
- upload-scanner.html, arp-detector.html, ad-lab.html, layerlens.html: one case study for each security project
- 404.html: the page for a missing address
- styles.css: all the styling
- terminal.js: the terminal in the hero section
- fit.js: the skills check behind the fit command. It compares a list of skills or a role with what the site really shows, and says shown, partly, learning or not shown
- api/chat.js and api/_bot: the assistant. What it knows is written as plain text files in api/_bot/knowledge, one topic per file
- dev: a local test server, the unit tests and a script that attacks the assistant
- vercel.json: clean addresses and security headers
- favicon.svg, apple-touch-icon.png, og-image.png: icons and the link preview picture
- robots.txt, sitemap.xml: for search engines
- .well-known/security.txt: contact line for security researchers

## Run it locally

Open index.html in a browser. The terminal works from the folder, using the facts in the page. The assistant needs a web address, so to try it run `node dev/server.js` (Node.js 22 or newer) and open http://localhost:3000. There is nothing to install.

## Tests

- `npm test` runs the unit tests with Node's built-in test runner
- `npm run redteam` sends a list of attacks to the assistant and reports anything that leaks

## The terminal

Short commands are answered in the browser from the JSON block at the bottom of index.html and send nothing anywhere. Type help to see what it knows. A visitor can type login followed by a name to put it in the prompt, and whoareyou to see what their browser tells every website.

A longer question goes to the assistant. It answers from the knowledge files, says so when a fact is not there, and works without any AI key. If a key is set, an AI model can word the answer, and the answer is checked against the same facts before it is shown. To change what the assistant knows, edit the text files. There is no training step.

## Security choices

- The content security policy allows no inline script or style and no outside sources (see vercel.json)
- The terminal builds its output with textContent and allows only a short list of link addresses
- The assistant holds no secrets, has no tools and can only repeat public facts. Questions are checked before use, answers are checked before they are shown, and each visitor is rate limited
- API keys are only read from environment variables, and the repository holds none
- No cookies, no analytics and no external fonts

## Contact

LinkedIn: https://www.linkedin.com/in/hasibur-rahaman-hamim/
