#!/usr/bin/env node
/**
 * 判定 profile 里的 @snow-the/* 到底是【硬链接/软链接/真拷贝】。
 * 这决定改动是否需要显式刷新才能生效。
 * 硬链接判据：同一 (dev, ino)。Windows 上 Node 的 stat 也提供 ino。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const PROFILES = ['web', 'web2'];
const SRC = path.join(HOME, '.dsh-starter', 'plugins');

const NAMES = ['dsh-search', 'dsh-notemap', 'dsh-busyloop', 'dsh-gitkit', 'dsh-skill-pack', 'dsh-plugin-guide'];

const describe = (p) => {
  try {
    const s = fs.statSync(p);
    const l = fs.lstatSync(p);
    return { dev: s.dev, ino: s.ino, size: s.size, mtime: s.mtime.toISOString(), isSymlink: l.isSymbolicLink() };
  } catch { return null; }
};

console.log('=== profile 副本 vs 源：是否同一物理文件（硬链接判据 dev+ino）===\n');
for (const name of NAMES) {
  const srcPkg = path.join(SRC, name, 'package.json');
  const s = describe(srcPkg);
  if (!s) { console.log(`  ${name}: 源不存在`); continue; }
  console.log(`  ${name}`);
  console.log(`      源        dev=${s.dev} ino=${s.ino} size=${s.size}`);
  for (const prof of PROFILES) {
    const c = path.join(HOME, '.dsh', 'profiles', prof, 'node_modules', '@snow-the', name, 'package.json');
    const d = describe(c);
    if (!d) { console.log(`      ${prof.padEnd(9)} (未安装)`); continue; }
    const sameFile = d.dev === s.dev && d.ino === s.ino;
    const sameBytes = fs.readFileSync(c, 'utf8') === fs.readFileSync(srcPkg, 'utf8');
    console.log(`      ${prof.padEnd(9)} dev=${d.dev} ino=${d.ino} size=${d.size}  symlink=${d.isSymlink}  ` +
      `同一物理文件=${sameFile ? '是（硬链接）' : '否'}  内容相同=${sameBytes ? '是' : '否'}`);
  }
}

console.log('\n=== 目录本身是否 junction/symlink ===\n');
for (const name of NAMES) {
  for (const prof of PROFILES) {
    const d = path.join(HOME, '.dsh', 'profiles', prof, 'node_modules', '@snow-the', name);
    try {
      const l = fs.lstatSync(d);
      const real = fs.realpathSync(d);
      console.log(`  ${prof}/${name}: isSymlink=${l.isSymbolicLink()}  realpath=${real}`);
    } catch { console.log(`  ${prof}/${name}: (不存在)`); }
  }
}
