const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ecsign, toRpcSig } = require("ethereumjs-util");

let mockErc20, treasury;
let owner, alice, bob, badguy;

let grants = [];

const verifierAddress = "0x4dECBaA0256Eb8A6608a8A66030fb2BbD3D9Bef1";
const verifierPK =
  "ac0274bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
function signMessage(message, privateKey) {
  const { v, r, s } = ecsign(
    Buffer.from(message.slice(2), "hex"),
    Buffer.from(privateKey, "hex")
  );
  return { v, r, s };
}

describe("Treasury Test", () => {
  it("Set variables", async () => {
    [owner, alice, bob, badguy] = await ethers.getSigners();

    // Deploy the contract
    treasury = await ethers.getContractFactory("OceanDaoTreasury");
    treasury = await treasury.deploy(verifierAddress);
    mockErc20 = await ethers.getContractFactory("MockERC20");
    mockErc20 = await mockErc20.deploy("MOCK", "MOCK");
    await mockErc20.approve(treasury.address, ethers.constants.MaxUint256);
    await treasury.fundTreasury(
      mockErc20.address,
      ethers.utils.parseEther("1000")
    );
    grants = [
      {
        amount: ethers.utils.parseEther("100"),
        recipient: alice.address,
        projectName: "Project 1",
        timeStamp: parseInt(Date.now() / 1000),
        tokenAddress: mockErc20.address,
        roundNumber: 12,
      },
      {
        amount: ethers.utils.parseEther("100"),
        recipient: alice.address,
        projectName: "Project 1",
        timeStamp: parseInt(Date.now() / 1000),
        tokenAddress: mockErc20.address,
        roundNumber: 13,
      },
      {
        amount: ethers.utils.parseEther("200"),
        recipient: bob.address,
        projectName: "Project 2",
        timeStamp: parseInt(Date.now() / 1000),
        tokenAddress: mockErc20.address,
        roundNumber: 13,
      },
    ];
  });
  it("Check mockErc20 balance", async function () {
    const balance = await mockErc20.balanceOf(treasury.address);
    expect(balance.toString()).to.equal(ethers.utils.parseEther("1000"));
  });
  it("Add a signature to each grant object", async function () {
    for (const grant of grants) {
      const message = ethers.utils.solidityKeccak256(
        ["uint256", "address", "string", "uint256", "uint256"],
        [
          grant.roundNumber,
          grant.recipient,
          grant.projectName,
          grant.timeStamp,
          grant.amount,
        ]
      );
      const signedMessage = signMessage(message, verifierPK);
      grant.signedMessage = signedMessage;
    }
  });

  it("Alice should claim Round 12 Project 1 grant", async () => {
    const grant = grants[0];
    await treasury
      .connect(alice)
      .claimGrant(
        grant.roundNumber,
        grant.recipient,
        grant.projectName,
        grant.timeStamp,
        grant.amount,
        grant.tokenAddress,
        grant.signedMessage.v,
        grant.signedMessage.r,
        grant.signedMessage.s
      );
    const balance = await mockErc20.balanceOf(treasury.address);
    expect(balance.toString()).to.equal(ethers.utils.parseEther("900"));

    const aliceBalance = await mockErc20.balanceOf(alice.address);
    expect(aliceBalance.toString()).to.equal(ethers.utils.parseEther("100"));
  });
  it("Alice tries to claim again must revert", async () => {
    const grant = grants[0];
    await expect(
      treasury
        .connect(alice)
        .claimGrant(
          grant.roundNumber,
          grant.recipient,
          grant.projectName,
          grant.timeStamp,
          grant.amount,
          grant.tokenAddress,
          grant.signedMessage.v,
          grant.signedMessage.r,
          grant.signedMessage.s
        )
    ).to.be.revertedWith("Grant already claimed");
  });
  it("Badguy tries to claim Round 13 Project 2 grant", async () => {
    const grant = grants[2];
    await treasury
      .connect(badguy)
      .claimGrant(
        grant.roundNumber,
        grant.recipient,
        grant.projectName,
        grant.timeStamp,
        grant.amount,
        grant.tokenAddress,
        grant.signedMessage.v,
        grant.signedMessage.r,
        grant.signedMessage.s
      );

    const balance = await mockErc20.balanceOf(treasury.address);
    expect(balance.toString()).to.equal(ethers.utils.parseEther("700"));
    const bobBalance = await mockErc20.balanceOf(bob.address);
    expect(bobBalance.toString()).to.equal(ethers.utils.parseEther("200"));
    const badGuyBalance = await mockErc20.balanceOf(badguy.address);
    expect(badGuyBalance.toString()).to.equal("0");
  });
  it("Bob tries to claim after badguy, must revert", async () => {
    const grant = grants[2];
    await expect(
      treasury
        .connect(bob)
        .claimGrant(
          grant.roundNumber,
          grant.recipient,
          grant.projectName,
          grant.timeStamp,
          grant.amount,
          grant.tokenAddress,
          grant.signedMessage.v,
          grant.signedMessage.r,
          grant.signedMessage.s
        )
    ).to.be.revertedWith("Grant already claimed");
  });
  it("Alice tries to claim grant after two weeks, must revert", async () => {
    // time machine starts
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 14]);
    await ethers.provider.send("evm_mine", []);
    // time machine ends

    const grant = grants[1];
    await expect(
      treasury
        .connect(alice)
        .claimGrant(
          grant.roundNumber,
          grant.recipient,
          grant.projectName,
          grant.timeStamp,
          grant.amount,
          grant.tokenAddress,
          grant.signedMessage.v,
          grant.signedMessage.r,
          grant.signedMessage.s
        )
    ).to.be.revertedWith("Timed out");
  });

  it("Owner is able to withdraw funds from the contract", async () => {
    const balance = await mockErc20.balanceOf(owner.address);
    await treasury.withdrawFunds(
      ethers.utils.parseEther("50"),
      mockErc20.address
    );
    const newBalance = await mockErc20.balanceOf(owner.address);
    expect(newBalance.sub(balance).toString()).to.equal(
      ethers.utils.parseEther("50")
    );
  });

  it("Alice is NOT able to withdraw funds from the contract", async () => {
    await expect(
      treasury
        .connect(alice)
        .withdrawFunds(ethers.utils.parseEther("50"), mockErc20.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Owner is able to change the verifier wallet", async () => {
    await treasury.changeVerifierWallet(alice.address);
    expect(await treasury.verifierWallet()).to.equal(alice.address);
  });

  it("Alice is NOT able to change the verifier wallet", async () => {
    await expect(
      treasury.connect(alice).changeVerifierWallet(alice.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });
});
