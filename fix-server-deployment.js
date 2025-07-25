#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 eZhishi Chatbot 服务器部署修复工具');
console.log('='.repeat(50));

// 检查 package.json
function checkPackageJson() {
  console.log('\n📋 检查 package.json...');
  
  try {
    const packagePath = path.join(__dirname, 'package.json');
    const packageData = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageData);
    
    if (packageJson.type === 'module') {
      console.log('✅ package.json 已正确配置 ES Module');
    } else {
      console.log('❌ package.json 缺少 "type": "module"');
      console.log('   当前配置:', packageJson.type || 'undefined');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('❌ 无法读取 package.json:', error.message);
    return false;
  }
}

// 检查关键文件是否使用 ES Module 语法
function checkESModuleSyntax() {
  console.log('\n🔍 检查 ES Module 语法...');
  
  const filesToCheck = [
    'server.js',
    'semantic-search.js',
    'related-questions.js',
    'related-faq.js',
    'email-service.js',
    'faq-search.js'
  ];
  
  let allGood = true;
  
  for (const file of filesToCheck) {
    try {
      const filePath = path.join(__dirname, file);
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  文件不存在: ${file}`);
        continue;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 检查是否使用 import 语句
      const hasImport = content.includes('import ');
      const hasRequire = content.includes('require(');
      
      if (hasImport && !hasRequire) {
        console.log(`✅ ${file} - 使用 ES Module 语法`);
      } else if (hasRequire && !hasImport) {
        console.log(`❌ ${file} - 仍使用 CommonJS 语法`);
        allGood = false;
      } else if (hasImport && hasRequire) {
        console.log(`⚠️  ${file} - 混合语法（需要检查）`);
        allGood = false;
      } else {
        console.log(`ℹ️  ${file} - 无导入语句`);
      }
    } catch (error) {
      console.log(`❌ 无法读取 ${file}:`, error.message);
      allGood = false;
    }
  }
  
  return allGood;
}

// 检查 Node.js 版本
function checkNodeVersion() {
  console.log('\n🟢 检查 Node.js 版本...');
  
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split('.')[0]);
  
  console.log(`当前 Node.js 版本: ${version}`);
  
  if (majorVersion >= 16) {
    console.log('✅ Node.js 版本支持 ES Module');
    return true;
  } else {
    console.log('❌ Node.js 版本过低，需要 >= 16.0.0');
    return false;
  }
}

// 创建修复脚本
function createFixScript() {
  console.log('\n🔧 创建修复脚本...');
  
  const fixScript = `#!/bin/bash

echo "🔧 修复 eZhishi Chatbot ES Module 配置..."

# 备份当前 package.json
if [ -f package.json ]; then
    cp package.json package.json.backup
    echo "✅ 已备份 package.json"
fi

# 创建正确的 package.json
cat > package.json << 'EOF'
{
  "name": "ezhishi-chatbot",
  "version": "1.0.0",
  "description": "eZhishi FAQ Chatbot",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "share": "npx ngrok http 3000"
  },
  "dependencies": {
    "@xenova/transformers": "^2.15.0",
    "compromise": "^14.14.4",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "franc": "^6.2.0",
    "fuse.js": "^7.1.0",
    "natural": "^6.12.0",
    "nodemailer": "^7.0.5",
    "sqlite": "^5.1.1",
    "sqlite3": "^5.1.7",
    "string-similarity": "^4.0.4"
  },
  "devDependencies": {
    "ngrok": "^4.3.3",
    "nodemon": "^3.0.1"
  }
}
EOF

echo "✅ 已更新 package.json"

# 重新安装依赖
echo "📦 重新安装依赖..."
npm install

echo "✅ 修复完成！"
echo "🚀 现在可以运行: node server.js"
`;

  fs.writeFileSync('fix-es-module.sh', fixScript);
  fs.chmodSync('fix-es-module.sh', '755');
  
  console.log('✅ 已创建修复脚本: fix-es-module.sh');
  console.log('   在服务器上运行: ./fix-es-module.sh');
}

// 主函数
function main() {
  const packageOk = checkPackageJson();
  const syntaxOk = checkESModuleSyntax();
  const nodeOk = checkNodeVersion();
  
  console.log('\n📊 检查结果:');
  console.log(`package.json: ${packageOk ? '✅' : '❌'}`);
  console.log(`ES Module 语法: ${syntaxOk ? '✅' : '❌'}`);
  console.log(`Node.js 版本: ${nodeOk ? '✅' : '❌'}`);
  
  if (packageOk && syntaxOk && nodeOk) {
    console.log('\n🎉 所有检查通过！可以正常运行。');
    console.log('运行命令: node server.js');
  } else {
    console.log('\n⚠️  发现问题，需要修复。');
    createFixScript();
    
    console.log('\n📋 手动修复步骤:');
    console.log('1. 确保 package.json 包含 "type": "module"');
    console.log('2. 确保所有 .js 文件使用 import 语法');
    console.log('3. 确保 Node.js 版本 >= 16.0.0');
    console.log('4. 重新安装依赖: npm install');
  }
}

// 运行检查
main(); 