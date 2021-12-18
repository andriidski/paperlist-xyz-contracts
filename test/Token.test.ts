import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import { ReadPaperToken } from "../typechain-types/ReadPaperToken";
import { PaperReadingList } from "../typechain-types/PaperReadingList";

let tokenContract: ReadPaperToken;
let dappContract: PaperReadingList;
let owner: SignerWithAddress;

describe("ReadPaperToken", () => {

    beforeEach(async () => {
        [owner] = await ethers.getSigners();

        // First deploy the token contract.
        const TokenContract: ContractFactory = await ethers.getContractFactory("ReadPaperToken");
        tokenContract = (await TokenContract.connect(owner).deploy(0)) as ReadPaperToken;
        await tokenContract.deployed();

        // Now deploy the contract that manages the dApp. The constructor of the dApp
        // contract expects an address to the deployed token contract which we could 
        // get since the token contract has already been deployed.
        const DappContract: ContractFactory = await ethers.getContractFactory("PaperReadingList");
        dappContract = (await DappContract.connect(owner).deploy(tokenContract.address)) as PaperReadingList;
        await dappContract.deployed();

        // Now call a function on the token contract telling it where the dApp contract is deployed,
        // such that it knows to accept transactiosn from there. This needs to be called from the
        // address which deployed the Token contract.
        await tokenContract.connect(owner).setPaperReadingListContract(dappContract.address);
    });

    it("both the token contract and dApp contract should get deployed correctly", async () => {
        expect(tokenContract.address).to.not.be.null;
        expect(dappContract.address).to.not.be.null;
    });
});
