let env = require('./env');
let WalletProvider = require('truffle-wallet-provider');
let Wallet = require('ethereumjs-wallet');

let devnet = env.devnet;
let testnet = env.testnet;
let mainnet = env.mainnet;

let devnetWallet = Wallet.fromPrivateKey(new Buffer(devnet.privateKey, 'hex'));
let devnetProvider = new WalletProvider(devnetWallet, devnet.web3Url);

let testnetWallet = Wallet.fromPrivateKey(new Buffer(testnet.privateKey, 'hex'));
let testnetProvider = new WalletProvider(testnetWallet, testnet.web3Url);

let mainnetWallet = Wallet.fromPrivateKey(new Buffer(mainnet.privateKey, 'hex'));
let mainnetProvider = new WalletProvider(mainnetWallet, mainnet.web3Url);

module.exports = {
  solc: {
    optimizer: {
        enabled: true,
        runs: 200
    }
  },
  networks: {
    development: {
      provider: devnetProvider,
      port: 8545,
      network_id: '*',
      gas: 4700000
    },
    testnet: {
      provider: testnetProvider,
      network_id: 4
    },
    mainnet: {
      provider: mainnetProvider,
      network_id: 1
    }
  }
}