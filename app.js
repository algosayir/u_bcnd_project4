let address = 'aboc';

let mempool = {};
let timeRequest = {};

mempool[address] = { 
    isAdded:true,
    timestamp:new Date().getTime().toString().slice(0,-3)
};

timeRequest = setTimeout(() => {
    console.log(address,': Time\'s up.');
    delete mempool[address];
},1000);

console.log(mempool[address].isAdded);
console.log(mempool[address]);