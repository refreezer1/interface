import { TxErrorType } from 'src/ui-config/errorMapping';

import { SwapState } from '../../types';

export const errorToConsole = (state: SwapState, txError: TxErrorType) => {
  // Enhanced error logging with formatting, coloring and JSON
  // Use %c (CSS) for color in modern browsers
  const errorInfo = {
    errorMessage: txError.error,
    errorRaw: txError.rawError,
    errorAction: txError.txAction,
    inputToken: state.sourceToken.symbol,
    outputToken: state.destinationToken.symbol,
    inputAmount: state.debouncedInputAmount,
    outputAmount: state.debouncedOutputAmount,
    slippage: state.slippage,
    provider: state.provider,
    inputAmountUsd: state.swapRate?.srcSpotUSD,
    outputAmountUsd: state.swapRate?.destSpotUSD,
    chainId: state.chainId,
    side: state.side,
    orderType: state.orderType,
  };

  // Compose readable message with color
  const titleStyle = 'color: #d7263d; font-weight: bold; font-size: 1.2em';
  const sectionStyle = 'color: #1976d2; font-weight: bold;';
  const valueStyle = 'color: #ffffff;';

  console.groupCollapsed('%cAave Swap Error 👻', titleStyle);
  console.info(
    '%cIf you are seeing this error, please share the below with the team via our support channels.\nThank you!\n The Aave team 👻\n',
    valueStyle
  );
  console.info('%cError Summary:', sectionStyle);
  console.info('%c' + JSON.stringify(errorInfo, null, 2), valueStyle);

  if (txError.rawError) {
    console.info('%cRaw Error Object:', sectionStyle);
    try {
      // Try to output the raw error as json if possible
      console.dir(txError.rawError);
    } catch (e) {
      console.info(txError.rawError);
    }
  }
  console.groupEnd();
};
