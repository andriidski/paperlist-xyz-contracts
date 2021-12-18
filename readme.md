Contracts and deploy scripts for `rinkeby.paperlist.xyz` & `xdai.paperlist.xyz`. Notes:

- `npx hardhat compile` to compile all contracts + typings via typechain
- `npx hardhat test` to run all tests
- `npx hardhat run scripts/deploy.ts --network <network to deploy to>` to deploy contracts to a given network from `HardhatUserConfig`