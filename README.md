# Portfolio and site assistant

Live site: https://hasibur-rahaman-hamim.vercel.app

Source of the portfolio site of Hasibur Rahaman Hamim, a Computer Science student (cyber security major) at the University of Wollongong, looking for graduate software, IT support and systems roles.

The site is also one of my projects: the chat on the home page is a small assistant that answers questions about me from written facts, checks every answer before it is shown and says so when something is not there. It is listed on the site as Case 02, and it also lives in its own repository, https://github.com/hamimabbu/site-assistant, so anyone can reuse it for their own site.

The pages are plain HTML and CSS with a few small browser scripts. There is no build step, no framework, no cookies, no trackers and no third-party code. Two small serverless functions run the assistant (api/chat.js) and the contact form (api/contact.js), and neither has dependencies.

## What is in it

- index.html: the home page with projects, skills, background and contact, plus the assistant in the top section
- cv.html and Hasibur-Rahaman-Hamim-CV.pdf: a one-page CV built only from facts that are on the site
- upload-scanner.html, arp-detector.html, ad-lab.html, layerlens.html: one case study for each security project
- 404.html: the page for a missing address
- styles.css: all the styling, with fonts in the fonts folder (self-hosted, licences included)
- terminal.js: the assistant box in the top section
- projects.js: the project filter and the link that fills the question box
- contact.js: the contact form, which sends a message without showing my address
- fit.js: the skills check behind the fit command. It compares a list of skills or a role with what the site really shows, and says shown, partly, learning or not shown
- api/chat.js, api/contact.js and api/_bot: the assistant and the mail sender. What the assistant knows is written as plain text files in api/_bot/knowledge, one topic per file
- dev: a local test server, the unit tests and a script that attacks the assistant
- vercel.json: clean addresses and security headers
- favicon.svg, apple-touch-icon.png, og-image.png: icons and the link preview picture
- robots.txt, sitemap.xml: for search engines
- .well-known/security.txt: contact line for security researchers

## Run it locally

Open index.html in a browser. The assistant box works from the folder, using the facts in the page. The full assistant and the contact form need a web address, so to try them run `node dev/server.js` (Node.js 22 or newer) and open http://localhost:3000. There is nothing to install.

## Tests

- `npm test` runs the unit tests with Node's built-in test runner
- `npm run redteam` sends 100 attack inputs to the assistant and reports anything that leaks

## How the assistant works

Short commands are answered in the browser from the JSON block at the bottom of index.html and send nothing anywhere. Type help to see what it knows. A visitor can type login followed by a name to put it in the prompt, and whoareyou to see what their browser tells every website.

A longer question goes to the assistant. It answers from the knowledge files, says so when a fact is not there, and works without any AI key. If a key is set, an AI model can pick the topic when the keywords find nothing and can word the answer, and the answer is checked against the same facts before it is shown. Up to three free AI services can be set, and each takes over when the one before it is down or out of quota. To change what the assistant knows, edit the text files. There is no training step.

## The contact form

The form posts to api/contact.js, which sends the message by email through Resend. My address only lives in an environment variable on the host, so it never appears on the page. The page asks the server if mail is set up before it shows the form. Until RESEND_API_KEY and CONTACT_TO are set, visitors see a short note that points to LinkedIn instead of a form. See dev/env.example for every setting.

## Security choices

- The content security policy allows no inline script or style and no outside sources (see vercel.json)
- The assistant box builds its output with textContent and allows only a short list of link addresses
- The assistant holds no secrets, has no tools and can only repeat public facts. Questions are checked before use, answers are checked before they are shown, and each visitor is rate limited
- The contact form has a hidden trap field, an origin check and rate limits per visitor and per day
- API keys are only read from environment variables, and the repository holds none
- No cookies, no analytics and no external fonts

## Contact

LinkedIn: https://www.linkedin.com/in/hasibur-rahaman-hamim/
