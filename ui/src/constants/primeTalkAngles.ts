export interface PrimeTalkAngleConfig {
  id: number
  label: string
  category: 'Engagement' | 'Shareable'
  description: string
}

export const PRIME_TALK_ANGLES: PrimeTalkAngleConfig[] = [
  // === Engagement (目的：评论、投票、标签) ===
  { id: 1,  label: '二选一',         category: 'Engagement', description: 'A vs B，你选哪个？' },
  { id: 2,  label: 'Would You Rather', category: 'Engagement', description: '两难选择题' },
  { id: 3,  label: '辩论题',          category: 'Engagement', description: '赞成 vs 不赞成' },
  { id: 4,  label: '讽刺对比',        category: 'Engagement', description: '政客前后矛盾对比' },
  { id: 5,  label: '预测题',          category: 'Engagement', description: '预计未来事件如何收场？' },
  { id: 6,  label: '震惊数字',        category: 'Engagement', description: '夸张数字吸粉' },
  { id: 7,  label: '你站哪边',        category: 'Engagement', description: '不对称冲突立场' },
  { id: 8,  label: '填空题',          category: 'Engagement', description: '空白让观众来填' },
  { id: 9,  label: '比大小',          category: 'Engagement', description: '大马 vs 他国数据对比' },
  { id: 10, label: '怀念题',          category: 'Engagement', description: '怀念某人物/时代结束' },
  { id: 11, label: '本地关联问',      category: 'Engagement', description: '国际事件 → 那大马呢？' },
  { id: 12, label: '快问快答',        category: 'Engagement', description: '3–5题时事测验' },

  // === Shareable (目的：收藏、转发、tag 好友) ===
  { id: 13, label: '语录卡',          category: 'Shareable',  description: '纯引言+点评' },
  { id: 14, label: '数字冲击卡',      category: 'Shareable',  description: '一个巨大数字+一句背景' },
  { id: 15, label: '时间线卡',        category: 'Shareable',  description: '3–5页事件发展轮播' },
  { id: 16, label: '对比卡',          category: 'Shareable',  description: 'Before vs Now' },
  { id: 17, label: '冷知识卡',        category: 'Shareable',  description: '你知道吗？' },
  { id: 18, label: '预言卡',          category: 'Shareable',  description: '收藏这帖，日后来看' },
  { id: 19, label: '前后差图',        category: 'Shareable',  description: '蜜月时机+反讽' },
  { id: 20, label: '一句话解释卡',    category: 'Shareable',  description: '复杂议题一句话解释' },
  { id: 21, label: '人物档案卡',      category: 'Shareable',  description: '简介+4条生平' },
  { id: 22, label: '比喻视觉卡',      category: 'Shareable',  description: '比喻、隐喻、两头蜡烛等' },
  { id: 23, label: '隐藏真相卡',      category: 'Shareable',  description: '主流说X，真相是Y' },
  { id: 24, label: '本地换算卡',      category: 'Shareable',  description: '国际事件 → 你家受多少影响' },
]
