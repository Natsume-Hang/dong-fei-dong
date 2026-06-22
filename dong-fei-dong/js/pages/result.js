/**
 * result.js - 懂非懂 (DongFeiDong) 解读结果页模块
 *
 * 基于 IIFE + PageObject 模式，负责解读结果展示与交互：
 * 1. 从临时状态读取输入文本和类型
 * 2. 编排解读流程：SeedDB → AIInterpreter → CopyrightFilter → CredibilityTag → Store
 * 3. 渲染解读结果（标题、来源、原文、解读、流行文化、相关典故）
 * 4. 收藏、分享、重试、反馈等交互
 *
 * 依赖: window.Logger, window.Store, window.Router, window.Toast, window.Modal
 *       window.SeedDB, window.AIInterpreter, window.CopyrightFilter, window.CredibilityTag
 *       window.DFDState
 * 导出: window.DFDPages.result
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

  /** Toast 提示编号映射 */
  const TOAST_IDS = Object.freeze({
    T3: 'T3', // 取消收藏成功
    T4: 'T4', // 反馈已提交
  })

  // ==================== ResultPage 类 ====================

  class ResultPage extends PageObject {
    constructor() {
      super('#page-result')

      // 缓存 DOM 元素引用
      this.btnBack = this.$('#btn-back')
      this.btnFavorite = this.$('#btn-favorite')
      this.btnShare = this.$('#btn-share-card')
      this.btnRetry = this.$('#btn-retry')

      this.loadingState = this.$('#result-loading')
      this.errorState = this.$('#result-error')
      this.errorMsg = this.$('#result-error-msg')
      this.contentState = this.$('#result-content')

      this.allusionTitle = this.$('#allusion-title')
      this.sourceInfo = this.$('#source-info')
      this.originalText = this.$('#original-text')
      this.interpretationText = this.$('#interpretation-text')
      this.credibilityTag = this.$('#credibility-tag')

      this.popCultureSection = this.$('#pop-culture-section')
      this.popCultureList = this.$('#pop-culture-list')
      this.relatedSection = this.$('#related-section')
      this.relatedList = this.$('#related-list')

      this.feedbackBar = this.$('#feedback-bar')
      this.feedbackBtns = this.$$('.feedback-btn')

      // 当前结果数据
      this._resultData = null
      // 当前结果 ID（用于收藏和反馈去重）
      this._resultId = null

      // 绑定事件
      this._bindEvents()
    }

    // ---- 生命周期 ----

    /**
     * 页面显示时：读取临时状态，启动解读流程
     * 如果已有缓存结果数据（从历史/收藏页跳转），直接渲染，不重新解读
     */
    onShow() {
      const logger = window.Logger
      logger && logger.info('ResultPage', '页面显示')

      // 从临时状态读取输入
      const state = window.DFDState || {}
      const inputText = state.inputText || ''
      const inputType = state.inputType || '通用'
      const cachedResult = state.resultData || null

      if (!inputText) {
        logger && logger.warn('ResultPage', '无输入文本，返回首页')
        window.Router.navigate('home')
        return
      }

      // 如果有缓存结果数据，直接渲染，不重新解读
      if (cachedResult) {
        logger && logger.info('ResultPage', '使用缓存结果数据，跳过重新解读')
        this._resultData = cachedResult
        this._resultId = cachedResult.id || this._generateResultId(inputText, inputType)
        cachedResult.id = this._resultId
        this._renderResult(cachedResult)
        this._updateFavoriteButton()
        this._resetFeedbackButtons()
        return
      }

      // 无缓存，启动完整解读流程
      this._runInterpretation(inputText, inputType)
    }

    /**
     * 页面隐藏时的清理逻辑
     */
    onHide() {
      const logger = window.Logger
      logger && logger.debug('ResultPage', '页面隐藏')
    }

    // ---- 事件绑定 ----

    /**
     * 绑定所有 DOM 事件
     */
    _bindEvents() {
      // 返回按钮：导航到首页并清除临时状态
      if (this.btnBack) {
        this.btnBack.addEventListener('click', () => {
          window.DFDState = {}
          window.Router.navigate('home')
        })
      }

      // 收藏按钮
      if (this.btnFavorite) {
        this.btnFavorite.addEventListener('click', () => {
          this._onFavoriteClick()
        })
      }

      // 分享按钮
      if (this.btnShare) {
        this.btnShare.addEventListener('click', () => {
          this._onShareClick()
        })
      }

      // 重试按钮
      if (this.btnRetry) {
        this.btnRetry.addEventListener('click', () => {
          this._onRetryClick()
        })
      }

      // 反馈按钮
      this.feedbackBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this._onFeedbackClick(btn)
        })
      })
    }

    // ---- 解读流程（核心编排） ----

    /**
     * 执行完整的解读流程
     * SeedDB → AIInterpreter → CopyrightFilter → CredibilityTag → Store
     *
     * @param {string} inputText - 用户输入的文本
     * @param {string} inputType - 输入类型
     */
    async _runInterpretation(inputText, inputType) {
      const logger = window.Logger
      logger && logger.info('ResultPage', '开始解读流程', { inputType, length: inputText.length })

      // 1. 显示加载状态，隐藏内容和错误
      this._showLoading()

      try {
        let resultData = null
        let isSeedMatch = false

        // 2. 先确保 SeedDB 已加载，再查询
        const seedDB = window.SeedDB
        if (seedDB && typeof seedDB.load === 'function') {
          try {
            await seedDB.load()
          } catch (loadErr) {
            logger && logger.warn('ResultPage', 'SeedDB 异步加载失败', loadErr.message)
          }
        }

        if (seedDB && typeof seedDB.search === 'function') {
          try {
            const seedResult = seedDB.search(inputText, inputType)
            // seedResult 结构: { success, data: { primary, related } }
            if (seedResult && seedResult.success && seedResult.data && seedResult.data.primary) {
              const seedRecord = seedResult.data.primary
              // 字段映射：SeedDB 字段 → 统一渲染字段
              resultData = {
                allusion_title: seedRecord.title || seedRecord.allusion_title || '未知典故',
                source: seedRecord.source || '',
                original_text: seedRecord.original_text || seedRecord.summary || '',
                interpretation: seedRecord.detail || seedRecord.interpretation || '',
                pop_culture: seedRecord.pop_culture || [],
                confidence: seedRecord.confidence || 0.95,
                credibility: '高',
                // 保留原始字段供其他模块使用
                _raw: seedRecord,
              }
              // 将 related 附带到 resultData 上，供后续渲染相关典故
              if (seedResult.data.related && seedResult.data.related.length > 0) {
                resultData.related = seedResult.data.related.map(r => ({
                  allusion_title: r.title || r.allusion_title,
                  source: r.source || '',
                  summary: r.summary || '',
                }))
              }
              isSeedMatch = true
              logger && logger.info('ResultPage', '命中种子数据库', { title: resultData.title || resultData.allusion_title })
            }
          } catch (seedErr) {
            logger && logger.warn('ResultPage', 'SeedDB 查询异常', seedErr.message)
          }
        }

        // 3. 未命中种子，调用 AI 解读
        if (!resultData) {
          const aiInterpreter = window.AIInterpreter
          if (aiInterpreter && typeof aiInterpreter.interpret === 'function') {
            try {
              const aiResult = await aiInterpreter.interpret(inputText, inputType)
              // aiResult 结构: { success, data: {...}, error }
              if (aiResult && aiResult.success && aiResult.data) {
                resultData = aiResult.data
                logger && logger.info('ResultPage', 'AI 解读完成')
              } else {
                // AI 返回了错误
                const errMsg = (aiResult && aiResult.error && aiResult.error.message) || 'AI 解读失败'
                logger && logger.warn('ResultPage', 'AI 解读返回错误', errMsg)
                this._showError(errMsg)
                return
              }
            } catch (aiErr) {
              logger && logger.error('ResultPage', 'AI 解读异常', aiErr.message)
              this._showError(aiErr.message || '解读失败，请重试')
              return
            }
          } else {
            logger && logger.error('ResultPage', 'AIInterpreter 模块未加载')
            this._showError('解读服务暂不可用，请稍后重试')
            return
          }
        }

        if (!resultData) {
          this._showError('未能获取解读结果，请重试')
          return
        }

        // 6. 应用版权过滤（使用 filterAIOutput，传入 inputType）
        const copyrightFilter = window.CopyrightFilter
        if (copyrightFilter && typeof copyrightFilter.filterAIOutput === 'function') {
          try {
            // 将 inputType 附加到 resultData 上供 filterAIOutput 使用
            resultData.input_type = inputType
            resultData = copyrightFilter.filterAIOutput(resultData)
            logger && logger.debug('ResultPage', '版权过滤已应用')
          } catch (filterErr) {
            logger && logger.warn('ResultPage', '版权过滤异常', filterErr.message)
          }
        }

        // 7. 计算可信度
        let credibility = '中等'
        if (isSeedMatch) {
          credibility = '高'
        } else if (resultData.credibility) {
          credibility = resultData.credibility
        }
        resultData.credibility = credibility

        // 8. 生成结果 ID
        this._resultId = resultData.id || this._generateResultId(inputText, inputType)
        resultData.id = this._resultId

        // 9. 保存结果数据
        this._resultData = resultData
        window.DFDState = window.DFDState || {}
        window.DFDState.resultData = resultData

        // 10. 渲染结果
        this._renderResult(resultData)

        // 11. 保存到历史记录
        this._saveToHistory(inputText, inputType, resultData)

        // 12. 更新收藏按钮状态
        this._updateFavoriteButton()

        // 13. 重置反馈按钮状态
        this._resetFeedbackButtons()

        // 14. 日志记录
        logger && logger.info('ResultPage', '解读流程完成', {
          id: this._resultId,
          credibility,
          isSeedMatch,
        })

      } catch (err) {
        logger && logger.error('ResultPage', '解读流程异常', err.message)
        this._showError('解读过程中出现错误，请重试')
      }
    }

    // ---- UI 状态切换 ----

    /**
     * 显示加载状态
     */
    _showLoading() {
      if (this.loadingState) this.loadingState.style.display = ''
      if (this.errorState) this.errorState.style.display = 'none'
      if (this.contentState) this.contentState.style.display = 'none'
    }

    /**
     * 显示错误状态
     * @param {string} message - 错误信息
     */
    _showError(message) {
      if (this.loadingState) this.loadingState.style.display = 'none'
      if (this.errorState) this.errorState.style.display = ''
      if (this.contentState) this.contentState.style.display = 'none'

      // 使用插图展示错误信息
      var illustrations = window.Illustrations
      var displayMsg = message || '解读失败，请重试'
      if (this.errorMsg && illustrations) {
        this.errorMsg.innerHTML = illustrations.error(displayMsg)
      } else if (this.errorMsg) {
        this.errorMsg.textContent = displayMsg
      }
    }

    /**
     * 显示内容区域
     */
    _showContent() {
      if (this.loadingState) this.loadingState.style.display = 'none'
      if (this.errorState) this.errorState.style.display = 'none'
      if (this.contentState) this.contentState.style.display = ''
    }

    // ---- 结果渲染 ----

    /**
     * 渲染解读结果到页面
     * @param {object} data - 解读结果数据
     */
    _renderResult(data) {
      const logger = window.Logger

      try {
        // 标题
        if (this.allusionTitle) {
          this.allusionTitle.textContent = data.allusion_title || '未知典故'
        }

        // 来源
        if (this.sourceInfo) {
          this.sourceInfo.textContent = data.source || '来源不详'
        }

        // 原文引用
        if (this.originalText) {
          this.originalText.textContent = data.original_text || ''
        }

        // 解读内容
        if (this.interpretationText) {
          this.interpretationText.textContent = data.interpretation || ''
        }

        // 可信度标签
        this._renderCredibility(data.credibility)

        // 流行文化引用
        this._renderPopCulture(data.pop_culture)

        // 相关典故
        this._renderRelated(data.related)

        // 显示内容区域
        this._showContent()

        logger && logger.debug('ResultPage', '结果渲染完成')
      } catch (err) {
        logger && logger.error('ResultPage', '结果渲染失败', err.message)
        this._showError('结果渲染失败')
      }
    }

    /**
     * 渲染可信度标签
     * @param {string} credibility - 可信度等级
     */
    _renderCredibility(credibility) {
      const logger = window.Logger

      if (this.credibilityTag) {
        // 优先使用 CredibilityTag 组件渲染
        const credibilityTag = window.CredibilityTag
        if (credibilityTag && typeof credibilityTag.render === 'function') {
          try {
            // render(score, container) 直接操作 DOM，不返回字符串
            // credibility 是字符串（'高'/'中等'/'低'），需转换为数值
            const scoreMap = { '高': 0.95, '中等': 0.65, '低': 0.3 }
            const score = scoreMap[credibility] || 0.5
            credibilityTag.render(score, this.credibilityTag)
          } catch (err) {
            logger && logger.warn('ResultPage', 'CredibilityTag 渲染异常，使用降级方案', err.message)
            this.credibilityTag.textContent = credibility || '--'
          }
        } else {
          // 降级：直接显示文本
          this.credibilityTag.textContent = credibility || '--'
        }
      }
    }

    /**
     * 渲染流行文化引用列表
     * seed 记录中 pop_culture 为对象数组: [{work, creator, type, usage}, ...]
     * @param {Array} popCulture - 流行文化引用数组
     */
    _renderPopCulture(popCulture) {
      if (!popCulture || !Array.isArray(popCulture) || popCulture.length === 0) {
        if (this.popCultureSection) this.popCultureSection.style.display = 'none'
        return
      }

      if (this.popCultureSection) this.popCultureSection.style.display = ''
      if (this.popCultureList) {
        this.popCultureList.innerHTML = ''
        popCulture.forEach((item) => {
          const el = document.createElement('div')
          el.className = 'pop-culture-item'

          if (typeof item === 'string') {
            // 兼容字符串格式
            el.textContent = item
          } else if (item && typeof item === 'object') {
            // 标准格式: {work, creator, type, usage}
            const work = item.work || item.title || ''
            const creator = item.creator || item.author || ''
            const type = item.type || ''
            const usage = item.usage || item.text || item.description || ''

            let html = ''
            if (work) {
              html += `<strong class="pop-culture-work">${this._escapeHtml(work)}</strong>`
            }
            if (creator) {
              html += ` <span class="pop-culture-creator">(${this._escapeHtml(creator)})</span>`
            }
            if (type) {
              html += ` <span class="pop-culture-type">[${this._escapeHtml(type)}]</span>`
            }
            if (usage) {
              html += `<p class="pop-culture-usage">${this._escapeHtml(usage)}</p>`
            }
            el.innerHTML = html || JSON.stringify(item)
          } else {
            el.textContent = String(item)
          }

          this.popCultureList.appendChild(el)
        })
      }
    }

    /**
     * 渲染相关典故列表
     * related 项结构: {allusion_title, source, summary}
     * 渲染为可点击条目，点击后搜索该典故
     * @param {Array} related - 相关典故数组
     */
    _renderRelated(related) {
      if (!related || !Array.isArray(related) || related.length === 0) {
        if (this.relatedSection) this.relatedSection.style.display = 'none'
        return
      }

      if (this.relatedSection) this.relatedSection.style.display = ''
      if (this.relatedList) {
        this.relatedList.innerHTML = ''
        related.forEach((item) => {
          const el = document.createElement('div')
          el.className = 'related-item'
          el.style.cursor = 'pointer'

          if (typeof item === 'string') {
            el.textContent = item
          } else if (item && typeof item === 'object') {
            const title = item.allusion_title || item.title || item.name || '未知典故'
            const source = item.source || ''
            const summary = item.summary || ''

            let html = `<strong class="related-item-title">${this._escapeHtml(title)}</strong>`
            if (source) {
              html += ` <span class="related-item-source">(${this._escapeHtml(source)})</span>`
            }
            if (summary) {
              html += `<p class="related-item-summary">${this._escapeHtml(summary)}</p>`
            }
            el.innerHTML = html

            // 点击相关典故：将其标题作为搜索词，重新解读
            el.addEventListener('click', () => {
              const logger = window.Logger
              logger && logger.info('ResultPage', '点击相关典故', { title })
              window.DFDState = window.DFDState || {}
              window.DFDState.inputText = title
              window.DFDState.inputType = '典故'
              window.DFDState.resultData = null
              this._runInterpretation(title, '典故')
            })
          } else {
            el.textContent = String(item)
          }

          this.relatedList.appendChild(el)
        })
      }
    }

    // ---- 收藏功能 ----

    /**
     * 收藏按钮点击回调
     */
    _onFavoriteClick() {
      const logger = window.Logger
      const store = window.Store

      if (!this._resultId || !store) return

      const isFav = store.toggleFavorite(this._resultId)
      this._updateFavoriteButton()

      if (isFav) {
        logger && logger.info('ResultPage', '已添加收藏', this._resultId)
      } else {
        logger && logger.info('ResultPage', '已取消收藏', this._resultId)
        if (window.Toast) {
          window.Toast.showPreset('T3')
        }
      }
    }

    /**
     * 更新收藏按钮状态（☆/★）
     */
    _updateFavoriteButton() {
      if (!this.btnFavorite || !this._resultId) return

      const store = window.Store
      if (store && store.isFavorited(this._resultId)) {
        this.btnFavorite.textContent = '★'
        this.btnFavorite.classList.add('favorited')
      } else {
        this.btnFavorite.textContent = '☆'
        this.btnFavorite.classList.remove('favorited')
      }
    }

    // ---- 分享功能 ----

    /**
     * 分享按钮点击回调：弹出 Modal M2 分享弹窗
     */
    _onShareClick() {
      const logger = window.Logger
      logger && logger.info('ResultPage', '分享功能被点击')

      const cardGen = window.CardGenerator
      if (cardGen && typeof cardGen.share === 'function' && this._resultData) {
        cardGen.share(this._resultData)
      } else {
        // 降级方案：复制文本到剪贴板
        const text = this._resultData
          ? ('【' + (this._resultData.allusion_title || '未知') + '】\n' +
             '出处：' + (this._resultData.source || '') + '\n' +
             '解读：' + (this._resultData.interpretation || '').substring(0, 200) + '\n' +
             '——懂非懂')
          : '懂非懂 · 你好像懂了，又好像没懂'
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            if (window.Toast) window.Toast.showPreset('T3')
          }).catch(function () {
            if (window.Toast) window.Toast.show('复制失败，请手动复制', 'error')
          })
        } else {
          if (window.Toast) window.Toast.show('分享功能暂不可用', 'warning')
        }
      }
    }

    // ---- 重试功能 ----

    /**
     * 重试按钮点击回调
     */
    _onRetryClick() {
      const logger = window.Logger
      logger && logger.info('ResultPage', '点击重新解读')

      const state = window.DFDState || {}
      const inputText = state.inputText || ''
      const inputType = state.inputType || '通用'

      if (inputText) {
        this._runInterpretation(inputText, inputType)
      } else {
        window.Router.navigate('home')
      }
    }

    // ---- 反馈功能 ----

    /**
     * 反馈按钮点击回调
     * "有误" 和 "不完整" 类型会弹出 Modal M1 让用户填写详细反馈
     * "准确" 和 "有帮助" 类型直接提交反馈
     * @param {HTMLElement} btn - 被点击的反馈按钮
     */
    _onFeedbackClick(btn) {
      const logger = window.Logger
      const store = window.Store
      const feedbackType = btn.dataset.feedback

      if (!feedbackType || !this._resultId || !store) return

      // 去重检查
      if (store.hasFeedback(this._resultId, feedbackType)) {
        logger && logger.debug('ResultPage', '已存在相同反馈，跳过', { resultId: this._resultId, type: feedbackType })
        if (window.Toast) {
          window.Toast.show('您已提交过该反馈')
        }
        return
      }

      // "有误" 或 "不完整" 需要弹出 Modal M1 收集详细反馈
      if (feedbackType === 'incorrect' || feedbackType === 'incomplete') {
        const modal = window.Modal
        if (modal && typeof modal.showFeedbackModal === 'function') {
          modal.showFeedbackModal(this._resultId, feedbackType).then(() => {
            // Modal 关闭后，标记反馈按钮为已选
            this.feedbackBtns.forEach((b) => b.classList.remove('selected'))
            btn.classList.add('selected')

            // 保存反馈记录
            store.addFeedback({
              resultId: this._resultId,
              type: feedbackType,
              timestamp: new Date().toISOString(),
            })

            logger && logger.info('ResultPage', '反馈已提交（通过 Modal）', { resultId: this._resultId, type: feedbackType })
          })
        } else {
          // Modal 不可用时降级为直接提交
          this._submitFeedbackDirect(btn, feedbackType)
        }
        return
      }

      // "准确" / "有帮助" 等类型直接提交
      this._submitFeedbackDirect(btn, feedbackType)
    }

    /**
     * 直接提交反馈（不通过 Modal）
     * @param {HTMLElement} btn - 反馈按钮
     * @param {string} feedbackType - 反馈类型
     */
    _submitFeedbackDirect(btn, feedbackType) {
      const logger = window.Logger
      const store = window.Store

      // 高亮选中按钮
      this.feedbackBtns.forEach((b) => b.classList.remove('selected'))
      btn.classList.add('selected')

      // 保存反馈
      store.addFeedback({
        resultId: this._resultId,
        type: feedbackType,
        timestamp: new Date().toISOString(),
      })

      logger && logger.info('ResultPage', '反馈已提交', { resultId: this._resultId, type: feedbackType })

      // 显示提示
      if (window.Toast) {
        window.Toast.showPreset('T4')
      }
    }

    /**
     * 重置反馈按钮状态
     */
    _resetFeedbackButtons() {
      this.feedbackBtns.forEach((btn) => {
        btn.classList.remove('selected')
      })
    }

    // ---- 数据持久化 ----

    /**
     * 保存解读结果到历史记录
     * @param {string} inputText - 输入文本
     * @param {string} inputType - 输入类型
     * @param {object} resultData - 解读结果
     */
    _saveToHistory(inputText, inputType, resultData) {
      const store = window.Store
      const logger = window.Logger

      if (!store) return

      try {
        const historyItem = {
          id: this._resultId,
          inputText: inputText,
          inputType: inputType,
          title: resultData.allusion_title || '未知典故',
          credibility: resultData.credibility || '中等',
          timestamp: new Date().toISOString(),
          resultData: resultData,
        }

        store.addHistory(historyItem)
        logger && logger.debug('ResultPage', '已保存到历史记录', this._resultId)
      } catch (err) {
        logger && logger.error('ResultPage', '保存历史记录失败', err.message)
      }
    }

    // ---- 工具方法 ----

    /**
     * 生成结果 ID
     * @param {string} text
     * @param {string} type
     * @returns {string}
     */
    _generateResultId(text, type) {
      const raw = `${text}_${type}_${Date.now()}`
      let hash = 0
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash |= 0
      }
      return `r_${Math.abs(hash).toString(36)}`
    }

    /**
     * HTML 转义，防止 XSS
     * @param {string} str
     * @returns {string}
     */
    _escapeHtml(str) {
      if (!str) return ''
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
      return str.replace(/[&<>"']/g, (m) => map[m])
    }
  }

  // ==================== 注册到全局 ====================
  window.DFDPages = window.DFDPages || {}
  window.DFDPages.result = new ResultPage()
})()
