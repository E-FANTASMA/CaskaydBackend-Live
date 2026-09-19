require('dotenv').config();
const { spawn } = require('child_process');

function getPythonCommand() {
  return process.env.PYTHON_BIN || (process.platform === 'win32' ? 'py' : 'python3');
}

const pythonCmd = getPythonCommand();
const args = ['scripts/sync-creator-instagram-avatars.py', ...process.argv.slice(2)];

const child = spawn(pythonCmd, args, {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
  windowsHide: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error(`\nError: Python executable "${pythonCmd}" was not found.`);
    console.error('Please make sure Python 3 is installed and added to your PATH, or set PYTHON_BIN in your .env file.');
  } else {
    console.error(`Failed to execute "${pythonCmd}":`, err.message);
  }
  process.exit(1);
});
