const fs = require('fs');
let content = fs.readFileSync('orders.html', 'utf8');

// Split into lines and process
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    // Remove the 6-digit validation
    if (lines[i].includes("if (!/^\\d{6}$/.test(adminPassword))")) {
        lines[i] = ''; // Remove this line
        // Also remove the next 3 lines (showNotification, return, })
        lines[i+1] = '';
        lines[i+2] = '';
        lines[i+3] = '';
    }
    // Update comments
    if (lines[i].includes('Delete order with TOTP verification')) {
        lines[i] = lines[i].replace('Delete order with TOTP verification', 'Delete order with admin password');
    }
    if (lines[i].includes('Prompt for TOTP code')) {
        lines[i] = lines[i].replace('Prompt for TOTP code', 'Prompt for admin password');
    }
}

content = lines.join('\n');
fs.writeFileSync('orders.html', content);
console.log('Fixed orders.html');
