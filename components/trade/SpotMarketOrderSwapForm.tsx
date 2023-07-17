import mangoStore from '@store/mangoStore'
import NumberFormat, {
  NumberFormatValues,
  SourceInfo,
} from 'react-number-format'
import {
  INPUT_PREFIX_CLASSNAMES,
  INPUT_SUFFIX_CLASSNAMES,
} from './AdvancedTradeForm'
import LogoWithFallback from '@components/shared/LogoWithFallback'
import { LinkIcon, QuestionMarkCircleIcon } from '@heroicons/react/20/solid'
import useSelectedMarket from 'hooks/useSelectedMarket'
import { useWallet } from '@solana/wallet-adapter-react'
import useIpAddress from 'hooks/useIpAddress'
import { useTranslation } from 'next-i18next'
import { FormEvent, useCallback, useMemo, useState } from 'react'
import Loading from '@components/shared/Loading'
import Button from '@components/shared/Button'
import Image from 'next/image'
import useQuoteRoutes from '@components/swap/useQuoteRoutes'
import {
  Serum3Market,
  fetchJupiterTransaction,
} from '@blockworks-foundation/mango-v4'
import Decimal from 'decimal.js'
import { useEnhancedWallet } from '@components/wallet/EnhancedWalletProvider'
import { notify } from 'utils/notifications'
import * as sentry from '@sentry/nextjs'
import { isMangoError } from 'types'
import SwapSlider from '@components/swap/SwapSlider'
import PercentageSelectButtons from '@components/swap/PercentageSelectButtons'
import { SIZE_INPUT_UI_KEY } from 'utils/constants'
import useLocalStorageState from 'hooks/useLocalStorageState'

const set = mangoStore.getState().set
const slippage = 100

function stringToNumberOrZero(s: string): number {
  const n = parseFloat(s)
  if (isNaN(n)) {
    return 0
  }
  return n
}

