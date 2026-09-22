import { describe, expect, it } from 'vitest'
import { getRecruitmentSeason, isSeasonMode } from '@/lib/recruitment-season'

describe('招聘季自动主题', () => {
  it.each([
    ['2027-01-31T15:59:59Z', 'autumn'],
    ['2027-01-31T16:00:00Z', 'spring'],
    ['2027-05-01T00:00:00Z', 'spring'],
    ['2027-06-30T15:59:59Z', 'spring'],
    ['2027-06-30T16:00:00Z', 'autumn'],
    ['2026-09-22T00:00:00Z', 'autumn'],
    ['2026-12-31T16:00:00Z', 'autumn'],
  ])('按中国时区在 %s 使用 %s', (date, expected) => {
    expect(getRecruitmentSeason(new Date(date))).toBe(expected)
  })
  it('只接受可用主题模式，损坏的本地偏好不会成为主题名', () => {
    expect(['auto', 'spring', 'autumn'].every(isSeasonMode)).toBe(true)
    expect([null, '', 'winter', {}, 'AUTO'].some(isSeasonMode)).toBe(false)
  })
})
