export const isEmpty = (obj: any): boolean => {
  if (obj === null || obj === undefined) return true
  if (typeof obj === 'object') {
    return Object.keys(obj).length === 0
  }
  return false
}

export const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ')
}
