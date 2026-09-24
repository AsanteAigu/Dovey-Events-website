// Vercel serverless entry point. vercel.json routes every /api/* request here;
// the pages themselves are served statically from public/.
import { createServerApp } from '../src/bootstrap.js';

let instance;

export default async function handler(req, res) {
  try {
    const { app } = await (instance ??= createServerApp());
    return app(req, res);
  } catch (err) {
    instance = undefined;
    console.error(err);
    // Config errors only ever name the missing setting, never a secret's value.
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `Server is not configured correctly: ${err.message}` }));
  }
}
