import { ethers } from "hardhat";
import { Signer } from "ethers";
import chai from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { TorekkoVesting } from "../typechain/TorekkoVesting";
import VestingArtifact from "../artifacts/contracts/Vesting.sol/TorekkoVesting.json";
import { ModifiableContract, smoddit } from "@eth-optimism/smock";
import moment from "moment";

const { expect, use } = chai;

use(solidity);
const DECIMALS = 18;
const INITIAL_SUPPLY = ethers.utils.parseUnits("10000000", DECIMALS);
const YEAR = 31536000;
const MONTH = 2592000;

const VC_INIT_RELEASE = 800;
const VC_MONTH_RELEASE = 1022;
const VC_TOTAL_LOCK_TIME = 9 * MONTH;
const VC_TIME_BETWEEN_CLAIM = MONTH;
const VC_NUMBER_OF_CLAIMS = 9;

const IDO_INIT_RELEASE = 5000;
const IDO_MONTH_RELEASE = 10000;
const IDO_TOTAL_LOCK_TIME = MONTH;
const IDO_TIME_BETWEEN_CLAIM = MONTH;
const IDO_NUMBER_OF_CLAIMS = 1;

const TEAM_INIT_RELEASE = 0;
const TEAM_MONTH_RELEASE = 555;
const TEAM_TOTAL_LOCK_TIME = 18 * MONTH;
const TEAM_TIME_BETWEEN_CLAIM = MONTH;
const TEAM_NUMBER_OF_CLAIMS = 18;

const MARKETING_INIT_RELEASE = 200;
const MARKETING_MONTH_RELEASE = 816;
const MARKETING_TOTAL_LOCK_TIME = 12 * MONTH;
const MARKETING_TIME_BETWEEN_CLAIM = MONTH;
const MARKETING_NUMBER_OF_CLAIMS = 12;

const ADVISOR_INIT_RELEASE = 0;
const ADVISOR_MONTH_RELEASE = 833;
const ADVISOR_TOTAL_LOCK_TIME = YEAR;
const ADVISOR_TIME_BETWEEN_CLAIM = MONTH;
const ADVISOR_NUMBER_OF_CLAIMS = 12;

