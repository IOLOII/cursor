import {
    useLayoutEffect,
    useRef,
    useEffect,
    useState,
    useCallback,
} from 'react'
import { faClose, faCog } from '@fortawesome/pro-regular-svg-icons'
import Modal from 'react-modal'

import { useAppSelector, useAppDispatch } from './app/hooks'
import { PaneHolder } from './components/pane'
import * as gs from './features/globalSlice'
import * as cs from './features/chat/chatSlice'
import * as ct from './features/chat/chatThunks'
import * as ts from './features/tools/toolSlice'
import * as csel from './features/chat/chatSelectors'
import * as tsel from './features/tools/toolSelectors'
import * as gsel from './features/selectors'

import {
    getFolders,
    getPaneStateBySplits,
    getZoomFactor,
    getRootPath,
    getFocusedTab,
} from './features/selectors'

import _ from 'lodash'

import { ChatPopup, CommandBar } from './components/markdown'
import { SettingsPopup } from './components/settingsPane'
import { FeedbackArea, LeftSide } from './components/search'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { WelcomeScreen } from './components/welcomeScreen'
import { TitleBar } from './components/titlebar'
import { BottomTerminal } from './components/terminal'
import { throttleCallback } from './components/componentUtils'

const customStyles = {
    overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        zIndex: 10000,
    },
    content: {
        padding: 'none',
        top: '150px',
        bottom: 'none',
        background: 'none',
        border: 'none',
        width: 'auto',
        height: 'auto',
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: '700px',
    },
}

function ErrorPopup() {
    const showError = useAppSelector(gsel.getShowErrors)
    const dispatch = useAppDispatch()

    return (
        <Modal
            isOpen={showError}
            onRequestClose={() => {
                dispatch(gs.closeError(null))
            }}
            style={customStyles}
        >
            <div className="errorPopup">
                <div className="errorPopup__title">
                    <div className="errorPopup__title_text">
                        We ran into a problem
                    </div>
                    <div
                        className="errorPopup__title_close"
                        onClick={() => dispatch(gs.closeError(null))}
                    >
                        <FontAwesomeIcon icon={faClose} />
                    </div>
                </div>
                <div className="errorPopup__body">
                    Something unexpected happened. Please try again later. If this continues, please contact michael@cursor.so.
                    <br />
                </div>
            </div>
        </Modal>
    )
}

function RateLimitPopup() {
    const showError = useAppSelector(gsel.getShowRateLimit)
    const dispatch = useAppDispatch()

    return (
        <Modal
            isOpen={showError}
            onRequestClose={() => {
                dispatch(gs.closeRateLimit())
            }}
            style={customStyles}
        >
            <div className="errorPopup">
                <div className="errorPopup__title">
                    <div className="errorPopup__title_text">
                        You're going a bit fast...
                    </div>
                    <div
                        className="errorPopup__title_close"
                        onClick={() => dispatch(gs.closeError(null))}
                    >
                        <FontAwesomeIcon icon={faClose} />
                    </div>
                </div>
                <div className="errorPopup__body">
                    It seems like you're making a high rate of requests. Please
                    slow down and try again in a minute or so. If you believe
                    this is an error, contact us at michael@cursor.so
                    <br />
                </div>
            </div>
        </Modal>
    )
}

function NoAuthRateLimitPopup() {
    const showError = useAppSelector(gsel.getShowNoAuthRateLimit)
    const dispatch = useAppDispatch()

    return (
        <Modal
            isOpen={showError}
            onRequestClose={() => {
                dispatch(gs.closeNoAuthRateLimit())
            }}
            style={customStyles}
        >
            <div className="errorPopup">
                <div className="errorPopup__title">
                    <div className="errorPopup__title_text">
                        Maximum Capacity
                    </div>
                    <div
                        className="errorPopup__title_close"
                        onClick={() => dispatch(gs.closeNoAuthRateLimit())}
                    >
                        <FontAwesomeIcon icon={faClose} />
                    </div>
                </div>
                <div className="errorPopup__body">
                    We're getting more traffic than we can handle right
                    now. Please try again in one minute. To avoid these limits, you can optionally upgrade to <a
                        className="pay-link"
                        onClick={() => dispatch(ts.upgradeCursor(null))}
                    >pro</a>.
                </div>
            </div>
        </Modal>
    )
}

