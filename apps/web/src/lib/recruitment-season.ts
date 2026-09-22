export type RecruitmentSeason = 'autumn' | 'spring'
export type SeasonMode = 'auto' | RecruitmentSeason

export const SEASON_STORAGE_KEY = 'mianshimai-season'

// 招聘活动按中国时区判断：2–6 月春招，7–次年 1 月秋招及补录。
export function getRecruitmentSeason(date = new Date()): RecruitmentSeason {
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', month: 'numeric' }).format(date))
  return month >= 2 && month <= 6 ? 'spring' : 'autumn'
}

export function isSeasonMode(value: unknown): value is SeasonMode {
  return value === 'auto' || value === 'autumn' || value === 'spring'
}

export const seasonContent = {
  autumn: { label: '秋招季', english: 'AUTUMN RECRUITMENT', title: '这个秋天，', emphasis: '让好机会找到你。', subtitle: '把期待，变成下一站。', tag: '秋招准备，现在开始', note: '准备有方向，面试有底气', badge: '向心仪的 OFFER 出发', cta: '开启我的秋招练习', closing: '这个秋天，勇敢迈出下一步。' },
  spring: { label: '春招季', english: 'SPRING RECRUITMENT', title: '这个春天，', emphasis: '让好机会向你生长。', subtitle: '新的开始，正在发生。', tag: '春招焕新，从你开始', note: '新的机会，值得好好准备', badge: '让你的可能性，开始发芽', cta: '开启我的春招练习', closing: '这个春天，让可能变成机会。' },
} as const
