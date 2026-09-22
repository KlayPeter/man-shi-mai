/**
 * 语音识别文本优化器
 */

const FILLER_WORDS: Record<string, string> = {
  嗯嗯: '', 啊啊: '', 呃: '', 额: '', 嗯: '', 啊: '', 哦: '', 诶: '',
  那个: '', 这个: '', 就是说: '', 然后呢: '然后', 就是: ''
}

const TECH_VOCABULARY: Record<string, string> = {
  皮埃奇皮: 'PHP', 皮埃奇匹: 'PHP', 匹埃奇匹: 'PHP',
  杰斯: 'JS', 杰埃斯: 'JS',
  加瓦斯科瑞普特: 'JavaScript', 佳娃四柯瑞普特: 'JavaScript',
  派森: 'Python', 派瑟: 'Python', 爪哇: 'Java',
  西加加: 'C++', C加加: 'C++', C家家: 'C++',
  维优易: 'Vue', V优: 'Vue',
  瑞阿克特: 'React', 瑞艾克特: 'React',
  安格勒: 'Angular',
  斯普林: 'Spring', 斯普林布特: 'SpringBoot',
  姜戈: 'Django', 弗拉斯克: 'Flask',
  诺德: 'Node', 诺德杰斯: 'NodeJS',
  麦艾斯扣欧: 'MySQL', 买艾斯酷欧: 'MySQL',
  摸狗迪比: 'MongoDB', 瑞迪斯: 'Redis',
  扑死构欧: 'PostgreSQL',
  艾皮爱: 'API', 艾皮艾: 'API',
  居特: 'Git', 居特哈布: 'GitHub',
  道克: 'Docker', 库伯内踢死: 'Kubernetes',
  艾奇踢踢匹: 'HTTP', 艾奇踢踢匹艾思: 'HTTPS',
  瑞斯特福: 'RESTful', 瑞斯特: 'REST',
  唉贾克斯: 'Ajax', 杰森: 'JSON'
}

const HOMOPHONE_CORRECTIONS: Record<string, string> = {
  带吗: '代码', 戴马: '代码', 倒入: '导入', 到入: '导入',
  函素: '函数', 返灰值: '返回值',
  用护: '用户', 街口: '接口', 数剧库: '数据库', 服雾器: '服务器',
  虚求: '需求', 原形: '原型', 愿型: '原型',
  叫虎: '交互', 蛇记搞: '设计稿', 眼色: '颜色'
}

const PUNCTUATION_RULES = {
  questionMarkers: ['吗', '呢', '吧', '啊', '为什么', '怎么', '什么', '哪', '谁', '是不是', '能不能', '可不可以', '行不行', '有没有', '好不好', '对不对'],
  endMarkers: ['了', '的', '得', '地', '好', '是', '对', '没有', '可以', '不是', '完成', '结束', '明白', '知道', '清楚'],
  commaMarkers: ['但是', '然后', '接着', '其次', '另外', '同时', '而且', '并且', '因为', '所以', '如果', '那么', '虽然', '不过', '还有']
}

export class SpeechRecognitionOptimizer {
  private context: string
  private profession: string
  private history: string[] = []
  private maxHistoryLength: number
  private vocabulary: Record<string, string>

  constructor(options: { context?: string; profession?: string; maxHistoryLength?: number } = {}) {
    this.context = options.context || 'general'
    this.profession = options.profession || 'general'
    this.maxHistoryLength = options.maxHistoryLength || 10
    this.vocabulary = { ...FILLER_WORDS, ...TECH_VOCABULARY, ...HOMOPHONE_CORRECTIONS }
  }

  optimize(text: string, options: { addPunctuation?: boolean; timeSinceLastFinal?: number } = {}): string {
    if (!text) return ''
    let processed = text.trim().replace(/\s+/g, '').replace(/[\r\n]+/g, '')

    // 移除口语化词汇
    Object.entries(FILLER_WORDS).sort((a, b) => b[0].length - a[0].length).forEach(([filler, replacement]) => {
      processed = processed.replace(new RegExp(filler, 'g'), replacement)
    })

    // 同音字纠错
    Object.entries(HOMOPHONE_CORRECTIONS).sort((a, b) => b[0].length - a[0].length).forEach(([wrong, correct]) => {
      processed = processed.replace(new RegExp(wrong, 'g'), correct)
    })

    // 技术词汇替换
    Object.entries(TECH_VOCABULARY).sort((a, b) => b[0].length - a[0].length).forEach(([spoken, written]) => {
      processed = processed.replace(new RegExp(spoken, 'gi'), written)
    })

    // 移除重复
    processed = processed.replace(/(.)\1{2,}/g, '$1').replace(/(.{2})\1+/g, '$1')

    // 智能标点
    if (options.addPunctuation !== false) {
      processed = this.addSmartPunctuation(processed, options.timeSinceLastFinal || 0)
    }

    // 最终清理
    processed = processed.replace(/\s+/g, '').replace(/([。！？，、；：])\1+/g, '$1').replace(/，([。！？])/g, '$1').replace(/([。！？])，/g, '$1').trim()

    this.history.push(processed)
    if (this.history.length > this.maxHistoryLength) this.history.shift()

    return processed
  }

  private addSmartPunctuation(text: string, timeSinceLastFinal: number): string {
    if (!text || /[。！？，、；：]$/.test(text)) return text

    const isQuestion = PUNCTUATION_RULES.questionMarkers.some(marker => text.includes(marker))
    if (isQuestion) return text + '？'

    const isEnd = PUNCTUATION_RULES.endMarkers.some(marker => text.endsWith(marker))

    if (timeSinceLastFinal > 1500) return text + '。'
    if (timeSinceLastFinal > 800) return text + '，'
    if (isEnd) return text + '。'

    const needsComma = PUNCTUATION_RULES.commaMarkers.some(marker => text.startsWith(marker))
    if (needsComma && this.history.length > 0) return text + '，'

    return text
  }

  clearHistory() {
    this.history = []
  }

  setProfession(profession: string) {
    this.profession = profession
  }

  setContext(context: string) {
    this.context = context
  }
}
