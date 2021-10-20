import Web3 from 'web3';
import torekkoVesting from "../data/abi/TorekkoVesting.json"
// load user wallet
const web3 = new Web3(Web3.givenProvider)
// load the contract
const address_torekkoVesting = ""
const torekkoVestingSc = new web3.eth.Contract(torekkoVesting, address_torekkoVesting)

async function calls() {
    const newAdmin = ""
    await torekkoVestingSc.methods.voteAddAdmin(newAdmin).call()

    await torekkoVestingSc.methods.addAdmin(newAdmin).call()

    const newNum = 1
    await torekkoVestingSc.methods.voteSetAdmin(newNum).call()
    await torekkoVestingSc.methods.setAdminMin(newNum).call()

    const add = ""
    const vestingType = ""
    const amount = 0
    await torekkoVestingSc.methods.addVester(add, vestingType, amount).call()

    const initialRelease = 800
    const releaseRate = 375
    const totalLockTime = 10000
    const claimPeriod = 1000
    const numberOfClaims_ = 10
    const initialCooldown = 0
    await torekkoVestingSc.methods.addVestingType(vestingType,
        initialRelease,
        releaseRate,
        totalLockTime,
        claimPeriod,
        numberOfClaims_,
        initialCooldown
        ).call()

    await torekkoVestingSc.methods.removeVestingType(vestingType).call()

    await torekkoVestingSc.methods.voteRemoveVester(add).call()

    await torekkoVestingSc.methods.removeVester(add).call()

    await torekkoVestingSc.methods.claim().call()

    await torekkoVestingSc.methods.claimFirst().call()
    

}

call()