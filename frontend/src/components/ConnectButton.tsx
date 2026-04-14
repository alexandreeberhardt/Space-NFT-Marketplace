import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { sepolia } from "../wagmi.config";

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const isWrongNetwork = isConnected && chainId !== sepolia.id;

  if (!isConnected) {
    return (
      <div className="connect-area">
        {connectors.map((c) => (
          <button key={c.id} onClick={() => connect({ connector: c })}>
            Connect {c.name}
          </button>
        ))}
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="connect-area wrong-network">
        <span>Wrong network</span>
        <button onClick={() => switchChain({ chainId: sepolia.id })}>
          Switch to Sepolia
        </button>
      </div>
    );
  }

  return (
    <div className="connect-area connected">
      <span className="address">{shortenAddress(address!)}</span>
      <button className="disconnect" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
}
