import { valueToBigNumber } from "@aave/math-utils";
import { Dispatch, useCallback, useEffect, useMemo, useState } from "react";
import { needsUSDTApprovalReset } from "src/utils/usdtHelpers";
import { calculateSignedAmount } from "src/hooks/paraswap/common";
import { SwapState } from "../../types";
import { getProvider } from "src/utils/marketsAndNetworksConfig";
import { useModalContext } from "src/hooks/useModal";
import { ERC20Service } from "@aave/contract-helpers";
import { ethers } from "ethers";
import { useRootStore } from "src/store/root";
import { useShallow } from "zustand/shallow";
import { useWeb3Context } from "src/libs/hooks/useWeb3Context";
import { getErrorTextFromError, TxAction } from "src/ui-config/errorMapping";
import { permitByChainAndToken } from "src/ui-config/permitConfig";
import { ApprovalMethod } from "src/store/walletSlice";
import { defaultAbiCoder, splitSignature } from "ethers/lib/utils";
import { MOCK_SIGNED_HASH } from "src/helpers/useTransactionHandler";

export type SwapTokenApprovalParams = {
    chainId: number,
    token: string,
    decimals: number,
    symbol: string,
    amount: string,
    spender?: string,
    setState: Dispatch<Partial<SwapState>>,
    allowPermit?: boolean,
}

export interface SignedParams {
  signature: string;
  deadline: string;
  amount: string;
  approvedToken: string;
}

