/**
 * home.js - 懂非懂 (DongFeiDong) 首页模块
 *
 * 基于 IIFE + PageObject 模式，负责首页交互逻辑：
 * 1. 输入文本的实时校验与字数统计
 * 2. 类型选择器（含智能推荐）
 * 3. 解读按钮（校验 → 导航到结果页）
 * 4. 每日一辨卡片
 * 5. 热门关键词标签
 *
 * 依赖: window.Logger, window.Store, window.Router, window.Toast
 *       window.SeedDB (seed-data.js), window.DFDState
 * 导出: window.DFDPages.home
 */

;(function () {
  'use strict'

  // ==================== PageObject 基类 ====================

  class PageObject {
    constructor(containerSelector) {
      this.container = document.querySelector(containerSelector)
      if (!this.container) {
        console.warn(`[PO] 页面容器未找到: ${containerSelector}`)
      }
    }
    $(selector) { return this.container ? this.container.querySelector(selector) : null }
    $$(selector) { return this.container ? this.container.querySelectorAll(selector) : null }
    onShow() {}
    onHide() {}
  }

  // ==================== 常量定义 ====================

  /** 输入文本最小字符数（角色名通常较短，放宽到 2 个字符） */
  const MIN_CHARS = 2

  /** 输入文本最大字符数 */
  const MAX_CHARS = 500

  /** 输入校验防抖延迟（毫秒） */
  const VALIDATE_DEBOUNCE = 300

  /** 保存输入防抖延迟（毫秒） */
  const SAVE_INPUT_DEBOUNCE = 1000

  /** 触发智能推荐的最小字符数 */
  const RECOMMEND_MIN_CHARS = 20

  /** 触发非中文提示的最小字符数（避免短文本时频繁弹窗） */
  const MIN_CHARS_DISPLAY_T7 = 10

  /** 中文文本正则（至少包含一个中文字符） */
  const CHINESE_REGEX = /[\u4e00-\u9fff]/

  /** 类型推荐关键词映射 */
  const TYPE_KEYWORDS = Object.freeze({
    '歌词': ['歌', '唱', '曲', '旋律', '歌词', '歌手', '专辑', '音乐', '演唱', '作曲', '作词', '编曲', '副歌', '主歌', '桥段', '和声'],
    '书摘': ['书', '读', '摘', '章', '节', '作者', '小说', '散文', '诗集', '名著', '出版', '读者', '序言', '跋', '引言'],
    '角色名': ['角色', '人物', '主角', '配角', '反派', '动漫', '游戏', '影视', '扮演', '饰演', '性格', '故事线'],
    '典故': ['典故', '出处', '成语', '传说', '典故', '古文', '文言', '诗经', '论语', '孟子', '史记', '左传', '庄子', '老子', '典故出处'],
  })

  // ==================== 工具方法 ====================

  /**
   * 创建防抖函数
   * @param {Function} fn - 需要防抖的函数
   * @param {number} delay - 延迟毫秒数
   * @returns {Function}
   */
  function debounce(fn, delay) {
    let timer = null
    return function (...args) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        fn.apply(this, args)
      }, delay)
    }
  }

  /**
   * 简单的字符串哈希（用于日期种子）
   * @param {string} str
   * @returns {number}
   */
  function simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0 // 转为 32 位整数
    }
    return Math.abs(hash)
  }

  /**
   * 根据文本内容推荐类型
   * @param {string} text - 用户输入的文本
   * @returns {string|null} 推荐的类型名称，无推荐时返回 null
   */
  function recommendType(text) {
    if (!text || text.length < RECOMMEND_MIN_CHARS) return null

    // 统计各类型关键词命中数
    let bestType = null
    let bestScore = 0

    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
      let score = 0
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score++
        }
      }
      if (score > bestScore) {
        bestScore = score
        bestType = type
      }
    }

    // 至少命中一个关键词才推荐
    return bestScore > 0 ? bestType : null
  }

  // ==================== HomePage 类 ====================

  class HomePage extends PageObject {
    /** 触发非中文提示的最小字符数（供实例方法通过 constructor 访问） */
    static MIN_CHARS_DISPLAY_T7 = MIN_CHARS_DISPLAY_T7

    constructor() {
      super('#page-home')

      // 缓存 DOM 元素引用
      this.textarea = this.$('#input-textarea')
      this.charCount = this.$('#char-count')
      this.btnInterpret = this.$('#btn-interpret')
      this.typeChips = this.$$('.type-chip')
      this.typeHint = this.$('#type-hint')
      this.dailyCard = this.$('#daily-debunk-card')
      this.dailyQuestion = this.$('#daily-question')
      this.hotKeywordsSection = this.$('#hot-keywords-section')
      this.hotKeywordTags = this.$('#hot-keyword-tags')

      // 当前选中的类型
      this.selectedType = '通用'

      // 防抖后的方法
      this._debouncedValidate = debounce(() => this._validateInput(), VALIDATE_DEBOUNCE)
      this._debouncedSave = debounce((text) => this._saveInput(text), SAVE_INPUT_DEBOUNCE)

      // 绑定事件
      this._bindEvents()
    }

    // ---- 生命周期 ----

    /**
     * 页面显示时的初始化逻辑
     */
    async onShow() {
      const logger = window.Logger
      logger && logger.info('HomePage', '页面显示')

      // 恢复上次输入
      this._restoreLastInput()

      // 加载每日一辨卡片（异步等待 SeedDB 加载完成）
      await this._loadDailyDebunk()

      // 加载热门关键词（异步等待 SeedDB 加载完成）
      await this._loadHotKeywords()
    }

    /**
     * 页面隐藏时的清理逻辑
     */
    onHide() {
      const logger = window.Logger
      logger && logger.debug('HomePage', '页面隐藏')
    }

    // ---- 事件绑定 ----

    /**
     * 绑定所有 DOM 事件
     */
    _bindEvents() {
      const logger = window.Logger

      // 输入框 input 事件
      if (this.textarea) {
        this.textarea.addEventListener('input', () => {
          this._onInputChange()
        })
      }

      // 类型选择器点击事件
      this.typeChips.forEach((chip) => {
        chip.addEventListener('click', () => {
          this._onTypeChipClick(chip)
        })
      })

      // 解读按钮点击事件
      if (this.btnInterpret) {
        this.btnInterpret.addEventListener('click', () => {
          this._onInterpretClick()
        })
      }

      // 每日一辨卡片点击事件
      if (this.dailyCard) {
        this.dailyCard.addEventListener('click', () => {
          logger && logger.info('HomePage', '点击每日一辨卡片，跳转到每日详情页')
          window.Router.navigate('daily')
        })
      }
    }

    // ---- 输入处理 ----

    /**
     * 输入框内容变化回调
     */
    _onInputChange() {
      const text = this.textarea ? this.textarea.value : ''

      // 更新字数统计
      this._updateCharCount(text)

      // 防抖校验
      this._debouncedValidate()

      // 防抖保存到 Store
      this._debouncedSave(text)

      // 智能类型推荐
      this._checkTypeRecommendation(text)
    }

    /**
     * 更新字数统计显示
     * @param {string} text - 输入文本
     */
    _updateCharCount(text) {
      if (this.charCount) {
        this.charCount.textContent = `${text.length} / ${MAX_CHARS}`
      }
    }

    /**
     * 校验输入文本并更新按钮状态
     * 集成 LangDetect 模块进行中文验证
     */
    _validateInput() {
      const text = this.textarea ? this.textarea.value : ''
      const isValid = this._checkInputValid(text)

      if (this.btnInterpret) {
        this.btnInterpret.disabled = !isValid
      }

      // 非中文文本时通过 LangDetect 显示 Toast T7 提示
      if (text.length >= this.constructor.MIN_CHARS_DISPLAY_T7) {
        const langDetect = window.LangDetect
        if (langDetect && typeof langDetect.validateInput === 'function') {
          const result = langDetect.validateInput(text)
          if (!result.valid && result.reason && window.Toast) {
            // 仅在 reason 指向非中文时显示 T7，避免与字数不足重复提示
            if (result.reason === '当前仅支持简体中文内容') {
              window.Toast.showPreset('T7')
            }
          }
        }
      }

      const logger = window.Logger
      logger && logger.debug('HomePage', `输入校验: ${isValid ? '通过' : '未通过'}`, { length: text.length })
    }

    /**
     * 检查输入是否合法
     * @param {string} text
     * @returns {boolean}
     */
    _checkInputValid(text) {
      if (!text) return false
      if (text.length < MIN_CHARS || text.length > MAX_CHARS) return false
      if (!CHINESE_REGEX.test(text)) return false
      return true
    }

    /**
     * 保存输入到 Store
     * @param {string} text
     */
    _saveInput(text) {
      const store = window.Store
      if (store && text.length > 0) {
        store.setLastInput(text, this.selectedType)
      }
    }

    /**
     * 恢复上次输入内容
     */
    _restoreLastInput() {
      const store = window.Store
      const logger = window.Logger

      if (!store) return

      const lastInput = store.getLastInput()
      if (lastInput && lastInput.text && this.textarea) {
        this.textarea.value = lastInput.text
        this._updateCharCount(lastInput.text)

        // 恢复上次选择的类型
        if (lastInput.type) {
          this.selectedType = lastInput.type
          this._updateTypeChipUI()
        }

        // 触发校验
        this._validateInput()

        logger && logger.debug('HomePage', '已恢复上次输入', { length: lastInput.text.length })
      }
    }

    // ---- 类型选择器 ----

    /**
     * 类型选择器点击回调
     * @param {HTMLElement} chip - 被点击的 chip 元素
     */
    _onTypeChipClick(chip) {
      const type = chip.dataset.type
      if (!type) return

      this.selectedType = type
      this._updateTypeChipUI()

      const logger = window.Logger
      logger && logger.info('HomePage', `类型切换: ${type}`)

      // 保存类型变更
      const text = this.textarea ? this.textarea.value : ''
      if (text.length > 0) {
        this._debouncedSave(text)
      }
    }

    /**
     * 更新类型选择器的 UI 状态
     */
    _updateTypeChipUI() {
      this.typeChips.forEach((chip) => {
        const type = chip.dataset.type
        if (type === this.selectedType) {
          chip.classList.add('selected')
        } else {
          chip.classList.remove('selected')
        }
      })
    }

    /**
     * 检查并执行智能类型推荐
     * @param {string} text - 用户输入的文本
     */
    _checkTypeRecommendation(text) {
      const recommended = recommendType(text)
      const logger = window.Logger

      // 先清除所有推荐标记
      this.typeChips.forEach((chip) => {
        chip.classList.remove('recommended')
        // 移除已有的 "荐" 徽章
        const badge = chip.querySelector('.recommend-badge')
        if (badge) badge.remove()
      })

      if (recommended && recommended !== this.selectedType) {
        // 在推荐类型上显示 "荐" 徽章
        const targetChip = this.container.querySelector(`.type-chip[data-type="${recommended}"]`)
        if (targetChip) {
          targetChip.classList.add('recommended')
          const badge = document.createElement('span')
          badge.className = 'recommend-badge'
          badge.textContent = '荐'
          targetChip.appendChild(badge)
        }

        logger && logger.info('HomePage', `智能推荐类型: ${recommended}`)
      }
    }

    // ---- 解读按钮 ----

    /**
     * 解读按钮点击回调
     */
    _onInterpretClick() {
      const text = this.textarea ? this.textarea.value.trim() : ''
      const logger = window.Logger

      // 校验输入
      if (!this._checkInputValid(text)) {
        logger && logger.warn('HomePage', '解读按钮点击时校验未通过')
        if (window.Toast) {
          window.Toast.show('请输入 2-500 字符的中文文本', 'warning')
        }
        return
      }

      // 简单内容过滤：检查明显不当内容
      if (this._isInappropriateContent(text)) {
        logger && logger.warn('HomePage', '输入内容未通过内容过滤')
        if (window.Toast) {
          window.Toast.show('输入内容不符合要求，请修改后重试', 'warning')
        }
        return
      }

      logger && logger.info('HomePage', '开始解读', { type: this.selectedType, length: text.length })

      // 显示加载状态
      if (this.btnInterpret) {
        this.btnInterpret.disabled = true
        this.btnInterpret.textContent = '正在跳转...'
      }

      // 将输入文本和类型存入临时状态
      window.DFDState = window.DFDState || {}
      window.DFDState.inputText = text
      window.DFDState.inputType = this.selectedType
      window.DFDState.resultData = null

      // 短暂延迟后导航到结果页（让用户看到加载状态）
      setTimeout(() => {
        window.Router.navigate('result')

        // 重置按钮状态（下次回来时 onShow 会重新校验）
        if (this.btnInterpret) {
          this.btnInterpret.textContent = '开始解读'
        }
      }, 300)
    }

    // ---- 每日一辨卡片 ----

    /**
     * 加载今日每日一辨内容
     * 异步方法：先确保 SeedDB 数据已加载，再查询 misconception 类别
     */
    async _loadDailyDebunk() {
      const logger = window.Logger

      try {
        // 确保 SeedDB 数据已加载
        const seedDB = window.SeedDB
        if (seedDB && typeof seedDB.load === 'function') {
          await seedDB.load()
        }

        // 使用日期作为种子
        const today = new Date().toISOString().slice(0, 10)

        if (seedDB && typeof seedDB.getByCategory === 'function') {
          const misconceptions = seedDB.getByCategory('misconception')

          if (misconceptions && misconceptions.length > 0) {
            // 用日期哈希取模，确保每天固定一条
            const index = simpleHash(today) % misconceptions.length
            const item = misconceptions[index]

            if (item && this.dailyQuestion) {
              this.dailyQuestion.textContent = item.question || item.title || '今日辨析加载中...'
              logger && logger.debug('HomePage', `每日一辨已加载: ${item.question || item.title}`)
            }
          } else {
            // 无每日辨析数据，显示 noResult 插图
            var illustrations = window.Illustrations
            if (this.dailyQuestion && illustrations) {
              this.dailyQuestion.textContent = '今日暂无每日一辨'
              // 在卡片内插入插图
              var noResultHtml = illustrations.noResult('今日暂无每日一辨')
              var card = this.dailyCard
              if (card && !card.querySelector('.illustration-no-result')) {
                var wrapper = document.createElement('div')
                wrapper.className = 'illustration-no-result'
                wrapper.innerHTML = noResultHtml
                wrapper.style.padding = '20px'
                card.appendChild(wrapper)
              }
            } else if (this.dailyQuestion) {
              this.dailyQuestion.textContent = '暂无每日辨析内容'
            }
            logger && logger.warn('HomePage', 'misconception 类别数据为空')
          }
        } else {
          if (this.dailyQuestion) {
            this.dailyQuestion.textContent = '数据加载中...'
          }
          logger && logger.debug('HomePage', 'SeedDB 尚未就绪，跳过每日一辨加载')
        }
      } catch (err) {
        logger && logger.error('HomePage', '加载每日一辨失败', err.message)
        if (this.dailyQuestion) {
          this.dailyQuestion.textContent = '加载失败，请稍后重试'
        }
      }
    }

    // ---- 热门关键词 ----

    /**
     * 加载热门关键词标签
     * 异步方法：先确保 SeedDB 数据已加载，再提取关键词
     */
    async _loadHotKeywords() {
      const store = window.Store
      const logger = window.Logger

      if (!store || !this.hotKeywordTags) return

      try {
        // 先尝试从 Store 获取缓存的热门关键词
        let keywords = store.getHotKeywords()

        // 如果 Store 中没有缓存，从 SeedDB 提取关键词
        if (!keywords || keywords.length === 0) {
          const seedDB = window.SeedDB
          if (seedDB && typeof seedDB.load === 'function') {
            await seedDB.load()
          }
          if (seedDB && typeof seedDB.getAll === 'function') {
            const allRecords = seedDB.getAll()
            // 从所有记录中提取关键词并去重
            const keywordSet = new Set()
            allRecords.forEach((record) => {
              if (Array.isArray(record.keywords)) {
                record.keywords.forEach((kw) => keywordSet.add(kw))
              }
            })
            keywords = Array.from(keywordSet).slice(0, 20)
          }
        }

        if (keywords && keywords.length > 0) {
          // 显示热门关键词区域
          if (this.hotKeywordsSection) {
            this.hotKeywordsSection.style.display = ''
          }

          // 清空现有标签
          this.hotKeywordTags.innerHTML = ''

          // 渲染关键词标签
          keywords.forEach((keyword) => {
            const tag = document.createElement('span')
            tag.className = 'hot-keyword-tag'
            tag.textContent = keyword
            tag.addEventListener('click', () => {
              this._onHotKeywordClick(keyword)
            })
            this.hotKeywordTags.appendChild(tag)
          })

          logger && logger.debug('HomePage', `已加载 ${keywords.length} 个热门关键词`)
        } else {
          // 无热门关键词时隐藏区域
          if (this.hotKeywordsSection) {
            this.hotKeywordsSection.style.display = 'none'
          }
        }
      } catch (err) {
        logger && logger.error('HomePage', '加载热门关键词失败', err.message)
      }
    }

    /**
     * 热门关键词点击回调
     * @param {string} keyword - 点击的关键词
     */
    _onHotKeywordClick(keyword) {
      const logger = window.Logger
      logger && logger.info('HomePage', `点击热门关键词: ${keyword}`)

      // 填充到输入框
      if (this.textarea) {
        this.textarea.value = keyword
        this._updateCharCount(keyword)
        this._validateInput()
        this._checkTypeRecommendation(keyword)
      }
    }

    /**
     * 简单内容过滤：检测明显不当内容
     * @param {string} text - 用户输入文本
     * @returns {boolean} 是否为不当内容
     */
    _isInappropriateContent(text) {
      if (!text) return false
      // 检测纯重复字符（如 "啊啊啊啊啊啊..."）
      const repeatPattern = /(.)\1{10,}/
      if (repeatPattern.test(text)) return true
      // 检测纯数字或纯符号
      const nonMeaningful = /^[\d\s\p{P}]+$/u
      if (nonMeaningful.test(text.trim())) return true
      return false
    }
  }

  // ==================== 注册到全局 ====================
  window.DFDPages = window.DFDPages || {}
  window.DFDPages.home = new HomePage()
})()
