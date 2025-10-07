import { TrackAnalyticsHandlers } from '../../analytics/useTrackAnalytics';
import { SwapParams, SwapState } from '../../types';
import { useShallow } from 'zustand/react/shallow';
import { useRootStore } from 'src/store/root';
import { useModalContext } from 'src/hooks/useModal';
import { useWeb3Context } from 'src/libs/hooks/useWeb3Context';
import { TxActionsWrapper } from 'src/components/transactions/TxActionsWrapper';
import { useCallback } from 'react';
import { Trans } from '@lingui/macro';

export const CollateralSwapActionsViaCowAdapters = ({
  params,
  state,
  // setState,
  trackingHandlers,
}: {
  params: SwapParams;
  state: SwapState;
  trackingHandlers: TrackAnalyticsHandlers;
}) => {

  const [user, generateApproval, estimateGasLimit, addTransaction, currentMarketData] =
    useRootStore(
      useShallow((state) => [
        state.account,
        state.generateApproval,
        state.estimateGasLimit,
        state.addTransaction,
        state.currentMarketData,
      ])
    );
  
    const {
    approvalTxState,
    mainTxState,
    loadingTxns,
    setMainTxState,
    setTxError,
    setGasLimit,
    setLoadingTxns,
    setApprovalTxState,
    } = useModalContext();
  
  // const { sendTx } = useWeb3Context();
  
  const approval = async () => {
    // const tx = await collateralSwap(state);
    // await tx.wait(1);
  };


  const fetchApprovedAmount = useCallback(async () => {
  //   if (isCowProtocolRates(state.swapRate)) {
  //     // Check approval to VaultRelayer
  //     setApprovalTxState({
  //       txHash: undefined,
  //       loading: false,
  //       success: false,
  //     });
  //     setLoadingTxns(true);
  //     const rpc = getProvider(state.chainId);
  //     const erc20Service = new ERC20Service(rpc);
  //     const approvedTargetAmount = await erc20Service.approvedAmount({
  //       user,
  //       token: state.sourceToken.addressToSwap,
  //       spender: COW_PROTOCOL_VAULT_RELAYER_ADDRESS[state.chainId as SupportedChainId],
  //     });
  //     setApprovedAmount(approvedTargetAmount);
  //     setLoadingTxns(false);
  //     setState({
  //       actionsLoading: false,
  //     });
  //   }
  }, [
  //   state.chainId,
  //   setLoadingTxns,
  //   user,
  //   state.sourceToken.addressToSwap,
  //   state.swapRate,
  //   setApprovalTxState,
  //   state.useFlashloan,
  //   params.swapType,
  //   currentMarketData,
  ]);

  const action = async () => {
    // const tx = await collateralSwap(state);
    // await tx.wait(1);
  };

  const requiresApproval = false;

return (
    <TxActionsWrapper
      mainTxState={mainTxState}
      approvalTxState={approvalTxState}
      isWrongNetwork={state.isWrongNetwork}
      preparingTransactions={loadingTxns}
      handleAction={action}
      requiresAmount
      amount={state.inputAmount}
      handleApproval={() => approval()}
      requiresApproval={!state.actionsBlocked && requiresApproval}
      actionText={<Trans>Swap</Trans>}
      actionInProgressText={<Trans>Swapping</Trans>}
      errorParams={{
        loading: false,
        disabled: state.actionsBlocked || (!approvalTxState.success && requiresApproval),
        content: <Trans>Swap</Trans>,
        handleClick: action,
      }}
      fetchingData={state.actionsLoading}
      blocked={state.actionsBlocked}
      tryPermit={false}
    />
  );
};
