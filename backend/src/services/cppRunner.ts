import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const ENGINE = resolve(process.cwd(), '../cpp/build/graph_engine');

export async function runCpp(command: string, input: any): Promise<any> {
  return new Promise((resolveP, reject) => {
    const child = spawn(ENGINE, [command]);
    let out = ''; let err = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(err || `exit ${code}`));
      try { resolveP(JSON.parse(out)); } catch (e) { reject(new Error('bad json: ' + out)); }
    });
    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}