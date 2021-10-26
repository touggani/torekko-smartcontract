// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract TRKToken is ERC20 {
    
    address public owner;

    constructor() ERC20("Torekko", "TRK") {
        _mint(msg.sender, 9000000000000000000000000); // 9 millions
        owner = msg.sender;
    }
    
    function setUpCrowdsale(address _crowdsale) external virtual {
        require(msg.sender == owner);
        require(msg.sender != address(0));
        owner = address(0);
        _mint(_crowdsale, 1000000000000000000000000);
    }
}