import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  console.log(`deployer: ${deployer}`);

  const deployedAuctionRouter = await deploy("EncryptedAuctionRouter", {
    from: deployer,
    args: [],
    log: true,
  });
  const deployedTokenFactory = await deploy("ConfidentialERC20Factory", {
    from: deployer,
    args: [],
    log: true,
  });
  const deployedStakeToken = await deploy("PublicERC20", {
    from: deployer,
    args: ["StakeToken", "STK"],
    log: true,
  });
  console.log(`EncryptedAuctionRouter contract: `, deployedAuctionRouter.address);
  console.log(`ConfidentialERC20Factory contract: `, deployedTokenFactory.address);
  console.log(`Stake Token contract: `, deployedStakeToken.address);
};
export default func;
func.id = "deploy_EncryptedAuctionRouter"; // id required to prevent reexecution
func.tags = ["EncryptedAuctionRouter"];
