import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

export async function getSigner(account: string): Promise<SignerWithAddress | undefined> {
  const signers = await ethers.getSigners();

  return signers.find((signer) => {
    return account === signer.address;
  });
}
