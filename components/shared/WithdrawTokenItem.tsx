import { Bank } from '@blockworks-foundation/mango-v4'
import Image from 'next/image'
import { useMemo } from 'react'
import mangoStore from '../../store/state'
import { formatDecimal } from '../../utils/numbers'

const WithdrawTokenItem = ({
  bank,
  onSelect,
}: {
  bank: Bank
  onSelect: (x: any) => void
}) => {
  const { mint, name } = bank
  const mangoAccount = mangoStore((s) => s.mangoAccount.current)
  const jupiterTokens = mangoStore((s) => s.jupiterTokens)

  const logoUri = useMemo(() => {
    let logoURI
    if (jupiterTokens.length) {
      logoURI = jupiterTokens.find(
        (t) => t.address === mint.toString()
      )!.logoURI
    }
    return logoURI
  }, [mint, jupiterTokens])

  return (
    <button
      className="grid w-full grid-cols-2 rounded-md border border-th-bkg-4 px-4 py-3 md:hover:border-th-fgd-4"
      onClick={() => onSelect(name)}
    >
      <div className="col-span-1 flex items-center">
        <div className="mr-2.5 flex flex-shrink-0 items-center">
          <Image
            alt=""
            width="24"
            height="24"
            src={logoUri || `/icons/${name.toLowerCase()}.svg`}
          />
        </div>
        <p className="text-th-fgd-1">{name}</p>
      </div>
      <div className="col-span-1 flex justify-end">
        <p className="text-th-fgd-1">
          {mangoAccount && mangoAccount.getUi(bank) > 0
            ? formatDecimal(mangoAccount.getUi(bank))
            : 0}
        </p>
      </div>
    </button>
  )
}

export default WithdrawTokenItem
