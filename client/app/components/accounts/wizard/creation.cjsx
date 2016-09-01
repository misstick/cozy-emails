{IMAP_OPTIONS}  = require '../../../constants/defaults'
{OAuthDomains}  = require '../../../constants/app_constants'

_               = require 'underscore'
React           = require 'react'
ReactDOM        = require 'react-dom'
AccountsLib     = require '../../../libs/accounts'

LinkedStateMixin = require 'react-addons-linked-state-mixin'

Form    = require '../../basics/form'
Servers = require '../servers'

reduxStore = require '../../../redux_store'
RequestsGetter = require '../../../getters/requests'


# @TODO in this file
#  - separate account props from commonent state
#           (state.account instanceof Account)
#  - make account state part of the redux store ?
#  - state.mailboxID is poorly named
#           (its used to determine if we are editing / done)

# FIXME: QUID du target _blank (faille de secu)

# Top var for redirect timeout
redirectTimer = undefined


_getInitialState = ->

    defaultSecurityValue = 'starttls'
    return {
        account: null
        mailboxID: null

        OAuth: null

        alert: null

        expanded: false
        isBusy: false
        disable: true

        fields:
            login: null
            password: null

            imapServer: null
            imapPort: AccountsLib.DEFAULT_PORTS.imap[defaultSecurityValue]
            imapSecurity: defaultSecurityValue
            imapLogin: null

            smtpServer: null
            smtpPort: AccountsLib.DEFAULT_PORTS.smtp[defaultSecurityValue]
            smtpSecurity: defaultSecurityValue
            smtpLogin: null
    }


# Get some state.properties
# from RequestStore to handle activity from outside
_getStateFromStores = (props={}) ->
    account = RequestsGetter.getAccountCreationSuccess(state)?.account

    state =
        account: account
        OAuth: RequestsGetter.isAccountOAuth(state)
        mailboxID: account?.inboxMailbox
        # discover: RequestsGetter.getAccountCreationDiscover(state)

        isBusy: RequestsGetter.isAccountCreationBusy(state)

        # Only enable submit when a request isnt performed in background and
        # if required fields (email / password) are filled
        disable: not (not state.isBusy and not _.isEmpty(props.login) and
                    not _.isEmpty(props.password))

        alert: RequestsGetter.getAccountCreationAlert(state)

    # Get Specific Provider properties
    # ie. Server, Port, or Security values
    if state.discover
        _.extend state, AccountsLib.getProviderProps state.discover

    return state


