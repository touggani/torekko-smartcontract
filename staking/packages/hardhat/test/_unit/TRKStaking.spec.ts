import { ethers } from "hardhat";
import { Signer, constants, BigNumber } from "ethers";
import chai from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { TrkStaking } from "../../typechain/TrkStaking";
import TrkStakingArtifact from "../../artifacts/contracts/TrkStaking.sol/TrkStaking.json";
import { ModifiableContract, smoddit } from "@eth-optimism/smock";

import moment from "moment";

const { expect, use } = chai;

use(solidity);

const DECIMALS = 4;
const ZERO_ADDRESS = constants.AddressZero;
const INITIAL_SUPPLY = ethers.utils.parseUnits("390000000", DECIMALS);

// For debug only: const log = console.log;

describe("TrkStaking", () => {
  let trkStaking: TrkStaking;
  let trkStaking_: TrkStaking;
  let trkStaking_2: TrkStaking;
  let signers: Signer[];
  let trkBEP20: ModifiableContract;
  let trkStakingAddress: string;

  before(async () => {
    signers = await ethers.getSigners();
    const trk = await smoddit("TRKBEP20");
    trkBEP20 = await trk.deploy();

    trkStaking = (await deployContract(signers[0], TrkStakingArtifact, [
      trkBEP20.address,
    ])) as TrkStaking;
    trkStaking_ = trkStaking.connect(signers[1]);
    trkStaking_2 = trkStaking.connect(signers[2]);

    trkStakingAddress = trkStaking.address;
  });

  describe("Deployment", () => {
    it("should deploy the TrkStaking with a proper contract address", async () => {
      expect(trkStaking.address).to.properAddress;
    });
  });

  describe("addStakingPack method", () => {
    it("should not add staking pack with minStake greater than maxStake", async () => {
      await expect(trkStaking.addStakingPack(0, 0, 0, 1, 0, true, false, 0, 0)).to.be.revertedWith(
        "Cannot set minStake greater than maxStake",
      );
    });

    it("should add unusable staking flex pack", async () => {
      await expect(trkStaking.addStakingPack(0, 0, 1, 0, 0, true, false, 0, 0))
        .to.emit(trkStaking, "StakingPackAdded")
        .withArgs(1, 0, 0, 1, 0, 0, true, false, 0, 0);
    });

    it("should not add staking pack if caller is not allowed", async () => {
      await expect(trkStaking_.addStakingPack(0, 0, 0, 0, 0, true, true, 0, 0)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("should not update a staking pack that does not exist", async () => {
      await expect(trkStaking.setStakingPack(100, 0, 0, 0, 0, 0, true, true, 0, 0)).revertedWith(
        "PackId doesn't exist",
      );
    });

    it("should add staking pack 1", async () => {
      await expect(
        trkStaking.addStakingPack(
          7776000, // 90 days
          120,
          ethers.utils.parseUnits("100", DECIMALS),
          1,
          1000,
          true,
          false,
          0,
          0,
        ),
      )
        .to.emit(trkStaking, "StakingPackAdded")
        .withArgs(2, 7776000, 120, ethers.utils.parseUnits("100", DECIMALS), 1, 1000, true, false, 0, 0);
    });

    it("should add staking pack 2", async () => {
      await expect(
        trkStaking.addStakingPack(
          31536000, // 1 year
          36,
          ethers.utils.parseUnits("100", DECIMALS),
          1,
          1000,
          false,
          false,
          0,
          0
        ),
      )
        .to.emit(trkStaking, "StakingPackAdded")
        .withArgs(3, 31536000, 36, ethers.utils.parseUnits("100", DECIMALS), 1, 1000, false, false, 0, 0);
    });

    it("should add staking pack 3", async () => {
      await expect(
        trkStaking.addStakingPack(
          63072000,
          92,
          ethers.utils.parseUnits("100", DECIMALS),
          1,
          1000,
          false,
          false,
          0,
          0,
        ),
      )
        .to.emit(trkStaking, "StakingPackAdded")
        .withArgs(4, 63072000, 92, ethers.utils.parseUnits("100", DECIMALS), 1, 1000, false, false, 0, 0);
    });

    it("should add staking pack 4", async () => {
      await expect(
        trkStaking.addStakingPack(
          15768000,
          10,
          ethers.utils.parseUnits("100", DECIMALS),
          1,
          1000,
          false,
          false,
          0,
          0
        ),
      )
        .to.emit(trkStaking, "StakingPackAdded")
        .withArgs(5, 15768000, 10, ethers.utils.parseUnits("100", DECIMALS), 1, 1000, false, false, 0, 0);
    });

    it("should add staking packs for testing", async () => {
      await expect(
        trkStaking.addStakingPack(
          15768000,
          13,
          ethers.utils.parseUnits("1000000", DECIMALS),
          ethers.utils.parseUnits("100", DECIMALS),
          1,
          false,
          false,
          0,
          0
        ),
      )
        .to.emit(trkStaking, "StakingPackAdded")
        .withArgs(
          6,
          15768000,
          13,
          ethers.utils.parseUnits("1000000", DECIMALS),
          ethers.utils.parseUnits("100", DECIMALS),
          1,
          false,
          false,
          0,
          0
        );

      await expect(
        trkStaking.addStakingPack(
          600,
          13,
          ethers.utils.parseUnits("1000000", DECIMALS),
          ethers.utils.parseUnits("100", DECIMALS),
          1000,
          true,
          true,
          0,
          0
        ),
      )
        .to.emit(trkStaking, "StakingPackAdded")
        .withArgs(
          7,
          600,
          13,
          ethers.utils.parseUnits("1000000", DECIMALS),
          ethers.utils.parseUnits("100", DECIMALS),
          1000,
          true,
          true,
          0,
          0
        );
    });
  });

  describe("setStakingPack method", () => {
    it("should update staking pack", async () => {
      await expect(
        trkStaking.setStakingPack(
          4,
          15768000,
          13,
          ethers.utils.parseUnits("100", DECIMALS),
          1,
          1000,
          false,
          false,
          0,
          0
        ),
      )
        .to.emit(trkStaking, "StakingPackUpdated")
        .withArgs(4, 15768000, 13, ethers.utils.parseUnits("100", DECIMALS), 1, 1000, false, false, 0, 0);
    });
    it("should not update a staking pack with minStake greater than maxStake", async () => {
      await expect(trkStaking.setStakingPack(0, 0, 0, 0, 10, 0, true, true, 0, 0)).to.be.revertedWith(
        "Cannot set minStake greater than maxStake",
      );
    });

    it("should not update a staking pack that does not exist", async () => {
      await expect(trkStaking.setStakingPack(100, 0, 0, 0, 0, 0, true, true, 0, 0)).to.be.revertedWith(
        "PackId doesn't exist",
      );
    });
  });

  describe("getLengthOfStakingPackOptions method", () => {
    it("shoudl return the number of staking pack available", async () => {
      expect(await trkStaking.getLengthOfStakingPackOptions()).to.equal(7);
    });
  });

  describe("stake method", () => {
    const stakeAmount = ethers.utils.parseUnits("150", DECIMALS);

    it("should not stake a pack that does not exist", async () => {
      await expect(trkStaking.stake(100, stakeAmount)).to.be.revertedWith("PackId doesn't exist");
    });

    it("should not stake below minStake of the pack", async () => {
      await expect(trkStaking_.stake(5, 0)).to.be.revertedWith("Amount < minStake");
    });

    it("should not stake above maxStake of the pack", async () => {
      await expect(trkStaking_.stake(5, ethers.utils.parseUnits("1000001", DECIMALS))).to.be.revertedWith(
        "Amount > maxStake",
      );
    });

    it("should not stake if staking contract cannot pay rewards", async () => {
      await expect(trkStaking_.stake(5, stakeAmount)).to.be.revertedWith("Staking Contract cannot pay rewards");
    });

    it("should not stake if user has not enough funds for staking contract", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await trkBEP20.smodify.put({
        _balances: { [stakerAddress]: BigNumber.from(0).toNumber() },
      });
      await trkBEP20.smodify.put({
        _allowances: {
          [stakerAddress]: { [trkStaking.address]: 0 },
        },
      });
      await expect(trkStaking_.stake(5, stakeAmount)).to.be.revertedWith("BEP20: transfer amount exceeds balance");
    });

    it("should not stake if user has not approved funds for staking contract", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await trkBEP20.smodify.put({
        _balances: { [stakerAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await trkBEP20.smodify.put({
        _allowances: {
          [stakerAddress]: { [trkStaking.address]: 0 },
        },
      });
      await expect(trkStaking_.stake(5, stakeAmount)).to.be.revertedWith("BEP20: transfer amount exceeds allowance");
    });

    it("should stake trk tokens", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await trkBEP20.smodify.put({
        _balances: { [stakerAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await trkBEP20.smodify.put({
        _allowances: {
          [stakerAddress]: { [trkStaking.address]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
        },
      });
      await expect(trkStaking_.stake(5, stakeAmount))
        .to.emit(trkStaking, "Stake")
        .withArgs(stakerAddress, 5, stakeAmount, 15768000, 13);

      expect((await trkStaking_.stakingOptions(5)).currentUser).to.be.eq(1);
      expect(await (await trkStaking_.stakedFlex(stakerAddress)).amount).to.eq(0);
      expect(await trkStaking_.totalStake()).to.be.eq(stakeAmount);
      expect(await trkStaking_.balancesStaked(stakerAddress)).to.eq(stakeAmount);
      const userStaking = await trkStaking_.staked(stakerAddress, 0);
      expect(userStaking.amount).to.eq(stakeAmount);
      expect(userStaking.rate).to.eq(13);
      expect(userStaking.period).to.eq(15768000);
      expect(userStaking.reward).to.eq(ethers.utils.parseUnits("9.75", DECIMALS));
      expect(userStaking.unlockable).to.be.false;
      expect(userStaking.claimable).to.be.false;
      expect(userStaking.claimed).to.eq(0);
      expect(userStaking.packId).to.eq(5);
    });

    it("should not allow staking in a pack that achieved max user threshold", async () => {
      await expect(trkStaking_.stake(5, ethers.utils.parseUnits("101", DECIMALS))).to.be.revertedWith(
        "This pack is not available",
      );
    });

    it("should stake trk tokens on flex pack", async () => {
      const newStakeAmount_ = ethers.utils.parseUnits("300", DECIMALS);
      await trkStaking.setStakingPack(
        0,
        0,
        10,
        ethers.utils.parseUnits("1000000", DECIMALS),
        ethers.utils.parseUnits("99", DECIMALS),
        1000,
        false,
        false,
        0,
        0
      );

      const stakerAddress: string = await signers[1].getAddress();
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await trkBEP20.smodify.put({
        _balances: { [stakerAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await trkBEP20.smodify.put({
        _allowances: {
          [stakerAddress]: { [trkStaking.address]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
        },
      });
      await expect(trkStaking_.stake(0, stakeAmount))
        .to.emit(trkStaking, "Stake")
        .withArgs(stakerAddress, 0, stakeAmount, 0, 10);
      expect((await trkStaking_.stakingOptions(0)).currentUser).to.be.eq(1);
      const userStaking = await trkStaking_.stakedFlex(stakerAddress);
      expect(userStaking.amount).to.eq(stakeAmount);
      expect(userStaking.rate).to.eq(10);
      expect(userStaking.reward).to.eq(0);
      expect(userStaking.id).to.eq(0);
      expect(await trkStaking_.totalStake()).to.be.eq(newStakeAmount_);
      expect(await trkStaking_.balancesStaked(stakerAddress)).to.eq(newStakeAmount_);
    });

    it("should not stake twice trk tokens on flex pack", async () => {
      await expect(trkStaking_.stake(0, stakeAmount)).to.be.revertedWith("You already have a staking flex");
    });
  });

  describe("increaseStakeFlex method", async () => {
    const stakeAmount = ethers.utils.parseUnits("150", DECIMALS);

    it("should increase the staking flex", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      const newStakeAmount = ethers.utils.parseUnits("300", DECIMALS);
      const newTotalStakeAmount = ethers.utils.parseUnits("450", DECIMALS);
      await expect(trkStaking_.increaseStakeFlex(stakeAmount))
        .to.emit(trkStaking_, "Stake")
        .withArgs(stakerAddress, 0, stakeAmount, 0, 10);

      expect((await trkStaking_.stakingOptions(0)).currentUser).to.be.eq(1);
      const userStaking = await trkStaking_.stakedFlex(stakerAddress);
      expect(userStaking.amount).to.eq(newStakeAmount);
      expect(userStaking.rate).to.eq(10);
      expect(userStaking.reward).to.eq(0);
      expect(userStaking.id).to.eq(0);
      expect(await trkStaking_.totalStake()).to.be.eq(newTotalStakeAmount);
      expect(await trkStaking_.balancesStaked(stakerAddress)).to.eq(newTotalStakeAmount);
    });

    it("should not increase the staking flex if user does not have enough balance", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      await trkBEP20.smodify.put({
        _balances: { [stakerAddress]: BigNumber.from(0).toNumber() },
      });
      await expect(trkStaking_.increaseStakeFlex(INITIAL_SUPPLY)).to.be.revertedWith(
        "BEP20: transfer amount exceeds balance",
      );
    });

    it("should not increase the staking flex if user has not approved the staking contract", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      await trkBEP20.smodify.put({
        _balances: { [stakerAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await trkBEP20.smodify.put({
        _allowances: {
          [stakerAddress]: { [trkStaking.address]: 0 },
        },
      });
      await expect(trkStaking_.increaseStakeFlex(INITIAL_SUPPLY)).to.be.revertedWith(
        "BEP20: transfer amount exceeds allowance",
      );
    });

    it("should not update the staking flex if the staking contract does not have enough fund to pay reward", async () => {
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: 0 },
      });
      await expect(trkStaking_.increaseStakeFlex(stakeAmount)).to.be.revertedWith(
        "Staking Contract cannot pay rewards",
      );
    });

    it("should not update the staking flex if the user does not have a staking in flex pack", async () => {
      await expect(trkStaking.increaseStakeFlex(stakeAmount)).to.be.revertedWith("You don't have a flexible staking");
    });
  });

  describe("unstakeFlex method", () => {
    const unstakeAmount = ethers.utils.parseUnits("150", DECIMALS);

    it("should not allow user to unstake flex staking if the user never staked", async () => {
      await expect(trkStaking.unstakeFlex(INITIAL_SUPPLY)).to.be.revertedWith("Amount exceeds staked balance");
    });

    it("should not allow user to unstake flex staking with more than it actually stakes", async () => {
      await expect(trkStaking_.unstakeFlex(INITIAL_SUPPLY)).to.be.revertedWith("Amount exceeds staked balance");
    });

    it("should not allow user to unstake flex staking with 0 amount", async () => {
      await expect(trkStaking_.unstakeFlex(0)).to.be.revertedWith("Unstake amount cannot be 0");
    });

    it("should not allow user to unstake flex staking if staking contract cannot pay rewards", async () => {
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: 0 },
      });
      await expect(trkStaking_.unstakeFlex(unstakeAmount)).to.be.revertedWith("Staking Contract cannot pay rewards");
    });

    it("should allow user to unstake flex staking", async () => {
      const newTotalStakeAmount = ethers.utils.parseUnits("300", DECIMALS);
      const stakerAddress: string = await signers[1].getAddress();
      const previousUserStaking = await trkStaking_.stakedFlex(stakerAddress);
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await expect(trkStaking_.unstakeFlex(unstakeAmount))
        .to.emit(trkStaking, "Unstake")
        .withArgs(stakerAddress, 0, unstakeAmount);

      const userStaking = await trkStaking_.stakedFlex(stakerAddress);
      expect(userStaking.amount.toNumber()).to.be.lessThan(previousUserStaking.amount.toNumber());
      expect(userStaking.rate).to.eq(10);
      expect(userStaking.reward).to.eq(0);
      expect(userStaking.id).to.eq(0);
      expect(await trkStaking_.totalStake()).to.be.eq(newTotalStakeAmount);
      expect(await trkStaking_.balancesStaked(stakerAddress)).to.eq(newTotalStakeAmount);
    });

    it("should allow user to fully exit a staking flex position", async () => {
      expect(BigNumber.from(await trkStaking_.getStakeFlexKeys()).toNumber()).to.eq(1);
      const stakerAddress: string = await signers[1].getAddress();
      await expect(trkStaking_.unstakeFlex(unstakeAmount))
        .to.emit(trkStaking, "Unstake")
        .withArgs(stakerAddress, 0, unstakeAmount);
      const userStaking = await trkStaking_.stakedFlex(stakerAddress);
      expect(userStaking.amount.toNumber()).to.be.eq(0);
      expect(userStaking.reward).to.eq(0);
      expect(userStaking.id).to.eq(0);
      expect(BigNumber.from(await trkStaking_.getStakeFlexKeys()).toNumber()).to.eq(0);
      expect(await trkStaking_.totalStake()).to.be.eq(unstakeAmount); // Lock staking is left
      expect(await trkStaking_.balancesStaked(stakerAddress)).to.eq(unstakeAmount);
    });
  });

  describe("claimRewardFlex method", () => {
    const stakeAmount = ethers.utils.parseUnits("100", DECIMALS);
    it("should not allow user to claim flex rewards if not flex staking", async () => {
      await expect(trkStaking.claimRewardFlex()).to.be.revertedWith("You have no amount staked");
    });

    it("should not allow user to claim flex rewards if staking contract cannot pay rewards", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      await trkBEP20.smodify.put({
        _allowances: {
          [stakerAddress]: { [trkStaking.address]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
        },
      });
      await trkStaking_.stake(0, stakeAmount);
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: 0 },
      });
      await expect(trkStaking_.claimRewardFlex()).to.be.revertedWith("Staking Contract cannot pay rewards");
    });

    it("should allow user to claim flex rewards", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      const previousUserStaking = await trkStaking_.stakedFlex(stakerAddress);
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await ethers.provider.send("evm_mine", [moment().add(1, "minute").unix()]);
      const l = await trkStaking_.claimRewardFlex();
      const userStaking = await trkStaking_.stakedFlex(stakerAddress);
      expect(userStaking.timestamp.toNumber()).to.be.greaterThan(previousUserStaking.timestamp.toNumber());
      expect(userStaking.rate).to.eq(10);
      expect(userStaking.reward).to.eq(0);
      expect(userStaking.id).to.eq(0);
    });
  });

  describe("updateStakeFlexRate method", () => {
    it("should not allow to update all flexible staking if caller is not allowed", async () => {
      await expect(trkStaking_.updateStakeFlexRate(0, 1)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("should not allow to update all flexible staking if the x-y is not set properly - x < y", async () => {
      await expect(trkStaking.updateStakeFlexRate(0, 0)).to.be.revertedWith("Please set a proper array parsing setup");
    });

    it("should not allow to update all flexible staking if the x-y is not set properly - x too high", async () => {
      await expect(trkStaking.updateStakeFlexRate(0, 2)).to.be.revertedWith("Please set a proper array parsing setup");
    });

    it("should not allow to update all flexible staking if the x-y is not set properly - y too high", async () => {
      await expect(trkStaking.updateStakeFlexRate(10, 20)).to.be.revertedWith(
        "Please set a proper array parsing setup",
      );
    });

    it("should update all flexible staking", async () => {
      await trkStaking.setStakingPack(
        0,
        0,
        15,
        ethers.utils.parseUnits("1000000", DECIMALS),
        ethers.utils.parseUnits("99", DECIMALS),
        1000,
        false,
        false,
        0,
        0
      );
      await ethers.provider.send("evm_mine", [moment().add(10, "minute").unix()]);

      await trkStaking.updateStakeFlexRate(0, 1);

      const userStaking_ = await trkStaking.stakedFlex(await signers[1].getAddress());
      expect(userStaking_.reward).to.eq(0);
      expect(userStaking_.rate).to.eq(15);
      expect(userStaking_.amount).to.eq(ethers.utils.parseUnits("100.0001", DECIMALS));
    });

    it("should update all flexible staking but should not affect balances if done with no timestamp move", async () => {
      await trkStaking.setStakingPack(
        0,
        0,
        10,
        ethers.utils.parseUnits("1000000", DECIMALS),
        ethers.utils.parseUnits("99", DECIMALS),
        1000,
        false,
        false,
        0,
        0
      );
      await trkStaking.updateStakeFlexRate(0, 1);

      const userStaking_ = await trkStaking.stakedFlex(await signers[1].getAddress());
      expect(userStaking_.reward).to.eq(0);
      expect(userStaking_.rate).to.eq(10);
      expect(userStaking_.amount).to.eq(ethers.utils.parseUnits("100.0001", DECIMALS));
    });
  });

  describe("claimRewardLock method", () => {
    const stakeAmount = ethers.utils.parseUnits("150", DECIMALS);

    it("should not allow claiming rewards if user does not have lock staking", async () => {
      await expect(trkStaking.claimRewardLock(0)).to.be.revertedWith("User stake does not exist");
    });

    it("should not allow claiming rewards if user claims before ending of lock period", async () => {
      await expect(trkStaking_.claimRewardLock(0)).to.be.revertedWith(
        "You cannot claim the rewards before the end of the staking",
      );
    });

    it("should not allow claiming rewards if staking contract cannot pay rewards", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      await expect(trkStaking_.stake(6, stakeAmount))
        .to.emit(trkStaking, "Stake")
        .withArgs(stakerAddress, 6, stakeAmount, 600, 13);
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: 0 },
      });
      await expect(trkStaking_.claimRewardLock(1)).to.be.revertedWith("Staking Contract cannot pay rewards");
    });

    it("should allow user to claim rewards", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await ethers.provider.send("evm_mine", [moment().add(1, "hour").unix()]);
      await trkStaking_.claimRewardLock(1);
      const userStaking = await trkStaking.staked(stakerAddress, 1);
      expect(userStaking.claimed).to.eq(ethers.utils.parseUnits("0.0003", DECIMALS));
    });
  });

  describe("unstakeLock method", () => {
    const unstakeAmount = ethers.utils.parseUnits("150", DECIMALS);
    it("should not allow the user to unstake a stake that does not exist", async () => {
      await expect(trkStaking.unstakeLock(5)).to.be.revertedWith("User stake does not exist");
    });

    it("should not allow the user to unstake a stake before ending of lock period", async () => {
      await expect(trkStaking_.unstakeLock(0)).to.be.revertedWith("Can't unlock this staking");
    });

    it("should not allow the user to unstake a stake if staking contract cannot pay stake amount", async () => {
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: 0 },
      });
      await expect(trkStaking_.unstakeLock(1)).to.be.revertedWith("Staking Contract cannot pay");
    });

    it("should allow the user to unstake from a lock pack", async () => {
      const stakerAddress: string = await signers[1].getAddress();
      const previousNumberOfStakes = await trkStaking_.getMyNumberOfStake();
      const leftBalance = ethers.utils.parseUnits("250", DECIMALS);
      await trkBEP20.smodify.put({
        _balances: { [trkStakingAddress]: BigNumber.from(INITIAL_SUPPLY).toNumber() },
      });
      await expect(trkStaking_.unstakeLock(1))
        .to.emit(trkStaking, "Unstake")
        .withArgs(stakerAddress, 6, unstakeAmount);
      const stakingOptions = await trkStaking_.stakingOptions(6);
      expect(stakingOptions.currentUser.toNumber()).to.be.eq(0);
      expect(BigNumber.from(await trkStaking_.getMyNumberOfStake()).toNumber()).to.be.lessThan(
        previousNumberOfStakes.toNumber(),
      );
      expect(await trkStaking_.totalStake()).to.be.eq(leftBalance);
      expect(await trkStaking_.balancesStaked(stakerAddress)).to.eq(leftBalance);
    });
  });

  describe("deleteStakingPack method", () => {
    it("should not delete a staking pack that does not exist", async () => {
      await expect(trkStaking.deleteStakingPack(100)).to.be.revertedWith("PackId doesn't exist");
    });

    it("should not delete flex staking pack", async () => {
      await expect(trkStaking.deleteStakingPack(0)).to.be.revertedWith("Cannot delete flex pack");
    });

    it("should not delete staking pack if the user is not allowed", async () => {
      await expect(trkStaking_.deleteStakingPack(0)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should delete staking pack", async () => {
      expect(await trkStaking.getLengthOfStakingPackOptions()).to.equal(7);
      await expect(
        trkStaking.addStakingPack(
          1478708,
          10,
          ethers.utils.parseUnits("100", DECIMALS),
          1,
          1000,
          true,
          false,
          0,
          0
        ),
      )
        .to.emit(trkStaking, "StakingPackAdded")
        .withArgs(8, 1478708, 10, ethers.utils.parseUnits("100", DECIMALS), 1, 1000, true, false, 0, 0);
      expect(await trkStaking.getLengthOfStakingPackOptions()).to.equal(8);
      await expect(trkStaking.deleteStakingPack(7)).to.emit(trkStaking, "StakingPackDeleted").withArgs(7);
      expect(await trkStaking.getLengthOfStakingPackOptions()).to.equal(7);
    });
  });
});
