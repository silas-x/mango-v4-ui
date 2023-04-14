import {
  PerpMarket,
  PerpOrderSide,
  PerpOrderType,
  Serum3Market,
  Serum3OrderType,
  Serum3SelfTradeBehavior,
  Serum3Side,
} from '@blockworks-foundation/mango-v4'
import Checkbox from '@components/forms/Checkbox'
import Button from '@components/shared/Button'
import Tooltip from '@components/shared/Tooltip'
import mangoStore from '@store/mangoStore'
import Decimal from 'decimal.js'
import { useTranslation } from 'next-i18next'
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import NumberFormat, {
  NumberFormatValues,
  SourceInfo,
} from 'react-number-format'
import { notify } from 'utils/notifications'
import SpotSlider from './SpotSlider'
import { calculateLimitPriceForMarketOrder } from 'utils/tradeForm'
import Image from 'next/legacy/image'
import { LinkIcon, QuestionMarkCircleIcon } from '@heroicons/react/20/solid'
import Loading from '@components/shared/Loading'
import TabUnderline from '@components/shared/TabUnderline'
import PerpSlider from './PerpSlider'
import useLocalStorageState from 'hooks/useLocalStorageState'
import {
  SIZE_INPUT_UI_KEY,
  SOUND_SETTINGS_KEY,
  TRADE_CHECKBOXES_KEY,
} from 'utils/constants'
import SpotButtonGroup from './SpotButtonGroup'
import PerpButtonGroup from './PerpButtonGroup'
import SolBalanceWarnings from '@components/shared/SolBalanceWarnings'
import useSelectedMarket from 'hooks/useSelectedMarket'
import { floorToDecimal, getDecimalCount } from 'utils/numbers'
import LogoWithFallback from '@components/shared/LogoWithFallback'
import useIpAddress from 'hooks/useIpAddress'
import ButtonGroup from '@components/forms/ButtonGroup'
import TradeSummary from './TradeSummary'
import useMangoAccount from 'hooks/useMangoAccount'
import MaxSizeButton from './MaxSizeButton'
import { INITIAL_SOUND_SETTINGS } from '@components/settings/SoundSettings'
import { Howl } from 'howler'
import { useWallet } from '@solana/wallet-adapter-react'
import { useEnhancedWallet } from '@components/wallet/EnhancedWalletProvider'
import { isMangoError } from 'types'
import InlineNotification from '@components/shared/InlineNotification'

const set = mangoStore.getState().set

const successSound = new Howl({
  src: ['/sounds/swap-success.mp3'],
  volume: 0.5,
})

const DEFAULT_CHECKBOX_SETTINGS = {
  ioc: false,
  post: false,
  margin: true,
}