export default function SpotMarketOrderSwapForm() {
  const { t } = useTranslation(['common', 'trade'])
  const { baseSize, price, quoteSize, side } = mangoStore((s) => s.tradeForm)
  const [placingOrder, setPlacingOrder] = useState(false)
  const { ipAllowed, ipCountry } = useIpAddress()
  const { connected, publicKey } = useWallet()
  const { handleConnect } = useEnhancedWallet()
  const [swapFormSizeUi] = useLocalStorageState(SIZE_INPUT_UI_KEY, 'slider')
  const {
    selectedMarket,
    price: oraclePrice,
    baseLogoURI,
    baseSymbol,
    quoteLogoURI,
    quoteSymbol,
    serumOrPerpMarket,
  } = useSelectedMarket()

  const handleBaseSizeChange = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
      console.log('base size change')

      set((s) => {
        const price =
          s.tradeForm.tradeType === 'Market'
            ? oraclePrice
            : Number(s.tradeForm.price)

        s.tradeForm.baseSize = e.value
        if (price && e.value !== '' && !Number.isNaN(Number(e.value))) {
          s.tradeForm.quoteSize = new Decimal(price).mul(e.value).toFixed()
        } else {
          s.tradeForm.quoteSize = ''
        }
      })
    },
    [oraclePrice]
  )

  const handleQuoteSizeChange = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
      set((s) => {
        const price =
          s.tradeForm.tradeType === 'Market'
            ? oraclePrice
            : Number(s.tradeForm.price)

        s.tradeForm.quoteSize = e.value
        if (price && e.value !== '' && !Number.isNaN(Number(e.value))) {
          s.tradeForm.baseSize = new Decimal(e.value).div(price).toFixed()
        } else {
          s.tradeForm.baseSize = ''
        }
      })
    },
    [oraclePrice]
  )

  console.log('side outer', side)

  const setAmountFromSlider = useCallback(
    (amount: string) => {
      console.log('amount', amount)

      if (side === 'buy') {
        handleQuoteSizeChange(
          { value: amount } as NumberFormatValues,
          { source: 'event' } as SourceInfo
        )
      } else {
        handleBaseSizeChange(
          { value: amount } as NumberFormatValues,
          { source: 'event' } as SourceInfo
        )
      }
    },
    [side]
  )

  const [inputBank, outputBank] = useMemo(() => {
    const group = mangoStore.getState().group
    if (!group || !(selectedMarket instanceof Serum3Market)) return []

    const quoteBank = group?.getFirstBankByTokenIndex(
      selectedMarket.quoteTokenIndex
    )
    const baseBank = group.getFirstBankByTokenIndex(
      selectedMarket.baseTokenIndex
    )

    if (side === 'buy') {
      set((s) => {
        s.swap.inputBank = quoteBank
        s.swap.outputBank = baseBank
      })
      return [quoteBank, baseBank]
    } else {
      set((s) => {
        s.swap.inputBank = baseBank
        s.swap.outputBank = quoteBank
      })
      return [baseBank, quoteBank]
    }
  }, [selectedMarket, side])

  const { bestRoute: selectedRoute, isLoading } = useQuoteRoutes({
    inputMint: inputBank?.mint.toString() || '',
    outputMint: outputBank?.mint.toString() || '',
    amount: side === 'buy' ? quoteSize : baseSize,
    slippage,
    swapMode: 'ExactIn',
    wallet: publicKey?.toBase58(),
  })

  const handlePlaceOrder = useCallback(async () => {
    const client = mangoStore.getState().client
    const group = mangoStore.getState().group
    const mangoAccount = mangoStore.getState().mangoAccount.current
    const { baseSize, quoteSize, side } = mangoStore.getState().tradeForm
    const actions = mangoStore.getState().actions
    const connection = mangoStore.getState().connection

    if (!group || !mangoAccount) return
    console.log('placing order')

    if (
      !mangoAccount ||
      !group ||
      !inputBank ||
      !outputBank ||
      !publicKey ||
      !selectedRoute
    ) {
      console.log(
        mangoAccount,
        group,
        inputBank,
        outputBank,
        publicKey,
        selectedRoute
      )
      return
    }

    setPlacingOrder(true)
    console.log('placing order 2')
    console.log('selected route', selectedRoute)

    const [ixs, alts] = await fetchJupiterTransaction(
      connection,
      selectedRoute,
      publicKey,
      slippage,
      inputBank.mint,
      outputBank.mint
    )

    try {
      const tx = await client.marginTrade({
        group,
        mangoAccount,
        inputMintPk: inputBank.mint,
        amountIn:
          side === 'buy'
            ? stringToNumberOrZero(quoteSize)
            : stringToNumberOrZero(baseSize),
        outputMintPk: outputBank.mint,
        userDefinedInstructions: ixs,
        userDefinedAlts: alts,
        flashLoanType: { swap: {} },
      })
      set((s) => {
        s.successAnimation.swap = true
      })
      // if (soundSettings['swap-success']) {
      //   successSound.play()
      // }
      notify({
        title: 'Transaction confirmed',
        type: 'success',
        txid: tx,
        noSound: true,
      })
      actions.fetchGroup()
      actions.fetchSwapHistory(mangoAccount.publicKey.toString(), 30000)
      await actions.reloadMangoAccount()
      set((s) => {
        s.tradeForm.baseSize = ''
        s.tradeForm.quoteSize = ''
      })
    } catch (e) {
      console.error('onSwap error: ', e)
      sentry.captureException(e)
      if (isMangoError(e)) {
        notify({
          title: 'Transaction failed',
          description: e.message,
          txid: e?.txid,
          type: 'error',
        })
      }
    } finally {
      setPlacingOrder(false)
    }
  }, [inputBank, outputBank, publicKey, selectedRoute])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    connected ? handlePlaceOrder() : handleConnect()
  }

  const disabled =
    (connected && (!baseSize || !price)) ||
    !serumOrPerpMarket ||
    parseFloat(baseSize) < serumOrPerpMarket.minOrderSize ||
    isLoading

  return (
    <>
      <form onSubmit={(e) => handleSubmit(e)}>
        <div className="mt-3 px-3 md:px-4">
          <div className="flex flex-col">
            <div className="relative">
              <NumberFormat
                inputMode="decimal"
                thousandSeparator=","
                allowNegative={false}
                isNumericString={true}
                decimalScale={
                  side === 'buy'
                    ? outputBank?.mintDecimals
                    : inputBank?.mintDecimals
                }
                name="base"
                id="base"
                className="relative flex w-full items-center rounded-md rounded-b-none border border-th-input-border bg-th-input-bkg p-2 pl-9 font-mono text-sm font-bold text-th-fgd-1 focus:z-10 focus:border-th-fgd-4 focus:outline-none md:hover:z-10 md:hover:border-th-input-border-hover md:hover:focus:border-th-fgd-4 lg:text-base"
                placeholder="0.00"
                value={baseSize}
                onValueChange={handleBaseSizeChange}
              />
              <div className={`z-10 ${INPUT_PREFIX_CLASSNAMES}`}>
                <LogoWithFallback
                  alt=""
                  className="drop-shadow-md"
                  width={'24'}
                  height={'24'}
                  src={baseLogoURI || `/icons/${baseSymbol?.toLowerCase()}.svg`}
                  fallback={
                    <QuestionMarkCircleIcon
                      className={`h-5 w-5 text-th-fgd-3`}
                    />
                  }
                />
              </div>
              <div className={`z-10 ${INPUT_SUFFIX_CLASSNAMES}`}>
                {baseSymbol}
              </div>
            </div>
            <div className="relative">
              {quoteLogoURI ? (
                <div className={INPUT_PREFIX_CLASSNAMES}>
                  <Image alt="" width="20" height="20" src={quoteLogoURI} />
                </div>
              ) : (
                <div className={INPUT_PREFIX_CLASSNAMES}>
                  <QuestionMarkCircleIcon className="h-5 w-5 text-th-fgd-3" />
                </div>
              )}
              <NumberFormat
                inputMode="decimal"
                thousandSeparator=","
                allowNegative={false}
                isNumericString={true}
                decimalScale={
                  side === 'buy'
                    ? inputBank?.mintDecimals
                    : outputBank?.mintDecimals
                }
                name="quote"
                id="quote"
                className="-mt-[1px] flex w-full items-center rounded-md rounded-t-none border border-th-input-border bg-th-input-bkg p-2 pl-9 font-mono text-sm font-bold text-th-fgd-1 focus:border-th-fgd-4 focus:outline-none md:hover:border-th-input-border-hover md:hover:focus:border-th-fgd-4 lg:text-base"
                placeholder="0.00"
                value={quoteSize}
                onValueChange={handleQuoteSizeChange}
              />
              <div className={INPUT_SUFFIX_CLASSNAMES}>{quoteSymbol}</div>
            </div>
          </div>
        </div>
        <div className="mt-6 mb-4 flex px-3 md:px-4">
          {swapFormSizeUi === 'slider' ? (
            <SwapSlider
              useMargin={true}
              amount={
                side === 'buy'
                  ? stringToNumberOrZero(quoteSize)
                  : stringToNumberOrZero(baseSize)
              }
              onChange={(v) => setAmountFromSlider(v)}
              step={1 / 10 ** (inputBank?.mintDecimals || 6)}
            />
          ) : (
            <PercentageSelectButtons
              amountIn={side === 'buy' ? quoteSize : baseSize}
              setAmountIn={(v) => setAmountFromSlider(v)}
              useMargin={true}
            />
          )}
        </div>
        <div className="mt-6 mb-4 flex px-3 md:px-4">
          {ipAllowed ? (
            <Button
              className={`flex w-full items-center justify-center ${
                !connected
                  ? ''
                  : side === 'buy'
                  ? 'bg-th-up-dark text-white md:hover:bg-th-up-dark md:hover:brightness-90'
                  : 'bg-th-down-dark text-white md:hover:bg-th-down-dark md:hover:brightness-90'
              }`}
              disabled={disabled}
              size="large"
              type="submit"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <Loading />
                  <span className="hidden sm:block">
                    {t('common:fetching-route')}
                  </span>
                </div>
              ) : !connected ? (
                <div className="flex items-center">
                  <LinkIcon className="mr-2 h-5 w-5" />
                  {t('connect')}
                </div>
              ) : !placingOrder ? (
                <span>
                  {t('trade:place-order', {
                    side: side === 'buy' ? t('buy') : t('sell'),
                  })}
                </span>
              ) : (
                <div className="flex items-center space-x-2">
                  <Loading />
                  <span className="hidden sm:block">
                    {t('trade:placing-order')}
                  </span>
                </div>
              )}
            </Button>
          ) : (
            <Button disabled className="w-full leading-tight" size="large">
              {t('country-not-allowed', {
                country: ipCountry ? `(${ipCountry})` : '',
              })}
            </Button>
          )}
        </div>
      </form>
    </>
  )
}
