import { useQuery } from '@tanstack/react-query'
import Decimal from 'decimal.js'
import { RouteInfo } from 'types/jupiter'
import { MANGO_ROUTER_API_URL } from 'utils/constants'
import useJupiterSwapData from './useJupiterSwapData'

type useQuoteRoutesPropTypes = {
  inputMint: string
  outputMint: string
  amount: string
  slippage: number
  swapMode: string
}

const fetchJupiterRoutes = async (
  inputMint = 'So11111111111111111111111111111111111111112',
  outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  amount = 0,
  slippage = 50,
  swapMode = 'ExactIn',
  feeBps = 0
) => {
  {
    const paramsString = new URLSearchParams({
      inputMint: inputMint.toString(),
      outputMint: outputMint.toString(),
      amount: amount.toString(),
      slippageBps: Math.ceil(slippage * 100).toString(),
      feeBps: feeBps.toString(),
      swapMode,
    }).toString()

    const response = await fetch(
      `https://quote-api.jup.ag/v4/quote?${paramsString}`
    )

    const res = await response.json()
    const data = res.data

    return {
      routes: res.data as RouteInfo[],
      bestRoute: (data.length ? data[0] : null) as RouteInfo | null,
    }
  }
}

const fetchMangoRoutes = async (
  inputMint = 'So11111111111111111111111111111111111111112',
  outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  amount = 0,
  slippage = 50,
  swapMode = 'ExactIn',
  feeBps = 0
) => {
  {
    const paramsString = new URLSearchParams({
      inputMint: inputMint.toString(),
      outputMint: outputMint.toString(),
      amount: amount.toString(),
      slippageBps: Math.ceil(slippage * 100).toString(),
      feeBps: feeBps.toString(),
      mode: swapMode,
    }).toString()

    const response = await fetch(
      `${MANGO_ROUTER_API_URL}/swap?wallet=1111111111111111111111111111111111111111111&${paramsString}`
    )

    const res = await response.json()
    const data = res
    return {
      routes: res as RouteInfo[],
      bestRoute: (data.length ? data[0] : null) as RouteInfo | null,
    }
  }
}

const handleGetRoutes = async (
  inputMint = 'So11111111111111111111111111111111111111112',
  outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  amount = 0,
  slippage = 50,
  swapMode = 'ExactIn',
  feeBps = 0
) => {
  const results = await Promise.allSettled([
    fetchMangoRoutes(inputMint, outputMint, amount, slippage, swapMode, feeBps),
    fetchJupiterRoutes(
      inputMint,
      outputMint,
      amount,
      slippage,
      swapMode,
      feeBps
    ),
  ])
  const responses = results
    .filter((x) => x.status === 'fulfilled' && x.value.bestRoute !== null)
    .map((x) => (x as any).value)

  const sortedByBiggestOutAmount = (
    responses as {
      routes: RouteInfo[]
      bestRoute: RouteInfo
    }[]
  ).sort(
    (a, b) => Number(b.bestRoute.outAmount) - Number(a.bestRoute.outAmount)
  )

  return {
    routes: sortedByBiggestOutAmount[0].routes,
    bestRoute: sortedByBiggestOutAmount[0].bestRoute,
  }
}

const useQuoteRoutes = ({
  inputMint,
  outputMint,
  amount,
  slippage,
  swapMode,
}: useQuoteRoutesPropTypes) => {
  const { inputTokenInfo, outputTokenInfo } = useJupiterSwapData()

  const decimals =
    swapMode === 'ExactIn'
      ? inputTokenInfo?.decimals || 6
      : outputTokenInfo?.decimals || 6

  const nativeAmount =
    amount && !Number.isNaN(+amount)
      ? new Decimal(amount).mul(10 ** decimals)
      : new Decimal(0)

  const res = useQuery<{ routes: RouteInfo[]; bestRoute: RouteInfo }, Error>(
    ['swap-routes', inputMint, outputMint, amount, slippage, swapMode],
    async () =>
      handleGetRoutes(
        inputMint,
        outputMint,
        nativeAmount.toNumber(),
        slippage,
        swapMode
      ),
    {
      enabled: amount ? true : false,
    }
  )

  return amount
    ? {
        ...(res.data ?? {
          routes: [],
          bestRoute: undefined,
        }),
        isLoading: res.isLoading,
      }
    : {
        routes: [],
        bestRoute: undefined,
        isLoading: false,
      }
}

export default useQuoteRoutes
