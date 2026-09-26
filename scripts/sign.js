// 空签名脚本：跳过代码签名，但保留 rcedit 图标嵌入
// 通过 WIN_CSC_LINK=false 环境变量阻止 electron-builder 实际签名
module.exports = function () {
  return Promise.resolve();
};
