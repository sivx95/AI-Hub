// afterPack 钩子：在打包 exe 之后、NSIS 安装包构建之前设置图标和版本信息
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = async function (context) {
  const appDir = context.appOutDir;
  const rootDir = path.resolve(__dirname, '..');
  const iconPath = path.join(rootDir, 'icon.ico');

  // 找到 rcedit
  const rceditX64 = path.join(rootDir, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');
  const rceditDefault = path.join(rootDir, 'node_modules', 'rcedit', 'bin', 'rcedit.exe');
  let rcedit = null;
  if (fs.existsSync(rceditX64)) rcedit = rceditX64;
  else if (fs.existsSync(rceditDefault)) rcedit = rceditDefault;

  if (!rcedit) {
    console.log('[afterPack] rcedit not found, skipping');
    return;
  }

  // 找到 exe 文件
  const files = fs.readdirSync(appDir);
  const exeFile = files.find(f => f.endsWith('.exe'));
  if (!exeFile) {
    console.log('[afterPack] no exe found in', appDir);
    return;
  }

  const exePath = path.join(appDir, exeFile);
  const packageJsonPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const version = pkg.version || '1.0.0';
  const productName = pkg.build?.productName || pkg.name || 'AI Hub';

  try {
    // 设置图标
    if (fs.existsSync(iconPath)) {
      execSync(`"${rcedit}" "${exePath}" --set-icon "${iconPath}"`, { stdio: 'inherit' });
      console.log(`[afterPack] icon set: ${exeFile}`);
    }
    // 设置版本信息（任务管理器描述列等位置显示 AI Hub）
    execSync(`"${rcedit}" "${exePath}" --set-version-string "FileDescription" "${productName}" --set-version-string "ProductName" "${productName}" --set-version-string "CompanyName" "${productName}" --set-version-string "LegalCopyright" "${productName}" --set-file-version "${version}" --set-product-version "${version}"`, { stdio: 'inherit' });
    console.log(`[afterPack] version info set: ${exeFile}`);
  } catch (e) {
    console.error(`[afterPack] failed: ${e.message}`);
  }
};