function SSHPopup() {
    const showRemotePopup = useAppSelector(gsel.getShowRemotePopup)
    const remoteCommand = useAppSelector(gsel.getRemoteCommand)
    const remotePath = useAppSelector(gsel.getRemotePath)
    const remoteBad = useAppSelector(gsel.getRemoteBad)
    const dispatch = useAppDispatch()
    const textInputRef = useRef<HTMLInputElement>(null)
    const textInputRef2 = useRef<HTMLInputElement>(null)

    function submit() {
        // if the inputs have more than 2 chars each
        if (
            textInputRef.current!.value.length > 2 &&
            textInputRef2.current!.value.length > 2
        ) {
            dispatch(gs.openRemoteFolder(null))
        }
    }

    return (
        <Modal
            isOpen={showRemotePopup}
            onRequestClose={() => {
                dispatch(gs.closeRemotePopup(null))
            }}
            style={customStyles}
        >
            <div className="errorPopup">
                <div className="errorPopup__title">
                    <div className="errorPopup__title_text">
                        Connect to SSH directory
                    </div>
                    <div
                        className="remotePopup__title_close"
                        onClick={() => dispatch(gs.closeRemotePopup(null))}
                    >
                        <FontAwesomeIcon icon={faClose} />
                    </div>
                </div>
                {remoteBad && (
                    <div className="errorPopup__body">
                        The SSH command or path you entered is invalid. Please
                        try again.
                    </div>
                )}
                <div className="remotePopup__body">
                    <div className="settings__item_title">SSH Command</div>
                    <div className="settings__item_description">
                        Same command you would put in the terminal
                    </div>
                    <input
                        type="text"
                        placeholder="ssh -i ~/keys/mypemfile.pem ubuntu@ec2dns.aws.com"
                        ref={textInputRef}
                        value={remoteCommand}
                        onChange={(e) =>
                            dispatch(gs.setRemoteCommand(e.target.value))
                        }
                    />
                </div>
                <div className="remotePopup__body">
                    <div className="settings__item_title">Target Folder</div>
                    <div className="settings__item_description">
                        Must be an absolute path
                    </div>
                    <input
                        type="text"
                        placeholder="/home/ubuntu/portal/"
                        value={remotePath}
                        ref={textInputRef2}
                        onChange={(e) =>
                            dispatch(gs.setRemotePath(e.target.value))
                        }
                        onKeyDown={(event: any) => {
                            if (event.key === 'Enter') {
                                submit()
                            }
                        }}
                    />
                </div>
                <div className="submit-button-parent">
                    <button
                        className="submit-button-ssh"
                        onClick={() => {
                            submit()
                        }}
                    >
                        Submit
                    </button>
                </div>
            </div>
        </Modal>
    )
}

// A component that renders a button to open a file dialog
function FileDialog() {
    // Get the dispatch function from the app context
    const dispatch = useAppDispatch()
    return (
        // Render a div with a click handler that dispatches an action to open a folder
        <div
            className="filedialog"
            onClick={() => dispatch(gs.openFolder(null))}
        >
            Open Folder
        </div>
    )
}

