import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const INFURA_API_KEY = process.env.INFURA_API_KEY;
const DEPLOYER_PK = process.env.DEPLOYER_PK;

if (!DEPLOYER_PK) {
  console.log('DEPLOYER_PK env variable needed to deploy');
  process.exit(1);
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [`0x${DEPLOYER_PK}`],
      gasPrice: 'auto',
    },
    xdai: {
      url: 'https://rpc.xdaichain.com/',
      chainId: 100,
      accounts: [`0x${DEPLOYER_PK}`],
      gasPrice: 'auto',
    }
  },
};

export default config;
