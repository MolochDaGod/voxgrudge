import fs from 'fs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node inspect-glb.mjs <file.glb>');
  process.exit(1);
}

const buf = fs.readFileSync(path);
let offset = 0;
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546c67) throw new Error('Not a GLB');
const version = buf.readUInt32LE(4);
const length = buf.readUInt32LE(8);
console.log('GLB version', version, 'length', length);
offset = 12;
while (offset < buf.length) {
  const chunkLen = buf.readUInt32LE(offset);
  const chunkType = buf.readUInt32LE(offset + 4);
  const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLen);
  offset += 8 + chunkLen;
  if (chunkType !== 0x4e4f534a) continue; // JSON
  const json = JSON.parse(chunkData.toString('utf8'));
  console.log('asset:', json.asset);
  console.log('nodes:', json.nodes?.length);
  json.nodes?.forEach((n, i) => {
    if (n.name) console.log('  node', i, n.name, n.children ? `children=${n.children.length}` : '');
  });
  console.log('animations:', json.animations?.length);
  json.animations?.forEach((a, i) => {
    const samplers = a.samplers?.length ?? 0;
    const channels = a.channels?.length ?? 0;
    console.log(`  [${i}] "${a.name}" channels=${channels} samplers=${samplers}`);
  });
  console.log('meshes:', json.meshes?.length);
  console.log('materials:', json.materials?.map((m) => m.name));
}