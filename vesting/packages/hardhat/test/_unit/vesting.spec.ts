import { ethers } from "hardhat";
import { Signer, constants} from "ethers";
import chai from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { TorekkoVesting } from "../../typechain/TorekkoVesting";
import VestingArtifact from "../../artifacts/contracts/Vesting.sol/TorekkoVesting.json";
import { ModifiableContract, smoddit } from "@eth-optimism/smock";
import moment from "moment";

const { expect, use } = chai;

use(solidity);
const DECIMALS = 18;
const INITIAL_SUPPLY = ethers.utils.parseUnits("10000000", DECIMALS);
const YEAR = 31536000;
const MONTH = 2592000;

const VC_INIT_RELEASE = 1000;
const VC_MONTH_RELEASE = 375;
const VC_TOTAL_LOCK_TIME = 2 * YEAR;
const VC_TIME_BETWEEN_CLAIM = MONTH;
const VC_NUMBER_OF_CLAIMS = 24;

describe("Torekko vesting", () => {
    let vesting: TorekkoVesting;
    let vestingVc: TorekkoVesting;
    let vestingTeam: TorekkoVesting;
    let vestingPostIDO: TorekkoVesting;
    let signers: Signer[];
    let trk: ModifiableContract;
    let vestingAddress: string;

    before(async () => {
        signers = await ethers.getSigners();

        const ownerAddress = await signers[0].getAddress();
        const vcAddress = await signers[1].getAddress();
        const teamAddress = await signers[2].getAddress();
        const idoAddress = await signers[3].getAddress();

        const token = await smoddit("TRKBEP20");

        trk = await token.deploy("torekko", "TRK");

        vesting = (await deployContract(signers[0], VestingArtifact, [
            trk.address,
            await signers[1].getAddress(),
        ])) as TorekkoVesting;

        vestingVc = vesting.connect(signers[1]);
        vestingTeam = vesting.connect(signers[2]);
        vestingPostIDO = vesting.connect(signers[3]);

        vestingAddress = vesting.address;

        await trk.smodify.put({
            _allowances: {
                [await signers[0].getAddress()]: { [vesting.address]: String(INITIAL_SUPPLY) },
            },
        });
    });

    describe("Deployment", () => {
        it("should deploy the vesting contract with a proper contract address", async () => {
            expect(vesting.address).to.properAddress;
        });

	it("should change the reserve address", async () => {
            await expect(vestingPostIDO.setReserve(await signers[0].getAddress())).to.be.revertedWith("Not admin")
        })
        it("should change the reserve address", async () => {
            await expect(vesting.setReserve(await signers[0].getAddress())).to.emit(vesting, "ChangedReserve").withArgs(await signers[0].getAddress())
        })
    });

    describe("Add vesting type", () => {
        it("should not add the vesting type if not owner", async () => {
            expect(
                vestingVc.addVestingType(
                    "VC",
                    VC_INIT_RELEASE,
                    VC_MONTH_RELEASE,
                    VC_TOTAL_LOCK_TIME,
                    VC_TIME_BETWEEN_CLAIM,
                    VC_NUMBER_OF_CLAIMS,
                    MONTH - 86400,
                ),
            ).to.be.revertedWith("Not admin");
        });

        it("should add a new vesting type", async () => {
            await expect(
                vesting.addVestingType(
                    "VC",
                    VC_INIT_RELEASE,
                    VC_MONTH_RELEASE,
                    VC_TOTAL_LOCK_TIME,
                    VC_TIME_BETWEEN_CLAIM,
                    VC_NUMBER_OF_CLAIMS,
                    MONTH - 86400,
                ),
            )
                .to.emit(vesting, "VestingTypeAdded")
                .withArgs(
                    "VC",
                    VC_INIT_RELEASE,
                    VC_MONTH_RELEASE,
                    VC_TOTAL_LOCK_TIME,
                    VC_TIME_BETWEEN_CLAIM,
                    VC_NUMBER_OF_CLAIMS,
                    MONTH - 86400,
                );
        });
    });

    describe("Add vester", () => {
        const vestingAmount = ethers.utils.parseUnits("15000", DECIMALS);
        it("should not add the vester if not owner", async () => {
            expect(
                vestingVc.addVester(await signers[1].getAddress(), "VC", vestingAmount),
            ).to.be.revertedWith("Not admin");
        });

        it("should add a new vester", async () => {
            await expect(vesting.addVester(await signers[1].getAddress(), "VC", vestingAmount))
                .to.emit(vesting, "VesterAdded")
                .withArgs(await signers[1].getAddress(), "VC", vestingAmount);
        });
    });

    describe("Remove vesting type", () => {
        it("should not remove the vesting type if not owner", async () => {
            expect(vestingVc.removeVestingType("VC")).to.be.revertedWith("Not admin");
        });

        it("should remove a vesting type", async () => {
            await expect(vesting.removeVestingType("VC"))
                .to.emit(vesting, "VestingTypeRemoved")
                .withArgs("VC");
        });
    });

    describe("Claim vesting", () => {
        it("should not send tokens to claimer", async () => {
            await expect(vestingVc.claim()).to.be.revertedWith("Too early");
        });

        it("should send 1 month tokens to the vester", async () => {
            await ethers.provider.send("evm_mine", [moment().add(1, "month").unix()]);
            await expect(vestingVc.claim())
            .to.emit(vestingVc, "Claimed")
            .withArgs(ethers.utils.parseUnits("506.25", DECIMALS));
        });

        it("should send 2 months tokens to the vester", async () => {
            await ethers.provider.send("evm_mine", [moment().add(3, "month").unix()]);
            await expect(vestingVc.claim())
                .to.emit(vestingVc, "Claimed")
                .withArgs(ethers.utils.parseUnits("1012.5", DECIMALS));
        });

        it("should send 19 months tokens to the vester", async () => {
            await ethers.provider.send("evm_mine", [moment().add(3, "years").unix()]);
            await expect(vestingVc.claim())
                .to.emit(vestingVc, "Claimed")
                .withArgs(ethers.utils.parseUnits("11981.25", DECIMALS));
        });
    });

    describe("Claim first vesting", () => {
        it("should send tokens to claimer", async () => {
            await expect(vestingVc.claimFirst())
                .to.emit(vestingVc, "Claimed")
                .withArgs(ethers.utils.parseUnits("1500", DECIMALS));
        });

        it("should not send tokens to the vester", async () => {
            await expect(vestingVc.claimFirst()).to.be.revertedWith("Already claimed");
        });
    });

    describe("Remove vester", () => {
        it("should not remove the vester", async () => {
            await expect(vestingVc.removeVester(await signers[1].getAddress())).to.be.revertedWith(
                "Not admin",
            );
        });

        it("should not remove the vester because no admin have accepted it", async () => {
            await expect(vesting.removeVester(await signers[1].getAddress())).to.be.revertedWith(
                "Not enough votes",
            );
        });

        it("An admin votes for the vester to be removed", async () => {
            await expect(vesting.voteRemoveVester(await signers[1].getAddress()))
                .to.emit(vesting, "Voted")
                .withArgs(await signers[1].getAddress(), true);
        });

        it("Same admin tries to vote to remove the vester and fails", async () => {
            await expect(
                vesting.voteRemoveVester(await signers[1].getAddress()),
            ).to.be.revertedWith("Already voted");
        });

        it("Removes the vester", async () => {
            await expect(vesting.removeVester(await signers[1].getAddress()))
                .to.emit(vesting, "Removed")
                .withArgs(await signers[1].getAddress());
        });
    });

    describe("Add new admin", async () => {
        it("should not add the admin", async () => {
            await expect(vestingVc.addAdmin(await signers[1].getAddress())).to.be.revertedWith(
                "Not admin",
            );
        });

        it("should not add the admin because no admin have accepted it", async () => {
            await expect(vesting.addAdmin(await signers[1].getAddress())).to.be.revertedWith(
                "Not enough votes",
            );
        });

        it("An admin votes for the admin to be added", async () => {
            await expect(vesting.voteAddAdmin(await signers[1].getAddress()))
                .to.emit(vesting, "Voted")
                .withArgs(await signers[1].getAddress(), true);
        });

        it("Same admin tries to vote to add the admin and fails", async () => {
            await expect(vesting.voteAddAdmin(await signers[1].getAddress())).to.be.revertedWith(
                "Already voted",
            );
        });

        it("Adds the admin", async () => {
            await expect(vesting.addAdmin(await signers[1].getAddress()))
                .to.emit(vesting, "Added")
                .withArgs(await signers[1].getAddress());
        });
    });

    describe("Change min admin accept number", async () => {
        it("should not change the number", async () => {
            await expect(vestingTeam.setAdminMin(2)).to.be.revertedWith("Not admin");
        });

        it("should not change the number because no admin have accepted it", async () => {
            await expect(vesting.setAdminMin(2)).to.be.revertedWith("Not enough votes");
        });

        it("An admin votes for the admin to be added", async () => {
            await expect(vesting.voteSetAdmin(2)).to.emit(vesting, "VotedNum").withArgs(2, true);
        });

        it("Same admin tries to vote to add the admin and fails", async () => {
            await expect(vesting.voteSetAdmin(2)).to.be.revertedWith("Already voted");
        });

        it("Adds the admin", async () => {
            await expect(vesting.setAdminMin(2)).to.emit(vesting, "Changed").withArgs(2);
        });
    });

    describe("Test the new admin value", async () => {
        it("should add a new vester", async () => {
            const vestingAmount = ethers.utils.parseUnits("15000", DECIMALS);
            await expect(vesting.addVester(await signers[1].getAddress(), "VC", vestingAmount))
                .to.emit(vesting, "VesterAdded")
                .withArgs(await signers[1].getAddress(), "VC", vestingAmount);
        });

        it("should not remove the vester", async () => {
            await expect(
                vestingTeam.removeVester(await signers[1].getAddress()),
            ).to.be.revertedWith("Not admin");
        });

        it("should not remove the vester because no admin have accepted it", async () => {
            await expect(vesting.removeVester(await signers[1].getAddress())).to.be.revertedWith(
                "Not enough votes",
            );
        });

        it("An admin votes for the vester to be removed", async () => {
            await expect(vesting.voteRemoveVester(await signers[1].getAddress()))
                .to.emit(vesting, "Voted")
                .withArgs(await signers[1].getAddress(), true);
        });

        it("should not remove the vester because no admin have accepted it", async () => {
            await expect(vesting.removeVester(await signers[1].getAddress())).to.be.revertedWith(
                "Not enough votes",
            );
        });

        it("An admin votes for the vester to be removed", async () => {
            await expect(vestingVc.voteRemoveVester(await signers[1].getAddress()))
                .to.emit(vestingVc, "Voted")
                .withArgs(await signers[1].getAddress(), true);
        });

        it("Removes the vester", async () => {
            await expect(vesting.removeVester(await signers[1].getAddress()))
                .to.emit(vesting, "Removed")
                .withArgs(await signers[1].getAddress());
        });
    });
});

