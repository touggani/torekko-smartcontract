import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import { HardhatUserConfig } from "hardhat/types";

import "hardhat-docgen";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-typechain";
import "solidity-coverage";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-abi-exporter";

// const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
// const ROPSTEN_PRIVATE_KEY = process.env.ROPSTEN_PRIVATE_KEY || "";
// const RINKEBY_PRIVATE_KEY = process.env.RINKEBY_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
// const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    paths: {
        sources: "./contracts",
    },
    solidity: {
        compilers: [
            {
                version: "0.7.6",
                settings: {
                    outputSelection: {
                        "*": {
                            "*": ["storageLayout"],
                        },
                    },
                    optimizer: { enabled: true, runs: 1 },
                },
            },
        ],
    },
    networks: {
        hardhat: {
            gas: 12000000,
            blockGasLimit: 0x1fffffffffffff,
            allowUnlimitedContractSize: true,
        },
        localhost: {
            url: "http://127.0.0.1:7545",
        },
        // ropsten: {
        //   url: `https://ropsten.infura.io/v3/${INFURA_API_KEY}`,
        //   accounts: [ROPSTEN_PRIVATE_KEY],
        // },
        // rinkeby: {
        //   url: `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`,
        //   accounts: [RINKEBY_PRIVATE_KEY],
        // },
    },
    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
        apiKey: ETHERSCAN_API_KEY,
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v5",
    },
    docgen: {
        path: "./docs",
        clear: true,
        runOnCompile: true,
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: true,
        disambiguatePaths: false,
    },
    gasReporter: {
        enabled: true, // turn to false if not needed to make mocha faster
        gasPrice: 21,
        coinmarketcap: COINMARKETCAP_API_KEY,
        showTimeSpent: true,
    },
    abiExporter: {
        path: './data/abi',
        clear: true,
        flat: true,
        spacing: 2,
        pretty: true,
    },
};

export default config;
