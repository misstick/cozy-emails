_ = require 'underscore'
React     = require 'react'
ReactDOM  = require 'react-dom'

{section, header, ul, li, span, i, p, h3, a, button} = React.DOM
DomUtils = require '../utils/dom_utils'
MessageUtils = require '../utils/message_utils'

{MessageActions} = require '../constants/app_constants'

Message = React.createFactory require './message'

RouterGetter = require '../getters/router'

RouterActionCreator = require '../actions/router_action_creator'

# FIXME : use Getters instead of Stores
AccountStore        = require '../stores/account_store'
MessageStore        = require '../stores/message_store'
SelectionStore       = require '../stores/selection_store'
StoreWatchMixin      = require '../mixins/store_watch_mixin'

module.exports = React.createClass
    displayName: 'Conversation'

    mixins: [
        StoreWatchMixin [SelectionStore]
    ]

    componentDidMount: ->
        @_initScroll()

    componentDidUpdate: ->
        @_initScroll()

    getStateFromStores: (props) ->
        return {
            message: RouterGetter.getMessage()
            conversation: RouterGetter.getConversation()
        }

    renderMessage: (message) ->
        messageID = message.get 'id'
        props = MessageUtils.formatContent message

        Message _.extend props, {
            ref         : 'message'
            key         : "message-#{messageID}"
            message     : message
            active      : @props.messageID is messageID
            resources   : RouterGetter.getResources message
        }

    render: ->
        unless @state.conversation?.length
            return section
                key: 'conversation'
                className: 'conversation panel'
                'aria-expanded': true,
                p null, t "app loading"

        # Starts components rendering
        section
            ref: 'conversation'
            className: 'conversation panel'
            'aria-expanded': true,

            header null,
                h3 className: 'conversation-title',
                    @state.message.get 'subject'

                button
                    className: 'clickable btn btn-default fa fa-close'
                    onClick: @closeConversation

            section
                ref: 'scrollable',
                    @state.conversation.map @renderMessage

    closeConversation: ->
        action = MessageActions.SHOW_ALL
        RouterActionCreator.navigate {action}

    _initScroll: ->
        if not (scrollable = ReactDOM.findDOMNode @refs.scrollable) or scrollable.scrollTop
            return

        if (activeElement = scrollable.querySelector '[data-message-active="true"]')
            unless DomUtils.isVisible activeElement
                coords = activeElement.getBoundingClientRect()
                scrollable.scrollTop = coords.top
