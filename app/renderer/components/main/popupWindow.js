/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const React = require('react')
const Immutable = require('immutable')
const ReactDOM = require('react-dom')
const {StyleSheet, css} = require('aphrodite/no-important')

// Components
const ReduxComponent = require('../reduxComponent')

// Constants
const KeyCodes = require('../../../common/constants/keyCodes')

// Actions
const windowActions = require('../../../../js/actions/windowActions')

// Styles
const globalStyles = require('../styles/global')

const waitForFrame = () => new Promise(resolve => window.requestAnimationFrame(resolve))

async function forceDrawWebview (webview) {
  await waitForFrame()
  webview.style.visibility = 'hidden'
  await waitForFrame()
  webview.style.visibility = ''
  await waitForFrame()
}

class PopupWindow extends React.Component {
  constructor (props) {
    super(props)
    this.onKeyDown = this.onKeyDown.bind(this)
  }

  componentWillUnmount () {
    window.removeEventListener('keydown', this.onKeyDown)
  }

  componentDidMount () {
    window.addEventListener('keydown', this.onKeyDown)

    if (this.props.src) {
      let webview = document.createElement('webview')
      webview.setAttribute('src', this.props.src)
      webview.setAttribute('name', 'browserAction')
      webview.addEventListener('crashed', () => {
        windowActions.setPopupWindowDetail()
      })
      webview.addEventListener('destroyed', () => {
        windowActions.setPopupWindowDetail()
      })
      webview.addEventListener('close', () => {
        windowActions.setPopupWindowDetail()
      })
      webview.addEventListener('did-attach', () => {
        webview.enablePreferredSizeMode(true)
        // Workaround first-draw blankness by forcing hide and show.
        if (!this.hasDrawn) {
          forceDrawWebview(webview)
          this.hasDrawn = true
        }
      })
      webview.addEventListener('load-start', () => {
        this.isLoading = true
      })
      webview.addEventListener('did-finish-load', () => {
        this.isLoading = false
      })
      webview.addEventListener('did-fail-load', () => {
        this.isLoading = false
      })
      webview.addEventListener('did-fail-provisional-load', () => {
        this.isLoading = false
      })
      webview.addEventListener('preferred-size-changed', () => {
        // Don't set size during load as this can flash between different sizes.
        // This seems stable, i.e. preferred-size-changed is also firing after load is complete.
        if (this.isLoading) {
          return
        }
        webview.getPreferredSize((preferredSize) => {
          const width = preferredSize.width
          const height = preferredSize.height
          webview.style.height = height + 'px'
          webview.style.width = width + 'px'

          windowActions.setPopupWindowDetail(Immutable.fromJS({
            left: this.props.left,
            top: this.props.top,
            height: height,
            width: width,
            src: this.props.src
          }))
        })
      })
      ReactDOM.findDOMNode(this).appendChild(webview)
    }
  }

  onKeyDown (e) {
    if (e.keyCode === KeyCodes.ESC) {
      windowActions.setPopupWindowDetail()
    }
  }

  mergeProps (state, ownProps) {
    const currentWindow = state.get('currentWindow')
    const detail = currentWindow.get('popupWindowDetail', Immutable.Map())

    const props = {}
    // used in renderer
    props.width = parseInt(detail.get('width'))
    props.height = parseInt(detail.get('height'))
    props.top = parseInt(detail.get('top'))
    props.left = parseInt(detail.get('left'))

    // used in other functions
    props.src = detail.get('src')

    return props
  }

  render () {
    let style = {}

    if (this.props.top) {
      if (this.props.top + this.props.height < window.innerHeight) {
        style.top = this.props.top
      } else {
        style.bottom = 0
      }
    }

    if (this.props.left) {
      if (this.props.left + this.props.width < window.innerWidth) {
        style.left = this.props.left
      } else {
        style.right = '1em'
      }
    }

    return <div
      data-popup-window
      className={css(
        styles.popupWindow,
        !this.props.width && styles.popupWindow_noSize,
        style.right !== undefined && styles.popupWindow_reverseExpand
      )}
      style={style} />
  }
}

module.exports = ReduxComponent.connect(PopupWindow)

const styles = StyleSheet.create({
  popupWindow: {
    border: `solid 1px ${globalStyles.color.gray}`,
    boxShadow: globalStyles.shadow.flyoutDialogBoxShadow,
    boxSizing: 'border-box',
    color: 'black',
    cursor: 'default',
    display: 'flex',
    fontSize: '11px',
    padding: 0,
    position: 'absolute',
    userSelect: 'none',
    zIndex: globalStyles.zindex.zindexPopupWindow
  },

  popupWindow_noSize: {
    opacity: 0
  },

  popupWindow_reverseExpand: {
    flexDirection: 'row-reverse'
  }
})
