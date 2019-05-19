const bitcoin = require('bitcoinjs-lib');
const bitcoinMessage = require('bitcoinjs-message');

let address = '1PxaoNbjiV7Xgh1JwFK9zsBVm9xL3icSF6'
let signature = 'H5+r4PJ6kxUWSMYam0wS4MiXZQErDeWnpOfcWhk6rfczRDMql9/tL66PLHVJLMIAKWvSUbbWY66Pm+1ctbx65Z4='
let message = '1PxaoNbjiV7Xgh1JwFK9zsBVm9xL3icSF6: Hi'

console.log(bitcoinMessage.verify(message, address, signature))