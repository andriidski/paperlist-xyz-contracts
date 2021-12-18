// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ReadPaperToken} from "./Token.sol";

contract PaperReadingList {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct Paper {
        string url;
        string name;
        string[] tags;
        address creator;
        uint256 readBy;
    }

    // Constants.
    uint256 constant maxAllowedToPin = 5;
    uint256 constant maxTagsAllowed = 5;
    uint256 constant minTagsAllowed = 1;

    mapping(bytes32 => bool) public isPaper;
    mapping(bytes32 => Paper) public paperData;

    // Mapping of address to set of hashes of papers.
    mapping(address => EnumerableSet.Bytes32Set) private readingLists;
    mapping(address => EnumerableSet.Bytes32Set) private pinnedLists;

    ReadPaperToken private tokenContract;

    constructor(address deployedTokenContractAddress) {
        // Create a reference to our token contract that is responsible for
        // granting accounts tokens for adding new papers.
        tokenContract = ReadPaperToken(deployedTokenContractAddress);
    }

    function __addPaperToReadingList(bytes32 paperHash, address account)
        private
    {
        // The paper should have been already added to the contract in order
        // to be added to a reading list.
        require(isPaper[paperHash]);

        // The reading list of the account trying to add a paper should not
        // already have the paper added.
        require(!EnumerableSet.contains(readingLists[account], paperHash));
        EnumerableSet.add(readingLists[account], paperHash);
    }

    function editPinnedList(
        bytes32[] calldata papersRemovePin,
        bytes32[] calldata papersAddPin
    ) public {
        // At most we can have 5 papers pinned.
        uint256 currentTotalPinned = EnumerableSet.length(
            pinnedLists[msg.sender]
        ) -
            papersRemovePin.length +
            papersAddPin.length;
        require(
            currentTotalPinned <= maxAllowedToPin && currentTotalPinned >= 0
        );

        // We iterate the papers that are to be unpinned (if any) first and for
        // each verify that the paper is currently pinned.
        for (uint256 i = 0; i < papersRemovePin.length; i++) {
            require(
                EnumerableSet.contains(
                    pinnedLists[msg.sender],
                    papersRemovePin[i]
                )
            );
            EnumerableSet.remove(pinnedLists[msg.sender], papersRemovePin[i]);
        }

        // Now we iterate the papers that should be pinned and for each verify that
        // the paper is currently unpinned and is present in the accounts reading list.
        for (uint256 i = 0; i < papersAddPin.length; i++) {
            require(
                !EnumerableSet.contains(
                    pinnedLists[msg.sender],
                    papersAddPin[i]
                ) &&
                    EnumerableSet.contains(
                        readingLists[msg.sender],
                        papersAddPin[i]
                    )
            );
            EnumerableSet.add(pinnedLists[msg.sender], papersAddPin[i]);
        }
    }

    /*
    'Remove a paper' transaction by a user to remove a given paper from their
    reading list. This can only be successfully completed if the user did not
    create this paper, so it should not be called otherwise.
    */
    function removePaperFromReadingList(bytes32 paperHash) public {
        // The reading list of the account calling the function must contain the
        // paper which it is trying to delete.
        require(EnumerableSet.contains(readingLists[msg.sender], paperHash));
        // Check to make sure that this paper was not added by the account that's
        // trying to remove it.
        require(paperData[paperHash].creator != msg.sender);
        EnumerableSet.remove(readingLists[msg.sender], paperHash);

        // If this paper was pinned, then also remove it from the account pinned
        // list.
        if (EnumerableSet.contains(pinnedLists[msg.sender], paperHash)) {
            EnumerableSet.remove(pinnedLists[msg.sender], paperHash);
        }

        // Decrement the number of readers by 1.
        paperData[paperHash].readBy = paperData[paperHash].readBy - 1;
    }

    function bulkRemovePapersFromReadingList(bytes32[] calldata paperHashes)
        public
    {
        for (uint256 i = 0; i < paperHashes.length; i++) {
            removePaperFromReadingList(paperHashes[i]);
        }
    }

    /*
    'Add a paper' transaction by a user to add a given paper to their reading
    list. Also called when a new paper is being added via 'addPaper', since that
    would mean that a user is creating a new paper.
    */
    function addPaperToReadingList(bytes32 paperHash) public {
        __addPaperToReadingList(paperHash, msg.sender);

        // Increment the number of readers by 1.
        paperData[paperHash].readBy = paperData[paperHash].readBy + 1;
    }

    function addPaper(
        string calldata paperUrl,
        string calldata paperName,
        string[] calldata paperTags
    ) public {
        bytes32 paperHash = keccak256(abi.encodePacked(paperUrl));
        require(!isPaper[paperHash]);

        // Require that the amount of tags be between 1 and 5.
        require(
            paperTags.length >= minTagsAllowed &&
                paperTags.length <= maxTagsAllowed
        );

        isPaper[paperHash] = true;
        paperData[paperHash] = Paper({
            url: paperUrl,
            name: paperName,
            tags: paperTags,
            creator: msg.sender,
            readBy: 1
        });

        __addPaperToReadingList(paperHash, msg.sender);

        // Grant one token to whoever just added the paper
        tokenContract.mintToken(msg.sender);
    }

    function deletePaper(bytes32 paperHash) public {
        require(isPaper[paperHash], "Can't delete a paper that does not exist");
        // The account which is trying to delete the paper must be the same
        // account that added the paper.
        require(
            paperData[paperHash].creator == msg.sender,
            "Can't delete a paper which you're not the creator of."
        );
        // A paper that is read by more than just the account that created it
        // is not allowed. This would mean that there are others who have added
        // the paper to the reading list, so we disallow it.
        require(
            paperData[paperHash].readBy == 1,
            "Can't delete a paper that is read by other accounts other than the paper creator"
        );
        // The account must have at least one token in order to delete the paper
        // and 'burn' the token.
        require(
            tokenContract.balanceOf(msg.sender) >= 1,
            "Must have at least 1 token to delete a paper"
        );

        isPaper[paperHash] = false;
        delete paperData[paperHash];

        // Remove the paper from reading list.
        EnumerableSet.remove(readingLists[msg.sender], paperHash);

        // If the paper was also in the pinned list, remove it from there
        if (EnumerableSet.contains(pinnedLists[msg.sender], paperHash)) {
            EnumerableSet.remove(pinnedLists[msg.sender], paperHash);
        }

        // Burn one token since we are deleting a paper.
        tokenContract.burnToken(msg.sender);
    }

    function __convertReadingListToArray(EnumerableSet.Bytes32Set storage list)
        private
        view
        returns (Paper[] memory)
    {
        // Check if this reading list does not have any papers added yet.
        if (EnumerableSet.length(list) == 0) {
            return new Paper[](0);
        }

        // Get a list of paper hashes that are on the given reading list.
        bytes32[] memory paperHashesForAccount = EnumerableSet.values(list);
        // Create a placeholder array to fill with actual paper data. The size will
        // be fixed since we know how many papers this reading list has from the count
        // of hashes.
        Paper[] memory papersForAccount = new Paper[](
            paperHashesForAccount.length
        );

        // For every paper hash, lookup the actual paper data and populate an entry
        // in the return array.
        for (uint256 i = 0; i < paperHashesForAccount.length; i++) {
            Paper memory singlePaper = paperData[paperHashesForAccount[i]];
            papersForAccount[i] = (singlePaper);
        }
        return papersForAccount;
    }

    function getPapers() public view returns (Paper[] memory) {
        return getPapersForAccount(msg.sender);
    }

    function getPapersForAccount(address account)
        public
        view
        returns (Paper[] memory)
    {
        EnumerableSet.Bytes32Set storage list = readingLists[account];

        // Check if this reading list does not have any papers added yet.
        if (EnumerableSet.length(list) == 0) {
            return new Paper[](0);
        }

        // Get a list of paper hashes that are on the given reading list.
        bytes32[] memory paperHashesForAccount = EnumerableSet.values(list);

        // Get the count of pinned paper hashes that are on the pinned list for
        // this account. This allows us to avoid double-counting some of the
        // papers that are in the reading list and also in the pinned list &
        // we use this to allocate the correct amount of memory for a Paper[]
        // array.
        uint256 countPinnedForAccount = EnumerableSet.length(
            pinnedLists[account]
        );

        // Create a placeholder array to fill with actual paper data. The size will
        // be fixed since we know how many papers this reading list has from the count
        // of hashes minus the count of pinned papers (to avoid double counting).
        Paper[] memory papersForAccount = new Paper[](
            paperHashesForAccount.length - countPinnedForAccount
        );

        // Index for insertion into 'papersForAccount' since we may skip over
        // some papers that are pinned.
        uint256 insertionIdx = 0;

        // For every paper hash, lookup the actual paper data and populate an entry
        // in the return array.
        for (uint256 i = 0; i < paperHashesForAccount.length; i++) {
            bytes32 paperHash = paperHashesForAccount[i];
            // Only add to array of papers if this paper is not also in the
            // pinned paper list.
            if (!EnumerableSet.contains(pinnedLists[account], paperHash)) {
                Paper memory singlePaper = paperData[paperHash];
                papersForAccount[insertionIdx] = (singlePaper);
                insertionIdx += 1;
            }
        }
        return papersForAccount;
    }

    function getPinnedPapers() public view returns (Paper[] memory) {
        return __convertReadingListToArray(pinnedLists[msg.sender]);
    }

    function getPinnedPapersForAccount(address account)
        public
        view
        returns (Paper[] memory)
    {
        return __convertReadingListToArray(pinnedLists[account]);
    }

    /*
    'View' function to return the number of addresses that are also reading a given paper.
    */
    function getNumReadersForPaper(bytes32 paperHash)
        public
        view
        returns (uint256)
    {
        if (!isPaper[paperHash]) return 0;
        return paperData[paperHash].readBy;
    }

    function getPaperByHash(bytes32 paperHash)
        public
        view
        returns (Paper memory)
    {
        return paperData[paperHash];
    }

    function isPaperInAccountReadingList(bytes32 paperHash, address account)
        public
        view
        returns (bool)
    {
        return EnumerableSet.contains(readingLists[account], paperHash);
    }

    function getTokenBalanceForAccount(address account)
        public
        view
        returns (uint256)
    {
        return tokenContract.balanceOf(account);
    }
}
