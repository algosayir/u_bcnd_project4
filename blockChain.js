const Block = require('./block');
const SHA256 = require('crypto-js/sha256');

const level = require('level');

const chainDB = './myChainData';
const db = level(chainDB);

// Add data to levelDB with key/value pair
function addLevelDBData(key,value){
  return new Promise((resolve,reject)=>{
      db.put(key, value, function(err) {
          if (err) reject(err);
          
          resolve(JSON.parse(value));
      })
  });
}

//retrieve current block height within the LevelDB chain.  
function getBlockHeightDB() {
  return new Promise((resolve,reject)=>{
      let i = 0;
      db.createReadStream().on('data', function(data) {
            i++;
          }).on('error', function(err) {
              reject(err);
          }).on('close', function() {
            resolve(i);
          });
  })
}

// Get data from levelDB with key with promise
function getLevelDBData(key){
  return new Promise((resolve, reject) => {
    db.get(key, function(err, value) {
        if (err) reject(err); 
        resolve(value);
    });
  })
}

class BlockChain{
    constructor(){
      let self = this;
      this.getBlockHeight().then((h)=>{
        if(h==-1)
          self.addBlock(new Block("First block in the chain - Genesis block"));
      });
    }

    // Get block height
    async getBlockHeight(){
        return (await getBlockHeightDB())-1;
    }
      
    
    // Add new block
    async addBlock(newBlock){
      let h = await this.getBlockHeight();

        //increase h
        h++;
        console.log('h='+h);
        // Block height
        newBlock.height = h;
        // UTC timestamp
        newBlock.time = new Date().getTime().toString().slice(0,-3);
        // previous block hash
        if(h>0){
            let pBlock = await this.getBlock(h-1);
            newBlock.previousBlockHash = pBlock.hash;
            console.log('pBlock='+pBlock);

            console.log('newBlock.previousBlockHash='+newBlock.previousBlockHash);

            // Block hash with SHA256 using newBlock and converting to a string
            newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
            //Add to LevelDB
            return addLevelDBData(h, JSON.stringify(newBlock).toString());
        } else {
            // Block hash with SHA256 using newBlock and converting to a string
            newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
            //Add to LevelDB
            return addLevelDBData(h, JSON.stringify(newBlock).toString());
        }
    }
  
      // get block
      async getBlock(blockHeight){
        // return object as a single string
        return JSON.parse(await getLevelDBData(blockHeight));
      }
  
      // Get block by hash
   getBlockByHash(hash) {
    let self = this;
    let block = null;
    return new Promise(function(resolve, reject){
        db.createReadStream()
        .on('data', function (data) {
            console.log(data.value);
            let b = JSON.parse(data.value);
            if(b.hash === hash){
                block = b;
            }
        })
        .on('error', function (err) {
            reject(err)
        })
        .on('close', function () {
            resolve(block);
        });
    });
  }

  getBlockByWalletAddress(address){
    let blocks = [];
    return new Promise(function(resolve, reject){
        db.createReadStream()
        .on('data', function (data) {
            console.log(data.value);
            let b = JSON.parse(data.value);
            if(b.body.address === address){
                blocks.push(b);
            }
        })
        .on('error', function (err) {
            reject(err)
        })
        .on('close', function () {
            resolve(blocks);
        });
    });

  }
      // validate block
      async validateBlock(blockHeight){
        let block = await this.getBlock(blockHeight);
        // get block hash
        let blockHash = block.hash;
        // remove block hash to test block integrity
        block.hash = '';
        // generate block hash
        let validBlockHash = SHA256(JSON.stringify(block)).toString();
        // Compare
        if (blockHash===validBlockHash) {
          return true;
        } else {
          console.log('Block #'+blockHeight+' invalid hash:\n'+blockHash+'<>'+validBlockHash);
          return false;
        }
      }
      
  
    // Validate blockchain
    async validateChain(){
      let h = await this.getBlockHeight();
      let errorLog = [];
      for (var i = 0; i <= h; i++) {
        // validate block
        let isValid = await this.validateBlock(i);
        if(!isValid){
          //console.log('invalid block # '+i);
          errorLog.push(i);
        }

        //if i is not the last block
        if(i!==h){
          // compare blocks hash link
          let block = await this.getBlock(i);
          let nextBlock = await this.getBlock(i+1);
          if (block.hash!==nextBlock.previousBlockHash) {
            errorLog.push(i);
            //console.log('broken link between block # '+i + ' and ' +(i+1));
          }
        }
      }

      if (errorLog.length>0) {
        console.log('Block errors = ' + errorLog.length);
        console.log('Blocks: '+errorLog);
      } else {
        console.log('No errors detected');
      }
    }
}

module.exports = () => new BlockChain();