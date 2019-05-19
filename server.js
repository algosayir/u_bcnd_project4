const bitcoinMessage = require('bitcoinjs-message');
const express = require('express');
const bodyParser = require('body-parser');
const hex2ascii = require('hex2ascii');

const myBlockChain = require('./blockChain')();
const Block = require('./block');

const port = 8000;

// initialize express app
const app = express();

// use body parser to to enable JSON body to be presented in request object
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

let mempool = {};
let timeoutRequests = {};
let mempoolValid = {};
const timeoutRequestsWindowTime = 5*60*1000;//min*sec*milis

// Blockchain ID validation routine
// Add Request Validation
app.post('/requestValidation',(req,res)=>{

    //This will cover all requested scenarios
    if(!req.body.address){ 
        res.status(400).json('Error. Please provide address.');
    }else{
        
        // Add address to mempool
        let o = null;

        if(!mempool[req.body.address]){
            console.log('add validatation request.');
            o = addRequestValidation(req.body.address);
        } else{
            console.log('retrive exsiting validation request.');
            o = mempool[req.body.address];
        }
        
        let result = {
            walletAddress: req.body.address,
            requestTimeStamp: o.timestamp,
            message: o.message,
            validationWindow: calacuateValidationWindow(req.body.address)
        };

        res.json(result).status(200);
    }
});

function calacuateValidationWindow(address){
    let timeElapse = (new Date().getTime().toString().slice(0,-3)) - mempool[address].timestamp;
    let timeLeft = (timeoutRequestsWindowTime/1000) - timeElapse;
    return timeLeft;
}
function addRequestValidation(address){
    let t = new Date().getTime().toString().slice(0,-3);
    let o = { 
        isAdded:true,
        timestamp:t,
        message: address+':'+t+':'+'starRegistry'
    };
    mempool[address] = o;
    setTimeOut(address);
    return o;
}

function setTimeOut(address){
    timeoutRequests[address] = setTimeout(() => {
        console.log(address,': Time\'s up.');
        clearSession(address);
    },timeoutRequestsWindowTime);
}

function clearSession(address){
    delete mempool[address];
    delete mempoolValid[address];
    delete timeoutRequests[address];
    console.log(address,' session is cleared. User cannot add block until request validation and signature verfication are performed.')
}

function validateRequestByWallet(address,signature){
    let message = mempool[address].message;

    let isValid = bitcoinMessage.verify(message, address, signature);
    let result = {
        registerStar: true,
        status: {
            address: address,
            requestTimeStamp: mempool[address].timestamp,
            message: mempool[address].message,
            validationWindow: calacuateValidationWindow(address),
            messageSignature: isValid
        }
    };

    mempoolValid[address]=result;

    console.log(address + ' signature is valid:'+isValid);
    return result;
}

// message-signature/validate
app.post('/message-signature/validate',(req,res)=>{

    //This will cover all requested scenarios
    if(!req.body.address || !req.body.signature){ 
        res.status(400).json('Error. Please provide address and signature.');
    }else{
        
        // perform message-signature/validate
        // Verify time left: If address exist on mempool this means still time is available
        if(!mempool[req.body.address]){
            console.log('Error. Post /requestValidation first.');
            res.status(400).json('Error. Post /requestValidation first.');
        } else{
            //BitcoinMessage.verify
            let result = validateRequestByWallet(req.body.address,req.body.signature);
        
            res.json(result).status(200);
        }

    }
});



// Star registration Endpoint
app.post('/block',(req,res)=>{

    // request format
    // {
    //     address: req.body.address,
    //     star: {
    //                 dec: "68° 52' 56.9",
    //                 ra: "16h 29m 1.0s",
    //                 story: "Found star using https://www.google.com/sky/"
    //     }
    // };

    // This will cover all requested scenarios
    if(!req.body.address || !req.body.star || !req.body.star.dec || !req.body.star.ra || !req.body.star.story){ 
        res.status(400).json('Error. Please provide proper request.');
    }else{
        if(!mempool[req.body.address] || !mempoolValid[req.body.address]){
            console.log('Error. Post /requestValidation and /message-signature/validate first.');
            res.status(400).json('Error. Post /requestValidation and /message-signature/validate first.');
        } else{

            let body = {
                address: req.body.address,
                star: {
                      ra: req.body.star.ra,
                      dec: req.body.star.dec,
                      story: Buffer.from(req.body.star.story).toString('hex')
                }
            };

            console.log(body);

            let block = new Block(body);

            myBlockChain.addBlock(block).then((addedBlock)=>{
                console.log(addedBlock);
                clearSession(addedBlock.body.address);
                
                res.json(getResultBlock(addedBlock)).status(200);
            }).catch((err)=>{
                console.log('Errorrrrrrrrrrrrrr\n'+err+'\n-------------------------');
                res.end('Error').status(400);
            });
        }
    }
});

function getResultBlock(addedBlock){
    console.log('addedBlock=\n',addedBlock);
    return {
        hash : addedBlock.hash,
        height : addedBlock.height,
        body : {
            address : addedBlock.body.address,
            star : {
                ra: addedBlock.body.star.ra,
                dec: addedBlock.body.star.dec,
                story: addedBlock.body.star.story,
                storyDecoded: hex2ascii(addedBlock.body.star.story)
            }
        },
        time: addedBlock.time,
        previousBlockHash: addedBlock.previousBlockHash
    };
}

// Star Lookup
// By hash 
app.get('/stars/hash=:HASH',(req,res)=>{
    let bhash = req.params.HASH;
    console.log(bhash);
    
    myBlockChain.getBlockByHash(bhash).then((block)=>{
        res.header('content-type','application/json');
        res.json(getResultBlock(block)).status(200);
    }).catch((err)=>{
        console.log('Errorrrrrrrrrrrrrr\n'+err+'\n-------------------------');
        res.status(400).end('Error');
    });

});

// By address 
app.get('/stars/address=:ADDRESS',(req,res)=>{
    let baddress = req.params.ADDRESS;
    console.log(baddress);

    myBlockChain.getBlockByWalletAddress(baddress).then((blocks)=>{
        let resultBlocks = [];
        blocks.forEach(function(value){
            resultBlocks.push(getResultBlock(value));
        });
        res.header('content-type','application/json');
        res.json(resultBlocks).status(200);
    }).catch((err)=>{
        console.log('Errorrrrrrrrrrrrrr\n'+err+'\n-------------------------');
        res.status(400).end('Error');
    });

});

// By height 
app.get('/block/:height',(req,res)=>{
    let bh = req.params.height;
    
    myBlockChain.getBlock(bh).then((block)=>{
        res.header('content-type','application/json');
        res.json(getResultBlock(block)).status(200);
    }).catch((err)=>{
        console.log('Errorrrrrrrrrrrrrr\n'+err+'\n-------------------------');
        res.status(400).end('Error');
    });

});


// start express app
app.listen(port,()=> console.log('server is up'));