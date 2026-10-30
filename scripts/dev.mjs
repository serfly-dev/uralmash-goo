import { spawn } from 'node:child_process';
const processes = [
  spawn(process.execPath, ['--experimental-sqlite', 'server/index.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev'], { stdio: 'inherit' }),
];
function stop() { for (const child of processes) child.kill('SIGTERM'); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of processes) child.on('exit', (code) => { if (code && code !== 0) { stop(); process.exitCode = code; } });
