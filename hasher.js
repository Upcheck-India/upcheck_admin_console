const crypto = require('crypto');
const readline = require('readline');
const bcrypt = require('bcrypt');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Hash the password inside an async function
async function hashPasswordWithBcrypt(password) {
    return await bcrypt.hash(password, 10);
}

function hashPassword(password) {
    return crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
}

console.log('Password Hashing Tool');
console.log('====================');

async function askPassword() {
    rl.question('\nEnter password to hash (or type "exit" to quit): ', async (password) => {
        if (password.toLowerCase() === 'exit') {
            rl.close();
            return;
        }

        const hashedPassword = hashPassword(password);
        const hashedPassword2 = await hashPasswordWithBcrypt(password); // Correct placement of await

        console.log('\nResults:');
        console.log('--------');
        console.log('Original password:', password);
        console.log('Bcrypt Hashed password: ', hashedPassword2); // Corrected output label
        
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