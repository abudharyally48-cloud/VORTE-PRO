# Bot download for the Session ID site

Put the downloadable bot ZIP here, named exactly:

    files/VORTE-PRO.zip

The site then serves it at `/download/bot` (the "Download bot file" buttons).

- Do NOT put secrets in it: no `.env`, `session.txt`, `storage/session`, `cookies.json`, or `node_modules`.
- Don't want the ZIP inside the repo? Leave this folder empty and set the environment variable
  `BOT_DOWNLOAD_URL` to any link (GitHub release, Drive, ...); the same buttons will send visitors there.
- If neither exists, the buttons show "not available yet" instead of a broken link.
