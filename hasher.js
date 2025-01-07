// interactive-hasher.js
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function hashPassword(password) {
    return crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
}

console.log('Password Hashing Tool');
console.log('====================');

function askPassword() {
    rl.question('\nEnter password to hash (or type "exit" to quit): ', (password) => {
        if (password.toLowerCase() === 'exit') {
            rl.close();
            return;
        }

        const hashedPassword = hashPassword(password);
        console.log('\nResults:');
        console.log('--------');
        console.log('Original password:', password);
        console.log('Hashed password:  ', hashedPassword);
        
        // MongoDB document format
        console.log('\nMongoDB Format:');
        console.log('---------------');
        console.log(JSON.stringify({
            username: "admin", // Replace with your desired username
            password: hashedPassword
        }, null, 2));

        askPassword(); // Ask for another password
    });
}

askPassword();

rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
});