describe("Torekko vesting", () => {
    let vesting: TorekkoVesting;
    let admin1: TorekkoVesting;
    let admin2: TorekkoVesting;
    let alice: TorekkoVesting;
    let antoine: TorekkoVesting;
    let venture: TorekkoVesting;
    let lea: TorekkoVesting;
    let marketing: TorekkoVesting;
    let signers: Signer[];
    let trk: ModifiableContract;
    let vestingAddress: string;

    before(async () => {
        signers = await ethers.getSigners();

        const token = await smoddit("TRKBEP20");

        trk = await token.deploy("torekko", "TRK");

        vesting = (await deployContract(signers[0], VestingArtifact, [
            trk.address,
            await signers[0].getAddress(),
        ])) as TorekkoVesting;

        admin1 = vesting.connect(signers[0]);
        admin2 = vesting.connect(signers[1]);
        alice = vesting.connect(signers[2]);
        antoine = vesting.connect(signers[3]);
        venture = vesting.connect(signers[4]);
        lea = vesting.connect(signers[5]);
        marketing = vesting.connect(signers[6]);
        vestingAddress = vesting.address;

        await trk.smodify.put({
            _allowances: {
                [await signers[0].getAddress()]: { [vesting.address]: String(INITIAL_SUPPLY) },
            },
        });
    });

    describe("Deployment", () => {
        it("should deploy the vesting contract with a proper contract address", () => {
            expect(vesting.address).to.properAddress;
        });
    });

    describe("Contract initialisation", () => {
        it("add the 2nd admin", async () => {
            await expect(admin1.voteAddAdmin(await signers[1].getAddress()))
                .to.emit(vesting, "Voted")
                .withArgs(await signers[1].getAddress(), true);
            await expect(admin1.addAdmin(await signers[1].getAddress()))
                .to.emit(vesting, "Added")
                .withArgs(await signers[1].getAddress());
        });

        it("Sets the number of admins that have to approve a decision to 2", async () => {
            await expect(admin1.voteSetAdmin(2)).to.emit(vesting, "VotedNum").withArgs(2, true);
            await expect(admin2.setAdminMin(2)).to.emit(vesting, "Changed").withArgs(2);
        });

        it("create vesting type", async () => {
            await expect(
                admin1.addVestingType(
                    "Team",
                    TEAM_INIT_RELEASE,
                    TEAM_MONTH_RELEASE,
                    TEAM_TOTAL_LOCK_TIME,
                    TEAM_TIME_BETWEEN_CLAIM,
                    TEAM_NUMBER_OF_CLAIMS,
                    6 * MONTH,
                ),
            )
                .to.emit(vesting, "VestingTypeAdded")
                .withArgs(
                    "Team",
                    TEAM_INIT_RELEASE,
                    TEAM_MONTH_RELEASE,
                    TEAM_TOTAL_LOCK_TIME,
                    TEAM_TIME_BETWEEN_CLAIM,
                    TEAM_NUMBER_OF_CLAIMS,
                    6 * MONTH,
                );
        });

        it("add Alice as a vester", async () => {
            await expect(
                admin2.addVester(
                    await signers[2].getAddress(),
                    "Team",
                    ethers.utils.parseUnits("200000", DECIMALS),
                ),
            )
                .to.emit(vesting, "VesterAdded")
                .withArgs(
                    await signers[2].getAddress(),
                    "Team",
                    ethers.utils.parseUnits("200000", DECIMALS),
                );
        });
    });

    describe("Alice claims her vesting", async () => {
        it("Alice tries to claim instantly but fails", async () => {
            await expect(alice.claimFirst()).to.be.revertedWith(
                "Already claimed",
            );
        });

        it("Alice waits for 6 months to claim her first release", async () => {
            await ethers.provider.send("evm_mine", [moment().add(42, "month").unix()]);
            await expect(alice.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("11100", DECIMALS));
        });

        it("Alice waits for 1 month to claim her first release", async () => {
            await ethers.provider.send("evm_mine", [moment().add(43, "month").unix()]);
            await expect(alice.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("11100", DECIMALS));
        });

        it("Alice waits for 5 months to claim her last release", async () => {
            await ethers.provider.send("evm_mine", [moment().add(48, "month").unix()]);
            await expect(alice.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("55500", DECIMALS));
        });
    });

    describe("Alice gets removed", async () => {
        it("Admin1 votes for alice's vesting to be removed", async () => {
            await expect(admin1.voteRemoveVester(await signers[2].getAddress()))
                .to.emit(vesting, "Voted")
                .withArgs(await signers[2].getAddress(), true);
        });

        it("Admin2 votes for alice's vesting to be removed", async () => {
            await expect(admin2.voteRemoveVester(await signers[2].getAddress()))
                .to.emit(vesting, "Voted")
                .withArgs(await signers[2].getAddress(), true);
        });

        it("Admin 2 removes alice from the vestings", async () => {
            await expect(admin2.removeVester(await signers[2].getAddress()))
                .to.emit(vesting, "Removed")
                .withArgs(await signers[2].getAddress());
        });
    });

    describe("Initialisation of Antoine an advisor", async () => {
        it("create vesting type", async () => {
            await expect(
                admin2.addVestingType(
                    "Advisor",
                    ADVISOR_INIT_RELEASE,
                    ADVISOR_MONTH_RELEASE,
                    ADVISOR_TOTAL_LOCK_TIME,
                    ADVISOR_TIME_BETWEEN_CLAIM,
                    ADVISOR_NUMBER_OF_CLAIMS,
                    6 * MONTH,
                ),
            )
                .to.emit(vesting, "VestingTypeAdded")
                .withArgs(
                    "Advisor",
                    ADVISOR_INIT_RELEASE,
                    ADVISOR_MONTH_RELEASE,
                    ADVISOR_TOTAL_LOCK_TIME,
                    ADVISOR_TIME_BETWEEN_CLAIM,
                    ADVISOR_NUMBER_OF_CLAIMS,
                    6 * MONTH,
                );
        });

        it("add Antoine as a vester", async () => {
            await expect(
                await admin1.addVester(
                    await signers[3].getAddress(),
                    "Advisor",
                    ethers.utils.parseUnits("50000", DECIMALS),
                ),
            )
                .to.emit(vesting, "VesterAdded")
                .withArgs(
                    await signers[3].getAddress(),
                    "Advisor",
                    ethers.utils.parseUnits("50000", DECIMALS),
                );
        });
    });

    describe("Antoine claims his vesting", async () => {
        it("antoine tries to claim instantly but fails", async () => {
            await expect(antoine.claimFirst()).to.be.revertedWith(
                "Already claimed",
            );
        });

        it("Antoine tries to claim his vesting before the cliff time", async () => {
            await expect(antoine.claim()).to.be.revertedWith("Too early");
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(54, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(55, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(56, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(57, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(58, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(59, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(60, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(61, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(62, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(63, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(64, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4165", DECIMALS));
        });

        it("Antoine tries to claim his vesting before the claim period cooldown", async () => {
            await ethers.provider.send("evm_mine", [moment().add(1970, "day").unix()]);
            await expect(antoine.claim()).to.be.revertedWith("Too early");
        });

        it("Antoine tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(66, "month").unix()]);
            await expect(antoine.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("4185", DECIMALS));
        });

        it("Antoine tries to claim his vesting after he has claimed everything", async () => {
            await ethers.provider.send("evm_mine", [moment().add(67, "month").unix()]);
            await expect(antoine.claim()).to.be.revertedWith("Vesting is finished");
        });
    });

    describe("Initialisation of Venture an advisor", async () => {
        it("create vesting type", async () => {
            await expect(
                admin2.addVestingType(
                    "VC",
                    VC_INIT_RELEASE,
                    VC_MONTH_RELEASE,
                    VC_TOTAL_LOCK_TIME,
                    VC_TIME_BETWEEN_CLAIM,
                    VC_NUMBER_OF_CLAIMS,
                    7200,
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
                    7200,
                );
        });

        it("add venture as a vester", async () => {
            await ethers.provider.send("evm_mine", [moment().add(49640, "hour").unix()]);
            await expect(
                await admin1.addVester(
                    await signers[4].getAddress(),
                    "VC",
                    ethers.utils.parseUnits("1000000", DECIMALS),
                ),
            )
                .to.emit(vesting, "VesterAdded")
                .withArgs(
                    await signers[4].getAddress(),
                    "VC",
                    ethers.utils.parseUnits("1000000", DECIMALS),
                );
        });
    });
    describe("venture claims his vesting", async () => {
        it("venture tries to claim his vesting before the cliff time", async () => {
            await expect(venture.claim()).to.be.revertedWith("Too early");
        });
        
        it("venture tries to claim the first release but there is none so it fails", async () => {
            await expect(venture.claimFirst()).to.be.revertedWith(
                "Too early",
            );
        });

        it("venture claims his first release after cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(49642, "hour").unix()]);
            await expect(venture.claimFirst()).to.emit(vesting, "Claimed")
            .withArgs(ethers.utils.parseUnits("80000", DECIMALS));
        });

        it("venture tries to claim his vesting after the cliff time", async () => {
            await expect(venture.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("94024", DECIMALS));
        });

        it("venture tries to claim 2 months his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(51102, "hour").unix()]);
            await expect(venture.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("188048", DECIMALS));
        });

        it("venture tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(80, "month").unix()]);
            await expect(venture.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("637928", DECIMALS));
        });

        it("venture tries to claim his vesting after he has claimed everything", async () => {
            await ethers.provider.send("evm_mine", [moment().add(81, "month").unix()]);
            await expect(venture.claim()).to.be.revertedWith("Vesting is finished");
        });
    });

    describe("Initialisation of Lea a post ido investor", async () => {
        it("create vesting type", async () => {
            await expect(
                admin2.addVestingType(
                    "IDO",
                    IDO_INIT_RELEASE,
                    IDO_MONTH_RELEASE,
                    IDO_TOTAL_LOCK_TIME,
                    IDO_TIME_BETWEEN_CLAIM,
                    IDO_NUMBER_OF_CLAIMS,
                    1800,
                ),
            )
                .to.emit(vesting, "VestingTypeAdded")
                .withArgs(
                    "IDO",
                    IDO_INIT_RELEASE,
                    IDO_MONTH_RELEASE,
                    IDO_TOTAL_LOCK_TIME,
                    IDO_TIME_BETWEEN_CLAIM,
                    IDO_NUMBER_OF_CLAIMS,
                    1800,
                );
        });

        it("add lea as a vester", async () => {
            await ethers.provider.send("evm_mine", [moment().add(82, "month").unix()]);
            await expect(
                await admin1.addVester(
                    await signers[5].getAddress(),
                    "IDO",
                    ethers.utils.parseUnits("7800", DECIMALS),
                ),
            )
                .to.emit(vesting, "VesterAdded")
                .withArgs(
                    await signers[5].getAddress(),
                    "IDO",
                    ethers.utils.parseUnits("7800", DECIMALS),
                );
        });
    });

    describe("lea claims her vesting", async () => {
        it("lea tries to claim her vesting before the cliff time", async () => {
            await expect(lea.claim()).to.be.revertedWith("Too early");
        });
        
        it("lea tries to claim instantly but fails", async () => {
            await expect(lea.claimFirst()).to.be.revertedWith(
                "Too early",
            );
        });
        it("lea claims her first release", async () => {
            await ethers.provider.send("evm_mine", [moment().add(215656424, "seconds").unix()]);
            await expect(lea.claimFirst()).to.emit(vesting, "Claimed")
            .withArgs(ethers.utils.parseUnits("3900", DECIMALS));
        });
        it("lea tries to claim her vesting before the cliff time", async () => {
            await expect(lea.claimFirst()).to.be.revertedWith("Already claimed");
        });

        it("lea tries to claim her vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(84, "month").unix()]);
            await expect(lea.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("3900", DECIMALS));
        });

        it("lea tries to claim her vesting after she has claimed everything", async () => {
            await ethers.provider.send("evm_mine", [moment().add(85, "month").unix()]);
            await expect(lea.claim()).to.be.revertedWith("Vesting is finished");
        });
    });

    describe("Initialisation of Marketing a post ido investor", async () => {
        it("create vesting type", async () => {
            await ethers.provider.send("evm_mine", [moment().add(87 * MONTH, "seconds").unix()]);
            await expect(
                admin2.addVestingType(
                    "Marketing",
                    MARKETING_INIT_RELEASE,
                    MARKETING_MONTH_RELEASE,
                    MARKETING_TOTAL_LOCK_TIME,
                    MARKETING_TIME_BETWEEN_CLAIM,
                    MARKETING_NUMBER_OF_CLAIMS,
                    43200,
                ),
            )
                .to.emit(vesting, "VestingTypeAdded")
                .withArgs(
                    "Marketing",
                    MARKETING_INIT_RELEASE,
                    MARKETING_MONTH_RELEASE,
                    MARKETING_TOTAL_LOCK_TIME,
                    MARKETING_TIME_BETWEEN_CLAIM,
                    MARKETING_NUMBER_OF_CLAIMS,
                    43200,
                );
        });

        it("add marketing as a vester", async () => {
            await expect(
                await admin1.addVester(
                    await signers[6].getAddress(),
                    "Marketing",
                    ethers.utils.parseUnits("2000000", DECIMALS),
                ),
            )
                .to.emit(vesting, "VesterAdded")
                .withArgs(
                    await signers[6].getAddress(),
                    "Marketing",
                    ethers.utils.parseUnits("2000000", DECIMALS),
                );
        });
    });

    describe("marketing claims his vesting", async () => {
        it("marketing tries to claim his vesting before the cliff time", async () => {
            await expect(marketing.claim()).to.be.revertedWith("Too early");
        });

        it("marketing tries to claim his first release before the cliff time", async () => {
            await expect(marketing.claimFirst()).to.be.revertedWith("Too early");
        });

        it("marketing tries to claim his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(88 * MONTH, "seconds").unix()]);
            await expect(marketing.claim())
            .to.emit(vesting, "Claimed")
            .withArgs(ethers.utils.parseUnits("159936", DECIMALS));
        });

        it("marketing claims his first release", async () => {
            await expect(marketing.claimFirst()).to.emit(vesting, "Claimed")
            .withArgs(ethers.utils.parseUnits("40000", DECIMALS));
        });


        it("marketing tries to claim 2 months of his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(90* MONTH, "seconds").unix()]);
            await expect(marketing.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("319872", DECIMALS));
        });

        it("marketing tries to claim 1 month  of his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(91 * MONTH, "seconds").unix()]);
            await expect(marketing.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("159936", DECIMALS));
        });

        it("marketing tries to claim 1 month  of his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(92 * MONTH, "seconds").unix()]);
            await expect(marketing.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("159936", DECIMALS));
        });

        it("marketing tries to claim 1 month  of his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(93 * MONTH, "seconds").unix()]);
            await expect(marketing.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("159936", DECIMALS));
        });

        it("marketing tries to claim 1 month  of his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(94* MONTH, "seconds").unix()]);
            await expect(marketing.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("159936", DECIMALS));
        });

        it("marketing tries to claim 1 month  of his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(95 * MONTH, "seconds").unix()]);
            await expect(marketing.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("159936", DECIMALS));
        });

        it("marketing tries to claim 1 month  of his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(96 * MONTH, "seconds").unix()]);
            await expect(marketing.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("159936", DECIMALS));
        });

        it("marketing tries to claim 1 month  of his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(97 * MONTH, "seconds").unix()]);
            await expect(marketing.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("159936", DECIMALS));
        });

        it("marketing tries to claim 1 month  of his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(98 * MONTH, "seconds").unix()]);
            await expect(marketing.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("159936", DECIMALS));
        });

        it("marketing tries to claim 1 month  of his vesting after the cliff time", async () => {
            await ethers.provider.send("evm_mine", [moment().add(100 * MONTH, "seconds").unix()]);
            await expect(marketing.claim())
                .to.emit(vesting, "Claimed")
                .withArgs(ethers.utils.parseUnits("200704.0", DECIMALS));
        });

        it("marketing tries to claim 1 month  of his vesting after he has claimed everything", async () => {
            await ethers.provider.send("evm_mine", [moment().add(101* MONTH, "seconds").unix()]);
            await expect(marketing.claim()).to.be.revertedWith("Vesting is finished");
        });
    });
});