export function App() {
    const dispatch = useAppDispatch()
    const isNotFirstTime = useAppSelector(gsel.getIsNotFirstTime)
    const rootPath = useAppSelector(getRootPath)
    const folders = useAppSelector(getFolders)
    const leftSideExpanded = useAppSelector(tsel.getLeftSideExpanded)
    const handleExpandLeftSideClick = () => {
        dispatch(ts.expandLeftSide())
    }

    const handleCollapseClick = () => {
        dispatch(ts.leftTabInactive())
        dispatch(ts.collapseLeftSide())
    }
    const paneSplits = useAppSelector(getPaneStateBySplits)

    const zoomFactor = useAppSelector(getZoomFactor)
    const titleHeight = Math.round((1.0 / zoomFactor) * 35) + 'px'

    // set window height to 100 vh - titlebar height
    const windowHeight = 'calc(100vh - ' + titleHeight + ')'

    const commandBarOpen = useAppSelector(csel.getIsCommandBarOpen)
    const currentActiveTab = useAppSelector(getFocusedTab)

    // Get the currently opened filename
    const activeFilePath = useAppSelector(gsel.getCurrentFilePath)

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            const AI_KEYS = ['k', 'l', 'Backspace', 'Enter']
            //
            const isControl = connector.PLATFORM_CM_KEY === 'Ctrl'
            if ((isControl && e.ctrlKey) || (!isControl && e.metaKey)) {
                if (AI_KEYS.includes(e.key)) {
                    if (e.shiftKey && e.key == 'Enter') {
                        dispatch(ct.pressAICommand('Shift-Enter'))
                        e.stopPropagation()
                    } else {
                        dispatch(
                            ct.pressAICommand(
                                e.key as 'k' | 'l' | 'Backspace' | 'Enter'
                            )
                        )
                        if (e.key != 'Backspace' && e.key != 'Enter') {
                            // Bug where I'm not sure why this is needed
                            e.stopPropagation()
                        }
                    }
                } else if (e.key == 'e' && e.shiftKey) {
                    dispatch(ct.pressAICommand('singleLSP'))
                    e.stopPropagation()
                } else if (e.key == 'h') {
                    dispatch(ct.pressAICommand('history'))
                    e.stopPropagation()
                }
            }

            // if meta key is pressed, focus can be anywhere
            if (e.metaKey) {
                if (e.key === 'b') {
                    dispatch(ts.toggleLeftSide())
                }
            }

            // if the escape key
            if (e.key === 'Escape') {
                dispatch(cs.setChatOpen(false))
                if (commandBarOpen) {
                    dispatch(cs.abortCommandBar())
                }
            }
        },
        [dispatch, currentActiveTab, commandBarOpen]
    )

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown, { capture: true })
        // Don't forget to clean up
        return function cleanup() {
            document.removeEventListener('keydown', handleKeyDown, {
                capture: true,
            })
        }
    }, [handleKeyDown])

    useLayoutEffect(() => {
        if (rootPath == null) {
            dispatch(gs.initState(null))
        }
    }, [rootPath])

    const screenState =
        isNotFirstTime == false
            ? 'welcome'
            : Object.keys(folders).length <= 1
            ? 'folder'
            : 'normal'

    const [dragging, setDragging] = useState(false)
    const [leftSideWidth, setLeftSideWidth] = useState(250)
    const [leftSideWidthTemp, setLeftSideWidthTemp] = useState(250)
    useEffect(() => {
        const throttledMouseMove = throttleCallback((event: any) => {
            if (dragging) {
                event.preventDefault()
                event.stopPropagation()

                const diff = event.clientX

                if (diff >= 169) {
                    setLeftSideWidth(diff)
                    handleExpandLeftSideClick()
                } else if (diff <= 50) {
                    handleCollapseClick()
                    setLeftSideWidth(leftSideWidthTemp)
                }
            }
        }, 10)
        document.addEventListener('mousemove', throttledMouseMove)
        return () => {
            document.removeEventListener('mousemove', throttledMouseMove)
        }
    }, [dragging])
    useEffect(() => {
        function handleMouseUp() {
            setDragging(false)
        }
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [])

    return (
        <>
            {commandBarOpen && <CommandBar parentCaller={'commandBar'} />}
            <TitleBar
                titleHeight={titleHeight}
                useButtons={screenState === 'normal'}
            />
            <div className="window relative" style={{ height: windowHeight }}>
                {screenState === 'welcome' && <WelcomeScreen />}
                {screenState === 'folder' && (
                    <>
                        <SSHPopup />
                        <FileDialog />
                    </>
                )}
                {screenState === 'normal' && (
                    <>
                        <div
                            className={`app__lefttopwrapper ${
                                leftSideExpanded ? 'flex' : 'hidden'
                            }`}
                            style={{ width: leftSideWidth + 'px' }}
                        >
                            <LeftSide />
                        </div>
                        <div
                            className={`leftDrag ${
                                leftSideExpanded ? 'ioio' : 'folded'
                            }`}
                            onMouseDown={() => {
                                setDragging(true)
                                setLeftSideWidthTemp(leftSideWidth)
                            }}
                        ></div>
                        <div className="app__righttopwrapper">
                            <div className="app__paneholderwrapper">
                                <PaneHolder paneIds={paneSplits} depth={1} />
                            </div>
                            <div className="app__terminalwrapper">
                                <BottomTerminal />
                            </div>
                        </div>
                        <ChatPopup />
                        <ErrorPopup />
                        <RateLimitPopup />
                        <NoAuthRateLimitPopup />
                        <SettingsPopup />
                        <FeedbackArea />
                        <SSHPopup />
                    </>
                )}
            </div>
        </>
    )
}
