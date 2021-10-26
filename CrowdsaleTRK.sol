// SPDX-License-Identifier: MIT
pragma solidity ^0.5.5;

import "@openzeppelin/contracts@2.5.1/crowdsale/Crowdsale.sol";

contract MyCrowdsale is Crowdsale {
    constructor(
        address payable wallet,
        IERC20 token
    )
        Crowdsale(4167, wallet, token)
        public
    {

    }
}