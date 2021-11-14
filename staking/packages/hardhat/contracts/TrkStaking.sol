// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

// Uncomment if needed for debugging: import "hardhat/console.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./TRKBEP20.sol";

contract TrkStaking is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for TRKBEP20;

    struct StakingPack {
        uint256 period;
        uint256 rate;
        uint256 maxStake;
        uint256 minStake;
        uint256 maxUser;
        uint256 currentUser;
        bool unlockable;
        bool claimable;
        uint256 feesOnRewardIfUnstakeEarlier;
        uint256 feesOnStakeIfUnstakeEarlier;
    }

    struct Staking {
        uint256 period;
        uint256 rate;
        uint256 timestamp;
        uint256 amount;
        uint256 reward;
        bool unlockable;
        bool claimable;
        uint256 claimed;
        uint256 feesOnRewardIfUnstakeEarlier;
        uint256 feesOnStakeIfUnstakeEarlier;
        uint256 packId;
    }

    struct StakingFlex {
        uint256 rate;
        uint256 timestamp;
        uint256 amount;
        uint256 reward;
        uint256 id;
    }

    StakingPack[] public stakingOptions;

    mapping(address => Staking[]) public staked;
    mapping(address => uint256) public balancesStaked;
    mapping(address => StakingFlex) public stakedFlex;

    uint256 public penaltyBalance;
    address[] public stakedFlexKeys;
    uint256 public totalStake;
    TRKBEP20 public trkBEP20;

    event StakingPackAdded(
        uint256 indexed packId,
        uint256 period,
        uint256 rate,
        uint256 maxStake,
        uint256 minStake,
        uint256 maxUser,
        bool unlockable,
        bool claimable,
        uint256 feesOnRewardIfUnstakeEarlier,
        uint256 feesOnStakeIfUnstakeEarlier
    );

    event StakingPackUpdated(
        uint256 indexed packId,
        uint256 period,
        uint256 rate,
        uint256 maxStake,
        uint256 minStake,
        uint256 maxUser,
        bool unlockable,
        bool claimable,
        uint256 feesOnRewardIfUnstakeEarlier,
        uint256 feesOnStakeIfUnstakeEarlier
    );

    event StakingPackDeleted(uint256 packId);
    event Stake(
        address indexed staker,
        uint256 indexed packId,
        uint256 amount,
        uint256 period,
        uint256 rate
    );
    event Unstake(
        address indexed unstaker,
        uint256 indexed packId,
        uint256 amount
    );

    event FeesOnRewardIfUnstakeEarlierUpdated(
        uint256 feesOnRewardIfUnstakeEarlier
    );
    event FeesOnStakeIfUnstakeEarlierUpdated(
        uint256 feesOnStakeIfUnstakeEarlier
    );

    /// @dev Verifies that packId exists in the staking contract
    /// @param _id - packId to verify
    modifier packIdExists(uint256 _id) {
        require(_id < stakingOptions.length, "PackId doesn't exist");
        _;
    }

    constructor(TRKBEP20 trkBEP20_) {
        totalStake = 0;
        trkBEP20 = trkBEP20_;
    }

    /// @dev Adds a staking pack in the stakingOptions array
    /// @param period - the period
    /// @param rate - the rate
    /// @param maxStake - the maximum amount to stake
    /// @param minStake - the minimum amount to stake
    /// @param maxUser - the maximum users that can stake on this pack
    /// @param unlockable - Can the pack be unstake before ?
    /// @param claimable - Can the rewards be unstake before ?
    /// @return bool
    function addStakingPack(
        uint256 period,
        uint256 rate,
        uint256 maxStake,
        uint256 minStake,
        uint256 maxUser,
        bool unlockable,
        bool claimable,
        uint256 feesOnRewardIfUnstakeEarlier,
        uint256 feesOnStakeIfUnstakeEarlier
    ) external onlyOwner returns (bool) {
        require(
            minStake < maxStake,
            "Cannot set minStake greater than maxStake"
        );
        stakingOptions.push(
            StakingPack(
                period,
                rate,
                maxStake,
                minStake,
                maxUser,
                0,
                unlockable,
                claimable,
                feesOnRewardIfUnstakeEarlier,
                feesOnStakeIfUnstakeEarlier
            )
        );

        emit StakingPackAdded(
            stakingOptions.length,
            period,
            rate,
            maxStake,
            minStake,
            maxUser,
            unlockable,
            claimable,
            feesOnRewardIfUnstakeEarlier,
            feesOnStakeIfUnstakeEarlier
        );
        return true;
    }

    /// @dev Modifies a specifc staking pack
    /// @param packId - index of the pack in the stakingOptions array
    /// @param period - the new period
    /// @param rate - the new rate
    /// @param maxStake - the new maximum amount to stake
    /// @param minStake - the new minimum amount to stake
    /// @param maxUser - the new maximum users that can stake on this pack
    /// @param unlockable - Can the pack be unstake before ?
    /// @param claimable - Can the rewards be unstake before ?
    /// @param feesOnRewardIfUnstakeEarlier - fees on the amount of rewards if the user claims rewards earlier
    /// @param feesOnStakeIfUnstakeEarlier - fees on the staking amount if the user unstakes earlier
    /// @return bool
    function setStakingPack(
        uint256 packId,
        uint256 period,
        uint256 rate,
        uint256 maxStake,
        uint256 minStake,
        uint256 maxUser,
        bool unlockable,
        bool claimable,
        uint256 feesOnRewardIfUnstakeEarlier,
        uint256 feesOnStakeIfUnstakeEarlier
    ) external onlyOwner packIdExists(packId) returns (bool) {
        require(
            minStake < maxStake,
            "Cannot set minStake greater than maxStake"
        );
        StakingPack storage stakingPack = stakingOptions[packId];
        stakingPack.period = period;
        stakingPack.rate = rate;
        stakingPack.maxStake = maxStake;
        stakingPack.minStake = minStake;
        stakingPack.maxUser = maxUser;
        stakingPack.unlockable = unlockable;
        stakingPack.claimable = claimable;
        stakingPack.feesOnRewardIfUnstakeEarlier = feesOnRewardIfUnstakeEarlier;
        stakingPack.feesOnStakeIfUnstakeEarlier = feesOnStakeIfUnstakeEarlier;
        emit StakingPackUpdated(
            packId,
            period,
            rate,
            maxStake,
            minStake,
            maxUser,
            unlockable,
            claimable,
            feesOnRewardIfUnstakeEarlier,
            feesOnStakeIfUnstakeEarlier
        );
        return true;
    }

    /// @dev Deletes a staking pack in the stakingOptions array
    /// @param packId - the packId to delete
    /// @return bool
    function deleteStakingPack(uint256 packId)
        external
        onlyOwner
        packIdExists(packId)
        returns (bool)
    {
        require(packId != 0, "Cannot delete flex pack");
        stakingOptions[packId] = stakingOptions[stakingOptions.length - 1];
        stakingOptions.pop();
        emit StakingPackDeleted(packId);
        return true;
    }

    /// @dev Gets the amount of available pack
    /// @return the amount of available pack
    function getLengthOfStakingPackOptions() external view returns (uint256) {
        return stakingOptions.length;
    }

    /// @dev Gets the amount of reward in relation to the rate and time
    /// @param start - start of the period
    /// @param end - end of the period
    /// @param amount - amount staked
    /// @param rate - rate per year
    /// @return the amount of reward
    function getReward(
        uint256 start,
        uint256 end,
        uint256 amount,
        uint256 rate
    ) internal pure returns (uint256) {
        uint256 period = end.sub(start);
        period = period.mul(10000000000);
        uint256 timeRatio = period.div(365 days);
        uint256 totalReward = timeRatio.mul(rate.mul(amount));
        return totalReward.div(1000000000000);
    }

    /// @dev Allows a user to stake his tokens
    /// @param packId - the packId chosen for staking
    /// @param amount - the amount to stake
    /// @return bool
    function stake(uint256 packId, uint256 amount)
        external
        packIdExists(packId)
        nonReentrant
        returns (bool)
    {
        StakingPack storage stakingPack = stakingOptions[packId];
        require(amount > stakingPack.minStake, "Amount < minStake");
        require(
            amount < stakingPack.maxStake || stakingPack.maxStake == 0,
            "Amount > maxStake"
        );
        require(
            stakingPack.currentUser < stakingPack.maxUser ||
                stakingPack.maxUser == 0,
            "This pack is not available"
        );
        uint256 reward = getReward(
            block.timestamp,
            block.timestamp.add(stakingPack.period),
            amount,
            stakingPack.rate
        );

        require(
            trkBEP20.balanceOf(address(this)) > reward,
            "Staking Contract cannot pay rewards"
        );
        if (packId == 0)
            require(
                stakedFlex[msg.sender].amount == 0,
                "You already have a staking flex"
            );

        trkBEP20.transferFrom(address(msg.sender), address(this), amount);

        if (packId > 0) {
            staked[msg.sender].push(
                Staking(
                    stakingPack.period,
                    stakingPack.rate,
                    block.timestamp,
                    amount,
                    reward,
                    stakingPack.unlockable,
                    stakingPack.claimable,
                    0,
                    stakingPack.feesOnRewardIfUnstakeEarlier,
                    stakingPack.feesOnStakeIfUnstakeEarlier,
                    packId
                )
            );
        } else {
            stakedFlex[msg.sender] = StakingFlex(
                stakingPack.rate,
                block.timestamp,
                amount,
                0,
                stakedFlexKeys.length
            );
            stakedFlexKeys.push(msg.sender);
        }

        stakingPack.currentUser = stakingPack.currentUser.add(1);
        balancesStaked[msg.sender] = balancesStaked[msg.sender].add(amount);
        totalStake = totalStake.add(amount);
        emit Stake(
            msg.sender,
            packId,
            amount,
            stakingPack.period,
            stakingPack.rate
        );

        return true;
    }

    /// @dev Allows admin to update all flexible staking, x and y are define to limit the size of the transaction
    /// @param x - start
    /// @param y - end
    /// @return bool
    function updateStakeFlexRate(uint256 x, uint256 y)
        external
        onlyOwner
        returns (bool)
    {
        require(x < y, "Please set a proper array parsing setup");
        require(
            x < stakedFlexKeys.length,
            "Please set a proper array parsing setup"
        );
        require(
            y <= stakedFlexKeys.length,
            "Please set a proper array parsing setup"
        );
        for (uint256 i = x; i < y; i++) {
            StakingFlex storage stakingFlex = stakedFlex[stakedFlexKeys[i]];
            stakingFlex.amount = stakingFlex.amount.add(
                getReward(
                    stakingFlex.timestamp,
                    block.timestamp,
                    stakingFlex.amount,
                    stakingFlex.rate
                )
            );
            stakingFlex.rate = stakingOptions[0].rate;
            stakingFlex.timestamp = block.timestamp;
        }
        return true;
    }

    /// @dev Gets the number of flexible staking
    /// @return the number of flexible staking
    function getStakeFlexKeys() external view returns (uint256) {
        return stakedFlexKeys.length;
    }

    /// @dev Allows a user to increase their flexible staking balance
    /// @param amount - amount to stake
    /// @return bool
    function increaseStakeFlex(uint256 amount)
        external
        nonReentrant
        returns (bool)
    {
        require(
            stakedFlex[msg.sender].amount > 0,
            "You don't have a flexible staking"
        );
        StakingFlex storage stakingFlex = stakedFlex[msg.sender];
        uint256 reward = stakingFlex.reward.add(
            getReward(
                stakingFlex.timestamp,
                block.timestamp,
                stakingFlex.amount,
                stakingFlex.rate
            )
        );
        require(
            trkBEP20.balanceOf(address(this)) > reward,
            "Staking Contract cannot pay rewards"
        );
        trkBEP20.transferFrom(address(msg.sender), address(this), amount);
        balancesStaked[msg.sender] = balancesStaked[msg.sender].add(
            amount.add(reward)
        );
        stakingFlex.amount = stakingFlex.amount.add(amount.add(reward));
        stakingFlex.timestamp = block.timestamp;
        totalStake = totalStake.add(amount.add(reward));
        emit Stake(
            msg.sender,
            0,
            amount.add(reward),
            0,
            stakingOptions[0].rate
        );
        return true;
    }

    /// @dev Allows a user to withdraw their tokens from its flexible staking
    /// @param amount - the amount that the caller wants to withdraw
    /// @return bool
    function unstakeFlex(uint256 amount) external nonReentrant returns (bool) {
        StakingFlex storage stakingFlex = stakedFlex[msg.sender];
        require(stakingFlex.amount >= amount, "Amount exceeds staked balance");
        require(amount > 0, "Unstake amount cannot be 0");
        uint256 reward = stakingFlex.reward.add(
            getReward(
                stakingFlex.timestamp,
                block.timestamp,
                stakingFlex.amount,
                stakingFlex.rate
            )
        );
        require(
            trkBEP20.balanceOf(address(this)) > amount.add(reward),
            "Staking Contract cannot pay rewards"
        );
        uint256 stakedBalance = stakingFlex.amount;
        stakingFlex.amount = stakingFlex.amount.sub(amount);
        stakingFlex.timestamp = block.timestamp;
        balancesStaked[msg.sender] = balancesStaked[msg.sender].sub(amount);
        totalStake = totalStake.sub(amount);

        if (amount == stakedBalance) {
            stakedFlexKeys[stakingFlex.id] = stakedFlexKeys[
                stakedFlexKeys.length.sub(1)
            ];
            stakedFlexKeys.pop();
        }
        trkBEP20.transfer(msg.sender, amount.add(reward));
        emit Unstake(msg.sender, 0, amount.add(reward));
        return true;
    }

    /// @dev Gets the amount of staking in progress for the user who calls the function
    /// @return the amount of staking in progress
    function getMyNumberOfStake() external view returns (uint256) {
        return staked[msg.sender].length;
    }

    /// @dev Allows a user to claim rewards from it felxible staking
    /// @return the amount of reward
    function claimRewardFlex() external returns (uint256) {
        StakingFlex storage stakingFlex = stakedFlex[msg.sender];
        require(stakingFlex.amount > 0, "You have no amount staked");
        uint256 reward = getReward(
            stakingFlex.timestamp,
            block.timestamp,
            stakingFlex.amount,
            stakingFlex.rate
        );
        require(
            trkBEP20.balanceOf(address(this)) > reward,
            "Staking Contract cannot pay rewards"
        );
        stakingFlex.timestamp = block.timestamp;
        trkBEP20.transfer(msg.sender, reward);
        return (reward);
    }

    /// @dev Allows a user to claim rewards from its locked stakings if its possible
    /// @param stakeId - the staking packId that the caller wants to claim
    /// @return the amount of reward
    function claimRewardLock(uint256 stakeId) external returns (uint256) {
        uint256 penalty = 0;
        uint256 reward = 0;
        require(
            stakeId < staked[msg.sender].length,
            "User stake does not exist"
        );
        Staking storage staking = staked[msg.sender][stakeId];
        if (!staking.claimable) {
            require(
                block.timestamp > (staking.timestamp).add(staking.period),
                "You cannot claim the rewards before the end of the staking"
            );
        }
        require(
            staking.claimed < staking.reward,
            "User has already claimed all the rewards for this pack"
        );
        if (block.timestamp > (staking.timestamp).add(staking.period)) {
            reward = (staking.reward).sub(staking.claimed);
        }
        if (block.timestamp < (staking.timestamp).add(staking.period)) {
            reward = getReward(
                staking.timestamp,
                block.timestamp,
                staking.amount,
                staking.rate
            ).sub(staking.claimed);
            penalty = getReward(
                block.timestamp,
                block.timestamp.add(365 days),
                reward,
                staking.feesOnRewardIfUnstakeEarlier
            );
        }
        require(
            trkBEP20.balanceOf(address(this)) > reward.sub(penalty),
            "Staking Contract cannot pay rewards"
        );
        staking.claimed = staking.claimed.add(reward);
        penaltyBalance = penaltyBalance.add(penalty);

        trkBEP20.transfer(msg.sender, reward.sub(penalty));
        return (reward.sub(penalty));
    }

    /// @dev Allows a user to withdraw their tokens from its locked staking if its possible
    /// @param stakeId - the staking packId that the caller wants to withdraw
    /// @return the amount of reward
    function unstakeLock(uint256 stakeId)
        external
        nonReentrant
        returns (uint256)
    {
        uint256 amountUnstaked;
        uint256 penaltyBalance_ = 0;
        require(
            stakeId < staked[msg.sender].length,
            "User stake does not exist"
        );
        Staking storage staking = staked[msg.sender][stakeId];
        uint256 packId_ = staking.packId;
        if (block.timestamp < (staking.timestamp).add(staking.period)) {
            require(staking.unlockable, "Can't unlock this staking");
            uint256 penalty = getReward(
                block.timestamp,
                block.timestamp.add(365 days),
                staking.amount,
                staking.feesOnStakeIfUnstakeEarlier
            );
            amountUnstaked = staking.amount.sub(penalty);
            penaltyBalance_ = penaltyBalance.add(
                staking.reward.sub(staking.claimed)
            );
        } else {
            amountUnstaked = staking.amount.add(
                (staking.reward).sub(staking.claimed)
            );
        }
        require(
            trkBEP20.balanceOf(address(this)) > amountUnstaked,
            "Staking Contract cannot pay"
        );
        penaltyBalance = penaltyBalance_;
        balancesStaked[msg.sender] = balancesStaked[msg.sender].sub(
            staking.amount
        );
        totalStake = totalStake.sub(staking.amount);
        stakingOptions[staking.packId].currentUser = stakingOptions[
            staking.packId
        ]
        .currentUser
        .sub(1);
        staked[msg.sender][stakeId] = staked[msg.sender][
            staked[msg.sender].length.sub(1)
        ];
        staked[msg.sender].pop();

        trkBEP20.transfer(msg.sender, amountUnstaked);
        emit Unstake(msg.sender, packId_, amountUnstaked);
        return amountUnstaked;
    }
}
