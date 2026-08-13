import {spawnSync} from 'node:child_process';

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: npm run protobuf:update -- <exact-version>');
  process.exit(1);
}

const commands = [
  ['npm', ['install', '--save-exact', `@meshtastic/protobufs@${version}`]],
  ['npm', ['test']],
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'build']],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {stdio: 'inherit'});

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
