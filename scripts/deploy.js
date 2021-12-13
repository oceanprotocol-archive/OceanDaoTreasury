const hre = require("hardhat");
const { Wallet } = require("ethers");
const ethers = hre.ethers;
require("dotenv").config();

const VERIFIER = "0xb1d71F62bEe34E9Fc349234C201090c33BCdF6DB";

async function main() {
  const url = process.env.NETWORK_RPC_URL;
  if (!url) {
    console.error("Missing NETWORK_RPC_URL. Aborting..");
    return null;
  }
  const provider = new ethers.providers.JsonRpcProvider(url);

  let wallet;
  if (process.env.MNEMONIC) {
    wallet = Wallet.fromMnemonic(process.env.MNEMONIC);
  }
  if (process.env.PRIVATE_KEY) wallet = new Wallet(process.env.PRIVATE_KEY);
  if (!wallet) {
    console.error("Missing MNEMONIC or PRIVATE_KEY. Aborting..");
    return null;
  }
  const owner = wallet.connect(provider);
  const OceanDaoTreasury = await (
    await ethers.getContractFactory("OceanDaoTreasury")
  )
    .connect(owner)
    .deploy(VERIFIER);

  await OceanDaoTreasury.deployed();
  console.log("Treasury deployed to:", OceanDaoTreasury.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
