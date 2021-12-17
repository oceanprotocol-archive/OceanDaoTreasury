//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract OceanDaoTreasury is Ownable {
    using SafeERC20 for IERC20;
    address public verifierWallet;
    mapping(bytes32 => bool) public isGrantClaimed;

    event VerifierWalletSet(address oldVerifierWallet);
    event TreasuryDeposit(
        address indexed sender,
        uint256 amount,
        address token
    );
    event TreasuryWithdraw(
        address indexed sender,
        uint256 amount,
        address token
    );
    event GrantClaimed(
        address indexed recipient,
        uint256 amount,
        string projectName,
        uint256 roundNumber,
        address caller,
        uint256 timestamp
    );

    constructor(address _verifierWallet) {
        changeVerifierWallet(_verifierWallet);
    }

    function changeVerifierWallet(address _verifierWallet) public onlyOwner {
        verifierWallet = _verifierWallet;
        emit VerifierWalletSet(verifierWallet);
    }

    function withdrawFunds(uint256 amount, address token) public onlyOwner {
        IERC20(token).transfer(msg.sender, amount);
        emit TreasuryWithdraw(msg.sender, amount, token);
    }

    function fundTreasury(address token, uint256 amount) external payable {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit TreasuryDeposit(msg.sender, amount, token);
    }

    function claimGrant(
        uint256 roundNumber,
        address recipient,
        string memory projectName,
        uint256 timestamp,
        uint256 amount,
        address tokenAddress,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= timestamp + 2 weeks, "Timed out");

        bytes32 message = keccak256(
            abi.encodePacked(
                roundNumber,
                recipient,
                projectName,
                timestamp,
                amount
            )
        );

        require(isGrantClaimed[message] == false, "Grant already claimed");
        address signer = ecrecover(message, v, r, s);
        require(signer == verifierWallet, "Not authorized");

        isGrantClaimed[message] = true;
        emit GrantClaimed(
            recipient,
            amount,
            projectName,
            roundNumber,
            msg.sender,
            block.timestamp
        );
        // transfer funds
        IERC20(tokenAddress).safeTransfer(recipient, amount);
    }
}
