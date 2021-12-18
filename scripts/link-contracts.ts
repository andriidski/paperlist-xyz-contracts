import { ethers } from "hardhat";

// Does the same thing that the main deploy script does but in case something craps out, can call this.
const linkTx = async (tokenContractAddress: string, dappContractAddress: string) => {
    // Attach to an instance of Token contract.
    const TokenContract = await ethers.getContractFactory("ReadPaperToken");
    const tokenContract = TokenContract.attach(tokenContractAddress);

    // Attach to an instance of dApp contract.
    const DappContract = await ethers.getContractFactory("PaperReadingList");
    const contract = DappContract.attach(dappContractAddress);

    // Connect the dApp contract to the token contract.
    await tokenContract.setPaperReadingListContract(contract.address);
    console.log(`Connected Token contract to Dapp contract`);
}

linkTx(process.argv[1], process.argv[2])
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
