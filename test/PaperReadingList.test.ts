import { expect } from "chai";
import { ethers } from 'hardhat';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { ReadPaperToken } from "../typechain-types/ReadPaperToken";
import { PaperReadingList } from "../typechain-types/PaperReadingList";

const solidityKeccak256 = ethers.utils.solidityKeccak256;

let tokenContract: ReadPaperToken;
let contract: PaperReadingList;
let owner: SignerWithAddress;
let addr1: SignerWithAddress;
let addr2: SignerWithAddress;

interface Paper {
  url: string;
  name: string;
  tags: string[];
}

describe("PaperReadingList", () => {

  const BitcoinPaper: Paper = {
    url: 'https://bitcoin.org/bitcoin.pdf',
    name: 'Bitcoin: A Peer-to-Peer Electronic Cash System',
    tags: ['block', 'transaction', 'network']
  }

  const EthereumPaper: Paper = {
    url: 'https://blockchainlab.com/pdf/Ethereum_white_paper-a_next_generation_smart_contract_and_decentralized_application_platform-vitalik-buterin.pdf',
    name: 'Ethereum White Paper',
    tags: ['ethereum', 'transaction', 'contract']
  }

  const sendAddPaperTx = async (paper: Paper): Promise<void> => {
    const addPaperTx = await contract.addPaper(
      paper.url, paper.name, paper.tags
    );
    await addPaperTx.wait();
  }

  const computePaperHash = (paper: Paper): string => {
    return solidityKeccak256(['string'], [paper.url]);
  }

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // First deploy the token contract.
    const TokenContract = await ethers.getContractFactory("ReadPaperToken");
    tokenContract = (await TokenContract.connect(owner).deploy(0)) as ReadPaperToken;
    await tokenContract.deployed();

    const Contract = await ethers.getContractFactory("PaperReadingList");
    contract = (await Contract.connect(owner).deploy(tokenContract.address)) as PaperReadingList;
    await contract.deployed();

    // Connect the dApp contract to the token contract.
    await tokenContract.connect(owner).setPaperReadingListContract(contract.address);
  });

  it("adding a new paper should update state correctly", async () => {
    // Take an example paper to add.
    const paperToAdd = BitcoinPaper;
    await sendAddPaperTx(paperToAdd);

    // Check that the paper was added to reading list of the account that
    // added the paper.
    const papers = await contract.getPapers();
    // Reading list should only have this one paper.
    expect(papers.length).to.equal(1);
    const paper = papers[0];
    expect(paper.name).to.equal(paperToAdd.name);

    // Check that the paper was added to the paper mapping state correctly.
    // Compute the hash of the paper URL.
    // Mimic how Solidity encodes the string.
    const paperHash = computePaperHash(paperToAdd);
    const paperData = await contract.getPaperByHash(paperHash);

    expect(paperData.name).to.equal(paper.name);
    expect(paperData.url).to.equal(paper.url);
    expect(paperData.tags).deep.equal(paper.tags);
    expect(paperData.creator).to.equal(owner.address);

    // Expected that the 'readBy' count should be at 1.
    expect(paperData.readBy).to.equal(1);
  });

  it("adding a paper that already has been added should fail", async () => {
    const paperToAdd = BitcoinPaper;

    // Send a tx to add a new paper.
    await sendAddPaperTx(paperToAdd);

    // Try to add the same paper a second time.
    await expect(
      contract.addPaper(
        paperToAdd.url, paperToAdd.name, paperToAdd.tags
      )
    ).to.be.reverted;
  });

  it("adding a paper with number of tags outside the valid range should fail", async () => {
    let paper: Paper = {
      url: 'paper1',
      name: 'paper1',
      tags: []
    };

    await expect(sendAddPaperTx(paper)).to.be.reverted;

    paper = {
      url: 'paper2',
      name: 'paper2',
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
    };

    await expect(sendAddPaperTx(paper)).to.not.be.reverted;

    paper = {
      url: 'paper3',
      name: 'paper3',
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6']
    };

    await expect(sendAddPaperTx(paper)).to.be.reverted;
  });

  it("adding and removing papers from reading list should update the readBy count", async () => {
    const paperToAdd = BitcoinPaper;
    // Send a tx to add a new paper.
    await sendAddPaperTx(paperToAdd);

    // Have a few different accounts add this paper to their reading lists.
    const paperHash = computePaperHash(paperToAdd);

    await contract.connect(addr1).addPaperToReadingList(paperHash);
    await contract.connect(addr2).addPaperToReadingList(paperHash);

    // Fetch the paper data and check the readBy count.
    let paperData = await contract.getPaperByHash(paperHash);
    expect(paperData.readBy).to.equal(3);

    // Remove a papers from a single reading list.
    await contract.connect(addr1).removePaperFromReadingList(paperHash);

    paperData = await contract.getPaperByHash(paperHash);
    expect(paperData.readBy).to.equal(2);
  });

  it("adding a paper to reading list that is already in reading list should fail", async () => {
    const paperToAdd = BitcoinPaper;
    await sendAddPaperTx(paperToAdd);

    const paperHash = computePaperHash(paperToAdd);
    await contract.connect(addr1).addPaperToReadingList(paperHash);
    await contract.connect(addr2).addPaperToReadingList(paperHash);

    // If one of the addresses tries to add the same paper to their reading list,
    // the tx should fail.
    await expect(contract.connect(addr2).addPaperToReadingList(paperHash)).to.be.reverted;
  });

  it("adding a paper to reading list that is not yet added to contract should fail", async () => {
    await sendAddPaperTx(BitcoinPaper);

    // If a paper has not been yet added to the contract, then adding that hash to the reading
    // list should fail.
    const secondPaperHash = computePaperHash(EthereumPaper);
    await expect(contract.connect(addr2).addPaperToReadingList(secondPaperHash)).to.be.reverted;
  });

  it("addPaperToReadingList() should update the reading list correctly", async () => {
    await sendAddPaperTx(BitcoinPaper);
    await sendAddPaperTx(EthereumPaper);

    await contract
      .connect(addr2)
      .addPaperToReadingList(computePaperHash(BitcoinPaper));
    await contract
      .connect(addr2)
      .addPaperToReadingList(computePaperHash(EthereumPaper));

    await contract
      .connect(addr1)
      .addPaperToReadingList(computePaperHash(EthereumPaper));

    // Get the reading lists from every account.
    const ownerList = await contract.getPapersForAccount(owner.address);
    expect(ownerList.length).to.equal(2);

    const addr2List = await contract.getPapersForAccount(addr2.address);
    expect(addr2List.length).to.equal(2);
    expect(ownerList).to.deep.equal(addr2List);

    const addr1List = await contract.getPapersForAccount(addr1.address);
    expect(addr1List.length).to.equal(1);
  });

  it("removing a paper from a reading list when it's already not in the list should fail", async () => {
    const paperToAdd = BitcoinPaper;
    await sendAddPaperTx(paperToAdd);

    const paperHash = computePaperHash(paperToAdd);
    // Add to reading list.
    await contract.connect(addr1).addPaperToReadingList(paperHash);
    // Remove from the reading list.
    await contract.connect(addr1).removePaperFromReadingList(paperHash);
    // Removing from 'addr1' reading list should fail since we just removed the paper.
    await expect(contract.connect(addr1).removePaperFromReadingList(paperHash)).to.be.reverted;
  });

  it("removing a paper from reading list that is not yet added to contract should fail", async () => {
    await sendAddPaperTx(BitcoinPaper);

    const secondPaperHash = computePaperHash(EthereumPaper);
    await expect(contract.connect(addr2).removePaperFromReadingList(secondPaperHash)).to.be.reverted;
  });

  it("removePaperFromReadingList() should update the reading list correctly", async () => {
    // Add a few papers to the contract.
    await sendAddPaperTx(BitcoinPaper);
    await sendAddPaperTx(EthereumPaper);

    await contract
      .connect(addr2)
      .addPaperToReadingList(computePaperHash(BitcoinPaper));
    await contract
      .connect(addr2)
      .addPaperToReadingList(computePaperHash(EthereumPaper));

    await contract
      .connect(addr1)
      .addPaperToReadingList(computePaperHash(EthereumPaper));

    // Get the reading lists from every account.
    const ownerList = await contract.getPapersForAccount(owner.address);
    expect(ownerList.length).to.equal(2);

    await contract.connect(addr2).removePaperFromReadingList(computePaperHash(BitcoinPaper));
    const addr2List = await contract.getPapersForAccount(addr2.address);
    const addr1List = await contract.getPapersForAccount(addr1.address);

    expect(addr2List.length).to.equal(1);
    expect(addr1List.length).to.equal(1);

    expect(addr2List).to.deep.equal(addr1List);
    expect(addr2List).to.not.deep.equal(ownerList);
  });

  it("getPapers() and getPapersForAccount() should return equivalent lists for the same account", async () => {
    await sendAddPaperTx(BitcoinPaper);
    await sendAddPaperTx(EthereumPaper);

    const readingList1 = await contract.getPapers();
    const readingList2 = await contract.getPapersForAccount(owner.address);

    expect(readingList1).to.deep.equal(readingList2);
  });

  it("should be able to detect when a paper is new or has already been added", async () => {
    const bitcoinHash = computePaperHash(BitcoinPaper);
    const ethereumHash = computePaperHash(EthereumPaper);
    let paper;
    paper = await contract.getPaperByHash(bitcoinHash);
    expect(paper.url).to.equal('');

    await sendAddPaperTx(BitcoinPaper);
    paper = await contract.getPaperByHash(bitcoinHash);
    expect(paper.url).to.equal(BitcoinPaper.url);

    await sendAddPaperTx(EthereumPaper);
    paper = await contract.getPaperByHash(ethereumHash);
    expect(paper.url).to.equal(EthereumPaper.url);
  });

  it("pinned papers list should start empty", async () => {
    await sendAddPaperTx(BitcoinPaper);

    const pinnedPapers = await contract.getPinnedPapers();
    expect(pinnedPapers).to.deep.equal([]);
  });

  it("pinning a paper should update state correctly", async () => {
    // Adding the two papers means they will be in the creator address reading list.
    await sendAddPaperTx(BitcoinPaper);
    await sendAddPaperTx(EthereumPaper);

    // Pin both papers.
    let papersToPin = [computePaperHash(EthereumPaper), computePaperHash(BitcoinPaper)];
    await contract.editPinnedList([] /* papers to unpin */, papersToPin);

    // Check the pinned paper list.
    let pinnedPapers = await contract.getPinnedPapers();
    expect(pinnedPapers.length).to.equal(2);

    // Unpin one paper.
    let papersToUnpin = [computePaperHash(BitcoinPaper)];
    await contract.editPinnedList(papersToUnpin, [] /* papers to pin */);

    pinnedPapers = await contract.getPinnedPapers();
    expect(pinnedPapers.length).to.equal(1);
    expect(pinnedPapers[0].url).to.equal(EthereumPaper.url);

    // Pin one paper and unpin the other one.
    papersToPin = [computePaperHash(BitcoinPaper)];
    papersToUnpin = [computePaperHash(EthereumPaper)];

    // await contract.editPinnedList(papersToUnpin, papersToPin);
    await contract.editPinnedList(papersToUnpin, papersToPin)

    pinnedPapers = await contract.getPinnedPapers();
    expect(pinnedPapers.length).to.equal(1);
    expect(pinnedPapers[0].url).to.equal(BitcoinPaper.url);
  });

  it("pinning a paper should fail when paper is not in reading list", async () => {
    let papersToPin = [computePaperHash(BitcoinPaper)];

    // Should not be able to pin a paper that does not exist.
    await expect(contract.connect(addr1).editPinnedList([], papersToPin)).to.be.reverted;

    await sendAddPaperTx(BitcoinPaper);
    // Should not be able to pin a paper that is not in 'addr1' account
    // reading list.
    await expect(contract.connect(addr1).editPinnedList([], papersToPin)).to.be.reverted;
  });

  it("should not be able to unpin a paper that is not pinned", async () => {
    await sendAddPaperTx(BitcoinPaper);

    let papersToPin = [computePaperHash(BitcoinPaper)];
    await contract.editPinnedList([], papersToPin);

    // Should not be able to pin a paper that is not pinned.
    let papersToUnpin = [computePaperHash(EthereumPaper)];
    await expect(contract.editPinnedList(papersToUnpin, [])).to.be.reverted;
  });

  it("should not be able to pin a paper that is already pinned", async () => {
    await sendAddPaperTx(BitcoinPaper);

    let papersToPin = [computePaperHash(BitcoinPaper)];
    await contract.editPinnedList([], papersToPin);

    // Should not be able to pin a paper that is already pinned.
    await expect(contract.editPinnedList([], papersToPin)).to.be.reverted;
  });

  it("should not be able to pin more papers than the max", async () => {
    const papers = [
      {
        url: 'paper1',
        name: 'paper1',
        tags: ['tag']
      },
      {
        url: 'paper2',
        name: 'paper2',
        tags: ['tag']
      },
      {
        url: 'paper3',
        name: 'paper3',
        tags: ['tag']
      },
      {
        url: 'paper4',
        name: 'paper4',
        tags: ['tag']
      },
      {
        url: 'paper5',
        name: 'paper5',
        tags: ['tag']
      },
      {
        url: 'paper6',
        name: 'paper6',
        tags: ['tag']
      },
    ];

    for (let i = 0; i < papers.length; i++) {
      await sendAddPaperTx(papers[i]);
    }

    // Trying to pin all of the papers should not be allowed since it is over the max paper pinned limit (5).
    const pinPaperHashes = papers.map(paper => computePaperHash(paper));
    await expect(contract.editPinnedList([], pinPaperHashes)).to.be.reverted;
  });

  it("should not be able to unpin a paper from an empty pinned list", async () => {
    await sendAddPaperTx(BitcoinPaper);

    // Should not be able to unpin a paper from an empty pinned paper list.
    await expect(contract.editPinnedList([computePaperHash(BitcoinPaper)], [])).to.be.reverted;
  });

  it("removing a paper from reading list should remove it from pinned list as well", async () => {
    await sendAddPaperTx(BitcoinPaper);
    await sendAddPaperTx(EthereumPaper);

    await contract.connect(addr1).addPaperToReadingList(computePaperHash(BitcoinPaper));
    await contract.connect(addr1).addPaperToReadingList(computePaperHash(EthereumPaper));

    // Pin one paper.
    await contract.connect(addr1).editPinnedList([], [computePaperHash(EthereumPaper)]);

    let pinnedPapers = await contract.getPinnedPapersForAccount(addr1.address);
    expect(pinnedPapers.length).to.equal(1);
    expect(pinnedPapers[0].url).to.equal(EthereumPaper.url);

    // Remove the paper from the reading list.
    await contract.connect(addr1).removePaperFromReadingList(computePaperHash(EthereumPaper));

    // Removing the paper from reading list should have also removed it from the account's 
    // pinned list.
    pinnedPapers = await contract.getPinnedPapersForAccount(addr1.address);
    expect(pinnedPapers.length).to.equal(0);
  });

  it("getPinnedPapers() and getPinnedPapersForAccount() should return equivalent lists for the same account", async () => {
    await sendAddPaperTx(BitcoinPaper);
    await sendAddPaperTx(EthereumPaper);

    await contract.editPinnedList([], [computePaperHash(EthereumPaper)]);

    const pinnedList1 = await contract.getPinnedPapers();
    const pinnedList2 = await contract.getPinnedPapersForAccount(owner.address);

    expect(pinnedList1).to.deep.equal(pinnedList2);
  });

  it("bulkRemovePapersFromReadingList() should update the reading list correctly", async () => {
    await sendAddPaperTx(BitcoinPaper);
    await sendAddPaperTx(EthereumPaper);

    await contract
      .connect(addr2)
      .addPaperToReadingList(computePaperHash(BitcoinPaper));
    await contract
      .connect(addr2)
      .addPaperToReadingList(computePaperHash(EthereumPaper));

    // Send a transaction to bulk remove both papers from 'addr2' account reading list.
    await contract.connect(addr2).bulkRemovePapersFromReadingList([computePaperHash(EthereumPaper), computePaperHash(BitcoinPaper)]);

    const readingList = await contract.getPapersForAccount(addr2.address);
    expect(readingList.length).to.equal(0);
  });

  it("account should not be able to remove a paper from reading list that it added", async () => {
    await sendAddPaperTx(BitcoinPaper);
    await expect(contract.removePaperFromReadingList(computePaperHash(BitcoinPaper))).to.be.reverted;
  });

  it("isPaperInAccountReadingList() should correctly check if a paper is present", async () => {
    await sendAddPaperTx(BitcoinPaper);
    await sendAddPaperTx(EthereumPaper);

    expect(await contract.isPaperInAccountReadingList(
      computePaperHash(BitcoinPaper), owner.address)
    ).to.be.true;

    expect(await contract.isPaperInAccountReadingList(
      computePaperHash(EthereumPaper), owner.address)
    ).to.be.true;

    // This should return false since we have not yet added the paper to reading list.
    expect(await contract.isPaperInAccountReadingList(
      computePaperHash(EthereumPaper), addr1.address)
    ).to.be.false;

    await contract.connect(addr1).addPaperToReadingList(computePaperHash(EthereumPaper));

    expect(await contract.isPaperInAccountReadingList(
      computePaperHash(EthereumPaper), addr1.address)
    ).to.be.true;
  });

  it("pinning a paper should not return it with getPapers() or getPapersForAccount()", async () => {
    await sendAddPaperTx(BitcoinPaper);
    await sendAddPaperTx(EthereumPaper);
    // Pin the 'Ethereum' paper.
    await contract.editPinnedList([], [computePaperHash(EthereumPaper)]);

    // Get the paper list & the pinned list. The pinned list should contain the
    // newly pinned paper as expected and the paper list should not.
    // Paper list should contain only the 'Bitcoin Paper' (unpinned) and 
    // pinned list should contain the 'Ethereum Paper' (pinned).
    let paperList = await contract.getPapersForAccount(owner.address);
    let pinnedList = await contract.getPinnedPapersForAccount(owner.address);

    expect(paperList.length).to.equal(1);
    expect(paperList[0].url).to.equal(BitcoinPaper.url);
    expect(pinnedList.length).to.equal(1);
    expect(pinnedList[0].url).to.equal(EthereumPaper.url);

    // Expect that 'getPapers()' and getPinnedPapers() behave the same way.
    paperList = await contract.getPapers();
    pinnedList = await contract.getPinnedPapers();

    expect(paperList.length).to.equal(1);
    expect(paperList[0].url).to.equal(BitcoinPaper.url);
    expect(pinnedList.length).to.equal(1);
    expect(pinnedList[0].url).to.equal(EthereumPaper.url);
  });

  it("adding a paper should grant a token", async () => {
    let paper = BitcoinPaper;
    const addPaperTx = await contract.connect(addr1).addPaper(
      paper.url, paper.name, paper.tags
    );
    await addPaperTx.wait();

    // Get balance of tokens for the account that just added a paper.
    let balance = await tokenContract.balanceOf(addr1.address);
    expect(balance).to.equal(1);

    // Add another paper.
    paper = EthereumPaper;
    await contract.connect(addr1).addPaper(
      paper.url, paper.name, paper.tags
    );
    balance = await tokenContract.balanceOf(addr1.address);
    expect(balance).to.equal(2);
  });

  it("deleting a paper should remove a token", async () => {
    let paper = BitcoinPaper;
    const addPaperTx = await contract.connect(addr1).addPaper(
      paper.url, paper.name, paper.tags
    );
    await addPaperTx.wait();

    let balance = await tokenContract.balanceOf(addr1.address);
    expect(balance).to.equal(1);

    await contract.connect(addr1).deletePaper(computePaperHash(paper));

    balance = await tokenContract.balanceOf(addr1.address);
    expect(balance).to.equal(0);
  });

  it("should not be able to delete a paper that does not exist", async () => {
    let paper = BitcoinPaper;
    await expect(contract.connect(addr1).deletePaper(computePaperHash(paper))).to.be.reverted;
  });

  it("should not be able to delete a paper which account is not the creater of", async () => {
    let paper = BitcoinPaper;

    // Add a paper from addr1.
    await contract.connect(addr1).addPaper(
      paper.url, paper.name, paper.tags
    );

    // Attempt to delete from addr2.
    await expect(contract.connect(addr2).deletePaper(computePaperHash(paper))).to.be.reverted;
  });

  it("should not be able to delete a paper without a token", async () => {
    let paper = BitcoinPaper;
    await contract.connect(addr1).addPaper(
      paper.url, paper.name, paper.tags
    );

    await expect(tokenContract.connect(addr1).transfer(addr2.address, 1)).to.not.be.reverted;

    // At this point addr1 should have 0 tokens, so the delete transaction should fail.
    await expect(contract.connect(addr1).deletePaper(computePaperHash(paper))).to.be.reverted;
  });

  it("should not be able to delete a paper that is read by more accounts than the creator", async () => {
    let paper = BitcoinPaper;
    await contract.connect(addr1).addPaper(
      paper.url, paper.name, paper.tags
    );
    // Add the paper to a reading list from another account.
    await contract.connect(addr2).addPaperToReadingList(computePaperHash(paper));

    await expect(contract.connect(addr1).deletePaper(computePaperHash(paper))).to.be.reverted;
  });

  it("getTokenBalanceForAccount() should return the same number of tokens as token contract", async () => {
    let paper = BitcoinPaper;
    await contract.connect(addr1).addPaper(
      paper.url, paper.name, paper.tags
    );

    let balanceFromTokenContract = await tokenContract.balanceOf(addr1.address);
    let balanceFromMainContract = await contract.getTokenBalanceForAccount(addr1.address);

    expect(balanceFromMainContract).to.be.equal(balanceFromTokenContract).to.equal(1);
  });
});
