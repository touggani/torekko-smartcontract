// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
//Uncomment if needed for debugging: import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./TRKBEP20.sol";

contract TorekkoVesting is ReentrancyGuard {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeERC20 for TRKBEP20;

    struct VestingType {
        uint256 initialRelease;
        uint256 releaseRate;
        uint256 totalLockTime;
        uint256 claimPeriod;
        uint256 numberOfClaims;
        uint256 initialCooldown;
    }

    struct Vesting {
        string type_;
        uint256 amount;
        uint256 creationTime;
        uint256 rate;
        uint256 initialRelease;
        uint256 claimPeriod;
        uint256 firstClaim;
        uint256 totalClaims;
        uint256 numberOfClaims;
    }

    mapping(string => VestingType) public vestingTypes;
    mapping(address => Vesting) public vestings;
    mapping(address => string) public vesters;
    mapping(address => address[]) public acceptRemoveVester;
    mapping(address => address[]) public acceptAddAdmin;
    mapping(uint256 => address[]) public acceptNewNum;
    mapping(address => bool) public admins;

    uint256 minAdmin;
    address public reserve;

    TRKBEP20 public trkBEP20;

    event VesterAdded(address vester, string vestingType, uint256 amount);
    event VestingTypeRemoved(string type_);
    event Claimed(uint256 amount);
    event Removed(address vester);
    event Voted(address voted, bool worked);
    event VotedNum(uint256 voted, bool worked);
    event Added(address newAdmin);
    event Changed(uint256 newNum);
    event ChangedReserve(address reserve_);
    event VestingTypeAdded(
        string type_,
        uint256 initialRelease,
        uint256 releaseRate,
        uint256 totalLockTime,
        uint256 claimPeriod,
        uint256 numberOfClaims,
        uint256 initialCooldown
    );

    ///@dev Verifies that the user can claim the initial release
    modifier canClaimFirst() {
        require(vestings[msg.sender].firstClaim > 0, "Already claimed");
        require(
            vestings[msg.sender].creationTime.add(
                vestings[msg.sender].claimPeriod
            ) <= block.timestamp,
            "Too early"
        );
        _;
    }

    ///@dev Verifies that the user can claim his regular vesting
    modifier canClaim() {
        require(vestings[msg.sender].numberOfClaims > 0, "Vesting is finished");
        uint256 alreadyClaimed = vestings[msg.sender].totalClaims.sub(
            vestings[msg.sender].numberOfClaims
        );
        uint256 lastClaim = vestings[msg.sender].creationTime.add(
            vestings[msg.sender].claimPeriod.mul(alreadyClaimed)
        );
        require(
            block.timestamp.sub(lastClaim, "Too early") >
                vestings[msg.sender].claimPeriod,
            "Too early"
        );
        _;
    }

    ///@dev Verifies that the user is admin
    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }

    ///@dev Verifies that enough admins have voted for the vesting to be removed
    ///@param vester- Address of the vester that has to be removed
    modifier canBeRemoved(address vester) {
        require(
            acceptRemoveVester[vester].length >= minAdmin,
            "Not enough votes"
        );
        _;
    }

    ///@dev Verifies that the voter is admin and hasn't voted yet
    ///@param vester- Address of the vester that has to be removed
    modifier canVoteRemove(address vester) {
        for (uint256 i = 0; i < acceptRemoveVester[vester].length; i++) {
            require(
                !(msg.sender == acceptRemoveVester[vester][i]),
                "Already voted"
            );
        }
        _;
    }

    ///@dev Verifies that enough admins have voted for the admin to be added
    ///@param newAdmin- Address of the admin that has to be added
    modifier canBeAdded(address newAdmin) {
        require(
            acceptAddAdmin[newAdmin].length >= minAdmin,
            "Not enough votes"
        );
        _;
    }

    ///@dev Verifies that the voter is admin and hasn't voted yet
    ///@param newAdmin- Address of the admin that has to be added
    modifier canVoteAdd(address newAdmin) {
        for (uint256 i = 0; i < acceptAddAdmin[newAdmin].length; i++) {
            require(
                !(msg.sender == acceptAddAdmin[newAdmin][i]),
                "Already voted"
            );
        }
        _;
    }

    ///@dev Verifies that enough admins have voted for the number of admins needed for a dcision
    ///@param newNum- New number of admins that have to vote for a decision
    modifier canBeChanged(uint256 newNum) {
        require(acceptNewNum[newNum].length >= minAdmin, "Not enough votes");
        _;
    }

    ///@dev Verifies that the voter is admin and hasn't voted yet
    ///@param newNum- New number of admins that have to vote for a decision
    modifier canVoteChange(uint256 newNum) {
        for (uint256 i = 0; i < acceptNewNum[newNum].length; i++) {
            require(!(msg.sender == acceptNewNum[newNum][i]), "Already voted");
        }
        _;
    }

    constructor(TRKBEP20 trkBEP20_, address reserve_) {
        trkBEP20 = trkBEP20_;
        reserve = reserve_;
        minAdmin = 1;
        admins[msg.sender] = true;
    }

    ///@dev Vote to add an admin
    ///@param newAdmin - admin that has to be added
    ///@return bool
    function voteAddAdmin(address newAdmin)
        external
        onlyAdmin
        canVoteAdd(newAdmin)
        returns (bool)
    {
        acceptAddAdmin[newAdmin].push(msg.sender);
        emit Voted(newAdmin, true);
        return true;
    }

    ///@dev Set the new reserve address
    ///@param reserve_ - new reserve address
    ///@return bool
    function setReserve(address reserve_) external onlyAdmin returns (bool) {
        reserve = reserve_;
        emit ChangedReserve(reserve);
        return true;
    }

    ///@dev Add an admin if enough admins have voteed
    ///@param newAdmin - admin that will be added
    ///@return bool
    function addAdmin(address newAdmin)
        external
        onlyAdmin
        canBeAdded(newAdmin)
        returns (bool)
    {
        delete acceptAddAdmin[newAdmin];
        admins[newAdmin] = true;
        emit Added(newAdmin);
        return true;
    }

    ///@dev Vote to set the number of admins that have to accept a decision
    ///@param newNum - Number of admins that have to accept a decision
    ///@return bool
    function voteSetAdmin(uint256 newNum)
        external
        onlyAdmin
        canVoteChange(newNum)
        returns (bool)
    {
        acceptNewNum[newNum].push(msg.sender);
        emit VotedNum(newNum, true);
        return true;
    }

    ///@dev Set the number of admins that have to accept a decision if enough admins have voted
    ///@param newNum - Number of admins that have to accept a decision
    ///@return bool
    function setAdminMin(uint256 newNum)
        external
        onlyAdmin
        canBeChanged(newNum)
        returns (bool)
    {
        minAdmin = newNum;
        emit Changed(newNum);
        return true;
    }

    ///@dev Add a new vester
    ///@param vester - address of the vester
    ///@param vesting - type of vesting
    ///@param amount - amount of the vesting
    ///@return bool
    function addVester(
        address vester,
        string calldata vesting,
        uint256 amount
    ) external onlyAdmin returns (bool) {
        VestingType storage vestingType = vestingTypes[vesting];
        uint256 initial = vestingType.initialRelease.mul(amount);
        initial = initial.div(uint256(10000));
        uint256 remaining = amount.sub(initial);
        vestings[vester] = Vesting(
            vesting,
            remaining,
            block.timestamp.add(vestingType.initialCooldown).sub(
                vestingType.claimPeriod
            ),
            vestingType.releaseRate,
            initial,
            vestingType.claimPeriod,
            (vestingType.initialRelease.mul(amount)).div(10000),
            vestingType.numberOfClaims,
            vestingType.numberOfClaims
        );
        vesters[vester] = vesting;
        emit VesterAdded(vester, vesting, amount);
        return true;
    }

    ///@dev Add a vesting type
    ///@param type_ - type of vesting
    ///@param initialRelease - initial release percentage
    ///@param releaseRate - release percentage / period of release
    ///@param totalLockTime - total lock time of the vesting
    ///@param claimPeriod - period between 2 claims
    ///@param numberOfClaims_ - number of claims during the lock period
    ///@param initialCooldown - cliff time
    ///@return bool
    function addVestingType(
        string calldata type_,
        uint256 initialRelease,
        uint256 releaseRate,
        uint256 totalLockTime,
        uint256 claimPeriod,
        uint256 numberOfClaims_,
        uint256 initialCooldown
    ) external onlyAdmin returns (bool) {
        vestingTypes[type_] = VestingType(
            initialRelease,
            releaseRate,
            totalLockTime,
            claimPeriod,
            numberOfClaims_,
            initialCooldown
        );
        emit VestingTypeAdded(
            type_,
            initialRelease,
            releaseRate,
            totalLockTime,
            claimPeriod,
            numberOfClaims_,
            initialCooldown
        );
        return true;
    }

    ///@dev remove a vestng time
    ///@param type_ - type of the vesting to remove
    ///@return bool
    function removeVestingType(string calldata type_)
        external
        onlyAdmin
        returns (bool)
    {
        delete vestingTypes[type_];
        emit VestingTypeRemoved(type_);
        return true;
    }

    ///@dev vote to remove a vester
    ///@param vester - address of the vester to remove
    ///@return bool
    function voteRemoveVester(address vester)
        external
        onlyAdmin
        canVoteRemove(vester)
        returns (bool)
    {
        acceptRemoveVester[vester].push(msg.sender);
        emit Voted(vester, true);
        return true;
    }

    ///@dev remove a vester if enough admins have voted
    ///@param vester - address of the vester to remove
    ///@return bool
    function removeVester(address vester)
        external
        onlyAdmin
        canBeRemoved(vester)
        returns (bool)
    {
        delete acceptRemoveVester[vester];
        delete vestings[vester];
        emit Removed(vester);
        return true;
    }

    ///@dev claim the regular vesting
    ///@return bool
    function claim() external nonReentrant canClaim returns (bool) {
        Vesting storage vesting = vestings[msg.sender];
        uint256 alreadyClaimed = vesting.totalClaims.sub(
            vesting.numberOfClaims
        );
        uint256 lastClaim = vesting.creationTime.add(
            vesting.claimPeriod.mul(alreadyClaimed)
        );
        uint256 claimNumber = (uint256(block.timestamp).sub(lastClaim))
            .div(vesting.claimPeriod)
            .min(vesting.numberOfClaims);
        uint256 claimAmount = (
            (claimNumber.mul(vesting.rate)).mul(vesting.amount)
        ).div(uint256(10000));
        vestings[msg.sender].numberOfClaims = vesting.numberOfClaims.sub(
            claimNumber
        );
        if (vestings[msg.sender].numberOfClaims == 0) {
            claimAmount = claimAmount.add(
                vesting.amount.sub(
                    vesting
                        .totalClaims
                        .mul(vesting.rate)
                        .mul(vesting.amount)
                        .div(uint256(10000))
                )
            );
        }
        trkBEP20.transferFrom(reserve, msg.sender, claimAmount);
        emit Claimed(claimAmount);
        return true;
    }

    ///@dev Claim the initial release
    ///@return bool
    function claimFirst() external nonReentrant canClaimFirst returns (bool) {
        uint256 temp = vestings[msg.sender].firstClaim;
        vestings[msg.sender].firstClaim = uint256(0);
        trkBEP20.transferFrom(reserve, msg.sender, temp);
        emit Claimed(temp);
    }
}
