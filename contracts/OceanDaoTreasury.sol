//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract OceanDaoTreasury is Ownable {
    using SafeERC20 for IERC20;
    address public verifierWallet;
    uint256 grantDeadline = 2 weeks;
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
        string proposalId,
        uint256 roundNumber,
        address caller,
        uint256 timestamp
    );

    constructor(address _verifierWallet) {
        setVerifierWallet(_verifierWallet);
    }

    /*
     * @dev Set the verifier wallet.
     * @param _verifierWallet The new verifier wallet.
     */
    function setVerifierWallet(address _verifierWallet) public onlyOwner {
        verifierWallet = _verifierWallet;
        emit VerifierWalletSet(verifierWallet);
    }

    /*
     * @dev Withdraw tokens from the treasury.
     * @param _amount The amount of tokens to deposit.
     * @param _token The token to deposit.
     */
    function withdrawFunds(uint256 amount, address token) public onlyOwner {
        IERC20(token).transfer(msg.sender, amount);
        emit TreasuryWithdraw(msg.sender, amount, token);
    }

    function setGrantDeadline(uint256 _grantDeadline) public onlyOwner {
        grantDeadline = _grantDeadline;
    }

    /*
     * @dev Transfers the amount of tokens from message sender to the contract.
     * @param token Token contract address.
     * @param amount Amount of tokens to transfer.
     */
    function fundTreasury(address token, uint256 amount) external payable {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit TreasuryDeposit(msg.sender, amount, token);
    }

    /**
     * @dev Grants the recipient the amount of tokens from the treasury.
     * @param roundNumber The round number.
     * @param recipient The wallet address of the recipient.
     * @param proposalId The proposal id.
     * @param timestamp The timestamp when the message has signed.
     * @param amount The amount of tokens to grant.
     * @param tokenAddress The address of the token.
     * @param v The v value from the signature.
     * @param r The r value from the signature.
     * @param s The s value from the signature.
     */
    function claimGrant(
        uint256 roundNumber,
        address recipient,
        string memory proposalId,
        uint256 timestamp,
        uint256 amount,
        address tokenAddress,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= timestamp + grantDeadline, "Timed out"); // Check if the grant deadline has passed

        bytes32 message = keccak256(
            abi.encodePacked(
                roundNumber,
                recipient,
                proposalId,
                timestamp,
                amount
            )
        );

        require(isGrantClaimed[message] == false, "Grant already claimed"); // Check if grant has already been claimed

        address signer = ecrecover(message, v, r, s);
        require(signer == verifierWallet, "Not authorized"); // Check if the verifier wallet is the signer

        isGrantClaimed[message] = true; // Mark grant as claimed
        emit GrantClaimed( // Emit event
            recipient,
            amount,
            proposalId,
            roundNumber,
            msg.sender,
            block.timestamp
        );
        // transfer funds
        IERC20(tokenAddress).safeTransfer(recipient, amount); // Transfer funds
    }
}
