import { ethers } from "hardhat";

const deploy = async () => {
  const [deployer] = await ethers.getSigners();

  console.log(`Deploying contracts from deployer account: ${deployer.address}`);
  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  // First deploy the token contract.
  const TokenContract = await ethers.getContractFactory("ReadPaperToken");
  const tokenContract = await TokenContract.deploy(0);
  console.log(`Step 1: Deployed the Token contract to: ${tokenContract.address}`);

  const DappContract = await ethers.getContractFactory("PaperReadingList");
  const contract = await DappContract.deploy(tokenContract.address);
  console.log(`Step 2: Deployed the main dApp contract to: ${contract.address}`);

  // Connect the dApp contract to the token contract.
  await tokenContract.setPaperReadingListContract(contract.address);
  console.log(`Step 3: Connected Token contract to dApp contract`);
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