export const useSwapTokenApproal = ({
    chainId,
    token,
    symbol,
    amount,
    decimals,
    spender,
    setState,
    allowPermit = true,
}: SwapTokenApprovalParams) => {
    const [approvedAmount, setApprovedAmount] = useState<number | undefined>(undefined);
    const [requiresApprovalReset, setRequiresApprovalReset] = useState(false);
    const [signatureParams, setSignatureParams] = useState<SignedParams | undefined>();

    const {
        approvalTxState,
        setLoadingTxns,
        setTxError,
        setApprovalTxState,
    } = useModalContext();
    const { sendTx, signTxData } = useWeb3Context();


    const [user, generateApproval, estimateGasLimit, walletApprovalMethodPreference, generateSignatureRequest] =
        useRootStore(
        useShallow((state) => [
            state.account,
            state.generateApproval,
            state.estimateGasLimit,
            state.walletApprovalMethodPreference,
            state.generateSignatureRequest,
        ])
    );
    
    const requiresApproval = useMemo(() => {
        if (
            approvedAmount === undefined ||
            approvedAmount === -1 ||
            amount === '0'
        ) {
            return false;
        } else {
            return valueToBigNumber(approvedAmount).isLessThan(valueToBigNumber(amount));
        }
    }, [approvedAmount, amount]);

    // Warning for USDT on Ethereum approval reset
    useEffect(() => {
        const amountToApprove = calculateSignedAmount(amount, decimals, 0);
        const currentApproved = calculateSignedAmount(
            approvedAmount?.toString() || '0',
            decimals,
            0
        );

        if (
            needsUSDTApprovalReset(
                symbol,
                chainId,
                currentApproved,
                amountToApprove
            )
        ) {
            setState({ showUSDTResetWarning: true });
            setRequiresApprovalReset(true);
        } else {
            setState({ showUSDTResetWarning: false });
            setRequiresApprovalReset(false);
        }
    }, [
        symbol,
        chainId,
        approvedAmount,
        amount,
        setState,
        decimals,
    ]);

    const fetchApprovedAmount = useCallback(async () => {
        if (!spender) {
            return;
        }

        setSignatureParams(undefined);
        setApprovalTxState({
            txHash: undefined,
            loading: false,
            success: false,
        });
        setLoadingTxns(true);
        const rpc = getProvider(chainId);
        const erc20Service = new ERC20Service(rpc);
        const approvedTargetAmount = await erc20Service.approvedAmount({
            user,
            token,
            spender,
        });
        setApprovedAmount(approvedTargetAmount);
        setLoadingTxns(false);
        setState({
            actionsLoading: false,
        });
    }, [
        chainId,
        token,
        spender,
        setApprovalTxState,
        decimals,
    ]);

    useEffect(() => {
        if (spender) {
            fetchApprovedAmount();
        }
    }, [fetchApprovedAmount, spender]);

        
    const permitAvailable = permitByChainAndToken[chainId]?.[token];
    const usePermit = allowPermit && walletApprovalMethodPreference === ApprovalMethod.PERMIT && permitAvailable;

    const approval = async () => {
        if (!spender) {
            return;
        }

        const amountToApprove = calculateSignedAmount(amount, decimals, 0);

        // If requires approval reset, reset the approval first
        if (requiresApprovalReset) {
            try {
                // Create direct ERC20 approval transaction for reset to 0 as ERC20Service requires positive amount
                const abi = new ethers.utils.Interface([
                    'function approve(address spender, uint256 amount)',
                ]);
                const encodedData = abi.encodeFunctionData('approve', [spender, '0']);
                const resetTx = {
                    data: encodedData,
                    to: token,
                    from: spender,
                };
                const resetTxWithGasEstimation = await estimateGasLimit(resetTx, chainId);
                setApprovalTxState({ ...approvalTxState, loading: true });
                const resetResponse = await sendTx(resetTxWithGasEstimation);
                await resetResponse.wait(1);
            } catch (error) {
                const parsedError = getErrorTextFromError(error, TxAction.APPROVAL, false);
                setTxError(parsedError);
                setApprovalTxState({
                    txHash: undefined,
                    loading: false,
                });
                setState({
                    actionsLoading: false,
                });
            }
            fetchApprovedAmount().then(() => {
                setApprovalTxState({
                    loading: false,
                    success: false,
                });
            });

            return; // Button will be updated to approve
        }

        const approvalData = {
            spender,
            user,
            token,
            amount: amountToApprove,
        };

        if (usePermit) {
            // Permit approval
            try {

                const deadline = Math.floor(Date.now() / 1000 + 3600).toString();
                const signatureRequest = await generateSignatureRequest(
                    {
                        ...approvalData,
                        deadline,
                    },
                    { chainId: chainId }
                );
                setApprovalTxState({ ...approvalTxState, loading: true });
                const response = await signTxData(signatureRequest);
                const splitedSignature = splitSignature(response);
                const encodedSignature = defaultAbiCoder.encode(
                    ['address', 'address', 'uint256', 'uint256', 'uint8', 'bytes32', 'bytes32'],
                    [
                        approvalData.user,
                        approvalData.spender,
                        approvalData.amount,
                        deadline,
                        splitedSignature.v,
                        splitedSignature.r,
                        splitedSignature.s,
                    ]
                );
                setSignatureParams({
                    signature: encodedSignature,
                    deadline,
                    amount: approvalData.amount,
                    approvedToken: approvalData.spender,
                });
                setApprovalTxState({
                    txHash: MOCK_SIGNED_HASH,
                    loading: false,
                    success: true,
                });
            } catch (error) {
                const parsedError = getErrorTextFromError(error, TxAction.APPROVAL, false);
                setTxError(parsedError);
                setApprovalTxState({
                    txHash: undefined,
                    loading: false,
                });
                setState({
                    actionsLoading: false,
                });
            }
        } else {
            // Direct ERC20 approval transaction
            try {
                const tx = generateApproval(approvalData, {
                    chainId: chainId,
                    amount: amountToApprove,
                });
                const txWithGasEstimation = await estimateGasLimit(tx, chainId);
                setApprovalTxState({ loading: true });
                const response = await sendTx(txWithGasEstimation);
                await response.wait(1);
                fetchApprovedAmount().then(() => {
                    setApprovalTxState({
                        txHash: response.hash,
                        loading: false,
                        success: true,
                    });
                    setTxError(undefined);
                    setState({
                        actionsLoading: false,
                    });
                });
            } catch (error) {
                const parsedError = getErrorTextFromError(error, TxAction.APPROVAL, false);
                setTxError(parsedError);
                setApprovalTxState({
                    txHash: undefined,
                    loading: false,
                });
                setState({
                    actionsLoading: false,
                });
            }
        }
    };

    const [wasApprovalLoading, setWasApprovalLoading] = useState(false);
    useEffect(() => {
        if (approvalTxState.loading) {
            setState({ actionsLoading: true });
            if (!wasApprovalLoading) {
                setWasApprovalLoading(true);
            }
        } else {
            if (wasApprovalLoading) {
                setWasApprovalLoading(false);
                setState({ actionsLoading: false });
            }
        }
    }, [approvalTxState.loading, setState]);

    return {
        requiresApproval,
        requiresApprovalReset,
        signatureParams,
        approval,
        isApprovalLoading: approvalTxState.loading,
        approvalTxState,
        tryPermit: usePermit,
    };
};