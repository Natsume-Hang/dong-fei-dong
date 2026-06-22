/**
 * illustrations.js - 懂非懂 (DongFeiDong) 状态插图模块
 *
 * 提供 empty / error / loading / noResult 四种状态的内联 SVG 插图，
 * 每个函数返回 HTML 字符串，可直接通过 innerHTML 注入 DOM。
 *
 * 配色方案:
 *   ink:    #2C2A26
 *   accent: #B85C38
 *   muted:  #8A857C
 *   bg:     #F7F5F0
 *
 * 导出: window.Illustrations
 */

;(function () {
  'use strict'

  // ==================== 颜色常量 ====================
  var INK    = '#2C2A26'
  var ACCENT = '#B85C38'
  var MUTED  = '#8A857C'
  var BG     = '#F7F5F0'

  // ==================== 容器样式 ====================
  var WRAPPER_STYLE = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;'

  // ==================== empty(text) ====================

  /**
   * 空状态插图：打开的书本 + 问号
   * @param {string} text - 提示文字
   * @returns {string} HTML 字符串
   */
  function empty(text) {
    text = text || ''
    return '<div style="' + WRAPPER_STYLE + '">'
      + '<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">'
      // 打开的书本
      + '<path d="M60 30 C60 30 40 25 20 28 L20 85 C40 82 60 87 60 87 Z" fill="' + BG + '" stroke="' + INK + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="M60 30 C60 30 80 25 100 28 L100 85 C80 82 60 87 60 87 Z" fill="' + BG + '" stroke="' + INK + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      // 书脊
      + '<line x1="60" y1="30" x2="60" y2="87" stroke="' + INK + '" stroke-width="2"/>'
      // 书页线条（左页）
      + '<line x1="30" y1="42" x2="52" y2="40" stroke="' + MUTED + '" stroke-width="1.5" stroke-linecap="round"/>'
      + '<line x1="30" y1="52" x2="52" y2="50" stroke="' + MUTED + '" stroke-width="1.5" stroke-linecap="round"/>'
      + '<line x1="30" y1="62" x2="48" y2="60" stroke="' + MUTED + '" stroke-width="1.5" stroke-linecap="round"/>'
      // 书页线条（右页）
      + '<line x1="68" y1="40" x2="90" y2="42" stroke="' + MUTED + '" stroke-width="1.5" stroke-linecap="round"/>'
      + '<line x1="68" y1="50" x2="90" y2="52" stroke="' + MUTED + '" stroke-width="1.5" stroke-linecap="round"/>'
      + '<line x1="68" y1="60" x2="86" y2="62" stroke="' + MUTED + '" stroke-width="1.5" stroke-linecap="round"/>'
      // 问号（书本上方）
      + '<text x="60" y="18" text-anchor="middle" font-size="16" font-weight="bold" fill="' + ACCENT + '" font-family="serif">?</text>'
      + '<text x="38" y="22" text-anchor="middle" font-size="11" fill="' + MUTED + '" font-family="serif">?</text>'
      + '<text x="82" y="22" text-anchor="middle" font-size="11" fill="' + MUTED + '" font-family="serif">?</text>'
      + '</svg>'
      + '<p style="margin-top:16px;color:' + MUTED + ';font-size:14px;line-height:1.6;max-width:260px;">' + escapeHtml(text) + '</p>'
      + '</div>'
  }

  // ==================== error(text) ====================

  /**
   * 错误状态插图：破损的卷轴
   * @param {string} text - 错误信息
   * @returns {string} HTML 字符串
   */
  function error(text) {
    text = text || '出了点问题'
    return '<div style="' + WRAPPER_STYLE + '">'
      + '<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">'
      // 卷轴主体
      + '<rect x="25" y="25" width="70" height="70" rx="4" fill="' + BG + '" stroke="' + INK + '" stroke-width="2"/>'
      // 卷轴顶部卷曲
      + '<path d="M25 30 C25 22 35 20 60 20 C85 20 95 22 95 30" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>'
      // 卷轴底部卷曲
      + '<path d="M25 90 C25 98 35 100 60 100 C85 100 95 98 95 90" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>'
      // 裂痕（对角线）
      + '<path d="M45 35 L75 85" stroke="' + ACCENT + '" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="4 3"/>'
      // 碎片
      + '<path d="M55 50 L62 45 L58 55 Z" fill="' + ACCENT + '" opacity="0.6"/>'
      + '<path d="M70 65 L76 60 L73 70 Z" fill="' + ACCENT + '" opacity="0.4"/>'
      // 叹号
      + '<circle cx="60" cy="60" r="12" fill="' + BG + '" stroke="' + ACCENT + '" stroke-width="2"/>'
      + '<line x1="60" y1="53" x2="60" y2="63" stroke="' + ACCENT + '" stroke-width="2.5" stroke-linecap="round"/>'
      + '<circle cx="60" cy="67" r="1.5" fill="' + ACCENT + '"/>'
      + '</svg>'
      + '<p style="margin-top:16px;color:' + ACCENT + ';font-size:14px;line-height:1.6;max-width:260px;">' + escapeHtml(text) + '</p>'
      + '</div>'
  }

  // ==================== loading() ====================

  /**
   * 加载状态插图：旋转的水墨墨滴动画
   * @returns {string} HTML 字符串
   */
  function loading() {
    var animId = 'dfd-loading-' + Math.random().toString(36).slice(2, 8)
    return '<div style="' + WRAPPER_STYLE + '">'
      + '<style>'
      + '@keyframes ' + animId + ' {'
      + '  0%   { transform: rotate(0deg) scale(1); opacity: 0.8; }'
      + '  50%  { transform: rotate(180deg) scale(1.15); opacity: 1; }'
      + '  100% { transform: rotate(360deg) scale(1); opacity: 0.8; }'
      + '}'
      + '</style>'
      + '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation:' + animId + ' 1.2s ease-in-out infinite;">'
      // 墨滴外圈
      + '<circle cx="32" cy="32" r="28" stroke="' + INK + '" stroke-width="2" stroke-dasharray="12 8" opacity="0.3"/>'
      // 墨滴主体
      + '<path d="M32 10 C32 10 48 28 48 38 C48 48 40 54 32 54 C24 54 16 48 16 38 C16 28 32 10 32 10 Z" fill="' + INK + '" opacity="0.15"/>'
      + '<path d="M32 18 C32 18 42 30 42 37 C42 44 37 48 32 48 C27 48 22 44 22 37 C22 30 32 18 32 18 Z" fill="' + INK + '" opacity="0.25"/>'
      // 墨滴高光
      + '<circle cx="28" cy="34" r="3" fill="' + BG + '" opacity="0.6"/>'
      + '</svg>'
      + '<p style="margin-top:16px;color:' + MUTED + ';font-size:14px;">正在加载中...</p>'
      + '</div>'
  }

  // ==================== noResult(text) ====================

  /**
   * 无搜索结果插图：放大镜 + 空旷场景
   * @param {string} text - 提示文字
   * @returns {string} HTML 字符串
   */
  function noResult(text) {
    text = text || '未找到相关内容'
    return '<div style="' + WRAPPER_STYLE + '">'
      + '<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">'
      // 地平线
      + '<line x1="10" y1="90" x2="110" y2="90" stroke="' + MUTED + '" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>'
      // 远山轮廓
      + '<path d="M15 90 L35 70 L50 82 L70 65 L90 80 L105 90" fill="none" stroke="' + MUTED + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>'
      // 放大镜手柄
      + '<line x1="78" y1="78" x2="100" y2="100" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>'
      // 放大镜镜框
      + '<circle cx="62" cy="50" r="22" fill="' + BG + '" stroke="' + INK + '" stroke-width="2.5"/>'
      // 镜片内空白（表示什么都没找到）
      + '<circle cx="62" cy="50" r="16" fill="' + BG + '" stroke="' + MUTED + '" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>'
      // 镜片反光
      + '<path d="M52 40 Q56 36 60 40" fill="none" stroke="' + MUTED + '" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>'
      + '</svg>'
      + '<p style="margin-top:16px;color:' + MUTED + ';font-size:14px;line-height:1.6;max-width:260px;">' + escapeHtml(text) + '</p>'
      + '</div>'
  }

  // ==================== 工具方法 ====================

  /**
   * HTML 转义
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str) return ''
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
    return str.replace(/[&<>"']/g, function (m) { return map[m] })
  }

  // ==================== 注册到全局 ====================
  window.Illustrations = {
    empty: empty,
    error: error,
    loading: loading,
    noResult: noResult
  }
})()
