// Vercel serverless entry point. vercel.json routes every /api/* request here;
// the pages themselves are served statically from public/.
//
// The app is imported lazily so that any start-up failure (a missing setting,
// a bad database URL) becomes a readable error response instead of a crash.
let instance;

export default async function handler(req, res) {
  try {
    instance ??= import('../src/bootstrap.js').then((m) => m.createServerApp());
    const { app } = await instance;
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
