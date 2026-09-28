import { useStockStore } from '@/stores/stock'

const TENNENT_QUOTE_URL = 'https://qt.gtimg.cn/q='

interface TencentQuote {
  name: string
  price: number
  changePct: number
  code: string
}

let timer: ReturnType<typeof setInterval> | undefined
let polling = false

/**
 * 解析腾讯行情接口返回
 * v_sh600519="1~贵州茅台~600519~1272.83~1291.50~...";
 * 字段: [1]=名称 [2]=代码 [3]=当前价 [32]=涨跌幅%
 */
function parseTencentQuotes(raw: string): TencentQuote[] {
  const quotes: TencentQuote[] = []

  const regex = /v_(sh|sz|bj)(\d{6})="([^"]*)"/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(raw)) !== null) {
    const [, , code, body] = match
    const parts = body.split('~')

    if (parts.length < 33) continue

    const name = parts[1]
    const price = Number(parts[3])
    const changePct = Number(parts[32])

    if (!Number.isFinite(price)) continue

    quotes.push({
      code,
      name,
      price,
      changePct,
    })
  }

  return quotes
}

async function fetchQuotes(codes: string[]): Promise<TencentQuote[] | null> {
  if (codes.length === 0) return []

  const marketCodes = codes.map((code) => {
    // 6 开头为沪市(sh)，4/8 开头为北交所(bj)，其余(0/1/2/3)为深市(sz)
    const prefix = code.startsWith('6')
      ? 'sh'
      : code.startsWith('4') || code.startsWith('8')
        ? 'bj'
        : 'sz'

    return `${prefix}${code}`
  })

  const url = `${TENNENT_QUOTE_URL}${marketCodes.join(',')}`

  try {
    const response = await fetch(url)

    if (!response.ok) return null

    // 腾讯接口返回 GBK 编码，必须用 GBK 解码，否则中文乱码
    const buffer = await response.arrayBuffer()

    const text = new TextDecoder('gbk').decode(buffer)

    return parseTencentQuotes(text)
  } catch (error) {
    console.error('[stock-quote] fetch failed', error)

    return null
  }
}

/**
 * 拉取一次并更新 store（同时回填股票名称）
 */
export async function refreshStockQuotes(): Promise<TencentQuote[] | null> {
  const stockStore = useStockStore()

  const visible = stockStore.stocks.filter(item => item.visible)

  if (visible.length === 0) return []

  const quotes = await fetchQuotes(visible.map(item => item.code))

  // 行情获取失败（网络/接口异常）：保留现有数据，不更新也不清空
  if (quotes === null) return null

  for (const quote of quotes) {
    stockStore.updateQuote(quote.code, quote.price, quote.changePct)

    // 用接口返回的权威名称回填/修正（含乱码修复）
    const item = stockStore.stocks.find(s => s.code === quote.code)

    if (item && item.name !== quote.name) {
      item.name = quote.name
    }
  }

  return quotes
}

/**
 * 启动行情轮询（默认每 3 秒一次）
 */
export function startStockQuotePolling(intervalMs = 3000) {
  if (timer) return

  // 立即拉一次
  void refreshStockQuotes()

  timer = setInterval(() => {
    if (polling) return

    polling = true

    void refreshStockQuotes().finally(() => {
      polling = false
    })
  }, intervalMs)
}

/**
 * 停止行情轮询
 */
export function stopStockQuotePolling() {
  if (!timer) return

  clearInterval(timer)

  timer = undefined
}
