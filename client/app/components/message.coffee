React      = require 'react'
{div, article, footer, ul, i, p, a, textarea} = React.DOM
classNames = require 'classnames'

MessageHeader  = React.createFactory require './message_header'
ToolbarMessage = React.createFactory require './toolbar_message'
MessageContent = React.createFactory require './message-content'
AttachmentPreview = React.createFactory require './attachement_preview'

{MessageFlags, MessageActions} = require '../constants/app_constants'

LayoutActionCreator = require '../actions/layout_action_creator'
RouterActionCreator = require '../actions/router_action_creator'

RouterGetter = require '../getters/router'

module.exports = React.createClass
    displayName: 'Message'


    componentWillUnMount: ->
        # Mark message as read
        messageID = @props.message?.get('id')
        console.log 'MARK_AS_READ', messageID
        # RouterActionCreator.mark {messageID}, MessageFlags.SEEN


    render: ->
        article
            className: classNames
                message: true
                active: @props.active
                isDraft: @props.isDraft
                isDeleted: @props.isDeleted
                isUnread: @props.isUnread
            key: "messageContainer-#{@props.message.get('id')}",

            # FIXME : le click ne fonctionne pas
            # conflit avec 'MessageHeader'?!
            MessageHeader
                ref: 'messageHeader'
                key: "messageHeader-#{@props.message.get('id')}"
                message: @props.message
                avatar: RouterGetter.getAvatar @props.message
                createdAt: RouterGetter.getCreatedAt @props.message
                isDraft: @props.isDraft
                isDeleted: @props.isDeleted
                isFlagged: MessageFlags.FLAGGED in @props.message.get('flags')
                active: @props.active,

            # if @props.active
            #     ToolbarMessage
            #         ref         : 'messageToolbar'
            #         isFull      : true
            #         messageID   : @props.message.get('id')

            if @props.active
                MessageContent
                    ref: 'messageContent'
                    messageID: @props.message.get 'id'
                    html: @props.html
                    text: @props.text
                    rich: @props.rich
                    imagesWarning: @props.imagesWarning

            if @props.active
                footer
                    ref: 'messageFooter'
                    className: 'attachments',
                    ul null,
                        @props.resources.get('preview')?.map (file, index) ->
                            AttachmentPreview
                                ref: "attachmentPreview-#{index}"
                                file: file?.toJS()
                                key: file.get('checksum')
                                preview: true
                                previewLink: true
                        @props.resources.get('binary')?.map (file, index) ->
                            AttachmentPreview
                                ref: "attachmentBinary-#{index}"
                                file: file?.toJS()
                                key: file.get('checksum')
                                preview: false
                                previewLink: true
