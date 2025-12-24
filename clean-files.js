const fs = require('fs');
const path = require('path');

const files = ['activate.js', 'buy.js', 'spawn.js'];
const commandsDir = './plugins'; 

files.forEach(file => {
    const filePath = path.join(commandsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    
    content = content.replace(/^\uFEFF/, '');
    content = content.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file} limpiado`);
});
