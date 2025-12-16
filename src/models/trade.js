// Firestore Trade Model Example
export const tradeSchema = {
  id: '', // Firestore auto-id
  account_id: '',
  symbol: '', // e.g., EURUSD
  type: '', // 'long' or 'short'
  entry_price: 0,
  exit_price: 0,
  pnl: 0,
  position_size: 0,
  open_time: '', // timestamp
  close_time: '', // timestamp
  strategy: '',
  confluences: [], // array of strings
  mistake_tags: [], // array of strings
  notes: '',
  images: {
    before: '', // URL
    after: '', // URL
  },
  tradingview_link: '',
  rr_ratio: 0,
  percent_risk: 0,
  emotions: {
    pre: '',
    post: ''
  }
};