module.exports = AccountWizardCreation = React.createClass

    displayName: 'AccountWizardCreation'

    mixins: [LinkedStateMixin]

    # TODO: voir quelles props sont à déplacer dans le state
    # formValues
    propTypes:
        doAccountDiscover   : React.PropTypes.func.isRequired
        doAccountCheck      : React.PropTypes.func.isRequired
        doCloseModal        : React.PropTypes.func.isRequired


    # TODO: lister les clés désirées
    getInitialState: ->
        _getInitialState()


    componentDidMount: ->
        # Select first field of the form
        ReactDOM.findDOMNode(@).querySelector('[name=login]')?.focus()


    componentWillReceiveProps: (nextProps) ->
        @updateState _getStateFromStores nextProps, @state


    componentWillUpdate: (nextProps, nextState) ->
        # FIXME : corriger la création du compte
        # # Enable auto-redirect only on update
        # # after an ADD_ACCOUNT_SUCCESS
        # if nextProps.mailboxID
        #     redirectTimer = setTimeout ->
        #         if RequestsGetter.getAccountCreationSuccess reduxStore.getState()
        #             @props.doCloseModal nextProps.mailboxID
        #     , AccountsLib.REDIRECT_DELAY


    toValueLink: (name) ->
        value: @state.fields[name]
        requestChange: @onFieldChange


    render: ->
        # TODO : passer le state en props
        # ajouter la mechanique qui permet à la vue
        # de mettre elle même à jour ses props
        console.log "CREATE", @state, @props

        <div role='complementary' className="backdrop" onClick={@close}>
            <div className="backdrop-wrapper">
                <section className='settings'>
                    <h1>{t('account wizard creation')}</h1>

                    <Form ns="account-wizard-creation"
                            className="content"
                            onSubmit={@create}>

                        <Form.Input type="text"
                                    name="login"
                                    label={t('account wizard creation login label')}
                                    value={@state.fields.login}
                                    onChange={@onFieldChange} />

                        <Form.Input type="password"
                                    name="password"
                                    label={t('account wizard creation password label')}
                                    value={@state.fields.password}
                                    onChange={@onFieldChange} />

                        {<div className="alert">
                            <p>
                                {t("account wizard alert #{@state.alert.status}")}
                            </p>
                            {<p>
                                {t("account wizard error #{@state.alert.type}")}
                            </p> if @state.alert.type}
                            {<p>
                                {t("account wizard alert oauth")}
                                <a href={OAuthDomains[@state.OAuth]} target="_blank">
                                    {t("account wizard alert oauth link label")}
                                </a>.
                            </p> if @state.OAuth}
                        </div> if @state.alert}

                        <Servers expanded={not @state.expanded}
                                toValueLink={@toValueLink}
                                expanded={@state.expanded}
                                legend={t 'account wizard creation advanced parameters'} />
                    </Form>

                    <footer>
                        <nav>
                            {<button className="success"
                                     ref="success"
                                     name="redirect"
                                     onClick={@close}>
                                {t('account wizard creation success')}
                            </button> if @state.mailboxID}

                            {<button name="cancel"
                                     ref="cancel"
                                     type="button"
                                     onClick={@close}>
                                {t('app cancel')}
                            </button> if not @state.mailboxID}

                            {<button type="submit"
                                     form="account-wizard-creation"
                                     aria-busy={@state.isBusy}
                                     disabled={@state.disable}>
                                {t('account wizard creation save')}
                            </button> unless @state.mailboxID}
                        </nav>
                    </footer>
                </section>
            </div>
        </div>


    # Account creation steps:
    # - reset alerts
    # - trigger action:
    #   1/ if `expanded` feature is enable, perform a discover action
    #   2/ if not, directly check auth
    create: (event) ->
        event.preventDefault()

        # FIXME : missing properties
        # - imapServer, smtpServer

        # TODO : create object from props
        # TODO : add comment about context of these 2 cases

        # A quoi corresponds ça?
        # @state.expanded and not(@state?.imapServer or @state?.smtpServer)
        console.log "CREATE", @props, @state

        # if @state.expanded and not(@state?.imapServer or @state?.smtpServer)
        #     [..., domain] = @props.login.split '@'
        #     @props.doAccountDiscover domain, AccountsLib.sanitizeConfig state
        # else
        #     @props.doAccountCheck
        #         value: AccountsLib.sanitizeConfig state


    # Close the modal when:
    # 1/ click on the modal backdrop
    # 2/ click on the cancel button
    # 3/ click on the success button
    #
    # The close action only occurs if the click event is on one of the
    # aforementioned element and if there's already one account available
    # (otherwise this setting step is mandatory).
    close: (event) ->
        # disabled  = not @state.mailboxID
        # success   = event.target is @refs.success
        # backdrops = event.target in [ReactDOM.findDOMNode(@), @refs.cancel]
        #
        # return if not success and (disabled or not(backdrops))
        #
        # event.stopPropagation()
        # event.preventDefault()
        #
        # # Disable auto-redirect
        # clearTimeout redirectTimer
        #
        # # Redirect to mailboxID if available, will automatically fallback to
        # # current mailbox if no mailboxID is given (cancel case)
        # @props.doCloseModal @state.mailboxID


    onFieldChange: (event) ->
        {target: {value, name}} = event
        (source = {})[name] = value

        previousFields = @state.fields
        nextFields = _.extend {}, previousFields, source

        @updateState {fields: nextFields}


    updateState: (nextState) ->
        state = AccountsLib.validateState nextState, @state
        console.log 'UPDATE', state
        @setState state