const AdvancedTradeForm = () => {
  const { t } = useTranslation(['common', 'trade'])
  const { mangoAccount } = useMangoAccount()
  const tradeForm = mangoStore((s) => s.tradeForm)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [tradeFormSizeUi] = useLocalStorageState(SIZE_INPUT_UI_KEY, 'slider')
  const [savedCheckboxSettings, setSavedCheckboxSettings] =
    useLocalStorageState(TRADE_CHECKBOXES_KEY, DEFAULT_CHECKBOX_SETTINGS)
  const { ipAllowed, ipCountry } = useIpAddress()
  const [soundSettings] = useLocalStorageState(
    SOUND_SETTINGS_KEY,
    INITIAL_SOUND_SETTINGS
  )
  const { connected } = useWallet()
  const { handleConnect } = useEnhancedWallet()
  const {
    selectedMarket,
    price: oraclePrice,
    baseLogoURI,
    baseSymbol,
    quoteLogoURI,
    quoteSymbol,
  } = useSelectedMarket()

  const setTradeType = useCallback((tradeType: 'Limit' | 'Market') => {
    set((s) => {
      s.tradeForm.tradeType = tradeType
    })
  }, [])

  const handlePriceChange = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
      set((s) => {
        s.tradeForm.price = e.value
        if (s.tradeForm.baseSize && !Number.isNaN(Number(e.value))) {
          s.tradeForm.quoteSize = (
            (parseFloat(e.value) || 0) * parseFloat(s.tradeForm.baseSize)
          ).toString()
        }
      })
    },
    []
  )

  const handleBaseSizeChange = useCallback(
    (e: NumberFormatValues, info: SourceInfo) => {
      if (info.source !== 'event') return
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

  const handlePostOnlyChange = useCallback(
    (postOnly: boolean) => {
      let ioc = tradeForm.ioc
      if (postOnly) {
        ioc = !postOnly
      }
      set((s) => {
        s.tradeForm.postOnly = postOnly
        s.tradeForm.ioc = ioc
      })
      setSavedCheckboxSettings({
        ...savedCheckboxSettings,
        ioc: ioc,
        post: postOnly,
      })
    },
    [savedCheckboxSettings]
  )

  const handleIocChange = useCallback(
    (ioc: boolean) => {
      let postOnly = tradeForm.postOnly
      if (ioc) {
        postOnly = !ioc
      }
      set((s) => {
        s.tradeForm.ioc = ioc
        s.tradeForm.postOnly = postOnly
      })
      setSavedCheckboxSettings({
        ...savedCheckboxSettings,
        ioc: ioc,
        post: postOnly,
      })
    },
    [savedCheckboxSettings]
  )

  useEffect(() => {
    const { ioc, post } = savedCheckboxSettings
    set((s) => {
      s.tradeForm.ioc = ioc
      s.tradeForm.postOnly = post
    })
  }, [])

  const handleReduceOnlyChange = useCallback((reduceOnly: boolean) => {
    set((s) => {
      s.tradeForm.reduceOnly = reduceOnly
    })
  }, [])

  const handleSetSide = useCallback((side: 'buy' | 'sell') => {
    set((s) => {
      s.tradeForm.side = side
    })
  }, [])

  const handleSetMargin = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSavedCheckboxSettings({
        ...savedCheckboxSettings,
        margin: e.target.checked,
      })

      const { group } = mangoStore.getState()
      const { tradeType, side, price, baseSize, quoteSize } = tradeForm
      const tradePrice = tradeType === 'Market' ? oraclePrice : price

      if (
        !group ||
        !mangoAccount ||
        !tradePrice ||
        !(selectedMarket instanceof Serum3Market)
      ) {
        return
      }

      const isBuySide = side === 'buy'
      const tokenIndex =
        selectedMarket[isBuySide ? 'quoteTokenIndex' : 'baseTokenIndex']
      const balance = mangoAccount.getTokenBalanceUi(
        group.getFirstBankByTokenIndex(tokenIndex)
      )
      const max = Math.max(balance, 0)

      const sizeToCompare = isBuySide ? quoteSize : baseSize
      const isSizeTooLarge = parseFloat(sizeToCompare) > max

      set((s) => {
        if (max <= 0) {
          s.tradeForm.baseSize = ''
          s.tradeForm.quoteSize = ''
          return
        }
        if (isSizeTooLarge) {
          if (isBuySide) {
            s.tradeForm.quoteSize = floorToDecimal(max, tickDecimals).toFixed()
            s.tradeForm.baseSize = floorToDecimal(
              max / Number(tradePrice),
              minOrderDecimals
            ).toFixed()
          } else {
            s.tradeForm.baseSize = floorToDecimal(
              max,
              minOrderDecimals
            ).toFixed()
            s.tradeForm.quoteSize = floorToDecimal(
              max * Number(tradePrice),
              tickDecimals
            ).toFixed()
          }
        }
      })
    },
    [
      mangoAccount,
      oraclePrice,
      savedCheckboxSettings,
      selectedMarket,
      set,
      tradeForm,
    ]
  )

  const [tickDecimals, tickSize] = useMemo(() => {
    const group = mangoStore.getState().group
    if (!group || !selectedMarket) return [1, 0.1]
    let tickSize: number
    if (selectedMarket instanceof Serum3Market) {
      const market = group.getSerum3ExternalMarket(
        selectedMarket.serumMarketExternal
      )
      tickSize = market.tickSize
    } else {
      tickSize = selectedMarket.tickSize
    }
    const tickDecimals = getDecimalCount(tickSize)
    return [tickDecimals, tickSize]
  }, [selectedMarket])

  const [minOrderDecimals, minOrderSize] = useMemo(() => {
    const group = mangoStore.getState().group
    if (!group || !selectedMarket) return [1, 0.1]
    let minOrderSize: number
    if (selectedMarket instanceof Serum3Market) {
      const market = group.getSerum3ExternalMarket(
        selectedMarket.serumMarketExternal
      )
      minOrderSize = market.minOrderSize
    } else {
      minOrderSize = selectedMarket.minOrderSize
    }
    const minOrderDecimals = getDecimalCount(minOrderSize)
    return [minOrderDecimals, minOrderSize]
  }, [selectedMarket])

  /*
   * Updates the limit price on page load
   */
  useEffect(() => {
    if (tradeForm.price === undefined) {
      const group = mangoStore.getState().group
      if (!group || !oraclePrice) return

      set((s) => {
        s.tradeForm.price = oraclePrice.toFixed(tickDecimals)
      })
    }
  }, [oraclePrice, tickDecimals, tradeForm.price])

  /*
   * Updates the price and the quote size when a Market order is selected
   */
  useEffect(() => {
    const group = mangoStore.getState().group
    if (
      tradeForm.tradeType === 'Market' &&
      oraclePrice &&
      selectedMarket &&
      group
    ) {
      if (!isNaN(parseFloat(tradeForm.baseSize))) {
        const baseSize = new Decimal(tradeForm.baseSize)?.toNumber()
        const quoteSize = baseSize * oraclePrice
        set((s) => {
          s.tradeForm.price = oraclePrice.toFixed(tickDecimals)
          s.tradeForm.quoteSize = quoteSize.toFixed(tickDecimals)
        })
      } else {
        set((s) => {
          s.tradeForm.price = oraclePrice.toFixed(tickDecimals)
        })
      }
    }
  }, [oraclePrice, selectedMarket, tickDecimals, tradeForm])

  const handlePlaceOrder = useCallback(async () => {
    const client = mangoStore.getState().client
    const group = mangoStore.getState().group
    const mangoAccount = mangoStore.getState().mangoAccount.current
    const tradeForm = mangoStore.getState().tradeForm
    const actions = mangoStore.getState().actions
    const selectedMarket = mangoStore.getState().selectedMarket.current

    if (!group || !mangoAccount) return
    setPlacingOrder(true)
    try {
      const baseSize = Number(tradeForm.baseSize)
      let price = Number(tradeForm.price)
      if (tradeForm.tradeType === 'Market') {
        const orderbook = mangoStore.getState().selectedMarket.orderbook
        price = calculateLimitPriceForMarketOrder(
          orderbook,
          baseSize,
          tradeForm.side
        )
      }

      if (selectedMarket instanceof Serum3Market) {
        const spotOrderType = tradeForm.ioc
          ? Serum3OrderType.immediateOrCancel
          : tradeForm.postOnly && tradeForm.tradeType !== 'Market'
          ? Serum3OrderType.postOnly
          : Serum3OrderType.limit
        const tx = await client.serum3PlaceOrder(
          group,
          mangoAccount,
          selectedMarket.serumMarketExternal,
          tradeForm.side === 'buy' ? Serum3Side.bid : Serum3Side.ask,
          price,
          baseSize,
          Serum3SelfTradeBehavior.decrementTake,
          spotOrderType,
          Date.now(),
          10
        )
        actions.fetchOpenOrders(true)
        set((s) => {
          s.successAnimation.trade = true
        })
        if (soundSettings['swap-success']) {
          successSound.play()
        }
        notify({
          type: 'success',
          title: 'Transaction successful',
          txid: tx,
        })
      } else if (selectedMarket instanceof PerpMarket) {
        const perpOrderType =
          tradeForm.tradeType === 'Market'
            ? PerpOrderType.market
            : tradeForm.ioc
            ? PerpOrderType.immediateOrCancel
            : tradeForm.postOnly
            ? PerpOrderType.postOnly
            : PerpOrderType.limit
        console.log('perpOrderType', perpOrderType)

        const tx = await client.perpPlaceOrder(
          group,
          mangoAccount,
          selectedMarket.perpMarketIndex,
          tradeForm.side === 'buy' ? PerpOrderSide.bid : PerpOrderSide.ask,
          price,
          Math.abs(baseSize),
          undefined, // maxQuoteQuantity
          Date.now(),
          perpOrderType,
          selectedMarket.reduceOnly || tradeForm.reduceOnly,
          undefined,
          undefined
        )
        actions.fetchOpenOrders(true)
        set((s) => {
          s.successAnimation.trade = true
        })
        if (soundSettings['swap-success']) {
          successSound.play()
        }
        notify({
          type: 'success',
          title: 'Transaction successful',
          txid: tx,
        })
      }
    } catch (e) {
      console.error('Place trade error:', e)
      if (!isMangoError(e)) return
      notify({
        title: 'There was an issue.',
        description: e.message,
        txid: e?.txid,
        type: 'error',
      })
    } finally {
      setPlacingOrder(false)
    }
  }, [])

  const sideNames = useMemo(() => {
    return selectedMarket instanceof PerpMarket
      ? [t('trade:long'), t('trade:short')]
      : [t('buy'), t('sell')]
  }, [selectedMarket, t])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    connected ? handlePlaceOrder() : handleConnect()
  }

  return (
    <div>
      <div className="mt-1.5 px-2 md:mt-0 md:px-4 md:pt-5 lg:mt-5 lg:pt-0">
        <TabUnderline
          activeValue={tradeForm.side}
          values={['buy', 'sell']}
          names={sideNames}
          onChange={(v) => handleSetSide(v as 'buy' | 'sell')}
          small
        />
      </div>
      <div className="px-3 md:px-4">
        <SolBalanceWarnings className="mt-4" />
      </div>
      <div className="mt-1 px-2 md:mt-3 md:px-4">
        <p className="mb-2 text-xs">{t('trade:order-type')}</p>
        <ButtonGroup
          activeValue={tradeForm.tradeType}
          onChange={(tab: 'Limit' | 'Market') => setTradeType(tab)}
          values={['Limit', 'Market']}
        />
      </div>
      <form onSubmit={(e) => handleSubmit(e)}>
        <div className="mt-3 px-3 md:px-4">
          {tradeForm.tradeType === 'Limit' ? (
            <>
              <div className="mb-2 mt-3 flex items-center justify-between">
                <p className="text-xs text-th-fgd-3">
                  {t('trade:limit-price')}
                </p>
              </div>
              <div className="default-transition flex items-center rounded-md border border-th-input-border bg-th-input-bkg p-2 text-sm font-bold text-th-fgd-1 md:hover:border-th-input-border-hover lg:text-base">
                {quoteLogoURI ? (
                  <div className="h-5 w-5 flex-shrink-0">
                    <Image alt="" width="20" height="20" src={quoteLogoURI} />
                  </div>
                ) : (
                  <div className="h-5 w-5 flex-shrink-0">
                    <QuestionMarkCircleIcon className="h-5 w-5 text-th-fgd-3" />
                  </div>
                )}
                <NumberFormat
                  inputMode="decimal"
                  thousandSeparator=","
                  allowNegative={false}
                  isNumericString={true}
                  decimalScale={tickDecimals}
                  name="price"
                  id="price"
                  className="ml-2 w-full bg-transparent font-mono focus:outline-none"
                  placeholder="0.00"
                  value={tradeForm.price}
                  onValueChange={handlePriceChange}
                />
                <div className="text-xs font-normal text-th-fgd-4">
                  {quoteSymbol}
                </div>
              </div>
            </>
          ) : null}
          <MaxSizeButton
            minOrderDecimals={minOrderDecimals}
            tickDecimals={tickDecimals}
            useMargin={savedCheckboxSettings.margin}
          />
          <div className="flex flex-col">
            <div className="default-transition flex items-center rounded-md rounded-b-none border border-th-input-border bg-th-input-bkg p-2 text-sm font-bold text-th-fgd-1 md:hover:z-10 md:hover:border-th-input-border-hover lg:text-base">
              <div className="h-5 w-5 flex-shrink-0">
                <LogoWithFallback
                  alt=""
                  className="z-10 drop-shadow-md"
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
              <NumberFormat
                inputMode="decimal"
                thousandSeparator=","
                allowNegative={false}
                isNumericString={true}
                decimalScale={minOrderDecimals}
                name="base"
                id="base"
                className="ml-2 w-full bg-transparent font-mono focus:outline-none"
                placeholder="0.00"
                value={tradeForm.baseSize}
                onValueChange={handleBaseSizeChange}
              />
              <div className="text-xs font-normal text-th-fgd-4">
                {baseSymbol}
              </div>
            </div>
            <div className="default-transition -mt-[1px] flex items-center rounded-md rounded-t-none border border-th-input-border bg-th-input-bkg p-2 text-sm font-bold text-th-fgd-1 md:hover:border-th-input-border-hover lg:text-base">
              {quoteLogoURI ? (
                <div className="h-5 w-5 flex-shrink-0">
                  <Image alt="" width="20" height="20" src={quoteLogoURI} />
                </div>
              ) : (
                <div className="h-5 w-5 flex-shrink-0">
                  <QuestionMarkCircleIcon className="h-5 w-5 text-th-fgd-3" />
                </div>
              )}
              <NumberFormat
                inputMode="decimal"
                thousandSeparator=","
                allowNegative={false}
                isNumericString={true}
                decimalScale={tickDecimals}
                name="quote"
                id="quote"
                className="ml-2 w-full bg-transparent font-mono focus:outline-none"
                placeholder="0.00"
                value={tradeForm.quoteSize}
                onValueChange={handleQuoteSizeChange}
              />
              <div className="text-xs font-normal text-th-fgd-4">
                {quoteSymbol}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 flex">
          {selectedMarket instanceof Serum3Market ? (
            tradeFormSizeUi === 'slider' ? (
              <SpotSlider
                minOrderDecimals={minOrderDecimals}
                tickDecimals={tickDecimals}
                step={tradeForm.side === 'buy' ? tickSize : minOrderSize}
                useMargin={savedCheckboxSettings.margin}
              />
            ) : (
              <SpotButtonGroup
                minOrderDecimals={minOrderDecimals}
                tickDecimals={tickDecimals}
                useMargin={savedCheckboxSettings.margin}
              />
            )
          ) : tradeFormSizeUi === 'slider' ? (
            <PerpSlider
              minOrderDecimals={minOrderDecimals}
              tickDecimals={tickDecimals}
            />
          ) : (
            <PerpButtonGroup
              minOrderDecimals={minOrderDecimals}
              tickDecimals={tickDecimals}
            />
          )}
        </div>
        <div className="flex flex-wrap px-5 md:flex-nowrap">
          {tradeForm.tradeType === 'Limit' ? (
            <div className="flex">
              <div className="mr-3 mt-4" id="trade-step-six">
                <Tooltip
                  className="hidden md:block"
                  delay={100}
                  placement="left"
                  content={t('trade:tooltip-post')}
                >
                  <Checkbox
                    checked={tradeForm.postOnly}
                    onChange={(e) => handlePostOnlyChange(e.target.checked)}
                  >
                    {t('trade:post')}
                  </Checkbox>
                </Tooltip>
              </div>
              <div className="mr-3 mt-4" id="trade-step-seven">
                <Tooltip
                  className="hidden md:block"
                  delay={100}
                  placement="left"
                  content={t('trade:tooltip-ioc')}
                >
                  <div className="flex items-center text-xs text-th-fgd-3">
                    <Checkbox
                      checked={tradeForm.ioc}
                      onChange={(e) => handleIocChange(e.target.checked)}
                    >
                      IOC
                    </Checkbox>
                  </div>
                </Tooltip>
              </div>
            </div>
          ) : null}
          {selectedMarket instanceof Serum3Market ? (
            <div className="mt-4" id="trade-step-eight">
              <Tooltip
                className="hidden md:block"
                delay={100}
                placement="left"
                content={t('trade:tooltip-enable-margin')}
              >
                <Checkbox
                  checked={savedCheckboxSettings.margin}
                  onChange={handleSetMargin}
                >
                  {t('trade:margin')}
                </Checkbox>
              </Tooltip>
            </div>
          ) : (
            <div className="mr-3 mt-4">
              <Tooltip
                className="hidden md:block"
                delay={100}
                placement="left"
                content={
                  'Reduce will only decrease the size of an open position. This is often used for closing a position.'
                }
              >
                <div className="flex items-center text-xs text-th-fgd-3">
                  <Checkbox
                    checked={tradeForm.reduceOnly}
                    onChange={(e) => handleReduceOnlyChange(e.target.checked)}
                  >
                    {t('trade:reduce-only')}
                  </Checkbox>
                </div>
              </Tooltip>
            </div>
          )}
        </div>
        <div className="mt-6 mb-4 flex px-3 md:px-4">
          {ipAllowed ? (
            <Button
              className={`flex w-full items-center justify-center ${
                !connected
                  ? ''
                  : tradeForm.side === 'buy'
                  ? 'bg-th-up-dark text-white md:hover:bg-th-up'
                  : 'bg-th-down-dark text-white md:hover:bg-th-down'
              }`}
              disabled={connected && (!tradeForm.baseSize || !tradeForm.price)}
              size="large"
              type="submit"
            >
              {!connected ? (
                <div className="flex items-center">
                  <LinkIcon className="mr-2 h-5 w-5" />
                  {t('connect')}
                </div>
              ) : !placingOrder ? (
                <span>
                  {t('trade:place-order', {
                    side:
                      tradeForm.side === 'buy' ? sideNames[0] : sideNames[1],
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
      {tradeForm.tradeType === 'Market' ? (
        <div className="m-4">
          <InlineNotification
            type="warning"
            desc="Use caution with market orders. Liquidity may be low."
          />
        </div>
      ) : null}
      <TradeSummary
        mangoAccount={mangoAccount}
        useMargin={savedCheckboxSettings.margin}
      />
    </div>
  )
}

export default AdvancedTradeForm
