_ = require 'lodash'

AppDispatcher = require '../libs/flux/dispatcher/dispatcher'

RouterStore = require '../stores/router_store'

XHRUtils = require '../libs/xhr'

{ActionTypes, MessageActions, SearchActions} = require '../constants/app_constants'

_pages = {}
_nextURL = {}

RouterActionCreator =
    # Refresh Emails from Server
    # This is a read data pattern
    # ActionCreator is a write data pattern
    refreshMailbox: ({mailboxID, deep}) ->
        deep ?= true

        AppDispatcher.dispatch
            type: ActionTypes.REFRESH_REQUEST
            value: {mailboxID, deep}

        XHRUtils.refreshMailbox mailboxID, {deep}, (error, updated) ->
            if error?
                AppDispatcher.dispatch
                    type: ActionTypes.REFRESH_FAILURE
                    value: {mailboxID, error, deep}
            else
                AppDispatcher.dispatch
                    type: ActionTypes.REFRESH_SUCCESS
                    value: {mailboxID, updated, deep}


    gotoCurrentPage: (params={}) ->
        {url} = params

        # Always load messagesList
        action = MessageActions.SHOW_ALL
        timestamp = (new Date()).toISOString()
        url ?= RouterStore.getCurrentURL {action}

        AppDispatcher.dispatch
            type: ActionTypes.MESSAGE_FETCH_REQUEST
            value: {url, timestamp}

        XHRUtils.fetchMessagesByFolder url, (error,result) =>
            # Save messagesLength per page
            # to get the correct pageAfter param
            # for getNext handles
            _setNextURL result
            hasNextPage = _getNextURL()?

            if error?
                AppDispatcher.dispatch
                    type: ActionTypes.MESSAGE_FETCH_FAILURE
                    value: {error, url, timestamp, hasNextPage}
            else
                AppDispatcher.dispatch
                    type: ActionTypes.MESSAGE_FETCH_SUCCESS
                    value: {result, url, timestamp, hasNextPage}

                # Fetch missing messages
                isMissingMessages = not RouterStore.isPageComplete()
                if RouterStore.hasNextPage() and isMissingMessages
                    @gotoNextPage()


    gotoNextPage: ->
        url = _getNextURL()
        @gotoCurrentPage {url}


    gotoCompose: (params={}) ->
        {messageID, mailboxID} = params
        action = MessageActions.NEW
        mailboxID ?= RouterStore.getMailboxID()
        AppDispatcher.dispatch
            type: ActionTypes.ROUTE_CHANGE
            value: {mailboxID, messageID, action}


    gotoMessage: (params={}) ->
        {messageID, mailboxID, action} = params
        messageID ?= RouterStore.getMessageID()
        mailboxID ?= RouterStore.getMailboxID()
        action ?= MessageActions.SHOW

        AppDispatcher.dispatch
            type: ActionTypes.ROUTE_CHANGE
            value: {messageID, mailboxID, action}


    gotoPreviousMessage: ->
        message = RouterStore.gotoPreviousMessage()
        messageID = message?.get 'id'
        mailboxID = message?.get 'mailboxID'
        @gotoMessage {messageID, mailboxID}


    gotoNextMessage: ->
        message = RouterStore.gotoNextMessage()
        messageID = message?.get 'id'
        mailboxID = message?.get 'mailboxID'
        @gotoMessage {messageID, mailboxID}


    gotoPreviousConversation: ->
        message = RouterStore.getNextConversation()
        messageID = message?.get 'id'
        mailboxID = message?.get 'mailboxID'
        @gotoMessage {messageID, mailboxID}


    gotoNextConversation: ->
        message = RouterStore.getNextConversation()
        messageID = message?.get 'id'
        mailboxID = message?.get 'mailboxID'
        @gotoMessage {messageID, mailboxID}



    closeConversation: (params={}) ->
        {mailboxID} = params
        mailboxID ?= RouterStore.getMailboxID()
        action = MessageActions.SHOW_ALL
        AppDispatcher.dispatch
            type: ActionTypes.ROUTE_CHANGE
            value: {mailboxID, action}


    showMessageList: (params={}) ->
        @closeConversation params


    getConversation: (conversationID) ->
        page = _getPage()
        timestamp = (new Date()).toISOString()

        AppDispatcher.dispatch
            type: ActionTypes.MESSAGE_FETCH_REQUEST
            value: {conversationID, timestamp, page}

        XHRUtils.fetchConversation {conversationID}, (error, messages) =>
            if error?
                AppDispatcher.dispatch
                    type: ActionTypes.MESSAGE_FETCH_FAILURE
                    value: {error, conversationID, timestamp, page}
            else
                result = {messages}
                AppDispatcher.dispatch
                    type: ActionTypes.MESSAGE_FETCH_SUCCESS
                    value: {result, conversationID, timestamp, page}


    mark: (target, action) ->
        timestamp = Date.now()

        AppDispatcher.dispatch
        type: ActionTypes.MESSAGE_FLAGS_REQUEST
        value: {target, action}

        XHRUtils.batchFlag {target, action}, (error, updated) =>
            if error
                AppDispatcher.dispatch
                    type: ActionTypes.MESSAGE_FLAGS_FAILURE
                    value: {target, error, action}
            else
                message.updated = timestamp for message in updated
                AppDispatcher.dispatch
                    type: ActionTypes.MESSAGE_FLAGS_SUCCESS
                    value: {target, updated, action}

    # Delete message(s)
    # target:
    # - messageID or
    # - messageIDs or
    # - conversationIDs or
    # - conversationIDs
    deleteMessage: (target={}) ->
        timestamp = Date.now()
        target.messageID ?= RouterStore.getMessageID()
        target.accountID ?= RouterStore.getAccountID()

        AppDispatcher.dispatch
            type: ActionTypes.MESSAGE_TRASH_REQUEST
            value: {target}

        # send request
        XHRUtils.batchDelete target, (error, updated) =>
            if error
                AppDispatcher.dispatch
                    type: ActionTypes.MESSAGE_TRASH_FAILURE
                    value: {target, error}
            else
                message.updated = timestamp for message in updated
                AppDispatcher.dispatch
                    type: ActionTypes.MESSAGE_TRASH_SUCCESS
                    value: {target, updated}


    addFilter: (params) ->
        filter = {}
        separator = ','
        filters = RouterStore.getFilter()

        for key, value of params
            # Toggle filter value
            # Add value if it doesnt exist
            # Remove if from filters otherwhise
            tmp = filters[key]
            tmp = tmp.split separator if _.isString filters[key]
            value = decodeURIComponent value

            if 'flags' is key
                tmp ?= []
                if -1 < tmp.indexOf value
                    tmp = _.without tmp, value
                else
                    tmp.push value
                filter[key] = tmp?.join separator
            else
                filter[key] = value

        # FIXME : use distacher instead
        # then into routerStore, use navigate
        @navigate url: RouterStore.getCurrentURL {filter, isServer: false}


    searchAll: (params={}) ->
        {query} = params
        action = SearchActions.SHOW_ALL
        AppDispatcher.dispatch
            type: ActionTypes.ROUTE_CHANGE
            value: {query, action}


_getPageKey = ->
    mailboxID = RouterStore.getMailboxID()
    query = RouterStore.getQuery()
    "#{mailboxID}#{query}"


_getPage = ->
    key = _getPageKey()
    _pages[key] ?= -1
    _pages[key]


_addPage = ->
    key = _getPageKey()
    _pages[key] ?= -1
    ++_pages[key]


_getPreviousURI = ->
    if (page = _getPage()) > 0
        key = _getPageKey()
        "#{key}-#{--page}"


_getNextURI = ->
    key = _getPageKey()
    page = _getPage()
    "#{key}-#{page}"


_getNextURL = ->
    key = _getNextURI()
    _nextURL[key]


# Get URL from last fetch result
# not from the list that is not reliable
_setNextURL = ({messages}) ->
    page = _addPage()
    key = _getNextURI()

    # Do not overwrite result
    # that has no reasons to changes
    if _nextURL[key] is undefined
        action = MessageActions.SHOW_ALL
        filter = pageAfter: _.last(messages)?.date

        _previousURI = _getPreviousURI()
        value = RouterStore.getCurrentURL {filter, action}
        if not _previousURI or _nextURL[_previousURI] isnt value
            _nextURL[key] = value


module.exports = RouterActionCreator
