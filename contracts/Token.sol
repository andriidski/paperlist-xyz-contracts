// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract ReadPaperToken is ERC20, ERC20Burnable, Ownable {
    // Contract which is allowed to interract with the token to grant it
    // when a new paper is released and when one is deleted.
    address private paperReadingListContract;

    constructor(uint256 initialSupply) ERC20("Paper List Token", "PPRLST") {
        _mint(msg.sender, initialSupply);
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);
    }

    modifier onlyPaperReadingContract() {
        require(
            msg.sender == paperReadingListContract,
            "Function can only be called from the 'Paper Reading List' contract."
        );
        _;
    }

    function setPaperReadingListContract(address contractAddress)
        public
        onlyOwner
    {
        paperReadingListContract = contractAddress;
    }

    // Override to specify that a paper token does not have decimals --
    // you either have 1 per paper or don't.
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function mintToken(address forAccount) public onlyPaperReadingContract {
        _mint(forAccount, 1);
    }

    function burnToken(address fromAccount) public onlyPaperReadingContract {
        require(balanceOf(fromAccount) >= 1);
        _burn(fromAccount, 1);
    }
}
