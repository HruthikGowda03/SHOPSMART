/**
 * Guards the Vercel deployment contract for this repository.
 *
 * The rules below are copied from Vercel's own builders, so a mistake here is
 * caught on your machine instead of halfway through a production build:
 *
 *  - vercel.json declares a `services` block, and routing keys stay at the top
 *    level while build/runtime keys live inside each service.
 *  - the `server` service is found by @vercel/express, which picks the
 *    entrypoint by looking for a file whose *source text* imports "express"
 *    (it does not follow the import graph). A pure re-export is rejected with
 *    "No entrypoint found which imports express".
 *  - the server's buildCommand must compile src/ to dist/ before that entry
 *    point is resolved.
 *  - the client talks to the API over relative /api paths, so no service
 *    binding (which injects a base URL) is needed.
 *
 * Run with: npm run check:deploy
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Vercel @vercel/express: how the entrypoint is discovered.
const EXPRESS_ENTRY_REGEX = /(?:from|require|import)\s*(?:\(\s*)?["']express["']\s*(?:\))?/g;
const VALID_FILENAMES = ['app', 'index', 'server', 'src/app', 'src/index', 'src/server'];
const VALID_EXTENSIONS = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok, detail });

const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

// ---------------------------------------------------------------- vercel.json
let config = {};
try {
  config = readJson('vercel.json');
  check('vercel.json is valid JSON', true);
} catch (err) {
  check('vercel.json is valid JSON', false, err.message);
}

const services = config.services ?? {};
check('vercel.json declares a services block', Object.keys(services).length > 0, Object.keys(services).join(', '));
check('service "client" exists', !!services.client);
check('service "server" exists', !!services.server);

for (const key of ['functions', 'installCommand', 'buildCommand', 'outputDirectory', 'devCommand']) {
  check(`"${key}" is not a top-level key (belongs to a service)`, !(key in config));
}

const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
const apiRewrite = rewrites.find((r) => r.source === '/api/(.*)');
const catchAll = rewrites.find((r) => r.source === '/(.*)');
check('"/api/(.*)" routes to the server service', apiRewrite?.destination?.service === 'server');
check('"/(.*)" catch-all routes to the client service', catchAll?.destination?.service === 'client');
check(
  'the catch-all rewrite is last',
  rewrites.indexOf(catchAll) === rewrites.length - 1,
  `order: ${rewrites.map((r) => r.source).join(' -> ')}`,
);

// ------------------------------------------------------------------- runtimes
// A service's `runtime` is a *lambda runtime* identifier (e.g. "nodejs24.x",
// "python3.14"), never a framework slug - naming a framework or a bare
// language there fails the deployment with
//   Error: Service "server" has invalid runtime "nodejs".
// Vercel auto-detects the runtime, so the correct move is to leave it out and
// let `framework` decide which builder runs.
const LAMBDA_RUNTIME = /^(nodejs\d+(\.\d+)*\.?x?|bun\d+(\.\d+)*|python3\.\d+|edge|container)$/i;
for (const [name, service] of Object.entries(services)) {
  const runtime = service?.runtime;
  check(
    `service "${name}" does not declare an invalid runtime`,
    runtime === undefined || LAMBDA_RUNTIME.test(runtime),
    runtime === undefined
      ? 'not set, auto-detected'
      : `"${runtime}"${LAMBDA_RUNTIME.test(runtime) ? '' : ' is not a lambda runtime identifier'}`,
  );
}

// -------------------------------------------- @vercel/express entrypoint lookup
const serverRoot = join(root, 'server');
const serverConfig = services.server ?? {};
const declaredEntrypoint = serverConfig.entrypoint;

if (declaredEntrypoint) {
  const p = join(serverRoot, declaredEntrypoint);
  check(`declared entrypoint server/${declaredEntrypoint} exists`, existsSync(p));
}

const candidates = VALID_FILENAMES.flatMap((f) => VALID_EXTENSIONS.map((e) => `${f}.${e}`)).filter((f) =>
  existsSync(join(serverRoot, f)),
);
const matching = candidates.filter((f) => EXPRESS_ENTRY_REGEX.test(readFileSync(join(serverRoot, f), 'utf8')));
EXPRESS_ENTRY_REGEX.lastIndex = 0; // the regex is global, so reset it for reuse
check(
  'a server entrypoint that imports express directly exists',
  matching.length > 0,
  `candidates seen: ${candidates.join(', ') || 'none'} | matched: ${matching.join(', ') || 'none'}`,
);

// A file that only re-exports the built app fails this check; make the failure
// obvious rather than letting Vercel report it as a missing entrypoint.
const reExportOnly = candidates.filter((f) => !matching.includes(f));
check(
  'the declared entrypoint is the one Vercel will pick',
  declaredEntrypoint ? matching.includes(declaredEntrypoint) : true,
  reExportOnly.length ? `would be rejected by Vercel: ${reExportOnly.join(', ')}` : '',
);

// ---------------------------------------------------------- server build step
const serverPkg = readJson('server/package.json');
const buildCommand = serverConfig.buildCommand ?? '';
check('server service has a buildCommand', !!buildCommand, buildCommand);
check(
  'the server buildCommand compiles src/ to dist/',
  /build/.test(buildCommand) && existsSync(join(serverRoot, 'src')),
  `build script: ${serverPkg.scripts?.build ?? 'missing'}`,
);
check('server build output dist/app.js is present', existsSync(join(serverRoot, 'dist/app.js')));
check('the entrypoint imports the compiled output', (() => {
  const f = declaredEntrypoint ?? matching[0];
  return f ? /dist\/app\.js/.test(readFileSync(join(serverRoot, f), 'utf8')) : false;
})());

// ------------------------------------------------------------- client service
const clientConfig = services.client ?? {};
check('client service has a framework preset', !!clientConfig.framework, clientConfig.framework);
check('client build output client/dist is present', existsSync(join(root, 'client/dist')));
check(
  'the client buildCommand runs the TypeScript check',
  !clientConfig.buildCommand || /npm run build/.test(clientConfig.buildCommand),
  `Vercel's Vite preset default is "vite build", which skips tsc -b`,
);

// ------------------------------------------------------------------ bindings
const hasBindings = Object.values(services).some((s) => Array.isArray(s.bindings) && s.bindings.length > 0);
const apiSource = readFileSync(join(root, 'client/src/api.ts'), 'utf8');
const usesRelativeApi = /fetch\(\s*[`'"]\/api/.test(apiSource);
check(
  'no service bindings are declared (client uses relative /api paths)',
  !hasBindings && usesRelativeApi,
  hasBindings ? 'bindings present but the client calls its own origin' : 'client calls /api on the same domain',
);

// --------------------------------------------------------------- secrets audit
const envExample = existsSync(join(root, '.env.example')) ? readFileSync(join(root, '.env.example'), 'utf8') : '';
check(
  '.env.example carries only a placeholder secret',
  !/SESSION_SECRET\s*=\s*[A-Za-z0-9]{16,}/.test(envExample),
);

// ------------------------------------------------------------------------ run
let failed = 0;
for (const { label, ok, detail } of results) {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` :: ${detail}` : ''}`);
}
console.log(
  failed === 0
    ? `\nAll ${results.length} deployment checks passed.`
    : `\n${failed} of ${results.length} deployment checks FAILED.`,
);
process.exit(failed === 0 ? 0 : 1);