import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import { mockUser } from "../mock/data";
import { useEvmConnectionReady } from "../hooks/evmConnectionReady";
import { AuctionCreationStep } from "../components/auction-creation/types";
import { TokenCreationStep } from "../components/auction-creation/TokenCreationStep";
import { TokenMintingStep } from "../components/auction-creation/TokenMintingStep";
import { AuctionConfigStep } from "../components/auction-creation/AuctionConfigStep";
import { AuctionDeploymentStep } from "../components/auction-creation/AuctionDeploymentStep";
import "../components/auction-creation/AuctionCreationSteps.css";
import "./CreateAuctionPage.css";
import { useAccount } from "wagmi";
import { TokenApprovalStep } from "../components/auction-creation/TokenApprovalStep";

export function CreateAuctionPage() {
  const isEvmConnectionReady = useEvmConnectionReady();
  const { address: myAddress } = useAccount();
  // const [currentStep, setCurrentStep] = useState<AuctionCreationStep>(
  //   AuctionCreationStep.TOKEN_CREATION
  // );
  // const [completedSteps, setCompletedSteps] = useState<AuctionCreationStep[]>(
  //   []
  // );
  const [currentStep, setCurrentStep] = useState<AuctionCreationStep>(
    AuctionCreationStep.TOKEN_APPROVAL
  );
  const [completedSteps, setCompletedSteps] = useState<AuctionCreationStep[]>([
    AuctionCreationStep.TOKEN_CREATION,
    AuctionCreationStep.TOKEN_MINTING,
    // AuctionCreationStep.AUCTION_DEPLOYMENT,
  ]);
  // const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  // const [mintedAmount, setMintedAmount] = useState<string | null>(null);
  // const [auctionAddress, setAuctionAddress] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<`0x${string}` | null>(
    "0x8db1b18c571Bc5972C969dcDb4EddBB732E87c97"
  );
  const [mintedAmount, setMintedAmount] = useState<bigint | null>(1000n);
  const [auctionAddress, setAuctionAddress] = useState<`0x${string}` | null>(
    "0xde7809497fbd9e4cd8f09a2433e75b736f037e1a"
  );

  const handleStepComplete = (step: AuctionCreationStep) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }

    // Move to next step
    const steps = Object.values(AuctionCreationStep);
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleTokenCreated = (address: `0x${string}`) => {
    setTokenAddress(address);
    handleStepComplete(AuctionCreationStep.TOKEN_CREATION);
  };

  const handleTokensMinted = (amount: bigint) => {
    setMintedAmount(amount);
    handleStepComplete(AuctionCreationStep.TOKEN_MINTING);
  };

  const handleAuctionDeployed = (address: `0x${string}`) => {
    setAuctionAddress(address);
    handleStepComplete(AuctionCreationStep.AUCTION_DEPLOYMENT);
  };

  const handleAuctionCreated = () => {
    handleStepComplete(AuctionCreationStep.AUCTION_CONFIG);
  };

  if (!isEvmConnectionReady || !myAddress) {
    return (
      <>
        <Header user={mockUser} />
        <main className="create-auction-page">
          <div className="connection-message">
            Please connect your wallet to create an auction
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header user={mockUser} />
      <main className="create-auction-page">
        <Link to="/" className="back-button">
          ← Back to Items
        </Link>
        <div className="auction-creation-container">
          <TokenCreationStep
            onComplete={handleTokenCreated}
            isExpanded={currentStep === AuctionCreationStep.TOKEN_CREATION}
            stepNumber={1}
          />

          <TokenMintingStep
            myAddress={myAddress}
            tokenAddress={tokenAddress}
            onComplete={handleTokensMinted}
            isExpanded={currentStep === AuctionCreationStep.TOKEN_MINTING}
            stepNumber={2}
          />

          <AuctionDeploymentStep
            onComplete={handleAuctionDeployed}
            isExpanded={currentStep === AuctionCreationStep.AUCTION_DEPLOYMENT}
            stepNumber={3}
          />

          <TokenApprovalStep
            tokenAddress={tokenAddress}
            mintedAmount={mintedAmount}
            auctionAddress={auctionAddress}
            onComplete={handleAuctionCreated}
            isExpanded={currentStep === AuctionCreationStep.TOKEN_APPROVAL}
            stepNumber={4}
          />

          <AuctionConfigStep
            tokenAddress={tokenAddress}
            mintedAmount={mintedAmount}
            auctionAddress={auctionAddress}
            onComplete={handleAuctionCreated}
            isExpanded={currentStep === AuctionCreationStep.AUCTION_CONFIG}
            stepNumber={5}
          />
        </div>
      </main>
    </>
  );
}
