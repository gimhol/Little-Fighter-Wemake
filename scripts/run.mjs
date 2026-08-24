import { spawn } from 'child_process';

export async function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const command = isWin ? 'cmd' : cmd;
    const commandArgs = isWin ? ['/c', cmd, ...args] : args;

    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      windowsHide: true,
    });

    child.on('close', (code) => {
      if (code === 0) resolve('执行成功');
      else reject(new Error(`命令退出码：${code}`));
    });

    child.on('error', (err) => reject(err));
  });
}