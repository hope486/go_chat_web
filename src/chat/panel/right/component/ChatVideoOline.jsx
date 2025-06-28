import React from 'react';
import {
    Tooltip,
    Button,
    Drawer,
    Modal
} from 'antd';

import {
    VideoCameraOutlined,
    PoweroffOutlined
} from '@ant-design/icons';

import * as Constant from '../../../common/constant/Constant'
import { connect } from 'react-redux'
import { actions } from '../../../redux/module/panel'

class ChatVideoOline extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            mediaPanelDrawerVisible: false,
            videoCallModal: false,
        }
    }

    componentDidMount() {
        // 不再创建独立的localPeer，使用Panel中的全局peer
    }

    videoIntervalObj = null;

    /**
     * 开启视频电话
     */
    startVideoOnline = () => {
        if (!this.props.checkMediaPermisssion()) {
            return;
        }
        let media = {
            ...this.props.media,
            mediaConnected: false,
            mediaReject: false,
        }
        this.props.setMedia(media);
        this.setState({
            videoCallModal: true,
        })

        let data = {
            contentType: Constant.DIAL_VIDEO_ONLINE,
            type: Constant.MESSAGE_TRANS_TYPE,
        }
        this.props.sendMessage(data);
        this.videoIntervalObj = setInterval(() => {
            console.log("video call interval check")
            // 对方接受视频
            if (this.props.media && this.props.media.mediaConnected) {
                console.log("Media connected, stopping interval and starting video")
                this.setMediaState();
                this.sendVideoData();
                return;
            }

            // 对方拒接
            if (this.props.media && this.props.media.mediaReject) {
                console.log("Media rejected, stopping interval")
                this.setMediaState();
                return;
            }

            // 检查WebSocket连接状态
            if (!this.props.socket || this.props.socket.readyState !== 1) {
                console.log("WebSocket not connected, stopping video call");
                this.setMediaState();
                return;
            }

            console.log("Resending video call request")
            this.props.sendMessage(data);
        }, 3000)
    }

    setMediaState = () => {
        console.log("Clearing video call interval")
        if (this.videoIntervalObj) {
            clearInterval(this.videoIntervalObj);
            this.videoIntervalObj = null;
        }
        this.setState({
            videoCallModal: false,
        })
        let media = {
            ...this.props.media,
            mediaConnected: false,
            mediaReject: false,
        }
        this.props.setMedia(media)
    }

    sendVideoData = () => {
        console.log("Starting video data transmission")
        let preview = document.getElementById("localPreviewSender");

        // 使用Panel中的全局peer，而不是创建新的
        const localPeer = this.props.peer?.localPeer;
        if (!localPeer) {
            console.error("No localPeer available");
            return;
        }

        navigator.mediaDevices
            .getUserMedia({
                audio: true,
                video: true,
            }).then((stream) => {
                console.log("Got user media stream")
                preview.srcObject = stream;

                // 清除之前的tracks
                const senders = localPeer.getSenders();
                senders.forEach(sender => {
                    if (sender.track) {
                        localPeer.removeTrack(sender);
                    }
                });

                // 添加新的tracks
                stream.getTracks().forEach(track => {
                    localPeer.addTrack(track, stream);
                });

                // 创建offer
                localPeer.createOffer()
                    .then(offer => {
                        console.log("Created offer", offer)
                        localPeer.setLocalDescription(offer);
                        let data = {
                            contentType: Constant.VIDEO_ONLINE,
                            content: JSON.stringify(offer),
                            type: Constant.MESSAGE_TRANS_TYPE,
                        }
                        this.props.sendMessage(data);
                    })
                    .catch(error => {
                        console.error("Error creating offer:", error)
                    });
            })
            .catch(error => {
                console.error("Error getting user media:", error)
            });

        this.setState({
            mediaPanelDrawerVisible: true
        })
    }

    /**
     * 停止视频电话,屏幕共享
     */
    stopVideoOnline = () => {
        console.log("Stopping video online")
        let preview = document.getElementById("localPreviewSender");
        if (preview && preview.srcObject && preview.srcObject.getTracks()) {
            preview.srcObject.getTracks().forEach((track) => track.stop());
        }

        let remoteVideo = document.getElementById("remoteVideoSender");
        if (remoteVideo && remoteVideo.srcObject && remoteVideo.srcObject.getTracks()) {
            remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
        }

        // 停止媒体面板
        this.setState({
            mediaPanelDrawerVisible: false
        })

        let media = {
            ...this.props.media,
            showMediaPanel: false,
            mediaConnected: false,
        }
        this.props.setMedia(media)
    }

    mediaPanelDrawerOnClose = () => {
        this.setState({
            mediaPanelDrawerVisible: false
        })
    }

    handleOk = () => {
        // 这个组件的handleOk没有实际作用，主要处理在Panel.jsx中
    }

    handleCancel = () => {
        console.log("Cancelling video call")
        this.setState({
            videoCallModal: false,
        })
        let data = {
            contentType: Constant.CANCELL_VIDEO_ONLINE,
            type: Constant.MESSAGE_TRANS_TYPE,
        }
        this.props.sendMessage(data);
        if (this.videoIntervalObj) {
            clearInterval(this.videoIntervalObj);
            this.videoIntervalObj = null;
        }
    }

    render() {
        const { chooseUser } = this.props;
        return (
            <>
                <Tooltip title="视频聊天">
                    <Button
                        shape="circle"
                        onClick={this.startVideoOnline}
                        style={{ marginRight: 10 }}
                        icon={<VideoCameraOutlined />}
                        disabled={chooseUser.toUser === ''}
                    />
                </Tooltip>

                <Drawer width='820px'
                    forceRender={true}
                    title="媒体面板"
                    placement="right"
                    onClose={this.mediaPanelDrawerOnClose}
                    visible={this.state.mediaPanelDrawerVisible}
                >
                    <Tooltip title="结束视频语音">
                        <Button
                            shape="circle"
                            onClick={this.stopVideoOnline}
                            style={{ marginRight: 10, float: 'right' }}
                            icon={<PoweroffOutlined style={{ color: 'red' }} />}
                        />
                    </Tooltip>
                    <br />
                    <video id="localPreviewSender" width="700px" height="auto" autoPlay muted controls />
                    <video id="remoteVideoSender" width="700px" height="auto" autoPlay muted controls />
                </Drawer>

                <Modal
                    title="视频电话"
                    visible={this.state.videoCallModal}
                    onOk={this.handleOk}
                    onCancel={this.handleCancel}
                    okText="确认"
                    cancelText="取消"
                >
                    <p>呼叫中...</p>
                </Modal>
            </>
        );
    }
}


function mapStateToProps(state) {
    return {
        chooseUser: state.panelReducer.chooseUser,
        socket: state.panelReducer.socket,
        peer: state.panelReducer.peer,
        media: state.panelReducer.media,
    }
}

function mapDispatchToProps(dispatch) {
    return {
        setMedia: (data) => dispatch(actions.setMedia(data)),
        setPeer: (data) => dispatch(actions.setPeer(data)),
    }
}

ChatVideoOline = connect(mapStateToProps, mapDispatchToProps)(ChatVideoOline)

export default ChatVideoOline