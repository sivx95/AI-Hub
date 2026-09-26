// 打包后用 rcedit 修改 exe 图标和版本信息（绕过 electron-builder 的签名限制）
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const iconPath = path.join(root, 'icon.ico');
const packageJsonPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = pkg.version || '1.0.0';
const productName = pkg.build?.productName || pkg.name || 'AI Hub';

// rcedit 路径（npm 安装的 rcedit 包）
const rceditPath = path.join(root, 'node_modules', 'rcedit', 'bin', 'rcedit.exe');
const rceditX64Path = path.join(root, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');

function findRcedit() {
  if (fs.existsSync(rceditX64Path)) return rceditX64Path;
  if (fs.existsSync(rceditPath)) return rceditPath;
  try {
    const out = execSync('where rcedit.exe 2>nul', { encoding: 'utf-8' }).trim();
    if (out) return out.split('\n')[0].trim();
  } catch {}
  return null;
}

function setIconAndVersion(exePath) {
  const rcedit = findRcedit();
  if (!rcedit) {
    console.warn('[set-icon] 未找到 rcedit.exe，跳过');
    return false;
  }
  try {
    const cmds = [];
    if (fs.existsSync(iconPath)) {
      cmds.push(`--set-icon "${iconPath}"`);
    }
    cmds.push(
      `--set-version-string "FileDescription" "${productName}"`,
      `--set-version-string "ProductName" "${productName}"`,
      `--set-version-string "CompanyName" "${productName}"`,
      `--set-version-string "LegalCopyright" "${productName}"`,
      `--set-file-version "${version}"`,
      `--set-product-version "${version}"`
    );
    execSync(`"${rcedit}" "${exePath}" ${cmds.join(' ')}`, { stdio: 'inherit' });
    console.log(`[set-icon] 已设置图标和版本信息: ${path.basename(exePath)}`);
    return true;
  } catch (e) {
    console.error(`[set-icon] 设置失败: ${e.message}`);
    return false;
  }
}

// 1. win-unpacked 下的 exe（安装后的主程序）
const unpackedExe = path.join(distDir, 'win-unpacked', 'AI Hub.exe');
if (fs.existsSync(unpackedExe)) {
  setIconAndVersion(unpackedExe);
} else {
  // 兼容旧名称
  const oldUnpackedExe = path.join(distDir, 'win-unpacked', 'AI-Hub.exe');
  if (fs.existsSync(oldUnpackedExe)) setIconAndVersion(oldUnpackedExe);
}

console.log('[set-icon] 完成');
